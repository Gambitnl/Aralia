// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 13:05:12
 * Dependents: components/DesignPreview/steps/PreviewTowns.tsx, components/Worldforge/TownPlanView.tsx, systems/worldforge/town/townPlanAdapter.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file assigns a permanent construction age to a town building.
 *
 * Town plans call it with a plot, the built core, and durable settlement and
 * building keys. Distance from the center creates readable growth rings, while
 * a small named-hash variation prevents every ring boundary from looking
 * mechanically perfect. The calculation is scale and translation invariant,
 * so normalized 2D towns and transformed 3D towns receive the same age.
 *
 * Called by: townPlanAdapter.ts and TownPlanView.tsx
 * Depends on: the frozen Worldforge hash and the shared blueprint age type
 */

import type { BuildingAgeBand } from '../interior/blueprintTypes';
import { fnv1a } from '../seedPath';
import type { Pt } from '../submap/submapEngine';

// ============================================================================
// Public Contract
// ============================================================================
// Callers provide geometry in any uniformly scaled and translated town frame.
// Durable keys add variation without tying age to array order or display text.
// ============================================================================

export interface ResolveBuildingAgeInput {
  polygon: readonly Pt[];
  townCore: readonly Pt[];
  settlementKey: string;
  buildingKey: string;
}

/** Older bands have larger ranks, which is useful for audits and summaries. */
export const BUILDING_AGE_RANK: Readonly<Record<BuildingAgeBand, number>> = {
  new: 0,
  aged: 1,
  old: 2,
  ancient: 3,
};

// ============================================================================
// Frame-Invariant Geometry
// ============================================================================
// Only ratios of distances inside one town frame are used. This preserves the
// answer when the canonical map is moved and scaled into regional feet-space.
// ============================================================================

/** Average the vertices of a plot or core into a stable reference point. */
function averagePoint(points: readonly Pt[], label: string): Pt {
  if (points.length === 0) {
    throw new Error(`resolveBuildingAgeBand: ${label} polygon is empty`);
  }

  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
}

/** Convert one named key into a stable fraction without consuming an RNG. */
function hash01(text: string): number {
  return fnv1a(text) / 0x1_0000_0000;
}

// ============================================================================
// Growth-Ring Resolver
// ============================================================================
// Central buildings skew old and ancient; edge growth skews aged and new. The
// bounded jitter changes only a narrow boundary zone, preserving the town-wide
// radial story while letting neighboring lots differ.
// ============================================================================

export function resolveBuildingAgeBand(input: ResolveBuildingAgeInput): BuildingAgeBand {
  const coreCenter = averagePoint(input.townCore, 'town core');
  const buildingCenter = averagePoint(input.polygon, 'building');

  // Half the core's longest span defines a frame-independent radius. Using the
  // diagonal corner distance would classify most edge-front buildings as
  // middle-ring simply because a rectangular core has long corners.
  const coreXs = input.townCore.map(([x]) => x);
  const coreYs = input.townCore.map(([, y]) => y);
  const coreRadius = Math.max(
    Math.max(...coreXs) - Math.min(...coreXs),
    Math.max(...coreYs) - Math.min(...coreYs),
  ) / 2;
  if (coreRadius <= 1e-9) {
    throw new Error('resolveBuildingAgeBand: town core has no measurable radius');
  }

  const radialDistance = Math.hypot(
    buildingCenter[0] - coreCenter[0],
    buildingCenter[1] - coreCenter[1],
  ) / coreRadius;
  const boundaryJitter = (
    hash01(`${input.settlementKey}|${input.buildingKey}|construction-age`) - 0.5
  ) * 0.12;
  const growthScore = Math.max(0, Math.min(1, radialDistance + boundaryJitter));

  // These broad rings leave enough width for a district to span several ages
  // while still making the old core and newer edge legible at town scale.
  if (growthScore < 0.24) return 'ancient';
  if (growthScore < 0.48) return 'old';
  if (growthScore < 0.72) return 'aged';
  return 'new';
}
