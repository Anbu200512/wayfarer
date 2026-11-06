import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, MapPin, Search, ArrowUpRight } from 'lucide-react';
import api from '../services/api';

export default function ExplorePlaces() {
  const [query, setQuery] = useState(''); const [places, setPlaces] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const timer = setTimeout(() => api.get(`/destinations?limit=36${query ? `&search=${encodeURIComponent(query)}` : ''}`).then(({ data }) => { if (active) setPlaces(Array.isArray(data) ? data : data.destinations || []); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  return <section className="recovery-page"><header className="recovery-header"><span className="planner-kicker"><Compass size={14}/> DESTINATION DISCOVERY</span><h1>Find a place to begin<span className="title-period">.</span></h1><p className="muted">Explore the destinations already in the catalog, then create a connected trip workspace.</p></header>
    <label className="search-box"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destinations or countries"/></label>
    {loading ? <div className="empty-card">Loading destinations…</div> : error ? <div className="error-banner">{error}</div> : places.length ? <div className="destination-grid">{places.map((place) => <article className="destination-card" key={place.id}><div className="destination-card-copy"><span>{place.country}{place.region ? ` · ${place.region}` : ''}</span><h3>{place.name}</h3><p>{place.description || 'Destination details are not available in the catalog yet.'}</p><Link to={`/planner?destination=${encodeURIComponent(place.name)}`} className="underlined-link"><MapPin size={14}/> Plan this trip <ArrowUpRight size={14}/></Link></div></article>)}</div> : <div className="empty-card">No saved destinations match this search. You can still enter any destination in the AI trip planner.</div>}
  </section>;
}
