/**
 * @file creatureProfiles.test.ts — every creature type × size resolves to a
 * body plan, and name cues steer ambiguous types.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { CreatureType } from '../../../types/creatures';
import { profileForCreature, SIZE_ORDER } from '../creatureProfiles';
import { registerAllParts } from '../parts';
import { getPart } from '../registry';

describe('entities3d creature profiles', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('resolves all 14 creature types at all 6 sizes', () => {
    const types = Object.values(CreatureType);
    expect(types.length).toBe(14);
    for (const t of types) {
      for (const size of SIZE_ORDER) {
        const resolved = profileForCreature(t, size);
        expect(resolved.gait).toBeTruthy();
        expect(resolved.frame.heightFt).toBeGreaterThan(0);
        expect(resolved.palette.skinHex).toMatch(/^#[0-9a-f]{6}$/i);
        for (const part of resolved.parts) {
          expect(() => getPart(part.partId), `${t}/${size} references missing part "${part.partId}"`).not.toThrow();
        }
      }
    }
  });

  it('frames grow monotonically with size', () => {
    for (const t of Object.values(CreatureType)) {
      let last = 0;
      for (const size of SIZE_ORDER) {
        const h = profileForCreature(t, size).frame.heightFt;
        expect(h, `${t} ${size} should be taller than the previous size`).toBeGreaterThan(last);
        last = h;
      }
    }
  });

  it('maps signature types to signature gaits', () => {
    expect(profileForCreature('Beast', 'Large').gait).toBe('quad');
    expect(profileForCreature('Dragon', 'Huge').gait).toBe('quad');
    expect(profileForCreature('Dragon', 'Huge').parts.some((p) => p.partId === 'wingsMembrane')).toBe(true);
    expect(profileForCreature('Ooze', 'Medium').gait).toBe('hopper');
    expect(profileForCreature('Aberration', 'Medium').gait).toBe('float');
    expect(profileForCreature('Aberration', 'Medium').parts.some((p) => p.partId === 'tentacles')).toBe(true);
    expect(profileForCreature('Giant', 'Huge').gait).toBe('biped');
    expect(profileForCreature('Humanoid', 'Medium').gait).toBe('biped');
  });

  it('steers by cue: spiders go hexapod, undead beasts go quad, birds fly', () => {
    expect(profileForCreature('Monstrosity', 'Medium', ['spider']).gait).toBe('hexapod');
    expect(profileForCreature('Monstrosity', 'Medium').gait).toBe('quad');
    expect(profileForCreature('Undead', 'Medium', ['wolf']).gait).toBe('quad');
    expect(profileForCreature('Undead', 'Medium').gait).toBe('biped');
    expect(profileForCreature('Beast', 'Small', ['bird']).gait).toBe('flyer');
  });

  it('throws on an unknown creature type — no fallback', () => {
    expect(() => profileForCreature('Slaadi', 'Medium')).toThrow(/Slaadi/);
  });
});
