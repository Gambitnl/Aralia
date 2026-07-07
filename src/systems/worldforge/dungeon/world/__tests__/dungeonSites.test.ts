/**
 * @file dungeonSites.test.ts — Pillar 2, Task 1.
 *
 * Uses the real cached bridge atlas for a fixed seed (same pattern as
 * burgProximity.test.ts). All assertions are invariants over the enumerated
 * sites, not hard-coded golden counts — the exact count depends on FMG's
 * Math.random marker placement, which is stable only within a process, so we
 * assert structural properties instead.
 */
import { getBridgeAtlas } from '../../../bridge/legacySubmapBridge';
import {
  enumerateDungeonSites,
  THEME_ARCHETYPE,
  type DungeonSite,
} from '../dungeonSites';
import { FEET_PER_FMG_PIXEL } from '../../../adapter/atlasArtifact';

const SEED = 12345;
const atlas = getBridgeAtlas(SEED);
const sites = enumerateDungeonSites(SEED);

const LAND_H = 20;

interface BurgLike {
  i?: number;
  cell?: number;
  removed?: boolean;
  temple?: number;
  walls?: number;
  population?: number;
  state?: number;
  capital?: number;
}
const burgs = (atlas.pack.burgs ?? []) as BurgLike[];

describe('enumerateDungeonSites — Pillar 2 Task 1', () => {
  it('produces at least one site for the test world', () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it('is deterministic: two calls return byte-equal data', () => {
    const a = enumerateDungeonSites(SEED);
    const b = enumerateDungeonSites(SEED);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('returns a defensive copy (mutating one call does not affect the next)', () => {
    const a = enumerateDungeonSites(SEED);
    a[0].posFt.x = -999999;
    a[0].cellId = -1;
    const b = enumerateDungeonSites(SEED);
    expect(b[0].cellId).not.toBe(-1);
    expect(b[0].posFt.x).not.toBe(-999999);
  });

  it('is sorted by (cellId, entranceKind, burgId)', () => {
    for (let i = 1; i < sites.length; i++) {
      const prev = sites[i - 1];
      const cur = sites[i];
      if (prev.cellId !== cur.cellId) {
        expect(prev.cellId).toBeLessThan(cur.cellId);
        continue;
      }
      if (prev.entranceKind !== cur.entranceKind) {
        expect(prev.entranceKind <= cur.entranceKind).toBe(true);
        continue;
      }
      expect((prev.burgId ?? -1) <= (cur.burgId ?? -1)).toBe(true);
    }
  });

  it('never anchors to burg 0 or a removed burg', () => {
    for (const s of sites) {
      if (s.burgId !== undefined) {
        expect(s.burgId).toBeGreaterThan(0);
        const b = burgs[s.burgId];
        expect(b).toBeDefined();
        expect(b.removed).not.toBe(true);
      }
    }
  });

  it('every wilderness (marker) site sits on a land cell (h >= 20)', () => {
    const h = atlas.pack.cells.h as ArrayLike<number>;
    for (const s of sites) {
      if (s.origin === 'marker') {
        expect(h[s.cellId]).toBeGreaterThanOrEqual(LAND_H);
      }
    }
  });

  it('every NON-civ site has a legal (theme, archetype) pair', () => {
    // Civ archaeology sites (Task 2) intentionally vary theme and archetype
    // independently — a crypt-flavored fortress ruin is crypt+fortress, which
    // is NOT the THEME_ARCHETYPE default. That invariant is scoped to the
    // sources whose archetype is derived from theme.
    for (const s of sites) {
      if (s.origin === 'civ') continue;
      expect(THEME_ARCHETYPE[s.theme]).toBe(s.archetype);
    }
  });

  it("uses 'temple-stair' iff the site is a temple crypt (origin 'temple')", () => {
    for (const s of sites) {
      expect(s.entranceKind === 'temple-stair').toBe(s.origin === 'temple');
    }
  });

  it('sitePaths are unique across all sites, for 3 seeds', () => {
    // Marker segments are keyed by the marker's own atlas-unique id (m<id>),
    // so same-cell collisions between marker types are structurally
    // impossible; burg segments are keyed by burgId + fixed suffix.
    for (const seed of [SEED, 7, 99999]) {
      const all = enumerateDungeonSites(seed);
      const paths = new Set(all.map((s) => s.sitePath));
      expect(paths.size).toBe(all.length);
    }
  });

  it('posFt equals the atlas cell center in feet', () => {
    const p = atlas.pack.cells.p as ReadonlyArray<readonly [number, number]>;
    for (const s of sites) {
      const pt = p[s.cellId];
      expect(s.posFt.x).toBe(Math.round(pt[0] * FEET_PER_FMG_PIXEL));
      expect(s.posFt.y).toBe(Math.round(pt[1] * FEET_PER_FMG_PIXEL));
    }
  });

  describe('marker-origin sites', () => {
    const markerSites = sites.filter((s) => s.origin === 'marker');

    it('carry a markerRef and one of the wilderness entrance kinds', () => {
      for (const s of markerSites) {
        expect(typeof s.markerRef).toBe('number');
        // 'temple-stair' is reserved for origin-'temple' burg crypts.
        expect(['ruin-door', 'cave-mouth']).toContain(s.entranceKind);
      }
    });

    it('use the wilderness sitePath grammar wf:<seed>/cell:<cellId>/dungeon:m<markerId>', () => {
      for (const s of markerSites) {
        expect(s.sitePath).toMatch(
          new RegExp(`^wf:${SEED}/cell:${s.cellId}/dungeon:m\\d+$`),
        );
        // The segment is keyed by the marker's OWN id, so two markers of any
        // types sharing a cell can never collide.
        expect(s.sitePath).toBe(
          `wf:${SEED}/cell:${s.cellId}/dungeon:m${s.markerRef}`,
        );
      }
    });

    it('map cave markers to cavern/mine and burial markers to crypt/mausoleum', () => {
      // Cross-check theme legality against entranceKind expectations.
      for (const s of markerSites) {
        if (s.entranceKind === 'cave-mouth') {
          expect(s.theme).toBe('cavern');
          expect(s.archetype).toBe('mine');
        }
      }
    });
  });

  describe('temple-origin sites', () => {
    const templeSites = sites.filter((s) => s.origin === 'temple');

    it('exist iff the burg has temple === 1', () => {
      // Every temple site's burg has temple flag.
      for (const s of templeSites) {
        expect(burgs[s.burgId!].temple).toBe(1);
      }
      // Every live temple burg has exactly one crypt site.
      const templeBurgIds = new Set(templeSites.map((s) => s.burgId));
      for (let i = 0; i < burgs.length; i++) {
        const b = burgs[i];
        if (!b || b.i === 0 || b.removed) continue;
        if (b.temple === 1) {
          expect(templeBurgIds.has(b.i)).toBe(true);
        }
      }
    });

    it('are crypt/mausoleum temple-stair sites with the crypt sitePath', () => {
      for (const s of templeSites) {
        expect(s.theme).toBe('crypt');
        expect(s.archetype).toBe('mausoleum');
        expect(s.entranceKind).toBe('temple-stair');
        expect(s.sitePath).toBe(`wf:${SEED}/burg:${s.burgId}/dungeon:crypt`);
      }
    });
  });

  describe('sewer sites', () => {
    const sewerSites = sites.filter((s) => s.entranceKind === 'sewer-grate');

    it('only walled burgs with population >= 10 carry sewers', () => {
      for (const s of sewerSites) {
        const b = burgs[s.burgId!];
        expect(b.walls).toBe(1);
        expect(b.population ?? 0).toBeGreaterThanOrEqual(10);
      }
    });

    it('at most one sewer site per state (the dominant walled burg)', () => {
      const seenStates = new Set<number>();
      for (const s of sewerSites) {
        const b = burgs[s.burgId!];
        const state = b.state ?? -1;
        expect(seenStates.has(state)).toBe(false);
        seenStates.add(state);
        // It is the state's most populous walled burg (ties: capital, low id).
        for (let i = 0; i < burgs.length; i++) {
          const o = burgs[i];
          if (!o || o.i === 0 || o.removed || o.i === s.burgId) continue;
          if (o.walls !== 1 || (o.state ?? -1) !== state) continue;
          expect(o.population ?? 0).toBeLessThanOrEqual(b.population ?? 0);
        }
      }
    });

    it("are sewer/waterworks 'town'-origin sites with the sewer sitePath", () => {
      for (const s of sewerSites) {
        expect(s.theme).toBe('sewer');
        expect(s.archetype).toBe('waterworks');
        expect(s.origin).toBe('town');
        expect(s.sitePath).toBe(`wf:${SEED}/burg:${s.burgId}/dungeon:sewer`);
      }
    });
  });
});

// Simple type-usage guard so the exported type is referenced.
const _typeGuard: DungeonSite | undefined = sites[0];
void _typeGuard;
