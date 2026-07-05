import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../legacySubmapBridge';
import { makeGroundWorld, extractLocalTerrainPatch } from '../groundChunkLoader';
import {
  buildGroundProps,
  groundToPlacementContext,
  imprintPropOnTile,
  WAVE1_PROPS_BY_ID,
} from '../groundProps';
import { PROPS_BY_ID } from '../../props/catalog';
import { listSelectableTowns } from '../../local/startTowns';
import { findCellAtPoint } from '../../../../components/Worldforge/atlasSvg';
import { CELL_METERS, providesCover } from '../../props/propSchema';
import type { GroundWorld } from '../groundChunkLoader';
import type { BattleMapTile } from '@/types/combat';

/**
 * WAVE-1 prop wiring: proves props are BORN into the live ground pipeline and
 * born combat-legible. Three claims:
 *  1. a generated town window carries props (market stalls in a market town,
 *     dock crates where a port has loading points);
 *  2. determinism — same world+window → deep-equal props across two builds;
 *  3. combat extraction imprints a placed prop's referee data onto its tile(s).
 */

/** Build the ground world for the lowest-pop PORT of a seed (has docks + market). */
function portGround(seed: number): GroundWorld {
  const world = getBridgeAtlas(seed);
  const town = listSelectableTowns(world)
    .filter((t) => t.isPort)
    .sort((a, b) => a.population - b.population)[0];
  const burg = (world.pack.burgs as Array<{ x: number; y: number }>)[town.burgIndex];
  const cell = findCellAtPoint(world as never, burg.x, burg.y);
  const { local, region } = getWorldforgeLocalForCell(seed, cell, {
    centerPx: [burg.x, burg.y],
  });
  return makeGroundWorld(local, seed, region);
}

describe('WAVE-1 prop wiring into GroundWorld', () => {
  it('a generated town window is populated with props', () => {
    const ground = portGround(42);
    expect(ground.props.length).toBeGreaterThan(0);
    // Every placed prop references a real catalog def (the placement engine
    // now also emits expanded-catalog defs, e.g. gravestones / milestones,
    // which stay data-only until the bridge switches to PROPS_BY_ID).
    for (const p of ground.props) {
      expect(PROPS_BY_ID.has(p.defId), p.defId).toBe(true);
    }
    // A market town rings its plaza with stalls; a port pools crates at loading
    // points. At least one of those signature props must appear.
    const ids = new Set(ground.props.map((p) => p.defId));
    expect(ids.has('market-stall') || ids.has('crate') || ids.has('crate-stack')).toBe(true);
  }, 20000);

  it('places market stalls when the town has a market ward', () => {
    // Across a few seeds at least one port has market plots → stalls appear.
    const anyStalls = [42, 1, 7].some((s) =>
      portGround(s).props.some((p) => p.defId === 'market-stall'),
    );
    expect(anyStalls).toBe(true);
  }, 30000);

  it('pools crates/barrels at dock loading points when the port has docks', () => {
    // A port with dock decks or workshop plots pools crates. Prove at least one
    // seed's port yields dock-style clutter.
    const anyDockClutter = [42, 1, 7].some((s) => {
      const g = portGround(s);
      const hasLoadingPoints =
        g.decks.some((d) => d.kind === 'dock') ||
        g.buildings.some((b) => b.role === 'workshop');
      if (!hasLoadingPoints) return false;
      return g.props.some((p) => p.defId === 'crate' || p.defId === 'barrel' || p.defId === 'crate-stack');
    });
    expect(anyDockClutter).toBe(true);
  }, 30000);

  it('is deterministic — two builds of the same window give deep-equal props', () => {
    const a = portGround(42).props;
    const b = portGround(42).props;
    expect(a).toEqual(b);
    expect(a.length).toBe(b.length);
  }, 20000);

  it('buildGroundProps is a pure function of ground + seed path', () => {
    const ground = portGround(7);
    const p1 = buildGroundProps(ground, 7);
    const p2 = buildGroundProps(ground, 7);
    expect(p1).toEqual(p2);
    // A different seed path yields a different placement (independent stream).
    const p3 = buildGroundProps(ground, 999);
    expect(p3).not.toEqual(p1);
  }, 20000);

  it('projects market plots into plaza anchors', () => {
    const ground = portGround(42);
    const ctx = groundToPlacementContext(ground);
    const marketCount = ground.buildings.filter((b) => b.role === 'market').length;
    // A market plot exists ⇒ a plaza anchor is synthesized for it.
    if (marketCount > 0) expect(ctx.plazas.length).toBeGreaterThan(0);
  }, 20000);

  it('threads SLICE B context signals (walls/gatehouses/rivers/hidden/heights)', () => {
    const ground = portGround(42);
    const ctx = groundToPlacementContext(ground);
    // The context now carries the signals that gate the six new contexts. A
    // real town window has a wall ring + heights at minimum.
    expect(ctx.heights).toBe(ground.heights);
    expect(Array.isArray(ctx.walls)).toBe(true);
    expect(Array.isArray(ctx.gatehouses)).toBe(true);
    expect(Array.isArray(ctx.rivers)).toBe(true);
    expect(Array.isArray(ctx.hiddenSites)).toBe(true);
    // Gatehouses/hidden sites project 1:1 from the GroundWorld.
    expect(ctx.gatehouses!.length).toBe(ground.gatehouses.length);
    expect(ctx.hiddenSites!.length).toBe(ground.hiddenSites.length);
  }, 20000);

  it('a tavern business threads through to tavern-frontage dressing', () => {
    const ground = portGround(42);
    // Synthesize a tavern business on the first building plot and prove it
    // dresses that frontage (the tavern context fires only with the signal).
    const plot = ground.buildings[0];
    const m = /^wf-plot-(\d+)-(\d+)$/.exec(plot.id);
    expect(m).not.toBeNull();
    const bizId = `biz_burg_${m![1]}_plot_${m![2]}`;
    const businesses = {
      [bizId]: { id: bizId, businessType: 'tavern' } as never,
    };
    const props = buildGroundProps(ground, 42, undefined, businesses);
    const TAVERN = ['tavern-sign', 'overturned-barrel', 'trestle-table', 'slop-bucket', 'lantern-post'];
    const near = props.filter(
      (p) => TAVERN.includes(p.defId) && Math.hypot(p.xM - plot.xM, p.zM - plot.zM) < 12,
    );
    expect(near.length).toBeGreaterThan(0);
  }, 20000);

  it('a live town window emits expanded-catalog props (full-catalog flip)', () => {
    const ground = portGround(42);
    const ids = new Set(ground.props.map((p) => p.defId));
    // Beyond the WAVE-1 backbone, at least one expanded def now appears.
    const WAVE1 = new Set([
      'crate', 'barrel', 'sack', 'fence-run', 'woodpile', 'cart', 'market-stall',
      'well', 'boulder', 'fallen-log', 'bush', 'haystack', 'crate-stack', 'water-trough',
    ]);
    const expanded = [...ids].filter((id) => !WAVE1.has(id));
    expect(expanded.length, `expanded defs: ${expanded.join(',')}`).toBeGreaterThan(0);
  }, 20000);
});

describe('prop referee imprint onto BattleMap tiles', () => {
  function freshTile(): BattleMapTile {
    return {
      id: '0-0',
      coordinates: { x: 0, y: 0 },
      terrain: 'grass',
      elevation: 0,
      movementCost: 1,
      blocksLoS: false,
      blocksMovement: false,
      decoration: null,
      effects: [],
    };
  }

  it('imprints a crate: blocks movement, grants cover, stamps wood + thickness', () => {
    const tile = freshTile();
    const crate = WAVE1_PROPS_BY_ID.get('crate')!;
    const touched = imprintPropOnTile(
      tile,
      { defId: 'crate', xM: 0, zM: 0, rotationRad: 0, variation: { scale: 1, variant: 0 } },
      0,
      0,
    );
    expect(touched).toBe(true);
    expect(tile.blocksMovement).toBe(true);
    expect(tile.movementCost).toBe(0);
    expect(tile.providesCover).toBe(true);
    expect(providesCover(crate)).toBe(true);
    expect(tile.material).toBe('wood');
    expect(tile.thicknessInches).toBe(1);
  });

  it('imprints a boulder with its stone material and a boulder decoration', () => {
    const tile = freshTile();
    imprintPropOnTile(
      tile,
      { defId: 'boulder', xM: 0, zM: 0, rotationRad: 0, variation: { scale: 1, variant: 0 } },
      0,
      0,
    );
    expect(tile.blocksLoS).toBe(true);
    expect(tile.blocksMovement).toBe(true);
    expect(tile.material).toBe('stone');
    expect(tile.decoration).toBe('boulder');
  });

  it('a prop outside the tile footprint does not imprint', () => {
    const tile = freshTile();
    const touched = imprintPropOnTile(
      tile,
      { defId: 'crate', xM: 100, zM: 100, rotationRad: 0, variation: { scale: 1, variant: 0 } },
      0,
      0,
    );
    expect(touched).toBe(false);
    expect(tile.blocksMovement).toBe(false);
    expect(tile.material).toBeUndefined();
  });

  it('a bush imprints difficult terrain + cover without blocking movement', () => {
    const tile = freshTile();
    imprintPropOnTile(
      tile,
      { defId: 'bush', xM: 0, zM: 0, rotationRad: 0, variation: { scale: 1, variant: 0 } },
      0,
      0,
    );
    expect(tile.blocksMovement).toBe(false);
    expect(tile.blocksLoS).toBe(true);
    expect(tile.providesCover).toBe(true);
    expect(tile.movementCost).toBe(2);
    expect(tile.terrain).toBe('difficult');
  });

  it('extractLocalTerrainPatch imprints a placed prop onto the ground map', () => {
    // Build a minimal ground world with ONE crate at a known spot and extract a
    // patch centered on it — the crate's tile must read as combat-legible.
    const cols = 8;
    const rows = 8;
    const ground: GroundWorld = {
      cols,
      rows,
      heights: new Array(cols * rows).fill(0),
      biomeIds: new Array(cols * rows).fill('plains'),
      extentMetersX: cols * CELL_METERS,
      extentMetersZ: rows * CELL_METERS,
      features: [],
      props: [
        { defId: 'crate', xM: 4 * CELL_METERS, zM: 4 * CELL_METERS, rotationRad: 0, variation: { scale: 1, variant: 0 } },
      ],
      hostiles: [],
      hiddenSites: [],
      rivers: [],
      roads: [],
      walls: [],
      waterBodies: [],
      decks: [],
      gatehouses: [],
      towns: [],
      buildings: [],
      rosters: [],
      occupants: [],
    };
    const patch = extractLocalTerrainPatch(ground, 4 * CELL_METERS, 4 * CELL_METERS, 'forest', 1);
    // Player is the center tile (20,15); the crate sits under the player.
    const centerTile = patch.tiles.get('20-15')!;
    expect(centerTile.blocksMovement).toBe(true);
    expect(centerTile.providesCover).toBe(true);
    expect(centerTile.material).toBe('wood');
    expect(centerTile.thicknessInches).toBe(1);
  });
});
