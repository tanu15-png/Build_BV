import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft, RefreshCw, Gift } from 'lucide-react';
import { api } from '@spoonate/portal/services/api';

const money = paise => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = date => new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const links = [['Dashboard', '/canteen'], ['Manage menu', '/canteen/menu'], ['Manage combos', '/canteen/combos'], ['Manage offers', '/canteen/offers'], ['Manage banners', '/canteen/banners'], ['Manage rewards', '/canteen/rewards'], ['Stats', '/canteen/stats'], ['Members', '/canteen/members']];

function SalesChart({ data, period, date }) {
  const titleId = useId();
  const buckets = new Map(data.buckets.map(row => [row.key, row.salesPaise]));
  const keys = [];
  if (period === 'day') for (let hour = 0; hour < 24; hour++) keys.push(String(hour).padStart(2, '0'));
  else for (let day = new Date(data.startDate + 'T00:00:00Z'); day.toISOString().slice(0, 10) <= date; day.setUTCDate(day.getUTCDate() + 1)) keys.push(day.toISOString().slice(0, 10));
  const values = keys.map(key => buckets.get(key) || 0), maximum = Math.max(...values, 100);
  const label = key => period === 'day' ? `${Number(key) % 12 || 12}${Number(key) < 12 ? 'am' : 'pm'}` : dateLabel(key).split(' ').slice(0, 2).join(' ');
  const points = values.map((value, i) => `${keys.length === 1 ? 50 : i / (keys.length - 1) * 100},${95 - value / maximum * 85}`);
  const peak = values.indexOf(Math.max(...values));
  return <section className="rounded-2xl border border-[#e1eae5] bg-white p-5 sm:p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">Sales trend</h2><p className="mt-1 text-sm text-slate-500">{period === 'day' ? dateLabel(date) : `${dateLabel(data.startDate)} – ${dateLabel(date)}`} · IST</p></div>{data.orders > 0 && <p className="rounded-lg bg-[#edf5ef] px-3 py-2 text-sm font-bold text-[#075d50]">{period === 'day' ? 'Peak hour' : 'Best day'}: {label(keys[peak])}</p>}</div>
    {data.orders === 0 ? <p className="py-16 text-center text-slate-500">No sales from collected orders in this period.</p> : <>
      <div className="flex gap-3"><div className="flex w-20 shrink-0 flex-col justify-between pb-2 text-right text-xs text-slate-500"><span>{money(maximum)}</span><span>{money(maximum / 2)}</span><span>₹0</span></div><div className="relative min-w-0 flex-1"><div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-2"><hr className="border-slate-100" /><hr className="border-slate-100" /><hr className="border-slate-100" /></div><svg role="img" aria-labelledby={titleId} viewBox="0 0 100 100" preserveAspectRatio="none" className="relative h-48 w-full overflow-visible sm:h-60"><title id={titleId}>Sales after offers in rupees, grouped by {period === 'day' ? 'hour' : 'collection date'} in IST. Detailed values follow.</title><polygon points={`0,95 ${points.join(' ')} 100,95`} fill="#edf5ef" /><polyline points={points.join(' ')} fill="none" stroke="#075d50" strokeWidth="2" vectorEffect="non-scaling-stroke" />{values.map((value, i) => <ellipse key={keys[i]} cx={keys.length === 1 ? 50 : i / (keys.length - 1) * 100} cy={95 - value / maximum * 85} rx="0.45" ry="1.2" fill="#e9cb72"><title>{label(keys[i])}: {money(value)}</title></ellipse>)}</svg><div className="mt-2 flex justify-between gap-1 text-xs text-slate-500">{[...new Set([0, Math.floor((keys.length - 1) / 2), keys.length - 1])].map(i => <span key={i}>{label(keys[i])}</span>)}</div></div></div>
      <p className="mt-3 text-center text-xs text-slate-500">{period === 'day' ? 'Hour of collection (IST)' : 'Collection date (IST)'} · Sales value (₹)</p>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold text-[#075d50]">View exact values</summary><dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">{keys.map((key, i) => <div key={key} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1"><dt>{label(key)}</dt><dd>{money(values[i])}</dd></div>)}</dl></details>
    </>}
  </section>;
}

export default function CanteenAnalytics() {
  const [period, setPeriod] = useState('day'), [date, setDate] = useState(today), [sort, setSort] = useState('quantity');
  const [result, setResult] = useState(null), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [showAll, setShowAll] = useState(false);
  const requestKey = `${period}:${date}`;
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    api(`/stats?period=${period}&date=${date}`, { signal: controller.signal }).then(data => { if (current) { setResult({ key: requestKey, data }); setError(''); } }).catch(issue => { if (current) setError(issue.message); });
    return () => { current = false; controller.abort(); };
  }, [period, date, requestKey, refresh]);
  const data = result?.key === requestKey ? result.data : null;
  const items = useMemo(() => [...(data?.items || [])].sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name)), [data, sort]);
  const visible = showAll ? items : items.slice(0, 3), other = showAll ? [] : items.slice(3);
  const pending = !data && !error;
  const changePeriod = value => { setError(''); setPeriod(value); };
  return <div className="min-h-screen bg-[#f6f8f7] text-[#172b28]">
    <aside className="fixed bottom-0 left-0 top-9 hidden w-64 flex-col bg-[#075d50] p-6 text-white lg:flex"><p className="text-2xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p><p className="mt-2 text-sm text-white/60">Canteen management</p><nav aria-label="Canteen navigation" className="mt-10 space-y-2">{links.map(([name, path]) => <Link key={path} to={path} aria-current={name === 'Stats' ? 'page' : undefined} className={`block rounded-xl px-4 py-3 ${name === 'Stats' ? 'bg-white font-bold text-[#075d50]' : 'text-white/80 hover:bg-white/10'}`}>{name}</Link>)}</nav></aside>
    <main className="mx-auto max-w-7xl p-5 lg:ml-64 lg:p-10">
      <Link to="/canteen" className="mb-5 inline-flex items-center gap-2 font-bold text-[#075d50] lg:hidden"><ArrowLeft size={17} /> Dashboard</Link>
      <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold tracking-[.15em] text-[#0f8f73]">CANTEEN INSIGHTS</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Stats</h1><p className="mt-2 text-slate-500">A clearer picture of what’s selling.</p></div><button onClick={() => { setError(''); setRefresh(value => value + 1); }} className="inline-flex items-center gap-2 rounded-xl border border-[#dbe7df] bg-white px-4 py-3 font-bold text-[#075d50]"><RefreshCw size={17} /> Refresh</button></header>
      <div className="my-7 flex flex-wrap items-center justify-between gap-4"><div role="group" aria-label="Sales period" className="flex rounded-xl border border-[#dbe7df] bg-white p-1">{['day', 'week', 'month'].map(value => <button key={value} aria-pressed={period === value} onClick={() => changePeriod(value)} className={`rounded-lg px-5 py-2 font-bold capitalize ${period === value ? 'bg-[#075d50] text-white' : 'text-slate-500'}`}>{value}</button>)}</div><label className="flex items-center gap-3 text-sm font-bold text-slate-600">{period === 'day' ? 'Date' : 'Through'}<input aria-label="Sales date" type="date" min="2000-01-01" max={today()} value={date} onChange={event => { if (event.target.validity.valid && event.target.value) { setError(''); setDate(event.target.value); } }} className="min-w-0 rounded-xl border border-[#dbe7df] bg-white px-3 py-3 text-base text-[#172b28]" /></label></div>
      <p className="mb-5 text-sm text-slate-500">{period === 'week' ? 'Last 7 days through the selected date.' : period === 'month' ? 'Month to date through the selected date.' : 'Selected day.'} Collected orders only · IST</p>
      {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error} <button className="ml-3 font-bold underline" onClick={() => { setError(''); setRefresh(value => value + 1); }}>Retry</button></div>}
      {pending && <p role="status" className="rounded-2xl bg-white p-10 text-center text-slate-500">Loading sales…</p>}
      {data && <div className="space-y-7">
        <section aria-label="Sales summary" className="grid divide-y divide-[#dfe8e2] overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">{[['Sales value', money(data.salesPaise), 'After offers · Before expenses'], ['Collected orders', data.orders.toLocaleString('en-IN'), 'Excludes token reward orders'], ['Average order', money(data.orders ? data.salesPaise / data.orders : 0), 'Per collected order']].map(([label, value, note]) => <div key={label} className="p-6"><p className="text-sm text-slate-500">{label}</p><p className="my-2 text-3xl font-black tabular-nums">{value}</p><p className="text-xs text-slate-500">{note}</p></div>)}</section>
        <SalesChart data={data} period={period} date={date} />
        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="min-w-0 rounded-2xl border border-[#dfe8e2] bg-white p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">What sold</h2><p className="mt-1 text-sm text-slate-500">Quantity and sales, side by side</p></div><label className="text-xs text-slate-500">Sort by <select value={sort} onChange={e => setSort(e.target.value)} className="ml-2 rounded-lg border border-[#dfe8e2] bg-white p-2 text-sm text-[#172b28]"><option value="quantity">Quantity sold</option><option value="salesPaise">Sales value</option></select></label></div>
            {items.length ? <><table className="w-full text-sm"><thead className="text-xs text-slate-500"><tr><th className="pb-3 text-left font-medium">Item</th><th className="px-2 pb-3 text-right font-medium">Qty<br />sold</th><th className="pb-3 text-right font-medium">Sales after<br />offers</th></tr></thead><tbody>{visible.map(item => <tr key={`${item.id}:${item.name}`} className="border-t border-[#e7eee9]"><td className="py-4 pr-2 font-bold break-words">{item.name}</td><td className="px-2 py-4 text-right font-bold tabular-nums">{item.quantity}</td><td className="py-4 text-right tabular-nums">{money(item.salesPaise)}</td></tr>)}{other.length > 0 && <tr className="border-t border-[#e7eee9] text-slate-500"><td className="py-4">Other items combined</td><td className="px-2 text-right tabular-nums">{other.reduce((n, row) => n + row.quantity, 0)}</td><td className="text-right tabular-nums">{money(other.reduce((n, row) => n + row.salesPaise, 0))}</td></tr>}</tbody><tfoot><tr className="border-t border-[#dfe8e2] font-black"><td className="pt-4">Total</td><td className="px-2 pt-4 text-right tabular-nums">{data.quantity}</td><td className="pt-4 text-right tabular-nums">{money(data.salesPaise)}</td></tr></tfoot></table>{items.length > 3 && <button onClick={() => setShowAll(value => !value)} className="mt-5 font-bold text-[#075d50] underline">{showAll ? 'Show top 3' : `View all ${items.length} items`}</button>}</> : <p className="py-8 text-slate-500">No items sold in this period.</p>}
            <p className="mt-5 text-xs text-slate-500">One order can contain multiple items. Token rewards are excluded.</p>
          </section>
          <div className="space-y-4"><section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 sm:p-6"><h2 className="text-lg font-black">How sales add up</h2><p className="mt-1 text-sm text-slate-500">Menu value minus discounts</p><div className="mt-6 space-y-5"><div className="flex justify-between gap-4"><div><p>Items at menu prices</p><p className="text-xs text-slate-500">Before any offers</p></div><strong className="tabular-nums">{money(data.grossPaise)}</strong></div><div className="flex justify-between gap-4"><div><p>− Discounts given</p><p className="text-xs text-slate-500">From item and combo offers</p></div><strong className="tabular-nums">{money(data.discountPaise)}</strong></div><div className="border-t border-[#dfe8e2] pt-5"><div className="flex flex-wrap items-center justify-between gap-2"><strong>= Final sales value</strong><span className="text-3xl font-black tabular-nums text-[#075d50]">{money(data.salesPaise)}</span></div><p className="mt-2 text-xs text-slate-500">After discounts · Before expenses</p></div></div></section><section className="flex items-center gap-4 rounded-xl bg-[#edf5ef] p-5"><Gift size={24} className="shrink-0 text-[#075d50]" /><strong className="text-3xl font-black text-[#075d50]">{data.rewards}</strong><div><p className="font-bold">Free reward orders collected</p><p className="mt-1 text-xs text-slate-600">Redeemed with tokens · Not included in sales</p></div></section></div>
        </div><footer className="border-t border-[#dfe8e2] pt-4 text-xs text-slate-500"><BarChart3 size={14} className="mr-2 inline" />Grouped by collection time in IST. Sales value does not show profit or confirm payment received. Ordering currently uses TEST mode.</footer>
      </div>}
    </main>
  </div>;
}
