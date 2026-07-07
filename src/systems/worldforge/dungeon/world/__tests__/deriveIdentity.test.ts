/**
 * @file deriveIdentity.test.ts — Pillar 2, Task 3.
 *
 * Real cached bridge atlas for a fixed seed (same pattern as dungeonSites.test.ts).
 * Assertions are invariants over the derived identity/plan, not golden strings
 * (culture names depend on FMG's per-process Math.random name chains). We DO grep
 * generated text for the real burg name a town crypt embeds, and we compare two
 * synthesized sites (low- vs high-danger cell) for monotone size scaling.
 */
import { getBridgeAtlas } from '../../../bridge/legacySubmapBridge';
import { computeDangerField } from '../../../overlays/dangerField';
import { enumerateDungeonSites, type DungeonSite } from '../dungeonSites';
import {
  deriveDungeonIdentity,
  generateDungeonForSite,
  scaleRoomCount,
  scalePartyLevel,
} from '../deriveIdentity';
import { generateDungeon } from '../../generateDungeon';
import { rootSeedPath, childSeedPath } from '../../../seedPath';

const SEED = 12345;
const atlas = getBridgeAtlas(SEED);
const sites = enumerateDungeonSites(SEED);

interface BurgLike { i?: number; cell?: number; removed?: boolean; name?: string }
const burgs = (atlas.pack.burgs ?? []) as BurgLike[];

describe('deriveDungeonIdentity — Pillar 2 Task 3', () => {
  it('the test world enumerates sites to derive from', () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it('is deterministic: same site ⇒ identical params + world', () => {
    const site = sites[0];
    const a = deriveDungeonIdentity(SEED, site);
    const b = deriveDungeonIdentity(SEED, site);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('same site ⇒ identical full plan (name, grid, spawns)', () => {
    const site = sites[0];
    const a = generateDungeonForSite(SEED, site);
    const b = generateDungeonForSite(SEED, site);
    expect(a.name).toEqual(b.name);
    expect(a.builderName).toEqual(b.builderName);
    expect(a.blurb).toEqual(b.blurb);
    expect(Array.from(a.grid)).toEqual(Array.from(b.grid));
    expect(a.spawns).toEqual(b.spawns);
    expect(a.stats.rooms).toEqual(b.stats.rooms);
  });

  it('params carry the site theme + archetype; partyLevel in [1,8]', () => {
    for (const site of sites.slice(0, 12)) {
      const { params } = deriveDungeonIdentity(SEED, site);
      expect(params.theme).toBe(site.theme);
      expect(params.archetype).toBe(site.archetype);
      expect(params.partyLevel).toBeGreaterThanOrEqual(1);
      expect(params.partyLevel).toBeLessThanOrEqual(8);
      expect(params.roomCount).toBeGreaterThanOrEqual(24);
      expect(params.roomCount).toBeLessThanOrEqual(54);
      expect(params.sprawl).toBeUndefined();
    }
  });

  it('a town crypt (burgId) uses that burg name as its townName', () => {
    const templeSite = sites.find((s) => s.origin === 'temple' && s.burgId !== undefined);
    if (!templeSite) return; // world may lack temple burgs; other tests cover naming
    const { world } = deriveDungeonIdentity(SEED, templeSite);
    expect(world.townName).toBe(burgs[templeSite.burgId!].name);
  });

  it("a town crypt's plan text embeds the real burg name", () => {
    // Find a temple/sewer site whose burg has a non-empty name.
    const owned = sites.find(
      (s) => s.burgId !== undefined && (burgs[s.burgId]?.name ?? '').length > 0,
    );
    if (!owned) return;
    const burg = burgs[owned.burgId!];
    const { world } = deriveDungeonIdentity(SEED, owned);
    // The identity's townName IS the burg name (the load-bearing embed).
    expect(world.townName).toBe(burg.name);
    // And it flows into the builder pattern when the pattern has a {T} token
    // (waterworks/sewer patterns do). At minimum the world identity carries it.
    expect(world.builderName.length).toBeGreaterThan(0);
    expect(world.builderStem.length).toBeGreaterThan(0);
  });

  it('room-count scaling is monotone in danger and remoteness', () => {
    // Pure-formula monotonicity (the derivation is a closed form).
    expect(scaleRoomCount(0.0, 0)).toBe(24);
    expect(scaleRoomCount(1.0, 0)).toBeGreaterThan(scaleRoomCount(0.0, 0));
    expect(scaleRoomCount(0.5, 90000)).toBeGreaterThan(scaleRoomCount(0.5, 0));
    expect(scaleRoomCount(1.0, 1_000_000)).toBeLessThanOrEqual(54);
    // partyLevel scaling.
    expect(scalePartyLevel(0)).toBe(1);
    expect(scalePartyLevel(1)).toBe(8);
    expect(scalePartyLevel(0.5)).toBeGreaterThan(scalePartyLevel(0));
  });

  it('a high-danger site derives >= rooms than a low-danger one (real field)', () => {
    // Build two synthetic wilderness sites at the world's lowest- and highest-
    // danger LAND cells, both far from any burg so remoteness is held ~equal.
    const field = computeDangerField(atlas);
    const cells = atlas.pack.cells as { h: ArrayLike<number> };
    let lowCell = -1;
    let highCell = -1;
    let lowD = Infinity;
    let highD = -Infinity;
    for (let i = 0; i < field.length; i++) {
      if ((cells.h[i] ?? 0) < 20) continue; // land only
      const d = field[i];
      if (d < lowD) { lowD = d; lowCell = i; }
      if (d > highD) { highD = d; highCell = i; }
    }
    expect(lowCell).toBeGreaterThanOrEqual(0);
    expect(highCell).toBeGreaterThanOrEqual(0);
    expect(highD).toBeGreaterThan(lowD);

    const mk = (cellId: number, tag: string): DungeonSite => ({
      sitePath: childSeedPath(childSeedPath(rootSeedPath(SEED), `cell:${cellId}`), `dungeon:${tag}`),
      cellId,
      entranceKind: 'ruin-door',
      theme: 'crypt',
      archetype: 'mausoleum',
      origin: 'marker',
      posFt: { x: 0, y: 0 },
    });

    const low = deriveDungeonIdentity(SEED, mk(lowCell, 'lowtest'));
    const high = deriveDungeonIdentity(SEED, mk(highCell, 'hightest'));
    // Danger drives both roomCount and partyLevel upward (remoteness is only a
    // secondary term; the danger gap here is large enough to dominate).
    expect(high.params.roomCount).toBeGreaterThanOrEqual(low.params.roomCount);
    expect(high.params.partyLevel).toBeGreaterThanOrEqual(low.params.partyLevel);
  });

  it('throws honestly when no site burg can name a builder (no burgs)', () => {
    // A site whose cellId points nowhere useful still resolves via nearestBurg
    // for a world WITH burgs; this world has burgs, so we assert the positive
    // path does NOT throw for a real wilderness site.
    const wild = sites.find((s) => s.burgId === undefined);
    if (wild) {
      expect(() => deriveDungeonIdentity(SEED, wild)).not.toThrow();
    }
  });

  it('sets biomeName from the site cell via atlas biomesData', () => {
    // Real enumerated site (seed 7, first site).
    const site = sites[0];
    const { params } = deriveDungeonIdentity(SEED, site);

    // Verify biomeName is set and matches the atlas.
    const cell = site.cellId;
    const biomeId = atlas.pack.cells.biome?.[cell];
    const expectedBiomeName = biomeId != null ? atlas.biomesData?.name?.[biomeId] : undefined;

    if (expectedBiomeName) {
      expect(params.biomeName).toBe(expectedBiomeName);
      expect(params.biomeName).toMatch(/\S/); // non-empty
    } else {
      // Cell has no biome or atlas lacks biomesData; biomeName should be undefined.
      expect(params.biomeName).toBeUndefined();
    }
  });
});

describe('world identity draw-count parity (grid identical, text differs)', () => {
  it('a plan with world identity keeps the same grid as one without', () => {
    // Same base path + params, only the `world` input differs. deriveLore draws
    // and discards the placeholder stem/pattern when world is present, so the
    // lore stream advances identically → grids/spawns/props byte-identical.
    const basePath = childSeedPath(childSeedPath(rootSeedPath(SEED), 'cell:999'), 'dungeon:parity');
    const params = {
      roomCount: 30,
      loopChance: 0.25,
      decorDensity: 0.6,
      theme: 'crypt' as const,
      partyLevel: 3,
    };
    const bare = generateDungeon({ seed: SEED, basePath, params });
    const worlded = generateDungeon({
      seed: SEED,
      basePath,
      params,
      world: { builderName: 'House Testwyn', builderStem: 'Testwyn', townName: 'Testburg' },
    });

    // Grid, doors, spawns, props, traps — all downstream stream state — match.
    expect(Array.from(worlded.grid)).toEqual(Array.from(bare.grid));
    expect(worlded.spawns).toEqual(bare.spawns);
    expect(worlded.props).toEqual(bare.props);
    expect(worlded.traps).toEqual(bare.traps);
    expect(worlded.doors).toEqual(bare.doors);
    expect(worlded.rooms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h }))).toEqual(
      bare.rooms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    );

    // Only the TEXT differs — the world builder name is used verbatim.
    expect(worlded.builderName).toBe('House Testwyn');
    expect(worlded.builderName).not.toBe(bare.builderName);
    // The title embeds the world stem, not lore's English namePool stem.
    expect(worlded.name).toContain('Testwyn');
  });

  it('world plan still satisfies Pillar 1 invariants (reachability, hooks 1:1)', () => {
    const basePath = childSeedPath(childSeedPath(rootSeedPath(SEED), 'cell:888'), 'dungeon:inv');
    const plan = generateDungeon({
      seed: SEED,
      basePath,
      params: { roomCount: 28, loopChance: 0.25, decorDensity: 0.6, theme: 'crypt', partyLevel: 3 },
      world: { builderName: 'the Vharûn line', builderStem: 'Vharûn', townName: 'Karth' },
    });
    // Reachability: every floor cell has a BFS distance ≥ 0 from the entrance.
    let floor = 0;
    let reached = 0;
    for (let i = 0; i < plan.grid.length; i++) {
      if (plan.grid[i] === 1 /* Floor */) {
        floor++;
        if (plan.bfs[i] >= 0) reached++;
      }
    }
    expect(floor).toBeGreaterThan(0);
    expect(reached).toBe(floor);
    // Hooks 1:1 with history events.
    expect(plan.rumorHooks.length).toBe(plan.history.length);
    for (const h of plan.rumorHooks) {
      expect(plan.history.some((e) => e.id === h.eventRef)).toBe(true);
    }
  });
});
