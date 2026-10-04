import { orderCode, orderDay, pickupLabel } from "../../utils/orderRules";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useOrders } from "../../context/OrderContext";
import { statusLabels } from "../../utils/orderRules";
export default function MyOrders() {
  const [tab, setTab] = useState("Active");
  const { orders } = useOrders();
  const filtered = orders.filter((order) => tab === "Active" ? order.status !== "COLLECTED" : order.status === "COLLECTED");
  return <main className="mx-auto min-h-screen max-w-5xl p-5 lg:p-10"><Link to="/student" className="font-bold text-[#0f8f73]">← Student dashboard</Link><h1 className="mt-5 text-3xl font-black">My orders</h1><div className="mt-6 flex gap-3 border-b">{["Active", "Completed"].map((item) => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-5 py-3 font-bold ${tab === item ? "border-[#0f8f73] text-[#0f8f73]" : "border-transparent text-gray-500"}`}>{item}</button>)}</div><div className="mt-6 space-y-4">{filtered.length ? filtered.map((order) => <article key={order.id} className="rounded-2xl bg-white p-5 shadow-card"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-2xl font-black tracking-widest">{orderCode(order)}</p><p className="mt-2 text-sm">Day: {orderDay(order)}</p><p className="mt-2 font-bold">{order.cafeName}</p><p className="mt-2 text-sm text-gray-500">{order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</p></div><div><p className="font-black">₹{order.total}</p><p className="mt-2 text-sm">Estimated pickup {pickupLabel(order)}</p><p className="mt-2 text-sm font-bold text-[#0f8f73]">{statusLabels[order.status]}</p></div></div><Link to={`/student/orders/${order.id}`} className="mt-5 inline-block rounded-xl border border-[#0f8f73] px-4 py-2 font-bold text-[#0f8f73]">View details</Link></article>) : <p className="rounded-2xl bg-white p-10 text-center text-gray-500">No {tab.toLowerCase()} orders.</p>}</div></main>;
}
