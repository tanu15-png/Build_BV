import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { api } from '../services/api';
import { pollingInterval, startVisiblePolling } from '../services/polling';
import { mapOrder } from '../services/orderActions';
export function useOrderDetails(orderId) {
  const { user, refreshSession } = useAuth();
  const { orders, cafes } = useOrders();
  const owner = `${user?.id || ''}:${user?.role || ''}:${user?.canteenId || ''}:${orderId}`;
  const [state, setState] = useState({ owner: '', order: null, error: '' });
  useEffect(() => {
    if (!orderId || !user?.id) return;
    let active = true; let sequence = 0;
    let polling;
    const load = async () => {
      const started = ++sequence;
      try {
        const order = await api('/orders/' + orderId);
        if (active && started === sequence) setState({ owner, order, error: '' });
      } catch (issue) { if (active && started === sequence) {
        setState(current => ({ ...current, owner, error: issue.message }));
        if ([401, 403].includes(issue.status)) { polling?.stop(); void refreshSession(); }
      } }
    };
    polling = startVisiblePolling({ refresh: load, intervalMs: pollingInterval(import.meta.env.VITE_SYNC_INTERVAL_MS) });
    return () => { active = false; polling.stop(); };
  }, [orderId, owner, user?.id, refreshSession]);
  const listed = orders.find(order => order.id === orderId);
  const detail = state.owner === owner && state.order ? mapOrder(state.order, cafes) : null;
  return { order: !listed || (detail && detail.version > listed.version) ? detail : listed,
    error: state.owner === owner ? state.error : '', loading: state.owner !== owner };
}
