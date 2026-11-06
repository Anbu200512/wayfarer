const OSRM_BASE = 'https://router.project-osrm.org';
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

const validPoint = (point) => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
const round = (value, digits = 1) => Number(value.toFixed(digits));

async function requestOsrm(path) {
  const run = requestQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastRequestAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    const response = await fetch(`${OSRM_BASE}${path}`, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`OSRM returned HTTP ${response.status}`);
    const data = await response.json();
    if (data.code !== 'Ok') throw new Error(`OSRM route unavailable (${data.code || 'unknown error'})`);
    return data;
  });
  requestQueue = run.catch(() => undefined);
  return run;
}

export async function optimizeRoute(stops, start) {
  const validStops = stops.filter(validPoint).map((stop) => ({ ...stop, lat: Number(stop.lat), lng: Number(stop.lng) }));
  const validStart = validPoint(start) ? { lat: Number(start.lat), lng: Number(start.lng) } : null;
  if (!validStops.length) return { available: false, stops: [], geometry: [], totalDistanceKm: null, totalTravelMinutes: null, legs: [], source: null, message: 'Add stops with coordinates to calculate a driving route.' };
  const points = [...(validStart ? [{ title: 'Start', ...validStart, isStart: true }] : []), ...validStops];
  if (points.length < 2) return { available: false, stops: validStops, geometry: [], totalDistanceKm: null, totalTravelMinutes: null, legs: [], source: null, message: 'At least two locations with coordinates are needed for a route.' };

  const coords = points.map((point) => `${point.lng},${point.lat}`).join(';');
  const cacheKey = `driving:${coords}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const trip = await requestOsrm(`/trip/v1/driving/${coords}?roundtrip=false&source=${validStart ? 'first' : 'any'}&destination=last&overview=full&geometries=geojson&steps=false`);
    const route = trip.trips?.[0];
    if (!route) throw new Error('OSRM returned no driving trip');
    const waypointOrder = (trip.waypoints || []).map((waypoint, inputIndex) => ({ inputIndex, order: waypoint.waypoint_index })).sort((a, b) => a.order - b.order);
    const orderedPoints = waypointOrder.map(({ inputIndex }) => points[inputIndex]).filter((point) => point && !point.isStart);
    const value = {
      available: true,
      stops: orderedPoints.length === validStops.length ? orderedPoints : validStops,
      geometry: route.geometry?.coordinates || [],
      totalDistanceKm: round(route.distance / 1000),
      totalTravelMinutes: Math.round(route.duration / 60),
      legs: (route.legs || []).map((leg) => ({ distanceKm: round(leg.distance / 1000), durationMinutes: Math.round(leg.duration / 60) })),
      source: 'OSRM driving route',
    };
    cache.set(cacheKey, { at: Date.now(), value });
    return value;
  } catch (error) {
    return { available: false, stops: validStops, geometry: [], totalDistanceKm: null, totalTravelMinutes: null, legs: [], source: null, message: 'Driving route is unavailable right now.', reason: error.message };
  }
}
