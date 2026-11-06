import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import { getOwnedTrip } from './trip.service.js';

const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const isPoint = (point) => point && typeof point.id === 'string' && point.id.length > 2
  && typeof point.label === 'string' && point.label.trim().length >= 3
  && Number.isFinite(Number(point.lat)) && Number(point.lat) >= -90 && Number(point.lat) <= 90
  && Number.isFinite(Number(point.lng)) && Number(point.lng) >= -180 && Number(point.lng) <= 180;
const parseState = (notes) => { try { const value = JSON.parse(notes || 'null'); return value?.wizardVersion === 1 ? value : null; } catch { return null; } };
const invalid = (message, details = []) => { throw ApiError.badRequest(message, details); };

export async function createWizardDraft(userId, state) {
  if (!isPoint(state?.destination)) invalid('Select a destination from the location suggestions.', [{ field: 'destination', message: 'A selected destination with coordinates is required.' }]);
  const trip = await prisma.trip.create({ data: {
    title: `Trip to ${state.destination.name || state.destination.label}`,
    destinationName: state.destination.name || state.destination.label,
    startLocation: 'Departure location not selected',
    travelDate: new Date(), travellers: 1, budget: 0, availableTimeHours: 8,
    destinationId: null, lat: Number(state.destination.lat), lng: Number(state.destination.lng),
    notes: JSON.stringify({ wizardVersion: 1, stage: 2, destination: state.destination, departure: null, mode: null, date: null, departureTime: null, travellers: null, arrivalDate: null, arrivalTime: null, journeyConfirmed: false, accommodation: null, hotel: null, localMode: null, preferences: null, finalConfirmed: false }),
    userId,
  } });
  return { id: trip.id, stage: 2 };
}

export async function saveWizardProgress(tripId, userId, state) {
  const trip = await getOwnedTrip(tripId, userId);
  const previous = parseState(trip.notes);
  if (!previous) invalid('This trip is not an active guided-planning draft.', [{ field: 'tripId', message: 'Create or resume a planner draft.' }]);
  const stage = Number(state?.stage);
  if (!Number.isInteger(stage) || stage < 1 || stage > 14 || stage > previous.stage + 1) invalid('Complete each planning stage in order.', [{ field: 'stage', message: 'You cannot skip an unfinished stage.' }]);
  if (!isPoint(state.destination)) invalid('Select a valid destination.', [{ field: 'destination', message: 'Choose a destination suggestion.' }]);
  if (stage >= 3 && !isPoint(state.departure)) invalid('Select your exact departure point.', [{ field: 'departure', message: 'Choose a station, terminal, airport or address suggestion.' }]);
  if (stage >= 4) {
    if (!isDate(state.date) || !Number.isInteger(Number(state.days)) || Number(state.days) < 1 || Number(state.days) > 30 || !Number.isInteger(Number(state.travellers)) || Number(state.travellers) < 1 || Number(state.travellers) > 50) {
      invalid('Check your travel details.', [{ field: 'date', message: 'Choose a valid departure date.' }, { field: 'days', message: 'Trip duration must be 1–30 days.' }, { field: 'travellers', message: 'Enter 1–50 travellers.' }]);
    }
    if (state.date < new Date().toISOString().slice(0,10)) invalid('Departure date cannot be in the past.', [{ field: 'date', message: 'Choose today or a future date.' }]);
  }
  if (stage >= 5 && !['TRAIN','BUS','FLIGHT','CAR','BIKE','OWN_VEHICLE'].includes(state.mode)) invalid('Select an intercity transportation mode.', [{ field: 'mode', message: 'Choose a mode before confirming the journey.' }]);
  if (state.mode === 'TRAIN' && state.trainNumber != null && !/^\d{1,6}$/.test(state.trainNumber)) invalid('Enter a valid train number.', [{ field: 'trainNumber', message: 'Train numbers are numeric.' }]);
  if (stage >= 6 && !state.journeyConfirmed) invalid('Confirm the selected intercity journey before entering arrival details.', [{ field: 'journeyConfirmed', message: 'Journey confirmation is required.' }]);
  if (stage >= 7 && (!['USER_ENTERED','PROVIDER'].includes(state.arrivalSource) || !isDate(state.arrivalDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(state.arrivalTime || '') || state.arrivalDate < state.date)) {
    invalid('Confirm a valid journey and arrival before continuing.', [{ field: 'arrivalDate', message: 'Arrival must be on or after departure and include a valid time.' }]);
  }
  if (stage >= 8) {
    const stayValid = state.accommodation === 'skip' || (state.accommodation === 'own' && isPoint(state.hotel));
    if (!stayValid) invalid('Select your own accommodation or explicitly skip it.', [{ field: 'accommodation', message: 'A hotel search preference is not a hotel selection.' }]);
  }
  if (stage >= 9 && !['METRO','BUS','CAB','AUTO','BIKE','WALK'].includes(state.localMode)) invalid('Choose an arrival-to-stay transportation preference.', [{ field: 'localMode', message: 'Select a local transportation mode.' }]);
  if (stage >= 10) {
    const p = state.preferences;
    if (!p || !Number.isInteger(Number(p.days)) || Number(p.days) < 1 || Number(p.days) > 30 || !Number.isFinite(Number(p.budget)) || Number(p.budget) <= 0
      || !Number.isFinite(Number(p.availableHours)) || Number(p.availableHours) < 2 || Number(p.availableHours) > 18
      || (p.foodBudgetMin !== '' && p.foodBudgetMin != null && Number(p.foodBudgetMin) < 0)
      || (p.foodBudgetMax !== '' && p.foodBudgetMax != null && Number(p.foodBudgetMax) < 0)
      || (p.foodBudgetMin !== '' && p.foodBudgetMin != null && p.foodBudgetMax !== '' && p.foodBudgetMax != null && Number(p.foodBudgetMin) > Number(p.foodBudgetMax))) {
      invalid('Check your preferences and budget.', [{ field: 'preferences.budget', message: 'Budget, duration, daily hours and meal-budget range must be valid.' }]);
    }
  }
  const destinationChanged = previous.destination?.id !== state.destination.id;
  const departureChanged = Boolean(previous.departure && previous.departure.id !== state.departure?.id);
  const modeChanged = Boolean(previous.mode && previous.mode !== state.mode);
  const departureDateChanged = Boolean(previous.date && previous.date !== state.date);
  const arrivalChanged = Boolean((previous.arrivalDate && previous.arrivalDate !== state.arrivalDate) || (previous.arrivalTime && previous.arrivalTime !== state.arrivalTime));
  const dateChanged = departureDateChanged || arrivalChanged;
  const stayChanged = Boolean(previous.accommodation && (previous.accommodation !== state.accommodation || previous.hotel?.id !== state.hotel?.id));
  const travellersChanged = previous.travellers != null && previous.travellers !== state.travellers;
  const durationChanged = previous.days != null && previous.days !== state.days;
  const preferencesChanged = Boolean(previous.preferences && state.preferences && JSON.stringify(previous.preferences) !== JSON.stringify(state.preferences));
  if (state.finalConfirmed && (stage !== 14 || previous.stage < 14)) invalid('Complete the final review before confirming this trip.', [{ field: 'finalConfirmed', message: 'The final review must be completed first.' }]);
  if (state.finalConfirmed && !trip.itineraries.some((day) => day.items.length > 0)) invalid('Add at least one selected itinerary place before confirming.', [{ field: 'itinerary', message: 'Select at least one attraction or restaurant.' }]);
  let next = { ...state, wizardVersion: 1, stage, finalConfirmed: Boolean(state.finalConfirmed) };
  const updateData = {};
  if (next.finalConfirmed) updateData.status = 'CONFIRMED';
  else if (trip.status === 'CONFIRMED') updateData.status = 'PLANNING';
  if (destinationChanged) { updateData.destinationId = null; updateData.startLocation = 'Departure location not selected'; updateData.startLat = null; updateData.startLng = null; updateData.endDate = null; next = { ...next, departure: null, mode: null, journeyConfirmed: false, arrivalDate: null, arrivalTime: null, arrivalSource: null, accommodation: null, hotel: null, localMode: null, preferences: null }; }
  else if (departureChanged || modeChanged || departureDateChanged) { updateData.endDate = null; next = { ...next, journeyConfirmed: false, arrivalDate: null, arrivalTime: null, arrivalSource: null, accommodation: null, hotel: null, localMode: null, preferences: null }; }
  else if (durationChanged) updateData.endDate = null;
  else if (arrivalChanged) next = { ...next, accommodation: null, hotel: null, localMode: null, preferences: null };
  else if (stayChanged) next = { ...next, localMode: null, preferences: null };
  else if (travellersChanged) next = { ...next, preferences: null };
  updateData.notes = JSON.stringify(next);
  if (isDate(next.date)) updateData.travelDate = new Date(`${next.date}T00:00:00Z`);
  if (isDate(next.arrivalDate) && (next.days || next.preferences?.days)) {
    const start = new Date(`${next.arrivalDate}T12:00:00Z`);
    if (next.arrivalTime >= '21:00') start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + Number(next.days || next.preferences.days) - 1);
    updateData.endDate = end;
  }
  if (next.destination) { updateData.destinationName = next.destination.name || next.destination.label; updateData.lat = Number(next.destination.lat); updateData.lng = Number(next.destination.lng); }
  if (next.departure) { updateData.startLocation = next.departure.label; updateData.startLat = Number(next.departure.lat); updateData.startLng = Number(next.departure.lng); }
  if (Number.isInteger(Number(next.travellers)) && Number(next.travellers) > 0) updateData.travellers = Number(next.travellers);
  if (next.preferences?.budget != null) { updateData.budget = Number(next.preferences.budget); updateData.currency = next.preferences.currency; updateData.foodPreference = next.preferences.foodPreference; updateData.interests = next.preferences.interests; updateData.moodPreferences = next.preferences.moods; updateData.mood = next.preferences.moods[0] || null; updateData.cuisinePreferences = next.preferences.cuisines; updateData.foodBudgetMin = next.preferences.foodBudgetMin; updateData.foodBudgetMax = next.preferences.foodBudgetMax; }
  if (next.preferences?.availableHours != null) updateData.availableTimeHours = Math.round(Number(next.preferences.availableHours));
  if (destinationChanged || departureChanged || modeChanged || dateChanged || durationChanged || stayChanged || travellersChanged || preferencesChanged) {
    await prisma.$transaction([
      prisma.itineraryItem.deleteMany({ where: { itinerary: { tripId } } }),
      prisma.itinerary.deleteMany({ where: { tripId, dayNumber: { gt: 1 } } }),
      prisma.trip.update({ where: { id: tripId }, data: updateData }),
    ]);
  } else await prisma.trip.update({ where: { id: tripId }, data: updateData });
  return { tripId, stage, state: next };
}

export async function assertReadyForDiscovery(tripId, userId) {
  if (!tripId) invalid('Complete the guided trip stages before requesting recommendations.', [{ field: 'tripId', message: 'A confirmed planner trip is required.' }]);
  const trip = await getOwnedTrip(tripId, userId);
  const state = parseState(trip.notes);
  if (!state || state.stage < 10 || !isPoint(state.destination) || !isPoint(state.departure) || !state.journeyConfirmed || !['USER_ENTERED','PROVIDER'].includes(state.arrivalSource) || !(state.accommodation === 'skip' || (state.accommodation === 'own' && isPoint(state.hotel))) || !state.localMode || !state.preferences) {
    invalid('Complete and save the journey, accommodation and preference stages before discovering places.', [{ field: 'stage', message: 'Recommendations are locked until guided planning is complete.' }]);
  }
  return { trip, state };
}
