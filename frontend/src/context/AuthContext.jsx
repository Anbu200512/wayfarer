import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!localStorage.getItem('wayfarer-token')) { setLoading(false); return; } api.get('/auth/me').then((response) => setUser(response.data.user)).catch(() => localStorage.removeItem('wayfarer-token')).finally(() => setLoading(false)); }, []);
  const login = async (credentials) => { const response = await api.post('/auth/login', credentials); const { token, user } = response.data; localStorage.setItem('wayfarer-token', token); setUser(user); };
  const register = async (details) => { const response = await api.post('/auth/register', details); const { token, user } = response.data; localStorage.setItem('wayfarer-token', token); setUser(user); };
  const logout = () => { localStorage.removeItem('wayfarer-token'); setUser(null); };
  return <Context.Provider value={{ user, loading, login, register, logout }}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
