import { describe, it, expect } from 'vitest';
import {
  canonicalTownSeedPath,
  getCanonicalTownPlan,
  transformTownPlan,
  peopleForBurg,
  townSpanFtForBurg,
  CANON_TOWN_SPAN,
  getCanonicalTownPersonality,
  FMG_BIOME_TO_VILLAGE_STYLE,
} from '../canonicalTown';
import { polygonBounds } from '../../submap/submapEngine';

/** Minimal atlas fixture: one burg (id 1) in cell 0, a square cell polygon.
 *  population is in FMG POINTS — 2 points × 1000 = 2000 people ⇒ walled town. */
function makeAtlas(): any {
  return {
    pack: {
      burgs: [undefined, { i: 1, cell: 0, x: 100, y: 100, population: 2 }],
      cells: { v: [[0, 1, 2, 3]], burg: [1] },
      vertices: { p: [[60, 60], [140, 60], [140, 140], [60, 140]] },
    },
  };
}

describe('canonicalTownSeedPath', () => {
  it('is stable and burg/world addressed (drill-path independent)', () => {
    expect(canonicalTownSeedPath(42, 7)).toBe('wf:42/burg:7/s:town');
    expect(canonicalTownSeedPath(42, 7)).toBe(canonicalTownSeedPath(42, 7));
    expect(canonicalTownSeedPath(42, 7)).not.toBe(canonicalTownSeedPath(43, 7));
  });
});

describe('getCanonicalTownPlan', () => {
  it('generates a walled, warded town in the normalized frame', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    expect(plan.wards.length).toBeGreaterThan(0);
    expect(plan.plots.length).toBeGreaterThan(0);
    expect(plan.walls.ring.length).toBeGreaterThanOrEqual(3); // pop 1200 ⇒ walls
    // Normalized: footprint longest side ≈ CANON_TOWN_SPAN, centered near origin.
    const b = polygonBounds(plan.footprint);
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    expect(span).toBeCloseTo(CANON_TOWN_SPAN, 0);
    expect(Math.abs((b.minX + b.maxX) / 2)).toBeLessThan(1);
    expect(Math.abs((b.minY + b.maxY) / 2)).toBeLessThan(1);
  });

  it('is deterministic: two identical atlases ⇒ structurally identical plans', () => {
    const a = getCanonicalTownPlan(makeAtlas(), 42, 1);
    const b = getCanonicalTownPlan(makeAtlas(), 42, 1); // separate object ⇒ bypasses the cache
    expect(b.plots.length).toBe(a.plots.length);
    expect(b.wards.length).toBe(a.wards.length);
    expect(b.walls.ring).toEqual(a.walls.ring);
    expect(b.footprint).toEqual(a.footprint);
  });

  it('caches per (atlas, burgId)', () => {
    const atlas = makeAtlas();
    expect(getCanonicalTownPlan(atlas, 42, 1)).toBe(getCanonicalTownPlan(atlas, 42, 1));
  });
});

/**
 * makeAtlas + a road crossing the cell and a river running through its centre.
 *
 * Cell arrays are DENSE here, as they are in a real FMG pack. They used to be
 * sparse object literals keyed by cell id, which was enough while the town only
 * read the three cells it named. Since 2026-07-29 the town routes its river with
 * the region tier's own terrain sampler, which walks every cell to build the
 * interpolation set, so the fixture has to look like the data it stands in for.
 */
function makeAtlasWithWaterAndRoads(): any {
  const CELLS = 52;
  const p: Array<[number, number]> = [];
  const h: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    // Filler cells sit well away from the town so they never win the IDW, but
    // they do give the sampler a populated neighborhood to interpolate over.
    p.push([100 + (i % 8) * 40, 100 + Math.floor(i / 8) * 40]);
    h.push(30); // land (FMG water is < 20)
  }
  p[0] = [100, 100];
  p[50] = [100, 40];
  p[51] = [100, 220];

  return {
    pack: {
      burgs: [undefined, { i: 1, cell: 0, x: 100, y: 100, population: 2 }],
      cells: {
        v: [[0, 1, 2, 3]],
        burg: [1],
        p,
        h,
        harbor: { 0: 0 },
        // Which river each cell carries. FMG always populates this for river
        // cells, and the town reads it to find the river it should inherit at
        // true scale — the atlas's own statement of which river this burg sits
        // on, rather than a re-derivation from cell membership.
        r: { 0: 7, 50: 7, 51: 7 },
      },
      vertices: { p: [[60, 60], [140, 60], [140, 140], [60, 140]] },
      // River flows 50 → cell 0 → 51, a vertical line through the town centre.
      rivers: [{ i: 7, cells: [50, 0, 51], discharge: 4 }],
      // A road crossing the cell horizontally.
      routes: [{ group: 'roads', points: [[0, 100], [200, 100] ] }],
    },
  };
}

describe('getCanonicalTownPlan — inherited water/roads (follow-up #1)', () => {
  it('continues an inherited road into a main street', () => {
    const plan = getCanonicalTownPlan(makeAtlasWithWaterAndRoads(), 42, 1);
    expect(plan.streets.length).toBeGreaterThan(0);
  });

  it('seats docks where an inherited river crosses the town', () => {
    const plan = getCanonicalTownPlan(makeAtlasWithWaterAndRoads(), 42, 1);
    expect(plan.wards.some((w) => w.civic === 'dock')).toBe(true);
  });

  it('produces no docks/streets for an inland burg with no rivers or roads', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    expect(plan.streets.length).toBe(0);
    expect(plan.wards.some((w) => w.civic === 'dock')).toBe(false);
  });
});

describe('transformTownPlan', () => {
  it('scales + translates every coordinate (the 3D placement step)', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    const k = 3, dx = 1000, dy = 2000;
    const out = transformTownPlan(plan, k, dx, dy);
    // A representative point maps by the affine transform.
    expect(out.footprint[0][0]).toBeCloseTo(plan.footprint[0][0] * k + dx, 6);
    expect(out.footprint[0][1]).toBeCloseTo(plan.footprint[0][1] * k + dy, 6);
    // Top-level plots stay ref-identical to the flattened wards[].plots
    // (townEngine contract; some wards — e.g. a plaza — carry no plots).
    const flat = out.wards.flatMap((w) => w.plots);
    expect(out.plots.length).toBe(flat.length);
    out.plots.forEach((p, i) => expect(p).toBe(flat[i]));
    // Wall ring scales too.
    if (plan.walls.ring.length) {
      expect(out.walls.ring[0][0]).toBeCloseTo(plan.walls.ring[0][0] * k + dx, 6);
    }
    // Shared courts scale with the same affine while their district use remains
    // canonical across the normalized 2D and region-feet 3D frames.
    if (plan.courtyards.length) {
      expect(out.courtyards[0].center[0]).toBeCloseTo(plan.courtyards[0].center[0] * k + dx, 6);
      expect(out.courtyards[0].center[1]).toBeCloseTo(plan.courtyards[0].center[1] * k + dy, 6);
      expect(out.courtyards[0].radius).toBeCloseTo(plan.courtyards[0].radius * k, 6);
      expect(out.courtyards[0].amenity).toBe(plan.courtyards[0].amenity);
      expect(out.courtyards[0].courtyardSignature).toBe(plan.courtyards[0].courtyardSignature);
    }
  });

  it('round-trips back to the source plan (identity proof)', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    const k = 7.5, dx = 500, dy = -300;
    const fwd = transformTownPlan(plan, k, dx, dy);
    const back = transformTownPlan(fwd, 1 / k, -dx / k, -dy / k);
    for (let i = 0; i < plan.footprint.length; i++) {
      expect(back.footprint[i][0]).toBeCloseTo(plan.footprint[i][0], 4);
      expect(back.footprint[i][1]).toBeCloseTo(plan.footprint[i][1], 4);
    }
  });

  it('preserves social and architecture identity while transforming geometry', () => {
    const plan = getCanonicalTownPlan(makeAtlas(), 42, 1);
    const out = transformTownPlan(plan, 3, 1000, 2000);

    expect(out.wards.map((ward) => ward.wealth)).toEqual(
      plan.wards.map((ward) => ward.wealth),
    );
    expect(out.wards.map((ward) => ward.architectureDistrict)).toEqual(
      plan.wards.map((ward) => ward.architectureDistrict),
    );
    expect(out.plots.map((plot) => plot.architectureKey)).toEqual(
      plan.plots.map((plot) => plot.architectureKey),
    );
    expect(out.courtyards.map((court) => ({
      districtKey: court.districtKey,
      amenity: court.amenity,
      signature: court.courtyardSignature,
    }))).toEqual(plan.courtyards.map((court) => ({
      districtKey: court.districtKey,
      amenity: court.amenity,
      signature: court.courtyardSignature,
    })));
  });
});

describe('population scaling', () => {
  it('peopleForBurg scales FMG points by the population rate (1000)', () => {
    expect(peopleForBurg(makeAtlas(), 1)).toBe(2000); // 2 points × 1000
  });
  it('townSpanFtForBurg clamps to a walkable [800, 6000] ft range', () => {
    const span = townSpanFtForBurg(makeAtlas(), 1);
    expect(span).toBeGreaterThanOrEqual(800);
    expect(span).toBeLessThanOrEqual(6000);
  });
});

/**
 * A burg with the two atlas facts the personality derivation reads that the
 * plain fixture above does not carry: an FMG culture (whose `type` decides the
 * culture, architecture and industry facets) and a cell biome id (which decides
 * the biome style the profile table is keyed on).
 *
 * Every burg sits in cell 0 so they share one footprint — the point of these
 * tests is the FLAVOR the atlas facts resolve to, not the geometry.
 */
function makePersonalityAtlas(opts: {
  biome: number;
  cultureType?: string;
  port?: boolean;
  population?: number;
}): any {
  const atlas = {
    pack: {
      burgs: [undefined, {
        i: 1,
        cell: 0,
        x: 100,
        y: 100,
        population: opts.population ?? 2,
        culture: 1,
        port: opts.port ? 1 : 0,
      }],
      cultures: [{ i: 0, type: 'Generic' }, { i: 1, type: opts.cultureType ?? 'Generic' }],
      cells: { v: [[0, 1, 2, 3]], burg: [1], biome: [opts.biome] },
      vertices: { p: [[60, 60], [140, 60], [140, 140], [60, 140]] },
    },
  };
  return atlas;
}

describe('getCanonicalTownPersonality', () => {
  it('resolves DIFFERENT profiles for burgs in different biomes', () => {
    // Tundra (FMG biome 10) against tropical rainforest (FMG biome 7). The task
    // asked for tundra against volcanic; no FMG biome maps to `volcanic`, which
    // is exactly what FMG_BIOME_TO_VILLAGE_STYLE documents, so the jungle band
    // stands in as the second biome that a real atlas can actually produce.
    const tundra = getCanonicalTownPersonality(makePersonalityAtlas({ biome: 10 }), 42, 1);
    const jungle = getCanonicalTownPersonality(makePersonalityAtlas({ biome: 7 }), 42, 1);

    expect(tundra.personality.biomeStyle).toBe('tundra');
    expect(jungle.personality.biomeStyle).toBe('jungle');
    expect(tundra.profile.id).not.toBe(jungle.profile.id);
    // Both must read with their OWN biome flavor, not snap to the temperate
    // default — the claim the Plan Map made about code no player could reach.
    expect(tundra.profile.id).toContain('tundra');
    expect(jungle.profile.id).toContain('jungle');
    expect(tundra.profile.tagline).not.toBe(jungle.profile.tagline);
    expect(tundra.profile.encounterHooks.length).toBeGreaterThan(0);
  });

  it('is deterministic: the same (worldSeed, burgId) gives the same profile twice', () => {
    // Separate atlas objects ⇒ the memo cache is bypassed and the derivation
    // actually re-runs.
    const a = getCanonicalTownPersonality(makePersonalityAtlas({ biome: 10 }), 42, 1);
    const b = getCanonicalTownPersonality(makePersonalityAtlas({ biome: 10 }), 42, 1);
    expect(b.profile).toEqual(a.profile);
    expect(b.personality).toEqual(a.personality);
  });

  it('caches per (atlas, burgId)', () => {
    const atlas = makePersonalityAtlas({ biome: 6 });
    expect(getCanonicalTownPersonality(atlas, 42, 1)).toBe(getCanonicalTownPersonality(atlas, 42, 1));
  });

  it('reads a port as coastal whatever grows inland of it', () => {
    const inland = getCanonicalTownPersonality(makePersonalityAtlas({ biome: 10 }), 42, 1);
    const harbour = getCanonicalTownPersonality(makePersonalityAtlas({ biome: 10, port: true }), 42, 1);
    expect(inland.personality.biomeStyle).toBe('tundra');
    expect(harbour.personality.biomeStyle).toBe('coastal');
  });

  it('reads an upland culture as highland, and carries its trade and government', () => {
    const { personality, profile } = getCanonicalTownPersonality(
      makePersonalityAtlas({ biome: 4, cultureType: 'Highland' }), 42, 1,
    );
    expect(personality.biomeStyle).toBe('highland');
    expect(personality.culture).toBe('martial');
    expect(personality.primaryIndustry).toBe('mining');
    // 2 population points x 1000 = 2000 people ⇒ walled town ⇒ a council.
    expect(personality.governingBody).toBe('council');
    expect(personality.population).toBe('medium');
    expect(profile.id).toContain('highland');
  });

  it('bands population from the burg typology', () => {
    const hamlet = getCanonicalTownPersonality(makePersonalityAtlas({ biome: 4, population: 0.05 }), 42, 1);
    const city = getCanonicalTownPersonality(makePersonalityAtlas({ biome: 4, population: 12 }), 42, 1);
    expect(hamlet.personality.population).toBe('small');
    expect(hamlet.personality.governingBody).toBe('elder');
    expect(city.personality.population).toBe('large');
    expect(city.personality.governingBody).toBe('guild');
  });

  it('throws rather than defaulting on an unmapped biome id', () => {
    expect(() => getCanonicalTownPersonality(makePersonalityAtlas({ biome: 99 }), 42, 1))
      .toThrow(/No settlement biome style for FMG biome id 99/);
  });

  it('throws rather than defaulting on an unknown culture type', () => {
    expect(() => getCanonicalTownPersonality(makePersonalityAtlas({ biome: 4, cultureType: 'Sylvan' }), 42, 1))
      .toThrow(/No settlement personality for culture type "Sylvan"/);
  });

  it('covers the whole closed FMG biome vocabulary (ids 0-12)', () => {
    for (let id = 0; id <= 12; id++) {
      expect(FMG_BIOME_TO_VILLAGE_STYLE[id], `biome ${id}`).toBeTruthy();
    }
    expect(Object.keys(FMG_BIOME_TO_VILLAGE_STYLE)).toHaveLength(13);
  });
});
