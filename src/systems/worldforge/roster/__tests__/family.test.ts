/**
 * Proves the kinship layer: deterministic ages in band, households resolve into
 * couples/parents/children/siblings with reciprocal links, and everyone without
 * in-town family is either tied to another town or flagged alone.
 */
import { describe, it, expect } from 'vitest';
import { assignFamilies, familySummary } from '../family';
import { rootSeedPath } from '../../seedPath';
import type { Occupant } from '../types';

const SEED = rootSeedPath(42);
const occ = (id: number, ageBand: Occupant['ageBand'], homePlotId: number, over: Partial<Occupant> = {}): Occupant => ({
  id, name: `P${id}`, ageBand, homePlotId, occupation: 'resident', ...over,
});

describe('assignFamilies', () => {
  it('is deterministic and gives every villager an age within its band', () => {
    const people = [occ(1, 'adult', 10), occ(2, 'adult', 10), occ(3, 'child', 10), occ(4, 'elder', 20)];
    const a = assignFamilies(people, SEED);
    const b = assignFamilies(people, SEED);
    expect([...a.entries()]).toEqual([...b.entries()]); // deterministic
    expect(a.get(3)!.age).toBeGreaterThanOrEqual(4);
    expect(a.get(3)!.age).toBeLessThanOrEqual(15);
    expect(a.get(4)!.age).toBeGreaterThanOrEqual(58);
    expect(a.get(1)!.age).toBeGreaterThanOrEqual(20);
    expect(a.get(1)!.age).toBeLessThanOrEqual(55);
  });

  it('forms a couple with mutual spouse links and shared children', () => {
    // A household of 2 adults + 2 children. Seed chosen so the couple forms.
    const people = [occ(1, 'adult', 10), occ(2, 'adult', 10), occ(3, 'child', 10), occ(4, 'child', 10)];
    // Try a few seeds until one yields a couple (rng>0.15 → very likely on the first).
    let ties = assignFamilies(people, SEED);
    if (ties.get(1)!.spouseId === undefined) ties = assignFamilies(people, rootSeedPath(7));
    const s1 = ties.get(1)!;
    expect(s1.spouseId).toBeDefined();
    // Spouse link is reciprocal.
    expect(ties.get(s1.spouseId!)!.spouseId).toBe(1);
    // Both children list both parents; both parents list both children.
    expect(ties.get(3)!.parentIds.sort()).toEqual([1, 2]);
    expect(s1.childIds.sort()).toEqual([3, 4]);
    // A child's family summary names a parent.
    expect(familySummary(ties.get(3)!, (id) => `P${id}`)).toContain('Child of');
  });

  it('makes a lone adult either kin-elsewhere or alone — never silently family-less', () => {
    // 40 single-occupant households of one adult each → none have in-town family.
    const people = Array.from({ length: 40 }, (_, i) => occ(i + 1, 'adult', 100 + i));
    const ties = assignFamilies(people, SEED);
    let elsewhere = 0, alone = 0;
    for (const t of ties.values()) {
      expect(t.spouseId).toBeUndefined();
      expect(t.parentIds).toEqual([]);
      // Every lone villager is classified: distant kin OR alone.
      const classified = t.distantKin.length > 0 || t.alone;
      expect(classified).toBe(true);
      if (t.distantKin.length > 0) elsewhere++;
      if (t.alone) alone++;
    }
    // The population splits — some have family elsewhere, some truly nobody.
    expect(elsewhere).toBeGreaterThan(0);
    expect(alone).toBeGreaterThan(0);
    expect(elsewhere + alone).toBe(40);
  });

  it('familySummary phrases each relation type', () => {
    const nameOf = (id: number) => `P${id}`;
    const base = { age: 30, race: 'Human', parentIds: [], childIds: [], siblingIds: [], distantKin: [], alone: false };
    expect(familySummary({ ...base, occupantId: 1, spouseId: 2, childIds: [3] }, nameOf)).toContain('Married to P2');
    expect(familySummary({ ...base, occupantId: 1, age: 8, parentIds: [2] }, nameOf)).toContain('Child of P2');
    expect(familySummary({ ...base, occupantId: 1, childIds: [3, 4] }, nameOf)).toContain('Single parent');
    expect(familySummary({ ...base, occupantId: 1, distantKin: [{ town: 'Oakmere', relation: 'cousin', name: 'Bel' }] }, nameOf)).toContain('Family in Oakmere');
    expect(familySummary({ ...base, occupantId: 1, alone: true }, nameOf)).toBe('No known family');
  });

  it('blood relatives share a race; married-in spouses may differ', () => {
    const townsfolk = new Set(['Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Elf', 'Greenskins', 'Goliath', 'Tiefling', 'Aasimar', 'Draconic Kin', 'Beastfolk']);
    // A big roster so families form; check the invariant across all of them.
    const people = [
      occ(1, 'adult', 10), occ(2, 'adult', 10), occ(3, 'child', 10), occ(4, 'child', 10), // couple + kids
      ...Array.from({ length: 30 }, (_, i) => occ(100 + i, i % 3 === 0 ? 'child' : 'adult', 200 + Math.floor(i / 3))),
    ];
    const ties = assignFamilies(people, SEED);
    for (const t of ties.values()) {
      expect(townsfolk.has(t.race)).toBe(true); // valid ancestry
      // Children share each in-town parent's race UNLESS that parent is a married-in
      // spouse: the child matches the bloodline (the parent who is NOT a spouse-only).
      for (const sib of t.siblingIds) expect(ties.get(sib)!.race).toBe(t.race); // siblings always match
    }
    // The couple's children match the household head (occupant 1), not necessarily spouse 2.
    if (ties.get(1)!.spouseId === 2) {
      expect(ties.get(3)!.race).toBe(ties.get(1)!.race);
      expect(ties.get(4)!.race).toBe(ties.get(1)!.race);
    }
  });
});
