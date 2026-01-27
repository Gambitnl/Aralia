import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';

const formatProxyTarget = (target: ProxyOptions['target']): string => {
  if (!target) return 'unknown';
  if (typeof target === 'string') return target;
  return target.toString();
};

const addProxyDiagnostics = (
  route: string,
  options: ProxyOptions,
  hint: string
): ProxyOptions => ({
  ...options,
  configure: (proxy, proxyOptions) => {
    if (options.configure) {
      options.configure(proxy, proxyOptions);
    }

    proxy.on('error', (error: any, req: any) => {
      const target = formatProxyTarget(options.target);
      const pathSuffix = req?.url ?? '';
      const requestPath = `${route}${pathSuffix}`;
      const errorCode = error?.code ? ` (${error.code})` : '';
      const errorMessage = error?.message ? ` ${error.message}` : '';
      const nestedErrors = Array.isArray(error?.errors) ? error.errors : [];
      const hasRefused =
        error?.code === 'ECONNREFUSED' ||
        nestedErrors.some((entry: any) => entry?.code === 'ECONNREFUSED');

      console.error(`[proxy] ${requestPath} -> ${target} failed${errorCode}.${errorMessage}`);
      if (error?.name === 'AggregateError') {
        console.error('[proxy] AggregateError: multiple connection attempts failed.');
      }
      if (hasRefused) {
        console.error(`[proxy] ECONNREFUSED: target refused the connection. ${hint}`);
      } else if (hint) {
        console.error(`[proxy] Hint: ${hint}`);
      }
    });
  }
});

const visualizerManager = () => ({
  name: 'visualizer-manager',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/visualizer/start') {
        console.info('[dev] Starting Codebase Visualizer server...');
        try {
          // Use npx tsx to run the script in the background
          const child = spawn('npx', ['tsx', 'scripts/codebase-visualizer-server.ts'], {
            detached: true,
            stdio: 'ignore',
            shell: true,
          });
          child.unref();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'starting' }));
        } catch (error) {
          console.error('[dev] Failed to start visualizer:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to start visualizer server' }));
        }
        return;
      }
      next();
    });
  },
});

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '');
  const isDevServer = command === 'serve';
  const ollamaTarget = 'http://localhost:11434/api';
  const imageTarget = 'http://localhost:3001';

  if (isDevServer) {
    console.info('[dev] Proxy routes:');
    console.info(`[dev] /api/ollama -> ${ollamaTarget} (Ollama server)`);
    console.info(`[dev] /api/image-gen -> ${imageTarget} (image server)`);
    console.info(`[dev] /generated -> ${imageTarget} (image server)`);
  }

  return {
    base: '/Aralia/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/ollama': addProxyDiagnostics(
          '/api/ollama',
          {
            target: ollamaTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
          },
          'Start Ollama (ollama serve) or update the target in vite.config.ts.'
        ),
        '/api/image-gen': addProxyDiagnostics(
          '/api/image-gen',
          {
            target: imageTarget,
            changeOrigin: true,
          },
          'Start the image server on port 3001 or update the target in vite.config.ts.'
        ),
        '/generated': addProxyDiagnostics(
          '/generated',
          {
            target: imageTarget,
            changeOrigin: true,
          },
          'Start the image server on port 3001 or update the target in vite.config.ts.'
        )
      }
    },
    plugins: [react(), visualizerManager()],
    define: {
      // Shim process.env for legacy support (allows process.env.API_KEY to work).
      // New code should prefer import.meta.env.VITE_GEMINI_API_KEY.
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          // TODO(2026-01-03 pass 5 Codex-CLI): misc/design.html is local-only and ignored, so guard its entry to keep CI builds green.
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'design.html'))
            ? { design: path.resolve(__dirname, 'misc', 'design.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'dev_hub.html'))
            ? { dev_hub: path.resolve(__dirname, 'misc', 'dev_hub.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'agent_docs.html'))
            ? { agent_docs: path.resolve(__dirname, 'misc', 'agent_docs.html') }
            : {})
        },
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'framer-motion'],
            'vendor-utils': ['lucide-react', 'marked', 'dompurify', 'uuid', 'zod'],
            'vendor-pixi': ['pixi.js'],
            'vendor-ai': ['@google/genai']
          }
        }
      }
    }
  };
});
