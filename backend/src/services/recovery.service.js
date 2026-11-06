import ApiError from '../utils/ApiError.js';
import prisma from '../config/prisma.js';
import { getOwnedTrip } from './trip.service.js';
import { searchNearby } from './osm.service.js';
import { optimizeRoute } from './route.service.js';
import { requestJson } from './ai.service.js';
import { z } from 'zod';

const kmBetween = (a, b) => {
  const r = Math.PI / 180; const x = (b.lat - a.lat) * r; const y = (b.lng - a.lng) * r;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export async function previewRecovery(tripId, userId, input) {
  const trip = await getOwnedTrip(tripId, userId);
  const days = trip.itineraries;
  const targetDay = days.find((day) => day.dayNumber === Number(input.dayNumber)) || days[0];
  const allItems = (targetDay?.items || []).map((item) => ({ ...item, dayNumber: targetDay.dayNumber }));
  const unavailable = new Set(input.unavailableItemIds || []);
  const original = allItems.filter((item) => !unavailable.has(item.id));
  const expenses = trip.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const availableBudget = Math.max(0, Number(trip.budget) - expenses - Number(input.additionalExpense || 0));
  const availableMinutes = Math.max(0, Math.min(Number(trip.availableTimeHours) * 60, Number(input.remainingTimeMinutes ?? trip.availableTimeHours * 60)));
  const committedCost = original.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0);
  const baseline = original.map((item) => ({ id: item.id, title: item.title, lat: item.lat, lng: item.lng, durationMinutes: item.durationMinutes, estimatedCost: Number(item.estimatedCost || 0), dayNumber: item.dayNumber, type: item.type }));

  let alternatives = [];
  if (trip.lat != null && trip.lng != null && availableMinutes > 0) {
    try {
      const found = await searchNearby({ lat: trip.lat, lng: trip.lng, kind: 'ATTRACTION', radius: input.radiusMeters || 10000, limit: 30 });
      const seen = new Set(baseline.map((p) => `${p.title.toLowerCase()}|${p.lat}|${p.lng}`));
      alternatives = found.filter((p) => p.entryFee === 0 && !seen.has(`${p.name.toLowerCase()}|${p.lat}|${p.lng}`)).map((p) => ({
        id: p.osmKey, title: p.name, lat: p.lat, lng: p.lng, durationMinutes: 60, estimatedCost: 0,
        type: 'ATTRACTION', category: p.category, address: p.address, openingHours: p.openingHours,
        source: 'OpenStreetMap', reason: 'Mapped as free admission in OpenStreetMap; confirm venue details before visiting.',
      }));
    } catch { alternatives = []; }
  }
  const route = await optimizeRoute(baseline.filter((p) => p.lat != null && p.lng != null), trip.lat != null ? { lat: trip.lat, lng: trip.lng } : null);
  let selected = [];
  let minutes = route.available ? route.totalTravelMinutes : 0;
  let cost = 0;
  for (const stop of route.stops) {
    if (minutes + stop.durationMinutes <= availableMinutes && cost + stop.estimatedCost <= availableBudget) {
      selected.push(stop); minutes += stop.durationMinutes; cost += stop.estimatedCost;
    }
  }
  const added = [];
  const candidates = alternatives.sort((a, b) => kmBetween({ lat: trip.lat, lng: trip.lng }, a) - kmBetween({ lat: trip.lat, lng: trip.lng }, b));
  let recoveryAdvice = null;
  if (candidates.length) {
    try {
      const advice = await requestJson({ task: 'Help explain this travel recovery and rank verified alternative attractions. Use only supplied candidate IDs and facts. Do not calculate budget, route, or travel time.', input: { situation: { unavailableStops: baseline.filter((p) => unavailable.has(p.id)).map((p) => p.title), remainingBudget: availableBudget, remainingMinutes: availableMinutes }, candidates: candidates.slice(0, 20).map(({ id, title, category, address }) => ({ id, title, category, address })) }, validate: { schema: { rankedIds: ['string'], explanation: 'string' }, parse: (v) => z.object({ rankedIds: z.array(z.string()).max(20), explanation: z.string().max(400) }).parse(v) }, maxTokens: 400 });
      const candidateIds = new Set(candidates.map((item) => item.id));
      const ranking = new Map(advice.rankedIds.filter((id) => candidateIds.has(id)).map((id, index) => [id, index]));
      candidates.sort((a, b) => (ranking.get(a.id) ?? Infinity) - (ranking.get(b.id) ?? Infinity));
      recoveryAdvice = advice.explanation;
    } catch { /* Algorithmic recovery remains available when AI is unavailable. */ }
  }
  for (const candidate of candidates) {
    if (minutes + candidate.durationMinutes > availableMinutes || cost + candidate.estimatedCost > availableBudget) continue;
    selected.push(candidate); added.push(candidate); minutes += candidate.durationMinutes; cost += candidate.estimatedCost;
    if (selected.length >= 6) break;
  }
  const optimized = await optimizeRoute(selected.filter((p) => p.lat != null && p.lng != null), trip.lat != null ? { lat: trip.lat, lng: trip.lng } : null);
  selected = optimized.stops;
  let routeMinutes = optimized.available ? optimized.totalTravelMinutes + selected.reduce((sum, p) => sum + p.durationMinutes, 0) : null;
  while (selected.length && routeMinutes != null && routeMinutes > availableMinutes) {
    selected.pop();
    const revised = await optimizeRoute(selected.filter((p) => p.lat != null && p.lng != null), trip.lat != null ? { lat: trip.lat, lng: trip.lng } : null);
    selected = revised.stops;
    routeMinutes = revised.available ? revised.totalTravelMinutes + selected.reduce((sum, p) => sum + p.durationMinutes, 0) : null;
  }
  cost = selected.reduce((sum, p) => sum + Number(p.estimatedCost || 0), 0);
  const finalRoute = await optimizeRoute(selected.filter((p) => p.lat != null && p.lng != null), trip.lat != null ? { lat: trip.lat, lng: trip.lng } : null);
  routeMinutes = finalRoute.available ? finalRoute.totalTravelMinutes + selected.reduce((sum, p) => sum + p.durationMinutes, 0) : null;
  const total = routeMinutes != null && routeMinutes <= availableMinutes && cost <= availableBudget;
  const selectedIds = new Set(selected.map((item) => item.id));
  const removed = allItems.filter((item) => !selectedIds.has(item.id)).map((item) => ({
    id: item.id, title: item.title,
    reason: unavailable.has(item.id) ? 'Marked unavailable by traveler.' : 'Removed to meet remaining time or budget constraints.',
  }));
  return {
    tripId, feasible: total, status: total ? 'FEASIBLE' : 'PARTIAL',
    remainingBudget: Math.round((availableBudget - cost) * 100) / 100,
    budget: { original: Number(trip.budget), actualExpenses: expenses, unexpectedExpense: Number(input.additionalExpense || 0), available: availableBudget, plannedAfterRecovery: cost },
    time: { availableMinutes, plannedMinutes: routeMinutes, travelMinutes: finalRoute.totalTravelMinutes, visitMinutes: selected.reduce((sum, p) => sum + p.durationMinutes, 0) },
    route: finalRoute, original: allItems.map((item) => ({ id: item.id, title: item.title, dayNumber: item.dayNumber, estimatedCost: Number(item.estimatedCost), durationMinutes: item.durationMinutes })),
    recovered: finalRoute.stops.map((item, index) => ({ ...item, order: index + 1, dayNumber: item.dayNumber || 1 })), removed, added: added.filter((item) => selected.some((stop) => stop.id === item.id)),
      reasons: [unavailable.size ? `${unavailable.size} unavailable stop(s) removed.` : 'No stops were marked unavailable.', `Budget constraint uses recorded expenses plus the unexpected expense (${availableBudget.toFixed(2)} remaining before new planned costs).`, `Time constraint: ${availableMinutes} minutes available.`, finalRoute.available ? (total ? 'Recovered plan fits the supplied budget and time constraints.' : 'No complete plan fits all constraints; this is the best partial itinerary found.') : 'OSRM did not provide driving data, so travel time and time-feasibility could not be verified.', ...(recoveryAdvice ? [recoveryAdvice] : [])],
    generatedAt: new Date().toISOString(), accepted: false,
  };
}

export async function acceptRecovery(tripId, userId, input) {
  const recovery = await previewRecovery(tripId, userId, input);
  const trip = await getOwnedTrip(tripId, userId);
  const acceptedItems = recovery.recovered;
  const originalItems = trip.itineraries.flatMap((day) => day.items.map((item) => ({ ...item, dayNumber: day.dayNumber })));
  const originalById = new Map(originalItems.map((item) => [item.id, item]));
  const targetDayNumber = Number(input.dayNumber) || trip.itineraries[0]?.dayNumber || 1;
  const targetDay = trip.itineraries.find((day) => day.dayNumber === targetDayNumber) || trip.itineraries[0];
  const keep = new Set(acceptedItems.filter((item) => originalById.has(item.id)).map((item) => item.id));
  await prisma.$transaction(async (tx) => {
    const entries = acceptedItems;
    const keepForDay = new Set(entries.filter((entry) => originalById.has(entry.id)).map((entry) => entry.id));
    await tx.itineraryItem.deleteMany({ where: { itineraryId: targetDay.id, id: { notIn: [...keepForDay] } } });
    for (const [sortOrder, entry] of entries.entries()) {
      const existing = originalById.get(entry.id);
      if (existing && existing.itineraryId === targetDay.id) await tx.itineraryItem.update({ where: { id: existing.id }, data: { sortOrder } });
      else if (!existing) await tx.itineraryItem.create({ data: { itineraryId: targetDay.id, type: 'ATTRACTION', title: entry.title, description: entry.category || null, note: entry.address || null, lat: entry.lat, lng: entry.lng, durationMinutes: entry.durationMinutes || 60, estimatedCost: entry.estimatedCost || 0, sortOrder } });
    }
    const omitted = originalItems.filter((item) => !keep.has(item.id) && item.itineraryId === targetDay.id);
    if (omitted.length) await tx.itineraryItem.deleteMany({ where: { id: { in: omitted.map((item) => item.id) } } });
    if (Number(input.additionalExpense) > 0) await tx.expense.create({ data: { tripId, category: 'OTHER', amount: Number(input.additionalExpense), description: 'Unexpected expense recorded during trip recovery', spentAt: new Date() } });
  });
  return { applied: true, tripId, itemsApplied: acceptedItems.length, feasible: recovery.feasible };
}
