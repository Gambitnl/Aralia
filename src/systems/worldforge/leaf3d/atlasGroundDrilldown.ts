// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/07/2026, 22:08:08
 * Dependents: App.tsx, components/World3D/World3DWrapper.tsx, components/Worldforge/AtlasDemo.tsx, components/Worldforge/LocalMapView.tsx, components/Worldforge/WorldforgeGroundDrilldown.tsx, services/saveLoadService.ts, state/appState.ts, systems/worldforge/leaf3d/atlasGroundRestore.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { LocalArtifact, RegionArtifact } from '../artifacts';

/**
 * This file defines the canonical in-session receipt that carries one Atlas selection into ground 3D.
 *
 * Atlas creates the receipt from the Region and Local artifacts it already owns. The 3D
 * renderer then validates and renders those same objects, so a town or site cannot quietly
 * turn into a separately regenerated approximation during descent.
 */

// ============================================================================
// Ground destination identity
// ============================================================================
// A focus is a named point inside the selected Local artifact. The feet-based
// coordinates stay in Atlas space until the renderer converts them at the L3 boundary.

export type GroundFocus =
  | { kind: 'town'; id: number; label: string; xFt: number; yFt: number }
  | { kind: 'site'; id: number; label: string; xFt: number; yFt: number }
  | { kind: 'local'; id: string; label: string; xFt: number; yFt: number };

/** Current JSON contract for a saved Atlas ground address. */
export const ATLAS_GROUND_ADDRESS_SCHEMA_VERSION = 1 as const;

/**
 * Stable focus identity stored in a save slot.
 *
 * Labels are deliberately omitted because the regenerated Local is their
 * authority. Kind, source id, and exact authored coordinates are sufficient to
 * reject a renamed, moved, removed, or foreign destination.
 */
export type AtlasGroundFocusAddress =
  | { kind: 'town'; id: number; xFt: number; yFt: number }
  | { kind: 'site'; id: number; xFt: number; yFt: number }
  | { kind: 'local'; id: string; xFt: number; yFt: number };

/**
 * Compact save-state reference for one native Atlas descent.
 *
 * This contains only deterministic lineage and coordinates. Region and Local
 * artifacts are intentionally absent because their typed arrays and generated
 * object graphs are reconstructed from the same canonical pipeline after load.
 */
export interface AtlasGroundAddress {
  schemaVersion: typeof ATLAS_GROUND_ADDRESS_SCHEMA_VERSION;
  worldSeed: number;
  atlasCellId: number;
  regionSeedPath: string;
  regionBounds: RegionArtifact['bounds'];
  localSeedPath: string;
  localBounds: LocalArtifact['bounds'];
  focus: AtlasGroundFocusAddress;
  returnTier: 'local';
}

/**
 * The hierarchy tier PLAYING must restore when the player opens the map again.
 *
 * Wave 1 keeps the actual artifacts in memory. Wave 2 will need a serialized
 * version of this target plus deterministic artifact reconstruction on reload.
 * The named tier is intentionally explicit so deeper hierarchy tiers can extend
 * the return-target union without replacing today's Local contract.
 */
export interface AtlasGroundReturnTarget {
  tier: 'local';
  atlasCellId: number;
  regionSeedPath: string;
  localSeedPath: string;
}

/**
 * Canonical navigation receipt owned by Atlas and handed to PLAYING ground 3D.
 *
 * Region and Local are deliberate object references, not regeneration hints.
 * Keeping the exact objects here prevents PLAYING from replacing the selected
 * Local with a cell-centered approximation. This receipt is transient in Wave 1:
 * App component memory owns it, so save/reload support remains Wave 2 work.
 */
export interface AtlasGroundDrilldown {
  worldSeed: number;
  atlasCellId: number;
  regionSeedPath: string;
  localSeedPath: string;
  localBounds: LocalArtifact['bounds'];
  focus: GroundFocus;
  region: RegionArtifact;
  local: LocalArtifact;
  returnTarget: AtlasGroundReturnTarget;
}

// ============================================================================
// Compact save-state address
// ============================================================================
// The transient receipt keeps exact artifact objects. This section strips those
// objects before save and normalizes unknown load data without regenerating yet.

/** Convert an already-validated runtime receipt into its JSON-safe address. */
export function atlasGroundAddressFromDrilldown(
  drilldown: AtlasGroundDrilldown,
): AtlasGroundAddress {
  // Reuse the runtime guard so a mixed receipt can never become durable state.
  artifactsForAtlasGroundDrilldown(drilldown);

  const focus: AtlasGroundFocusAddress =
    drilldown.focus.kind === 'local'
      ? {
          kind: 'local',
          id: drilldown.focus.id,
          xFt: drilldown.focus.xFt,
          yFt: drilldown.focus.yFt,
        }
      : {
          kind: drilldown.focus.kind,
          id: drilldown.focus.id,
          xFt: drilldown.focus.xFt,
          yFt: drilldown.focus.yFt,
        };

  return {
    schemaVersion: ATLAS_GROUND_ADDRESS_SCHEMA_VERSION,
    worldSeed: drilldown.worldSeed,
    atlasCellId: drilldown.atlasCellId,
    regionSeedPath: drilldown.regionSeedPath,
    regionBounds: { ...drilldown.region.bounds },
    localSeedPath: drilldown.localSeedPath,
    localBounds: { ...drilldown.localBounds },
    focus,
    returnTier: drilldown.returnTarget.tier,
  };
}

/**
 * Accept only the versioned, finite, compact address shape from a save slot.
 *
 * Semantic checks that require world generation happen during reconstruction;
 * this first boundary prevents malformed JSON values such as null coordinates,
 * unsupported versions, or copied artifact objects from entering game state.
 */
export function normalizeAtlasGroundAddress(input: unknown): AtlasGroundAddress | null {
  if (!input || typeof input !== 'object') return null;

  const candidate = input as Partial<AtlasGroundAddress>;
  const regionBounds = candidate.regionBounds;
  const localBounds = candidate.localBounds;
  const focus = candidate.focus;
  const finite = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const validBounds = (
    bounds: LocalArtifact['bounds'] | undefined,
  ): bounds is LocalArtifact['bounds'] =>
    !!bounds &&
    finite(bounds.x) &&
    finite(bounds.y) &&
    finite(bounds.width) &&
    bounds.width > 0 &&
    finite(bounds.height) &&
    bounds.height > 0;
  const validFocusIdentity =
    !!focus &&
    ((focus.kind === 'local' && typeof focus.id === 'string' && focus.id.length > 0) ||
      ((focus.kind === 'town' || focus.kind === 'site') &&
        typeof focus.id === 'number' &&
        Number.isSafeInteger(focus.id) &&
        focus.id >= 0));
  const validFocus =
    validFocusIdentity && finite(focus.xFt) && finite(focus.yFt);

  if (
    candidate.schemaVersion !== ATLAS_GROUND_ADDRESS_SCHEMA_VERSION ||
    typeof candidate.worldSeed !== 'number' ||
    !Number.isSafeInteger(candidate.worldSeed) ||
    typeof candidate.atlasCellId !== 'number' ||
    !Number.isSafeInteger(candidate.atlasCellId) ||
    (candidate.atlasCellId ?? -1) < 0 ||
    typeof candidate.regionSeedPath !== 'string' ||
    candidate.regionSeedPath.length === 0 ||
    typeof candidate.localSeedPath !== 'string' ||
    candidate.localSeedPath.length === 0 ||
    candidate.returnTier !== 'local' ||
    !validBounds(regionBounds) ||
    !validBounds(localBounds) ||
    !validFocus
  ) {
    return null;
  }

  // Return a fresh compact object so unknown extra properties from hand-edited
  // saves, including accidental artifact graphs, are not retained in state.
  return {
    schemaVersion: ATLAS_GROUND_ADDRESS_SCHEMA_VERSION,
    worldSeed: candidate.worldSeed,
    atlasCellId: candidate.atlasCellId,
    regionSeedPath: candidate.regionSeedPath,
    regionBounds: { ...regionBounds },
    localSeedPath: candidate.localSeedPath,
    localBounds: { ...localBounds },
    focus: { ...focus } as AtlasGroundFocusAddress,
    returnTier: 'local',
  };
}

// ============================================================================
// Artifact-derived entry choices
// ============================================================================
// Towns and sites come from Local data rather than UI guesses. Wilderness is
// offered only when the artifact has no more specific named ground destination.
export function groundFocusesForLocal(local: LocalArtifact): GroundFocus[] {
  const focuses: GroundFocus[] = [];
  if (local.townPlan) {
    const points = local.townPlan.plots.flatMap((plot) => plot.footprint);
    const xFt = points.length ? points.reduce((sum, point) => sum + point[0], 0) / points.length : local.bounds.x + local.bounds.width / 2;
    const yFt = points.length ? points.reduce((sum, point) => sum + point[1], 0) / points.length : local.bounds.y + local.bounds.height / 2;
    // The L2 plan carries the Atlas burg's canonical identity. Older authored
    // plans keep the stable numeric fallback here, but current generation never
    // asks Ground to rediscover or rename the settlement.
    focuses.push({
      kind: 'town',
      id: local.townPlan.identity?.sourceId ?? local.townPlan.burgId,
      label: local.townPlan.identity?.name ?? `Town ${local.townPlan.burgId}`,
      xFt,
      yFt,
    });
  }
  for (const feature of local.features) {
    if (feature.kind !== 'poi') continue;
    const rawLabel = feature.data?.name ?? feature.data?.label;
    focuses.push({
      kind: 'site',
      id: feature.id,
      label: typeof rawLabel === 'string' ? rawLabel : `Site ${feature.id}`,
      xFt: feature.x,
      yFt: feature.y,
    });
  }
  if (!focuses.length) {
    focuses.push({
      kind: 'local',
      id: local.seedPath,
      label: 'Local wilderness',
      xFt: local.bounds.x + local.bounds.width / 2,
      yFt: local.bounds.y + local.bounds.height / 2,
    });
  }
  return focuses;
}

// ============================================================================
// Atlas-owned handoff construction
// ============================================================================
// Rejecting foreign focuses protects the core promise that descent stays inside
// the exact Local artifact currently visible in the cartographic hierarchy.
export function buildAtlasGroundDrilldown(input: {
  worldSeed: number;
  atlasCellId: number;
  region: RegionArtifact;
  local: LocalArtifact;
  focus: GroundFocus;
}): AtlasGroundDrilldown {
  const { worldSeed, atlasCellId, region, local, focus } = input;
  if (!groundFocusesForLocal(local).some((candidate) => candidate.kind === focus.kind && candidate.id === focus.id)) {
    throw new Error(`Ground focus ${focus.kind}:${String(focus.id)} does not belong to local artifact ${local.seedPath}`);
  }
  return {
    worldSeed,
    atlasCellId,
    regionSeedPath: region.seedPath,
    localSeedPath: local.seedPath,
    localBounds: { ...local.bounds },
    focus: { ...focus },
    // Preserve the exact Atlas-owned objects. PLAYING must consume these object
    // identities instead of asking a cell-addressed bridge to generate again.
    region,
    local,
    returnTarget: {
      tier: 'local',
      atlasCellId,
      regionSeedPath: region.seedPath,
      localSeedPath: local.seedPath,
    },
  };
}

// ============================================================================
// Receipt validation and exact-artifact access
// ============================================================================
// Every consumer crosses this guard before rendering or restoring navigation.
// A stale or mixed receipt fails closed instead of showing a different place.
export function artifactsForAtlasGroundDrilldown(
  drilldown: AtlasGroundDrilldown,
): { region: RegionArtifact; local: LocalArtifact } {
  const { region, local, returnTarget } = drilldown;
  const boundsMatch =
    local.bounds.x === drilldown.localBounds.x &&
    local.bounds.y === drilldown.localBounds.y &&
    local.bounds.width === drilldown.localBounds.width &&
    local.bounds.height === drilldown.localBounds.height;
  const lineageMatches =
    region.seedPath === drilldown.regionSeedPath &&
    local.seedPath === drilldown.localSeedPath &&
    returnTarget.tier === 'local' &&
    returnTarget.atlasCellId === drilldown.atlasCellId &&
    returnTarget.regionSeedPath === drilldown.regionSeedPath &&
    returnTarget.localSeedPath === drilldown.localSeedPath;
  const focusMatches = groundFocusesForLocal(local).some(
    (candidate) =>
      candidate.kind === drilldown.focus.kind &&
      candidate.id === drilldown.focus.id &&
      candidate.label === drilldown.focus.label &&
      candidate.xFt === drilldown.focus.xFt &&
      candidate.yFt === drilldown.focus.yFt,
  );

  if (!boundsMatch || !lineageMatches || !focusMatches) {
    throw new Error(
      'Atlas ground handoff no longer matches its selected hierarchy. Return to Atlas and select the location again.',
    );
  }

  return { region, local };
}

// ============================================================================
// Feet-to-ground coordinate boundary
// ============================================================================
// Worldforge artifacts remain authored in D&D feet. World3D uses meters internally,
// so conversion happens once here after coordinates are made local to the artifact.
export function groundStartForFocus(local: LocalArtifact, focus: GroundFocus): readonly [number, number] {
  const feetToMeters = 0.3048;
  return [
    Math.max(0, Math.min(local.bounds.width, focus.xFt - local.bounds.x)) * feetToMeters,
    Math.max(0, Math.min(local.bounds.height, focus.yFt - local.bounds.y)) * feetToMeters,
  ] as const;
}
