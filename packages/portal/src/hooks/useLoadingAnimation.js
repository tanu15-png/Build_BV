import { useCallback, useState } from 'react';

// Keep a visible loading cycle mounted until both the request and its animation finish.
export function useLoadingAnimation(loading) {
  const [cycle, setCycle] = useState(() => ({ loading, finished: !loading }));
  if (cycle.loading !== loading) {
    setCycle({ loading, finished: loading ? false : cycle.finished });
  }
  const complete = useCallback(() => setCycle(current => ({ ...current, finished: true })), []);
  return { pending: loading || !cycle.finished, complete };
}
