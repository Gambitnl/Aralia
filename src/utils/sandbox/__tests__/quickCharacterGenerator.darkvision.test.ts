/**
 * Quick-character darkvision comes from race trait text (GG-260).
 *
 * `createQuickCharacter` used to stamp a flat 60 ft on any race whose traits
 * mentioned darkvision, so Deep Gnome's canonical 120 ft was silently halved
 * and every sandbox actor built from that race disagreed with the character
 * sheet. It now calls `calculateCharacterDarkvisionFromRace`, the same
 * derivation `updateDerivedStats` uses.
 *
 * Called by: focused sandbox Vitest checks.
 * Depends on: the glob-built race catalog and src/utils/character/stats.ts.
 */
import { describe, it, expect } from 'vitest';
import { createQuickCharacter, createQuickCombatCharacter } from '../quickCharacterGenerator';
import { calculateCharacterDarkvisionFromRace } from '../../character/stats';
import { ALL_RACES_DATA } from '../../../data/races';

const BASE = { name: 'Darkvision Tester', classId: 'fighter', level: 1, stats: [10, 10, 10, 10, 10, 10] as [number, number, number, number, number, number] };

describe('createQuickCharacter darkvision range (GG-260)', () => {
  it('gives Deep Gnome its canonical 120 ft, not the retired flat 60', () => {
    const character = createQuickCharacter({ ...BASE, raceId: 'deep_gnome' });

    expect(character).not.toBeNull();
    expect(character!.darkvisionRange).toBe(120);
  });

  it('still gives an ordinary 60 ft race 60 ft', () => {
    const character = createQuickCharacter({ ...BASE, raceId: 'forest_gnome' });

    expect(character).not.toBeNull();
    expect(character!.darkvisionRange).toBe(60);
  });

  it('leaves a race with no darkvision trait at 0', () => {
    const character = createQuickCharacter({ ...BASE, raceId: 'human' });

    expect(character).not.toBeNull();
    expect(character!.darkvisionRange).toBe(0);
  });

  it('agrees with the shared derivation for every race in the catalog', () => {
    const disagreements = Object.keys(ALL_RACES_DATA).filter((raceId) => {
      const character = createQuickCharacter({ ...BASE, raceId });
      if (!character) return false;
      return character.darkvisionRange
        !== calculateCharacterDarkvisionFromRace(ALL_RACES_DATA[raceId], {});
    });

    expect(disagreements, `quick assembly disagreed for: ${disagreements.join(', ')}`).toEqual([]);
  });

  it('carries the derived range onto the combat actor senses', () => {
    const actor = createQuickCombatCharacter({ ...BASE, raceId: 'deep_gnome' });

    expect(actor).not.toBeNull();
    expect(actor!.stats.senses?.darkvision).toBe(120);
  });
});
