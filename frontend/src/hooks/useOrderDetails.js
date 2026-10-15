import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { api } from '../services/api';
import { mapOrder } from '../services/orderActions';
export function useOrderDetails(orderId) {
  const { user } = useAuth();
  const { orders, cafes } = useOrders();
  const owner = user?.id + ':' + orderId;
  const [state, setState] = useState({ owner: '', order: null, error: '' });
  useEffect(() => {
    if (!orderId || !user?.id) return;
    let active = true; let sequence = 0;
    const load = async () => {
      const started = ++sequence;
      try {
        const order = await api('/orders/' + orderId);
        if (active && started === sequence) setState({ owner, order, error: '' });
      } catch (issue) { if (active && started === sequence) setState(current => ({ ...current, owner, error: issue.message })); }
    };
    const initial = setTimeout(() => { void load(); }, 0);
    const timer = setInterval(() => { void load(); }, 15000);
    return () => { active = false; clearTimeout(initial); clearInterval(timer); };
  }, [orderId, owner, user?.id]);
  const listed = orders.find(order => order.id === orderId);
  const detail = state.owner === owner && state.order ? mapOrder(state.order, cafes) : null;
  return { order: !listed || (detail && detail.version > listed.version) ? detail : listed,
    error: state.owner === owner ? state.error : '', loading: state.owner !== owner };
}
