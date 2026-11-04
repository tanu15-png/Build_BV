// Serialize writes against the latest confirmed cart, including clicks before it loads.
export function createCartQueue({ request, changed, failed = () => {} }) {
  let cart = null;
  let lastConfirmed = null;
  let loading = null;
  let running = false;
  let disposed = false;
  const operations = [];
  const sessionError = () => new Error('Your session changed. Reload your cart.');
  const visibleCart = () => {
    let visible = cart || lastConfirmed;
    for (const op of operations) {
      // A newly loaded server cart can invalidate a queued draft (for example,
      // another device selected a different canteen). Its turn will reject it.
      if (op.project) { try { visible = op.project(visible); } catch { /* Show the confirmed cart until this operation is checked. */ } }
    }
    return visible;
  };
  const emit = () => { if (!disposed) changed({ cart: visibleCart(), pending: operations.length }); };
  async function load(refresh = false) {
    if (disposed) throw sessionError();
    if (loading) return loading;
    if (cart && (!refresh || operations.length)) return cart;
    loading = request('/cart').then(result => {
      if (disposed) throw sessionError();
      cart = result; lastConfirmed = result; emit(); return cart;
    }).finally(() => { loading = null; });
    return loading;
  }
  async function pump() {
    if (running || disposed) return;
    running = true;
    try {
      while (operations.length && !disposed) {
        const op = operations[0];
        try {
          await load();
          if (disposed) break;
          op.project?.(cart);
          const { path, method, values = {} } = op.build(cart);
          const result = await request(path, { method, body: { ...values, expectedVersion: cart.version } });
          if (disposed) break;
          cart = result; lastConfirmed = result;
          operations.shift(); emit(); op.resolve(result);
        } catch (error) {
          if (disposed) break;
          operations.shift();
          if (error.details?.cart) { cart = error.details.cart; lastConfirmed = cart; }
          // An uncertain write must not be repeated or followed by stale writes.
          const uncertain = !cart || error.code === 'NETWORK_ERROR' || error.status >= 500 || [401, 403, 409].includes(error.status);
          const cancelled = uncertain ? operations.splice(0) : [];
          if (uncertain && !error.details?.cart) cart = null;
          emit(); failed(error); op.reject(error);
          for (const next of cancelled) next.reject(new Error('An earlier cart update failed. Please review your cart and retry.'));
        }
      }
    } finally { running = false; }
  }
  return {
    load,
    enqueue(build, project) {
      if (disposed) return Promise.reject(sessionError());
      try { project?.(visibleCart()); } catch (error) { return Promise.reject(error); }
      const completion = new Promise((resolve, reject) => operations.push({ build, project, resolve, reject }));
      completion.catch(() => {});
      emit(); void pump();
      return completion;
    },
    dispose() {
      disposed = true;
      for (const op of operations.splice(0)) op.reject(sessionError());
    },
  };
}
