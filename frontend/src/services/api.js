import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5002/api', timeout: 25000 });
api.interceptors.request.use((config) => { const token = localStorage.getItem('wayfarer-token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use((response) => ({ data: response.data?.data ?? response.data }), (error) => { const body=error.response?.data;const detail=Array.isArray(body?.details)?body.details.map(item=>item.field?`${item.field}: ${item.message}`:item.message).join('; '):'';return Promise.reject(new Error([body?.message||error.message||'Something went wrong.',detail].filter(Boolean).join(' — '))); });
export default api;
