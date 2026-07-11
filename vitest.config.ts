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
        // The complete jsdom suite overcommitted this 16-thread workstation at
        // Vitest's automatic concurrency, producing rotating collection errors
        // in otherwise-green files. Four workers discovered all 6,492 tests and
        // completed without those phantom failures, so every default lane uses
        // this preserving ceiling. Optional 1/4 shard scripts inherit the same
        // discovery rules and can run independently in CI without overlap.
        maxWorkers: 4,
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
            // Agora uses Node's built-in test runner because its tests import node:test
            // and exercise subprocess/server behavior that jsdom cannot bundle. The
            // standalone `node --test "tools/agora/*.test.mjs"` suite covers them.
            '**/tools/agora/**/*.test.mjs',
            '**/.claude/**',
            // Keep default app test runs focused on Aralia code.
            // Tooling workspaces under .agent_tools are validated separately.
            '**/.agent_tools/**',
            // Disposable proofs and diagnostic tests live under .agent/scratch.
            // They intentionally probe unfinished behavior and must not become part
            // of the tracked product suite merely because their filenames end in test.ts.
            '**/.agent/**',
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
