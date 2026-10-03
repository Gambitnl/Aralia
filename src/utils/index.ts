// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 04/08/2026, 02:07:38
 * Dependents: None (Orphan)
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/index.ts
 * Root barrel export for all utilities.
 *
 * USAGE:
 *   import { calculateCover, createMockSpell, SeededRandom } from '@/utils';
 *   // OR import from specific modules:
 *   import { calculateCover } from '@/utils/combat';
 *   import { createMockSpell } from '@/utils/core';
 *
 * DICE (agora-f821.4, Remy ruling q1 2026-09-20): rollDice, rollD20 and
 * rollDamage are NOT utils any more. They retired from utils/combat/combatUtils
 * and live in '@/systems/dice/rollers', where every roll lands in DiceAuditLog:
 *   import { rollDice } from '@/systems/dice/rollers'
 *
 * MIGRATION GUIDE (completed 2026-08-04): the deprecated '@/utils/combatUtils'
 * bridge was removed after all dependents were migrated. Import combat helpers
 * from the real module directly:
 *   import { calculateCover } from '@/utils/combat'
 */

// Core utilities - foundational functions
export * from './core';

// Random utilities - RNG and noise
export * from './random';

// Character utilities - stats, abilities, equipment
export * from './character';

// Combat utilities - battle mechanics, damage, AOE
export * from './combat';

// Spatial utilities - geometry, pathfinding, line of sight
export * from './spatial';

// World utilities - settlements, factions, religion
export * from './world';

// Planar utilities - extra-dimensional mechanics
export * from './planar';

// Naval utilities - ship mechanics
export * from './naval';

// Economy utilities - pricing, market events
export * from './economy';

// Travel utilities - distance, time calculations
export * from './travel';

// Visual utilities - spell visuals, UI assets
export * from './visuals';

// Context utilities - React context helpers
export * from './context';
