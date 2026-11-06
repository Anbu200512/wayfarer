import { useEffect, useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function ProfileSettings() {
  const { user } = useAuth(); const toast = useToast(); const [form, setForm] = useState({ name: '', bio: '', homeLocation: '' }); const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/users/me').then(({ data }) => setForm({ name: data.user?.name || '', bio: data.user?.bio || '', homeLocation: data.user?.homeLocation || '' })).catch((error) => toast(error.message)); }, []);
  const save = async (event) => { event.preventDefault(); setBusy(true); try { await api.patch('/users/me', form); toast('Profile updated'); } catch (error) { toast(error.message); } finally { setBusy(false); } };
  return <section className="recovery-page"><header className="recovery-header"><span className="planner-kicker"><UserRound size={14}/> YOUR ACCOUNT</span><h1>Profile & settings<span className="title-period">.</span></h1><p className="muted">Manage the account details used across your trip workspaces.</p></header><form className="recovery-card profile-settings" onSubmit={save}><label>Name<input required minLength="2" maxLength="80" value={form.name || user?.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label>Email<input disabled value={user?.email || ''}/></label><label>Home location<input maxLength="120" value={form.homeLocation} onChange={(event) => setForm({ ...form, homeLocation: event.target.value })} placeholder="City or region"/></label><label>About you<textarea maxLength="300" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })}/></label><button className="button primary" disabled={busy}><Save size={15}/>{busy ? 'Saving…' : 'Save settings'}</button></form></section>;
}
