/**
 * @file index.ts — entry point for the worldforge erosion subsystem.
 *
 * This file exposes the core erosion tools: rock hardness calculations, atlas-scale
 * erosion simulation baking, and explicit dendritic drainage network generation.
 *
 * Called by: region generation pipelines, terrain heightfield builders, and diagnostics.
 * Depends on: rockHardness.ts, atlasErosionBake.ts, dendriticDrainageNetwork.ts.
 */

// ============================================================================
// Subsystem Exports
// ============================================================================
// Re-export rock hardness modeling, atlas-scale erosion bake, and dendritic drainage synthesis.
// ============================================================================

export * from './rockHardness';
export * from './atlasErosionBake';
export * from './dendriticDrainageNetwork';
