// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 22:08:23
 * Dependents: App.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { FEET_PER_FMG_PIXEL } from '../adapter/atlasArtifact';
import { getBridgeAtlas } from '../bridge/legacySubmapBridge';
import { generateLocal } from '../local/generateLocal';
import { generateRegion } from '../region/generateRegion';
import { rootSeedPath } from '../seedPath';
import { LOCAL_SIZE_FT } from '../units';
import {
  artifactsForAtlasGroundDrilldown,
  buildAtlasGroundDrilldown,
  groundFocusesForLocal,
  normalizeAtlasGroundAddress,
  type AtlasGroundAddress,
  type AtlasGroundDrilldown,
} from './atlasGroundDrilldown';

/**
 * This file rebuilds a saved Atlas ground address through the native cartographer pipeline.
 *
 * Save slots retain only a small lineage record. During App hydration this file regenerates
 * World -> Atlas cell -> Region -> Local in the same order AtlasDemo used, validates every
 * persisted boundary, and returns the transient object-rich receipt PLAYING already consumes.
 * Invalid or stale addresses return a closed failure instead of a nearby approximation.
 */

// ============================================================================
// Restore result
// ============================================================================
// Callers need to distinguish an absent legacy field from a rejected saved
// address so Classic entry remains untouched while corrupt Atlas entry closes.

export type AtlasGroundRestoreResult =
  | { status: 'absent' }
  | { status: 'ready'; address: AtlasGroundAddress; drilldown: AtlasGroundDrilldown }
  | { status: 'rejected'; reason: string };

// ============================================================================
// Exact deterministic reconstruction
// ============================================================================
// Version 1 freezes AtlasDemo's current generation options: canonical bridge
// world, cell-centred Region, 100-foot L1 resolution, and 3,000-foot Local.

/** Reconstruct one saved Atlas address without ever substituting another place. */
export function restoreAtlasGroundDrilldown(
  input: unknown,
  expectedWorldSeed?: number,
): AtlasGroundRestoreResult {
  if (input == null) return { status: 'absent' };

  const address = normalizeAtlasGroundAddress(input);
  if (!address) {
    return { status: 'rejected', reason: 'The saved Atlas ground address is malformed or unsupported.' };
  }
  if (expectedWorldSeed !== undefined && address.worldSeed !== expectedWorldSeed) {
    return { status: 'rejected', reason: 'The saved Atlas ground address belongs to a different world.' };
  }

  try {
    const atlas = getBridgeAtlas(address.worldSeed);
    const cellHeights = atlas.pack.cells.h;
    const cellPoint = atlas.pack.cells.p[address.atlasCellId];

    // Native Atlas descent accepts only an existing land cell. A missing point,
    // water cell, or out-of-range id must not be snapped to a neighbour on load.
    if (
      address.atlasCellId >= cellHeights.length ||
      !cellPoint ||
      cellHeights[address.atlasCellId] < 20
    ) {
      return { status: 'rejected', reason: 'The saved Atlas cell is no longer a valid land cell.' };
    }

    const region = generateRegion(
      atlas,
      address.atlasCellId,
      rootSeedPath(address.worldSeed),
      {
        feetPerPixel: FEET_PER_FMG_PIXEL,
        resolutionFt: 100,
        world: atlas,
      },
    );
    if (
      region.seedPath !== address.regionSeedPath ||
      !sameBounds(region.bounds, address.regionBounds)
    ) {
      return { status: 'rejected', reason: 'The saved Atlas Region lineage is stale.' };
    }

    // The Local seed path rounds its centre, so exact saved bounds are the
    // authoritative reconstruction coordinates. Version 1 accepts only the
    // current canonical Local size and a centre selected inside its Region.
    // Atlas permits clicks near a Region edge, so the 3,000-foot window itself
    // may legitimately overlap the Region boundary while its centre stays valid.
    const localBounds = address.localBounds;
    const localCenterX = localBounds.x + localBounds.width / 2;
    const localCenterY = localBounds.y + localBounds.height / 2;
    const localCenterInsideRegion =
      localCenterX >= region.bounds.x &&
      localCenterY >= region.bounds.y &&
      localCenterX <= region.bounds.x + region.bounds.width &&
      localCenterY <= region.bounds.y + region.bounds.height;
    if (
      localBounds.width !== LOCAL_SIZE_FT ||
      localBounds.height !== LOCAL_SIZE_FT ||
      !localCenterInsideRegion
    ) {
      return { status: 'rejected', reason: 'The saved Atlas Local bounds are no longer valid.' };
    }

    const biomeId = Number(
      (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[
        address.atlasCellId
      ] ?? 6,
    );
    const local = generateLocal(
      region,
      {
        x: localCenterX,
        y: localCenterY,
      },
      region.seedPath,
      { biomeId },
    );
    if (
      local.seedPath !== address.localSeedPath ||
      !sameBounds(local.bounds, address.localBounds)
    ) {
      return { status: 'rejected', reason: 'The saved Atlas Local lineage is stale.' };
    }

    const focusInsideLocal =
      address.focus.xFt >= local.bounds.x &&
      address.focus.yFt >= local.bounds.y &&
      address.focus.xFt <= local.bounds.x + local.bounds.width &&
      address.focus.yFt <= local.bounds.y + local.bounds.height;
    const focus = groundFocusesForLocal(local).find(
      (candidate) =>
        candidate.kind === address.focus.kind &&
        candidate.id === address.focus.id &&
        candidate.xFt === address.focus.xFt &&
        candidate.yFt === address.focus.yFt,
    );
    if (!focusInsideLocal || !focus) {
      return { status: 'rejected', reason: 'The saved Atlas focus no longer belongs to its Local.' };
    }

    const drilldown = buildAtlasGroundDrilldown({
      worldSeed: address.worldSeed,
      atlasCellId: address.atlasCellId,
      region,
      local,
      focus,
    });
    artifactsForAtlasGroundDrilldown(drilldown);
    return { status: 'ready', address, drilldown };
  } catch (error) {
    // Generator errors are intentionally converted to a closed result. The App
    // can return to Atlas without ever mounting cell-centred fallback ground.
    return {
      status: 'rejected',
      reason: error instanceof Error ? error.message : 'Atlas ground reconstruction failed.',
    };
  }
}

// ============================================================================
// Geometry equality
// ============================================================================
// Exact numbers are expected because the same deterministic generators and JSON
// numbers are used on both sides. Approximate comparison could accept drift.

function sameBounds(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
