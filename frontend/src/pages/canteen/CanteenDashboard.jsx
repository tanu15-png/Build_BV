import { orderCode, orderDay, pickupLabel } from "../../utils/orderRules";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, LogOut, Store } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useOrders } from "../../context/OrderContext";
import { statusLabels } from "../../utils/orderRules";

export default function CanteenDashboard() {
  const { user, logout } = useAuth();
  const { orders, cafes, toggleOrders, ordersLoading, loadMoreOrders } = useOrders();
  const navigate = useNavigate();
  const cafe = cafes.find((item) => item.id === user.cafeId);
  const active = orders.filter((order) => order.status !== "COLLECTED")
    .sort((a, b) => new Date(a.pickupAt) - new Date(b.pickupAt));
  const [error, setError] = useState("");
  const perform = async (action) => { try { await action(); setError(""); } catch (issue) { setError(issue.message); } };
  const handleLogout = () => { void perform(async () => { await logout(); navigate("/login", { replace: true }); }); };
  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#075d50] p-6 text-white lg:flex">
        <p className="text-2xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p><p className="mt-2 text-sm text-white/60">Canteen management</p>
        <nav className="mt-10 space-y-3" aria-label="Canteen navigation"><Link to="/canteen" className="block rounded-xl bg-white px-4 py-3 font-bold text-[#075d50]">Dashboard</Link><Link to="/canteen/orders" className="block px-4 py-3">All orders</Link><Link to="/canteen/menu" className="block px-4 py-3">Manage menu</Link><Link to="/canteen/members" className="block px-4 py-3">Members</Link></nav>
        <button onClick={handleLogout} className="mt-auto flex items-center gap-2 px-4 py-3"><LogOut size={18} /> Logout</button>
      </aside>
      <main className="lg:ml-64">
        <header className="border-b border-gray-100 bg-white p-5 lg:px-10"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold text-[#0f8f73]">CANTEEN DASHBOARD</p><h1 className="mt-2 text-3xl font-black">{cafe?.name}</h1><p className="mt-2 text-gray-500">Review incoming orders and verify student pickup.</p></div><button onClick={handleLogout} className="rounded-xl border px-4 py-2 lg:hidden">Logout</button></div><nav className="mt-4 flex gap-5 text-sm font-bold text-[#075d50] lg:hidden"><Link to="/canteen/orders">All orders</Link><Link to="/canteen/menu">Manage menu</Link><Link to="/canteen/members">Members</Link></nav></header>
        <div className="mx-auto max-w-7xl space-y-8 p-5 lg:p-10">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm"><div><h2 className="flex items-center gap-2 text-xl font-black"><Store size={20} /> Incoming orders</h2><p className="mt-2 text-gray-500">{cafe?.status === "Paused" ? "New orders are paused. Continue fulfilling existing orders." : "Your canteen is accepting new orders."}</p></div><button onClick={() => perform(toggleOrders)} className="rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white">{cafe?.status === "Paused" ? "Resume orders" : "Pause incoming orders"}</button></section>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[
            ["Awaiting acceptance", orders.filter((order) => order.status === "RECEIVED").length],
            ["Preparing", orders.filter((order) => ["ACCEPTED", "PREPARING"].includes(order.status)).length],
            ["Ready for pickup", orders.filter((order) => order.status === "READY").length],
            ["Collected", orders.filter((order) => order.status === "COLLECTED").length],
          ].map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}</div>
          <section><h2 className="text-2xl font-black">Active orders</h2>{ordersLoading && <p role="status">Refreshing orders…</p>}{loadMoreOrders && <button onClick={loadMoreOrders} className="mt-3 font-bold underline">Load more orders</button>}<p className="mt-2 text-gray-500">Sorted by the student's estimated pickup time.</p><div className="mt-5 space-y-4">{active.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center"><ClipboardList className="mx-auto text-gray-300" size={36} /><p className="mt-4 font-bold">No active orders</p></div> : active.map((order) => <CanteenOrderCard key={order.id} order={order} />)}</div></section>

        </div>
      </main>
    </div>
  );
}

export function CanteenOrderCard({ order }) {
  const { updateOrderStatus, collectOrder, pendingCollection, orderBusy } = useOrders();
  const [pickupCode, setPickupCode] = useState("");
  const retry = pendingCollection(order.id);
  const [error, setError] = useState("");
  const next = { RECEIVED: ["ACCEPTED", "Accept order"], ACCEPTED: ["PREPARING", "Start preparing"], PREPARING: ["READY", "Mark ready"] }[order.status];
  const advance = async (status) => {
    try { await updateOrderStatus(order.id, status, order); setError(""); }
    catch (issue) { setError(issue.message); }
  };
  return <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><Link to={`/canteen/orders/${order.id}`} className="text-3xl font-black tracking-widest text-[#075d50]">{orderCode(order)}</Link><p className="mt-2 text-sm text-gray-500">Day: {orderDay(order)} · {order.cafeName}</p><p className="mt-2 text-sm font-bold text-[#0f8f73]">{statusLabels[order.status]}</p><p className="mt-3 text-gray-600">{order.items.map((item) => `${item.name} × ${item.quantity}`).join(" · ")}</p><p className="mt-2 text-sm text-gray-500">{order.studentName} · Estimated pickup {pickupLabel(order)}</p><p className="mt-2 font-bold">Order value: ₹{order.total}</p></div><div>
      {next && <button disabled={orderBusy} onClick={() => advance(next[0])} className="rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white">{next[1]}</button>}
      {(order.status === "READY" || retry) && <form className="mt-3 max-w-xs" onSubmit={async event => {
        event.preventDefault(); setError('');
        try { await collectOrder(order.id, pickupCode, order); setPickupCode(''); }
        catch (issue) { setError(issue.status === 429 && issue.details?.retryAfterSeconds ? `${issue.message} Try again in about ${Math.ceil(issue.details.retryAfterSeconds / 60)} min.` : issue.message); }
      }}>
        <p className="mb-3 text-sm text-gray-600">{retry ? 'A previous verification was not confirmed. Retry to check its result.' : 'Check the student’s name, order reference, day and items before handing over food.'}</p>
        <fieldset disabled={orderBusy}>
          {!retry && <label className="block text-sm font-bold">Student’s pickup code (1–100)<input required type="text" inputMode="numeric" autoComplete="off" pattern="([1-9][0-9]?|100)" maxLength={3} value={pickupCode} onChange={event => setPickupCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))} className="mt-2 w-full rounded-xl border px-4 py-3 text-xl tracking-widest" /></label>}
          <button className="mt-3 w-full rounded-xl bg-[#075d50] px-5 py-3 font-bold text-white disabled:opacity-50">{orderBusy ? 'Verifying…' : retry ? 'Retry pickup verification' : 'Verify pickup & mark collected'}</button>
        </fieldset>
      </form>}
      {order.status === "COLLECTED" && <p className="font-bold text-green-700">Pickup verified{order.collectedAt ? ` · ${new Date(order.collectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST` : ""}</p>}
    </div></div>{error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
  </article>;
}
