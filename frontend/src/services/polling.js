export function pollingInterval(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1000 && number <= 60000 ? number : 5000;
}
// Poll only while visible and online; returning to the app always revalidates.
export function startVisiblePolling({ refresh, intervalMs = 5000, windowTarget = window, documentTarget = document,
  online = () => navigator.onLine !== false, schedule = setTimeout, cancel = clearTimeout }) {
  let stopped = false;
  let timer;
  let running = false;
  let again = false;
  const eligible = () => documentTarget.visibilityState !== 'hidden' && online();
  const scheduleNext = () => { if (!stopped) timer = schedule(() => { void run(); }, intervalMs); };
  async function run() {
    if (stopped) return;
    if (running) { again = true; return; }
    cancel(timer);
    if (!eligible()) { scheduleNext(); return; }
    running = true;
    try { await refresh(); }
    catch (error) { if ([401, 403].includes(error.status)) stop(); }
    finally {
      running = false;
      if (again && !stopped) { again = false; void run(); }
      else scheduleNext();
    }
  }
  const wake = () => { if (eligible()) void run(); };
  function stop() {
    stopped = true; cancel(timer);
    windowTarget.removeEventListener('focus', wake); windowTarget.removeEventListener('online', wake);
    documentTarget.removeEventListener('visibilitychange', wake);
  }
  windowTarget.addEventListener('focus', wake); windowTarget.addEventListener('online', wake);
  documentTarget.addEventListener('visibilitychange', wake);
  timer = schedule(() => { void run(); }, 0);
  return { stop, refresh: run };
}
