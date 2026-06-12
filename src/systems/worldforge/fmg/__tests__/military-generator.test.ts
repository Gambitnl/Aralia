/**
 * @file military-generator.test.ts — golden + invariant tests for the
 * Military.generate port (pipeline stage 33). Goldens FREEZE AT ACCEPTANCE
 * per the Worldforge tracker conventions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateFmgWorld, type FmgWorldResult } from '../generateWorld';
import { MilitaryModule } from '../military-generator';

const SEED = 'world-42';
const OPTS = { width: 960, height: 540, cellsDesired: 10000, template: 'continents' as const };

let world: FmgWorldResult;

describe('Military.generate (FMG port, stage 33)', () => {
  beforeAll(() => {
    world = generateFmgWorld(SEED, OPTS);
  }, 120_000);

  it('every valid state has a military array and an alert rate', () => {
    const states = (world.pack as any).states;
    for (const s of states) {
      if (!s.i || s.removed) continue;
      expect(Array.isArray(s.military)).toBe(true);
      expect(s.alert).toBeGreaterThanOrEqual(0.1);
      expect(s.alert).toBeLessThanOrEqual(5);
      expect(s.temp).toBeUndefined(); // upstream deletes the scratch space
    }
  });

  it('matches FROZEN golden values for world-42', () => {
    const states = (world.pack as any).states;
    const valid = states.filter((s: any) => s.i && !s.removed);
    let regiments = 0;
    let troops = 0;
    for (const s of valid) {
      regiments += s.military.length;
      for (const r of s.military) troops += r.a;
    }
    const first = valid.find((s: any) => s.military.length)?.military[0];

    // notes is shared with later stages (Markers, stage 34) — count only
    // regiment legends here.
    const regimentNotes = world.notes.filter(n => n.id.startsWith('regiment')).length;
    const golden = {
      statesWithRegiments: valid.filter((s: any) => s.military.length).length,
      totalRegiments: regiments,
      totalTroops: troops,
      noteCount: regimentNotes,
      firstRegiment: first
        ? { name: first.name, a: first.a, icon: first.icon, n: first.n }
        : null,
    };

    expect(golden.totalRegiments).toBeGreaterThan(0);
    expect(golden.noteCount).toBe(golden.totalRegiments); // one note per regiment
    expect(golden).toMatchSnapshot('military-golden');
  });

  it('regiment invariants: troops by unit sum to total; names numbered; icons set', () => {
    const states = (world.pack as any).states;
    for (const s of states) {
      if (!s.i || s.removed) continue;
      for (const r of s.military) {
        const unitSum = Object.values(r.u as Record<string, number>).reduce(
          (acc: number, n) => acc + (n as number), 0,
        );
        expect(unitSum).toBe(r.a);
        expect(r.name).toMatch(/^\d+(st|nd|rd|th) .*(Regiment|Fleet)$/);
        expect(typeof r.icon).toBe('string');
        expect(r.icon!.length).toBeGreaterThan(0);
        expect(r.state).toBe(s.i);
        // naval flag ↔ Fleet naming
        if (r.n) expect(r.name).toContain('Fleet');
        else expect(r.name).toContain('Regiment');
      }
    }
  });

  it('determinism: same seed + options → identical regiments and notes', () => {
    const again = generateFmgWorld(SEED, OPTS);
    const a = (world.pack as any).states;
    const b = (again.pack as any).states;
    for (let i = 0; i < a.length; i++) {
      if (!a[i].i || a[i].removed) continue;
      expect(b[i].military).toEqual(a[i].military);
      expect(b[i].alert).toBe(a[i].alert);
    }
    expect(again.notes).toEqual(world.notes);
  }, 120_000);

  it('default unit roster matches upstream getDefaultOptions exactly', () => {
    expect(MilitaryModule.getDefaultOptions()).toEqual([
      {icon: '⚔️', name: 'infantry', rural: 0.25, urban: 0.2, crew: 1, power: 1, type: 'melee', separate: 0},
      {icon: '🏹', name: 'archers', rural: 0.12, urban: 0.2, crew: 1, power: 1, type: 'ranged', separate: 0},
      {icon: '🐴', name: 'cavalry', rural: 0.12, urban: 0.03, crew: 2, power: 2, type: 'mounted', separate: 0},
      {icon: '💣', name: 'artillery', rural: 0, urban: 0.03, crew: 8, power: 12, type: 'machinery', separate: 0},
      {icon: '🌊', name: 'fleet', rural: 0, urban: 0.015, crew: 100, power: 50, type: 'naval', separate: 1},
    ]);
  });
});
