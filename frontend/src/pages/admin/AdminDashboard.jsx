import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, IndianRupee, LayoutDashboard, LogOut, Search, ShieldCheck, Store, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { useAdminResource } from '../../hooks/useAdminResource';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { adminOrderQuery } from '../../services/adminData';
import { orderCode, orderDay, pickupLabel, statusLabels } from '../../utils/orderRules';
import AdminMaintenance, { AdminCanteenCard } from './AdminMaintenance';
const input = 'rounded-xl border border-gray-200 bg-white px-4 py-3';
const currency = paise => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
const statusStyles = { RECEIVED: 'bg-blue-50 text-blue-700', ACCEPTED: 'bg-blue-50 text-blue-700', PREPARING: 'bg-amber-50 text-amber-700', READY: 'bg-green-50 text-green-700', COLLECTED: 'bg-gray-100 text-gray-600' };
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { refreshCatalog } = useOrders();
  const navigate = useNavigate();
  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebouncedValue(searchDraft);
  const [status, setStatus] = useState('ALL');
  const [canteenId, setCanteenId] = useState('ALL');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [codeDay, setCodeDay] = useState(''); const [reference, setReference] = useState('');
  const query = adminOrderQuery({ search, status, canteenId, from, to, codeDay, orderCode: reference.length === 3 ? reference : '' });
  const resource = useAdminResource(query, true);
  const overview = resource.meta.overview;
  const canteens = overview?.canteens || [];
  const saved = () => { resource.refresh(); void refreshCatalog(); };
  const handleLogout = async () => { try { await logout(); navigate('/login', { replace: true }); } catch { /* AuthProvider displays the error. */ } };
  const sections = [['overview', LayoutDashboard, 'Overview'], ['cafes', Store, 'Canteens'], ['orders', ClipboardList, 'All orders'], ['access', Users, 'Accounts & access']];
  return <div className="min-h-screen bg-[#f6f8f7]">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#075d50] p-6 text-white lg:flex">
      <p className="text-2xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p><p className="mt-2 text-sm text-white/60">Administration</p>
      <nav aria-label="Admin navigation" className="mt-10 space-y-3">{sections.map(([id, Icon, label]) => <a key={id} href={`#${id}`} className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold hover:bg-white/10"><Icon size={18} />{label}</a>)}</nav>
      <button onClick={handleLogout} className="mt-auto flex items-center gap-3 px-4 py-3"><LogOut size={18} />Logout</button>
    </aside>
    <main className="lg:ml-64">
      <header id="overview" className="border-b bg-white p-5 lg:px-10"><div className="flex flex-wrap items-center justify-between gap-4"><div>
        <p className="flex items-center gap-2 text-sm font-bold text-[#0f8f73]"><ShieldCheck size={16} />CAMPUS ADMINISTRATION</p><h1 className="mt-2 text-3xl font-black">Admin Dashboard</h1><p className="mt-2 text-gray-500">Welcome, {user.name}. Monitor orders and manage canteen access.</p>
      </div><button onClick={handleLogout} className="rounded-xl border px-4 py-2 lg:hidden">Logout</button></div>
        <nav aria-label="Admin sections" className="mt-5 flex flex-wrap gap-4 text-sm font-bold text-[#075d50] lg:hidden">{sections.map(([id, , label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
      </header>
      <div className="mx-auto max-w-7xl space-y-9 p-5 lg:p-10">
        {resource.error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{resource.error}<button onClick={resource.refresh} className="ml-3 font-bold underline">Retry</button></div>}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">{[
          [Store, 'Campus canteens', overview?.totalCanteens], [ClipboardList, 'Total orders', overview?.totalOrders],
          [LayoutDashboard, 'Active orders', overview?.activeOrders], [ShieldCheck, 'Collected orders', overview?.collectedOrders],
          [IndianRupee, 'Collected test order value', overview ? currency(overview.collectedValuePaise) : undefined],
        ].map(([Icon, label, value]) => <div key={label} className="rounded-2xl bg-white p-5 shadow-sm"><Icon className="text-[#0f8f73]" /><p className="mt-4 text-sm text-gray-500">{label}</p><p className="mt-1 break-words text-2xl font-black">{value ?? '…'}</p></div>)}</div>
        {overview && <p className="text-sm text-gray-500">{overview.operationalCanteens} operational canteens · {overview.acceptingCanteens} accepting new orders. Campus totals include all order history.</p>}
        <section id="cafes" className="scroll-mt-5"><h2 className="text-2xl font-black">Campus canteens</h2><p className="mt-2 text-gray-500">Manage details, menus, availability and join codes.</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">{canteens.map(canteen => <div key={canteen.id}><AdminCanteenCard canteen={canteen} saved={saved} /><a href="#orders" onClick={() => { setCanteenId(canteen.id); setStatus('ALL'); setSearchDraft(''); }} className="mt-3 inline-block text-sm font-bold text-[#075d50]">View {canteen.name} orders →</a></div>)}</div>
        </section>
        <section id="orders" className="scroll-mt-5"><h2 className="text-2xl font-black">All campus orders</h2><p className="mt-2 text-gray-500">Search the full order history. Dates use campus time (IST).</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3"><Search size={18} /><input aria-label="Search campus orders" type="search" maxLength={120} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Reference, canteen, student or item" className="min-w-0 w-full outline-none" /></label>
            <select aria-label="Filter by canteen" value={canteenId} onChange={event => setCanteenId(event.target.value)} className={input}><option value="ALL">All canteens</option>{canteens.map(canteen => <option key={canteen.id} value={canteen.id}>{canteen.name}</option>)}</select>
            <select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)} className={input}><option value="ALL">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="text-sm font-bold">Placed from<input type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${input} mt-2 w-full`} /></label>
            <label className="text-sm font-bold">Placed through<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} className={`${input} mt-2 w-full`} /></label>
            <label className="text-sm font-bold">Allocation day<input type="date" value={codeDay} onChange={event => setCodeDay(event.target.value)} className={`${input} mt-2 w-full`} /></label>
            <label className="text-sm font-bold">Exact order reference<input maxLength={3} value={reference} onChange={event => setReference(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="e.g. A01" className={`${input} mt-2 w-full`} /></label>
          </div>
          {resource.loading && <p role="status" className="mt-4 text-gray-500">Refreshing campus orders…</p>}
          <p aria-live="polite" className="my-4 text-sm text-gray-500">Showing {resource.items.length} of {resource.meta.totalCount ?? '…'} matching orders</p>
          {!resource.items.length && !resource.loading && !resource.error && <p className="rounded-2xl bg-white p-8 text-center text-gray-500">No matching orders.</p>}
          {resource.items.length > 0 && <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">Campus orders, newest first</caption><thead className="bg-gray-50 text-gray-500"><tr>{['Order', 'Student', 'Canteen', 'Items', 'Pickup', 'Value', 'Status'].map(label => <th key={label} scope="col" className="whitespace-nowrap p-4">{label}</th>)}</tr></thead>
            <tbody>{resource.items.map(order => <tr key={order.id} className="border-t"><td className="p-4"><p className="font-black">{orderCode(order)}</p><p className="mt-1 whitespace-nowrap text-xs text-gray-500">{orderDay(order)}</p></td><td className="p-4">{order.studentName}</td><td className="p-4">{order.canteenName}</td><td className="min-w-48 p-4">{order.items.map(item => `${item.name} × ${item.quantity}`).join(' · ')}</td><td className="whitespace-nowrap p-4">{pickupLabel(order)}</td><td className="whitespace-nowrap p-4 font-bold">{currency(order.totalPaise)}</td><td className="p-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusStyles[order.status]}`}>{statusLabels[order.status]}</span></td></tr>)}</tbody>
          </table></div>}
          {resource.loadMore && <button disabled={resource.loading} onClick={resource.loadMore} className="mt-5 rounded-xl border px-5 py-3 font-bold disabled:opacity-50">Load more orders</button>}
        </section>
        <AdminMaintenance canteens={canteens} saved={saved} />
      </div>
    </main>
  </div>;
}
