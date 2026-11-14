export function createIncomingOrderTracker({ notify, storage, owner }) {
  const key = `spoonateAnnouncedOrders:${owner}`;
  const seen = new Set();
  const paidSeen = new Set();
  let initialized = false, baseline = -Infinity;
  return {
    observe(orders, { append = false } = {}) {
      if (!initialized) {
        try { for (const id of JSON.parse(storage?.getItem(key) || '[]')) seen.add(id); } catch { /* In-memory deduplication still works. */ }
        try { for (const id of JSON.parse(storage?.getItem(key + ':paid') || '[]')) paidSeen.add(id); } catch { /* Same fallback for payment announcements. */ }
      }
      let arrived = false;
      for (const order of orders) {
        if (initialized && !append && seen.has(order.id) && order.paymentStatus === 'PAID' && !paidSeen.has(order.id)) arrived = true;
        if (order.paymentStatus === 'PAID') paidSeen.add(order.id);
        const created = Date.parse(order.createdAt);
        if (initialized && !append && !seen.has(order.id) && order.status === 'RECEIVED' && Number.isFinite(created) && created >= baseline) arrived = true;
        seen.add(order.id);
      }
      if (!initialized && !append) {
        baseline = Math.max(-Infinity, ...orders.map(order => Date.parse(order.createdAt)).filter(Number.isFinite));
        initialized = true;
      }
      // Bound storage without retaining names, prices, or order contents.
      while (seen.size > 2000) seen.delete(seen.values().next().value);
      while (paidSeen.size > 2000) paidSeen.delete(paidSeen.values().next().value);
      try { storage?.setItem(key, JSON.stringify([...seen])); } catch { /* Storage may be unavailable or full. */ }
      try { storage?.setItem(key + ':paid', JSON.stringify([...paidSeen])); } catch { /* Payment deduplication remains in memory. */ }
      if (arrived) notify(); // One chime for a batch of new orders.
    },
  };
}
