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

// Validation utilities - spell auditing, data validation
export * from './validation';

// Visual utilities - spell visuals, UI assets
export * from './visuals';

// Context utilities - React context helpers
export * from './context';
