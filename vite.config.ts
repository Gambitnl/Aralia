import path from 'path';
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
          design: path.resolve(__dirname, 'design.html'),
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
