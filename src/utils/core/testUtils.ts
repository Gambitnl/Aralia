// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:32:05
 * Dependents: core/index.ts, testUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
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
