export function createIncomingOrderTracker({ notify, storage, owner }) {
  const key = `spoonateAnnouncedOrders:${owner}`;
  const seen = new Set();
  let initialized = false, baseline = -Infinity;
  return {
    observe(orders, { append = false } = {}) {
      if (!initialized) {
        try { for (const id of JSON.parse(storage?.getItem(key) || '[]')) seen.add(id); } catch { /* In-memory deduplication still works. */ }
      }
      let arrived = false;
      for (const order of orders) {
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
      try { storage?.setItem(key, JSON.stringify([...seen])); } catch { /* Storage may be unavailable or full. */ }
      if (arrived) notify(); // One chime for a batch of new orders.
    },
  };
}
