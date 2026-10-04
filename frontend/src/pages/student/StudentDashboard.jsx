import { orderCode, orderDay, pickupLabel, statusLabels } from "../../utils/orderRules";
import {
  Bell,
  Clock3,
  Home,
  LogOut,
  Search,
  ShoppingBag,
  ShoppingCart,
  User,
  Utensils,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import { useOrders } from "../../context/OrderContext";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const { cart, orders, cafes, foods, notifications, addToCart, isFoodAvailable } = useOrders();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const initials = user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("");

  const navigate = useNavigate();

  const activeOrder = orders.find(
    (order) =>
      order.status !== "COLLECTED"
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#f8faf9]">

      {/* DESKTOP SIDEBAR */}

      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-[#075d50] text-white p-6 flex-col">

        <div className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 bg-[#facc15] text-[#075d50] rounded-lg flex items-center justify-center font-black">
            SA
          </div>

          <span className="text-xl font-black">
            Spoon<span className="text-[#facc15]">Ate</span>
          </span>
        </div>

        <nav className="space-y-2">

          <SidebarLink
            to="/student"
            icon={<Home size={18} />}
            text="Dashboard"
            active
          />

          <SidebarLink
            to="/student#cafes"
            icon={<Utensils size={18} />}
            text="Cafés"
          />

          <SidebarLink
            to="/student/orders"
            icon={<ShoppingBag size={18} />}
            text="My Orders"
          />

          <SidebarLink
            to="/student/notifications"
            icon={<Bell size={18} />}
            text="Notifications"
          />

          <SidebarLink
            to="/student/profile"
            icon={<User size={18} />}
            text="Profile"
          />

        </nav>

        <button
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10"
        >
          <LogOut size={18} />
          Logout
        </button>

      </aside>

      {/* MAIN */}

      <main className="lg:ml-64">

        {/* TOP BAR */}

        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-5 lg:px-10">

          <div className="relative w-full max-w-md hidden sm:block">

            <Search
              size={18}
              className="absolute left-4 top-3.5 text-gray-400"
            />

            <input
              aria-label="Search food or canteens"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search food or canteens..."
              className="w-full bg-gray-50 rounded-xl py-3 pl-11 pr-4 outline-none"
            />

          </div>

          <div className="flex items-center gap-5 ml-auto">

            <Link
              to="/student/notifications"
              className="relative"
            >
              <Bell size={22} />

              <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {notifications.length}
              </span>
            </Link>

            <Link
              to="/student/cart"
              className="relative"
            >
              <ShoppingCart size={22} />

              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-[#f59e0b] text-white text-[10px] rounded-full flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-full bg-[#d9f4ec] text-[#075d50] flex items-center justify-center font-bold">
                {initials}
              </div>

              <div className="hidden md:block">
                <p className="text-sm font-bold">
                  {user?.name}
                </p>

                <p className="text-xs text-gray-500">
                  {user?.email}
                </p>
              </div>

            </div>

            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="rounded-lg border border-gray-200 p-2 lg:hidden"
            >
              <LogOut size={18} />
            </button>

          </div>

        </header>

        {/* CONTENT */}

        <div className="p-5 lg:p-10 max-w-7xl mx-auto">

          <section className="mb-8">

            <p className="text-sm text-[#0f8f73] font-bold">
              SPOONATE
            </p>

            <h1 className="text-3xl lg:text-4xl font-black mt-1">
              Good evening, {user?.name?.split(" ")[0]} 👋
            </h1>

            <p className="text-gray-500 mt-2">
              What are you craving today?
            </p>

          </section>

          {/* ACTIVE ORDER */}

          {activeOrder && (
            <section className="bg-[#075d50] text-white rounded-[28px] p-6 lg:p-8 mb-10 shadow-card">

              <div className="flex flex-wrap justify-between gap-5">

                <div>

                  <p className="text-sm text-white/60 uppercase font-bold">
                    Active Order
                  </p>

                  <div className="flex items-center gap-4 mt-2">

                    <span className="text-4xl font-black tracking-widest text-[#facc15]">
                      {orderCode(activeOrder)}
                    </span>

                    <span className="px-3 py-1 rounded-full bg-orange-400/20 text-orange-300 text-sm font-bold">
                      {statusLabels[activeOrder.status]}
                    </span>

                  </div>

                  <p className="mt-2 text-sm text-white/70">Day: {orderDay(activeOrder)}</p>

                  <p className="mt-3 font-semibold">
                    {activeOrder.cafeName}
                  </p>

                  <p className="text-white/60 text-sm mt-1">
                    {activeOrder.items
                      .map(
                        (item) =>
                          `${item.name} × ${item.quantity}`
                      )
                      .join(" • ")}
                  </p>

                </div>

                <div className="flex flex-col items-start lg:items-end gap-2">

                  <div className="flex items-center gap-2 text-white/70">
                    <Clock3 size={16} />
                    Expected arrival
                  </div>

                  <p className="text-2xl font-black">
                    {pickupLabel(activeOrder)}
                  </p>

                  <Link
                    to={`/student/orders/${orderCode(activeOrder)}`}
                    className="mt-2 bg-[#facc15] text-[#075d50] px-5 py-2.5 rounded-xl font-bold"
                  >
                    Track Order
                  </Link>

                </div>

              </div>

            </section>
          )}

          {/* CAFES */}

          <SectionHeader
            title="Banasthali Canteens"
            action="View all"
            link="/student#cafes"
          />

          <div id="cafes" className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-12 scroll-mt-5">

            {cafes.filter((cafe) => !query || cafe.name.toLowerCase().includes(query) || foods.some((food) => food.cafeId === cafe.id && food.name.toLowerCase().includes(query))).map((cafe) => (
              <div
                key={cafe.id}
                className="bg-white rounded-2xl overflow-hidden shadow-card"
              >

                <img
                  src={cafe.image}
                  className="h-40 w-full object-cover"
                />

                <div className="p-5">

                  <div className="flex justify-between items-start">

                    <h3 className="font-black text-lg">
                      {cafe.name}
                    </h3>

                    <span
                      className={`text-xs font-bold ${
                        cafe.status === "Open"
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      ● {cafe.status}
                    </span>

                  </div>

                  <p className="text-sm text-gray-500 mt-2">
                    {cafe.categories.join(" • ")}
                  </p>

                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-3">
                    <Clock3 size={15} />
                    {cafe.preparationTime}
                  </div>

                  <Link
                    to={`/student/cafe/${cafe.id}`}
                    className="block text-center mt-4 bg-[#0f8f73] text-white rounded-xl py-2.5 font-bold"
                  >
                    View Menu
                  </Link>

                </div>

              </div>
            ))}

          </div>

          {/* POPULAR */}

          <SectionHeader
            title="Sample menu highlights"
            action="Browse cafés"
            link="/student#cafes"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5 pb-20">

            {foods.filter((food) => query ? food.name.toLowerCase().includes(query) || cafes.find((cafe) => cafe.id === food.cafeId)?.name.toLowerCase().includes(query) : food.id.endsWith("-maggi")).map((food) => (
              <div
                key={food.id}
                className="bg-white rounded-2xl overflow-hidden shadow-card"
              >

                <img
                  src={food.image}
                  className="w-full aspect-square object-cover"
                />

                <div className="p-4">

                  <h3 className="font-bold">
                    {food.name}
                  </h3>

                  <p className="mt-1 text-xs text-gray-500">{cafes.find((cafe) => cafe.id === food.cafeId)?.name}</p>
                  <p className="text-[#0f8f73] font-black mt-2">
                    ₹{food.price}
                  </p>

                  <button
                    disabled={!isFoodAvailable(food)}
                    onClick={() => addToCart(food)}
                    className="w-full mt-3 border border-[#0f8f73] text-[#0f8f73] rounded-lg py-2 text-sm font-bold hover:bg-[#0f8f73] hover:text-white"
                  >
                    {isFoodAvailable(food) ? "Add" : "Unavailable"}
                  </button>

                </div>

              </div>
            ))}

          </div>

        </div>

      </main>

      {/* MOBILE NAV */}

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex justify-around items-center z-50">

        <MobileLink
          to="/student"
          icon={<Home size={19} />}
          text="Home"
        />

        <MobileLink
          to="/student#cafes"
          icon={<Utensils size={19} />}
          text="Cafés"
        />

        <MobileLink
          to="/student/orders"
          icon={<ShoppingBag size={19} />}
          text="Orders"
        />

        <MobileLink
          to="/student/notifications"
          icon={<Bell size={19} />}
          text="Alerts"
        />

        <MobileLink
          to="/student/profile"
          icon={<User size={19} />}
          text="Profile"
        />

      </div>

    </div>
  );
}

function SidebarLink({
  to,
  icon,
  text,
  active,
}) {
  if (to.includes("#")) {
    return (
      <a href={to} className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white">
        {icon}<span className="font-semibold">{text}</span>
      </a>
    );
  }
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
        active
          ? "bg-white text-[#075d50]"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      <span className="font-semibold">
        {text}
      </span>
    </Link>
  );
}

function MobileLink({ to, icon, text }) {
  if (to.includes("#")) {
    return <a href={to} className="flex flex-col items-center gap-1 text-xs text-gray-500">{icon}{text}</a>;
  }
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 text-gray-500 text-xs"
    >
      {icon}
      {text}
    </Link>
  );
}

function SectionHeader({
  title,
  action,
  link,
}) {
  return (
    <div className="flex items-center justify-between mb-5">

      <h2 className="text-2xl font-black">
        {title}
      </h2>

      <a
        href={link}
        className="text-[#0f8f73] font-bold text-sm"
      >
        {action} →
      </a>

    </div>
  );
}
