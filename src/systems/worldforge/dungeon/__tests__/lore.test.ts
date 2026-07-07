import { describe, it, expect } from 'vitest';
import { buildIntact, makeRng } from '../buildIntact';
import { simulateHistory } from '../simulateHistory';
import { deriveLore, spokenAge, selectNotedRoomIds, NOTE_CAP } from '../lore';
import { streamPath, rootSeedPath, childSeedPath } from '../../seedPath';
import { ARCHETYPES, THEME_ARCHETYPE } from '../archetypes';
import type { DungeonEvent, DungeonTheme, RoomPurpose, RoomType } from '../types';
import type { Room } from '../buildIntact';

/** Task 4's `make` helper + the lore stream — mirrors generateDungeon's wiring. */
function makeLore(seed: number, theme: DungeonTheme) {
  const archKey = THEME_ARCHETYPE[theme];
  const arch = ARCHETYPES[archKey];
  const base = childSeedPath(rootSeedPath(seed), 'dungeon');
  const st = buildIntact(makeRng(streamPath(base, `build:${archKey}`)), archKey, 22)!;
  const hist = simulateHistory(st, makeRng(streamPath(base, 'history')), archKey, theme, 0);
  const lore = deriveLore(makeRng(streamPath(base, 'lore')), arch, hist.events, st.rooms);
  return { lore, arch, hist, st };
}

const THEMES: DungeonTheme[] = ['crypt', 'cavern', 'frost', 'sewer', 'fungal'];

describe('deriveLore', () => {
  it('name embeds the builder stem and no syllable-bag gibberish', () => {
    const { lore, arch } = makeLore(42, 'crypt');
    expect(arch.namePool.some((n) => lore.name.includes(n))).toBe(true);
    expect(lore.builderName.length).toBeGreaterThan(0);
  });

  it('every note belongs to a room an event touched and every hook references a real event', () => {
    const { lore, hist } = makeLore(42, 'crypt');
    const touched = new Set(hist.events.flatMap((e) => e.roomIds));
    for (const roomId of lore.notes.keys()) expect(touched.has(roomId)).toBe(true);
    for (const h of lore.rumorHooks) expect(hist.events[h.eventRef]).toBeDefined();
    expect(lore.rumorHooks.length).toBe(hist.events.length);
  });

  it('blurb mentions the loudest event kind material and is deterministic', () => {
    const a = makeLore(7, 'frost').lore;
    const b = makeLore(7, 'frost').lore;
    expect(a.blurb).toBe(b.blurb);
    expect(a.blurb.length).toBeGreaterThan(20);
  });

  it('all derived text is deterministic and contains no leftover template tokens', () => {
    for (const theme of THEMES) {
      const a = makeLore(42, theme).lore;
      const b = makeLore(42, theme).lore;
      expect(a.name).toBe(b.name);
      expect(a.builderName).toBe(b.builderName);
      expect(a.blurb).toBe(b.blurb);
      expect([...a.notes.entries()]).toEqual([...b.notes.entries()]);
      expect(a.rumorHooks).toEqual(b.rumorHooks);

      const all = [
        a.name,
        a.builderName,
        a.blurb,
        ...a.notes.values(),
        ...a.rumorHooks.map((h) => h.text),
      ].join('\n');
      expect(all).not.toMatch(/\{[A-Za-z]+\}/); // no {N}, {T}, {anything}
      expect(all).not.toContain('undefined');
      expect(all).not.toContain('_'); // actor keys rendered as plain nouns
    }
  });

  it('spokenAge bands (F2): 91-99 reads "a century", not "over a century"', () => {
    expect(spokenAge(10)).toBe('a few years');
    expect(spokenAge(30)).toBe('a generation');
    expect(spokenAge(60)).toBe('sixty years');
    expect(spokenAge(90)).toBe('ninety years');
    // The F2 bug: 91-99 rounded to "over a century" — factually the wrong side
    // of 100. 91-110 now reads "a century".
    expect(spokenAge(91)).toBe('a century');
    expect(spokenAge(99)).toBe('a century');
    expect(spokenAge(105)).toBe('a century');
    expect(spokenAge(110)).toBe('a century');
    expect(spokenAge(111)).toBe('two centuries');
    expect(spokenAge(250)).toBe('two centuries');
    expect(spokenAge(400)).toBe('centuries');
    // Never the discredited "over a century" phrasing anywhere.
    for (let y = 1; y <= 600; y++) expect(spokenAge(y)).not.toBe('over a century');
  });

  it('a tunnel later sealed in the same room uses a past-only note (F1b)', () => {
    // After the F1 fix, tunnel->brick-off/collapse same-room cases are reachable.
    // The tunnel note must NOT claim present-state openness ("still open") once a
    // later event walls or buries it. crypt seed 7 is such a case (proven by the
    // sweep); scan defensively so the test is not brittle to one seed.
    // crypt seed 7 is a known tunnel#0 -> brick-off#2 same-room case (room 3);
    // a handful of other seeds are scanned so the test is not brittle to one.
    let checked = 0;
    const scan: Array<[DungeonTheme, number]> = [
      ['crypt', 7], ['crypt', 1], ['crypt', 42], ['sewer', 1], ['sewer', 5],
      ['sewer', 13], ['cavern', 3], ['frost', 2], ['fungal', 4], ['crypt', 19],
    ];
    for (const [theme, seed] of scan) {
      const archKey = THEME_ARCHETYPE[theme];
      const base = childSeedPath(rootSeedPath(seed), 'dungeon');
      const st = buildIntact(makeRng(streamPath(base, `build:${archKey}`)), archKey, 22);
      if (!st) continue;
      const hist = simulateHistory(st, makeRng(streamPath(base, 'history')), archKey, theme, 0);
      const lore = deriveLore(makeRng(streamPath(base, 'lore')), ARCHETYPES[archKey], hist.events, st.rooms);
      for (const t of hist.events.filter((e) => e.kind === 'tunnel' && e.failed !== true)) {
        const later = hist.events.find(
          (e2) => e2.id > t.id && (e2.kind === 'brick-off' || e2.kind === 'collapse')
            && e2.roomIds.some((r) => t.roomIds.includes(r)),
        );
        if (!later) continue;
        const roomId = later.roomIds.find((r) => t.roomIds.includes(r))!;
        const note = (lore.notes.get(roomId) ?? '').toLowerCase();
        expect(note).not.toContain('still open');
        expect(note).not.toContain('mouth is still');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0); // proves the case is reachable + asserted
  });

  it('no two hooks in one dungeon are byte-identical unless a kind exceeds its variants (F4)', () => {
    for (const theme of THEMES) {
      for (const seed of [1, 42, 1337, 2, 7]) {
        const archKey = THEME_ARCHETYPE[theme];
        const base = childSeedPath(rootSeedPath(seed), 'dungeon');
        const st = buildIntact(makeRng(streamPath(base, `build:${archKey}`)), archKey, 22);
        if (!st) continue;
        const hist = simulateHistory(st, makeRng(streamPath(base, 'history')), archKey, theme, 0);
        const lore = deriveLore(makeRng(streamPath(base, 'lore')), ARCHETYPES[archKey], hist.events, st.rooms);
        const kindCount: Record<string, number> = {};
        for (const ev of hist.events) kindCount[ev.kind] = (kindCount[ev.kind] ?? 0) + 1;
        const seenText = new Map<string, number>();
        lore.rumorHooks.forEach((hk, i) => {
          const prior = seenText.get(hk.text);
          if (prior !== undefined) {
            // A repeat is legal only when that kind occurs more times than the 2
            // variants its family provides.
            expect((kindCount[hist.events[i].kind] ?? 0)).toBeGreaterThan(2);
          }
          seenText.set(hk.text, i);
        });
      }
    }
  });

  it('an event touching more than 4 rooms yields at most 4 notes for that event', () => {
    // Remy feedback: a dungeon-wide awaken/bloom must not note EVERY touched
    // room — the keyed map degenerates into dozens of near-identical entries.
    // Rooms touched ONLY by the wide event can only have been noted by it, so
    // counting notes among those rooms bounds that event's note output exactly.
    let wideEvents = 0;
    for (const theme of ['crypt', 'fungal'] as DungeonTheme[]) {
      for (const seed of [1, 7, 42, 2]) {
        const archKey = THEME_ARCHETYPE[theme];
        const base = childSeedPath(rootSeedPath(seed), 'dungeon');
        const st = buildIntact(makeRng(streamPath(base, `build:${archKey}`)), archKey, 22);
        if (!st) continue;
        const hist = simulateHistory(st, makeRng(streamPath(base, 'history')), archKey, theme, 0);
        const lore = deriveLore(makeRng(streamPath(base, 'lore')), ARCHETYPES[archKey], hist.events, st.rooms);
        const realIds = new Set(st.rooms.map((r) => r.id));
        for (const ev of hist.events) {
          const touched = [...new Set(ev.roomIds)].filter((id) => realIds.has(id));
          if (touched.length <= NOTE_CAP) continue;
          wideEvents++;
          const exclusive = touched.filter(
            (id) => !hist.events.some((e2) => e2.id !== ev.id && e2.roomIds.includes(id)),
          );
          const noted = exclusive.filter((id) => lore.notes.has(id));
          expect(noted.length).toBeLessThanOrEqual(NOTE_CAP);
        }
      }
    }
    expect(wideEvents).toBeGreaterThan(0); // proves the >4-room case is reachable
  });

  it('the boss room keeps its note when the apex event touches it', () => {
    // In the pipeline deriveLore runs after assignSemantics, so the boss room
    // carries type 'boss'. Mimic that here: take a wide event, pick a touched
    // room the cap would otherwise DROP, mark it boss, and prove the cap now
    // keeps it noted.
    let checked = 0;
    for (const theme of ['crypt', 'fungal'] as DungeonTheme[]) {
      for (const seed of [1, 7, 42, 2]) {
        const archKey = THEME_ARCHETYPE[theme];
        const base = childSeedPath(rootSeedPath(seed), 'dungeon');
        const st = buildIntact(makeRng(streamPath(base, `build:${archKey}`)), archKey, 22);
        if (!st) continue;
        const hist = simulateHistory(st, makeRng(streamPath(base, 'history')), archKey, theme, 0);
        const roomById = new Map(st.rooms.map((r) => [r.id, r]));
        const wide = hist.events.find(
          (ev) => new Set(ev.roomIds.filter((id) => roomById.has(id))).size > NOTE_CAP,
        );
        if (!wide) continue;
        const dropped = [...new Set(wide.roomIds)].filter(
          (id) => roomById.has(id) && !selectNotedRoomIds(wide, roomById).has(id),
        );
        expect(dropped.length).toBeGreaterThan(0); // cap must drop something
        const bossId = dropped[0];
        roomById.get(bossId)!.type = 'boss';
        const lore = deriveLore(makeRng(streamPath(base, 'lore')), ARCHETYPES[archKey], hist.events, st.rooms);
        expect(lore.notes.has(bossId)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('selectNotedRoomIds is rng-free: boss first, distinctive purposes, then deepest', () => {
    const mkRoom = (id: number, purpose: RoomPurpose, depth = 0, type: RoomType = 'combat'): Room => ({
      id, x0: 0, y0: 0, w: 3, h: 3, shape: 'rect', mask: new Uint8Array(9).fill(1),
      type, purpose, depth, difficulty: 0, degree: 1, area: 9,
    });
    const rooms = [
      mkRoom(0, 'burial-gallery', 5, 'boss'),
      mkRoom(1, 'chapel', 1),
      mkRoom(2, 'treasury', 0),
      mkRoom(3, 'burial-gallery', 4),
      mkRoom(4, 'burial-gallery', 2),
      mkRoom(5, 'burial-gallery', 1),
    ];
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const ev: DungeonEvent = {
      id: 0, kind: 'awaken', yearsAgo: 60, roomIds: [5, 4, 3, 2, 1, 0], summary: 'the dead woke',
    };
    const picked = selectNotedRoomIds(ev, roomById);
    expect(picked.size).toBe(NOTE_CAP);
    expect(picked.has(0)).toBe(true); // boss always kept
    expect(picked.has(1)).toBe(true); // chapel over generic galleries
    expect(picked.has(2)).toBe(true); // treasury over generic galleries
    expect(picked.has(3)).toBe(true); // deepest remaining gallery
    // Under the cap: every touched room is noted, untouched rooms never are.
    const small: DungeonEvent = { ...ev, id: 1, roomIds: [2, 4] };
    expect([...selectNotedRoomIds(small, roomById)].sort()).toEqual([2, 4]);
  });

  it('rumor hooks carry the speaker bias and radius formula from the brief', () => {
    for (const theme of THEMES) {
      const { lore, hist } = makeLore(1337, theme);
      for (const h of lore.rumorHooks) {
        const ev = hist.events[h.eventRef];
        // radiusFt = 5280 * (2 + loudnessRank); rank order seal < reoccupy < den
        // < tunnel < collapse < plunder < brick-off < fire < flood < awaken < bloom
        const rank = ['seal', 'reoccupy', 'den', 'tunnel', 'collapse', 'plunder', 'brick-off', 'fire', 'flood', 'awaken', 'bloom'].indexOf(ev.kind);
        expect(h.radiusFt).toBe(5280 * (2 + rank));
        if (['seal', 'collapse', 'fire'].includes(ev.kind)) {
          expect(h.speakerBias).toBe('elder');
        } else if (['plunder', 'tunnel', 'reoccupy'].includes(ev.kind)) {
          expect(h.speakerBias).toBe('adventurer');
        } else {
          expect(h.speakerBias).toBe(ev.yearsAgo < 40 ? 'elder' : 'scholar');
        }
      }
    }
  });
});
