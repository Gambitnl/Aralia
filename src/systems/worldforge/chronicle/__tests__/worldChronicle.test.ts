/**
 * @file worldChronicle.test.ts — the reverse-generational world chronicle.
 *
 * The world chronicle is INFERRED backwards from the finished atlas: every entry
 * must cite a PRESENT fact it explains (a real border, a real cross-realm faith,
 * a real ruin marker). These tests pin that discipline structurally (the exact
 * atlas layout depends on FMG's world gen, stable only within a process), plus
 * determinism, band ordering, caps, and byte-compat with the dungeon layer.
 */
import { describe, it, expect } from 'vitest';
import {
  worldChronicleFor,
  renderChronicle,
  __clearWorldChronicleCache,
  type ChronicleEntry,
} from '../worldChronicle';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { chronicleForSite } from '../../dungeon/world/chronicle';
import { enumerateDungeonSites, type DungeonSite } from '../../dungeon/world/dungeonSites';
import { rootSeedPath, childSeedPath } from '../../seedPath';

const SEEDS = [7, 42, 1337] as const;

// ── atlas access shims (verified FMG shapes) ─────────────────────────────────
interface Cells {
  h: ArrayLike<number>;
  c: ReadonlyArray<ReadonlyArray<number>>;
  state?: ArrayLike<number>;
  religion?: ArrayLike<number>;
}
function atlasCells(seed: number): Cells {
  return getBridgeAtlas(seed).pack.cells as unknown as Cells;
}
function atlasStates(seed: number): Array<{ i: number; name?: string; neighbors?: number[]; removed?: boolean }> {
  return (getBridgeAtlas(seed).pack.states ?? []) as Array<{ i: number; name?: string; neighbors?: number[]; removed?: boolean }>;
}

describe('worldChronicleFor — reverse-generational world chronicle', () => {
  // ── determinism ────────────────────────────────────────────────────────────
  it('is deterministic — same seed yields byte-identical entries across calls', () => {
    for (const seed of SEEDS) {
      __clearWorldChronicleCache();
      const a = JSON.stringify(worldChronicleFor(seed).entries);
      __clearWorldChronicleCache();
      const b = JSON.stringify(worldChronicleFor(seed).entries);
      expect(a).toBe(b);
    }
  }, 30000);

  it('caches per seed but returns a defensive copy (mutating one call cannot leak)', () => {
    const first = worldChronicleFor(7);
    first.entries.push({
      id: 'x', kind: 'fall', name: 'x', yearsAgo: 1, shape: 'event', actors: {}, evidence: 'x', cells: [],
    });
    const second = worldChronicleFor(7);
    expect(second.entries.some((e) => e.id === 'x')).toBe(false);
  });

  // ── caps ───────────────────────────────────────────────────────────────────
  it('caps the whole chronicle at ≤ 25 entries (a chronicle, not an encyclopedia)', () => {
    for (const seed of SEEDS) {
      expect(worldChronicleFor(seed).entries.length).toBeLessThanOrEqual(25);
    }
  });

  it('emits a non-trivial chronicle for a rich world (seed 7 has multiple kinds)', () => {
    const kinds = new Set(worldChronicleFor(7).entries.map((e) => e.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    expect(worldChronicleFor(7).entries.length).toBeGreaterThan(5);
  });

  // ── band ordering (the coherent arc) ─────────────────────────────────────────
  it('is sorted oldest → newest', () => {
    for (const seed of SEEDS) {
      const es = worldChronicleFor(seed).entries;
      for (let i = 1; i < es.length; i++) {
        expect(es[i].yearsAgo).toBeLessThanOrEqual(es[i - 1].yearsAgo);
      }
    }
  });

  it('respects the arc: falls are the oldest layer, adopted zones the youngest', () => {
    const es = worldChronicleFor(7).entries;
    const falls = es.filter((e) => e.id.startsWith('fall:'));
    const zones = es.filter((e) => e.id.startsWith('zone:'));
    if (falls.length && zones.length) {
      const oldestFall = Math.max(...falls.map((e) => e.yearsAgo));
      const youngestZone = Math.min(...zones.map((e) => e.yearsAgo));
      // The oldest fall predates the youngest zone (the arc's two ends).
      expect(oldestFall).toBeGreaterThan(youngestZone);
    }
  });

  it('border wars sit older than the youngest adopted zone (wars drew the borders)', () => {
    const es = worldChronicleFor(7).entries;
    const wars = es.filter((e) => e.id.startsWith('war:'));
    const zones = es.filter((e) => e.id.startsWith('zone:'));
    if (wars.length && zones.length) {
      const oldestZone = Math.max(...zones.map((e) => e.yearsAgo));
      for (const w of wars) expect(w.yearsAgo).toBeGreaterThan(oldestZone);
    }
  });

  // ── evidence cites a REAL present fact (kind-specific) ────────────────────────
  it('every border-war entry names two REALLY-adjacent states', () => {
    for (const seed of SEEDS) {
      const states = atlasStates(seed);
      const byId = new Map(states.map((s) => [s.i, s]));
      const wars = worldChronicleFor(seed).entries.filter((e) => e.kind === 'war' && e.id.startsWith('war:'));
      for (const w of wars) {
        const [a, b] = w.actors.stateIds ?? [];
        expect(a).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(0);
        const sa = byId.get(a);
        const sb = byId.get(b);
        expect(sa).toBeDefined();
        expect(sb).toBeDefined();
        // Really adjacent in the finished atlas (neighbor lists are symmetric-ish;
        // accept adjacency recorded on either side).
        const adjacent =
          (sa!.neighbors?.includes(b) ?? false) || (sb!.neighbors?.includes(a) ?? false);
        expect(adjacent).toBe(true);
        // Evidence names both real state names.
        if (sa!.name) expect(w.evidence).toContain(sa!.name);
        if (sb!.name) expect(w.evidence).toContain(sb!.name);
      }
    }
  }, 30000);

  it('every schism entry names a religion that REALLY spans ≥ 2 states', () => {
    for (const seed of SEEDS) {
      const cells = atlasCells(seed);
      const schisms = worldChronicleFor(seed).entries.filter((e) => e.kind === 'schism');
      for (const s of schisms) {
        const rid = s.actors.religionIds?.[0];
        expect(rid).toBeGreaterThan(0);
        // Count distinct land states the religion actually occupies.
        const states = new Set<number>();
        const n = cells.h.length;
        for (let cid = 0; cid < n; cid++) {
          if (cells.religion?.[cid] !== rid) continue;
          if ((cells.h[cid] ?? 0) < 20) continue;
          const st = cells.state?.[cid] ?? 0;
          if (st > 0) states.add(st);
        }
        expect(states.size).toBeGreaterThanOrEqual(2);
      }
    }
  }, 30000);

  it('every fall entry sits on a REAL land marker cell', () => {
    for (const seed of SEEDS) {
      const cells = atlasCells(seed);
      const markers = (getBridgeAtlas(seed).markers ?? []) as Array<{ cell: number; type: string }>;
      const fallCells = new Set(
        markers
          .filter((m) => ['necropolises', 'disturbed-burials', 'ruins'].includes(m.type))
          .map((m) => m.cell),
      );
      const falls = worldChronicleFor(seed).entries.filter((e) => e.kind === 'fall');
      for (const f of falls) {
        const cell = f.cells[0];
        expect(fallCells.has(cell)).toBe(true); // a real fall-marker cell
        expect(cells.h[cell]).toBeGreaterThanOrEqual(20); // on land
      }
    }
  }, 30000);

  it('every entry cites a non-empty plain-English evidence sentence', () => {
    for (const e of worldChronicleFor(7).entries) {
      expect(e.evidence.length).toBeGreaterThan(10);
      // No code identifiers / jargon leaking into player-facing text.
      expect(e.evidence).not.toMatch(/[_{}]|zoneId|cellId/);
    }
  });

  // ── adopted-zone byte-compat with the dungeon layer ──────────────────────────
  it('ADOPTS atlas zones at the EXACT era the dungeon chronicle assigns them', () => {
    // The dungeon chronicleForSite dates each zone off the SAME s:chronicle stream.
    // A civ site's provenance zone appears in BOTH layers; its era must match.
    const seed = 7;
    const worldZones = new Map<string, ChronicleEntry>();
    for (const e of worldChronicleFor(seed).entries) {
      if (e.id.startsWith('zone:')) worldZones.set(e.name, e);
    }
    const sites = enumerateDungeonSites(seed).filter((s) => s.provenance?.zoneId != null);
    let checked = 0;
    for (const site of sites) {
      const refs = chronicleForSite(seed, site);
      for (const ref of refs) {
        // Only compare against ADOPTED zone entries (real zone names), not the
        // world-inference refs the site may also pick up.
        const adopted = worldZones.get(ref.name);
        if (!adopted) continue;
        expect(adopted.yearsAgo).toBe(ref.yearsAgo); // BYTE-identical era
        expect(adopted.kind).toBe(ref.kind);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0); // non-vacuous
  }, 30000);

  // ── render proof ─────────────────────────────────────────────────────────────
  it('renders one plain-English line per entry', () => {
    const text = renderChronicle(7);
    const lines = text.split('\n');
    expect(lines.length).toBe(worldChronicleFor(7).entries.length);
    for (const line of lines) {
      expect(line).toMatch(/^~\d+ years ago — .+\. \(explains: .+\)$/);
    }
  });
});

// ── dungeon integration: chronicleForSite offers nearby world entries ──────────
describe('dungeon integration — chronicleForSite + world chronicle', () => {
  it('a far-from-everything site returns ONLY zone refs (byte-compat, no world refs)', () => {
    // Construct a synthetic site on a land cell that is NOT near any world-entry
    // cell and whose state is in no border war — so the world pass appends nothing
    // and the output is the pre-change zone-only chronicle. Such a cell exists in a
    // large map (most cells are near neither a marker nor a contested border).
    const seed = 7;
    const cells = atlasCells(seed);
    const wc = worldChronicleFor(seed);
    // Cells within 3 hops of any world-entry cell (the world pass's reach).
    const hot = new Set<number>();
    const addHops = (start: number, hops: number) => {
      let frontier = [start];
      hot.add(start);
      for (let r = 0; r < hops && frontier.length; r++) {
        const next: number[] = [];
        for (const c of frontier) {
          for (const j of cells.c[c] ?? []) {
            if (!hot.has(j)) { hot.add(j); next.push(j); }
          }
        }
        frontier = next;
      }
    };
    for (const e of wc.entries) for (const c of e.cells) addHops(c, 3);
    // The world pass ALSO binds via actors.stateIds (wars/schisms/migrations), so
    // a truly-far site must sit in a state named by NO entry's actors.
    const actorStates = new Set<number>();
    for (const e of wc.entries) for (const s of e.actors.stateIds ?? []) actorStates.add(s);

    // Find a land cell that is cold (not hot) and in a non-actor state.
    let coldCell = -1;
    for (let cid = 0; cid < cells.h.length; cid++) {
      if ((cells.h[cid] ?? 0) < 20) continue;
      if (hot.has(cid)) continue;
      const st = cells.state?.[cid] ?? 0;
      if (st > 0 && actorStates.has(st)) continue;
      coldCell = cid;
      break;
    }
    expect(coldCell).toBeGreaterThanOrEqual(0); // such a cell exists

    const site: DungeonSite = {
      sitePath: childSeedPath(childSeedPath(rootSeedPath(seed), `cell:${coldCell}`), 'dungeon:test'),
      cellId: coldCell,
      entranceKind: 'ruin-door',
      theme: 'crypt',
      archetype: 'mausoleum',
      origin: 'marker',
      posFt: { x: 0, y: 0 },
    };
    const refs = chronicleForSite(seed, site);
    // Every ref (if any) is a real ATLAS ZONE — none is a synthetic world entry
    // (world entries carry a NEGATIVE synthetic zoneId; atlas zones are ≥ 0).
    for (const r of refs) expect(r.zoneId).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('a site near a FALL entry can bind that new world-chronicle ref', () => {
    // Anchor a synthetic site AT a fall entry's own cell — the world pass must then
    // offer that fall as a ref (negative synthetic zoneId), proving the new kinds
    // bind through chronicleForSite.
    const seed = 7;
    const fall = worldChronicleFor(seed).entries.find((e) => e.kind === 'fall');
    expect(fall).toBeDefined();
    const site: DungeonSite = {
      sitePath: childSeedPath(childSeedPath(rootSeedPath(seed), `cell:${fall!.cells[0]}`), 'dungeon:test'),
      cellId: fall!.cells[0],
      entranceKind: 'ruin-door',
      theme: 'crypt',
      archetype: 'mausoleum',
      origin: 'marker',
      posFt: { x: 0, y: 0 },
    };
    const refs = chronicleForSite(seed, site);
    const worldRefs = refs.filter((r) => r.zoneId < 0); // synthetic = world entry
    expect(worldRefs.length).toBeGreaterThan(0);
    // At most 2 world refs (the cap).
    expect(worldRefs.length).toBeLessThanOrEqual(2);
    // A fall ref made it through with the fall kind.
    expect(refs.some((r) => r.kind === 'fall')).toBe(true);
  }, 30000);
});
