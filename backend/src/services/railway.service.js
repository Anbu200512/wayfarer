import { env } from '../config/env.js';
import { z } from 'zod';
import ApiError from '../utils/ApiError.js';

const stationSchema = z.object({ code: z.string(), name: z.string() }).passthrough();
const statusPayloadSchema = z.object({
  status: z.string(),
  data: z.object({
    trainNumber: z.string(), trainName: z.string(), journeyDate: z.string(), status: z.string(),
    origin: stationSchema, destination: stationSchema,
    currentStation: stationSchema.nullable().optional(), previousStation: stationSchema.nullable().optional(), nextStation: stationSchema.nullable().optional(),
    position: z.object({ source: z.string().optional(), stationCode: z.string().optional(), latitude: z.number().nullable().optional(), longitude: z.number().nullable().optional(), observedAt: z.string().optional() }).nullable().optional(),
    speedKmph: z.number().nullable().optional(), delayMinutes: z.number().nullable().optional(),
    delay: z.object({ minutes: z.number().optional(), source: z.string().optional(), reference: z.string().optional(), stationCode: z.string().optional() }).nullable().optional(),
    eta: z.object({ source: z.string().optional(), stationCode: z.string().optional(), value: z.string().optional() }).nullable().optional(),
    routeProgress: z.object({ completedStops: z.number().optional(), remainingStops: z.number().optional(), totalStops: z.number().optional(), previousStop: stationSchema.nullable().optional(), nextStop: stationSchema.nullable().optional(), percent: z.number().optional(), basis: z.string().optional() }).nullable().optional(),
    exceptions: z.array(z.unknown()).optional(),
    freshness: z.object({ observedAt: z.string().optional(), updatedAt: z.string().optional(), ageSeconds: z.number().optional(), state: z.string().optional(), provider: z.string().optional() }).passthrough(),
    source: z.string().optional(), confidence: z.string().optional(), observedAt: z.string().optional(),
  }).passthrough(),
}).passthrough();

const cache = new Map();
const TTL_MS = 30_000;

export async function getTrainRunningStatus(trainNumber) {
  const number = String(trainNumber || '').trim();
  if (!/^\d{1,6}$/.test(number)) throw ApiError.badRequest('Enter a valid train number.', [{ field: 'trainNumber', message: 'Use the numeric train number provided by your railway operator.' }]);
  if (!env.railwayEngineApiKey) throw ApiError.badRequest('Railway Engine status is not configured.', [{ field: 'provider', message: 'Set RAILWAY_ENGINE_API_KEY on the backend.' }]);
  const cached = cache.get(number);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  let response;
  try {
    response = await fetch(`https://railway-engine.apkscope.workers.dev/v1/train/${encodeURIComponent(number)}/status`, {
      method: 'GET', headers: { 'x-api-key': env.railwayEngineApiKey, accept: 'application/json' }, signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw ApiError.badRequest(error.name === 'TimeoutError' ? 'Railway Engine status request timed out.' : 'Railway Engine is temporarily unreachable.');
  }
  if (response.status === 401 || response.status === 403) throw ApiError.badRequest('Railway Engine rejected the configured API key.');
  if (response.status === 400) throw ApiError.badRequest('Railway Engine rejected the train number or request.');
  if (response.status === 404) throw ApiError.notFound('No running-status record was returned for this train.');
  if (response.status === 429) throw ApiError.badRequest('Railway Engine rate limit reached. Try again shortly.');
  if (!response.ok) throw ApiError.badRequest(`Railway Engine status is unavailable (HTTP ${response.status}).`);
  let raw;
  try { raw = await response.json(); } catch { throw ApiError.badRequest('Railway Engine returned an invalid JSON response.'); }
  const parsed = statusPayloadSchema.safeParse(raw);
  if (!parsed.success) throw ApiError.badRequest('Railway Engine returned a response that did not match its documented train-status format.');
  const { data } = parsed.data;
  if (data.trainNumber !== number) throw ApiError.badRequest('Railway Engine returned status for a different train number.');
  const value = {
    provider: 'Railway Engine', trainNumber: data.trainNumber, trainName: data.trainName, journeyDate: data.journeyDate,
    status: data.status, origin: data.origin, destination: data.destination, currentStation: data.currentStation || null,
    previousStation: data.previousStation || null, nextStation: data.nextStation || null,
    position: data.position || null, speedKmph: data.speedKmph ?? null,
    delayMinutes: data.delayMinutes ?? data.delay?.minutes ?? null, delay: data.delay || null, eta: data.eta || null,
    routeProgress: data.routeProgress || null, exceptions: data.exceptions || [],
    freshness: data.freshness, source: data.source || null, confidence: data.confidence || null,
    observedAt: data.observedAt || data.freshness.observedAt || null,
    capabilities: { trainSearch: false, schedule: false, fares: false, classes: false, seatAvailability: false, liveRunningStatus: true },
  };
  cache.set(number, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}
