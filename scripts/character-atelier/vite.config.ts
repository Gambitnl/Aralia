/** Runs the reference creator without starting Aralia's unrelated operator services. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

const assets = path.resolve(import.meta.dirname, '../../public/assets');

export default defineConfig({
  root: path.resolve(import.meta.dirname, '../..'),
  base: '/Aralia/',
  // Serve requested assets directly instead of indexing Aralia's entire public
  // tree at startup. This preview needs only its models and the shared icons.
  publicDir: false,
  plugins: [react(), {
    name: 'atelier-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const prefix = '/Aralia/assets/';
        if (!request.url?.startsWith(prefix)) return next();
        try {
          const file = path.resolve(assets, decodeURIComponent(request.url.slice(prefix.length).split('?')[0]));
          if (!file.startsWith(assets + path.sep)) { response.statusCode=403; response.end(); return; }
          const info = await stat(file);
          if (!info.isFile()) return next();
          const mime: Record<string,string> = { '.glb':'model/gltf-binary', '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg' };
          response.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
          response.setHeader('Content-Length', info.size);
          if (request.method === 'HEAD') { response.end(); return; }
          createReadStream(file).on('error', () => response.destroy()).pipe(response);
        } catch { response.statusCode=404; response.end(); }
      });
    },
  }],
  // Restrict dependency discovery to this preview. Scanning every HTML entry in
  // the Aralia tree can stall asset requests behind unrelated application code.
  optimizeDeps: { entries: ['misc/character-atelier.html'] },
  server: { host: '127.0.0.1', port: 4178, strictPort: true, watch: { ignored:['**/.agent/**','**/public/**','**/docs/**'] } },
  build: {
    outDir: '.agent/scratch/bg3-reference/site-build',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: { input: 'misc/character-atelier.html' },
  },
});
