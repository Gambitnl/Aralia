// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/07/2026, 22:33:27
 * Dependents: components/MapPane.tsx, components/World3D/World3DWrapper.tsx, components/Worldforge/AtlasDemo.tsx, services/saveLoadService.ts, state/appState.ts, state/reducers/worldReducer.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file keeps live Atlas-ground coordinates and discovered places attached to
 * the exact World -> Region -> Local address that authored them.
 *
 * PLAYING calls these helpers whenever the avatar moves or finds a hidden place.
 * Save/load and map views call the same normalizers, so a stale coordinate cannot
 * silently reopen in another Local and a pin from one world cannot appear in another.
 * Legacy Classic-map discoveries remain readable because only records that opt into
 * the versioned Atlas provenance are held to the stricter contract.
 *
 * Called by: World3DWrapper, worldReducer, saveLoadService, App/Atlas map views
 * Depends on: the compact AtlasGroundAddress contract from atlasGroundDrilldown
 */
import type { AtlasGroundAddress } from './atlasGroundDrilldown';

// ============================================================================
// Versioned live-position provenance
// ============================================================================
// The selected focus remains immutable in AtlasGroundAddress. Current avatar
// meters live beside it so movement never rewrites the destination's identity.

export const ATLAS_GROUND_POSITION_SCHEMA_VERSION = 1 as const;

export interface AtlasGroundPosition {
  schemaVersion: typeof ATLAS_GROUND_POSITION_SCHEMA_VERSION;
  worldSeed: number;
  atlasCellId: number;
  regionSeedPath: string;
  localSeedPath: string;
  localBounds: AtlasGroundAddress['localBounds'];
  xM: number;
  zM: number;
}

// ============================================================================
// Versioned hidden-place provenance
// ============================================================================
// A discovery id is namespaced by its Local lineage so two deterministic `hp:0`
// sites in different Locals remain two real places instead of colliding globally.

export const ATLAS_GROUND_DISCOVERY_SCHEMA_VERSION = 1 as const;

export type AtlasGroundDiscoverySourceKind = 'hidden-site' | 'dungeon-entrance';

export interface AtlasGroundDiscoveryProvenance {
  schemaVersion: typeof ATLAS_GROUND_DISCOVERY_SCHEMA_VERSION;
  worldSeed: number;
  atlasCellId: number;
  regionSeedPath: string;
  localSeedPath: string;
  localBounds: AtlasGroundAddress['localBounds'];
  source: {
    kind: AtlasGroundDiscoverySourceKind;
    id: string;
  };
  /** Exact Local-ground coordinates used by proximity discovery and return. */
  xM: number;
  zM: number;
  /** Exact absolute Atlas feet used by native Region/Local map rendering. */
  xFt: number;
  yFt: number;
}

export interface AtlasGroundDiscoveredSite {
  id: string;
  cellId: number;
  name?: string;
  kind?: string;
  offsetX?: number;
  offsetY?: number;
  atlasGround?: AtlasGroundDiscoveryProvenance;
}

// ============================================================================
// Shared validation
// ============================================================================
// Exact equality is intentional: these records come from deterministic address
// objects and JSON, so accepting approximate or partial lineage could cross worlds.

const FEET_TO_METERS = 0.3048;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validBounds(value: unknown): value is AtlasGroundAddress['localBounds'] {
  if (!value || typeof value !== 'object') return false;
  const bounds = value as Partial<AtlasGroundAddress['localBounds']>;
  return finite(bounds.x) && finite(bounds.y) && finite(bounds.width) && bounds.width > 0 &&
    finite(bounds.height) && bounds.height > 0;
}

function sameBounds(
  left: AtlasGroundAddress['localBounds'],
  right: AtlasGroundAddress['localBounds'],
): boolean {
  return left.x === right.x && left.y === right.y &&
    left.width === right.width && left.height === right.height;
}

function coordinatesFitLocal(
  bounds: AtlasGroundAddress['localBounds'],
  xM: number,
  zM: number,
): boolean {
  return xM >= 0 && zM >= 0 &&
    xM <= bounds.width * FEET_TO_METERS &&
    zM <= bounds.height * FEET_TO_METERS;
}

function lineageMatchesAddress(
  value: Pick<AtlasGroundPosition, 'worldSeed' | 'atlasCellId' | 'regionSeedPath' | 'localSeedPath' | 'localBounds'>,
  address: AtlasGroundAddress,
): boolean {
  return value.worldSeed === address.worldSeed &&
    value.atlasCellId === address.atlasCellId &&
    value.regionSeedPath === address.regionSeedPath &&
    value.localSeedPath === address.localSeedPath &&
    sameBounds(value.localBounds, address.localBounds);
}

// ============================================================================
// Current-position construction and restore
// ============================================================================
// Invalid or foreign positions return null. Callers then use the selected focus,
// which is the safe closed fallback already guaranteed by Wave 1/2.

export function atlasGroundPositionForAddress(
  address: AtlasGroundAddress,
  xM: number,
  zM: number,
): AtlasGroundPosition | null {
  if (!finite(xM) || !finite(zM) || !coordinatesFitLocal(address.localBounds, xM, zM)) {
    return null;
  }
  return {
    schemaVersion: ATLAS_GROUND_POSITION_SCHEMA_VERSION,
    worldSeed: address.worldSeed,
    atlasCellId: address.atlasCellId,
    regionSeedPath: address.regionSeedPath,
    localSeedPath: address.localSeedPath,
    localBounds: { ...address.localBounds },
    xM,
    zM,
  };
}

export function normalizeAtlasGroundPosition(
  input: unknown,
  expectedAddress?: AtlasGroundAddress | null,
): AtlasGroundPosition | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<AtlasGroundPosition>;
  if (
    candidate.schemaVersion !== ATLAS_GROUND_POSITION_SCHEMA_VERSION ||
    !Number.isSafeInteger(candidate.worldSeed) ||
    !Number.isSafeInteger(candidate.atlasCellId) ||
    (candidate.atlasCellId ?? -1) < 0 ||
    typeof candidate.regionSeedPath !== 'string' || candidate.regionSeedPath.length === 0 ||
    typeof candidate.localSeedPath !== 'string' || candidate.localSeedPath.length === 0 ||
    !validBounds(candidate.localBounds) ||
    !finite(candidate.xM) || !finite(candidate.zM) ||
    !coordinatesFitLocal(candidate.localBounds, candidate.xM, candidate.zM)
  ) {
    return null;
  }

  const normalized: AtlasGroundPosition = {
    schemaVersion: ATLAS_GROUND_POSITION_SCHEMA_VERSION,
    worldSeed: candidate.worldSeed!,
    atlasCellId: candidate.atlasCellId!,
    regionSeedPath: candidate.regionSeedPath,
    localSeedPath: candidate.localSeedPath,
    localBounds: { ...candidate.localBounds },
    xM: candidate.xM,
    zM: candidate.zM,
  };
  if (expectedAddress && !lineageMatchesAddress(normalized, expectedAddress)) return null;
  return normalized;
}

export function atlasGroundSpawnForAddress(
  address: AtlasGroundAddress,
  savedPosition: unknown,
  focusStart: readonly [number, number],
): { xM: number; zM: number; source: 'saved-position' | 'selected-focus' } {
  const saved = normalizeAtlasGroundPosition(savedPosition, address);
  return saved
    ? { xM: saved.xM, zM: saved.zM, source: 'saved-position' }
    : { xM: focusStart[0], zM: focusStart[1], source: 'selected-focus' };
}

// ============================================================================
// Hidden-place construction and load normalization
// ============================================================================
// Legacy records without atlasGround are preserved. Records that claim the new
// schema must be complete and internally consistent or they are dropped.

export function atlasHiddenSiteForAddress(input: {
  address: AtlasGroundAddress;
  sourceId: string;
  sourceKind: AtlasGroundDiscoverySourceKind;
  name?: string;
  kind?: string;
  xM: number;
  zM: number;
  offsetX?: number;
  offsetY?: number;
}): AtlasGroundDiscoveredSite | null {
  const { address, sourceId, sourceKind, xM, zM } = input;
  if (!sourceId || !finite(xM) || !finite(zM) || !coordinatesFitLocal(address.localBounds, xM, zM)) {
    return null;
  }
  const xFt = address.localBounds.x + xM / FEET_TO_METERS;
  const yFt = address.localBounds.y + zM / FEET_TO_METERS;
  const id = `atlas:${address.worldSeed}:${address.localSeedPath}:${sourceKind}:${sourceId}`;
  return {
    id,
    cellId: address.atlasCellId,
    ...(input.name ? { name: input.name } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
    ...(finite(input.offsetX) ? { offsetX: input.offsetX } : {}),
    ...(finite(input.offsetY) ? { offsetY: input.offsetY } : {}),
    atlasGround: {
      schemaVersion: ATLAS_GROUND_DISCOVERY_SCHEMA_VERSION,
      worldSeed: address.worldSeed,
      atlasCellId: address.atlasCellId,
      regionSeedPath: address.regionSeedPath,
      localSeedPath: address.localSeedPath,
      localBounds: { ...address.localBounds },
      source: { kind: sourceKind, id: sourceId },
      xM,
      zM,
      xFt,
      yFt,
    },
  };
}

export function normalizeDiscoveredHiddenSite(input: unknown): AtlasGroundDiscoveredSite | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<AtlasGroundDiscoveredSite>;
  if (
    typeof candidate.id !== 'string' || candidate.id.length === 0 ||
    !Number.isSafeInteger(candidate.cellId) || (candidate.cellId ?? -1) < 0
  ) {
    return null;
  }

  const base: AtlasGroundDiscoveredSite = {
    id: candidate.id,
    cellId: candidate.cellId!,
    ...(typeof candidate.name === 'string' ? { name: candidate.name } : {}),
    ...(typeof candidate.kind === 'string' ? { kind: candidate.kind } : {}),
    ...(finite(candidate.offsetX) ? { offsetX: candidate.offsetX } : {}),
    ...(finite(candidate.offsetY) ? { offsetY: candidate.offsetY } : {}),
  };
  if (candidate.atlasGround == null) return base;

  const provenance = candidate.atlasGround as Partial<AtlasGroundDiscoveryProvenance>;
  const source = provenance.source;
  if (
    provenance.schemaVersion !== ATLAS_GROUND_DISCOVERY_SCHEMA_VERSION ||
    !Number.isSafeInteger(provenance.worldSeed) ||
    !Number.isSafeInteger(provenance.atlasCellId) || provenance.atlasCellId !== base.cellId ||
    typeof provenance.regionSeedPath !== 'string' || provenance.regionSeedPath.length === 0 ||
    typeof provenance.localSeedPath !== 'string' || provenance.localSeedPath.length === 0 ||
    !validBounds(provenance.localBounds) ||
    !source || (source.kind !== 'hidden-site' && source.kind !== 'dungeon-entrance') ||
    typeof source.id !== 'string' || source.id.length === 0 ||
    !finite(provenance.xM) || !finite(provenance.zM) ||
    !coordinatesFitLocal(provenance.localBounds, provenance.xM, provenance.zM) ||
    !finite(provenance.xFt) || !finite(provenance.yFt) ||
    provenance.xFt !== provenance.localBounds.x + provenance.xM / FEET_TO_METERS ||
    provenance.yFt !== provenance.localBounds.y + provenance.zM / FEET_TO_METERS ||
    base.id !== `atlas:${provenance.worldSeed}:${provenance.localSeedPath}:${source.kind}:${source.id}`
  ) {
    return null;
  }

  return {
    ...base,
    atlasGround: {
      schemaVersion: ATLAS_GROUND_DISCOVERY_SCHEMA_VERSION,
      worldSeed: provenance.worldSeed!,
      atlasCellId: provenance.atlasCellId!,
      regionSeedPath: provenance.regionSeedPath,
      localSeedPath: provenance.localSeedPath,
      localBounds: { ...provenance.localBounds },
      source: { kind: source.kind, id: source.id },
      xM: provenance.xM,
      zM: provenance.zM,
      xFt: provenance.xFt,
      yFt: provenance.yFt,
    },
  };
}

export function normalizeDiscoveredHiddenSites(input: unknown): AtlasGroundDiscoveredSite[] {
  if (!Array.isArray(input)) return [];
  const normalized: AtlasGroundDiscoveredSite[] = [];
  for (const candidate of input) {
    const site = normalizeDiscoveredHiddenSite(candidate);
    if (site && !normalized.some((known) => known.id === site.id)) normalized.push(site);
  }
  return normalized;
}

/** New Atlas pins are world-scoped; legacy Classic pins stay visible as before. */
export function discoveredSiteBelongsToWorld(
  site: AtlasGroundDiscoveredSite,
  worldSeed: number,
): boolean {
  return site.atlasGround == null || site.atlasGround.worldSeed === worldSeed;
}
