import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Check, Clock3, Navigation, RefreshCw, Sparkles, Wallet } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import TripMap from '../components/TripMap';
import '../styles/recovery.css';

export default function TripRecovery() {
  const { id } = useParams(); const toast = useToast();
  const [data, setData] = useState(null); const [preview, setPreview] = useState(null);
  const [weather, setWeather] = useState(null); const [weatherLoading, setWeatherLoading] = useState(false); const [dayNumber, setDayNumber] = useState(1);
  const [closed, setClosed] = useState([]); const [extra, setExtra] = useState('0'); const [minutes, setMinutes] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => api.get(`/trips/${id}`).then((r) => setData(r.data)).catch((e) => toast(e.message));
  useEffect(() => { load(); }, [id]);
  const trip = data?.trip; const days = data?.itinerary || []; const items = days.filter((day) => day.dayNumber === Number(dayNumber)).flatMap((day) => (day.items || []).map((item) => ({ ...item, dayNumber: day.dayNumber })));
  useEffect(() => { if (!trip) return; let active = true; setWeatherLoading(true); api.get(`/trips/${id}/weather?day=${dayNumber}`).then((r) => { if (active) setWeather(r.data); }).catch((error) => { if (active) setWeather({ available: false, message: error.message || 'Weather data is unavailable.' }); }).finally(() => { if (active) setWeatherLoading(false); }); return () => { active = false; }; }, [trip?.id, dayNumber]);
  const incident = () => ({ dayNumber: Number(dayNumber), unavailableItemIds: closed, additionalExpense: Number(extra), remainingTimeMinutes: minutes === '' ? trip.availableTimeHours * 60 : Number(minutes) });
  const run = async () => { setBusy(true); try { const { data: result } = await api.post(`/trips/${id}/recovery/preview`, incident()); setPreview(result); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  const accept = async () => { if (!preview) return; setBusy(true); try { await api.post(`/trips/${id}/recovery/accept`, incident()); toast('Recovered itinerary applied'); await load(); setPreview(null); setClosed([]); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  if (!trip) return <div className="empty-card">Loading recovery workspace…</div>;
  return <main className="recovery-page">
    <Link className="back-link" to={`/trips/${id}`}><ArrowLeft size={16}/> Back to trip</Link>
    <header className="recovery-header"><span className="planner-kicker"><Sparkles size={14}/> ADAPTIVE TRIP RECOVERY</span><h1>Make room for the unexpected<span className="title-period">.</span></h1><p className="muted">Preview a constraint-checked adjustment. Your saved itinerary changes only after you accept.</p></header>
    <section className="recovery-card"><h2><AlertTriangle size={18}/> What changed?</h2><p>Select closed stops and enter new costs or remaining time. Recorded expenses are included automatically.</p>
      <label className="recovery-day-select">Recover which day?<select value={dayNumber} onChange={(e) => { setDayNumber(Number(e.target.value)); setClosed([]); setPreview(null); }}>{days.map((day) => <option value={day.dayNumber} key={day.id}>Day {day.dayNumber}</option>)}</select></label>
      <div className="weather-summary"><strong>Weather · {weather?.date || trip.travelDate}</strong>{weatherLoading ? <span>Loading current conditions and forecast…</span> : <span>{weather?.currentAvailable && weather.current ? `Now: ${weather.current.condition || 'Condition not available'} · ${weather.current.temperature ?? '—'}${weather.units?.temperature || '°C'}${weather.current.rain != null ? ` · Rain ${weather.current.rain}${weather.units?.precipitation || ' mm'}` : ''}. ` : ''}{weather?.travelDateAvailable && weather.travelDate ? `${weather.travelDate.condition || 'Condition not available'} · ${weather.travelDate.temperatureMin ?? '—'}°–${weather.travelDate.temperatureMax ?? '—'}°C · Rain probability ${weather.travelDate.precipitationProbability == null ? 'not available' : `${weather.travelDate.precipitationProbability}%`}` : weather?.message || 'Travel-date forecast is unavailable.'}</span>}</div>
      <div className="recovery-checks">{items.length ? items.map((item) => <label key={item.id}><input type="checkbox" checked={closed.includes(item.id)} onChange={(e) => setClosed((old) => e.target.checked ? [...old, item.id] : old.filter((x) => x !== item.id))}/><span>{item.title}<small>Day {item.dayNumber}</small></span></label>) : <span>No itinerary stops to recover.</span>}</div>
      <div className="recovery-inputs"><label>Unexpected additional expense<input type="number" min="0" value={extra} onChange={(e) => setExtra(e.target.value)}/></label><label>Remaining time (minutes)<input type="number" min="0" placeholder={`${trip.availableTimeHours * 60} max`} value={minutes} onChange={(e) => setMinutes(e.target.value)}/></label></div>
      <button className="button primary" disabled={busy} onClick={run}>{busy ? <RefreshCw className="planner-spinner" size={16}/> : <Sparkles size={16}/>} {preview ? 'Regenerate alternatives' : 'Recover My Trip'}</button>
    </section>
    {preview && <section className="recovery-results"><div className="recovery-result-head"><div><span className={`recovery-status ${preview.feasible ? 'feasible' : ''}`}>{preview.feasible ? 'FEASIBLE PLAN' : 'BEST PARTIAL PLAN'}</span><h2>Original itinerary vs recovered</h2></div><div className="recovery-result-actions"><button className="button secondary" onClick={() => setPreview(null)} disabled={busy}>Reject recovery</button><button className="button primary" onClick={accept} disabled={busy}><Check size={16}/> Accept recovery</button></div></div>
       <div className="recovery-metrics"><Metric icon={Wallet} label="Remaining after plan" value={`${preview.remainingBudget.toFixed(2)} / ${preview.budget.available.toFixed(2)}`}/><Metric icon={Clock3} label="Planned time" value={preview.time.plannedMinutes == null ? 'Unavailable' : `${preview.time.plannedMinutes} / ${preview.time.availableMinutes} min`}/><Metric icon={Navigation} label="Driving route" value={preview.route.available ? `${preview.route.totalDistanceKm} km · ${preview.route.totalTravelMinutes} min` : 'Unavailable'}/></div>
       {!preview.route.available && <p className="muted">{preview.route.message || 'OSRM could not calculate a driving route. No route distance or travel time is estimated.'}</p>}
      <div className="recovery-columns"><article><h3>Original ({preview.original.length})</h3>{preview.original.map((p) => <p className={preview.removed.some((r) => r.id === p.id) ? 'recovery-removed' : ''} key={p.id}>{p.title}{preview.removed.some((r) => r.id === p.id) && <small> · removed: unavailable</small>}</p>)}</article><article><h3>Recovered ({preview.recovered.length})</h3>{preview.recovered.map((p, i) => <p key={p.id || `${p.title}-${i}`}><b>{i + 1}.</b> {p.title}{preview.added.some((a) => a.id === p.id) && <small> · new OSM suggestion</small>}<small> · {p.durationMinutes} min · {Number(p.estimatedCost || 0).toFixed(2)}</small></p>)}</article></div>
      <TripMap items={preview.recovered} center={{ lat: trip.lat, lng: trip.lng }} showRoute routeGeometry={preview.route.geometry}/>
      <div className="recovery-reasons"><h3>Why this plan?</h3>{preview.reasons.map((reason) => <p key={reason}>{reason}</p>)}{preview.added.map((item) => <p key={item.id}>{item.title}: {item.reason}</p>)}{!preview.added.length && <p>No verified-free OSM alternative was available; the plan keeps remaining feasible stops.</p>}</div>
    </section>}
  </main>;
}
function Metric({ icon: Icon, label, value }) { return <div className="recovery-metric"><Icon size={17}/><small>{label}</small><strong>{value}</strong></div>; }
