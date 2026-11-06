import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, ArrowRight, Mail, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Auth({ mode = 'login' }) {
  const signup = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await (signup ? register(form) : login(form));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-visual">
      <Link className="brand auth-brand" to="/"><span className="brand-mark"><Compass size={22}/></span><span>wayfarer<span className="brand-dot">.</span></span></Link>
      <div className="visual-copy"><p className="eyebrow light">MAKE ROOM FOR THE UNEXPECTED</p><h1>The world is wide.<br/><em>Your plans can be too.</em></h1><p>Bring your next great adventure into focus. Thoughtful itineraries, places worth discovering, and room to wander.</p></div>
      <div className="visual-footer">PLAN WITH PURPOSE <span>·</span> TRAVEL WITH CURIOSITY</div>
    </section>
    <section className="auth-form-side"><form className="auth-card" onSubmit={submit}>
      <div className="eyebrow">YOUR JOURNEY STARTS HERE</div><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p className="muted">{signup ? 'A little planning goes a long way.' : 'Pick up where your next adventure begins.'}</p>
      {error && <div className="error-banner">{error}</div>}
      {signup && <label className="field"><span>Your name</span><div className="input-wrap"><UserRound size={17}/><input required autoComplete="name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Alex Morgan"/></div></label>}
      <label className="field"><span>Email address</span><div className="input-wrap"><Mail size={17}/><input required autoComplete="email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com"/></div></label>
      <label className="field"><span>Password</span><div className="input-wrap"><LockKeyhole size={17}/><input required minLength={6} autoComplete={signup ? 'new-password' : 'current-password'} type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters"/></div></label>
      <button className="button primary full" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'} <ArrowRight size={17}/></button>
      <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Wayfarer?'} <Link to={signup ? '/login' : '/register'}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
      <p className="auth-home-link"><Link to="/">← Back to Wayfarer</Link></p>
    </form></section>
  </main>;
}
