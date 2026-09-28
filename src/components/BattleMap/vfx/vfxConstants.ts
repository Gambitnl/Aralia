// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 10:06:17
 * Dependents: components/BattleMap/vfx/VFXSystem.tsx, components/BattleMap/vfx/combatFeedback.tsx, components/BattleMap/vfx/environmentEffects.tsx, components/BattleMap/vfx/particleEmitters.ts, components/BattleMap/vfx/spellEffects.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file vfx/vfxConstants.ts
 * Shared scalars and world-space placement helpers for the 3D combat VFX system.
 *
 * Extracted from VFXSystem.tsx (task agora-b70d) so the four VFX modules
 * (particleEmitters / spellEffects / combatFeedback / environmentEffects) can
 * agree on tile size and tile-center placement without importing each other.
 * This is the leaf of the VFX dependency graph: it imports nothing from the
 * repo, so no VFX module can create an import cycle through it.
 *
 * Dependencies: none (leaf module).
 * Dependents: vfx/particleEmitters.ts, vfx/spellEffects.tsx,
 *             vfx/combatFeedback.tsx, vfx/environmentEffects.tsx,
 *             vfx/VFXSystem.tsx
 */

/** World unit size of one battle-map tile. Matches TerrainMesh's TILE_SIZE. */
export const TILE_SIZE = 1.0;

/**
 * World coordinate of a tile's center along one axis.
 *
 * Every VFX placement in the old single-file VFXSystem spelled this out as
 * `n * TILE_SIZE + TILE_SIZE / 2`. Named here so the split modules cannot
 * drift apart on half-tile offsets; the arithmetic is byte-for-byte what it
 * replaced, which is what keeps the render parity claim true.
 */
export const tileCenter = (tileIndex: number): number =>
  tileIndex * TILE_SIZE + TILE_SIZE / 2;
