/**
 * @file raceMap.test.ts — every race in the game resolves to a species profile.
 * This is the coverage guarantee: a new race without a mapping fails loudly here.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ALL_RACES_DATA } from '../../../data/races';
import { profileForRace } from '../raceMap';
import { registerAllParts } from '../parts';
import { getPart } from '../registry';

function midHeight(raceId: string): number {
  const [lo, hi] = profileForRace(raceId).heightRangeFt;
  return (lo + hi) / 2;
}

describe('entities3d race map', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('covers every race id in ALL_RACES_DATA', () => {
    const raceIds = Object.keys(ALL_RACES_DATA);
    expect(raceIds.length).toBeGreaterThan(100);
    for (const raceId of raceIds) {
      const profile = profileForRace(raceId);
      expect(profile, `race "${raceId}" resolved to nothing`).toBeTruthy();
      const [lo, hi] = profile.heightRangeFt;
      expect(lo, `race "${raceId}" min height`).toBeGreaterThan(1);
      expect(hi, `race "${raceId}" max height`).toBeLessThan(30);
      expect(lo).toBeLessThan(hi);
      expect(profile.bulkRange[0]).toBeGreaterThan(0.3);
      expect(profile.bulkRange[1]).toBeLessThan(2);
      expect(profile.skinTones.length, `race "${raceId}" has no skin tones`).toBeGreaterThan(0);
      expect(profile.eyeTones.length, `race "${raceId}" has no eye tones`).toBeGreaterThan(0);
    }
  });

  it('every feature part referenced by any race exists in the registry', () => {
    for (const raceId of Object.keys(ALL_RACES_DATA)) {
      for (const feature of profileForRace(raceId).features) {
        expect(() => getPart(feature.partId), `race "${raceId}" references missing part "${feature.partId}"`).not.toThrow();
      }
    }
  });

  it('keeps size ordering: gnome < dwarf < human < goliath', () => {
    expect(midHeight('rock_gnome')).toBeLessThan(midHeight('hill_dwarf'));
    expect(midHeight('hill_dwarf')).toBeLessThan(midHeight('human'));
    expect(midHeight('human')).toBeLessThan(midHeight('stone_giant_goliath'));
  });

  it('gives signature features to signature races', () => {
    const tiefling = profileForRace('infernal_tiefling');
    expect(tiefling.features.some((f) => f.partId.startsWith('horns'))).toBe(true);
    expect(tiefling.features.some((f) => f.partId.startsWith('tail'))).toBe(true);
    const elf = profileForRace('high_elf');
    expect(elf.features.some((f) => f.partId === 'earsPointed')).toBe(true);
    const dragonborn = profileForRace('red_dragonborn');
    expect(dragonborn.features.some((f) => f.partId === 'snout')).toBe(true);
    const aarakocra = profileForRace('aarakocra');
    expect(aarakocra.features.some((f) => f.partId === 'wingsFeathered')).toBe(true);
    const dwarf = profileForRace('mountain_dwarf');
    expect(dwarf.features.some((f) => f.partId === 'beardMesh')).toBe(true);
  });

  it('throws on an unknown race id — no fallback', () => {
    expect(() => profileForRace('not_a_race')).toThrow(/not_a_race/);
  });

  it('differentiates dragonborn chroma palettes', () => {
    const red = profileForRace('red_dragonborn');
    const gold = profileForRace('gold_dragonborn');
    expect(red.skinTones[0]).not.toEqual(gold.skinTones[0]);
  });
});
