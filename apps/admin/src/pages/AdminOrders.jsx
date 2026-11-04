import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAdminResource } from '@spoonate/portal/hooks/useAdminResource';
import { useDebouncedValue } from '@spoonate/portal/hooks/useDebouncedValue';
import { adminOrderQuery } from '@spoonate/portal/services/adminData';
import { orderCode, orderDay, statusLabels } from '@spoonate/portal/utils/orderRules';
const input = 'rounded-xl border border-gray-200 bg-white px-4 py-3';
const currency = paise => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
const statusStyles = { REJECTED: 'bg-red-50 text-red-700', RECEIVED: 'bg-blue-50 text-blue-700', ACCEPTED: 'bg-blue-50 text-blue-700', PREPARING: 'bg-amber-50 text-amber-700', READY: 'bg-green-50 text-green-700', COLLECTED: 'bg-gray-100 text-gray-600' };
export default function AdminOrders() {
  const [params] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebouncedValue(searchDraft);
  const [status, setStatus] = useState('ALL');
  const [canteenId, setCanteenId] = useState(params.get('canteenId') || 'ALL');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [codeDay, setCodeDay] = useState(params.get('codeDay') || ''); const [reference, setReference] = useState('');
  const query = adminOrderQuery({ search, status, canteenId, from, to, codeDay, orderCode: reference.length === 3 ? reference : '' });
  const resource = useAdminResource(query, true);
  const overview = resource.meta.overview;
  const canteens = overview?.canteens || [];
  return <>
    {resource.error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{resource.error} <button onClick={resource.refresh} className="underline">Retry</button></div>}
        <section id="orders" className="scroll-mt-5"><h1 className="text-3xl font-black">All campus orders</h1><p className="mt-2 text-gray-500">Search the full order history.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3"><Search size={18} /><input aria-label="Search campus orders" type="search" maxLength={120} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Reference, canteen, customer or item" className="min-w-0 w-full outline-none" /></label>
            <select aria-label="Filter by canteen" value={canteenId} onChange={event => setCanteenId(event.target.value)} className={input}><option value="ALL">All canteens</option>{canteens.map(canteen => <option key={canteen.id} value={canteen.id}>{canteen.name}</option>)}</select>
            <select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)} className={input}><option value="ALL">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="text-sm font-bold">Placed from<input type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${input} mt-2 w-full`} /></label>
            <label className="text-sm font-bold">Placed through<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} className={`${input} mt-2 w-full`} /></label>
            <label className="text-sm font-bold">Allocation day<input type="date" value={codeDay} onChange={event => setCodeDay(event.target.value)} className={`${input} mt-2 w-full`} /></label>
            <label className="text-sm font-bold">Exact order reference<input maxLength={3} value={reference} onChange={event => setReference(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="e.g. A01" className={`${input} mt-2 w-full`} /></label>
          </div>
          {resource.initialLoading && <p role="status" className="mt-4 text-gray-500">Loading campus orders…</p>}
          <p aria-live="polite" className="my-4 text-sm text-gray-500">Showing {resource.items.length} of {resource.meta.totalCount ?? '…'} matching orders</p>
          {!resource.items.length && resource.initialized && !resource.error && <p className="rounded-2xl bg-white p-8 text-center text-gray-500">No matching orders.</p>}
          {resource.items.length > 0 && <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">Campus orders, newest first</caption><thead className="bg-gray-50 text-gray-500"><tr>{['Order', 'Customer', 'Canteen', 'Items', 'Value', 'Status'].map(label => <th key={label} scope="col" className="whitespace-nowrap p-4">{label}</th>)}</tr></thead>
            <tbody>{resource.items.map(order => <tr key={order.id} className="border-t"><td className="p-4"><p className="font-black">{orderCode(order)}</p><p className="mt-1 whitespace-nowrap text-xs text-gray-500">{orderDay(order)}</p></td><td className="p-4">{order.studentName}</td><td className="p-4">{order.canteenName}</td><td className="min-w-48 p-4">{order.items.map(item => `${item.name} × ${item.quantity}`).join(' · ')}</td><td className="whitespace-nowrap p-4 font-bold">{currency(order.totalPaise)}</td><td className="p-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusStyles[order.status]}`}>{statusLabels[order.status]}</span></td></tr>)}</tbody>
          </table></div>}
          {resource.loadMore && <button disabled={resource.loading} onClick={resource.loadMore} className="mt-5 rounded-xl border px-5 py-3 font-bold disabled:opacity-50">Load more orders</button>}
        </section>
  </>;
}
