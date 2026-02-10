// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 * 
 * Last Sync: 10/02/2026, 19:44:03
 * Dependents: None (Orphan)
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Polyfill ResizeObserver for React Measure/Three.js tests
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Runs a cleanup after each test case (e.g. clearing jsdom)
// afterEach is injected as a global by vitest (globals: true in config)
afterEach(() => {
    cleanup();
});
