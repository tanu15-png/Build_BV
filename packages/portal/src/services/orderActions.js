export function createOrderActions({ api, storage, actorId, uuid = () => crypto.randomUUID() }) {
  const checkoutKey = 'spoonateCheckout:' + actorId;
  const read = key => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
  const uncertain = issue => !issue.status || issue.status >= 500 || [401, 403, 408, 429].includes(issue.status);
  async function execute(key, path, body, collection = false) {
    if (!actorId) throw new Error('Sign in before managing orders.');
    let request = read(key);
    if (!request) {
      request = { idempotencyKey: uuid(), body };
      storage.setItem(key, JSON.stringify(request)); // Persist before sending, including across refresh/reconnect.
    }
    try {
      const result = await api(path, { method: 'POST', body: request.body, idempotencyKey: request.idempotencyKey, signal: AbortSignal.timeout(45000) });
      if (!result?.id || !result?.status) throw new Error('The order response could not be confirmed. Retry the same request.');
      storage.removeItem(key);
      return result;
    } catch (issue) {
      if (!uncertain(issue) || (collection && issue.status === 429)) storage.removeItem(key);
      throw issue;
    }
  }
  return {
    pendingCheckout: () => read(checkoutKey),
    checkout: body => execute(checkoutKey, '/orders', body),
    pendingCollection: id => read('spoonateOrderCommand:' + actorId + ':' + id + ':collect-v2'),
    collect: order => execute('spoonateOrderCommand:' + actorId + ':' + order.id + ':collect-v2',
      '/orders/' + order.id + '/collect', { expectedVersion: order.version }, true),
    transition(order, nextStatus) {
      const action = { REJECTED: 'reject', ACCEPTED: 'accept', PREPARING: 'prepare', READY: 'ready' }[nextStatus];
      if (!action) throw new Error('Use the collection action to mark an order collected.');
      return execute('spoonateOrderCommand:' + actorId + ':' + order.id + ':' + action,
        '/orders/' + order.id + '/' + action, { expectedVersion: order.version });
    },
  };
}
export function mapOrder(order, cafes = []) {
  return { ...order, cafeId: cafes.find(c => c.databaseId === order.canteenId)?.id,
    cafeName: order.canteenName, total: order.totalPaise / 100,
    items: order.items.map(line => ({ ...line, price: line.unitPricePaise / 100 })),
    history: order.events.map(event => ({ status: event.newStatus, at: event.createdAt })),
  };
}
