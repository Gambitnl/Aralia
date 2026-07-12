import { describe, it, expect } from 'vitest';
import { buildAtlasTravelGraph, buildRoadCells, buildNavInfoFn, atlasMilesPerUnit, transportMobility, nearestLandCell } from '../atlasTravelGraph';
import { planFastestRoute } from '../../../travel/routePlanning';
import { STANDARD_VEHICLES } from '../../../../types/travel';
import { FOREST_NAV_DC_BUMP } from '../../forests/forestTunables';

// Minimal atlas stub: 3 land cells in a line + 1 water cell. Cell 1 has a road.
const atlas = {
  graphWidth: 1000,
  biomesData: { name: ['Marine', 'Grassland', 'Glacier'] },
  pack: {
    cells: {
      c: [[1], [0, 2], [1, 3], [2]],          // adjacency
      p: [[0, 0], [10, 0], [20, 0], [30, 0]], // centroids
      h: [50, 50, 50, 5],                      // cells 0-2 land, cell 3 water
      biome: [1, 1, 2, 0],                     // cell 2 = Glacier (difficult), cell 3 = Marine
    },
    routes: [{ group: 'roads', cells: [1] }],  // cell 1 is on a road (FMG group → tier)
  },
} as any;

describe('buildRoadCells', () => {
  it('collects all cells on land routes', () => {
    expect(buildRoadCells(atlas)).toEqual(new Set([1]));
  });
});

describe('atlasMilesPerUnit', () => {
  it('falls back to a continent-sized scale when no distanceScale', () => {
    expect(atlasMilesPerUnit(atlas)).toBeCloseTo(3, 6); // 3000 / 1000
  });
  it('uses distanceScale (km→mi) when present', () => {
    expect(atlasMilesPerUnit({ ...atlas, distanceScale: 2 } as any)).toBeCloseTo(2 * 0.621371, 6);
  });
});

describe('buildAtlasTravelGraph', () => {
  const g = buildAtlasTravelGraph(atlas);

  it('maps neighbors, positions, terrain (road/difficult/open) and passability', () => {
    expect(g.neighbors(1)).toEqual([0, 2]);
    expect(g.position(2)).toEqual([20, 0]);
    expect(g.terrain(1)).toBe('road');       // on a route
    expect(g.terrain(2)).toBe('difficult');  // Glacier
    expect(g.terrain(0)).toBe('open');       // Grassland
    expect(g.passable(2)).toBe(true);        // land
    expect(g.passable(3)).toBe(false);       // water
  });

  it('halves danger on road cells vs wilderness', () => {
    expect(g.danger!(0)).toBeCloseTo(0.2, 6);   // Grassland baseline
    expect(g.danger!(1)).toBeCloseTo(0.1, 6);   // Grassland on road = ×0.5
    expect(g.danger!(2)).toBeCloseTo(0.6, 6);   // Glacier baseline
  });

  it('plans a route over the atlas graph that stops at the water edge', () => {
    const r = planFastestRoute(g, 0, 2, { milesPerUnit: 0.1, speedMph: 3 })!;
    expect(r.cells).toEqual([0, 1, 2]);
    expect(r.danger).toBeCloseTo(0.6, 6); // max along route (the Glacier cell)
    // Cell 3 (water) is unreachable for land travel.
    expect(planFastestRoute(g, 0, 3, { milesPerUnit: 0.1, speedMph: 3 })).toBeNull();
  });
});

describe('nearestLandCell', () => {
  it('returns the cell itself when already land', () => {
    expect(nearestLandCell(atlas, 0)).toBe(0); // cell 0 is land (h=50)
  });
  it('snaps a sea cell to its nearest land neighbor', () => {
    // cell 3 is water (h=5); its neighbor cell 2 is land (h=50).
    expect(nearestLandCell(atlas, 3)).toBe(2);
  });
});

// Graded road mechanics (2026-07-11 road systems): routes carry FMG groups, and
// generated routes expose their path as [x, y, cellId] points, not cell lists.
describe('graded road mechanics (2026-07-11 road systems)', () => {
  // 3 LOWLAND cells in a row (h 30 — the mountains highland band starts at 50,
  // and this suite pins the height-free biome/tier ladder); routes per case.
  const makeAtlas = (biomeName: string, routes: unknown[]): any => ({
    graphWidth: 1000,
    biomesData: { name: ['Marine', biomeName] },
    pack: {
      cells: {
        c: [[1], [0, 2], [1]],
        p: [[0, 0], [10, 0], [20, 0]],
        h: [30, 30, 30],
        biome: [1, 1, 1],
      },
      routes,
    },
  });

  it('detects road cells from points-only generated routes', () => {
    const g = buildAtlasTravelGraph(makeAtlas('Temperate deciduous forest', [
      { group: 'roads', points: [[10, 0, 1]] },
    ]));
    expect(g.terrain(1)).toBe('road');               // was 'open' before the points fix
    expect(g.speedFactor!(1)).toBeCloseTo(1.25, 6);  // road tier speed, biome penalty cleared
  });

  it('grades off-road speed by biome instead of the old binary difficult set', () => {
    const g = buildAtlasTravelGraph(makeAtlas('Temperate deciduous forest', []));
    expect(g.speedFactor!(0)).toBeCloseTo(0.75, 6);  // deciduous forest off-road
  });

  it('scales danger down on routes by tier, not a flat halving', () => {
    const road = buildAtlasTravelGraph(makeAtlas('Grassland', [{ group: 'roads', cells: [1] }]));
    expect(road.danger!(1)).toBeCloseTo(0.2 * 0.5, 6);  // Grassland baseline × road mult
    expect(road.danger!(0)).toBeCloseTo(0.2, 6);        // off-route keeps the biome baseline
    const trail = buildAtlasTravelGraph(makeAtlas('Grassland', [{ group: 'trails', cells: [1] }]));
    expect(trail.terrain(1)).toBe('trail');
    expect(trail.danger!(1)).toBeCloseTo(0.2 * 0.7, 6); // trails are patrolled less
  });

  it('keeps water/air mobility ungraded: speedFactor 1, biome-baseline danger', () => {
    const roadAtlas = makeAtlas('Grassland', [{ group: 'roads', cells: [1] }]);
    for (const mobility of ['water', 'air'] as const) {
      const g = buildAtlasTravelGraph(roadAtlas, { mobility });
      expect(g.speedFactor!(1)).toBe(1);
      expect(g.danger!(1)).toBeCloseTo(0.2, 6); // no road tier scaling at sea / aloft
    }
  });

  it('buildRoadCells reads points-only routes and ignores searoutes', () => {
    const set = buildRoadCells(makeAtlas('Grassland', [
      { group: 'roads', points: [[10, 0, 1]] },
      { group: 'searoutes', cells: [2] },
    ]));
    expect(set).toEqual(new Set([1]));
  });

  it('exposes per-cell nav DCs and causes for navDrift (buildNavInfoFn)', () => {
    const onRoad = buildNavInfoFn(makeAtlas('Grassland', [{ group: 'roads', cells: [1] }]));
    expect(onRoad(1)).toEqual({ dc: 0, cause: 'road' });      // roads never lose you
    expect(onRoad(0)).toEqual({ dc: 5, cause: 'wilds' });     // open wilderness
    const offRoad = buildNavInfoFn(makeAtlas('Glacier', []));
    expect(offRoad(0)).toEqual({ dc: 15, cause: 'wilds' });   // difficult wilderness
    const faint = buildNavInfoFn(makeAtlas('Taiga', [{ group: 'paths', cells: [1] }]));
    expect(faint(1)).toEqual({ dc: 12, cause: 'faint-path' }); // overgrown deep-forest path
  });
});

// Haunted/fey woods actively mislead travelers (2026-07-11 forests campaign):
// named forests on the pack raise the getting-lost DC by FOREST_NAV_DC_BUMP —
// but a maintained road (dc 0) NEVER starts losing people just because the
// trees around it are spooky.
describe('haunted/fey forest nav DC bump (2026-07-11 forests)', () => {
  // Lowland heights (h 30): the elevation nav bumps (h >= 50) have their own
  // suite below — these cases isolate the forest bump on the base ladder.
  const makeForestAtlas = (biomeName: string, routes: unknown[], forests?: unknown[]): any => ({
    graphWidth: 1000,
    biomesData: { name: ['Marine', biomeName] },
    pack: {
      cells: {
        c: [[1], [0, 2], [1]],
        p: [[0, 0], [10, 0], [20, 0]],
        h: [30, 30, 30],
        biome: [1, 1, 1],
      },
      routes,
      forests,
    },
  });
  /** One named wood covering all three cells. */
  const wood = (kind: string): unknown[] => [{ i: 1, name: 'Testwood', kind, cells: [0, 1, 2] }];

  it('bumps the off-road wilds DC inside a haunted forest (cause unchanged)', () => {
    const nav = buildNavInfoFn(makeForestAtlas('Temperate deciduous forest', [], wood('haunted')));
    expect(nav(0)).toEqual({ dc: 5 + FOREST_NAV_DC_BUMP, cause: 'wilds' });
  });

  it('bumps a fey forest the same way', () => {
    const nav = buildNavInfoFn(makeForestAtlas('Temperate deciduous forest', [], wood('fey')));
    expect(nav(0)).toEqual({ dc: 5 + FOREST_NAV_DC_BUMP, cause: 'wilds' });
  });

  it('never bumps dc 0: a maintained road through a haunted wood stays unlosable', () => {
    const nav = buildNavInfoFn(
      makeForestAtlas('Temperate deciduous forest', [{ group: 'roads', cells: [1] }], wood('haunted')),
    );
    expect(nav(1)).toEqual({ dc: 0, cause: 'road' });
  });

  it('bumps an on-route dc > 0 (overgrown taiga path) through a haunted wood, cause preserved', () => {
    const nav = buildNavInfoFn(makeForestAtlas('Taiga', [{ group: 'paths', cells: [1] }], wood('haunted')));
    expect(nav(1)).toEqual({ dc: 12 + FOREST_NAV_DC_BUMP, cause: 'faint-path' });
  });

  it('ordinary and ancient forests never bump (escalate-only)', () => {
    for (const kind of ['ordinary', 'ancient']) {
      const nav = buildNavInfoFn(makeForestAtlas('Temperate deciduous forest', [], wood(kind)));
      expect(nav(0)).toEqual({ dc: 5, cause: 'wilds' });
    }
  });

  it('cells outside the named forest keep their DC even when the pack has forests', () => {
    const nav = buildNavInfoFn(makeForestAtlas('Grassland', [], [
      { i: 1, name: 'Testwood', kind: 'haunted', cells: [2] },
    ]));
    expect(nav(0)).toEqual({ dc: 5, cause: 'wilds' });                      // off-forest
    expect(nav(2)).toEqual({ dc: 5 + FOREST_NAV_DC_BUMP, cause: 'wilds' }); // in the wood
  });

  it('a pack without forests is untouched (roads-era fixtures stay valid)', () => {
    const nav = buildNavInfoFn(makeForestAtlas('Glacier', []));
    expect(nav(0)).toEqual({ dc: 15, cause: 'wilds' });
  });
});

// High-country mechanics (2026-07-11 mountains): the land graph derives a
// per-edge climbFactor from cell heights (tier-softened), and trackless
// highland raises the getting-lost DC — graded passes are how you cross a
// range fast AND found.
const makeHeightAtlas = (biomeName: string, routes: unknown[], h: number[], forests?: unknown[]): any => ({
  graphWidth: 1000,
  biomesData: { name: ['Marine', biomeName] },
  pack: {
    cells: {
      c: [[1], [0, 2], [1]],
      p: [[0, 0], [10, 0], [20, 0]],
      h,
      biome: [1, 1, 1],
    },
    routes,
    forests,
  },
});

describe('edge climb factor wiring (2026-07-11 mountains)', () => {
  it('derives climbFactor from cell heights: the ascent is slower than the descent back', () => {
    const g = buildAtlasTravelGraph(makeHeightAtlas('Grassland', [], [30, 60, 30]));
    expect(g.climbFactor!(0, 1)).toBeCloseTo(1 / (1 + 0.05 * 30), 6);  // +30h climb
    expect(g.climbFactor!(1, 2)).toBeCloseTo(1 / (1 + 0.015 * 30), 6); // −30h descent
    expect(g.climbFactor!(0, 1)).toBeLessThan(g.climbFactor!(1, 2));
  });

  it('softens the grade by the DESTINATION cell tier (engineered road up the ridge)', () => {
    const g = buildAtlasTravelGraph(makeHeightAtlas('Grassland', [{ group: 'roads', cells: [1] }], [30, 60, 30]));
    expect(g.climbFactor!(0, 1)).toBeCloseTo(1 / (1 + 0.05 * 15), 6); // Δh 30 halved on a road
    expect(g.climbFactor!(1, 2)).toBeCloseTo(1 / (1 + 0.015 * 30), 6); // off-road descent unsoftened
  });

  it('water and air mobility ignore relief entirely (constant factor 1)', () => {
    const atlas = makeHeightAtlas('Grassland', [], [30, 60, 30]);
    for (const mobility of ['water', 'air'] as const) {
      const g = buildAtlasTravelGraph(atlas, { mobility });
      expect(g.climbFactor!(0, 1)).toBe(1);
      expect(g.climbFactor!(1, 2)).toBe(1);
    }
  });

  it('climbing shows up in planned minutes (a ridge route costs more than a flat one)', () => {
    const opts = { milesPerUnit: 0.1, speedMph: 3 };
    const flat = planFastestRoute(buildAtlasTravelGraph(makeHeightAtlas('Grassland', [], [30, 30, 30])), 0, 2, opts)!;
    const ridge = planFastestRoute(buildAtlasTravelGraph(makeHeightAtlas('Grassland', [], [30, 60, 30])), 0, 2, opts)!;
    expect(ridge.minutes).toBeGreaterThan(flat.minutes);
  });
});

describe('high-country navigation DC bumps (2026-07-11 mountains)', () => {
  const nav = (biome: string, routes: unknown[], h: number[], forests?: unknown[]) =>
    buildNavInfoFn(makeHeightAtlas(biome, routes, h, forests));

  it('trackless crag country (h ≥ 70) navigates as difficult wilderness regardless of biome', () => {
    // Controller ruling (monotonicity): the crag rule is bump-then-floor —
    // max(dc + HIGHLAND_NAV_DC_BUMP, 15) — so a plain biome hits the floor
    // while a difficult biome keeps its bump above the band edge.
    expect(nav('Grassland', [], [30, 75, 30])(1)).toEqual({ dc: 15, cause: 'wilds' }); // max(5+3, 15) = 15
    expect(nav('Glacier', [], [30, 75, 30])(1)).toEqual({ dc: 18, cause: 'wilds' });   // max(15+3, 15) = 18, matches Glacier h60
  });

  it('trackless highland (50 ≤ h < 70) adds the highland bump onto the biome DC', () => {
    expect(nav('Grassland', [], [30, 60, 30])(1)).toEqual({ dc: 8, cause: 'wilds' });  // open 5 + 3
    expect(nav('Glacier', [], [30, 60, 30])(1)).toEqual({ dc: 18, cause: 'wilds' });   // difficult 15 + 3
  });

  it('band edges: the bump starts exactly at h 50 and hands off to the crag floor at 70', () => {
    expect(nav('Grassland', [], [30, 49, 30])(1).dc).toBe(5);
    expect(nav('Grassland', [], [30, 50, 30])(1).dc).toBe(8);
    expect(nav('Grassland', [], [30, 70, 30])(1).dc).toBe(15); // max(5+3, 15)
    // Monotonic across the hand-off for difficult biomes too (controller
    // ruling): Glacier h69 → 15+3 (band bump) and h70 → max(15+3, 15) — the
    // DC never DROPS as the ground gets higher.
    expect(nav('Glacier', [], [30, 69, 30])(1).dc).toBe(18);
    expect(nav('Glacier', [], [30, 70, 30])(1).dc).toBe(18);
  });

  it('a graded route through the high country keeps its ladder — passes exist for this', () => {
    expect(nav('Grassland', [{ group: 'roads', cells: [1] }], [30, 75, 30])(1))
      .toEqual({ dc: 0, cause: 'road' });
    expect(nav('Grassland', [{ group: 'roads', cells: [1] }], [30, 60, 30])(1))
      .toEqual({ dc: 0, cause: 'road' });
  });

  it('haunted woods mislead LAST: elevation raises the DC first, then the forest bump lands on top', () => {
    const wood = [{ i: 1, name: 'Testwood', kind: 'haunted', cells: [0, 1, 2] }];
    expect(nav('Temperate deciduous forest', [], [30, 60, 30], wood)(1).dc)
      .toBe(5 + 3 + FOREST_NAV_DC_BUMP); // (open 5 + highland 3) + forest 2 = 10
    expect(nav('Grassland', [], [30, 75, 30], wood)(1).dc)
      .toBe(15 + FOREST_NAV_DC_BUMP);    // crag floor 15, then the woods on top
  });

  it('lowland cells are untouched (pre-mountains fixtures stay valid)', () => {
    expect(nav('Grassland', [], [30, 30, 30])(1)).toEqual({ dc: 5, cause: 'wilds' });
  });
});

describe('transport mobility', () => {
  it('maps transport → land/water/air', () => {
    expect(transportMobility({ method: 'walking' })).toBe('land');
    expect(transportMobility({ method: 'mounted', vehicle: STANDARD_VEHICLES.riding_horse })).toBe('land');
    expect(transportMobility({ method: 'vehicle', vehicle: STANDARD_VEHICLES.rowboat })).toBe('water');
    expect(transportMobility({ method: 'mounted', vehicle: { id: 'griffon', name: 'Griffon', speed: 80, capacityWeight: 400, type: 'air' } })).toBe('air');
  });

  it('land transport cannot enter water; water transport cannot enter land; air can do both', () => {
    const land = buildAtlasTravelGraph(atlas, { mobility: 'land' });
    const water = buildAtlasTravelGraph(atlas, { mobility: 'water' });
    const air = buildAtlasTravelGraph(atlas, { mobility: 'air' });
    expect(land.passable(2)).toBe(true);  expect(land.passable(3)).toBe(false);  // land cell vs sea
    expect(water.passable(2)).toBe(false); expect(water.passable(3)).toBe(true);  // boats need water
    expect(air.passable(2)).toBe(true);   expect(air.passable(3)).toBe(true);     // flight crosses both
  });

  it('a flying mount can reach a water cell a land mount cannot', () => {
    const land = buildAtlasTravelGraph(atlas, { mobility: 'land' });
    const air = buildAtlasTravelGraph(atlas, { mobility: 'air' });
    expect(planFastestRoute(land, 0, 3, { milesPerUnit: 0.1, speedMph: 3 })).toBeNull();
    expect(planFastestRoute(air, 0, 3, { milesPerUnit: 0.1, speedMph: 8 })!.cells).toEqual([0, 1, 2, 3]);
  });
});
