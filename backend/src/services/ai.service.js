import { env } from '../config/env.js';

const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

export class AiServiceError extends Error {
  constructor(code, message) { super(message); this.name = 'AiServiceError'; this.code = code; }
}

function parseJson(content) {
  const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!text) throw new AiServiceError('EMPTY_RESPONSE', 'The AI returned an empty response.');
  try { return JSON.parse(text); } catch {
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch { /* invalid JSON */ } }
    throw new AiServiceError('INVALID_JSON', 'The AI returned an invalid structured response.');
  }
}

export async function requestJson({ task, input, validate, maxTokens = 1400 }) {
  const serialized = JSON.stringify(input);
  const key = `${task}:${serialized}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.value);
  if (!env.groqApiKey) throw new AiServiceError('NOT_CONFIGURED', 'Groq AI is not configured.');
  let response;
  try {
    response = await fetch(`${env.groqBaseUrl}/chat/completions`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.groqApiKey}` },
      body: JSON.stringify({ model: env.groqModel, temperature: 0.2, max_tokens: maxTokens, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'Return only a valid JSON object matching the requested schema. Use only supplied facts and IDs; never invent places, prices, ratings, opening hours, or calculations.' }, { role: 'user', content: `${task}\nSchema: ${JSON.stringify(validate.schema)}\nRetrieved data: ${serialized.slice(0, 18000)}` }] }),
    });
  } catch (error) {
    throw new AiServiceError(error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK', error.name === 'TimeoutError' ? 'Groq took too long to respond.' : 'Could not connect to Groq.');
  }
  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) throw new AiServiceError('INVALID_API_KEY', 'Groq rejected the configured API key.');
    if (status === 429) throw new AiServiceError('RATE_LIMIT', 'Groq is rate limited. Please try again shortly.');
    if (status === 404 || status === 503) throw new AiServiceError('MODEL_UNAVAILABLE', 'The configured Groq model is currently unavailable.');
    throw new AiServiceError('UPSTREAM_ERROR', 'Groq could not complete this request.');
  }
  let data;
  try { data = await response.json(); } catch { throw new AiServiceError('INVALID_JSON', 'Groq returned an invalid response.'); }
  const result = validate.parse(parseJson(data.choices?.[0]?.message?.content));
  cache.set(key, { value: result, expires: Date.now() + TTL_MS });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return result;
}

export const aiProviderStatus = () => ({ provider: env.groqApiKey ? 'Groq' : 'unconfigured', model: env.groqModel, configured: Boolean(env.groqApiKey) });
