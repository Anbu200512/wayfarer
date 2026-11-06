import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import { getOwnedTrip } from '../services/trip.service.js';
import { getWeather } from '../services/weather.service.js';
import { optimizeRoute } from '../services/route.service.js';
import { acceptRecovery, previewRecovery } from '../services/recovery.service.js';
import { geocode } from '../services/osm.service.js';

export const weather = asyncHandler(async (req, res) => {
  const trip = await getOwnedTrip(req.params.id, req.user.id);
  const day = trip.itineraries.find((item) => item.dayNumber === Number(req.query.day)) || trip.itineraries[0];
  let coordinates = trip.lat != null && trip.lng != null ? { lat: trip.lat, lng: trip.lng } : null;
  if (!coordinates && trip.destinationName) {
    try {
      const [match] = await geocode(trip.destinationName, { limit: 1 });
      if (match) coordinates = { lat: match.lat, lng: match.lng };
    } catch { /* Return an explicit unavailable state below. */ }
  }
  if (!coordinates) return sendSuccess(res, { available: false, currentAvailable: false, travelDateAvailable: false, message: 'Destination coordinates are not available.' });
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : null;
  sendSuccess(res, await getWeather({ ...coordinates, date: requestedDate || day?.date || trip.travelDate }));
});

export const route = asyncHandler(async (req, res) => {
  const trip = await getOwnedTrip(req.params.id, req.user.id);
  const day = trip.itineraries.find((item) => item.id === req.params.dayId);
  if (!day) return res.status(404).json({ success: false, message: 'Itinerary day not found.' });
  sendSuccess(res, await optimizeRoute(day.items.map((item) => ({ id: item.id, title: item.title, lat: item.lat, lng: item.lng, durationMinutes: item.durationMinutes, estimatedCost: Number(item.estimatedCost), sortOrder: item.sortOrder })), { lat: trip.lat, lng: trip.lng }));
});

export const recover = asyncHandler(async (req, res) => sendSuccess(res, await previewRecovery(req.params.id, req.user.id, req.body)));
export const accept = asyncHandler(async (req, res) => sendSuccess(res, await acceptRecovery(req.params.id, req.user.id, req.body)));

export default { weather, route, recover, accept };
