import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { createOrderActions, mapOrder } from '../services/orderActions';
export function useRemoteOrders(user, cafes, refreshCart) {
  const actorId = user?.id;
  const owner = user ? user.id + ':' + user.role + ':' + (user.canteenId || '') : '';
  const actions = useMemo(() => createOrderActions({ api, storage: sessionStorage, actorId }), [actorId]);
  const [state, setState] = useState({ owner: '', items: [], nextCursor: null });
  const [pending, setPending] = useState({ owner: '', request: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const requestSequence = useRef(0);
  const busyRef = useRef(false);
  const recent = useRef(new Map());
  const refreshOrders = useCallback(async (cursor = null) => {
    if (!owner || busyRef.current) return;
    const started = generation.current; const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const page = await api('/orders?limit=100' + (cursor ? '&cursor=' + cursor : ''));
      if (started !== generation.current || sequence !== requestSequence.current) return;
      setState(current => {
        const incoming = page.items.map(order => {
          const known = recent.current.get(order.id);
          return known?.version > order.version ? known : order;
        });
        const items = cursor && current.owner === owner
          ? [...current.items.filter(order => !incoming.some(next => next.id === order.id)), ...incoming]
          : incoming;
        // Keep recently opened/changed orders usable even when they are outside the first page.
        for (const order of recent.current.values()) if (!items.some(item => item.id === order.id)) items.push(order);
        return { owner, items, nextCursor: page.nextCursor };
      });
      setError('');
    } catch (issue) { if (started === generation.current && sequence === requestSequence.current) setError(issue.message); }
    finally { if (started === generation.current && sequence === requestSequence.current) setLoading(false); }
  }, [owner]);
  useEffect(() => {
    const activeGeneration = generation.current + 1; generation.current = activeGeneration; busyRef.current = false; recent.current.clear();
    const initial = setTimeout(() => { setBusy(false); setError(''); setPending({ owner, request: actions.pendingCheckout() }); void refreshOrders(); }, 0);
    const timer = setInterval(() => { void refreshOrders(); }, 15000);
    const refresh = () => { void refreshOrders(); };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { generation.current = activeGeneration + 1; clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [actions, owner, refreshOrders]);
  async function mutate(run, checkout = false) {
    if (busyRef.current) throw new Error('Please wait for your current order request.');
    const started = generation.current; requestSequence.current++; busyRef.current = true; setBusy(true); setError('');
    try {
      const order = await run();
      if (started !== generation.current) throw new Error('Your account changed. Sign in to view your order.');
      recent.current.set(order.id, order);
      if (recent.current.size > 20) recent.current.delete(recent.current.keys().next().value);
      setState(current => ({ owner, items: [order, ...(current.owner === owner ? current.items.filter(item => item.id !== order.id) : [])], nextCursor: current.owner === owner ? current.nextCursor : null }));
      return mapOrder(order, cafes);
    } catch (issue) {
      if (started === generation.current) {
        if (issue.details?.order) {
          const fresh = issue.details.order; recent.current.set(fresh.id, fresh);
          setState(current => ({ owner, items: [fresh, ...(current.owner === owner ? current.items.filter(order => order.id !== fresh.id) : [])], nextCursor: current.owner === owner ? current.nextCursor : null }));
        }
        setError(issue.message);
      }
      throw issue;
    } finally {
      if (started === generation.current) {
        busyRef.current = false; setBusy(false); setLoading(false);
        setPending({ owner, request: actions.pendingCheckout() });
        void refreshOrders();
        if (checkout) void refreshCart();
      }
    }
  }
  const rows = state.owner === owner ? state.items : [];
  return { orders: rows.map(order => mapOrder(order, cafes)), ordersError: error, ordersLoading: loading, orderBusy: busy,
    pendingCheckout: pending.owner === owner ? pending.request : null, refreshOrders,
    loadMoreOrders: state.owner === owner && state.nextCursor ? () => refreshOrders(state.nextCursor) : null,
    createOrder: body => mutate(() => actions.checkout(body), true),
    updateOrderStatus: (id, status, detail) => {
      const listed = rows.find(item => item.id === id);
      const order = detail?.id === id && (!listed || detail.version > listed.version) ? detail : listed;
      if (!order) return Promise.reject(new Error('Refresh the order before continuing.'));
      return mutate(() => actions.transition(order, status));
    },
  };
}
