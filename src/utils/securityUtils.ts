// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * DEPRECATED BRIDGE / MIDDLEMAN: Redirects to a new location. (Clean me up!)
 *
 * Last Sync: 27/02/2026, 09:33:46
 * Dependents: AISpellArbitrator.ts, AISpellInputModal.tsx, CharacterCreator.tsx, GameGuideModal.tsx, NameAndReview.tsx, PortraitService.ts, core.ts, encounters.ts, items.ts, saveLoadService.ts, useGlossaryModal.ts, useLocalStorage.ts, useResizableWindow.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Import from '@/utils/core' or '@/utils/core/securityUtils' instead.
 * This file will be removed in a future version.
 */
export * from './core/securityUtils';
