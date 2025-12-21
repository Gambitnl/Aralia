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
      },
      plugins: [react()],
      define: {
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
          output: {
            // TODO: tighten chunking/lazy-load heavy modules to bring main bundle (~1.6MB) under the 500k warning.
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'framer-motion'],
              'vendor-pixi': ['pixi.js']
            }
          }
        }
      }
    };
});
