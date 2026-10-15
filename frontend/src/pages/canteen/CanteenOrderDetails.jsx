import { Link, useParams } from "react-router-dom";
import { useOrderDetails } from "../../hooks/useOrderDetails";
import { CanteenOrderCard } from "./CanteenDashboard";
export default function CanteenOrderDetails() {
  const { orderId } = useParams();
  const { order, error, loading } = useOrderDetails(orderId);
  return <main className="mx-auto min-h-screen max-w-4xl p-5 lg:p-10"><Link to="/canteen/orders" className="font-bold text-[#0f8f73]">← All orders</Link><h1 className="my-6 text-3xl font-black">Order details</h1>{order ? <CanteenOrderCard order={order} /> : <p role="status">{error || (loading ? "Loading order…" : "Order not found for your canteen.")}</p>}</main>;
}
