import { createServer } from 'node:net';

async function occupied(port, host) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => {
      if (error.code === 'EADDRINUSE') resolve(true);
      else if (['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) resolve(false);
      else reject(error);
    });
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(false)));
  });
}

export async function busyServices(services) {
  const results = await Promise.all(services.map(async service => {
    const ipv4 = await occupied(service.port, '127.0.0.1');
    const ipv6 = await occupied(service.port, '::1');
    return ipv4 || ipv6 ? service : null;
  }));
  return results.filter(Boolean);
}
