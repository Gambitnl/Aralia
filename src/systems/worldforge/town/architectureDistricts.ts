// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 14:00:33
 * Dependents: systems/worldforge/town/townEngine.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file architectureDistricts.ts
 *
 * Assigns stable, spatially coherent architecture districts to generated town
 * wards. Culture still owns the settlement-wide building vocabulary and wealth
 * still controls finish quality; this module only answers which neighboring
 * wards should repeat one stronger roof/facade dialect.
 *
 * Districts are angular sectors around the built core. That keeps membership
 * contiguous and affine-frame invariant, while one seed-derived rotation stops
 * every town from placing its district boundaries on the same compass axes.
 * The output is pure identity data: it never changes ward or plot geometry.
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { Pt } from '../submap/submapEngine';
import type { CivicKind } from './townEngine';

/** Durable architecture identity shared by every ward in one spatial sector. */
export interface TownArchitectureDistrict {
  /** Stable sector index inside this town; useful for debugging and ordering. */
  index: number;
  /** Persistence-facing key consumed by the architecture style resolver. */
  key: string;
  /** Human-readable map-inspector label; never used as identity. */
  label: string;
}

const TAU = Math.PI * 2;

/**
 * Scale district count with settlement complexity, not population directly.
 *
 * Tiny settlements remain one architectural neighborhood. Cities gain enough
 * districts to read as distinct quarters, capped at eight so the town-wide
 * culture remains the dominant visual signal instead of fragmenting endlessly.
 */
export function architectureDistrictCount(wardCount: number): number {
  if (wardCount <= 0) return 0;
  if (wardCount <= 3) return 1;
  if (wardCount <= 8) return 2;
  if (wardCount <= 15) return 3;
  if (wardCount <= 24) return 4;
  return Math.min(8, Math.max(5, Math.round(Math.sqrt(wardCount))));
}

/** Wrap any angle into [0, 2pi). */
function normalizedAngle(angle: number): number {
  return ((angle % TAU) + TAU) % TAU;
}

/** Compass label for a map where positive y points south on screen. */
function directionLabel(angle: number): string {
  const names = [
    'East Ward',
    'Southeast Ward',
    'South Ward',
    'Southwest Ward',
    'West Ward',
    'Northwest Ward',
    'North Ward',
    'Northeast Ward',
  ] as const;
  const index = Math.round(normalizedAngle(angle) / TAU * names.length) % names.length;
  return names[index];
}

/** Civic anchors give a district a more useful name than its compass sector. */
function civicDistrictLabel(civics: readonly (CivicKind | undefined)[]): string | undefined {
  if (civics.includes('citadel') || civics.includes('keep')) return 'Citadel District';
  if (civics.includes('plaza')) return 'Market District';
  if (civics.includes('dock')) return 'Harbor District';
  if (civics.includes('temple')) return 'Temple Close';
  return undefined;
}

/**
 * Assign one architecture district to every ward centroid.
 *
 * The same seed and relative centroid arrangement always return the same keys.
 * Uniform scale and translation leave every assignment unchanged, which lets
 * the normalized 2D town and feet-space 3D town share district identity.
 */
export function assignArchitectureDistricts(
  wardCentroids: readonly Pt[],
  townCenter: Pt,
  wardCivics: readonly (CivicKind | undefined)[],
  seedPath: SeedPath,
): TownArchitectureDistrict[] {
  if (wardCentroids.length !== wardCivics.length) {
    throw new Error(
      `assignArchitectureDistricts: ${wardCentroids.length} centroids but ` +
      `${wardCivics.length} civic entries`,
    );
  }
  if (wardCentroids.length === 0) return [];

  const districtCount = architectureDistrictCount(wardCentroids.length);
  const sectorWidth = TAU / districtCount;
  const rotation = rngFromPath(streamPath(seedPath, 'architecture-districts')).next() * TAU;

  // Every ward is classified only by its angle around the same town center.
  // Nearby angular neighbors therefore repeat a key instead of receiving a
  // random per-ward style hash.
  const sectorByWard = wardCentroids.map(([x, y], wardIndex) => {
    const dx = x - townCenter[0];
    const dy = y - townCenter[1];
    // A centroid exactly at the town center has no meaningful angle. Give that
    // rare central ward a deterministic sector without consuming another draw.
    if (Math.abs(dx) + Math.abs(dy) < 1e-9) return wardIndex % districtCount;
    const relative = normalizedAngle(Math.atan2(dy, dx) - rotation);
    return Math.min(districtCount - 1, Math.floor(relative / sectorWidth));
  });

  const wardIndicesBySector = new Map<number, number[]>();
  sectorByWard.forEach((sector, wardIndex) => {
    const members = wardIndicesBySector.get(sector) ?? [];
    members.push(wardIndex);
    wardIndicesBySector.set(sector, members);
  });

  // Labels are presentation only. Civic names win, while compass labels make
  // ordinary residential sectors readable in the map inspector.
  const labelBySector = new Map<number, string>();
  const usedLabels = new Set<string>();
  for (const [sector, wardIndices] of [...wardIndicesBySector.entries()].sort(([a], [b]) => a - b)) {
    const civicLabel = civicDistrictLabel(wardIndices.map((index) => wardCivics[index]));
    const compassLabel = directionLabel(rotation + (sector + 0.5) * sectorWidth);
    let label = civicLabel ?? compassLabel;
    if (usedLabels.has(label)) label = `${compassLabel} ${label}`;
    if (usedLabels.has(label)) label = `${label} ${sector + 1}`;
    usedLabels.add(label);
    labelBySector.set(sector, label);
  }

  return sectorByWard.map((sector) => ({
    index: sector,
    key: `district:${sector}`,
    label: labelBySector.get(sector) ?? `District ${sector + 1}`,
  }));
}
