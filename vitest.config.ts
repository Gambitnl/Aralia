/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { nodeTestFiles } from './scripts/ci/node-test-inventory.mjs';

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
const sanitizeAgentLabel = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }

    const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, '-');
    const compact = safe.replace(/-+/g, '-');
    return compact || undefined;
};

// Every invocation receives a private report path, even when a caller forgot to
// set AGORA_AGENT_ID. Shared-checkout agents must never infer their result from a
// repository-global file that a concurrent Vitest process can overwrite.
const resolvedReportAgentId = sanitizeAgentLabel(process.env.AGORA_AGENT_ID) ?? sanitizeAgentLabel(process.env.VITEST_WORKER_ID);
const defaultReportDir = path.join(os.tmpdir(), 'aralia-vitest-results');
fs.mkdirSync(defaultReportDir, { recursive: true });
const vitestJsonOutputFile =
    process.env.VITEST_JSON_OUTPUT_FILE ??
    path.join(defaultReportDir, `vitest-results.${resolvedReportAgentId ?? `pid-${process.pid}`}.json`);

// ============================================================================
// Shared discovery rules (WF-G112)
// ============================================================================
// Both lanes below must see the same universe of files, so the exclusion list stays
// declared once at the root. Vitest concatenates a project's own `exclude` onto the
// inherited one rather than replacing it, so the fast lane only has to name the slow
// globs and the slow lane names nothing.
// ============================================================================
const SHARED_EXCLUDE = [
    // The Node lane and this exclusion share one discovered inventory. Tooling
    // tests remain covered, but their subprocess/server fixtures never use jsdom.
    ...nodeTestFiles(),
    '**/node_modules/**',
    '**/dist/**',
    '**/verification/**',
    '**/*.spec.ts',
    // Agora uses Node's built-in test runner because its tests import node:test
    // and exercise subprocess/server behavior that jsdom cannot bundle. The
    // standalone `node --test "tools/agora/*.test.mjs"` suite covers them.
    '**/tools/agora/**/*.test.mjs',
    // Recovery tests use node:test and disposable Git repositories, like Agora.
    '**/scripts/git/**/*.test.mjs',
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
];

// ============================================================================
// Generation-heavy suites (WF-G112)
// ============================================================================
// These directories drive real procedural generation - chunk meshing, local world
// assembly, battle-map layout - so single tests legitimately run 4.5-9.7 s on a quiet
// box and considerably longer while several agents share the machine. Under the
// stock 5 s `testTimeout` they produced rotating, file-dependent phantom failures that
// cost every worker a rerun to disprove.
//
// They are split into their own project purely to carry a longer timeout. Nothing
// else about how they run changes, and the fast lane keeps Vitest's default 5 s so a
// genuinely hung unit test still fails quickly.
//
// To add a suite: confirm on a quiet run that its tests exceed roughly 4 s, then add
// its `__tests__` glob here rather than raising the global default.
// ============================================================================
const SLOW_SUITE_GLOBS = [
    // These mounted scenarios and terrain jobs also exceeded five seconds in
    // the complete CI baseline. Keep their real generation work in this lane.
    'src/components/DesignPreview/steps/__tests__/landTerrainJob.test.ts',
    'src/components/DesignPreview/steps/__tests__/PreviewCombatScenarios*.test.tsx',
    'src/systems/worldforge/interior/__tests__/footprint.test.ts',
    // Linux CI measured these deterministic generation sweeps at 6-30 seconds.
    // Their assertions remain unchanged; they use the same bounded 60-second lane.
    'src/systems/worldforge/region/__tests__/generateRegion.test.ts',
    'src/systems/world3d/__tests__/buildingSceneModel.test.ts',
    'src/systems/worldforge/bridge/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    'src/systems/worldforge/local/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    'src/components/BattleMap/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)',
];

const SLOW_SUITE_TIMEOUT_MS = 60_000;

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
            ['json', { outputFile: vitestJsonOutputFile }],
        ],
        alias: {
            // THE SPELL CORPUS HAS ONE HOME: public/data/spells.
            // `src/data/spells` used to be a symbolic link to it, made by hand on
            // 12 August, created by no script and repaired by none. 135 test files
            // import single spell JSON through `@/data/spells/...`, so the link was
            // load-bearing while being invisible to git, which tracked 483 duplicate
            // blobs on both sides. This alias does the same job in the build config,
            // where it is checked in, reviewable, and identical on every machine.
            // It MUST stay above the plain '@' entry: Vite takes the first prefix
            // that matches.
            '@/data/spells': path.resolve(__dirname, 'public/data/spells'),
            '@': path.resolve(__dirname, 'src'),
        },
        exclude: SHARED_EXCLUDE,
        // WF-G112: the two lanes differ in exactly one setting, `testTimeout`. Both
        // inherit everything above through `extends: true`, so jsdom, the setup file,
        // the alias, the worker ceiling, and the reporters stay identical and the union
        // of the two `include` sets is the same file list a single-project run found.
        projects: [
            {
                extends: true,
                test: {
                    name: 'app',
                    exclude: SLOW_SUITE_GLOBS,
                },
            },
            {
                extends: true,
                test: {
                    name: 'generation',
                    include: SLOW_SUITE_GLOBS,
                    testTimeout: SLOW_SUITE_TIMEOUT_MS,
                    hookTimeout: SLOW_SUITE_TIMEOUT_MS,
                },
            },
        ],
        coverage: {
            // GG-25: coverage for the shared utility lanes (savingThrowUtils,
            // statUtils, combatUtils, etc.). v8 is the supported Vitest 4
            // provider; c8/istanbul are legacy aliases.
            provider: 'v8',
            reporter: ['text', 'text-summary', 'html', 'json-summary'],
            reportsDirectory: './coverage',
            include: ['src/utils/**/*.ts'],
            exclude: [
                '**/*.test.ts',
                '**/*.test-d.ts',
                '**/__tests__/**',
                '**/*.d.ts',
            ],
            // GG-25: floors at the measured 2026-08-16 baseline so coverage can
            // only grow. The aspirational 80% target needs a broader test-writing
            // pass; these numbers prevent silent regression meanwhile.
            thresholds: {
                lines: 70,
                functions: 70,
                statements: 65,
                branches: 55,
            },
        },
    },
    resolve: {
        alias: {
            // THE SPELL CORPUS HAS ONE HOME: public/data/spells.
            // `src/data/spells` used to be a symbolic link to it, made by hand on
            // 12 August, created by no script and repaired by none. 135 test files
            // import single spell JSON through `@/data/spells/...`, so the link was
            // load-bearing while being invisible to git, which tracked 483 duplicate
            // blobs on both sides. This alias does the same job in the build config,
            // where it is checked in, reviewable, and identical on every machine.
            // It MUST stay above the plain '@' entry: Vite takes the first prefix
            // that matches.
            '@/data/spells': path.resolve(__dirname, 'public/data/spells'),
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
