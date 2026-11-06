const cache = new Map();
const TTL = 30 * 60 * 1000;
const weatherLabels = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

export async function getWeather({ lat, lng, date }) {
  const travelDate = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { available: false, currentAvailable: false, travelDateAvailable: false, date: travelDate, message: 'Valid destination coordinates are not available.' };
  }
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)},${travelDate}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) return cached.value;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,precipitation,rain,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto', forecast_days: '16',
  }).toString();

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
    const data = await response.json();
    const current = data.current ? {
      temperature: data.current.temperature_2m ?? null,
      apparentTemperature: data.current.apparent_temperature ?? null,
      humidity: data.current.relative_humidity_2m ?? null,
      condition: weatherLabels[data.current.weather_code] || null,
      precipitation: data.current.precipitation ?? null,
      rain: data.current.rain ?? null,
      isDay: data.current.is_day ?? null,
    } : null;
    const index = data.daily?.time?.indexOf(travelDate) ?? -1;
    const travelDateForecast = index < 0 ? null : {
      date: travelDate,
      temperatureMax: data.daily.temperature_2m_max?.[index] ?? null,
      temperatureMin: data.daily.temperature_2m_min?.[index] ?? null,
      condition: weatherLabels[data.daily.weather_code?.[index]] || null,
      precipitationProbability: data.daily.precipitation_probability_max?.[index] ?? null,
    };
    const value = {
      available: Boolean(current || travelDateForecast),
      currentAvailable: Boolean(current),
      current,
      travelDate: travelDateForecast,
      travelDateAvailable: Boolean(travelDateForecast),
      date: travelDate,
      message: !travelDateForecast ? 'A forecast is not available for this travel date.' : null,
      timezone: data.timezone || null,
      units: { temperature: data.current_units?.temperature_2m || '°C', precipitation: data.current_units?.precipitation || 'mm' },
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    const value = { available: false, currentAvailable: false, travelDateAvailable: false, current: null, travelDate: null, date: travelDate, message: 'Weather data is unavailable right now.', reason: error.message };
    return value;
  }
}
