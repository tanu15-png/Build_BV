import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, IndianRupee, LayoutDashboard, ShieldCheck, Store } from 'lucide-react';
import { useAuth } from '@spoonate/portal/context/AuthContext';
import { useAdminResource } from '@spoonate/portal/hooks/useAdminResource';
import { campusDay } from '@spoonate/portal/utils/orderRules';
import SummaryDayPicker from './SummaryDayPicker';
const currency = paise => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
export default function AdminDashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const day = params.get('day') || campusDay(new Date());
  const resource = useAdminResource('/admin/overview?' + new URLSearchParams({ day }));
  const overview = resource.meta.overview;
  return <section className="space-y-5">
    <h1 className="text-3xl font-black">Admin Dashboard</h1>
    <p className="text-gray-500">Welcome, {user.name}. Monitor campus activity and manage access from the sidebar.</p>
    <SummaryDayPicker day={day} onChange={value => setParams({ day: value })} />
    <p className="text-sm text-gray-500">Order totals for {day} (IST), including the current status and collected value of orders placed that day.</p>
    {resource.error && <p role="alert" className="text-red-700">{resource.error} <button onClick={resource.refresh} className="underline">Retry</button></p>}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">{[
          [Store, 'Campus canteens', overview?.totalCanteens], [ClipboardList, 'Total orders', overview?.totalOrders],
          [LayoutDashboard, 'Active orders', overview?.activeOrders], [ShieldCheck, 'Collected orders', overview?.collectedOrders],
          [IndianRupee, 'Collected test order value', overview ? currency(overview.collectedValuePaise) : undefined],
        ].map(([Icon, label, value]) => <div key={label} className="rounded-2xl bg-white p-5 shadow-sm"><Icon className="text-[#0f8f73]" /><p className="mt-4 text-sm text-gray-500">{label}</p><p className="mt-1 break-words text-2xl font-black">{value ?? '…'}</p></div>)}</div>
        {overview && <p className="text-sm text-gray-500">{overview.operationalCanteens} operational canteens · {overview.acceptingCanteens} accepting new orders. Canteen counts and availability reflect the current campus directory.</p>}
    <Link to={`/admin/orders?codeDay=${day}`} className="inline-block rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white">View orders for this day</Link>
  </section>;
}
