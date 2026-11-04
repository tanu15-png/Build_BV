import { prepareMenuChange } from './menuChanges.js';

// The UI owns the visible draft; requests run in order against confirmed versions.
export function createMenuQueue({ request, changed, failed = () => {} }) {
  let base = null;
  let visible = null;
  let running = false;
  let disposed = false;
  const operations = [];
  const aliases = new Map();
  const clientIds = new Map();
  const resolveId = id => aliases.get(id) || id;
  const resolvePath = path => path.split('/').map(resolveId).join('/');
  const resolveBody = body => body.categoryId ? { ...body, categoryId: resolveId(body.categoryId) } : { ...body };
  const decorate = menu => ({ ...menu,
    categories: menu.categories.map(row => ({ ...row, clientId: clientIds.get(row.id) || row.clientId })),
    items: menu.items.map(row => ({ ...row, clientId: clientIds.get(row.id) || row.clientId })),
  });
  function render(reason = 'change') {
    visible = base;
    for (const op of operations) visible = prepareMenuChange(visible, resolvePath(op.path), op.method, resolveBody(op.body), op.temporaryId).optimistic;
    if (!disposed) changed({ menu: visible, pending: operations.length, reason });
  }
  async function pump() {
    if (running || disposed) return;
    running = true;
    try {
      while (operations.length && !disposed) {
        const op = operations[0];
        try {
          const path = resolvePath(op.path);
          const body = resolveBody(op.body);
          const change = prepareMenuChange(base, path, op.method, body, op.temporaryId);
          if (op.method === 'PATCH' || op.method === 'DELETE') {
            const record = change.field === 'canteen' ? base.canteen : base[change.field].find(row => row.id === change.id);
            body.expectedVersion = record.version;
          }
          const saved = await request(path, { method: op.method, body });
          if (disposed) break;
          const record = op.temporaryId ? { ...saved, clientId: op.temporaryId } : saved;
          if (op.temporaryId) { aliases.set(op.temporaryId, saved.id); clientIds.set(saved.id, op.temporaryId); }
          base = change.confirm(record);
          operations.shift(); render(); op.resolve(record);
        } catch (error) {
          if (disposed) break;
          operations.shift();
          const blocked = new Set(op.temporaryId ? [op.temporaryId] : []);
          const uncertain = error.status === 409 || error.code === 'NETWORK_ERROR' || error.status >= 500 || [401, 403].includes(error.status);
          const cancelled = [];
          for (const next of operations) {
            if (uncertain || blocked.has(next.path.split('/').at(-1)) || blocked.has(next.body.categoryId)) {
              if (next.temporaryId) blocked.add(next.temporaryId);
              cancelled.push(next);
            }
          }
          for (const next of cancelled) operations.splice(operations.indexOf(next), 1);
          render();
          failed(error, op);
          op.reject(error);
          for (const next of cancelled) next.reject(new Error('This change could not be saved because an earlier save failed. Please review your menu.'));
        }
      }
    } finally { running = false; }
  }
  return {
    seed(menu) { if (!operations.length && !disposed) { base = decorate(menu); render('seed'); } return visible; },
    snapshot: () => ({ menu: visible, pending: operations.length }),
    enqueue(path, method, body, initialMenu) {
      if (disposed) throw new Error('Your session changed. Reload the menu.');
      if (!operations.length && initialMenu) this.seed(initialMenu);
      if (!base?.canteen) throw new Error('Wait for your menu to load, then retry.');
      path = resolvePath(path); body = resolveBody(body);
      if (body.name !== undefined && !body.name.trim()) throw new Error('Enter a name.');
      const change = prepareMenuChange(visible, path, method, body);
      const op = { path, method, body, temporaryId: method === 'POST' ? change.id : undefined };
      const completion = new Promise((resolve, reject) => { op.resolve = resolve; op.reject = reject; });
      // A page may close while the provider continues saving; keep failures handled.
      completion.catch(() => {});
      operations.push(op); render(); void pump();
      return { menu: visible, id: change.id, completion };
    },
    dispose() {
      disposed = true;
      for (const op of operations) op.reject(new Error('Your session changed before saving was confirmed.'));
      operations.length = 0;
    },
  };
}
