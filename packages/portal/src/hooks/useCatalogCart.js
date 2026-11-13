import { apiBase } from '../portal.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, peekApiCache, invalidateApiReads } from '../services/api';
import { mapCatalog, mapCart } from '../services/catalog';
import { mergeCanteenMenu } from '../services/menuChanges';
import { createMenuQueue } from '../services/menuQueue';
import { createCartQueue } from '../services/cartQueue';
import { addCartItem, changeCartQuantity, clearCart } from '../services/cartChanges';
const empty = { canteens: [], items: [], categories: [] };
export function useCatalogCart(user) {
  const key = user ? `${user.id}:${user.role}:${user.canteenId || ''}` : '';
  const student = user?.role === 'student';
  const canteenId = user?.canteenId;
  const [catalog, setCatalog] = useState({ owner: '', data: empty });
  const [remoteCart, setRemoteCart] = useState({ owner: '', data: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const cartQueue = useRef(null);
  const busyRef = useRef(false);
  const catalogSequence = useRef(0);
  const generation = useRef(0);
  const catalogRef = useRef(empty);
  const pendingMenu = useRef(null);
  const menuQueue = useRef(null);
  const [management, setManagement] = useState({ owner: '', menu: null, pending: 0 });
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const refresh = useCallback(async (catalogOnly = false, fresh = false) => {
    if (!key || (!catalogOnly && busyRef.current)) return;
    const catalogRequest = ++catalogSequence.current;
    const started = generation.current;
    setLoading(true);
    try {
      const [nextCatalog] = await Promise.all([api('/catalog', { fresh }), student && !catalogOnly ? cartQueue.current?.load(true) : null]);
      if (started !== generation.current) return;
      const visible = pendingMenu.current ? mergeCanteenMenu(nextCatalog, pendingMenu.current) : nextCatalog;
      if (catalogRequest === catalogSequence.current) { catalogRef.current = visible; setCatalog({ owner: key, data: visible }); }
      setError('');
    } catch (issue) { if (catalogRequest === catalogSequence.current && started === generation.current) setError(issue.message); }
    finally { if (catalogRequest === catalogSequence.current && started === generation.current) setLoading(false); }
  }, [key, student]);
  const refreshCatalog = useCallback(() => refresh(false, true), [refresh]);
  useEffect(() => {
    const activeGeneration = generation.current + 1; generation.current = activeGeneration; busyRef.current = false;
    catalogRef.current = peekApiCache('/catalog') || empty; pendingMenu.current = null;
    if (key && catalogRef.current !== empty) setCatalog({ owner: key, data: catalogRef.current });
    const cartUpdates = createCartQueue({ request: api,
      changed: snapshot => {
        if (cartQueue.current !== cartUpdates) return;
        busyRef.current = snapshot.pending > 0; setBusy(snapshot.pending > 0);
        setRemoteCart({ owner: key, data: snapshot.cart });
      },
      failed: issue => { if (cartQueue.current === cartUpdates) setError(issue.message); },
    });
    cartUpdates.ownerKey = key;
    cartQueue.current = cartUpdates;
    const queue = createMenuQueue({ request: api,
      changed: snapshot => {
        if (menuQueue.current !== queue) return;
        pendingMenu.current = snapshot.pending ? snapshot.menu : null;
        setManagement({ owner: key, ...snapshot }); setCatalogSaving(snapshot.pending > 0);
        if (snapshot.menu) {
          if (snapshot.reason !== 'seed') catalogSequence.current++;
          catalogRef.current = mergeCanteenMenu(catalogRef.current, snapshot.menu);
          setCatalog({ owner: key, data: catalogRef.current }); setLoading(false);
        }
      },
      failed: issue => { if (menuQueue.current === queue) { setError(`Unable to save your menu change. ${issue.message}`); void refresh(true); } },
    });
    queue.ownerKey = key;
    menuQueue.current = queue;
    // Legacy browser carts/availability never become authoritative server records.
    localStorage.removeItem('campusEatsCartsV2'); localStorage.removeItem('campusEatsAvailabilityV2');
    const initial = setTimeout(() => { setBusy(busyRef.current); setCatalogSaving(false); setError(''); void refresh(); }, 0);
    const timer = setInterval(() => { void refresh(); }, 30000);
    const onFocus = () => { void refresh(false, true); };
    window.addEventListener('focus', onFocus); window.addEventListener('online', onFocus);
    let updateTimer;
    const stream = key ? new EventSource(`${apiBase}/catalog/events`) : null;
    const onCatalogChange = () => {
      invalidateApiReads();
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => { setCatalogRevision(value => value + 1); void refresh(true, true); if(student)void cartUpdates.load(true).catch(issue=>setError(issue.message)); }, 150);
    };
    stream?.addEventListener('catalog-change', onCatalogChange);
    stream?.addEventListener('rewards-change', invalidateApiReads);
    stream?.addEventListener('orders-change', () => window.dispatchEvent(new Event('spoonate:orders-changed')));
    return () => { cartUpdates.dispose(); queue.dispose(); generation.current = activeGeneration + 1; clearTimeout(initial); clearTimeout(updateTimer); clearInterval(timer); stream?.close(); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onFocus); };
  }, [key, refresh, student]);
  useEffect(() => {
    const until=catalog.data.cacheUntil;
    if(!until||catalog.owner!==key)return;
    const timer=setTimeout(()=>{void refresh(false,true);},Math.min(2147483647,Math.max(50,Date.parse(until)-Date.now()+25)));
    return()=>clearTimeout(timer);
  },[catalog,key,refresh]);
  const mutateCart = (build, project) => {
    if (!student) return Promise.reject(new Error('Sign in to update your cart.'));
    const queue = cartQueue.current;
    if (queue?.ownerKey !== key) return Promise.reject(new Error('Your session changed. Reload your cart.'));
    return queue.enqueue(build, project).then(result => {
      if (cartQueue.current === queue) setError('');
      return result;
    });
  };
  const data = useMemo(() => mapCatalog(catalog.owner === key ? catalog.data : empty), [catalog, key]);
  const cartState = remoteCart.owner === key ? remoteCart.data : null;
  const queueMenuChange = (path, method, body, sourceMenu) => {
    const current = catalogRef.current;
    const menu = sourceMenu || { canteen: current.canteens.find(c => c.id === user?.canteenId),
      categories: current.categories.filter(c => c.canteenId === user?.canteenId), items: current.items.filter(i => i.canteenId === user?.canteenId) };
    if (!menu.canteen) throw new Error('Wait for your menu to load, then retry.');
    if (menuQueue.current?.ownerKey !== key) throw new Error('Wait for your menu to load, then retry.');
    setError('');
    return menuQueue.current.enqueue(path, method, body, menu);
  };
  const seedManagementMenu = useCallback(menu => {
    if (menuQueue.current?.ownerKey === key && (user?.role === 'admin' || menu.canteen.id === canteenId)) return menuQueue.current.seed(menu);
  }, [key, canteenId, user?.role]);
  return { ...data, cart: cartState ? mapCart(cartState, data.cafes) : [], cartState,
    catalogError: error, catalogLoading: loading, cartBusy: busy, catalogSaving, refreshCatalog,
    catalogRevision,
    managementMenu: management.owner === key ? management.menu : null,
    pendingMenuSaves: management.owner === key ? management.pending : 0,
    seedManagementMenu, queueMenuChange,
    addItem: menuItemId => {
      const item = catalogRef.current.items.find(item => item.id === menuItemId);
      const canteen = catalogRef.current.canteens.find(canteen => canteen.id === item?.canteenId);
      return mutateCart(() => ({ path: '/cart/items', method: 'POST', values: { menuItemId, quantity: 1 } }), cart => addCartItem(cart, item, canteen));
    },
    changeQuantity: (id, quantity) => mutateCart(cart => {
      const line = cart.items.find(item => item.menuItemId === id);
      if (!line) throw new Error('This item is no longer in your cart. Refresh your cart and retry.');
      return { path: `/cart/items/${line.id}`, method: quantity <= 0 ? 'DELETE' : 'PATCH', values: quantity <= 0 ? {} : { quantity } };
    }, cart => changeCartQuantity(cart, id, quantity)),
    clearServerCart: () => mutateCart(() => ({ path: '/cart', method: 'DELETE' }), clearCart),
    reviewCart: () => mutateCart(cart => ({ path: '/cart/review', method: 'POST', values: { quote: cart.quote } })),
    manage: (path, method, body) => queueMenuChange(path, method, body).completion,
  };
}
