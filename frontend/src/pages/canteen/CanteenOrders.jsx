import { useState } from "react";
import OrderSectionTabs from "../../components/OrderSectionTabs";
import { orderInSection } from "../../utils/orderRules";
import { Link } from "react-router-dom";
import { useOrders } from "../../context/OrderContext";
import { CanteenOrderCard } from "./CanteenDashboard";
export default function CanteenOrders() {
  const [section, setSection] = useState("Active");
  const { orders, ordersLoading, loadMoreOrders } = useOrders();
  const filtered = orders.filter(order => orderInSection(order, section));
  return <main className="mx-auto min-h-screen max-w-5xl p-5 lg:p-10"><Link to="/canteen" className="font-bold text-[#0f8f73]">← Canteen dashboard</Link><h1 className="mt-6 text-3xl font-black">All canteen orders</h1><OrderSectionTabs selected={section} onChange={setSection} /><div className="mt-6 space-y-4">{ordersLoading && <p role="status">Refreshing orders…</p>}{filtered.length ? filtered.map((order) => <CanteenOrderCard key={order.id} order={order} />) : <p className="rounded-2xl bg-white p-8 text-gray-500">No {section.toLowerCase()} orders.</p>}</div>{loadMoreOrders && <button disabled={ordersLoading} onClick={loadMoreOrders} className="mt-5 rounded-xl border p-3 font-bold">Load more orders</button>}</main>;
}
