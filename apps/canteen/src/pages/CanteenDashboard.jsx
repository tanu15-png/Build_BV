import CanteenPoster from '@spoonate/portal/components/CanteenPoster';
import { orderCode, orderDay, newestOrderFirst, orderReceivedTime } from "@spoonate/portal/utils/orderRules";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, LogOut, Store } from "lucide-react";
import { useAuth } from "@spoonate/portal/context/AuthContext";
import { useOrders } from "@spoonate/portal/context/OrderContext";
import OrderSectionTabs from "@spoonate/portal/components/OrderSectionTabs";
import { canteenOrderInSection, statusLabels } from "@spoonate/portal/utils/orderRules";

export default function CanteenDashboard() {
  const { user, logout } = useAuth();
  const { orders, cafes, toggleOrders, loadMoreOrders } = useOrders();
  const navigate = useNavigate();
  const cafe = cafes.find((item) => item.databaseId === user.canteenId);
  const [section, setSection] = useState("Active");
  const filtered = orders.filter((order) => canteenOrderInSection(order, section))
    .sort(newestOrderFirst);
  const [error, setError] = useState("");
  const perform = async (action) => { try { await action(); setError(""); } catch (issue) { setError(issue.message); } };
  const handleLogout = () => { void perform(async () => { await logout(); navigate("/login", { replace: true }); }); };
  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <aside className="fixed bottom-0 left-0 top-9 hidden w-64 flex-col bg-[#075d50] p-6 text-white lg:flex">
        <p className="text-2xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p><p className="mt-2 text-sm text-white/60">Canteen management</p>
        <nav className="mt-10 space-y-3" aria-label="Canteen navigation"><Link to="/canteen" className="block rounded-xl bg-white px-4 py-3 font-bold text-[#075d50]">Dashboard</Link><Link to="/canteen/orders" className="block px-4 py-3">All orders</Link><Link to="/canteen/stats" className="block px-4 py-3">Stats</Link><Link to="/canteen/menu" className="block px-4 py-3">Manage menu</Link><Link to="/canteen/combos" className="block px-4 py-3">Manage combos</Link><Link to="/canteen/offers" className="block px-4 py-3">Manage offers</Link><Link to="/canteen/banners" className="block px-4 py-3">Manage banners</Link><Link to="/canteen/rewards" className="block px-4 py-3">Manage rewards</Link><Link to="/canteen/members" className="block px-4 py-3">Members</Link></nav>
        <button onClick={handleLogout} className="mt-auto flex items-center gap-2 px-4 py-3"><LogOut size={18} /> Logout</button>
      </aside>
      <main className="lg:ml-64">
        <header className="border-b border-gray-100 bg-white p-5 lg:px-10"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><CanteenPoster slug={cafe?.id} name={cafe?.name} className="h-24 w-24 rounded-2xl border border-gray-100" /><div><p className="text-sm font-bold text-[#0f8f73]">CANTEEN DASHBOARD</p><h1 className="mt-2 text-3xl font-black">{cafe?.name}</h1><p className="mt-2 text-gray-500">Review incoming orders and mark collections.</p></div></div><button onClick={handleLogout} className="rounded-xl border px-4 py-2 lg:hidden">Logout</button></div><nav className="mt-4 flex flex-wrap gap-5 text-sm font-bold text-[#075d50] lg:hidden"><Link to="/canteen/orders">All orders</Link><Link to="/canteen/stats">Stats</Link><Link to="/canteen/menu">Manage menu</Link><Link to="/canteen/combos">Manage combos</Link><Link to="/canteen/offers">Offers</Link><Link to="/canteen/banners">Banners</Link><Link to="/canteen/rewards">Rewards</Link><Link to="/canteen/members">Members</Link></nav></header>
        <div className="mx-auto max-w-7xl space-y-8 p-5 lg:p-10">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm"><div><h2 className="flex items-center gap-2 text-xl font-black"><Store size={20} /> Incoming orders</h2><p className="mt-2 text-gray-500">{cafe?.status === "Paused" ? "New orders are paused. Continue fulfilling existing orders." : "Your canteen is accepting new orders."}</p></div><button onClick={() => perform(toggleOrders)} className="rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white">{cafe?.status === "Paused" ? "Resume orders" : "Pause incoming orders"}</button></section>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">{[
            ["Awaiting acceptance", orders.filter((order) => order.status === "RECEIVED").length],
            ["Preparing", orders.filter((order) => ["ACCEPTED", "PREPARING"].includes(order.status)).length],
            ["Ready for pickup", orders.filter((order) => order.status === "READY").length],
            ["Collected", orders.filter((order) => order.status === "COLLECTED").length],
            ["Rejected", orders.filter((order) => order.status === "REJECTED").length],
          ].map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}</div>
          <section><OrderSectionTabs selected={section} onChange={setSection} /><h2 className="mt-5 text-2xl font-black">{section} orders</h2>{loadMoreOrders && <button onClick={loadMoreOrders} className="mt-3 font-bold underline">Load more orders</button>}<p className="mt-2 text-gray-500">Newest orders are shown first.</p><div className="mt-5 space-y-4">{filtered.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center"><ClipboardList className="mx-auto text-gray-300" size={36} /><p className="mt-4 font-bold">No {section.toLowerCase()} orders</p></div> : filtered.map((order) => <CanteenOrderCard key={order.id} order={order} />)}</div></section>

        </div>
      </main>
    </div>
  );
}

export function CanteenOrderCard({ order }) {
  const { updateOrderStatus, collectOrder, orderActionErrors, retryOrderAction } = useOrders();
  const actionError = orderActionErrors[order.id];
  const next = { RECEIVED: ["ACCEPTED", "Accept order"], ACCEPTED: ["PREPARING", "Start preparing"], PREPARING: ["READY", "Mark ready"] }[order.status];
  const advance = status => { void updateOrderStatus(order.id, status, order).catch(() => {}); };
  return <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><Link to={`/canteen/orders/${order.id}`} className="text-3xl font-black tracking-widest text-[#075d50]">{orderCode(order)}</Link><p className="mt-2 text-sm text-gray-500">Day: {orderDay(order)} Ã‚Â· {order.cafeName}</p><p className="mt-2 text-sm text-gray-500">Received <time dateTime={order.createdAt}>{orderReceivedTime(order)}</time></p><p className="mt-2 text-sm font-bold text-[#0f8f73]">{statusLabels[order.status]}</p><p className="mt-3 text-gray-600">{order.items.map((item) => `${item.name} Ãƒâ€” ${item.quantity}`).join(" Ã‚Â· ")}</p><p className="mt-2 font-bold">Order value: Ã¢â€šÂ¹{order.total}</p></div><div>
      {!actionError && order.status === "RECEIVED" && <button onClick={() => advance("REJECTED")} className="mr-3 rounded-xl border border-red-600 px-5 py-3 font-bold text-red-700">Reject order</button>}
      {!actionError && next && <button onClick={() => advance(next[0])} className="rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white">{next[1]}</button>}
      {order.status === "REJECTED" && <p className="mt-3 font-bold text-red-700">Order rejected. The customer will be notified.</p>}
      {!actionError && order.status === "READY" && <div className="mt-3 max-w-xs">
        <button onClick={() => { void collectOrder(order.id, order).catch(() => {}); }} className="rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white">Collected</button>
      </div>}
      {order.status === "COLLECTED" && <p role={order.collectionFeedback ? 'status' : undefined} className="font-bold text-green-700">{order.collectionFeedback ? 'Order marked collected' : 'Collected'}</p>}
    </div></div>{actionError && <div role="alert" className="mt-4 text-sm text-red-600"><p>{actionError.message}</p><button disabled={actionError.recovering} onClick={() => { void retryOrderAction(order.id).catch(() => {}); }} className="mt-3 rounded-xl border px-4 py-2 font-bold disabled:opacity-50">Retry update</button></div>}
  </article>;
}
