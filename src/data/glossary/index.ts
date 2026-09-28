/**
 * @file src/data/glossary/index.ts
 *
 * Central export index for PHB 2024 structured rule tables and search index.
 *
 * Why it exists:
 * Provides a clean, single-point import for all structured rule datasets,
 * type definitions, and search helpers across the Aralia application.
 *
 * Connects to:
 * - src/data/glossary/types.ts
 * - src/data/glossary/conditionsData.ts
 * - src/data/glossary/coverObscurementData.ts
 * - src/data/glossary/combatActionsData.ts
 * - src/data/glossary/weaponMasteryData.ts
 * - src/data/glossary/searchIndex.ts
 */

// Export Types
export * from './types';

// Export Datasets
export * from './conditionsData';
export * from './coverObscurementData';
export * from './combatActionsData';
export * from './weaponMasteryData';

// Export Search Index & Engine
export * from './searchIndex';
