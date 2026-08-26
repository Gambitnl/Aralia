/**
 * @file src/utils/sandbox/__tests__/quickCharacterGenerator.test.ts
 *
 * Guards the two centralization fixes made for Agora tasks agora-0202 and
 * agora-c582.
 *
 * agora-0202: `createQuickCharacter` used to write
 * `race.id === 'dwarf' || race.id === 'gnome' ? 25 : 30` into `speed`. No race
 * in `ALL_RACES_DATA` carries the id `dwarf` or `gnome` (the catalog ships
 * `hill_dwarf`, `mountain_dwarf`, `rock_gnome`, ...), so that branch was dead
 * and EVERY quick-assembled character walked at 30 ft. Speed now comes from
 * `calculateCharacterSpeedFromRace`, the same derivation the full character
 * creator uses, so Centaur (40 ft) and Frost Giant Goliath (35 ft) are correct
 * without a per-leaf override.
 *
 * agora-c582: `ALL_RACES_DATA` is built with `import.meta.glob`, so every race
 * file in `src/data/races/` is selectable through quick assembly with no
 * registration step. These tests pin that for Deep Gnome, which had a hand-built
 * fallback actor in its Design Preview leaf.
 */
import { describe, it, expect } from 'vitest';
import { createQuickCharacter, createQuickCombatCharacter } from '../quickCharacterGenerator';
import { ALL_RACES_DATA } from '../../../data/races';
import { calculateCharacterSpeedFromRace } from '../../character/characterUtils';
import type { Race } from '../../../types';

const BASE = { classId: 'fighter', level: 5, stats: [16, 12, 14, 10, 10, 10] as [number, number, number, number, number, number] };

describe('createQuickCharacter speed derivation (agora-0202)', () => {
  it('reads the canonical Speed trait instead of a 30 ft default', () => {
    const expected: Record<string, number> = {
      human: 30,
      centaur: 40,
      frost_giant_goliath: 35,
      wood_elf: 35,
      air_genasi: 35,
      hill_dwarf: 30,
      rock_gnome: 30,
    };
    for (const [raceId, speed] of Object.entries(expected)) {
      const character = createQuickCharacter({ ...BASE, raceId });
      expect(character, `${raceId} did not assemble`).not.toBeNull();
      expect(character!.speed, raceId).toBe(speed);
    }
  });

  it('agrees with the shared derivation for every race in the catalog', () => {
    const mismatched: string[] = [];
    for (const [raceId, race] of Object.entries(ALL_RACES_DATA) as Array<[string, Race]>) {
      const character = createQuickCharacter({ ...BASE, raceId });
      if (!character) {
        mismatched.push(`${raceId}: quick assembly returned null`);
        continue;
      }
      const central = calculateCharacterSpeedFromRace(race, {});
      if (character.speed !== central) {
        mismatched.push(`${raceId}: quick ${character.speed} vs central ${central}`);
      }
    }
    expect(mismatched, mismatched.join('; ')).toEqual([]);
  });

  it('carries racialSelections so a lineage speed increase applies', () => {
    const plain = createQuickCharacter({ ...BASE, raceId: 'elf' });
    const woodLineage = createQuickCharacter({
      ...BASE,
      raceId: 'elf',
      racialSelections: { elf: { choiceId: 'wood_elf' } } as never,
    });
    expect(plain!.speed).toBe(30);
    expect(woodLineage!.speed).toBe(35);
    expect(woodLineage!.racialSelections).toEqual({ elf: { choiceId: 'wood_elf' } });
  });

  it('projects the derived speed onto the combat actor movement pool', () => {
    const centaur = createQuickCombatCharacter({ ...BASE, raceId: 'centaur' });
    expect(centaur).not.toBeNull();
    expect(centaur!.stats.speed).toBe(40);
    expect(centaur!.actionEconomy.movement.total).toBe(40);
  });

  it('never resolves the dead dwarf/gnome ids the old hardcode keyed on', () => {
    // If either id is ever introduced the old 25 ft special case would have
    // been live; this records why removing it is safe today.
    expect(ALL_RACES_DATA.dwarf).toBeUndefined();
    expect(ALL_RACES_DATA.gnome).toBeUndefined();
  });
});

describe('createQuickCharacter race coverage (agora-c582)', () => {
  it('assembles every race in the glob-built catalog', () => {
    const rejected = Object.keys(ALL_RACES_DATA)
      .filter(raceId => createQuickCharacter({ ...BASE, raceId }) === null);
    expect(rejected, `quick assembly rejected: ${rejected.join(', ')}`).toEqual([]);
  });

  it('assembles Deep Gnome directly, so no preview-local fallback actor is needed', () => {
    const character = createQuickCharacter({
      name: 'Deep Gnome Gnomish Camouflage Tester',
      raceId: 'deep_gnome',
      classId: 'ranger',
      level: 5,
      stats: [10, 16, 12, 10, 10, 10],
    });
    expect(character).not.toBeNull();
    expect(character!.race.id).toBe('deep_gnome');
    expect(character!.speed).toBe(calculateCharacterSpeedFromRace(ALL_RACES_DATA.deep_gnome, {}));
  });

  it('still fails honestly on an unknown race or class', () => {
    expect(createQuickCharacter({ ...BASE, raceId: 'not_a_race' })).toBeNull();
    expect(createQuickCharacter({ ...BASE, classId: 'not_a_class', raceId: 'human' })).toBeNull();
  });
});
