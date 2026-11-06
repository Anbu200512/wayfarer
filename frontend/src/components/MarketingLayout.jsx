import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Compass, Menu, X, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
];

export default function MarketingLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  return <div className="marketing-shell">
    <header className="marketing-header">
      <Link className="marketing-brand" to="/" onClick={() => setMenuOpen(false)}><span className="brand-mark"><Compass size={21}/></span><span>wayfarer<span className="brand-dot">.</span></span></Link>
      <button className="marketing-menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="marketing-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen?<X size={21}/>:<Menu size={21}/>}</button>
      <nav id="marketing-navigation" className={`marketing-nav ${menuOpen?'is-open':''}`}>{links.map(link=><NavLink key={link.to} to={link.to} end={link.end} onClick={()=>setMenuOpen(false)}>{link.label}</NavLink>)}<Link className="marketing-login" to={user?'/dashboard':'/login'} onClick={()=>setMenuOpen(false)}>{user?'My planner':'Log in'}</Link><Link className="button primary marketing-cta" to={user?'/dashboard':'/register'} onClick={()=>setMenuOpen(false)}>{user?'Open planner':'Start planning'} <ArrowUpRight size={15}/></Link></nav>
    </header>
    <main><Outlet/></main>
      <footer className="marketing-footer">
        <div className="footer-main">
          <div className="footer-brand-column"><Link className="marketing-brand" to="/"><span className="brand-mark"><Compass size={20}/></span><span>wayfarer<span className="brand-dot">.</span></span></Link><p>Make room for the unexpected.<br/>A little planning. A lot of living.</p></div>
          <div className="footer-link-group"><span>EXPLORE</span>{links.slice(0,4).map(link=><Link key={link.to} to={link.to}>{link.label}</Link>)}</div>
          <div className="footer-link-group"><span>YOUR JOURNEY</span><Link to={user?'/dashboard':'/register'}>{user?'Open your planner':'Start planning'}</Link><Link to="/contact">Get in touch</Link><Link to="/about">Our philosophy</Link></div>
          <div className="footer-note"><span className="footer-note-mark"><Compass size={17}/></span><p>Go a little further.<br/><em>Come back with a story.</em></p></div>
        </div>
        <div className="footer-bottom"><span className="copyright">© {new Date().getFullYear()} Wayfarer. Made for the curious.</span><span className="footer-signoff">THOUGHTFULLY, WHEREVER YOU’RE HEADED</span></div>
      </footer>
  </div>;
}
