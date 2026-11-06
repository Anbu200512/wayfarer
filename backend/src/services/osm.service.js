import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const OVERPASS_ENDPOINTS = [...new Set([
  env.overpassUrl,
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
].filter(Boolean))];

const NOMINATIM_UA = 'AdaptiveTravelPlanner/1.0 (open source travel planning demo)';

const ATTRACTION_TAGS = [
  '["tourism"~"^(attraction|museum|gallery|artwork|viewpoint|zoo|theme_park|aquarium|castle|palace|memorial|monument|archaeological_site)$"]',
  '["historic"~"^(castle|ruins|monument|memorial|archaeological_site|palace|tower)$"]',
];

const RESTAURANT_TAGS = ['["amenity"~"^(restaurant|fast_food|cafe)$"]'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const overpassCache = new Map();
const OVERPASS_CACHE_TTL_MS = 15 * 60 * 1000;
// Keep expired successful results available as a last-resort response during upstream outages.
const OVERPASS_STALE_TTL_MS = 24 * 60 * 60 * 1000;
let nextOverpassEndpoint = 0;
const geoapifyCache = new Map();
const GEOAPIFY_CACHE_TTL_MS = 30 * 60 * 1000;
const autocompleteCache = new Map();

async function fetchJson(url, { timeoutMs = 25000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Upstream responded with status ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function overpassQuery(query) {
  let lastError = null;
  const start = nextOverpassEndpoint++ % OVERPASS_ENDPOINTS.length;
  const endpoints = OVERPASS_ENDPOINTS.map((_, index) => OVERPASS_ENDPOINTS[(start + index) % OVERPASS_ENDPOINTS.length]);
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': NOMINATIM_UA },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Overpass responded with status ${res.status}`);
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      lastError = error;
      logger.warn(`Overpass endpoint failed (${endpoint}): ${error.message}`);
    }
  }
  logger.error(`All Overpass endpoints failed: ${lastError?.message}`);
  throw ApiError.badRequest(
    'OpenStreetMap Overpass data is temporarily unavailable. Please try again in a moment.',
  );
}

const buildAddress = (tags) => {
  const streetLine = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const parts = [streetLine, tags['addr:city'], tags['addr:postcode']].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

const parseFee = (feeTag) => {
  if (feeTag === undefined || feeTag === null || feeTag === '') return null;
  const normalized = String(feeTag).trim();
  if (/^(no|free|0)$/i.test(normalized)) return 0;
  const numeric = Number.parseFloat(normalized.replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeElement = (element, kind) => {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  const name = tags.name || tags['name:en'] || tags.name_int || tags.brand || null;
  if (!name || lat === undefined || lng === undefined) return null;

  const category =
    kind === 'ATTRACTION'
      ? tags.tourism || tags.historic || tags.amenity || 'attraction'
      : tags.amenity || 'restaurant';

  return {
    osmKey: `${element.type}/${element.id}`,
    osmType: element.type,
    osmId: String(element.id),
    kind,
    name,
    category,
    lat: Number(lat),
    lng: Number(lng),
    description: tags.description || tags['description:en'] || tags.note || null,
    address: buildAddress(tags),
    openingHours: tags.opening_hours || null,
    website: tags.website || tags['contact:website'] || null,
    imageUrl: tags.image || tags.wikimedia_commons || null,
    phone: tags.phone || tags['contact:phone'] || null,
    cuisine: tags.cuisine ? String(tags.cuisine).split(';').join(', ') : null,
    entryFee: kind === 'ATTRACTION' ? parseFee(tags.fee) : null,
    priceLevel: kind === 'RESTAURANT' && /^\d$/.test(tags.price_range || '')
      ? Number(tags.price_range)
      : null,
    rating: Number.isFinite(Number.parseFloat(tags.rating)) ? Number.parseFloat(tags.rating) : null,
  };
};

/**
 * Searches OpenStreetMap via the Overpass API for attractions or restaurants near a coordinate.
 */
async function searchOverpassNearby({
  lat,
  lng,
  kind = 'ATTRACTION',
  radius = 5000,
  limit = 40,
  nameQuery = null,
}) {
  const normalizedKind = String(kind).toUpperCase() === 'RESTAURANT' ? 'RESTAURANT' : 'ATTRACTION';
  const safeRadius = Math.min(Math.max(Number(radius) || 5000, 200), 25000);
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 150);
  const cacheKey = `${normalizedKind}:${Number(lat).toFixed(3)}:${Number(lng).toFixed(3)}:${safeRadius}:${safeLimit}:${nameQuery || ''}`;
  const cached = overpassCache.get(cacheKey);
  if (cached && Date.now() - cached.at < OVERPASS_CACHE_TTL_MS) return cached.places;
  const tags = normalizedKind === 'RESTAURANT' ? RESTAURANT_TAGS : ATTRACTION_TAGS;

  const nameCondition = nameQuery ? `["name"~"${escapeRegex(nameQuery)}",i]` : '';
  const clauses = tags
    .map((tag) => `nwr${tag}${nameCondition}(around:${safeRadius},${lat},${lng});`)
    .join('\n');

  const query = `[out:json][timeout:25];\n(\n${clauses}\n);\nout center tags;`;
  let data;
  try {
    data = await overpassQuery(query);
  } catch (error) {
    if (cached && Date.now() - cached.at < OVERPASS_STALE_TTL_MS) {
      logger.warn(`Returning stale Overpass results after upstream failure (${cacheKey})`);
      return cached.places;
    }
    throw error;
  }
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  const seen = new Set();
  const places = elements
    .map((element) => normalizeElement(element, normalizedKind))
    .filter((place) => {
      if (!place || seen.has(place.osmKey)) return false;
      seen.add(place.osmKey);
      return true;
    })
    .slice(0, safeLimit);
  overpassCache.set(cacheKey, { at: Date.now(), places });
  return places;
};

const geoapifyCategories = (kind) => kind === 'RESTAURANT'
  ? 'catering.restaurant,catering.cafe,catering.fast_food'
  : 'tourism.attraction,tourism.sights,entertainment.museum,entertainment.culture';

const searchGeoapifyNearby = async ({ lat, lng, kind = 'ATTRACTION', radius = 5000, limit = 40, nameQuery = null }) => {
  const normalizedKind = String(kind).toUpperCase() === 'RESTAURANT' ? 'RESTAURANT' : 'ATTRACTION';
  const safeRadius = Math.min(Math.max(Number(radius) || 5000, 200), 20000);
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const cacheKey = `${normalizedKind}:${Number(lat).toFixed(3)}:${Number(lng).toFixed(3)}:${safeRadius}:${safeLimit}:${nameQuery || ''}`;
  const cached = geoapifyCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GEOAPIFY_CACHE_TTL_MS) return cached.places;

  const params = new URLSearchParams({
    categories: geoapifyCategories(normalizedKind),
    filter: `circle:${lng},${lat},${safeRadius}`,
    bias: `proximity:${lng},${lat}`,
    limit: String(safeLimit),
    apiKey: env.geoapifyApiKey,
  });
  if (nameQuery) params.set('name', nameQuery);

  let payload;
  try {
    const response = await fetch(`https://api.geoapify.com/v2/places?${params}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      const cause = response.status === 429 ? 'rate limit exceeded' : `HTTP ${response.status}`;
      throw new Error(`Geoapify Places ${cause}`);
    }
    payload = await response.json();
  } catch (error) {
    logger.warn(`Geoapify Places failed: ${error.message}`);
    if (cached) return cached.places;
    throw error;
  }

  const places = (payload.features || []).map(({ properties: p }) => {
    const categories = Array.isArray(p.categories) ? p.categories : [];
    const raw = p.datasource?.raw || {};
    const name = p.name || raw.name || null;
    if (!name || p.lat == null || p.lon == null || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) return null;
    return {
      id: p.place_id || `${p.datasource?.sourcename || 'geoapify'}:${raw.osm_id || name}`,
      geoapifyId: p.place_id || null,
      type: normalizedKind === 'RESTAURANT' ? 'restaurant' : 'attraction',
      kind: normalizedKind,
      name,
      category: categories.join(', ') || raw.tourism || raw.amenity || null,
      categories,
      lat: Number(p.lat),
      lng: Number(p.lon),
      address: p.formatted || p.address_line2 || p.address_line1 || null,
      description: raw.description || null,
      openingHours: raw.opening_hours || null,
      website: raw.website || null,
      phone: raw.phone || null,
      cuisine: raw.cuisine || null,
      rating: raw.rating != null && Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null,
      entryFee: normalizedKind === 'ATTRACTION' ? parseFee(raw.fee) : null,
      source: 'Geoapify',
    };
  }).filter(Boolean);
  geoapifyCache.set(cacheKey, { at: Date.now(), places });
  return places;
};

export const searchNearby = async (options) => {
  if (env.geoapifyApiKey) {
    try {
      const places = await searchGeoapifyNearby(options);
      if (places.length) return places;
      logger.warn('Geoapify Places returned no matches; falling back to Overpass');
    } catch (error) {
      logger.warn(`Falling back to Overpass after Geoapify failure: ${error.message}`);
    }
  }
  return searchOverpassNearby(options);
};

// Nominatim usage policy allows roughly one request per second; keep a small queue and cache.
let nominatimQueue = Promise.resolve();
const geocodeCache = new Map();
const GEOCODE_TTL_MS = 30 * 60 * 1000;

const withNominatimInterval = (task) => {
  const run = nominatimQueue.then(async () => {
    await sleep(1100);
    return task();
  });
  nominatimQueue = run.catch(() => undefined);
  return run;
};

export const geocode = async (query, { limit = 5, countryCode = null } = {}) => {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];

  const normalizedCountryCode = String(countryCode || '').toLowerCase();
  const cacheKey = `${trimmed.toLowerCase()}::${limit}::${normalizedCountryCode}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < GEOCODE_TTL_MS) return cached.data;

  if (env.geoapifyApiKey) {
    try {
      const params = new URLSearchParams({ text: trimmed, format: 'json', limit: String(limit), apiKey: env.geoapifyApiKey });
      if (normalizedCountryCode) params.set('filter', `countrycode:${normalizedCountryCode}`);
      const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`Geoapify Geocoding HTTP ${response.status}`);
      const payload = await response.json();
      const results = (payload.results || []).map((item, index) => ({
        id: `geo-${item.place_id || index}`,
        name: item.name || item.city || item.address_line1 || trimmed,
        label: item.formatted || item.address_line1 || trimmed,
        lat: Number(item.lat),
        lng: Number(item.lon),
        category: item.result_type || null,
        country: item.country || null,
        countryCode: item.country_code || null,
      }));
      if (results.length) {
        geocodeCache.set(cacheKey, { ts: Date.now(), data: results });
        return results;
      }
    } catch (error) {
      logger.warn(`Geoapify geocoding failed for "${trimmed}": ${error.message}; falling back to Nominatim`);
    }
  }

  const countryFilter = normalizedCountryCode ? `&countrycodes=${encodeURIComponent(normalizedCountryCode)}` : '';
  const url = `${env.nominatimUrl}/search?format=jsonv2&limit=${limit}&addressdetails=1${countryFilter}&q=${encodeURIComponent(trimmed)}`;

  let raw;
  try {
    raw = await withNominatimInterval(() =>
      fetchJson(url, { timeoutMs: 15000, headers: { 'User-Agent': NOMINATIM_UA } }),
    );
  } catch (error) {
    logger.warn(`Nominatim geocoding failed for "${trimmed}": ${error.message}`);
    throw ApiError.badRequest(
      'Location lookup is temporarily unavailable from OpenStreetMap. You can still continue without it.',
    );
  }

  const results = (Array.isArray(raw) ? raw : []).map((item, index) => ({
    id: `geo-${item.osm_type || 'osm'}-${item.osm_id || index}`,
    name: item.name || (item.display_name ? item.display_name.split(',')[0] : trimmed),
    label: item.display_name || item.name || trimmed,
    lat: Number(item.lat),
    lng: Number(item.lon),
    category: item.category || item.type || null,
    country: item.address?.country || null,
    countryCode: item.address?.country_code || null,
    boundingBox: item.boundingbox ? item.boundingbox.map(Number) : null,
  }));

  geocodeCache.set(cacheKey, { ts: Date.now(), data: results });
  return results;
};

export const autocomplete = async (query, { limit = 7 } = {}) => {
  const text = String(query || '').trim();
  if (text.length < 3) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 7, 1), 10);
  const key = `${text.toLowerCase()}:${safeLimit}`;
  const cached = autocompleteCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  if (!env.geoapifyApiKey) return geocode(text, { limit: safeLimit });
  const params = new URLSearchParams({ text, format: 'json', limit: String(safeLimit), apiKey: env.geoapifyApiKey });
  try {
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Geoapify autocomplete returned HTTP ${response.status}`);
    const payload = await response.json();
    const results = (payload.results || []).map((item, index) => ({
      id: item.place_id ? `geo-${item.place_id}` : `geo-auto-${index}`,
      name: item.name || item.street || item.city || item.address_line1 || text,
      label: item.formatted || item.address_line1 || text,
      address: item.formatted || null,
      lat: Number(item.lat), lng: Number(item.lon),
      type: item.result_type || item.datasource?.raw?.railway || item.datasource?.raw?.aeroway || item.datasource?.raw?.amenity || 'location',
      city: item.city || item.county || null, state: item.state || null,
      country: item.country || null, countryCode: item.country_code || null,
      categories: Array.isArray(item.categories) ? item.categories : [],
    })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    autocompleteCache.set(key, { results, expiresAt: Date.now() + 5 * 60 * 1000 });
    return results;
  } catch (error) {
    logger.warn(`Geoapify autocomplete failed: ${error.message}`);
    if (cached) return cached.results;
    throw ApiError.badRequest('Location suggestions are temporarily unavailable. Please try again.');
  }
};

/**
 * Resolves a place search: geocodes the query when coordinates are missing,
 * then fetches nearby OpenStreetMap places.
 */
export const searchPlaces = async ({ q, lat, lng, kind, radius = 5000, limit = 40 }) => {
  const hasCoords =
    lat !== undefined && lat !== null && lat !== '' && lng !== undefined && lng !== null && lng !== '';

  let centerLat = hasCoords ? Number(lat) : null;
  let centerLng = hasCoords ? Number(lng) : null;
  let label = null;
  let nameQuery = null;

  if (!hasCoords || Number.isNaN(centerLat) || Number.isNaN(centerLng)) {
    if (!q) {
      throw ApiError.badRequest('Provide a location query (q) or coordinates (lat, lng).');
    }
    const results = await geocode(q, { limit: 1 });
    const match = results[0];
    if (!match) return { center: null, places: [] };
    centerLat = match.lat;
    centerLng = match.lng;
    label = match.label;
  } else if (q) {
    nameQuery = q;
  }

  const places = await searchNearby({
    lat: centerLat,
    lng: centerLng,
    kind,
    radius,
    limit,
    nameQuery,
  });

  return { center: { lat: centerLat, lng: centerLng, label }, places };
};

export default { searchNearby, geocode, searchPlaces };
