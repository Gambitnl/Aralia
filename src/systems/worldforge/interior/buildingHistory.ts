// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 13:05:25
 * Dependents: systems/worldforge/interior/generateBuilding.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves a generated building's permanent, visible backstory.
 *
 * The town decides the broad construction age. After the footprint, walls, and
 * roof exist, the building generator calls this resolver to assign later-built
 * masses and a bounded set of repairs or damage to real blueprint targets.
 * Every choice uses a named hash, so adding a future history feature cannot
 * shift existing choices. The result is stored on BlueprintPlan and shared by
 * every renderer.
 *
 * Called by: generateBuilding.ts
 * Depends on: blueprint geometry, approved style palettes, and frozen seed hashes
 */

import type { FootprintMass } from './footprint';
import type {
  BlueprintFloor,
  BuildingAgeBand,
  BuildingBackstory,
  BuildingHistoryFeature,
  BuildingType,
  BuildingWearKind,
  RoofPlan,
  StyleResolved,
  WallRun,
} from './blueprintTypes';
import { fnv1a, type SeedPath } from '../seedPath';

// ============================================================================
// Resolver Input
// ============================================================================
// Geometry is already canonical when it reaches this module. Palette arrays
// are pre-filtered to the building's wealth tier, preserving district finish.
// ============================================================================

export interface ResolveBuildingBackstoryInput {
  ageBand: BuildingAgeBand;
  buildingType: BuildingType;
  masses: readonly FootprintMass[];
  floors: readonly BlueprintFloor[];
  roof?: RoofPlan;
  style: Pick<
    StyleResolved,
    'wallColor' | 'roofColor' | 'trimColor' | 'districtSignature' | 'buildingVariant'
  >;
  allowedWallColors: readonly string[];
  allowedRoofColors: readonly string[];
}

interface WallSpanTarget {
  floorLevel: number;
  wallRunIndex: number;
  run: WallRun;
  lo: number;
  hi: number;
}

const AGE_WEAR_BUDGET: Readonly<Record<BuildingAgeBand, number>> = {
  new: 0,
  aged: 1,
  old: 2,
  ancient: 3,
};

const AGE_PHASE_CHANCE: Readonly<Record<BuildingAgeBand, number>> = {
  new: 0,
  aged: 0.35,
  old: 0.7,
  ancient: 0.9,
};

const AGE_MAX_PHASE: Readonly<Record<BuildingAgeBand, number>> = {
  new: 0,
  aged: 1,
  old: 2,
  ancient: 3,
};

// ============================================================================
// Named Determinism Helpers
// ============================================================================
// No sequential random stream is used here. Every concern owns a stable label,
// which lets later history vocabulary expand without rerolling old buildings.
// ============================================================================

function historyHash01(path: SeedPath, label: string): number {
  return fnv1a(`${path}|building-history|${label}`) / 0x1_0000_0000;
}

function pickByHash<T>(items: readonly T[], path: SeedPath, label: string): T {
  if (items.length === 0) {
    throw new Error(`resolveBuildingBackstory: no candidates for ${label}`);
  }
  const index = Math.min(
    items.length - 1,
    Math.floor(historyHash01(path, label) * items.length),
  );
  return items[index];
}

/** Choose a related repair material that remains inside the family vocabulary. */
function relatedMaterial(
  palette: readonly string[],
  current: string,
  trim: string,
  path: SeedPath,
  label: string,
): string {
  const alternatives = [...new Set([...palette, trim])]
    .filter((color) => color !== current);
  return alternatives.length > 0
    ? pickByHash(alternatives, path, label)
    : current;
}

// ============================================================================
// Safe Exterior Wall Spans
// ============================================================================
// Doors already split wall runs. Windows do not, so this section subtracts
// their openings before choosing a sealed doorway, patch, or scorch location.
// History dressing therefore never bars an active opening.
// ============================================================================

function runSpan(run: WallRun): [number, number] {
  return run.axis === 'x'
    ? [Math.min(run.x1, run.x2), Math.max(run.x1, run.x2)]
    : [Math.min(run.y1, run.y2), Math.max(run.y1, run.y2)];
}

function subtractOpening(
  spans: Array<[number, number]>,
  openingLo: number,
  openingHi: number,
): Array<[number, number]> {
  const next: Array<[number, number]> = [];
  for (const [lo, hi] of spans) {
    if (openingHi <= lo || openingLo >= hi) {
      next.push([lo, hi]);
      continue;
    }
    if (openingLo > lo) next.push([lo, Math.min(openingLo, hi)]);
    if (openingHi < hi) next.push([Math.max(openingHi, lo), hi]);
  }
  return next;
}

function availableWallTargets(
  floors: readonly BlueprintFloor[],
  minimumWidthFt: number,
  groundOnly: boolean,
): WallSpanTarget[] {
  const targets: WallSpanTarget[] = [];

  for (const floor of floors) {
    if (floor.level < 0 || (groundOnly && floor.level !== 0)) continue;

    floor.wallRuns.forEach((run, wallRunIndex) => {
      if (run.kind !== 'outer') return;
      const [runLo, runHi] = runSpan(run);
      const wallLineFt = run.axis === 'x' ? run.y1 : run.x1;
      let spans: Array<[number, number]> = [[runLo, runHi]];

      // A 3 ft window receives a 0.3 ft safety margin on each side. This keeps
      // projected repairs visibly clear of the glazing frame at render scale.
      for (const window of floor.windows) {
        if (window.axis !== run.axis) continue;
        const fixedFt = run.axis === 'x' ? window.y : window.x;
        if (Math.abs(fixedFt - wallLineFt) > 1e-6) continue;
        const centerFt = run.axis === 'x' ? window.x : window.y;
        spans = subtractOpening(spans, centerFt - 1.8, centerFt + 1.8);
      }

      for (const [lo, hi] of spans) {
        if (hi - lo >= minimumWidthFt + 0.4) {
          targets.push({ floorLevel: floor.level, wallRunIndex, run, lo, hi });
        }
      }
    });
  }

  return targets;
}

// ============================================================================
// Concrete Feature Resolution
// ============================================================================
// Each semantic wear kind becomes one exact blueprint target. The renderer is
// intentionally not allowed to reroll placement or material.
// ============================================================================

function wallFeature(
  kind: 'sealed-door' | 'patched-wall' | 'fire-scar',
  floors: readonly BlueprintFloor[],
  path: SeedPath,
  colorHex: string,
): BuildingHistoryFeature {
  const groundOnly = kind === 'sealed-door';
  const minimumWidthFt = kind === 'sealed-door' ? 3.5 : 2.5;
  const targets = availableWallTargets(floors, minimumWidthFt, groundOnly);
  const target = pickByHash(targets, path, `${kind}:wall-target`);
  const spanLengthFt = target.hi - target.lo;

  const desiredWidthFt = kind === 'sealed-door'
    ? 3.5
    : 2.5 + historyHash01(path, `${kind}:width`) * 2;
  const widthFt = Math.min(desiredWidthFt, spanLengthFt - 0.4);
  const travelFt = Math.max(0, spanLengthFt - widthFt - 0.4);
  const alongFt = target.lo + widthFt / 2 + 0.2
    + historyHash01(path, `${kind}:position`) * travelFt;

  if (kind === 'sealed-door') {
    return {
      kind,
      floorLevel: target.floorLevel,
      wallRunIndex: target.wallRunIndex,
      alongFt,
      widthFt,
      baseFt: 0.15,
      heightFt: 6.8,
      colorHex,
    };
  }

  if (kind === 'patched-wall') {
    const heightFt = 2.4 + historyHash01(path, 'patched-wall:height') * 2.2;
    return {
      kind,
      floorLevel: target.floorLevel,
      wallRunIndex: target.wallRunIndex,
      alongFt,
      widthFt,
      baseFt: 0.7 + historyHash01(path, 'patched-wall:base') * 2.2,
      heightFt,
      colorHex,
    };
  }

  return {
    kind,
    floorLevel: target.floorLevel,
    wallRunIndex: target.wallRunIndex,
    alongFt,
    widthFt,
    baseFt: 0.15,
    heightFt: 5.2 + historyHash01(path, 'fire-scar:height') * 2.4,
    colorHex,
  };
}

function resolveWearFeature(
  kind: BuildingWearKind,
  input: ResolveBuildingBackstoryInput,
  path: SeedPath,
): BuildingHistoryFeature {
  const wallRepairColor = relatedMaterial(
    input.allowedWallColors,
    input.style.wallColor,
    input.style.trimColor,
    path,
    `${kind}:wall-material`,
  );

  if (kind === 'sealed-door' || kind === 'patched-wall') {
    return wallFeature(kind, input.floors, path, wallRepairColor);
  }
  if (kind === 'fire-scar') {
    // Scorch is physical damage rather than a foreign construction material.
    // Its dark neutral is shared across families and only appears as thin marks.
    return wallFeature(kind, input.floors, path, '#34251f');
  }
  if (kind === 're-roofed') {
    const planes = input.roof?.planes ?? [];
    return {
      kind,
      planeIndex: Math.min(
        planes.length - 1,
        Math.floor(historyHash01(path, 're-roofed:plane') * planes.length),
      ),
      colorHex: relatedMaterial(
        input.allowedRoofColors,
        input.style.roofColor,
        input.style.trimColor,
        path,
        're-roofed:material',
      ),
    };
  }

  const ridges = input.roof?.ridges ?? [];
  return {
    kind,
    ridgeIndex: Math.min(
      ridges.length - 1,
      Math.floor(historyHash01(path, 'sagging-ridge:ridge') * ridges.length),
    ),
    deflectionFt: 0.35 + historyHash01(path, 'sagging-ridge:deflection') * 0.55,
    colorHex: input.style.roofColor,
  };
}

// ============================================================================
// Public Backstory Resolver
// ============================================================================
// Age controls the maximum amount of history, while named hashes choose which
// events occurred. New buildings remain clean; ancient buildings show several
// independent episodes without accumulating every possible effect.
// ============================================================================

export function resolveBuildingBackstory(
  input: ResolveBuildingBackstoryInput,
  path: SeedPath,
): BuildingBackstory {
  const phases = input.masses.slice(1).map((_, secondaryIndex) => {
    const chance = historyHash01(path, `phase:${secondaryIndex}:exists`);
    if (chance >= AGE_PHASE_CHANCE[input.ageBand]) return 0;
    const maxPhase = AGE_MAX_PHASE[input.ageBand];
    return 1 + Math.floor(
      historyHash01(path, `phase:${secondaryIndex}:number`) * maxPhase,
    );
  });

  const features: BuildingHistoryFeature[] = [];
  phases.forEach((phase, secondaryIndex) => {
    if (phase === 0) return;
    features.push({
      kind: 'later-phase',
      massIndex: secondaryIndex + 1,
      phase,
      colorHex: relatedMaterial(
        input.allowedWallColors,
        input.style.wallColor,
        input.style.trimColor,
        path,
        `phase:${secondaryIndex}:material`,
      ),
    });
  });

  // Only offer events that have a real target in this blueprint. This is not a
  // fallback: impossible events are absent from the building's valid history
  // vocabulary, so every selected event is guaranteed renderable.
  const candidates: BuildingWearKind[] = [];
  if (availableWallTargets(input.floors, 3.5, true).length > 0) {
    candidates.push('sealed-door');
  }
  if ((input.roof?.planes.length ?? 0) > 0) candidates.push('re-roofed');
  if ((input.roof?.ridges.length ?? 0) > 0) candidates.push('sagging-ridge');
  if (availableWallTargets(input.floors, 2.5, false).length > 0) {
    candidates.push('patched-wall', 'fire-scar');
  }

  const wear = candidates
    .map((kind) => ({ kind, score: historyHash01(path, `wear:${kind}`) }))
    .sort((a, b) => a.score - b.score || a.kind.localeCompare(b.kind))
    .slice(0, AGE_WEAR_BUDGET[input.ageBand])
    .map(({ kind }) => kind);

  for (const kind of wear) {
    features.push(resolveWearFeature(kind, input, path));
  }

  const signatureSource = JSON.stringify({
    ageBand: input.ageBand,
    buildingType: input.buildingType,
    district: input.style.districtSignature,
    building: input.style.buildingVariant,
    phases,
    features,
  });

  return {
    ageBand: input.ageBand,
    phases,
    wear,
    historySignature: fnv1a(`${path}|${signatureSource}`).toString(36),
    features,
  };
}

