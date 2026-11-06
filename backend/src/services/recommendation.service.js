import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { requestJson } from './ai.service.js';
import { geocode, searchNearby } from './osm.service.js';
import { z } from 'zod';

const moodHints = {
  RELAXATION: ['park', 'garden', 'beach', 'spa', 'viewpoint'], ADVENTURE: ['hiking', 'climbing', 'sport', 'adventure'],
  NATURE: ['park', 'garden', 'nature', 'viewpoint', 'zoo'], PHOTOGRAPHY: ['viewpoint', 'artwork', 'landmark', 'garden'],
  HISTORY: ['historic', 'museum', 'castle', 'monument', 'archaeological'], FOOD: ['market', 'food', 'restaurant', 'cafe'], ROMANTIC: ['garden', 'viewpoint', 'museum', 'waterfront'],
  FAMILY: ['zoo', 'park', 'aquarium', 'museum', 'garden', 'theme_park'],
  BEACH_EXPLORATION: ['beach', 'coast', 'waterfront', 'island'], SHOPPING: ['market', 'shopping', 'mall', 'craft'],
  SPIRITUAL: ['temple', 'church', 'mosque', 'shrine', 'spiritual', 'religious'],
};
const distanceKm = (a, b) => {
  if (!a || !b) return null;
  const r = Math.PI / 180; const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10;
};
const withinRadius = (center, place, radiusKm) => Boolean(center) && Number.isFinite(Number(place.lat))
  && Number.isFinite(Number(place.lng)) && distanceKm(center, place) <= radiusKm;
const matches = (place, terms) => terms.some((term) => `${place.category || ''} ${place.name || ''} ${place.description || ''}`.toLowerCase().includes(term.toLowerCase()));
const totalBudgetFor = (input) => input.budgetType === 'PER_PERSON' ? input.budget * input.travellers : input.budget;

const recommendationAiSchema = z.object({
  attractionOrder: z.array(z.string()).max(30), restaurantOrder: z.array(z.string()).max(30),
  days: z.array(z.object({ day: z.number().int().min(1).max(60), items: z.array(z.object({ id: z.string(), period: z.enum(['MORNING', 'AFTERNOON', 'EVENING']), travelMinutes: z.number().min(0).max(180) })).max(4) })).max(60),
});

async function aiPlan(input, attractions, restaurants) {
  if (!env.groqApiKey) return null;
  const moodPreferences = input.moodPreferences?.length ? input.moodPreferences : [input.mood];
  const prompt = `Create a practical ${input.days}-day itinerary for ${input.destination}, starting from ${input.startLocation || input.destination}. User moods: ${moodPreferences.join(', ')}; interests: ${input.interests.join(', ') || 'open-minded'}; stated budget: ${input.budget} ${input.currency} (${input.budgetType || 'TOTAL'}); group budget equivalent: ${totalBudgetFor(input)} ${input.currency}; travelers: ${input.travellers}; available hours/day: ${input.availableHours}; transport preferences: ${(input.transportationPreferences || []).join(', ') || 'not specified'}; food preference: ${input.foodPreference}; cuisines: ${(input.cuisinePreferences || []).join(', ') || input.cuisine || 'no preference'}; meal budget per person: ${input.foodBudgetMin ?? 'not specified'}–${input.foodBudgetMax ?? 'not specified'} ${input.currency}; ideal-trip instructions: ${input.idealTrip || input.experience || 'none'}. Rank places by the complete preference set, affordability only where real price data is supplied, proximity, and supplied opening hours. Follow the user's ideal-trip instructions when possible, but don't claim unstated facts. If opening hours are absent, do not guess venue availability. Do not infer venue prices or ratings. Use ONLY exact supplied IDs. Return JSON only: {"attractionOrder":["id"],"restaurantOrder":["id"],"days":[{"day":1,"items":[{"id":"exact-id","period":"MORNING|AFTERNOON|EVENING","travelMinutes":15}]}]}. Keep stops sensible and within daily hours, schedule no more than 4 stops/day. Do not create prices, ratings, opening hours, entry fees, addresses, places, or claims. Attractions: ${JSON.stringify(attractions.map(p=>({id:p.id,name:p.name,category:p.category,description:p.description,lat:p.lat,lng:p.lng,rating:p.rating,openingHours:p.openingHours,entryFee:p.entryFee})))} Restaurants: ${JSON.stringify(restaurants.map(p=>({id:p.id,name:p.name,category:p.category,cuisine:p.cuisine,lat:p.lat,lng:p.lng,rating:p.rating,openingHours:p.openingHours})))}`;
  try {
    const parsed = await requestJson({ task: prompt, input: { preferences: input, attractions: attractions.map((p) => ({ id:p.id,name:p.name,category:p.category,description:p.description,lat:p.lat,lng:p.lng,openingHours:p.openingHours })), restaurants: restaurants.map((p) => ({ id:p.id,name:p.name,category:p.category,cuisine:p.cuisine,lat:p.lat,lng:p.lng,openingHours:p.openingHours })) }, validate: { schema: { attractionOrder: ['string'], restaurantOrder: ['string'], days: [{ day: 'number', items: [{ id: 'string', period: 'MORNING|AFTERNOON|EVENING', travelMinutes: 'number' }] }] }, parse: (value) => recommendationAiSchema.parse(value) } });
    const attractionIds = new Set(attractions.map((p) => p.id)); const restaurantIds = new Set(restaurants.map((p) => p.id));
    return { attractionOrder: parsed.attractionOrder.filter((id) => attractionIds.has(id)), restaurantOrder: parsed.restaurantOrder.filter((id) => restaurantIds.has(id)), days: parsed.days.slice(0, input.days).map((day, i) => ({ day: i + 1, items: day.items.filter((item) => attractionIds.has(item.id) || restaurantIds.has(item.id)) })) };
  } catch { return null; }
}

export async function generateRecommendations(input) {
  const destination = await prisma.destination.findFirst({ where: { OR: [
    { name: { equals: input.destination, mode: 'insensitive' } }, { slug: input.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
  ] } }).catch(() => null);
  // Resolve the two locations independently: only destination coordinates center POI searches.
  const startMatches = !input.startCoordinates && input.startLocation && input.startLocation.toLowerCase() !== input.destination.toLowerCase()
    ? await geocode(input.startLocation, { limit: 1 }).catch(() => []) : [];
  const startMatch = startMatches[0];
  const destinationQuery = startMatch?.country && !input.destination.toLowerCase().includes(startMatch.country.toLowerCase())
    ? `${input.destination}, ${startMatch.country}` : input.destination;
  const destinationMatches = !input.destinationCoordinates ? await geocode(destinationQuery, { limit: 1, countryCode: startMatch?.countryCode || null }).catch(() => []) : [];
  const destinationMatch = destinationMatches[0];
  const center = input.destinationCoordinates && Number.isFinite(Number(input.destinationCoordinates.lat)) && Number.isFinite(Number(input.destinationCoordinates.lng))
    ? { lat: Number(input.destinationCoordinates.lat), lng: Number(input.destinationCoordinates.lng) }
    : destinationMatch && Number.isFinite(destinationMatch.lat) && Number.isFinite(destinationMatch.lng)
    ? { lat: destinationMatch.lat, lng: destinationMatch.lng }
    : destination ? { lat: destination.lat, lng: destination.lng } : null;
  const startCenter = input.startCoordinates && Number.isFinite(Number(input.startCoordinates.lat)) && Number.isFinite(Number(input.startCoordinates.lng))
    ? { lat: Number(input.startCoordinates.lat), lng: Number(input.startCoordinates.lng) }
    : startMatch && Number.isFinite(startMatch.lat) && Number.isFinite(startMatch.lng)
    ? { lat: startMatch.lat, lng: startMatch.lng } : (input.startLocation?.toLowerCase() === input.destination.toLowerCase() ? center : null);

  let attractions = []; let restaurants = []; let osmAvailable = false;
  if (center) {
    const [a, r] = await Promise.allSettled([
      searchNearby({ ...center, kind: 'ATTRACTION', radius: 15000, limit: 70 }),
      searchNearby({ ...center, kind: 'RESTAURANT', radius: 10000, limit: 70 }),
    ]);
    attractions = a.status === 'fulfilled' ? a.value : [];
    restaurants = r.status === 'fulfilled' ? r.value : [];
    osmAvailable = a.status === 'fulfilled' || r.status === 'fulfilled';
  }
  if (destination) {
    if (!attractions.length) attractions = await prisma.attraction.findMany({ where: { destinationId: destination.id }, take: 70 }).catch(() => []);
    if (!restaurants.length) restaurants = await prisma.restaurant.findMany({ where: { destinationId: destination.id }, take: 70 }).catch(() => []);
  }
  const normalize = (place, kind) => ({
    id: place.osmKey || `${kind.toLowerCase()}/${place.osmId || place.id || place.name}`,
     sourceId: place.id || null, osmId: place.osmId || null, osmType: place.osmType || null, kind, name: place.name,
     source: place.source || (place.osmId ? 'OpenStreetMap' : null),
    category: place.category || place.cuisine || (kind === 'ATTRACTION' ? 'Attraction' : 'Restaurant'),
    cuisine: place.cuisine || null, description: place.description || null, address: place.address || null, imageUrl: /^https?:\/\//i.test(place.imageUrl || '') ? place.imageUrl : null,
    lat: Number(place.lat), lng: Number(place.lng), openingHours: place.openingHours || null,
    website: /^https?:\/\//i.test(place.website || '') ? place.website : null, rating: place.rating || null, priceLevel: place.priceLevel || null,
    entryFee: place.entryFee == null ? null : Number(place.entryFee),
    dataCheckedAt: new Date().toISOString(),
  });
  const selectedMoods = input.moodPreferences?.length ? input.moodPreferences : [input.mood];
  const moodTerms = selectedMoods.flatMap((mood) => moodHints[mood] || []);
  const interests = [...input.interests, ...moodTerms];
  const unique = (items, kind) => [...new Map(items.filter((p) => p.name && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))).map((p) => {
    const place = normalize(p, kind); return [place.id, place];
  })).values()];
  attractions = unique(attractions, 'ATTRACTION').filter((place) => withinRadius(center, place, 15.5)).sort((a, b) => Number(matches(b, interests)) - Number(matches(a, interests)) || (distanceKm(center, a) ?? 999) - (distanceKm(center, b) ?? 999));
  restaurants = unique(restaurants, 'RESTAURANT').filter((place) => withinRadius(center, place, 10.5)).sort((a, b) => {
    const foodMatch = (p) => input.cuisine && `${p.cuisine} ${p.name}`.toLowerCase().includes(input.cuisine.toLowerCase());
    return Number(foodMatch(b)) - Number(foodMatch(a)) || (distanceKm(center, a) ?? 999) - (distanceKm(center, b) ?? 999);
  });

  const ai = await aiPlan(input, attractions.slice(0, 30), restaurants.slice(0, 30));
  if (ai?.attractionOrder.length) attractions.sort((a, b) => (ai.attractionOrder.indexOf(a.id) < 0 ? Infinity : ai.attractionOrder.indexOf(a.id)) - (ai.attractionOrder.indexOf(b.id) < 0 ? Infinity : ai.attractionOrder.indexOf(b.id)));
  if (ai?.restaurantOrder.length) restaurants.sort((a, b) => (ai.restaurantOrder.indexOf(a.id) < 0 ? Infinity : ai.restaurantOrder.indexOf(a.id)) - (ai.restaurantOrder.indexOf(b.id) < 0 ? Infinity : ai.restaurantOrder.indexOf(b.id)));

  // Heuristic planning estimates are generated server-side and never presented as confirmed prices.
  const groupBudget = totalBudgetFor(input);
  const dailyBudget = groupBudget / input.days;
  const perPersonDay = dailyBudget / input.travellers;
  const estimatedAttractions = attractions.slice(0, 12).map((p) => ({ ...p,
    distanceKm: distanceKm(center, p), visitMinutes: matches(p, ['museum', 'castle', 'palace']) ? 120 : 75,
    estimatedEntryFee: p.entryFee ?? null,
    entryFeeVerified: p.entryFee != null,
    planningCost: p.entryFee ?? perPersonDay * (p.category?.toLowerCase().includes('museum') ? 0.12 : 0.07),
    costBasis: p.entryFee != null ? 'Mapped venue fee' : 'planning-estimate (not an entry fee)',
  }));
  const estimatedRestaurants = restaurants.slice(0, 12).map((p) => ({ ...p, distanceKm: distanceKm(center, p),
    estimatedMealCost: perPersonDay * 0.18, costBasis: 'planning-estimate',
  }));
  const attractionById = new Map(estimatedAttractions.map((p) => [p.id, p]));
  const restaurantById = new Map(estimatedRestaurants.map((p) => [p.id, p]));
  const days = Array.from({ length: input.days }, (_, index) => {
    const date = new Date(`${input.travelDate}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return { day: index + 1, date: date.toISOString().slice(0, 10), items: [] };
  });
  const scheduledIds = new Set();
  if (ai?.days.length) {
    for (const day of ai.days) for (const entry of day.items) {
      const place = attractionById.get(entry.id) || restaurantById.get(entry.id);
      if (place && days[day.day - 1] && !scheduledIds.has(place.id)) {
        days[day.day - 1].items.push({ ...place, period: entry.period, estimatedTravelMinutes: entry.travelMinutes });
        scheduledIds.add(place.id);
      }
    }
  }
  for (const day of days) {
    if (!day.items.length) {
      const attraction = estimatedAttractions[day.day - 1] || estimatedAttractions[0];
      const restaurant = estimatedRestaurants[day.day - 1] || estimatedRestaurants[0];
      if (attraction && !scheduledIds.has(attraction.id)) { day.items.push({ ...attraction, period: 'MORNING', estimatedTravelMinutes: 15 }); scheduledIds.add(attraction.id); }
      if (restaurant && !scheduledIds.has(restaurant.id)) { day.items.push({ ...restaurant, period: 'AFTERNOON', estimatedTravelMinutes: 15 }); scheduledIds.add(restaurant.id); }
      const nextAttraction = estimatedAttractions.find((place) => !scheduledIds.has(place.id));
      if (nextAttraction) { day.items.push({ ...nextAttraction, period: 'EVENING', estimatedTravelMinutes: 20 }); scheduledIds.add(nextAttraction.id); }
    }
    day.items = day.items.slice(0, Math.min(4, Math.max(1, Math.floor(input.availableHours / 2))));
  }
  const sum = (key) => days.reduce((total, day) => total + day.items.reduce((d, p) => d + (p.kind === 'RESTAURANT' ? p.estimatedMealCost : p.planningCost) * input.travellers, 0), 0);
  let attractionCost = sum('estimatedEntryFee'); let foodCost = sum('estimatedMealCost');
  let transportCost = groupBudget * 0.08;
  let estimatedTotal = attractionCost + foodCost + transportCost;
  const factor = estimatedTotal > groupBudget ? groupBudget / estimatedTotal : 1;
  attractionCost *= factor; foodCost *= factor; transportCost *= factor; estimatedTotal = attractionCost + foodCost + transportCost;
  const plannedIds = new Set(days.flatMap((day) => day.items.map((item) => item.id)));
  const hiddenGems = estimatedAttractions.filter((place) => /nature|viewpoint|artwork|garden|historic|archaeological|waterfall|trail/i.test(`${place.category} ${place.name}`)).slice(0, 6).map((place) => ({
    ...place,
    popularityStatus: 'unverified',
    recommendationBasis: 'Heuristic selection from mapped nature, scenic, art, and historic categories; popularity data is not available.',
  }));
  return {
    destination: input.destination, center: center ? { ...center, label: destinationMatch?.label || input.destination } : null,
    destinationCoordinates: center, startLocation: input.startLocation, startLocationCoordinates: startCenter,
    currency: input.currency.toUpperCase(), mood: input.mood,
     source: (attractions.some((p) => p.source === 'Geoapify') || restaurants.some((p) => p.source === 'Geoapify'))
        ? `Geoapify${ai ? ' + Groq AI' : ''}`
        : (osmAvailable ? `OpenStreetMap${ai ? ' + Groq AI' : ''}` : (destination ? `Saved destination data${ai ? ' + Groq AI' : ''}` : (env.groqApiKey ? 'AI fallback' : 'Planning fallback'))),
    aiUsed: Boolean(ai),
    notice: 'Prices and travel times are planning estimates, not verified or live quotes. Confirm details with each venue before travel.',
     attractions: estimatedAttractions.filter((p) => plannedIds.has(p.id)).map((p) => ({ ...p, estimatedEntryFee: p.entryFee == null ? null : Number((p.estimatedEntryFee * factor).toFixed(2)) })),
    hiddenGems,
    restaurants: estimatedRestaurants.filter((p) => plannedIds.has(p.id)).map((p) => ({ ...p, estimatedMealCost: Number((p.estimatedMealCost * factor).toFixed(2)) })),
     itinerary: days.filter((day) => day.items.length > 0).map((day) => ({ ...day, items: day.items.map((p) => ({ ...p,
     estimatedCost: (p.kind === 'RESTAURANT' ? p.estimatedMealCost : p.planningCost) * input.travellers * factor,
    })) })),
     budgetBreakdown: { totalBudget: groupBudget, attractions: Number(attractionCost.toFixed(2)), food: Number(foodCost.toFixed(2)),
       localTransport: Number(transportCost.toFixed(2)), estimatedTotal: Number(estimatedTotal.toFixed(2)), remaining: Number(Math.max(0, groupBudget - estimatedTotal).toFixed(2)),
      basis: 'Server-calculated planning estimates; not current venue prices.' },
    hasLocationData: Boolean(center),
  };
}
