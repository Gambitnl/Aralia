/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * ARCHITECTURAL CONTEXT:
 * This file configures the 'Vitest Testing Suite'. It defines the 
 * environment (jsdom), setup files, and test exclusions for the 
 * project's unit and integration tests.
 *
 * Recent updates focus on 'Workspace Isolation'. By excluding
 * local runtime mirrors and scratch workspaces (`.agent_tools`,
 * `.worktrees`, `.tmp`, `.local`) we prevent the main test runner
 * from picking up tests that belong to operational workspaces.
 * This keeps the core test results clean and relevant to the Aralia
 * application code, while allowing those tools to maintain independent
 * testing cycles.
 * 
 * @file vitest.config.ts
 */
export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        css: true,
        reporters: [
            'default',
            ['json', { outputFile: 'vitest-results.json' }],
        ],
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/verification/**',
            '**/*.spec.ts',
            '**/.claude/**',
            // Keep default app test runs focused on Aralia code.
            // Tooling workspaces under .agent_tools are validated separately.
            '**/.agent_tools/**',
            // Keep local git snapshots, scratch vendors, and toolchain mirrors out of
            // normal discovery so `npm run test` stays on the main repository.
            '**/.worktrees/**',
            '**/.tmp/**',
            '**/.local/**',
            '**/vendor/**',
        ],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
