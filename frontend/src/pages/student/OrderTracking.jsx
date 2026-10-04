import { orderCode, orderDay, pickupLabel } from "../../utils/orderRules";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Circle } from "lucide-react";
import { useOrders } from "../../context/OrderContext";
import { orderStatuses, statusLabels } from "../../utils/orderRules";
export default function OrderTracking() {
  const { orderId } = useParams();
  const { orders } = useOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order) return <div className="p-10">Order not found. <Link to="/student/orders">My orders</Link></div>;
  const currentIndex = orderStatuses.indexOf(order.status);
  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <header className="border-b bg-white p-5"><Link to="/student/orders" className="flex items-center gap-2 text-gray-500"><ArrowLeft size={18} /> My orders</Link></header>
      <main className="mx-auto max-w-3xl p-5 lg:p-10">
        <h1 className="text-3xl font-black">Track order</h1>
        <div className="mt-8 rounded-[28px] bg-[#075d50] p-8 text-center text-white"><p className="text-sm text-white/60">PICKUP CODE</p><p className="mt-3 text-5xl font-black tracking-widest text-[#facc15]">{orderCode(order)}</p><p className="mt-2 text-sm">Day: {orderDay(order)}</p><p className="mt-5 font-bold">{order.cafeName}</p></div>
        <div className="mt-6 rounded-2xl bg-white p-8 shadow-card">
          <p className="text-sm text-gray-500">Estimated pickup</p><p className="mt-1 text-xl font-black">{pickupLabel(order)}</p>
          <p className="mt-5 text-gray-500">{order.items.map((item) => `${item.name} × ${item.quantity}`).join(" · ")}</p>
          <div className="mt-8 space-y-4">{orderStatuses.map((status, index) => <div key={status} className="flex items-center gap-4"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${index <= currentIndex ? "bg-[#0f8f73] text-white" : "bg-gray-100 text-gray-400"}`}>{index <= currentIndex ? <Check size={18} /> : <Circle size={16} />}</span><div><p className="font-bold">{statusLabels[status]}</p>{status === order.status && <p className="text-sm text-[#0f8f73]">Current status</p>}</div></div>)}</div>
          {order.status === "READY" && <p role="status" className="mt-8 rounded-xl bg-green-50 p-5 font-bold text-green-700">Your order is prepared. Show your dated order card with code {orderCode(order)} to canteen staff so they can verify pickup.</p>}
          {order.status === "COLLECTED" && <p className="mt-8 rounded-xl bg-green-50 p-5 font-bold text-green-700">Pickup verified by the canteen. Enjoy your food!</p>}
        </div>
      </main>
    </div>
  );
}
