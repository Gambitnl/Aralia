// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 05/02/2026, 21:41:54
 * Dependents: skillSelectionUtils.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const KEEN_SENSES_OPTION_SKILL_IDS = ['insight', 'perception', 'survival'] as const;
export const BUGBEAR_AUTO_SKILL_ID = 'stealth' as const;

