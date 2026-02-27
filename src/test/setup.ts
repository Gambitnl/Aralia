// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/02/2026, 09:30:10
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
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
