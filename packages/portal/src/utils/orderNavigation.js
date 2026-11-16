const destinations = {
  '/dashboard': 'Dashboard',
  '/dashboard/orders': 'My orders',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/order-success': 'Order confirmation',
};
export function orderReturnLocation(from) {
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
    const path = from.split(/[?#]/)[0];
    if (destinations[path]) return { to: from, label: destinations[path] };
  }
  return { to: '/dashboard/orders', label: 'My orders' };
}
