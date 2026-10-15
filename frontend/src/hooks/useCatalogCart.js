import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { mapCatalog, mapCart } from '../services/catalog';
const empty = { cafes: [], foods: [], categories: [] };
export function useCatalogCart(user) {
  const key = user ? `${user.id}:${user.role}:${user.canteenId || ''}` : '';
  const student = user?.role === 'student';
  const [catalog, setCatalog] = useState({ owner: '', data: empty });
  const [remoteCart, setRemoteCart] = useState({ owner: '', data: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const cartRef = useRef(null);
  const busyRef = useRef(false);
  const sequence = useRef(0);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!key || busyRef.current) return;
    const request = ++sequence.current;
    const started = generation.current;
    setLoading(true);
    try {
      const [nextCatalog, nextCart] = await Promise.all([api('/catalog'), student ? api('/cart') : null]);
      if (request !== sequence.current || started !== generation.current) return;
      setCatalog({ owner: key, data: mapCatalog(nextCatalog) });
      setRemoteCart({ owner: key, data: nextCart }); cartRef.current = nextCart;
      setError('');
    } catch (issue) { if (request === sequence.current && started === generation.current) setError(issue.message); }
    finally { if (request === sequence.current && started === generation.current) setLoading(false); }
  }, [key, student]);
  useEffect(() => {
    const activeGeneration = generation.current + 1; generation.current = activeGeneration; cartRef.current = null; busyRef.current = false;
    // Legacy browser carts/availability never become authoritative server records.
    localStorage.removeItem('campusEatsCartsV2'); localStorage.removeItem('campusEatsAvailabilityV2');
    const initial = setTimeout(() => { setBusy(false); setError(''); void refresh(); }, 0);
    const timer = setInterval(() => { void refresh(); }, 30000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus); window.addEventListener('online', onFocus);
    return () => { generation.current = activeGeneration + 1; clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onFocus); };
  }, [refresh]);
  const mutateCart = async (path, method, values = {}) => {
    if (!student || !cartRef.current) throw new Error('Wait for your cart to load, then retry.');
    if (busyRef.current) throw new Error('Please wait for the current cart update.');
    const started = generation.current; sequence.current++; busyRef.current = true; setBusy(true);
    try {
      const result = await api(path, { method, body: { expectedVersion: cartRef.current.version, ...values } });
      if (started === generation.current) { cartRef.current = result; setRemoteCart({ owner: key, data: result }); setError(''); }
      return result;
    } catch (issue) {
      if (started === generation.current) {
        const fresh = issue.details?.cart;
        if (fresh) { cartRef.current = fresh; setRemoteCart({ owner: key, data: fresh }); }
        setError(issue.message);
      }
      throw issue;
    } finally {
      if (started === generation.current) { busyRef.current = false; setBusy(false); setLoading(false); }
    }
  };
  const data = catalog.owner === key ? catalog.data : empty;
  const cartState = remoteCart.owner === key ? remoteCart.data : null;
  const manage = async (path, method, body) => {
    try { const result = await api(path, { method, body }); await refresh(); return result; }
    catch (issue) { setError(issue.message); await refresh(); throw issue; }
  };
  return { ...data, cart: cartState ? mapCart(cartState, data.cafes) : [], cartState,
    catalogError: error, catalogLoading: loading, cartBusy: busy, refreshCatalog: refresh,
    addItem: menuItemId => mutateCart('/cart/items', 'POST', { menuItemId, quantity: 1 }),
    changeQuantity: (id, quantity) => {
      const line = cartRef.current?.items.find(item => item.menuItemId === id);
      if (!line) return Promise.reject(new Error('Refresh your cart and retry.'));
      return mutateCart(`/cart/items/${line.id}`, quantity <= 0 ? 'DELETE' : 'PATCH', quantity <= 0 ? {} : { quantity });
    },
    clearServerCart: () => mutateCart('/cart', 'DELETE'),
    reviewCart: () => mutateCart('/cart/review', 'POST', { quote: cartRef.current?.quote }),
    manage,
  };
}
