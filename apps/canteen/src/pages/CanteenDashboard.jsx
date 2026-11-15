import OrderPayment from '@spoonate/portal/components/OrderPayment';
import CanteenPoster from '@spoonate/portal/components/CanteenPoster';
import { orderCode, orderDay, canteenActiveOrderFirst, newestOrderFirst, orderReceivedTime } from "@spoonate/portal/utils/orderRules";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, LogOut, Store } from "lucide-react";
import { useAuth } from "@spoonate/portal/context/AuthContext";
import { useOrders } from "@spoonate/portal/context/OrderContext";
import OrderSectionTabs from "@spoonate/portal/components/OrderSectionTabs";
import { isUnpaidOrder, canteenOrderSections, canteenOrderInSection, statusLabels } from "@spoonate/portal/utils/orderRules";

export default function CanteenDashboard() {
  const { user, logout } = useAuth();
  const { orders, cafes, toggleOrders, loadMoreOrders } = useOrders();
  const navigate = useNavigate();
  const cafe = cafes.find((item) => item.databaseId === user.canteenId);
  const [section, setSection] = useState("Active");
  const filtered = orders.filter((order) => canteenOrderInSection(order, section))
    .sort(section === "Active" ? canteenActiveOrderFirst : newestOrderFirst);
  const [error, setError] = useState("");
  const perform = async (action) => { try { await action(); setError(""); } catch (issue) { setError(issue.message); } };
  const handleLogout = () => { void perform(async () => { await logout(); navigate("/login", { replace: true }); }); };
  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <aside className="fixed bottom-0 left-0 top-9 hidden w-64 flex-col bg-[#075d50] p-6 text-white lg:flex">
        <p className="text-2xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p><p className="mt-2 text-sm text-white/60">Canteen management</p>
        <nav className="mt-10 space-y-3" aria-label="Canteen navigation"><Link to="/canteen" className="block rounded-xl bg-white px-4 py-3 font-bold text-[#075d50]">Dashboard</Link><Link to="/canteen/menu" className="block px-4 py-3">Manage menu</Link><Link to="/canteen/combos" className="block px-4 py-3">Manage combos</Link><Link to="/canteen/offers" className="block px-4 py-3">Manage offers</Link><Link to="/canteen/banners" className="block px-4 py-3">Manage banners</Link><Link to="/canteen/rewards" className="block px-4 py-3">Manage rewards</Link><Link to="/canteen/stats" className="block px-4 py-3">Stats</Link><Link to="/canteen/members" className="block px-4 py-3">Members</Link></nav>
        <button onClick={handleLogout} className="mt-auto flex items-center gap-2 px-4 py-3"><LogOut size={18} /> Logout</button>
      </aside>
      <main className="lg:ml-64">
        <header className="border-b border-gray-100 bg-white p-5 lg:px-10"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><CanteenPoster slug={cafe?.id} name={cafe?.name} className="h-24 w-24 rounded-2xl border border-gray-100" /><div><p className="text-sm font-bold text-[#0f8f73]">CANTEEN DASHBOARD</p><h1 className="mt-2 text-3xl font-black">{cafe?.name}</h1><p className="mt-2 text-gray-500">Review incoming orders and mark collections.</p></div></div><button onClick={handleLogout} className="rounded-xl border px-4 py-2 lg:hidden">Logout</button></div><nav className="mt-4 flex flex-wrap gap-5 text-sm font-bold text-[#075d50] lg:hidden"><Link to="/canteen/menu">Manage menu</Link><Link to="/canteen/combos">Manage combos</Link><Link to="/canteen/offers">Offers</Link><Link to="/canteen/banners">Banners</Link><Link to="/canteen/rewards">Rewards</Link><Link to="/canteen/stats">Stats</Link><Link to="/canteen/members">Members</Link></nav></header>
        <div className="mx-auto max-w-7xl space-y-8 p-5 lg:p-10">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm"><div><h2 className="flex items-center gap-2 text-xl font-black"><Store size={20} /> Incoming orders</h2><p className="mt-2 text-gray-500">{cafe?.status === "Paused" ? "New orders are paused. Continue fulfilling existing orders." : "Your canteen is accepting new orders."}</p></div><button onClick={() => perform(toggleOrders)} className="rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white">{cafe?.status === "Paused" ? "Resume orders" : "Pause incoming orders"}</button></section>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{canteenOrderSections.map(label => <button key={label} onClick={() => setSection(label)} className="rounded-xl bg-white p-4 text-left shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-2xl font-black">{orders.filter(order => canteenOrderInSection(order, label)).length}</p></button>)}</div>
          <section><OrderSectionTabs sections={canteenOrderSections} selected={section} onChange={setSection} /><h2 className="mt-5 text-2xl font-black">{section} orders</h2>{loadMoreOrders && <button onClick={loadMoreOrders} className="mt-3 font-bold underline">Load more orders</button>}<p className="mt-2 text-gray-500">{section === "Active" ? "Paid orders first · Awaiting payment at the bottom." : "Newest orders are shown first."}</p><div className="mt-5 space-y-4">{filtered.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center"><ClipboardList className="mx-auto text-gray-300" size={36} /><p className="mt-4 font-bold">No {section.toLowerCase()} orders</p></div> : filtered.map((order) => <CanteenOrderCard key={order.id} order={order} />)}</div></section>

        </div>
      </main>
    </div>
  );
}

export function CanteenOrderCard({ order }) {
  const { updateOrderStatus, collectOrder, orderActionErrors, retryOrderAction } = useOrders();
  const actionError = orderActionErrors[order.id];
  const next = { RECEIVED: ["ACCEPTED", "Accept order"], ACCEPTED: order.executionMode === 'RAZORPAY_TEST' && order.paymentStatus !== 'PAID' ? null : ["PREPARING", "Start preparing"], PREPARING: ["READY", "Mark ready"] }[order.status];
  const advance = status => { void updateOrderStatus(order.id, status, order).catch(() => {}); };
  return <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={`/canteen/orders/${order.id}`} className="text-2xl font-black tracking-wider text-[#075d50]">{orderCode(order)}</Link>
        <span className="rounded-full bg-[#e9f5ef] px-2 py-1 text-xs font-bold text-[#075d50]">{isUnpaidOrder(order) ? "Unpaid" : statusLabels[order.status]}</span>
        <span className="text-sm font-bold">₹{order.total}</span>
        {order.paymentStatus === "PAID" && <span className="inline-flex items-center gap-1 rounded-full bg-[#075d50] px-3 py-1 text-xs font-black tracking-wide text-white">✓ PAID</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!actionError && order.status === "RECEIVED" && <button onClick={() => advance("REJECTED")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700">Reject</button>}
        {!actionError && next && <button onClick={() => advance(next[0])} className="rounded-lg bg-[#075d50] px-3 py-2 text-sm font-bold text-white">{order.executionMode === 'RAZORPAY_TEST' && order.status === 'RECEIVED' ? 'Accept & request payment' : next[1]}</button>}
        {!actionError && order.status === "READY" && <button onClick={() => { void collectOrder(order.id, order).catch(() => {}); }} className="rounded-lg bg-[#075d50] px-3 py-2 text-sm font-bold text-white">Collected</button>}
        {order.status === "COLLECTED" && order.collectionFeedback && <span role="status" className="text-sm font-bold text-green-700">Order marked collected</span>}
      </div>
    </div>
    <p className="mt-1 text-xs text-gray-500">Day: {orderDay(order)} · Received <time dateTime={order.createdAt}>{orderReceivedTime(order)}</time></p>
    <p className="mt-2 text-sm text-gray-600">{order.items.map(item => `${item.name} × ${item.quantity}`).join(" · ")}</p>
    <OrderPayment order={order} staff compact />
    {order.status === "REJECTED" && !isUnpaidOrder(order) && <p className="mt-2 text-sm text-red-700">{order.closedReason === 'STUDENT_CANCELLED' ? 'Student cancelled before payment.' : 'Order rejected.'}</p>}
    {actionError && <div role="alert" className="mt-3 text-sm text-red-600"><p>{actionError.message}</p><button disabled={actionError.recovering} onClick={() => { void retryOrderAction(order.id).catch(() => {}); }} className="mt-2 rounded-lg border px-3 py-2 font-bold disabled:opacity-50">Retry update</button></div>}
  </article>;
}
