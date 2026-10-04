import { orderCode, orderDay, pickupLabel } from "../../utils/orderRules";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useOrders } from "../../context/OrderContext";
import { statusLabels } from "../../utils/orderRules";

const statusStyles = {
  RECEIVED: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-blue-50 text-blue-700",
  PREPARING: "bg-amber-50 text-amber-700",
  READY: "bg-green-50 text-green-700",
  COLLECTED: "bg-gray-100 text-gray-600",
};

const currency = (amount) => `₹${amount.toLocaleString("en-IN")}`;

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { orders, cafes, foods } = useOrders();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [cafeId, setCafeId] = useState("ALL");

  const activeOrders = orders.filter(
    (order) => order.status !== "COLLECTED"
  );
  const revenue = orders
    .filter((order) => order.status === "COLLECTED")
    .reduce((sum, order) => sum + order.total, 0);
  const query = search.trim().toLowerCase();
  const filteredOrders = orders
    .filter((order) => {
      const searchable = [
        orderCode(order),
        orderDay(order),
        order.cafeName,
        ...order.items.map((item) => item.name),
      ].join(" ").toLowerCase();
      return (
        (status === "ALL" || order.status === status) &&
        (cafeId === "ALL" || order.cafeId === cafeId) &&
        searchable.includes(query)
      );
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#075d50] p-6 text-white lg:flex">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#facc15] font-black text-[#075d50]">SA</div>
          <div>
            <p className="text-xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p>
            <p className="text-xs text-white/60">Administration</p>
          </div>
        </div>
        <nav aria-label="Admin navigation" className="space-y-2">
          <a href="#overview" className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-[#075d50]">
            <LayoutDashboard size={18} /> Overview
          </a>
          <a href="#cafes" className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-white/10">
            <Store size={18} /> Cafés
          </a>
          <a href="#orders" className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-white/10">
            <ClipboardList size={18} /> All orders
          </a>
        </nav>
        <button onClick={handleLogout} className="mt-auto flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-white/10">
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <main className="lg:ml-64">
        <header id="overview" className="border-b border-gray-100 bg-white px-5 py-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-[#0f8f73]"><ShieldCheck size={16} /> CAMPUS ADMINISTRATION</p>
              <h1 className="mt-2 text-3xl font-black">Admin Dashboard</h1>
              <p className="mt-2 text-gray-500">Welcome, {user?.name}. Monitor orders and cafés across campus.</p>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 font-semibold lg:hidden">
              <LogOut size={18} /> Logout
            </button>
          </div>
          <nav aria-label="Admin sections" className="mt-5 flex flex-wrap gap-4 text-sm font-bold text-[#075d50] lg:hidden">
            <a href="#overview">Overview</a><a href="#cafes">Cafés</a><a href="#orders">All orders</a>
          </nav>
        </header>

        <div className="mx-auto max-w-7xl space-y-10 p-5 lg:p-10">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={<Store />} label="Campus cafés" value={cafes.length} />
            <StatCard icon={<ClipboardList />} label="Total orders" value={orders.length} />
            <StatCard icon={<LayoutDashboard />} label="Active orders" value={activeOrders.length} />
            <StatCard icon={<IndianRupee />} label="Collected order value" value={currency(revenue)} />
          </div>

          <section id="cafes" className="scroll-mt-5">
            <h2 className="text-2xl font-black">Campus cafés</h2>
            <p className="mt-2 text-gray-500">Café directory and order activity.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {cafes.map((cafe) => {
                const cafeOrders = orders.filter((order) => order.cafeId === cafe.id);
                return (
                  <article key={cafe.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="text-lg font-black">{cafe.name}</h3><p className="mt-1 text-sm text-gray-500">{cafe.location}</p></div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${cafe.status === "Open" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{cafe.status}</span>
                    </div>
                    <p className="mt-4 text-sm text-gray-500">{cafe.categories.join(" · ")}</p>
                    <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-gray-100 pt-4 text-sm">
                      <span><strong>{foods.filter((food) => food.cafeId === cafe.id).length}</strong> menu items</span>
                      <span><strong>{cafeOrders.length}</strong> orders</span>
                      <a href="#orders" onClick={() => { setCafeId(cafe.id); setStatus("ALL"); setSearch(""); }} className="font-bold text-[#0f8f73]">View orders →</a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="orders" className="scroll-mt-5">
            <h2 className="text-2xl font-black">All campus orders</h2>
            <p className="mt-2 text-gray-500">Review order items, pickup times, and progress across cafés.</p>
            <div className="mt-5 flex flex-col gap-3 xl:flex-row">
              <label className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <Search size={18} className="shrink-0 text-gray-400" />
                <span className="sr-only">Search orders</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pickup code, day, canteen, or food" className="min-w-0 w-full bg-transparent outline-none" />
              </label>
              <select aria-label="Filter by café" value={cafeId} onChange={(event) => setCafeId(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <option value="ALL">All cafés</option>
                {cafes.map((cafe) => <option key={cafe.id} value={cafe.id}>{cafe.name}</option>)}
              </select>
              <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <option value="ALL">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <p aria-live="polite" className="my-4 text-sm text-gray-500">Showing {filteredOrders.length} of {orders.length} orders</p>
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                <ClipboardList size={36} className="mx-auto text-gray-300" />
                <h3 className="mt-4 text-xl font-black">{orders.length === 0 ? "No orders yet" : "No matching orders"}</h3>
                <p className="mt-2 text-gray-500">{orders.length === 0 ? "Student orders will appear here once they are placed." : "Try a different search or filter."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Campus orders, newest first</caption>
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>{["Order", "Café", "Items", "Pickup", "Total", "Status"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap p-4 font-semibold">{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-t border-gray-100">
                        <td className="p-4"><p className="font-black">#{orderCode(order)}</p><p className="mt-1 whitespace-nowrap text-xs text-gray-500">{orderDay(order)}</p></td>
                        <td className="p-4">{order.cafeName}</td>
                        <td className="min-w-48 p-4 text-gray-500">{order.items.map((item) => `${item.name} × ${item.quantity}`).join(" · ")}</td>
                        <td className="whitespace-nowrap p-4">{pickupLabel(order)}</td>
                        <td className="whitespace-nowrap p-4 font-bold">{currency(order.total)}</td>
                        <td className="p-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusStyles[order.status] || "bg-gray-100 text-gray-600"}`}>{statusLabels[order.status] || order.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="text-[#0f8f73]">{icon}</div>
      <p className="mt-4 text-sm text-gray-500">{label}</p>
      <p className="mt-1 break-words text-2xl font-black">{value}</p>
    </div>
  );
}
