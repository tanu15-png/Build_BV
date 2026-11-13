import OfferPrice from './OfferPrice';
import Promotions from './Promotions';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, peekApiCache, subscribeApiReads } from '../services/api';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { rupeesToPaise } from '../services/catalog';

const button = 'shrink-0 whitespace-nowrap rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white disabled:opacity-50';
function useRewardData() {
  const [data, setData] = useState(() => peekApiCache('/rewards') || null), [error, setError] = useState('');
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const load = useCallback(async (fresh = false) => {
    const request = ++sequence.current;
    try { const value = await api('/rewards', { fresh: fresh === true }); if (request === sequence.current) { setData(value); setError(''); } }
    catch (issue) { if (request === sequence.current) setError(issue.message); }
  }, []);
  useEffect(() => {
    const refresh = () => { void load(); };
    refresh(); const timer = setInterval(refresh, 10000);
    const wake = () => { void load(true); };
    const unsubscribe = subscribeApiReads(refresh);
    window.addEventListener('focus', wake);
    return () => { clearInterval(timer); unsubscribe(); window.removeEventListener('focus', wake); };
  }, [load]);
  return { data, error, setError, load, setData, invalidate };
}
export function RewardsPanel({ staff = false }) {
  const { data, error, setError, load } = useRewardData();
  const [pendingIds, setPendingIds] = useState({});
  const pending = useRef(new Set()), retries = useRef(new Map()), rewardStrip = useRef(null);
  const navigate = useNavigate();
  const rewards = data?.rewards || [], cheapest = rewards[0], maximum = cheapest?.tokenCost;
  const balance = data?.balance ?? 0;
  const marks = maximum ? [...new Set(Array.from({ length: 6 }, (_, i) => Math.round(maximum * i / 5)))] : [];
  async function redeem(reward) {
    if (pending.current.has(reward.id)) return;
    pending.current.add(reward.id);
    setPendingIds(current => ({ ...current, [reward.id]: true })); setError('');
    const identity = `${reward.id}:${reward.tokenCost}`;
    if (!retries.current.has(identity)) retries.current.set(identity, crypto.randomUUID());
    const key = retries.current.get(identity);
    try {
      const order = await api('/rewards/redeem', { method: 'POST', body: { rewardId: reward.id, expectedTokenCost: reward.tokenCost }, idempotencyKey: key });
      retries.current.delete(identity); navigate(`/dashboard/orders/${order.id}`);
    } catch (issue) { setError(issue.message); } finally {
      pending.current.delete(reward.id);
      setPendingIds(current => { const next = { ...current }; delete next[reward.id]; return next; });
    }
  }
  return <section aria-label={staff ? 'Token programme' : 'Your reward tokens'} className="mb-7 rounded-[28px] bg-[#193f36] p-6 text-white lg:p-8">
    <div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-white/70">{staff ? 'Canteen rewards programme' : 'Your token balance'}</p><p className="mt-3 text-4xl font-black text-[#e7c773]">★ {data ? (staff ? data.earned : balance) : '…'} <span className="text-base font-medium text-white">{staff ? 'tokens earned by students' : 'tokens'}</span></p></div><p className="max-w-sm text-sm text-white/80">Earn 1 token per ₹10 on each collected order.{!staff && cheapest ? ` Your next reward: ${cheapest.menuItem.name} for ${maximum} tokens.` : ''}</p></div>
    {!staff && maximum && <><div role="progressbar" aria-label="Progress to the lowest-priced available reward" aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={Math.min(balance,maximum)} className="relative mx-3 mb-10 mt-8 h-1 rounded bg-white/25"><div className="h-1 rounded bg-[#e7c773]" style={{ width: `${Math.min(balance / maximum * 100, 100)}%` }} />{marks.map(n => <div key={n} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${n / maximum * 100}%` }}><span className={`block h-3 w-3 rounded-full border-2 border-white ${balance >= n ? 'bg-[#e7c773]' : 'bg-[#193f36]'}`} /><span className="absolute left-1/2 top-5 -translate-x-1/2 text-xs">{n}</span></div>)}</div><p className="font-bold">{balance >= maximum ? `${cheapest.menuItem.name} is unlocked.` : `${maximum-balance} tokens to ${cheapest.menuItem.name}.`}</p></>}
    {!staff && <div className="mt-4 min-w-0 max-w-full">
      {rewards.length > 0 && <><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-white/70">Reward items</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous reward items" onClick={() => rewardStrip.current?.scrollBy({ left: -280, behavior: 'smooth' })} className="rounded-lg border border-white/25 px-2 py-1 text-sm">←</button><button type="button" aria-label="Next reward items" onClick={() => rewardStrip.current?.scrollBy({ left: 280, behavior: 'smooth' })} className="rounded-lg border border-white/25 px-2 py-1 text-sm">→</button></div></div>
      <div ref={rewardStrip} role="list" aria-label="Items available for tokens" tabIndex={0} className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e7c773 transparent' }}>{rewards.map(reward => <div key={reward.id} role="listitem" className="flex w-[260px] shrink-0 snap-start items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2.5"><div className="min-w-0"><p title={reward.menuItem.name} className="truncate text-sm font-bold">{reward.menuItem.name}</p><p className="mt-0.5 text-xs text-[#e7c773]">{reward.tokenCost} tokens</p></div><button aria-label={`Redeem ${reward.menuItem.name} for ${reward.tokenCost} tokens`} aria-busy={Boolean(pendingIds[reward.id])} disabled={balance < reward.tokenCost || pendingIds[reward.id]} onClick={() => redeem(reward)} className="shrink-0 rounded-lg bg-[#e7c773] px-3 py-2 text-xs font-bold text-[#193f36] disabled:opacity-50">{pendingIds[reward.id] ? 'Redeeming…' : 'Redeem'}</button></div>)}</div></>}
      {data && !rewards.length && <p className="text-sm text-white/70">Rewards will appear here when the canteen makes them available.</p>}
    </div>}

    {staff && <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><p className="font-bold">{data?.redemptions ?? '…'} reward orders · {rewards.filter(r => r.active).length} active rewards</p><Link to="/canteen/rewards" className="rounded-xl bg-[#e7c773] px-5 py-3 font-bold text-[#193f36]">Manage reward items →</Link></div>}
    {error && <p role="alert" className="mt-3">{error} <button onClick={() => load(true)} className="underline">Refresh rewards</button></p>}
  </section>;
}

export function RewardManagement() {
  const { data, error, setError, load, setData, invalidate } = useRewardData();
  const { foods } = useOrders();
  const [adding, setAdding] = useState(false);
  const pending = useRef(new Set());
  const [drafts, setDrafts] = useState({});
  async function change(reward, body, remove = false) {
    const id = reward?.menuItemId || body.menuItemId;
    if (pending.current.has(id)) return false;
    pending.current.add(id); invalidate();
    // Overlay pending changes so polling cannot undo immediate feedback.
    if (reward) setDrafts(current => ({ ...current, [reward.id]: remove ? null : { ...reward, ...body } }));
    setError('');
    try {
      const saved = await api(remove ? `/rewards/manage/${reward.id}` : '/rewards/manage', { method: remove ? 'DELETE' : 'POST', ...(remove ? {} : { body }) });
      invalidate();
      setData(current => {
        const rows = current?.rewards || [];
        const next = remove ? rows.filter(r => r.id !== reward.id) : rows.some(r => r.id === saved.id)
          ? rows.map(r => r.id === saved.id ? { ...r, ...saved } : r)
          : [...rows, { ...saved, menuItem: foods.find(f => f.id === saved.menuItemId) }];
        return { ...current, rewards: next.sort((a,b) => a.tokenCost-b.tokenCost) };
      });
      return true;
    } catch(issue) { setError(issue.message); return false; }
    finally {
      pending.current.delete(id);
      if (reward) setDrafts(current => { const next = { ...current }; delete next[reward.id]; return next; });
    }
  }
  const rewards = (data?.rewards || []).map(r => Object.hasOwn(drafts,r.id) ? drafts[r.id] : r).filter(Boolean);
  return <section><h1 className="mb-3 text-3xl font-black">Manage reward items</h1><p className="mb-6 text-gray-500">Choose items from your menu and set how many tokens students need. The lowest available token price becomes their milestone target.</p><form onSubmit={async event => { event.preventDefault(); if (adding) return; const values = new FormData(event.currentTarget); const id = values.get('item'); setAdding(true); try { await change(data?.rewards.find(r => r.menuItemId === id), { menuItemId: id, tokenCost: Number(values.get('cost')), active: true }); } finally { setAdding(false); } }} className="mb-6 grid gap-4 rounded-2xl bg-white p-6 sm:grid-cols-3"><label className="text-sm font-bold">Menu item<select required name="item" className="mt-2 w-full rounded-xl border p-3"><option value="">Choose an item</option>{foods.filter(f => f.cafeId === 'canteen').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label className="text-sm font-bold">Token price<input name="cost" type="number" min="1" max="1000000" step="1" required className="mt-2 w-full rounded-xl border p-3" /></label><button disabled={adding} className={`${button} self-end`}>{adding ? 'Adding…' : 'Add or update reward'}</button></form>
    {error && <p role="alert" className="mb-4 text-red-700">{error} <button className="underline" onClick={() => load(true)}>Refresh rewards</button></p>}
    <div className="space-y-3">{rewards.map(reward => <RewardEditor key={reward.id} reward={reward} change={change} />)}</div>
    {data && !rewards.length && <p className="rounded-xl bg-white p-6 text-gray-500">No reward items yet. Add one above.</p>}
  </section>;
}

function RewardEditor({ reward, change }) {
  const [action, setAction] = useState(null), [active, setActive] = useState(reward.active);
  const [deleted, setDeleted] = useState(false), [priceState, setPriceState] = useState('');
  const tail = useRef(Promise.resolve()), timer = useRef(null), pendingPrice = useRef(null);
  const desired = useRef({ menuItemId: reward.menuItemId, tokenCost: reward.tokenCost, active: reward.active });
  const revision = useRef(0);
  function enqueue(kind, body, remove = false) {
    const edit = ++revision.current;
    setAction(kind);
    // Each row saves in sequence so edits made during an earlier save cannot be lost.
    const work = tail.current.then(() => change(reward, body, remove)).then(ok => {
      if (edit !== revision.current) return;
      setAction(null);
      if (kind !== 'delete') setPriceState(ok ? '' : 'Not saved — edit to retry');
      if (!ok && kind === 'toggle') { desired.current.active = !body.active; setActive(!body.active); }
      if (!ok && kind === 'delete') setDeleted(false);
    });
    tail.current = work.catch(() => {});
  }
  function flushPrice() {
    clearTimeout(timer.current);
    const save = pendingPrice.current;
    pendingPrice.current = null;
    if (save) save();
  }
  function editPrice(event) {
    revision.current++;
    clearTimeout(timer.current); pendingPrice.current = null;
    const value = event.target.value;
    if (!/^[0-9]+$/.test(value) || Number(value) < 1 || Number(value) > 1000000) {
      setPriceState('Enter 1–1,000,000 whole tokens'); return;
    }
    desired.current.tokenCost = Number(value);
    setPriceState('Saving…');
    pendingPrice.current = () => enqueue('price', { ...desired.current });
    timer.current = setTimeout(flushPrice, 550);
  }
  useEffect(() => () => {
    clearTimeout(timer.current);
    // Save a valid draft even if navigation happens before the debounce finishes.
    pendingPrice.current?.(); pendingPrice.current = null;
  }, []);
  if (deleted) return null;
  return <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><h2 className="font-black">{reward.menuItem.name}</h2><p className="text-sm text-gray-500">{active ? 'Enabled' : 'Paused'}{!reward.menuItem.available || reward.menuItem.archived ? ' · Menu item unavailable' : ''}</p></div><div className="flex flex-wrap items-center gap-3"><label className="text-sm">Tokens <input aria-label={`Token price for ${reward.menuItem.name}`} name="cost" defaultValue={reward.tokenCost} onChange={editPrice} onBlur={flushPrice} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); flushPrice(); } }} required type="number" min="1" max="1000000" step="1" className="w-28 rounded-xl border p-2" /><span role="status" className="ml-2 text-xs text-gray-500">{priceState || (action === 'price' ? 'Saving…' : '')}</span></label><button type="button" className={`rounded-xl border px-4 py-3 ${active ? '' : 'border-[#075d50] bg-[#e4f1eb] text-[#075d50]'}`} onClick={() => { clearTimeout(timer.current); pendingPrice.current = null; desired.current.active = !desired.current.active; setActive(desired.current.active); enqueue('toggle', { ...desired.current }); }}>{active ? 'Pause' : 'Enable'}</button><button type="button" aria-label={`Delete reward ${reward.menuItem.name}`} className="rounded-xl border border-red-200 px-4 py-3 text-red-700" onClick={() => { clearTimeout(timer.current); pendingPrice.current = null; setDeleted(true); enqueue('delete', null, true); }}>Delete</button></div></div>;
}

export function PromotionBanners() { return <Promotions />; }

export function ComboPanel({ staff = false }) {
  const { user } = useAuth();
  const { foods, categories, addToCart, isFoodAvailable, refreshCatalog } = useOrders();
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [success,setSuccess] = useState('');
  const combos = foods.filter(f => f.cafeId === 'canteen' && f.category === 'Combos');
  async function create(event) {
    event.preventDefault(); const form=event.currentTarget, fields=new FormData(form);
    setBusy(true);setError('');setSuccess('');
    try {
      let category=categories.find(c => c.canteenId===user.canteenId && c.name==='Combos' && !c.archived);
      if (!category) category=await api(`/canteens/${user.canteenId}/categories`, { method:'POST', body:{name:'Combos'} });
      await api(`/canteens/${user.canteenId}/menu`, { method:'POST', body:{ name:fields.get('name').trim(),description:fields.get('contents').trim(),categoryId:category.id,pricePaise:rupeesToPaise(fields.get('price')) } });
      form.reset(); await refreshCatalog();setSuccess('Combo published. Students can now order it.');
    } catch(issue) {setError(issue.message);} finally {setBusy(false);}
  }
  return <section className="mb-8" aria-label="Combos"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">{staff?'Manage combos':'Better together'}</h2>{staff && <Link className="font-bold text-[#075d50]" to="/canteen/menu">Edit prices & availability →</Link>}</div>
    {staff && <form onSubmit={create} className="mb-5 grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2"><label className="text-sm font-bold">Combo name<input required maxLength={120} name="name" placeholder="Sandwich & coffee combo" className="mt-2 w-full rounded-xl border p-3" /></label><label className="text-sm font-bold">Included items & portions<input required maxLength={500} name="contents" placeholder="1 veg sandwich + 1 regular cold coffee" className="mt-2 w-full rounded-xl border p-3" /></label><label className="text-sm font-bold">Bundle price (₹)<input required min="0.01" step="0.01" type="number" name="price" className="mt-2 w-full rounded-xl border p-3" /></label><div className="self-end"><button disabled={busy} className={button}>{busy?'Saving…':'Publish combo'}</button></div><p className="text-xs text-gray-500 sm:col-span-2">Fixed bundles are prepared as listed. Manage bundle availability separately when any included item runs out.</p></form>}
    {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}{success && <p role="status" className="mb-4 text-green-700">{success}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{combos.map(c => <article key={c.id} className="rounded-2xl border border-[#dfe7de] bg-white p-6"><p className="text-xs font-bold uppercase tracking-widest text-[#a17925]">Canteen combo</p><h3 className="mt-3 text-xl font-black">{c.name}</h3><p className="my-3 text-sm text-gray-500">{c.description}</p><div className="flex items-center justify-between gap-3"><OfferPrice item={c} />{staff ? <span>{c.available?'Available':'Paused'}</span> : <button disabled={!isFoodAvailable(c)} className={button} onClick={() => addToCart(c)}>{isFoodAvailable(c)?'Add combo +':'Unavailable'}</button>}</div></article>)}</div>
    {!combos.length && <p className="rounded-2xl bg-white p-6 text-gray-500">{staff?'Create your first fixed combo above.':'Canteen combos will appear here when the canteen publishes them.'}</p>}
  </section>;
}
