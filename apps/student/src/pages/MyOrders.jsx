import OrderPayment from '@spoonate/portal/components/OrderPayment';
import { orderCode, orderDay, orderAmountLabel } from "@spoonate/portal/utils/orderRules";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import { useOrders } from "@spoonate/portal/context/OrderContext";
import OrderSectionTabs from "@spoonate/portal/components/OrderSectionTabs";
import { orderInSection, statusLabels } from "@spoonate/portal/utils/orderRules";
export default function MyOrders() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = ["Active", "Completed", "Rejected"].includes(params.get("tab")) ? params.get("tab") : "Active";
  const setTab = value => setParams({ tab: value }, { replace: true });
  const { orders, ordersLoading, loadMoreOrders } = useOrders();
  const filtered = orders.filter((order) => orderInSection(order, tab));
  return <main className="mx-auto min-h-screen max-w-5xl p-5 lg:p-10">
    <Link to="/dashboard" className="font-bold text-[#287647]">← Dashboard</Link>
    <h1 className="mt-5 text-3xl font-black">My orders</h1>
    <OrderSectionTabs selected={tab} onChange={setTab} />
    <div className="mt-6 space-y-4">{filtered.length ? filtered.map(order => <article key={order.id} className="rounded-2xl bg-[#fffdf7] p-5 shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0"><p className="text-2xl font-black tracking-widest">{orderCode(order)}</p><p className="mt-2 text-sm">Day: {orderDay(order)}</p><p className="mt-2 font-bold">{order.cafeName}</p></div>
        <div className="text-right"><p className="font-black" data-order-amount>{orderAmountLabel(order)}</p><p className="mt-2 text-sm font-bold text-[#287647]">{statusLabels[order.status]}</p></div>
      </div>
      <p className="mt-3 text-sm text-gray-500 [overflow-wrap:anywhere]">{order.items.map(item => `${item.name} × ${item.quantity}`).join(', ')}</p>
      <OrderPayment order={order} compact />
      <Link to={`/dashboard/orders/${order.id}`} state={{ from: location.pathname + location.search + location.hash }} className="mt-5 inline-block rounded-xl border border-[#287647] px-4 py-2 font-bold text-[#287647]">View details</Link>
    </article>) : <p className="rounded-2xl bg-[#fffdf7] p-10 text-center text-gray-500">No {tab.toLowerCase()} orders.</p>}</div>
    {loadMoreOrders && <button disabled={ordersLoading} onClick={loadMoreOrders} className="mt-5 rounded-xl border p-3 font-bold">Load more orders</button>}
  </main>;
}
