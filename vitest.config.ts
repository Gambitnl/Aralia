/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        css: true,
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        exclude: ['**/node_modules/**', '**/dist/**', '**/verification/**', '**/*.spec.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
