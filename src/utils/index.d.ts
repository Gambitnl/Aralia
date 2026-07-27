/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/02/2026, 09:32:39
 * Dependents: None (Orphan)
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/index.ts
 * Root barrel export for all utilities.
 *
 * USAGE:
 *   import { rollDice, createMockSpell, SeededRandom } from '@/utils';
 *   // OR import from specific modules:
 *   import { rollDice } from '@/utils/combat';
 *   import { createMockSpell } from '@/utils/core';
 *
 * MIGRATION GUIDE:
 *   Old: import { rollDice } from '@/utils/combatUtils'
 *   New: import { rollDice } from '@/utils/combat'
 *        OR: import { rollDice } from '@/utils'
 */
export * from './core';
export * from './random';
export * from './character';
export * from './combat';
export * from './spatial';
export * from './world';
export * from './planar';
export * from './naval';
export * from './economy';
export * from './travel';
export * from './validation';
export * from './visuals';
export * from './context';
