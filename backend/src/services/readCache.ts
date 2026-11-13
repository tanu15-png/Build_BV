export function createReadCache() {
  const rows = new Map<string, { value?: unknown; expires: number; pending?: Promise<unknown> }>();
  return {
    clear(prefix = '') { for (const key of rows.keys()) if (key.startsWith(prefix)) rows.delete(key); },
    async get<T>(key: string, read: () => Promise<T>, ttl = 10000, fresh = false): Promise<T> {
      const previous = rows.get(key);
      if (previous?.pending) return previous.pending as Promise<T>;
      if (!fresh && previous && previous.expires > Date.now()) return previous.value as T;
      const pending = Promise.resolve().then(read).then(value => {
        if (rows.get(key)?.pending === pending) rows.set(key, { value, expires: Date.now() + ttl });
        return value;
      }).catch(error => { if (rows.get(key)?.pending === pending) rows.delete(key); throw error; });
      if (rows.size >= 1000) rows.delete(rows.keys().next().value!);
      rows.set(key, { expires: 0, pending });
      return pending;
    },
  };
}
export type ReadCache = ReturnType<typeof createReadCache>;
