import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Receipt } from 'lucide-react';
import api from '../services/api';

export default function ExpenseHub() {
  const [trips, setTrips] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { api.get('/trips').then(({ data }) => setTrips(Array.isArray(data) ? data : data.trips || [])).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  return <section className="recovery-page"><header className="recovery-header"><span className="planner-kicker"><Receipt size={14}/> TRIP EXPENSES</span><h1>Choose a trip to track<span className="title-period">.</span></h1><p className="muted">Expenses are recorded against their individual trip and update that trip’s budget.</p></header>
    {loading ? <div className="empty-card">Loading your trips…</div> : error ? <div className="error-banner">{error}</div> : trips.length ? <div className="trip-grid trip-grid-all">{trips.map((trip) => <Link className="trip-card" key={trip.id} to={`/trips/${trip.id}/expenses`}><div className="trip-details"><span className="trip-status">{trip.status}</span><h3>{trip.title || `Trip to ${trip.destinationName}`}</h3><p>{trip.destinationName}</p><div className="trip-card-bottom"><span>Budget {trip.currency || 'USD'} {Number(trip.budget).toLocaleString()}</span><ArrowUpRight size={17}/></div></div></Link>)}</div> : <div className="empty-card">Create a trip to start tracking its expenses.</div>}
  </section>;
}
