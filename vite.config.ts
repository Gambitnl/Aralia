import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/Aralia/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/ollama': {
          target: 'http://localhost:11434/api',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        },
        '/api/gemini-image': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/generated': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
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
          // TODO(2026-01-03 pass 5 Codex-CLI): design.html is local-only and ignored, so guard its entry to keep CI builds green.
          ...(fs.existsSync(path.resolve(__dirname, 'design.html'))
            ? { design: path.resolve(__dirname, 'design.html') }
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
