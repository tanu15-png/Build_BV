import { formatCampusTimestamp } from "../../utils/orderRules";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrders } from "../../context/OrderContext";
export default function Notifications() {
  const { notifications, unreadNotificationCount, notificationsLoading, notificationsError,
    refreshNotifications, loadMoreNotifications, markNotificationRead, readingNotificationIds } = useOrders();
  const read = id => { void markNotificationRead(id).catch(() => {}); };
  return <main className="mx-auto min-h-screen max-w-4xl p-5 lg:p-10">
    <Link to="/student" className="text-sm font-bold text-[#0f8f73]">← Back to dashboard</Link>
    <h1 className="mt-5 flex items-center gap-3 text-3xl font-black"><Bell className="text-[#0f8f73]" /> Notifications</h1>
    <p className="mt-3 text-gray-500">{unreadNotificationCount} unread</p>
    {notificationsError && <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{notificationsError}<button onClick={refreshNotifications} className="ml-3 font-bold underline">Retry</button></div>}
    {notificationsLoading && <p role="status" className="mt-5 text-gray-500">Refreshing notifications…</p>}
    <div className="mt-8 space-y-4">{!notifications.length && !notificationsLoading && !notificationsError ? <p className="rounded-2xl bg-white p-8 text-gray-500">Acceptance and ready-for-pickup notifications will appear here.</p> : notifications.map(notification => <article key={notification.id} className={`rounded-2xl border-l-4 bg-white p-5 shadow-card ${notification.readAt ? 'border-gray-200' : 'border-[#0f8f73]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">{notification.type === 'READY' ? 'Ready for pickup' : 'Order accepted'}</h2>{notification.readAt ? <span className="text-sm text-gray-500">Read</span> : <button disabled={readingNotificationIds.includes(notification.id)} onClick={() => read(notification.id)} className="rounded-xl border px-3 py-2 text-sm font-bold text-[#075d50] disabled:opacity-50">{readingNotificationIds.includes(notification.id) ? 'Saving…' : 'Mark as read'}</button>}</div>
      <p className="mt-2 text-gray-500">{notification.message}</p><p className="mt-2 text-xs text-gray-400">{formatCampusTimestamp(notification.createdAt)} IST</p>
      <Link to={`/student/orders/${notification.orderId}`} onClick={() => { if (!notification.readAt) read(notification.id); }} className="mt-4 inline-block font-bold text-[#0f8f73]">View order →</Link>
    </article>)}</div>
    {loadMoreNotifications && <button disabled={notificationsLoading} onClick={loadMoreNotifications} className="mt-6 rounded-xl border px-4 py-3 font-bold disabled:opacity-50">Load more notifications</button>}
  </main>;
}
