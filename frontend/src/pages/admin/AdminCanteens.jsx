import { Link } from 'react-router-dom';
import { useOrders } from '../../context/OrderContext';
import { useAdminResource } from '../../hooks/useAdminResource';
import AdminCanteenCard from './AdminCanteenCard';
export default function AdminCanteens() {
  const resource = useAdminResource('/admin/overview');
  const { refreshCatalog } = useOrders();
  const canteens = resource.meta.overview?.canteens || [];
  const saved = () => { resource.refresh(); void refreshCatalog(); };
  return <>
    {resource.initialLoading && <p role="status">Loading canteens…</p>}
    {resource.error && <p role="alert" className="text-red-700">{resource.error} <button onClick={resource.refresh} className="underline">Retry</button></p>}
        <section id="cafes" className="scroll-mt-5"><h1 className="text-3xl font-black">Campus canteens</h1><p className="mt-2 text-gray-500">Manage details, menus, availability and join codes.</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">{canteens.map(canteen => <div key={canteen.id}><AdminCanteenCard canteen={canteen} saved={saved} /><Link to={`/admin/orders?canteenId=${canteen.id}`} className="mt-3 inline-block text-sm font-bold text-[#075d50]">View {canteen.name} orders →</Link></div>)}</div>
        </section>
  </>;
}
