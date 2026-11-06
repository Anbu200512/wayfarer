import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Compass, LayoutDashboard, Map, Plus, LogOut, Menu, X, Sparkles, Search, Receipt, Bell, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/planner', label: 'AI Trip Planner', icon: Sparkles },
  { to: '/trips', label: 'My Trips', icon: Map },
  { to: '/explore', label: 'Explore Places', icon: Search },
  { to: '/saved', label: 'Saved Places', icon: Bookmark },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];

export default function Layout() {
  const { user, logout } = useAuth(); const nav = useNavigate(); const location = useLocation(); const [open, setOpen] = useState(false);
  const signout = () => { logout(); nav('/login'); };
  const activeTitle = links.find((link) => location.pathname === link.to || (link.to === '/trips' && location.pathname.startsWith('/trips/')))?.label
    || (location.pathname.includes('/recovery') ? 'Trip Recovery' : location.pathname.includes('/expenses') ? 'Trip Expenses' : 'Your workspace');
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Compass size={22}/></span><span>wayfarer<span className="brand-dot">.</span></span><button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X/></button></div>
      <p className="side-label">YOUR TRAVEL</p>
      <nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to !== '/trips'} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive && !(to === '/trips' && location.pathname === '/trips/new') ? 'active' : ''}`}><Icon size={18}/>{label}</NavLink>)}
        <NavLink to="/settings" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings size={18}/>Profile & Settings</NavLink>
      </nav>
      <div className="side-plan"><div className="plan-icon"><Compass size={18}/></div><strong>Your next adventure</strong><p>Every trip and its plans stay together in one workspace.</p><button onClick={() => nav('/planner')}><Plus size={16}/> Create a trip</button></div>
      <div className="profile"><div className="avatar">{user?.name?.slice(0, 1) || 'W'}</div><div className="profile-info"><strong>{user?.name || 'Traveler'}</strong><span>{user?.email || 'Your account'}</span></div><button className="icon-button" onClick={signout} title="Sign out"><LogOut size={17}/></button></div>
    </aside>
    <main className="main-panel"><header className="topbar"><button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu/></button><div className="breadcrumbs">Your workspace <span>/</span> <b>{activeTitle}</b></div><div className="top-actions"><span className="status-pill"><i/> All systems ready</span><button className="avatar avatar-small" onClick={() => nav('/settings')} aria-label="Profile settings">{user?.name?.slice(0, 1) || 'W'}</button></div></header><div className="page-content"><Outlet/></div></main>
  </div>;
}
