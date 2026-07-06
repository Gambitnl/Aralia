import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';
import { wireDoors } from '../doors';
import { EXTERIOR } from '../blueprintTypes';

const build = (type: any, seed: number) => {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  const rooms = assignPurposes(p, type, rg);
  const { doors } = wireDoors(p, rg, rooms);
  return { rooms, doors };
};

describe('wireDoors', () => {
  it('every room is reachable from the entry (connected graph)', () => {
    const { rooms, doors } = build('manor', 4);
    const entry = doors.find((d) => d.a === EXTERIOR)!;
    const adj = new Map<number, number[]>();
    for (const d of doors) {
      if (d.a === EXTERIOR) continue;
      (adj.get(d.a) ?? adj.set(d.a, []).get(d.a)!).push(d.b);
      (adj.get(d.b) ?? adj.set(d.b, []).get(d.b)!).push(d.a);
    }
    const seen = new Set([entry.b]); const st = [entry.b];
    while (st.length) for (const n of adj.get(st.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); st.push(n); }
    expect(seen.size).toBe(rooms.length);
  });

  it('the entry sits on the main room (or a corridor joined to it)', () => {
    const { rooms, doors } = build('tavern', 8);
    const entry = doors.find((d) => d.a === EXTERIOR)!;
    const room = rooms.find((r) => r.id === entry.b)!;
    expect(room.isMain || room.isCorridor).toBe(true);
  });
});
