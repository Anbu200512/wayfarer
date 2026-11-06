import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/respond.js';
import { autocomplete, geocode, searchNearby, searchPlaces } from '../services/osm.service.js';

export const search = asyncHandler(async (req, res) => {
  const { lat, lng, type, radius, limit } = req.query;
  const q = req.query.q || req.query.destination;
  const result = await searchPlaces({ q, lat, lng, kind: type, radius, limit });
  sendSuccess(res, result);
});

export const nearby = asyncHandler(async (req, res) => {
  const { lat, lng, type, radius, limit, q } = req.query;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, message: 'lat and lng are required.' });
  }
  const places = await searchNearby({
    lat: Number(lat),
    lng: Number(lng),
    kind: type,
    radius,
    limit,
    nameQuery: q ?? null,
  });
  return sendSuccess(res, { places });
});

export const geocodeQuery = asyncHandler(async (req, res) => {
  const { q, limit } = req.query;
  const results = await geocode(q, { limit: limit ? Number(limit) : 5 });
  sendSuccess(res, { results });
});

export const autocompleteQuery = asyncHandler(async (req, res) => {
  const results = await autocomplete(req.query.q, { limit: req.query.limit ? Number(req.query.limit) : 7 });
  sendSuccess(res, { results });
});

export default { search, nearby, geocode: geocodeQuery, autocomplete: autocompleteQuery };
