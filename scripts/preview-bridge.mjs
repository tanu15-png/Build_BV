// Windows-only loopback bridge when WSL localhost forwarding is unavailable.
// Usage: node scripts/preview-bridge.mjs <WSL IPv4 address> [ports...]
import net from 'node:net';
const [target, ...args] = process.argv.slice(2);
const ports = args.length ? args.map(Number) : [5174, 5175, 5183];
if (!net.isIPv4(target) || ports.some(port => !Number.isInteger(port) || port < 1024 || port > 65535)) {
  throw new Error('Provide the WSL IPv4 address and valid preview ports.');
}
for (const port of ports) {
  for (const host of ['127.0.0.1', '::1']) {
    const server = net.createServer(client => {
      const upstream = net.connect({ host: target, port });
      client.pipe(upstream).pipe(client);
      client.on('error', () => upstream.destroy());
      upstream.on('error', () => client.destroy());
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => client.destroy());
    });
    server.on('error', error => console.error(`${host}:${port}: ${error.message}`));
    server.listen(port, host, () => console.log(`Preview bridge ${host}:${port} -> ${target}:${port}`));
  }
}
