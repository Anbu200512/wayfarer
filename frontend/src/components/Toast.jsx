import { createContext, useContext, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
const Context = createContext(() => {});
export function ToastProvider({ children }) { const [toast, setToast] = useState(''); const notify = (message) => { setToast(message); setTimeout(() => setToast(''), 3200); }; return <Context.Provider value={notify}>{children}{toast && <div className="toast"><CheckCircle2 size={18}/>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={16}/></button></div>}</Context.Provider>; }
export const useToast = () => useContext(Context);
