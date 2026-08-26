/**
 * @file spellScarFootprint.test.ts — "Fireball scorches, Earthquake craters".
 *
 * Proves the spell → ground mapping, and that the three board words come out
 * as three genuinely different things: a mark with no depth, a bowl, and a
 * channel.
 */
import { describe, it, expect } from 'vitest';
import { footprintShapeForArea, spellTerrainFootprint, METERS_PER_FOOT } from '../spellScarFootprint';
import { addGroundScar, addScarMark, advanceTerrainSim, createTerrainSimState } from '../terrainSim';
import { groundScarHeightOffsetAt, scarMarkTintAt } from '../groundScar';

const center = { x: 0, y: 0, z: 0 };

describe('area → footprint shape', () => {
  it('a 20 ft radius sphere becomes a bowl about 6.1 m across the radius', () => {
    const shape = footprintShapeForArea({ shape: 'Sphere', size: 20 });
    expect(shape.kind).toBe('bowl');
    expect(shape.radiusM).toBeCloseTo(20 * METERS_PER_FOOT, 6);
  });

  it('a Line becomes a channel along the given heading', () => {
    const shape = footprintShapeForArea({ shape: 'Line', size: 100, width: 5 }, Math.PI / 4);
    expect(shape).toEqual({
      kind: 'channel',
      radiusM: (5 * METERS_PER_FOOT) / 2,
      halfLengthM: (100 * METERS_PER_FOOT) / 2,
      angleRad: Math.PI / 4,
    });
  });

  it('a Cube is inscribed rather than read as a radius', () => {
    const cube = footprintShapeForArea({ shape: 'Cube', size: 20 });
    const sphere = footprintShapeForArea({ shape: 'Sphere', size: 20 });
    expect(cube.radiusM).toBeLessThan(sphere.radiusM);
  });

  it('metres pass through unconverted when the caller says so', () => {
    expect(footprintShapeForArea({ shape: 'Sphere', size: 4, unit: 'meters' }).radiusM).toBe(4);
  });
});

describe('spell → what it leaves behind', () => {
  it('Fireball scorches: a mark, cause fire, no scar and no depth', () => {
    const out = spellTerrainFootprint({
      spellName: 'Fireball',
      area: { shape: 'Sphere', size: 20 },
      damageTypes: ['Fire'],
      center,
      day: 12,
    });
    expect(out?.kind).toBe('scorch');
    expect(out?.scar).toBeUndefined();
    expect(out?.mark?.cause).toBe('fire');
    expect(out?.mark?.shape.kind).toBe('patch');
    expect(out?.mark?.source).toEqual({ kind: 'spell', name: 'Fireball' });
  });

  it('Shatter craters: a scar, cause blast, bowl, real depth', () => {
    const out = spellTerrainFootprint({
      spellName: 'Shatter',
      area: { shape: 'Sphere', size: 10 },
      damageTypes: ['Thunder'],
      center,
      day: 12,
    });
    expect(out?.kind).toBe('crater');
    expect(out?.mark).toBeUndefined();
    expect(out?.scar?.cause).toBe('blast');
    expect(out?.scar?.shape.kind).toBe('bowl');
    expect(out?.scar?.depthM).toBeGreaterThan(0);
    expect(out?.scar?.depthM).toBeLessThanOrEqual(1.5);
  });

  it('a crater is capped so a huge area cannot dig a shaft', () => {
    const out = spellTerrainFootprint({
      spellName: 'Earthquake',
      area: { shape: 'Circle', size: 100 },
      damageTypes: ['Bludgeoning'],
      center,
      day: 1,
    });
    expect(out?.scar?.depthM).toBe(1.5);
  });

  it('Move Earth carves: earth-moving wins over any damage riding along', () => {
    const out = spellTerrainFootprint({
      spellName: 'Move Earth',
      area: { shape: 'Line', size: 60, width: 10 },
      damageTypes: ['Fire'], // deliberately contradictory
      earthMoving: 'excavate',
      center,
      day: 3,
      directionRad: 0,
    });
    expect(out?.kind).toBe('carve');
    expect(out?.scar?.cause).toBe('excavation');
    expect(out?.scar?.shape.kind).toBe('channel');
  });

  it('acid etches a shallow carve, not a stain', () => {
    const out = spellTerrainFootprint({
      area: { shape: 'Sphere', size: 20 },
      damageTypes: ['Acid'],
      center,
      day: 1,
    });
    expect(out?.kind).toBe('carve');
    expect(out?.scar?.cause).toBe('excavation');
  });

  it('spells that leave the ground alone return null', () => {
    for (const type of ['Cold', 'Necrotic', 'Psychic', 'Poison', 'Radiant']) {
      expect(
        spellTerrainFootprint({ area: { shape: 'Sphere', size: 20 }, damageTypes: [type], center, day: 1 }),
      ).toBeNull();
    }
    expect(spellTerrainFootprint({ area: { shape: 'Sphere', size: 20 }, center, day: 1 })).toBeNull();
  });
});

describe('end to end: a spell lands, the ground changes, then it heals', () => {
  it('Shatter digs a hole on day 5 that is gone, and marked, later', () => {
    let state = createTerrainSimState('battle:1', 5);
    const out = spellTerrainFootprint({
      spellName: 'Shatter',
      area: { shape: 'Sphere', size: 10 },
      damageTypes: ['Thunder'],
      center,
      day: 5,
    });
    expect(out?.scar).toBeDefined();
    ({ state } = addGroundScar(state, out!.scar!));

    const bornDepth = state.scars[0].depthM;
    expect(groundScarHeightOffsetAt(state.scars, 0, 0)).toBeCloseTo(-bornDepth, 6);

    // Persists a week later, shallower.
    const week = advanceTerrainSim(state, 12);
    expect(week.scars).toHaveLength(1);
    expect(week.scars[0].depthM).toBeLessThan(bornDepth);

    // Gone after enough days, leaving a blast mark on flat ground.
    const later = advanceTerrainSim(state, 5 + Math.ceil(bornDepth / 0.025) + 1);
    expect(later.scars).toHaveLength(0);
    expect(later.marks).toHaveLength(1);
    expect(groundScarHeightOffsetAt(later.scars, 0, 0)).toBe(0);
  });

  it('Fireball leaves a dark patch that never changes the height', () => {
    let state = createTerrainSimState('battle:1', 5);
    const out = spellTerrainFootprint({
      spellName: 'Fireball',
      area: { shape: 'Sphere', size: 20 },
      damageTypes: ['Fire'],
      center,
      day: 5,
    });
    ({ state } = addScarMark(state, out!.mark!));

    expect(groundScarHeightOffsetAt(state.scars, 0, 0)).toBe(0);
    expect(scarMarkTintAt(state.marks, 0, 0)[0]).toBeLessThan(0.5);

    // A year on the patch is still recorded, just faint.
    const year = advanceTerrainSim(state, 370);
    expect(year.marks).toHaveLength(1);
    expect(year.marks[0].weathering).toBe(1);
    expect(scarMarkTintAt(year.marks, 0, 0)[0]).toBeLessThan(1);
  });
});
