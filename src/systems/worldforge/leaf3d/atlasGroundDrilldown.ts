// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 22:42:09
 * Dependents: components/Worldforge/AtlasDemo.tsx, components/Worldforge/LocalMapView.tsx, components/Worldforge/WorldforgeGroundDrilldown.tsx
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
 * This file defines the durable receipt that carries one Atlas selection into ground 3D.
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

/** Canonical navigation receipt owned by Atlas and handed to the L3 renderer. */
export interface AtlasGroundDrilldown {
  worldSeed: number;
  atlasCellId: number;
  regionSeedPath: string;
  localSeedPath: string;
  localBounds: LocalArtifact['bounds'];
  focus: GroundFocus;
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
    focuses.push({ kind: 'town', id: local.townPlan.burgId, label: `Town ${local.townPlan.burgId}`, xFt, yFt });
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
  };
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
