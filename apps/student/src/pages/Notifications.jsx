import { useEffect, useRef } from 'react';
import { campusDay } from "@spoonate/portal/utils/orderRules";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrders } from "@spoonate/portal/context/OrderContext";
export default function Notifications() {
  const { notifications, unreadNotificationCount, notificationsLoading, notificationsError, notificationsInitialized, notificationsInitialLoading,
    refreshNotifications, loadMoreNotifications, markNotificationRead, markNotificationsOpened } = useOrders();
  const opened = useRef(new Set());
  useEffect(() => {
    const ids = notifications.filter(item => !item.readAt && !opened.current.has(item.id)).map(item => item.id).slice(0,100);
    if (!ids.length) return;
    ids.forEach(id => opened.current.add(id));
    void markNotificationsOpened(ids).catch(() => {});
  }, [notifications, markNotificationsOpened]);
  const read = id => { void markNotificationRead(id).catch(() => {}); };
  return <main className="mx-auto min-h-screen max-w-4xl p-5 lg:p-10">
    <Link to="/dashboard" className="text-sm font-bold text-[#287647]">← Back to dashboard</Link>
    <h1 className="mt-5 flex items-center gap-3 text-3xl font-black"><Bell className="text-[#287647]" /> Notifications</h1>
    <p className="mt-3 text-gray-500">{unreadNotificationCount} unread</p>
    {notificationsError && <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{notificationsError}{notificationsInitialized && <p className="mt-2 text-sm">Showing your last loaded notifications. Updates will resume when the connection recovers.</p>}<button onClick={() => { opened.current.clear(); void refreshNotifications(); }} className="mt-2 font-bold underline">Retry</button></div>}
    {notificationsInitialLoading && <p role="status" className="mt-5 text-gray-500">Loading notifications…</p>}
    <div className="mt-8 space-y-4">{!notifications.length && notificationsInitialized && !notificationsError ? <p className="rounded-2xl bg-[#fffdf7] p-8 text-gray-500">Acceptance, rejection and ready-for-pickup notifications will appear here.</p> : notifications.map(notification => <article key={notification.id} className={`rounded-2xl border-l-4 bg-[#fffdf7] p-5 shadow-card ${notification.readAt ? 'border-gray-200' : 'border-[#287647]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">{notification.type === 'PAYMENT_EXPIRED' ? 'Order expired · Unpaid' : notification.type === 'PAID' ? 'Payment confirmed' : notification.type === 'READY' ? 'Ready for pickup' : notification.type === 'REJECTED' ? 'Order rejected' : 'Order accepted'}</h2></div>
      <p className="mt-2 text-gray-500">{notification.message}</p><p className="mt-2 text-xs text-gray-400">{campusDay(notification.createdAt)}</p>
      <Link to={`/dashboard/orders/${notification.orderId}`} onClick={() => { if (!notification.readAt) read(notification.id); }} className="mt-4 inline-block font-bold text-[#287647]">View order →</Link>
    </article>)}</div>
    {loadMoreNotifications && <button disabled={notificationsLoading} onClick={loadMoreNotifications} className="mt-6 rounded-xl border px-4 py-3 font-bold disabled:opacity-50">Load more notifications</button>}
  </main>;
}
