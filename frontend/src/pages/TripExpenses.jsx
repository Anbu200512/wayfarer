import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../services/api';
import { useToast } from '../components/Toast';
import '../styles/recovery.css';

const blank = { category: 'FOOD', amount: '', description: '', spentAt: new Date().toISOString().slice(0, 10) };
const categories = ['TRANSPORT', 'FOOD', 'ATTRACTION', 'SHOPPING', 'ACCOMMODATION', 'OTHER'];
export default function TripExpenses() {
  const { id } = useParams(); const toast = useToast(); const [data, setData] = useState(null); const [form, setForm] = useState(blank); const [editing, setEditing] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => api.get(`/trips/${id}`).then((r) => setData(r.data)).catch((e) => toast(e.message)); useEffect(() => { load(); }, [id]);
  const expenses = data?.expenses || []; const budget = data?.budget || {};
  const save = async (event) => { event.preventDefault(); setBusy(true); try { const payload = { ...form, amount: Number(form.amount) }; if (editing) await api.patch(`/trips/${id}/expenses/${editing}`, payload); else await api.post(`/trips/${id}/expenses`, payload); setEditing(null); setForm(blank); await load(); toast('Expense saved'); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  const edit = (expense) => { setEditing(expense.id); setForm({ category: expense.category, amount: String(expense.amount), description: expense.description, spentAt: expense.spentAt }); };
  const remove = async (expense) => { if (!confirm(`Delete “${expense.description}”?`)) return; try { await api.delete(`/trips/${id}/expenses/${expense.id}`); await load(); toast('Expense deleted'); } catch (e) { toast(e.message); } };
  if (!data) return <div className="empty-card">Loading expenses…</div>;
  return <section className="recovery-page"><Link className="back-link" to={`/trips/${id}`}><ArrowLeft size={16}/> Back to trip</Link><header className="recovery-header"><span className="planner-kicker"><Wallet size={14}/> TRIP BUDGET</span><h1>Spending, in perspective<span className="title-period">.</span></h1><p className="muted">Actual expenses and planned costs are combined by the backend budget calculator.</p></header>
    <div className="recovery-metrics"><Metric label="Original budget" value={money(budget.totalBudget)}/><Metric label="Estimated planned" value={money(budget.totalEstimated)}/><Metric label="Actual expenses" value={money(budget.totalSpent)}/><Metric label="Remaining" value={money(budget.remaining)}/></div>
    <section className="recovery-card"><h2>Add an expense</h2><form className="expense-form" onSubmit={save}><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((x) => <option key={x}>{x}</option>)}</select></label><label>Amount<input type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}/></label><label>Description<input required maxLength="200" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label><label>Date<input type="date" required value={form.spentAt} onChange={(e) => setForm({ ...form, spentAt: e.target.value })}/></label><button className="button primary" disabled={busy}>{editing ? <Pencil size={15}/> : <Plus size={15}/>} {editing ? 'Update expense' : 'Add expense'}</button>{editing && <button type="button" className="button secondary" onClick={() => { setEditing(null); setForm(blank); }}>Cancel edit</button>}</form></section>
    <section className="recovery-card"><h2>Estimated vs actual by category</h2><div className="expense-chart"><ResponsiveContainer width="100%" height={250}><BarChart data={budget.categories || []} margin={{ top: 10, right: 12, left: 4, bottom: 26 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" angle={-18} textAnchor="end" interval={0} tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }}/><Tooltip formatter={(value) => money(value)}/><Legend/><Bar dataKey="estimated" name="Estimated" fill="#7aaec1" radius={[4,4,0,0]}/><Bar dataKey="spent" name="Actual" fill="#58aa9d" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>{budget.isOverBudget && <p className="over-budget-warning">Recorded and planned costs are over budget by {money(-budget.remaining)}.</p>}</section>
    <section className="recovery-card"><h2>Expense history</h2>{expenses.length ? expenses.map((expense) => <div className="expense-history" key={expense.id}><span><strong>{expense.description}</strong><small>{expense.category} · {expense.spentAt}</small></span><b>{money(expense.amount)}</b><button aria-label="Edit expense" onClick={() => edit(expense)}><Pencil size={15}/></button><button aria-label="Delete expense" onClick={() => remove(expense)}><Trash2 size={15}/></button></div>) : <p>No expenses recorded yet.</p>}</section>
  </section>;
}
function money(value) { return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function Metric({ label, value }) { return <div className="recovery-metric"><small>{label}</small><strong>{value}</strong></div>; }
