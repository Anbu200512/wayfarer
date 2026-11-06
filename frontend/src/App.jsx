import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import MarketingLayout from './components/MarketingLayout';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Trips from './pages/Trips';
import TripForm from './pages/TripForm';
import TripDetail from './pages/TripDetail';
import Auth from './pages/Auth';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import Gallery from './pages/Gallery';
import Contact from './pages/Contact';
import Planner from './pages/Planner';
import TripRecovery from './pages/TripRecovery';
import RecoveryHub from './pages/RecoveryHub';
import ExplorePlaces from './pages/ExplorePlaces';
import SavedPlaces from './pages/SavedPlaces';
import ExpenseHub from './pages/ExpenseHub';
import Notifications from './pages/Notifications';
import ProfileSettings from './pages/ProfileSettings';
const TripExpenses = lazy(() => import('./pages/TripExpenses'));
const TripCompare = lazy(() => import('./pages/TripCompare'));

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Opening your travel journal…</div>;
  return user ? children : <Navigate to="/login" replace/>;
}

function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Opening your travel journal…</div>;
  return user ? <Navigate to="/dashboard" replace/> : children;
}

export default function App() {
  return <ToastProvider><Routes>
    <Route element={<MarketingLayout/>}>
      <Route path="/" element={<Home/>}/>
      <Route path="/about" element={<About/>}/>
      <Route path="/services" element={<Services/>}/>
      <Route path="/gallery" element={<Gallery/>}/>
      <Route path="/contact" element={<Contact/>}/>
    </Route>
    <Route path="/login" element={<Guest><Auth/></Guest>}/>
    <Route path="/register" element={<Guest><Auth mode="register"/></Guest>}/>
    <Route element={<Protected><Layout/></Protected>}>
      <Route path="/dashboard" element={<Dashboard/>}/>
      <Route path="/trips" element={<Trips/>}/>
       <Route path="/trips/new" element={<Planner/>}/>
      <Route path="/trips/:id" element={<TripDetail/>}/>
      <Route path="/trips/:id/recovery" element={<TripRecovery/>}/>
      <Route path="/trips/:id/expenses" element={<Suspense fallback={<div className="empty-card">Loading trip budget…</div>}><TripExpenses/></Suspense>}/>
      <Route path="/trips/:id/edit" element={<TripForm/>}/>
       <Route path="/planner" element={<Planner/>}/>
       <Route path="/explore" element={<ExplorePlaces/>}/>
       <Route path="/saved" element={<SavedPlaces/>}/>
       <Route path="/expenses" element={<ExpenseHub/>}/>
       <Route path="/notifications" element={<Notifications/>}/>
       <Route path="/settings" element={<ProfileSettings/>}/>
      <Route path="/compare" element={<Suspense fallback={<div className="empty-card">Loading plan comparison…</div>}><TripCompare/></Suspense>}/>
      <Route path="/recovery" element={<RecoveryHub/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></ToastProvider>;
}
