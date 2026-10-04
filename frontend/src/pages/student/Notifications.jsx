import { formatCampusTimestamp } from "../../utils/orderRules";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrders } from "../../context/OrderContext";
export default function Notifications() {
  const { notifications } = useOrders();
  return (
    <main className="mx-auto min-h-screen max-w-4xl p-5 lg:p-10">
      <Link to="/student" className="text-sm font-bold text-[#0f8f73]">← Back to dashboard</Link>
      <h1 className="mt-5 flex items-center gap-3 text-3xl font-black"><Bell className="text-[#0f8f73]" /> Notifications</h1>
      <div className="mt-8 space-y-4">{notifications.length === 0 ? <p className="rounded-2xl bg-white p-8 text-gray-500">Acceptance and ready-for-pickup notifications will appear here.</p> : notifications.map((notification) => <article key={notification.id} className="rounded-2xl border-l-4 border-[#0f8f73] bg-white p-5 shadow-card"><h2 className="font-black">{notification.title}</h2><p className="mt-2 text-gray-500">{notification.message}</p><p className="mt-2 text-xs text-gray-400">{formatCampusTimestamp(notification.at)} IST</p><Link to={`/student/orders/${notification.orderId}`} className="mt-4 inline-block font-bold text-[#0f8f73]">View order →</Link></article>)}</div>
    </main>
  );
}
