// Serialize writes against the latest confirmed cart, including clicks before it loads.
export function createCartQueue({ request, changed, failed = () => {} }) {
  let cart = null;
  let loading = null;
  let running = false;
  let disposed = false;
  const operations = [];
  const sessionError = () => new Error('Your session changed. Reload your cart.');
  const emit = () => { if (!disposed) changed({ cart, pending: operations.length }); };
  async function load(refresh = false) {
    if (disposed) throw sessionError();
    if (loading) return loading;
    if (cart && (!refresh || operations.length)) return cart;
    loading = request('/cart').then(result => {
      if (disposed) throw sessionError();
      cart = result; emit(); return cart;
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
          const { path, method, values = {} } = op.build(cart);
          const result = await request(path, { method, body: { ...values, expectedVersion: cart.version } });
          if (disposed) break;
          cart = result;
          operations.shift(); emit(); op.resolve(result);
        } catch (error) {
          if (disposed) break;
          operations.shift();
          if (error.details?.cart) cart = error.details.cart;
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
    enqueue(build) {
      if (disposed) return Promise.reject(sessionError());
      const completion = new Promise((resolve, reject) => operations.push({ build, resolve, reject }));
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
