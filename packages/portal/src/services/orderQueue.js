const progression = ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'COLLECTED'];
const nextStatus = status => progression[progression.indexOf(status) + 1];
const allowed = (before, after) => before !== 'REJECTED' && (nextStatus(before) === after || (before === 'RECEIVED' && after === 'REJECTED'));
const reached = (actual, wanted) => actual === wanted || (actual !== 'REJECTED' && wanted !== 'REJECTED' && progression.indexOf(actual) >= progression.indexOf(wanted));

// Each order owns its queue; its buttons advance immediately while writes use
// confirmed versions and the existing persistent idempotency keys.
export function createOrderQueue({ execute, read, changed, saved = () => {}, settled = () => {},
  setTimer = setTimeout, clearTimer = clearTimeout, now = () => performance.now() }) {
  const records = new Map();
  let disposed = false;
  const sessionError = () => new Error('Your account changed. Sign in to view your orders.');
  function visible(record) {
    const desired = record.operations.at(-1)?.status ?? record.base.status;
    const status = record.base.status === 'REJECTED' || reached(record.base.status, desired)
      || (desired === 'REJECTED' && record.base.status !== 'RECEIVED') ? record.base.status : desired;
    return { ...record.base, status, optimistic: record.operations.length > 0, collectionFeedback: record.feedback };
  }
  function emit() {
    if (disposed) return;
    changed({ orders: [...records.values()].map(visible),
      errors: Object.fromEntries([...records].filter(([, record]) => record.error)
        .map(([id, record]) => [id, { message: record.error, recovering: record.recovering }])) });
  }
  function confirm(record, order) {
    if (order.version >= record.base.version) record.base = order;
    saved(record.base);
  }
  function stopFeedback(record) {
    clearTimer(record.timer); record.timer = null; record.feedback = false;
  }
  function showCollected(record) {
    stopFeedback(record); record.feedback = true;
    record.timer = setTimer(() => { record.feedback = false; record.timer = null; emit(); }, 3000);
  }
  async function pump(record) {
    if (record.running || disposed) return;
    record.running = true;
    try {
      while (record.operations.length && !disposed) {
        const operation = record.operations[0];
        try {
          if (reached(record.base.status, operation.status)) {
            record.operations.shift(); emit(); operation.resolve(record.base); continue;
          }
          const order = await execute(record.base, operation.status);
          if (disposed) break;
          confirm(record, order); record.operations.shift(); emit(); operation.resolve(order);
        } catch (error) {
          if (disposed) break;
          const cancelled = record.operations.splice(0);
          record.retryStatus = cancelled.at(-1).status;
          record.error = `Could not save this order. ${error.message || 'Please try again.'}`;
          record.recovering = true; stopFeedback(record);
          if (error.details?.order) confirm(record, error.details.order);
          emit();
          try {
            const fresh = await read(record.base.id);
            if (!disposed) confirm(record, fresh);
          } catch { /* Keep the last confirmed status and offer a retry. */ }
          if (disposed) {
            for (const command of cancelled) command.reject(sessionError());
            break;
          }
          record.recovering = false;
          if (reached(record.base.status, record.retryStatus)) {
            record.error = ''; record.retryStatus = null;
            for (const command of cancelled) command.resolve(record.base);
          } else {
            for (const command of cancelled) command.reject(error);
          }
          emit();
        }
      }
    } finally {
      record.running = false;
      if (!disposed) settled();
    }
  }
  function enqueue(order, status, { guard = true } = {}) {
    if (disposed) return Promise.reject(sessionError());
    let record = records.get(order.id);
    if (!record) {
      record = { base: order, operations: [], running: false, error: '', retryStatus: null, recovering: false, feedback: false, timer: null, lastClickAt: -Infinity };
      records.set(order.id, record);
    } else if (!order.optimistic && order.version > record.base.version) record.base = order;
    if (record.recovering) return Promise.reject(new Error('Please retry after the order refreshes.'));
    const current = visible(record);
    if (current.status === status) return record.operations.at(-1)?.completion ?? Promise.resolve(record.base);
    if (!allowed(current.status, status)) return Promise.reject(new Error('This order changed. Use its current action.'));
    if (guard && now() - record.lastClickAt < 400) return record.operations.at(-1)?.completion ?? Promise.resolve(current);
    if (guard) record.lastClickAt = now();
    record.error = ''; record.retryStatus = null;
    const operation = { status };
    operation.completion = new Promise((resolve, reject) => { operation.resolve = resolve; operation.reject = reject; });
    operation.completion.catch(() => {});
    record.operations.push(operation);
    if (status === 'COLLECTED') showCollected(record);
    emit(); void pump(record);
    return operation.completion;
  }
  return {
    enqueue,
    seed(orders) {
      let updated = false;
      for (const order of orders) {
        const record = records.get(order.id);
        if (record && order.version > record.base.version) {
          record.base = order; updated = true;
          if (record.error && !record.recovering && record.retryStatus && reached(order.status, record.retryStatus)) {
            record.error = ''; record.retryStatus = null;
          }
        }
      }
      if (updated) emit();
    },
    async retry(id) {
      const record = records.get(id);
      if (!record?.retryStatus || record.recovering || disposed) return;
      if (now() - record.lastClickAt < 400) return;
      record.lastClickAt = now();
      const wanted = record.retryStatus;
      record.recovering = true; emit();
      try {
        const fresh = await read(id);
        if (disposed) return;
        confirm(record, fresh); record.recovering = false;
        if (reached(fresh.status, wanted)) { record.error = ''; record.retryStatus = null; emit(); return fresh; }
        if (fresh.status === 'REJECTED' || (wanted === 'REJECTED' && fresh.status !== 'RECEIVED')) {
          record.error = ''; record.retryStatus = null; emit(); return fresh;
        }
        const targets = wanted === 'REJECTED' ? ['REJECTED']
          : progression.slice(progression.indexOf(fresh.status) + 1, progression.indexOf(wanted) + 1);
        record.error = ''; record.retryStatus = null;
        const commands = targets.map(status => enqueue(record.base, status, { guard: false }));
        return await Promise.all(commands);
      } catch (error) {
        if (!disposed && !record.error) record.error = `Could not save this order. ${error.message || 'Please try again.'}`;
        throw error;
      } finally { if (!disposed) { record.recovering = false; emit(); } }
    },
    dispose() {
      disposed = true;
      for (const record of records.values()) {
        stopFeedback(record);
        for (const operation of record.operations.splice(0)) operation.reject(sessionError());
      }
    },
  };
}
