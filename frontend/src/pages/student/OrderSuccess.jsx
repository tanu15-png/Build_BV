import { orderCode, orderDay, pickupLabel } from "../../utils/orderRules";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useOrders } from "../../context/OrderContext";
export default function OrderSuccess() {
  const [params] = useSearchParams();
  const { orders } = useOrders();
  const order = orders.find((item) => item.id === params.get("id"));
  if (!order) return <div className="p-10">Order not found. <Link to="/student/orders">My orders</Link></div>;
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8faf9] p-5">
      <div className="w-full max-w-xl rounded-[28px] bg-white p-8 text-center shadow-card">
        <CheckCircle size={60} className="mx-auto text-green-500" /><h1 className="mt-6 text-3xl font-black">Order submitted!</h1>
        <p className="mt-2 text-gray-500">Your order is awaiting canteen acceptance.</p>
        <div className="mt-7 rounded-2xl bg-[#075d50] p-7 text-white"><p className="text-sm text-white/60">PICKUP CODE</p><p className="mt-3 text-5xl font-black tracking-widest text-[#facc15]">{orderCode(order)}</p><p className="mt-2 text-sm">Day: {orderDay(order)}</p><p className="mt-4 font-bold">{order.cafeName}</p></div>
        <p className="mt-6 text-gray-500">{order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</p>
        <p className="mt-4 font-bold">Estimated pickup: {pickupLabel(order)}</p>
        <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">The canteen will notify you when your order is prepared. Show your dated order card to staff at pickup.</p>
        <Link to={`/student/orders/${order.id}`} className="mt-6 block rounded-xl bg-[#0f8f73] py-3 font-black text-white">Track order</Link>
        <Link to="/student" className="mt-4 inline-block text-sm font-bold text-[#075d50]">Back to canteens</Link>
      </div>
    </div>
  );
}
