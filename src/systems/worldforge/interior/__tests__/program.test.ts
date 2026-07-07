import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes, assignUpperPurposes, type AssignOptions } from '../program';
import type { BedroomAssignment } from '../briefProgram';
import type { BuildingType, RoomPurpose } from '../blueprintTypes';

/** Shared internal: build the type's ground rg for a seed. */
const rgFor = (type: BuildingType, seed: number) => {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  return { p, rg };
};

const build = (type: any, seed: number) => {
  const { p, rg } = rgFor(type, seed);
  return assignPurposes(p, type, rg);
};

/** Shared fixture: same as `build` but returns the floor wrapped in `{ rooms }`
 *  so the v2-type program tests can read `.rooms`. */
const buildFloor = (type: BuildingType, seed: number) => ({ rooms: build(type, seed) });

/** Ground floor with brief opts; returns both rg (for the independent oracle)
 *  and the assigned rooms. */
const buildFloorWithOpts = (type: BuildingType, seed: number, opts: AssignOptions) => {
  const { p, rg } = rgFor(type, seed);
  return { rg, rooms: assignPurposes(p, type, rg, opts) };
};

/** Upper floor (level > 0) with a bedroom queue. */
const buildUpper = (
  type: BuildingType, seed: number, level: number, queue: BedroomAssignment[],
) => {
  const { p, rg } = rgFor(type, seed);
  return assignUpperPurposes(p, type, rg, level, queue);
};

/** Min occupied cy of a column in the room grid (independent test oracle). */
const minCyOfColumn = (rg: number[][], cx: number): number => {
  for (let cy = 0; cy < rg.length; cy++) if ((rg[cy]?.[cx] ?? -1) >= 0) return cy;
  return Infinity;
};

describe('assignPurposes', () => {
  it('exactly one main room, and it is the largest non-corridor', () => {
    const rooms = build('tavern', 5);
    expect(rooms.filter((r) => r.isMain)).toHaveLength(1);
    const main = rooms.find((r) => r.isMain)!;
    const nonCorridorAreas = rooms.filter((r) => !r.isCorridor).map((r) => r.cells.length);
    expect(main.cells.length).toBe(Math.max(...nonCorridorAreas));
  });

  it('the main room carries the type headline purpose', () => {
    expect(build('tavern', 5).find((r) => r.isMain)!.purpose).toBe('common-room');
    expect(build('manor', 6).find((r) => r.isMain)!.purpose).toBe('great-hall');
  });

  it('no building is half storeroom (storage rooms <= 1)', () => {
    for (let s = 0; s < 100; s++) {
      const rooms = build('tavern', s);
      expect(rooms.filter((r) => r.purpose === 'storage').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('adjacency-aware purposes (A9)', () => {
  const TYPES = ['cottage', 'tavern', 'manor', 'shop'] as const;
  const SEEDS = Array.from({ length: 60 }, (_, i) => i);
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  // Independent oracle: rebuild adjacency from the rooms' own cell lists.
  const touches = (a: any, b: any): boolean => {
    const set = new Set(a.cells.map((c: any) => key(c.cx, c.cy)));
    return b.cells.some(
      (c: any) =>
        set.has(key(c.cx + 1, c.cy)) || set.has(key(c.cx - 1, c.cy)) ||
        set.has(key(c.cx, c.cy + 1)) || set.has(key(c.cx, c.cy - 1)),
    );
  };

  it('kitchen shares a wall with the main room in >= 85% of plans that have both', () => {
    let both = 0, adjacent = 0;
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const rooms = build(type, seed);
        const main = rooms.find((r) => r.isMain)!;
        const kitchen = rooms.find((r) => r.purpose === 'kitchen');
        if (!kitchen) continue;
        both++;
        if (touches(kitchen, main)) adjacent++;
      }
    }
    expect(both).toBeGreaterThanOrEqual(40); // sweep must actually cover plans
    expect(adjacent / both).toBeGreaterThanOrEqual(0.85);
  });

  it('pantry/cellar shares a wall with the kitchen in >= 85% of plans that have both', () => {
    let both = 0, adjacent = 0;
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const rooms = build(type, seed);
        const kitchen = rooms.find((r) => r.purpose === 'kitchen');
        const pantry = rooms.find((r) => r.purpose === 'pantry' || r.purpose === 'cellar');
        if (!kitchen || !pantry) continue;
        both++;
        if (touches(pantry, kitchen)) adjacent++;
      }
    }
    expect(both).toBeGreaterThanOrEqual(40);
    expect(adjacent / both).toBeGreaterThanOrEqual(0.85);
  });
});

describe('room area + anchor (A3)', () => {
  const TYPES = ['cottage', 'shop', 'tavern', 'workshop', 'manor'] as const;
  const SEEDS = Array.from({ length: 20 }, (_, i) => i);
  const key = (cx: number, cy: number) => `${cx},${cy}`;

  it('anchor is always a member cell and area === cells.length', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        for (const room of build(type, seed)) {
          // Independent membership oracle: rebuild the cell set from scratch.
          const members = new Set(room.cells.map((c) => key(c.cx, c.cy)));
          expect(members.has(key(room.anchor.cx, room.anchor.cy))).toBe(true);
          expect(room.area).toBe(room.cells.length);
        }
      }
    }
  });

  it('rectangular rooms: anchor within 1 cell of the bbox center', () => {
    let rectRooms = 0;
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        for (const room of build(type, seed)) {
          const wCells = room.bbox.w / 5;
          const dCells = room.bbox.d / 5;
          if (room.area !== wCells * dCells) continue; // L-shaped
          rectRooms++;
          const centerCx = room.bbox.x / 5 + (wCells - 1) / 2;
          const centerCy = room.bbox.y / 5 + (dCells - 1) / 2;
          expect(Math.abs(room.anchor.cx - centerCx)).toBeLessThanOrEqual(1);
          expect(Math.abs(room.anchor.cy - centerCy)).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(rectRooms).toBeGreaterThan(0);
  });

  it('L-shaped rooms exist and their anchor is in-room even when the bbox center cell is not', () => {
    let lRooms = 0;
    let bboxCenterOutside = 0;
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        for (const room of build(type, seed)) {
          const wCells = room.bbox.w / 5;
          const dCells = room.bbox.d / 5;
          if (room.area === wCells * dCells) continue; // rectangular
          lRooms++;
          const members = new Set(room.cells.map((c) => key(c.cx, c.cy)));
          expect(members.has(key(room.anchor.cx, room.anchor.cy))).toBe(true);
          // bbox-center cell (rounded to a cell) — the naive "center" consumers used.
          const ccx = Math.floor(room.bbox.x / 5 + wCells / 2);
          const ccy = Math.floor(room.bbox.y / 5 + dCells / 2);
          if (!members.has(key(ccx, ccy))) bboxCenterOutside++;
        }
      }
    }
    // ~24% of rooms are L-shaped across the sweep; if none show up the
    // sweep itself is broken — fail, do not skip silently.
    expect(lRooms).toBeGreaterThan(0);
    // The complaint being fixed: at least one L-room's bbox center lands
    // outside the room, where anchor never does.
    expect(bboxCenterOutside).toBeGreaterThan(0);
  });

  it('area and anchor are deterministic (RNG-free rederivation)', () => {
    for (const type of TYPES) {
      const a = build(type, 7);
      const b = build(type, 7);
      expect(b).toEqual(a);
    }
  });
});

describe('v2 type programs', () => {
  it('temple headline is nave; keep gets guard-room; smithy gets forge — 50 seeds each', () => {
    const expects: Array<[BuildingType, RoomPurpose, RoomPurpose]> = [
      ['temple', 'nave', 'sanctuary'],
      ['keep', 'great-hall', 'guard-room'],
      ['smithy', 'forge', 'workshop'],
      ['inn', 'common-room', 'guest-room'],
      ['tenement', 'hall', 'private-room'],
    ];
    for (const [type, headline, mustHave] of expects) {
      let hits = 0;
      for (let seed = 0; seed < 50; seed++) {
        const rooms = buildFloor(type, seed).rooms; // shared fixture used by existing tests
        expect(rooms.find((r) => r.isMain)?.purpose).toBe(headline);
        if (rooms.some((r) => r.purpose === mustHave)) hits++;
      }
      // required slots (min 1) must always land when rooms exist for them
      expect(hits).toBeGreaterThanOrEqual(45);
    }
  });
});

describe('brief-driven placement', () => {
  it('forge lands street-facing >= 90% over 100 seeds (has a min-y outer edge)', () => {
    let ok = 0, total = 0;
    for (let seed = 0; seed < 100; seed++) {
      const { rg, rooms } = buildFloorWithOpts('smithy', seed, {
        tradeDemands: [{ purpose: 'forge', streetFacing: true }],
      });
      const forge = rooms.find((r) => r.purpose === 'forge');
      if (!forge) continue;
      total++;
      // independent oracle: recompute street ownership from rg
      const ownsStreet = forge.cells.some(
        (c) =>
          c.cy === 0 ||
          ((rg[c.cy - 1]?.[c.cx] ?? -1) < 0 && c.cy === minCyOfColumn(rg, c.cx)),
      );
      if (ownsStreet) ok++;
    }
    expect(total).toBeGreaterThan(80);
    expect(ok / total).toBeGreaterThanOrEqual(0.9);
  });

  it('an extra slot lands when a room is free and never appears without it', () => {
    let withHits = 0, withoutHits = 0;
    for (let seed = 0; seed < 60; seed++) {
      // Manor: five-slot program plus a servant-room extra — roomy enough that
      // the appended slot reaches a free room on many seeds.
      const withExtra = buildFloorWithOpts('manor', seed, {
        extraSlots: [{ purpose: 'servant-room', min: 1, max: 1 }],
      }).rooms;
      const without = buildFloorWithOpts('manor', seed, {}).rooms;
      if (withExtra.some((r) => r.purpose === 'servant-room')) withHits++;
      if (without.some((r) => r.purpose === 'servant-room')) withoutHits++;
    }
    // The extra slot introduces the purpose; it never arises on its own.
    expect(withoutHits).toBe(0);
    expect(withHits).toBeGreaterThan(0);
  });

  it('optless calls are byte-stable when opts is an empty object', () => {
    for (const type of ['cottage', 'smithy', 'tavern'] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const { p, rg } = rgFor(type, seed);
        const a = assignPurposes(p, type, rg);
        const b = assignPurposes(p, type, rg, {});
        expect(b).toEqual(a);
      }
    }
  });

  it('assignUpperPurposes consumes the bedroom queue with forSlot tags', () => {
    const queue: BedroomAssignment[] = [
      { slotTags: ['head', 'spouse'] },
      { slotTags: ['child:0'] },
    ];
    const rooms = buildUpper('cottage', 11, 1, queue);
    const tagged = rooms.filter((r) => r.forSlot);
    expect(tagged.length).toBeGreaterThanOrEqual(1);
    for (const r of tagged) expect(r.purpose).toBe('bedroom');
    // Contract: the FIRST queue entry (head,spouse) lands in the LARGEST room.
    const largestTagged = [...tagged].sort((a, b) => b.area - a.area || a.id - b.id)[0];
    expect(largestTagged.forSlot).toBe('head,spouse');
    // consumed entries removed from the queue
    expect(queue.length).toBeLessThan(2);
  });

  it('assignUpperPurposes with an EMPTY queue reproduces v1 repurpose exactly', () => {
    // Mirror the frozen repurpose() rule so Task 8 can delete it byte-for-byte.
    const repurpose = (rooms: ReturnType<typeof buildUpper>, level: number) =>
      rooms.map((room) => {
        if (room.isCorridor) return room;
        const purpose: RoomPurpose =
          level < 0
            ? room.id % 2 === 0 ? 'cellar' : 'storage'
            : room.isMain || room.id % 3 !== 2 ? 'bedroom' : 'guest-room';
        return { ...room, purpose };
      });
    for (const type of ['cottage', 'manor', 'inn'] as const) {
      for (let seed = 0; seed < 30; seed++) {
        const { p, rg } = rgFor(type, seed);
        const base = assignPurposes(p, type, rg);
        for (const level of [1, 2, -1]) {
          const upper = assignUpperPurposes(p, type, rg, level, []);
          expect(upper).toEqual(repurpose(base, level));
        }
      }
    }
  });
});
