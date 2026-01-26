// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:39:11
 * Dependents: core/index.ts, testUtils.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import axe from 'axe-core';

export const runAxe = (node: HTMLElement) => {
  axe.run(node, (err, { violations }) => {
    if (err) {
      console.error('axe-core error:', err);
      return;
    }
    if (violations.length > 0) {
      console.warn('Accessibility violations found:', violations);
    }
  });
};
