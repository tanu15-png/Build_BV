import { useCallback, useMemo, useSyncExternalStore } from "react";

const changeEvent = "campusEatsStorageChanged";

export function readStoredValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// storage events sync other tabs; the custom event syncs this tab.
export function usePersistentState(key, fallback) {
  const subscribe = useCallback((notify) => {
    const listener = (event) => {
      if (event.type === changeEvent || event.key === key || event.key === null) notify();
    };
    window.addEventListener("storage", listener);
    window.addEventListener(changeEvent, listener);
    return () => {
      window.removeEventListener("storage", listener);
      window.removeEventListener(changeEvent, listener);
    };
  }, [key]);
  const snapshot = useCallback(() => localStorage.getItem(key), [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const value = useMemo(() => {
    try { return raw === null ? fallback : JSON.parse(raw); }
    catch { return fallback; }
  }, [raw, fallback]);
  const setValue = useCallback((next) => {
    const current = readStoredValue(key, fallback);
    const updated = typeof next === "function" ? next(current) : next;
    localStorage.setItem(key, JSON.stringify(updated));
    window.dispatchEvent(new Event(changeEvent));
    return updated;
  }, [key, fallback]);
  return [value, setValue];
}
