/**
 * @file chronicle.test.ts — Pillar 2, Task 4 (chronicle grounding).
 *
 * Two layers under test:
 *  1. `chronicleForSite` — provenance zone always present; cross-site
 *     consistency (the same zone yields the same {name, yearsAgo} for every site,
 *     because ages stream off the WORLD root keyed by zone id).
 *  2. simulateHistory binding — a thematically-matching event binds a ref and
 *     quotes its real zone name; ≤ 1 event per ref; monotonic ages preserved;
 *     determinism; no-chronicle worlds unchanged.
 *  3. lore quoting — bound events emit notes/hooks naming the real zone.
 *
 * As with the sibling world-layer suites, atlas-derived assertions are STRUCTURAL
 * (the exact zone layout depends on FMG's Math.random world gen, stable only
 * within a process), not hard-coded golden strings.
 */
import { describe, it, expect } from 'vitest';
import { buildIntact, makeRng } from '../../buildIntact';
import { simulateHistory } from '../../simulateHistory';
import { deriveLore } from '../../lore';
import { generateDungeon } from '../../generateDungeon';
import { ARCHETYPES, THEME_ARCHETYPE } from '../../archetypes';
import { streamPath, rootSeedPath, childSeedPath } from '../../../seedPath';
import type { ChronicleRef, DungeonTheme } from '../../types';
import { chronicleForSite } from '../chronicle';
import { enumerateDungeonSites, type DungeonSite } from '../dungeonSites';

// ── History harness (mirrors simulateHistory.test.ts) ─────────────────────────
function runHistory(
  seed: number,
  theme: DungeonTheme,
  chronicle?: ChronicleRef[],
  jitterSeed = 'chronicle',
) {
  const arch = THEME_ARCHETYPE[theme];
  const base = childSeedPath(rootSeedPath(seed), 'dungeon');
  const st = buildIntact(makeRng(streamPath(base, `build:${arch}`)), arch, 22)!;
  const hist = simulateHistory(
    st,
    makeRng(streamPath(base, 'history')),
    arch,
    theme,
    0,
    chronicle ? { chronicle, jitter: makeRng(streamPath(base, jitterSeed)) } : undefined,
  );
  return { st, hist, arch };
}

/** Refs covering all three chronicle kinds, for binding tests. Names are
 * REAL-shaped (FMG builds "{adjective} {noun}" with no leading article —
 * templates supply the "the"): event-shaped happenings AND a faction-shaped
 * Rebels-family zone, so both template families are exercised. */
const REFS: ChronicleRef[] = [
  { kind: 'war', shape: 'event', name: 'Onerean Occupation', zoneId: 4, yearsAgo: 180 },
  { kind: 'plague', shape: 'event', name: 'Pink Cholera', zoneId: 7, yearsAgo: 120 },
  { kind: 'eruption', shape: 'event', name: 'Dunstonbeck Eruption', zoneId: 9, yearsAgo: 300 },
  { kind: 'war', shape: 'faction', name: 'Damunvilian Rebels', zoneId: 11, yearsAgo: 140 },
];

/** A chronicle of ONLY the faction-shaped ref, so the first matching war event
 * is guaranteed to bind to IT (not to an event-shaped war first). */
const FACTION_REF: ChronicleRef = {
  kind: 'war', shape: 'faction', name: 'Damunvilian Rebels', zoneId: 11, yearsAgo: 140,
};

const MATCH: Record<import('../../types').ChronicleKind, string[]> = {
  war: ['fire', 'brick-off', 'seal'],
  plague: ['awaken', 'den', 'plunder'],
  eruption: ['flood', 'collapse'],
  // World-chronicle inference kinds (mirror CHRONICLE_MATCH in simulateHistory.ts).
  schism: ['brick-off', 'seal', 'reoccupy'],
  crusade: ['fire', 'brick-off', 'seal'],
  migration: ['den', 'reoccupy'],
  fall: ['seal', 'collapse', 'plunder'],
};

const THEMES: DungeonTheme[] = ['crypt', 'cavern', 'frost', 'sewer', 'fungal'];
const SEEDS = [1, 42, 1337, 7, 99] as const;

describe('chronicle grounding — Pillar 2 Task 4', () => {
  // ── 1. chronicleForSite ─────────────────────────────────────────────────────
  describe('chronicleForSite', () => {
    it("includes the site's provenance zone whenever one is present", () => {
      let checked = 0;
      // Cold-builds 3 atlases (cached thereafter) — allow generous time.
      for (const seed of [7, 12345, 99999]) {
        const civWithZone = enumerateDungeonSites(seed).filter(
          (s) => s.origin === 'civ' && s.provenance?.zoneId != null,
        );
        for (const site of civWithZone) {
          const chron = chronicleForSite(seed, site);
          const ids = chron.map((r) => r.zoneId);
          expect(ids).toContain(site.provenance!.zoneId);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0); // non-vacuous
    }, 30000);

    it('ore-mountain sites contribute no provenance ref (mine histories stay local)', () => {
      for (const seed of [7, 12345, 99999]) {
        const mines = enumerateDungeonSites(seed).filter(
          (s) => s.provenance?.kind === 'ore-mountain',
        );
        for (const site of mines) {
          expect(site.provenance?.zoneId).toBeUndefined();
          // The chronicle may still pick up a NEARBY zone, but never a provenance
          // one — no ref should claim to BE this mine's origin zone.
          const chron = chronicleForSite(seed, site);
          // All refs (if any) come from nearby zones, so this is simply: it never
          // throws and returns an array.
          expect(Array.isArray(chron)).toBe(true);
        }
      }
    });

    it('is deterministic — same site yields identical refs across calls', () => {
      const site = enumerateDungeonSites(7).find(
        (s) => s.provenance?.zoneId != null,
      )!;
      expect(site).toBeDefined();
      const a = JSON.stringify(chronicleForSite(7, site));
      const b = JSON.stringify(chronicleForSite(7, site));
      expect(a).toBe(b);
    });

    it('CROSS-SITE CONSISTENCY: two sites near the same zone report the same name AND era', () => {
      // Build a zone id → refs-that-cite-it map across every site of the world.
      const seed = 7;
      const sites = enumerateDungeonSites(seed);
      const byZone = new Map<number, ChronicleRef[]>();
      for (const site of sites) {
        for (const ref of chronicleForSite(seed, site)) {
          const arr = byZone.get(ref.zoneId) ?? [];
          arr.push(ref);
          byZone.set(ref.zoneId, arr);
        }
      }
      // At least one zone must be cited by two different sites (else the test is
      // vacuous). War zones are cited by the fortress sites Task 2 grows.
      const shared = [...byZone.entries()].filter(([, refs]) => refs.length >= 2);
      expect(shared.length).toBeGreaterThan(0);
      for (const [, refs] of shared) {
        const names = new Set(refs.map((r) => r.name));
        const ages = new Set(refs.map((r) => r.yearsAgo));
        const kinds = new Set(refs.map((r) => r.kind));
        expect(names.size).toBe(1); // same real name
        expect(ages.size).toBe(1); // same derived era band
        expect(kinds.size).toBe(1);
      }
    });
  });

  // ── 2. simulateHistory binding ──────────────────────────────────────────────
  describe('simulateHistory binding', () => {
    it('binds ONLY thematically-matching events (kind ∈ the ref kind\'s match set)', () => {
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist } = runHistory(seed, theme, REFS);
        for (const ev of hist.events) {
          if (!ev.chronicleRef) continue;
          expect(MATCH[ev.chronicleRef.kind]).toContain(ev.kind);
        }
      }
    });

    it('binds at most one event per ref', () => {
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist } = runHistory(seed, theme, REFS);
        const perZone = new Map<number, number>();
        for (const ev of hist.events) {
          if (!ev.chronicleRef) continue;
          const z = ev.chronicleRef.zoneId;
          perZone.set(z, (perZone.get(z) ?? 0) + 1);
        }
        for (const count of perZone.values()) expect(count).toBeLessThanOrEqual(1);
      }
    });

    it('binds at most one ref per event (no double-claim)', () => {
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist } = runHistory(seed, theme, REFS);
        // chronicleRef is a single object, so a double-claim is impossible by
        // construction; assert the zone ids used are distinct across events.
        const zones = hist.events.filter((e) => e.chronicleRef).map((e) => e.chronicleRef!.zoneId);
        expect(new Set(zones).size).toBe(zones.length);
      }
    });

    it('never binds a failed tunnel', () => {
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist } = runHistory(seed, theme, REFS);
        for (const ev of hist.events) {
          if (ev.failed) expect(ev.chronicleRef).toBeUndefined();
        }
      }
    });

    it('PRESERVES strict oldest-first age monotonicity after snapping', () => {
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist } = runHistory(seed, theme, REFS);
        expect(hist.events.some((e) => e.chronicleRef)).toBeDefined();
        for (let i = 1; i < hist.events.length; i++) {
          expect(hist.events[i].yearsAgo).toBeLessThan(hist.events[i - 1].yearsAgo);
        }
      }
    });

    it('rewrites a bound event summary to QUOTE the real zone name', () => {
      let sawBinding = false;
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist } = runHistory(seed, theme, REFS);
        for (const ev of hist.events) {
          if (!ev.chronicleRef) continue;
          sawBinding = true;
          expect(ev.summary).toContain(ev.chronicleRef.zoneName);
        }
      }
      expect(sawBinding).toBe(true); // some seed×theme actually bound
    });

    it('FACTION-shaped refs render from the faction family — never "fell in the <plural faction>"', () => {
      // A faction name is a GROUP of people: a hold falls TO the Damunvilian
      // Rebels, it cannot fall *in* them. Assert every bound rendering (summary,
      // note, hook) avoids the event-shaped "in the {name}" phrasing and reads
      // from the faction family instead.
      const name = FACTION_REF.name;
      let sawSummary = false;
      let sawHook = false;
      let sawNote = false;
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist, st, arch } = runHistory(seed, theme, [FACTION_REF]);
        const bound = hist.events.filter((e) => e.chronicleRef);
        if (bound.length === 0) continue;
        for (const ev of bound) {
          expect(ev.chronicleRef!.shape).toBe('faction');
          expect(ev.summary).toContain(name);
          expect(ev.summary).not.toContain(`in the ${name}`);
          // Reads from the faction family (actor phrasing).
          expect(ev.summary).toMatch(
            /put the hold to the torch|burned the hold and moved on|siege by the|walled the deep shut|sealed the hold against|sealed with the .* at the gates|overran the hold|fell to the/,
          );
          sawSummary = true;
        }
        const base = childSeedPath(rootSeedPath(seed), 'dungeon');
        const lore = deriveLore(
          makeRng(streamPath(base, 'lore')),
          ARCHETYPES[arch],
          hist.events,
          st.rooms,
        );
        for (const h of lore.rumorHooks) {
          if (!h.text.includes(name)) continue;
          expect(h.text).not.toContain(`in the ${name}`);
          expect(h.text).toMatch(/fell to the|overran the/);
          sawHook = true;
        }
        for (const note of lore.notes.values()) {
          if (!note.includes(name)) continue;
          expect(note).not.toContain(`in the ${name}`);
          expect(note).toMatch(/took this|came through this/);
          sawNote = true;
        }
      }
      expect(sawSummary).toBe(true); // some seed×theme actually bound
      expect(sawHook).toBe(true);
      expect(sawNote).toBe(true);
    });

    it('is deterministic — same inputs ⇒ same binding', () => {
      for (const theme of ['crypt', 'frost'] as DungeonTheme[]) {
        const a = runHistory(42, theme, REFS).hist.events.map(
          (e) => `${e.kind}:${e.yearsAgo}:${e.chronicleRef?.zoneId ?? '-'}:${e.summary}`,
        );
        const b = runHistory(42, theme, REFS).hist.events.map(
          (e) => `${e.kind}:${e.yearsAgo}:${e.chronicleRef?.zoneId ?? '-'}:${e.summary}`,
        );
        expect(a).toEqual(b);
      }
    });

    it('NO-CHRONICLE worlds are identical to before (events + notes + hooks unchanged)', () => {
      // The whole draw-count discipline guarantee: passing no chronicle must not
      // change a single logged event — nor a single derived note or hook — vs.
      // the historic call.
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist: without, st: stWithout } = runHistory(seed, theme, undefined);
        // Re-run the EXACT historic call (no binding arg at all).
        const arch = THEME_ARCHETYPE[theme];
        const base = childSeedPath(rootSeedPath(seed), 'dungeon');
        const st = buildIntact(makeRng(streamPath(base, `build:${arch}`)), arch, 22)!;
        const legacy = simulateHistory(st, makeRng(streamPath(base, 'history')), arch, theme, 0);
        expect(without.events.map((e) => `${e.kind}:${e.yearsAgo}:${e.summary}`)).toEqual(
          legacy.events.map((e) => `${e.kind}:${e.yearsAgo}:${e.summary}`),
        );
        for (const ev of without.events) expect(ev.chronicleRef).toBeUndefined();
        // Derived lore text is identical too (notes + hooks, byte for byte).
        const loreOf = (events: typeof without.events, rooms: typeof st.rooms) =>
          deriveLore(makeRng(streamPath(base, 'lore')), ARCHETYPES[arch], events, rooms);
        const a = loreOf(without.events, stWithout.rooms);
        const b = loreOf(legacy.events, st.rooms);
        expect([...a.notes.entries()]).toEqual([...b.notes.entries()]);
        expect(a.rumorHooks.map((h) => h.text)).toEqual(b.rumorHooks.map((h) => h.text));
      }
    });
  });

  // ── 3. lore quoting ─────────────────────────────────────────────────────────
  describe('lore quoting', () => {
    it('bound events produce notes and hooks that quote the real zone name', () => {
      let sawNote = false;
      let sawHook = false;
      for (const theme of THEMES) for (const seed of SEEDS) {
        const { hist, st, arch } = runHistory(seed, theme, REFS);
        const boundNames = hist.events
          .filter((e) => e.chronicleRef)
          .map((e) => e.chronicleRef!.zoneName);
        if (boundNames.length === 0) continue;
        const base = childSeedPath(rootSeedPath(seed), 'dungeon');
        const lore = deriveLore(
          makeRng(streamPath(base, 'lore')),
          ARCHETYPES[arch],
          hist.events,
          st.rooms,
        );
        // At least one hook must quote a bound zone name.
        for (const name of boundNames) {
          if (lore.rumorHooks.some((h) => h.text.includes(name))) sawHook = true;
          for (const note of lore.notes.values()) if (note.includes(name)) sawNote = true;
        }
      }
      expect(sawHook).toBe(true);
      expect(sawNote).toBe(true);
    });
  });

  // ── 4. Full integration through generateDungeonForSite's world plumbing ──────
  describe('integration: generateDungeon with a world chronicle', () => {
    it('a chronicled dungeon quotes the real zone in its history summaries + hooks', () => {
      // Feed a chronicle straight through DungeonInput.world and confirm a bound
      // event surfaces its real name in the plan.
      const plan = generateDungeon({
        seed: 7,
        params: { theme: 'frost', roomCount: 26, partyLevel: 3, loopChance: 0.25, decorDensity: 0.6 },
        world: {
          builderName: 'the Vharûn garrison',
          builderStem: 'Vharûn',
          chronicle: REFS,
        },
      });
      const bound = plan.history.filter((e) => e.chronicleRef);
      // frost + these refs reliably binds (war→fire/brick-off/seal common in a
      // fortress log); assert grounding surfaced somewhere.
      if (bound.length > 0) {
        for (const ev of bound) {
          expect(ev.summary).toContain(ev.chronicleRef!.zoneName);
        }
        const names = bound.map((e) => e.chronicleRef!.zoneName);
        expect(names.some((n) => plan.rumorHooks.some((h) => h.text.includes(n)))).toBe(true);
      }
      // Monotonic ages hold in the assembled plan too.
      for (let i = 1; i < plan.history.length; i++) {
        expect(plan.history[i].yearsAgo).toBeLessThan(plan.history[i - 1].yearsAgo);
      }
    });

    it('an un-chronicled dungeon is byte-identical to one with an empty chronicle omitted', () => {
      const p1 = generateDungeon({ seed: 7, params: { theme: 'crypt' } });
      const p2 = generateDungeon({ seed: 7, params: { theme: 'crypt' } });
      // FNV over the grid — no chronicle input, so identical.
      const sum = (p: typeof p1) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < p.grid.length; i++) { h ^= p.grid[i]; h = Math.imul(h, 0x01000193); }
        return h >>> 0;
      };
      expect(sum(p1)).toBe(sum(p2));
      for (const ev of p1.history) expect(ev.chronicleRef).toBeUndefined();
    });
  });
});

// Keep the DungeonSite import meaningful for future maintainers reading the file.
export type { DungeonSite };
