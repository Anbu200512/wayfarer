import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import '../styles/recovery.css';

export default function RecoveryHub() {
  const [trips, setTrips] = useState([]); const [busy, setBusy] = useState(true); const toast = useToast();
  useEffect(() => { api.get('/trips').then((r) => setTrips(Array.isArray(r.data) ? r.data : r.data.trips || [])).catch((e) => toast(e.message)).finally(() => setBusy(false)); }, []);
  return <section className="recovery-page"><header className="recovery-header"><span className="planner-kicker"><RotateCcw size={14}/> ADAPTIVE TRIP RECOVERY</span><h1>Plans change. Your trip can adapt<span className="title-period">.</span></h1><p className="muted">Choose a trip to preview a recovery against closures, added expenses, or less available time.</p></header>{busy ? <div className="empty-card">Loading your trips…</div> : trips.length ? <div className="recovery-trips">{trips.map((trip) => <div className="recovery-trip" key={trip.id}><span><strong>{trip.title}</strong><small>{trip.destinationName} · {trip.travelDate ? new Date(trip.travelDate).toLocaleDateString() : 'Date not set'} · {trip.travellers} travellers</small></span><div className="recovery-trip-actions"><Link to={`/trips/${trip.id}/expenses`}>Budget</Link><Link to={`/trips/${trip.id}/recovery`}>Recover <ArrowRight size={15}/></Link></div></div>)}</div> : <div className="empty-card">Create a trip first to use recovery planning.</div>}</section>;
}
