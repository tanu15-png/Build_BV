import OrderPayment from '@spoonate/portal/components/OrderPayment';
import { orderCode, orderDay } from "@spoonate/portal/utils/orderRules";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useOrders } from "@spoonate/portal/context/OrderContext";
import OrderSectionTabs from "@spoonate/portal/components/OrderSectionTabs";
import { orderInSection, statusLabels } from "@spoonate/portal/utils/orderRules";
export default function MyOrders() {
  const [tab, setTab] = useState("Active");
  const { orders, ordersLoading, loadMoreOrders } = useOrders();
  const filtered = orders.filter((order) => orderInSection(order, tab));
  return <main className="mx-auto min-h-screen max-w-5xl p-5 lg:p-10"><Link to="/dashboard" className="font-bold text-[#287647]">← Dashboard</Link><h1 className="mt-5 text-3xl font-black">My orders</h1><OrderSectionTabs selected={tab} onChange={setTab} /><div className="mt-6 space-y-4">{filtered.length ? filtered.map((order) => <article key={order.id} className="rounded-2xl bg-[#fffdf7] p-5 shadow-card"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-2xl font-black tracking-widest">{orderCode(order)}</p><p className="mt-2 text-sm">Day: {orderDay(order)}</p><p className="mt-2 font-bold">{order.cafeName}</p><p className="mt-2 text-sm text-gray-500">{order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</p></div><div><p className="font-black">₹{order.total}</p><p className="mt-2 text-sm font-bold text-[#287647]">{statusLabels[order.status]}</p></div></div><OrderPayment order={order} compact /><Link to={`/dashboard/orders/${order.id}`} className="mt-5 inline-block rounded-xl border border-[#287647] px-4 py-2 font-bold text-[#287647]">View details</Link></article>) : <p className="rounded-2xl bg-[#fffdf7] p-10 text-center text-gray-500">No {tab.toLowerCase()} orders.</p>}</div>{loadMoreOrders && <button disabled={ordersLoading} onClick={loadMoreOrders} className="mt-5 rounded-xl border p-3 font-bold">Load more orders</button>}</main>;
}
