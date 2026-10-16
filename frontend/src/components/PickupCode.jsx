import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { pollingInterval, startVisiblePolling } from '../services/polling';
export default function PickupCode({ order }) {
  const { user, refreshSession } = useAuth();
  const owner = `${user?.id || ''}:${order.id}:${order.status}`;
  const [state, setState] = useState({ owner: '', code: null, error: '' });
  useEffect(() => {
    if (user?.role !== 'student' || order.status !== 'READY') return;
    let active = true;
    let polling;
    const load = async () => {
      try {
        const result = await api(`/orders/${order.id}/pickup-code`);
        if (active) setState({ owner, code: result.code, error: '' });
      } catch (issue) {
        if (!active) return;
        setState({ owner, code: null, error: issue.message });
        if ([401, 403].includes(issue.status)) { polling?.stop(); void refreshSession(); }
      }
    };
    polling = startVisiblePolling({ refresh: load, intervalMs: pollingInterval(import.meta.env.VITE_SYNC_INTERVAL_MS) });
    return () => { active = false; polling.stop(); };
  }, [owner, order.id, order.status, user?.role, refreshSession]);
  if (user?.role !== 'student' || order.status !== 'READY') return null;
  const visible = state.owner === owner ? state : { code: null, error: '' };
  return <section className="mt-5 rounded-2xl bg-green-50 p-5 text-center text-[#075d50]">
    <h2 className="font-black">Your pickup code</h2>
    {visible.code ? <><p className="mt-2 text-5xl font-black tracking-widest">{visible.code}</p><p className="mt-3 text-sm">Share this pickup code with staff when you collect your food.</p></> : <p role={visible.error ? 'alert' : 'status'} className="mt-3 text-sm">{visible.error || (state.owner === owner ? 'This order is no longer awaiting pickup.' : 'Checking your pickup code…')}</p>}
  </section>;
}
