import { Link, useSearchParams } from 'react-router-dom';
import { useOrders } from '@spoonate/portal/context/OrderContext';
import { useAdminResource } from '@spoonate/portal/hooks/useAdminResource';
import AdminCanteenCard from './AdminCanteenCard';
import { campusDay } from '@spoonate/portal/utils/orderRules';
import SummaryDayPicker from './SummaryDayPicker';
export default function AdminCanteens() {
  const [params, setParams] = useSearchParams();
  const day = params.get('day') || campusDay(new Date());
  const resource = useAdminResource('/admin/overview?' + new URLSearchParams({ day }));
  const { refreshCatalog } = useOrders();
  const canteens = resource.meta.overview?.canteens || [];
  const saved = () => { resource.refresh(); void refreshCatalog(); };
  return <>
    <SummaryDayPicker day={day} onChange={value => setParams({ day: value })} />
    {resource.initialLoading && <p role="status">Loading canteens…</p>}
    {resource.error && <p role="alert" className="text-red-700">{resource.error} <button onClick={resource.refresh} className="underline">Retry</button></p>}
        <section id="cafes" className="scroll-mt-5"><h1 className="text-3xl font-black">Campus canteens</h1><p className="mt-2 text-gray-500">Manage details, menus, availability and join codes.</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">{canteens.map(canteen => <div key={canteen.id}><AdminCanteenCard canteen={canteen} day={day} saved={saved} /><Link to={`/admin/orders?canteenId=${canteen.id}&codeDay=${day}`} className="mt-3 inline-block text-sm font-bold text-[#075d50]">View {canteen.name} orders →</Link></div>)}</div>
        </section>
  </>;
}
