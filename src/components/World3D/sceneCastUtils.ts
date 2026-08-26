// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 30/08/2026, 21:43:15
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file sceneCastUtils.ts — World3D compatibility facade for scene-cast rules.
 *
 * Scene-cast data and pure rules now belong to the generated-entity engine, so
 * that engine never reaches upward into React components. This small facade keeps
 * the established World3D import path working for callers while forwarding every
 * export to the engine-owned contract; it contains no second implementation.
 */

// ============================================================================
// Engine contract re-exports
// ============================================================================
// Existing World3D callers may keep this local path. New engine code imports the
// source module directly, preserving the one-way engine -> renderer boundary.
// ============================================================================

export {
  castMemberRecipe,
  figureIsInteractive,
  layoutCast,
  type SceneCastMember,
} from '@/systems/entities3d/sceneCastUtils';
