import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Heart, MapPin, Trash2 } from 'lucide-react';

const readSaved = () => { try { return JSON.parse(localStorage.getItem('wayfarer-favorites') || '[]'); } catch { return []; } };
export default function SavedPlaces() {
  const [places, setPlaces] = useState(readSaved);
  const remove = (id) => { const next = places.filter((place) => place.id !== id); localStorage.setItem('wayfarer-favorites', JSON.stringify(next)); setPlaces(next); };
  return <section className="recovery-page"><header className="recovery-header"><span className="planner-kicker"><Bookmark size={14}/> YOUR COLLECTION</span><h1>Saved places<span className="title-period">.</span></h1><p className="muted">Places you saved from trip recommendations. Add favorites to an itinerary whenever you’re ready.</p></header>
    {places.length ? <div className="recommendation-columns">{places.map((place) => <article className="recommendation-card" key={place.id}>{place.imageUrl && <img className="recommendation-image" src={place.imageUrl} alt="" loading="lazy"/>}<span className="recommendation-category">{place.kind || 'PLACE'}</span><h3>{place.name}</h3><p><MapPin size={13}/> {place.destination || 'Destination not specified'}</p><div className="planner-save-row"><Link className="button primary" to={`/planner?destination=${encodeURIComponent(place.destination || '')}`}>Plan a trip</Link><button className="button secondary" onClick={() => remove(place.id)} aria-label={`Remove ${place.name}`}><Trash2 size={15}/></button></div></article>)}</div> : <div className="empty-card"><Heart size={20}/><h3>No saved places yet</h3><p>Save a place with the heart button on an AI recommendation card.</p><Link className="button primary" to="/planner">Explore recommendations</Link></div>}
  </section>;
}
