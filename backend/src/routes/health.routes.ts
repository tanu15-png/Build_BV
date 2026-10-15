import { Router } from 'express';
export function createHealthRouter(check: () => Promise<unknown>, timeoutMs: number) {
  const router = Router();
  router.get('/live', (_req, res) => { res.json({ ok: true, status: 'alive' }); });
  router.get('/ready', async (_req, res) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([check(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); })]);
      res.json({ ok: true, status: 'ready' });
    } catch { res.status(503).json({ ok: false, status: 'not_ready' }); }
    finally { clearTimeout(timer); }
  });
  return router;
}
