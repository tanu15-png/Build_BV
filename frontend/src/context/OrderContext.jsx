/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useRemoteOrders } from '../hooks/useRemoteOrders';
import { useNotifications } from '../hooks/useNotifications';
import { useCatalogCart } from '../hooks/useCatalogCart';
const OrderContext = createContext();
export function OrderProvider({ children }) {
  const { user, refreshSession } = useAuth();
  const remote = useCatalogCart(user);
  const notifications = useNotifications(user, refreshSession);
  const serverOrders = useRemoteOrders(user, remote.cafes, remote.refreshCatalog, notifications.refreshNotifications, refreshSession);
  const [notice, setNotice] = useState(null);
  const noticeOwner = user ? `${user.id}:${user.role}:${user.canteenId || ''}` : '';
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(timer);
  }, [notice]);
  const { orders } = serverOrders;
  const isFoodAvailable = food => !remote.catalogError && !food.archived && food.available && remote.cafes.some(c => c.id === food.cafeId && c.status === 'Open');
  const performCart = async (action, message) => {
    try { await action(); if (message) setNotice({ message, owner: noticeOwner }); return true; }
    catch (error) { setNotice({ message: error.message, owner: noticeOwner }); return false; }
  };
  const toggleOrders = async () => {
    const cafe = remote.cafes.find(c => c.databaseId === user?.canteenId);
    if (!cafe || user?.role !== 'canteen') throw new Error('Refresh your canteen and retry.');
    await remote.manage(`/canteens/${cafe.databaseId}/availability`, 'PATCH', { expectedVersion: cafe.version, acceptingOrders: !cafe.acceptingOrders });
  };
  const toggleFood = async id => {
    const food = remote.foods.find(f => f.id === id);
    if (!food || user?.role !== 'canteen' || food.canteenId !== user.canteenId) throw new Error('You can only manage your own menu.');
    await remote.manage(`/menu-items/${id}`, 'PATCH', { expectedVersion: food.version, available: !food.available });
  };
  return <OrderContext.Provider value={{ ...remote, ...serverOrders, ...notifications, orders, isFoodAvailable,
    availability: { disabledFoods: remote.foods.filter(f => !f.available).map(f => f.id) },
    addToCart: food => performCart(() => remote.addItem(food.id), `${food.name} added to your cart.`),
    updateQuantity: (id, quantity) => performCart(() => remote.changeQuantity(id, quantity)),
    removeFromCart: id => performCart(() => remote.changeQuantity(id, 0)),
    clearCart: () => performCart(remote.clearServerCart), toggleOrders, toggleFood,
  }}>
    {user && <p role="status" className="relative z-50 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">Test mode: orders are shared across devices. No payment is collected.</p>}
    {user && remote.catalogError && <div role="alert" className="relative z-50 bg-red-50 p-3 text-center text-red-800">{remote.catalogError} <button onClick={remote.refreshCatalog} className="ml-3 font-bold underline">Refresh menus and cart</button></div>}
    {user && serverOrders.ordersError && <div role="alert" className="relative z-50 bg-red-50 p-3 text-center text-red-800">{serverOrders.ordersError} <button onClick={() => serverOrders.refreshOrders()} className="ml-3 font-bold underline">Refresh orders</button></div>}
    {children}
    {notice && notice.owner === noticeOwner && <div role="status" className="fixed bottom-20 left-5 right-5 z-50 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl bg-[#075d50] p-4 text-white shadow-xl"><p>{notice.message}</p><button aria-label="Dismiss message" onClick={() => setNotice(null)} className="rounded border border-white/30 px-3 py-1">Close</button></div>}
  </OrderContext.Provider>;
}
export function useOrders() { return useContext(OrderContext); }
