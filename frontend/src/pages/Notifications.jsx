import { Bell, CloudSun, MapPin } from 'lucide-react';

export default function Notifications() {
  return <section className="recovery-page"><header className="recovery-header"><span className="planner-kicker"><Bell size={14}/> TRIP UPDATES</span><h1>Notifications<span className="title-period">.</span></h1><p className="muted">Trip-related weather and place updates will be collected here as monitoring is connected.</p></header><div className="empty-card"><Bell size={21}/><h3>You’re all caught up</h3><p>No notifications are available yet.</p><small><CloudSun size={13}/> Weather monitoring and <MapPin size={13}/> attraction updates are planned next.</small></div></section>;
}
