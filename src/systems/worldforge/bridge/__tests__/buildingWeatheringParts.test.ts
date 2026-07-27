/**
 * These tests prove resolved age and exposure become bounded, valid 3D detail.
 *
 * The sample uses production building generation so weathering must survive the
 * full style pipeline before the bridge projects it onto canonical outer walls.
 * New and legacy buildings remain strict no-ops.
 */

import { describe, expect, it } from 'vitest';
import type { BuildingAgeBand, BuildingType, StyleContext } from '../../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../../interior/blueprintTypes';
import { generateBuilding } from '../../interior/generateBuilding';
import { rootSeedPath } from '../../seedPath';
import {
  buildBuildingWeatheringParts,
  type WeatheringDetailKind,
  WEATHERING_PART_TAG,
} from '../buildingWeatheringParts';
import { buildBlueprintParts, PERIMETER_WALL_COLORS } from '../interiorParts';

// ============================================================================
// Production Fixture
// ============================================================================

function styledBuilding(seed: number, ageBand: BuildingAgeBand) {
  const types: BuildingType[] = ['cottage', 'shop', 'smithy', 'inn', 'manor', 'temple'];
  const style: StyleContext = {
    cultureType: 'Generic',
    climate: 'temperate',
    wealth: 'common',
    ageBand,
    architecture: {
      settlementKey: 'burg:22',
      districtKey: 'district:market',
      buildingKey: `plot:${seed}`,
    },
  };
  return generateBuilding({
    buildingId: seed + 1,
    type: types[seed % types.length],
    seedPath: rootSeedPath(4700 + seed),
    storeys: 1 + (seed % 3),
    style,
  });
}

/** Attach a row receipt after generation; weathering reads only its ownership. */
function styledRowBuilding(owner: 'earlier-frontage-member' | 'later-frontage-member') {
  const blueprint = styledBuilding(29, 'ancient');
  blueprint.ensemble = {
    blockKey: 'ward:1:edge:3',
    kind: 'row',
    partyWallLeft: true,
    partyWallRight: true,
    partyWallOwner: owner,
    eaveStoreys: 3,
    ensembleSignature: 'weathering-party-wall-proof',
  };
  return blueprint;
}

const WALL_WEATHERING_KINDS: ReadonlySet<WeatheringDetailKind> = new Set([
  'wall-patina-band',
  'wall-weather-streak',
  'north-wall-grime',
]);

/** Largest RGB-channel change between two generated palette colors. */
function maximumChannelDelta(first: string, second: string): number {
  const channels = (hex: string) => [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(1 + offset, 3 + offset), 16));
  const firstChannels = channels(first);
  const secondChannels = channels(second);
  return Math.max(...firstChannels.map((channel, index) =>
    Math.abs(channel - secondChannels[index])));
}

// ============================================================================
// Projection Invariants
// ============================================================================

describe('buildBuildingWeatheringParts', () => {
  it('is deterministic, finite, tagged, and bounded across older buildings', () => {
    for (let seed = 0; seed < 48; seed++) {
      const blueprint = styledBuilding(seed, seed % 2 === 0 ? 'old' : 'ancient');
      const first = buildBuildingWeatheringParts(blueprint, 3);
      const replay = buildBuildingWeatheringParts(blueprint, 3);

      expect(replay).toEqual(first);
      expect(first.length).toBeGreaterThan(0);
      // Dressing-3 adds at most one north smear, three soot patches, three
      // valley marks, and two repair patches. The revised cap is still fixed
      // per building and never grows with roof or wall area.
      expect(first.length).toBeLessThanOrEqual(18);
      expect(first.every((part) =>
        part.tag === WEATHERING_PART_TAG
        && part.weatheringDetailKind.length > 0
        && Number.isFinite(part.x)
        && Number.isFinite(part.z)
        && Number.isFinite(part.baseY)
        && part.w > 0
        && part.d > 0
        && part.h > 0)).toBe(true);
      expect(first.some((part) => part.weatheringDetailKind === 'wall-patina-band')).toBe(true);
      expect(first.some((part) => part.weatheringDetailKind === 'roof-patina-edge')).toBe(true);
    }
  }, 20000);

  it('reaches the shared blueprint-to-3D bridge with semantic tags intact', () => {
    const blueprint = styledBuilding(9, 'ancient');
    const output = buildBlueprintParts(blueprint, 3, PERIMETER_WALL_COLORS.house, false);
    const weathering = output.parts.filter((part) => part.tag === WEATHERING_PART_TAG);

    expect(weathering).toEqual(buildBuildingWeatheringParts(blueprint, 3));
    expect(weathering.length).toBeGreaterThan(0);
  });

  it('is a strict no-op for new construction and unstyled legacy plans', () => {
    expect(buildBuildingWeatheringParts(styledBuilding(1, 'new'), 3)).toEqual([]);
    const legacy = generateBuilding({
      buildingId: 1,
      type: 'cottage',
      seedPath: rootSeedPath(1),
    });
    expect(buildBuildingWeatheringParts(legacy, 3)).toEqual([]);
  });

  it('scales bounded detail through the ordered age bands without moving the building', () => {
    const ages: BuildingAgeBand[] = ['new', 'aged', 'old', 'ancient'];
    const counts = ages.map((ageBand) =>
      buildBuildingWeatheringParts(styledBuilding(29, ageBand), 3).length);

    expect(counts[0]).toBe(0);
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[3]).toBeGreaterThan(counts[2]);
    expect(counts[3]).toBeLessThanOrEqual(18);
  });

  it('projects all production weathering effects from real roof and wall facts', () => {
    const seen = new Set<WeatheringDetailKind>();

    // Different production footprints provide chimneys, wing valleys, and
    // simple ridges. The scan proves every brief effect has an actual bridge
    // output, while each individual building remains bounded.
    for (let seed = 0; seed < 96; seed++) {
      const parts = buildBuildingWeatheringParts(styledBuilding(seed, 'ancient'), 3);
      parts.forEach((part) => seen.add(part.weatheringDetailKind));
    }

    expect(seen).toEqual(new Set<WeatheringDetailKind>([
      'wall-patina-band',
      'wall-weather-streak',
      'north-wall-grime',
      'roof-patina-edge',
      'roof-valley-grime',
      'roof-soot-patch',
      'roof-repair-patch',
    ]));
  }, 20000);

  // ==========================================================================
  // Burial Regression (town-look-slice1 follow-up, 2026-07-18)
  // ==========================================================================
  // Structural wall boxes grow OUTWARD from the run line by the FULL thickness
  // (runBox in buildingModels.ts — the line is the wall's INNER face), so any
  // mark offset smaller than that thickness hides inside the slab: receipts
  // without pixels. Every wall mark must seat its inner face exactly on the
  // OUTER face of the run it decorates — outside the slab, still attached.
  // ==========================================================================

  it('seats every mark on the outer face of its wall run, outside the slab', () => {
    const FT = 0.3048;
    for (let seed = 0; seed < 48; seed++) {
      const blueprint = styledBuilding(seed, seed % 2 === 0 ? 'old' : 'ancient');
      const parts = buildBuildingWeatheringParts(blueprint, 3);
      const origin = blueprintSiteOrigin(blueprint);
      const outerRuns = blueprint.floors
        .find((floor) => floor.level === 0)!
        .wallRuns.filter((run) => run.kind === 'outer');
      expect(parts.length).toBeGreaterThan(0);

      for (const part of parts.filter((candidate) =>
        WALL_WEATHERING_KINDS.has(candidate.weatheringDetailKind))) {
        // Recover the decorated run from geometry alone: matching axis and the
        // mark's along-center inside the run's span. Marks are always longer
        // along their wall than their 0.16 ft depth, so w vs d gives the axis.
        const alongX = part.w > part.d;
        const alongCenterFt = (alongX ? part.x : part.z) / FT
          + (alongX ? origin.x : origin.y);
        const planeM = alongX ? part.z : part.x;
        const seated = outerRuns.some((run) => {
          if ((run.axis === 'x') !== alongX) return false;
          const [lo, hi] = run.axis === 'x'
            ? [Math.min(run.x1, run.x2), Math.max(run.x1, run.x2)]
            : [Math.min(run.y1, run.y2), Math.max(run.y1, run.y2)];
          if (alongCenterFt < lo - 1e-6 || alongCenterFt > hi + 1e-6) return false;
          const n = alongX ? run.ny : run.nx;
          const line = alongX ? run.y1 : run.x1;
          const wallOuterM = (line - (alongX ? origin.y : origin.x)
            + n * run.thicknessFt) * FT;
          const innerFaceM = planeM - n * ((alongX ? part.d : part.w) / 2);
          // Outside the slab (inner face at or beyond the wall's outer face)
          // AND flush against it (attached, not floating off the building).
          return n * (innerFaceM - wallOuterM) >= -1e-6
            && Math.abs(innerFaceM - wallOuterM) <= 1e-6;
        });
        expect(seated, `seed ${seed} ${part.weatheringDetailKind}`).toBe(true);
      }
    }
  }, 20000);

  it('never places ground patina on the neighbor-owned party wall', () => {
    for (const owner of ['earlier-frontage-member', 'later-frontage-member'] as const) {
      const blueprint = styledRowBuilding(owner);
      const hiddenSign = owner === 'earlier-frontage-member' ? -1 : 1;
      const sidePatina = buildBuildingWeatheringParts(blueprint, 3).filter((part) =>
        WALL_WEATHERING_KINDS.has(part.weatheringDetailKind) && part.w < part.d);

      expect(sidePatina.every((part) => Math.sign(part.x) !== hiddenSign)).toBe(true);
    }
  });

  it('keeps every roof mark finite, near the solved roof, and inside a bounded envelope', () => {
    const FT = 0.3048;
    for (let seed = 0; seed < 48; seed++) {
      const blueprint = styledBuilding(seed, 'ancient');
      const origin = blueprintSiteOrigin(blueprint);
      const wallTopM = blueprint.floors.filter((floor) => floor.level >= 0).length * 3;
      const roofMarks = buildBuildingWeatheringParts(blueprint, 3).filter((part) =>
        !WALL_WEATHERING_KINDS.has(part.weatheringDetailKind));

      expect(roofMarks.length).toBeGreaterThan(0);
      expect(roofMarks.every((part) =>
        Math.abs(part.x / FT) <= blueprint.widthFt / 2 + 3
        && Math.abs(part.z / FT) <= blueprint.depthFt / 2 + 3
        && part.baseY >= wallTopM - 0.3
        && Math.abs(part.x / FT + origin.x) <= blueprint.widthFt + 3
        && Math.abs(part.z / FT + origin.y) <= blueprint.depthFt + 3)).toBe(true);

      // A repair represents a handful of mismatched shingles, not a raised
      // board. Its color stays visibly related to the building's own stock.
      const repairs = roofMarks.filter((part) =>
        part.weatheringDetailKind === 'roof-repair-patch');
      expect(repairs.every((part) =>
        part.w / FT <= 1.01
        && part.d / FT <= 0.76
        && part.h / FT <= 0.061
        && maximumChannelDelta(
          part.colorHex,
          blueprint.styleResolved!.roofColor,
        ) <= 22)).toBe(true);
    }
  }, 20000);
});
