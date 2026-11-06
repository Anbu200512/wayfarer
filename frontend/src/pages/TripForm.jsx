import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin, CalendarDays, Heart, Utensils, Users, Wallet, Clock3, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';

const interests = ['Architecture', 'Art & museums', 'Beaches', 'Markets', 'Parks & gardens', 'Local culture', 'Walking', 'Wildlife'];
const moods = [
  ['RELAXATION', 'Slow & restorative'], ['ADVENTURE', 'A little adventure'], ['NATURE', 'Closer to nature'],
  ['PHOTOGRAPHY', 'Picture-perfect'], ['HISTORY', 'Stories & history'], ['FOOD', 'Follow the flavors'],
  ['ROMANTIC', 'A romantic escape'], ['FAMILY', 'Family outing'], ['BEACH_EXPLORATION', 'Beach exploration'], ['SHOPPING', 'Shopping'], ['SPIRITUAL', 'Spiritual'],
];
const initial = { destinationName: '', startLocation: '', travelDate: '', travellers: 2, budget: '', availableTimeHours: 8, foodPreference: 'NO_PREFERENCE', interests: [], mood: 'RELAXATION' };

export default function TripForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ ...initial, destinationName: params.get('destination') || '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => {
    if (!id) return;
    api.get(`/trips/${id}`).then(({ data }) => {
      const trip = data.trip || data;
      setForm({ ...initial, ...trip, travelDate: trip.travelDate?.slice(0, 10), budget: String(trip.budget), interests: trip.interests || [], mood: trip.mood || 'RELAXATION' });
    }).catch((error) => toast(error.message));
  }, [id]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (value) => update('interests', form.interests.includes(value) ? form.interests.filter((item) => item !== value) : [...form.interests, value]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const payload = { ...form, travellers: Number(form.travellers), budget: Number(form.budget), availableTimeHours: Number(form.availableTimeHours) };
      const response = id ? await api.patch(`/trips/${id}`, payload) : await api.post('/trips', payload);
      const trip = response.data.trip || response.data;
      toast(id ? 'Trip updated' : 'Trip created'); nav(`/trips/${trip.id}`);
    } catch (error) { toast(error.message); }
    finally { setBusy(false); }
  };

  return <>
    <Link to={id ? `/trips/${id}` : '/trips'} className="back-link"><ArrowLeft size={16}/> Back to {id ? 'trip' : 'my trips'}</Link>
    <div className="form-intro"><p className="eyebrow">A GOOD TRIP STARTS WITH A PLAN</p><h1>{id ? 'Shape your itinerary' : 'Let’s plan somewhere new'}<span className="title-period">.</span></h1><p className="muted">Set your destination and the preferences that should guide place recommendations.</p></div>
    <form className="trip-form" onSubmit={submit}>
      <section className="form-section"><div className="form-section-title"><span>01</span><div><h2>The destination</h2><p>Where are you headed, and where are you starting from?</p></div></div>
        <div className="form-fields two-col">
          <label className="field"><span>Destination</span><div className="input-wrap"><MapPin size={17}/><input required minLength="2" maxLength="120" value={form.destinationName} onChange={(event) => update('destinationName', event.target.value)} placeholder="City or region"/></div></label>
          <label className="field"><span>Starting location</span><div className="input-wrap"><MapPin size={17}/><input required minLength="2" maxLength="120" value={form.startLocation} onChange={(event) => update('startLocation', event.target.value)} placeholder="Where your trip begins"/></div></label>
          <label className="field"><span>Travel date</span><div className="input-wrap"><CalendarDays size={17}/><input type="date" required value={form.travelDate} onChange={(event) => update('travelDate', event.target.value)}/></div></label>
        </div>
      </section>
      <section className="form-section"><div className="form-section-title"><span>02</span><div><h2>Your travel essentials</h2><p>Share your group size, budget, and available time.</p></div></div>
        <div className="form-fields four-col">
          <label className="field"><span>Travellers</span><div className="input-wrap"><Users size={16}/><input type="number" min="1" max="50" required value={form.travellers} onChange={(event) => update('travellers', event.target.value)}/></div></label>
          <label className="field"><span>Total budget</span><div className="input-wrap"><Wallet size={16}/><input type="number" min="0" step="0.01" required value={form.budget} onChange={(event) => update('budget', event.target.value)} placeholder="0.00"/></div></label>
          <label className="field"><span>Available duration</span><div className="input-wrap"><Clock3 size={16}/><input type="number" min="1" max="720" required value={form.availableTimeHours} onChange={(event) => update('availableTimeHours', event.target.value)}/><small>hours</small></div></label>
          <label className="field"><span>Food preference</span><div className="input-wrap"><Utensils size={16}/><select value={form.foodPreference} onChange={(event) => update('foodPreference', event.target.value)}><option value="NO_PREFERENCE">No preference</option><option value="VEGETARIAN">Vegetarian</option><option value="NON_VEGETARIAN">Non-vegetarian</option><option value="VEGAN">Vegan</option><option value="BOTH">Both</option><option value="PESCATARIAN">Pescatarian</option><option value="HALAL">Halal</option><option value="KOSHER">Kosher</option></select></div></label>
        </div>
      </section>
      <section className="form-section"><div className="form-section-title"><span>03</span><div><h2>What feels like your kind of trip?</h2><p>Mood and interests are combined to guide place recommendations.</p></div></div>
        <div className="form-fields">
          <fieldset className="planner-field"><legend><Heart size={14}/> Travel mood</legend><div className="mood-grid">{moods.map(([value, label]) => <button type="button" key={value} className={`mood-card ${form.mood === value ? 'selected' : ''}`} aria-pressed={form.mood === value} onClick={() => update('mood', value)}><strong>{label}</strong></button>)}</div></fieldset>
          <fieldset className="planner-field" style={{ marginTop: 18 }}><legend>Travel interests <small>(choose any)</small></legend><div className="interest-chips">{interests.map((interest) => <button type="button" key={interest} className={form.interests.includes(interest) ? 'active' : ''} aria-pressed={form.interests.includes(interest)} onClick={() => toggle(interest)}>{interest}</button>)}</div></fieldset>
        </div>
      </section>
      <div className="planner-submit-row"><span>Your preferences guide suggestions; place facts are shown only when available from data sources.</span><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : <>{id ? 'Save changes' : 'Create trip'} <ArrowRight size={16}/></>}</button></div>
    </form>
  </>;
}
