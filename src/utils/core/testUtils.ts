// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 13:11:49
 * Dependents: components/SaveLoad/SaveSlotSelector.tsx, utils/testUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import axe from 'axe-core';
import { logger } from './logger';

/**
 * This file runs development-only accessibility checks for mounted UI panels.
 * Components load it dynamically so the large axe library stays out of the
 * production bundle, while developers still receive actionable diagnostics.
 */

// ============================================================================
// Accessibility Diagnostic Runner
// ============================================================================
// axe omits its result object when it reports an execution error. Checking the
// error first prevents development diagnostics from becoming unhandled test or
// browser failures of their own.
// ============================================================================

export const runAxe = (node: HTMLElement) => {
  axe.run(node, (err, results) => {
    if (err) {
      logger.error('axe-core accessibility check failed', { error: err });
      return;
    }

    const { violations } = results;
    if (violations.length > 0) {
      logger.warn('Accessibility violations found', { violations });
    }
  });
};
