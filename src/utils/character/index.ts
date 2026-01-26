// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:37:38
 * Dependents: factories.ts, utils/index.ts
 * Imports: 12 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/character/index.ts
 * Character utilities - stats, abilities, equipment, and character mechanics.
 */

export * from './characterUtils';
export * from './statUtils';
export * from './savingThrowUtils';
export * from './spellUtils';
export * from './spellAbilityFactory';
export * from './spellFilterUtils';
export * from './weaponUtils';
export * from './coinPurseUtils';
export * from './companionFactories';
export * from './characterValidation';
export * from './concentrationUtils';
export * from './identityUtils';
