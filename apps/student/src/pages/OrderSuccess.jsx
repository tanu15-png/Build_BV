import OrderPayment from '@spoonate/portal/components/OrderPayment';
import { orderCode, orderDay, statusLabels } from "@spoonate/portal/utils/orderRules";
import { useLocation, Link, useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useOrderDetails } from "@spoonate/portal/hooks/useOrderDetails";
export default function OrderSuccess() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { order, error, loading } = useOrderDetails(params.get("id"));
  if (!order) return <div className="p-10">{error || (loading ? "Loading order…" : "Order not found.")} <Link to="/dashboard/orders">My orders</Link></div>;
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fff8e9] p-5">
      <div className="w-full max-w-xl rounded-[28px] bg-[#fffdf7] p-8 text-center shadow-card">
        <CheckCircle size={60} className="mx-auto text-green-500" /><h1 className="mt-6 text-3xl font-black">Order submitted!</h1>
        <p className="mt-2 text-gray-500">{statusLabels[order.status]}</p>
        <div className="mt-7 rounded-2xl bg-[#185c3a] p-7 text-white"><p className="text-sm text-white/60">ORDER REFERENCE</p><p className="mt-3 text-5xl font-black tracking-widest text-[#ffc565]">{orderCode(order)}</p><p className="mt-2 text-sm">Day: {orderDay(order)}</p><p className="mt-4 font-bold">{order.cafeName}</p></div>

        <OrderPayment order={order} /><p className="mt-6 text-gray-500">{order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</p>
        <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">Track this order to see when it is ready. The canteen will mark it collected when you pick up your food.</p>
        <Link to={`/dashboard/orders/${order.id}`} state={{ from: location.pathname + location.search + location.hash }} className="mt-6 block rounded-xl bg-[#287647] py-3 font-black text-white">Track order</Link>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-bold text-[#185c3a]">Back to canteens</Link>
      </div>
    </div>
  );
}
