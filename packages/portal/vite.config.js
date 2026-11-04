import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export function definePortalConfig(portal, port) {
  return defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@spoonate/portal': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: { 'import.meta.env.VITE_PORTAL': JSON.stringify(portal) },
    publicDir: fileURLToPath(new URL('./public', import.meta.url)),
    server: {
      port, strictPort: true,
      proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
    },
  });
}
