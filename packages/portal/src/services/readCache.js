// Memory only: private balances are never persisted in browser storage.
export function createReadCache({ now = Date.now } = {}) {
  const entries = new Map();
  return {
    peek(key) { return entries.get(key)?.value; },
    async get(key, read, ttl, fresh = false) {
      const entry = entries.get(key);
      if (entry?.pending) return entry.pending;
      if (!fresh && entry && entry.expires > now()) return entry.value;
      const pending = Promise.resolve().then(read).then(value => {
        if (entries.get(key)?.pending === pending) entries.set(key, { value, expires: now() + Math.max(0, Math.min(ttl, value?.cacheUntil ? Date.parse(value.cacheUntil) - now() : ttl)) });
        return value;
      }).catch(error => {
        if (entries.get(key)?.pending === pending) entries.delete(key);
        throw error;
      });
      entries.set(key, { value: entry?.value, expires: 0, pending });
      return pending;
    },
    invalidate(prefix = '') {
      for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
    },
  };
}
