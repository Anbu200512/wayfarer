import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import { generateRecommendations } from '../services/recommendation.service.js';
import { assertReadyForDiscovery } from '../services/wizard.service.js';

export const generate = asyncHandler(async (req, res) => {
  let input = req.body;
  if (req.body.tripId) {
    const { state } = await assertReadyForDiscovery(req.body.tripId, req.user.id);
    input = {
      ...req.body,
      destination: state.destination.label,
      destinationCoordinates: { lat: state.destination.lat, lng: state.destination.lng },
      startLocation: state.departure.label,
      startCoordinates: { lat: state.departure.lat, lng: state.departure.lng },
      travelDate: state.arrivalTime >= '21:00' ? (() => { const d = new Date(`${state.arrivalDate}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0,10); })() : state.arrivalDate,
      travellers: Number(state.travellers),
      days: Number(state.preferences.days), budget: Number(state.preferences.budget), currency: state.preferences.currency,
      availableHours: Number(state.preferences.availableHours), interests: state.preferences.interests, moodPreferences: state.preferences.moods,
      foodPreference: state.preferences.foodPreference, cuisinePreferences: state.preferences.cuisines,
      foodBudgetMin: state.preferences.foodBudgetMin, foodBudgetMax: state.preferences.foodBudgetMax,
      idealTrip: state.preferences.instructions,
    };
  }
  const recommendations = await generateRecommendations(input);
  const discoveryType = req.body.discoveryType || 'ITINERARY';
  const staged = discoveryType === 'ATTRACTIONS'
    ? { ...recommendations, restaurants: [], itinerary: undefined }
    : discoveryType === 'RESTAURANTS'
      ? { ...recommendations, attractions: [], itinerary: undefined }
      : recommendations;
  sendSuccess(res, { ...staged, discoveryType });
});

export default { generate };
