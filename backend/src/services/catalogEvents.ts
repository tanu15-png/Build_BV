import type { Request, Response } from 'express';

// Catalog data is public. Only committed writes publish invalidations, never drafts.
export function createCatalogEvents() {
  const clients = new Set<Response>();
  return {
    subscribe(_req: Request, res: Response) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      clients.add(res);
      res.write('event: catalog-change\ndata: {}\n\n');
      const heartbeat = setInterval(() => {
        if (!res.writableNeedDrain) res.write(': heartbeat\n\n');
      }, 25000).unref();
      res.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
    },
    publish(canteenId: string) {
      const event = `event: catalog-change\ndata: ${JSON.stringify({ canteenId })}\n\n`;
      for (const client of clients) {
        if (client.destroyed || client.writableNeedDrain) { client.destroy(); clients.delete(client); }
        else client.write(event);
      }
    },
  };
}
