/**
 * Level-gated racial movement modes (agora-431e).
 *
 * `deriveAlternateMovementSpeeds` reads a race's whole trait list at once and
 * has no level to judge it by, so a level-1 Dragonborn reads as already flying.
 * These cases pin the level window instead: Draconic Flight is silent until
 * level 5, an ungated flight trait is live from level 1, and a mode written on
 * the core "Speed:" line is never gated.
 */
import { describe, it, expect } from 'vitest';
import {
  getRacialMovementSpeedsForLevel,
  getRacialMovementUnlocksForLevel,
} from '../progression';
import { applyRacialSpellGrantsByLevel, deriveAlternateMovementSpeeds } from '../stats';
import { createMockPlayerCharacter } from '../../core/factories';
import { DRAGONBORN_DATA } from '../../../data/races/dragonborn';
import { AARAKOCRA_DATA } from '../../../data/races/aarakocra';

describe('getRacialMovementSpeedsForLevel (agora-431e)', () => {
  it('withholds Dragonborn Draconic Flight below level 5', () => {
    const character = createMockPlayerCharacter({ level: 4, race: DRAGONBORN_DATA });

    expect(getRacialMovementSpeedsForLevel(character, 4)).toEqual({});
  });

  it('grants Draconic Flight at the walking speed from level 5', () => {
    const character = createMockPlayerCharacter({ level: 5, race: DRAGONBORN_DATA });

    expect(getRacialMovementSpeedsForLevel(character, 5)).toEqual({ fly: 30 });
  });

  it('names the trait and its unlock level for the granted mode', () => {
    const character = createMockPlayerCharacter({ level: 5, race: DRAGONBORN_DATA });

    expect(getRacialMovementUnlocksForLevel(character, 5)).toEqual([
      expect.objectContaining({
        mode: 'fly',
        speedFeet: 30,
        minLevel: 5,
        traitName: 'Draconic Flight (Level 5)',
      }),
    ]);
  });

  it('reads the character level when no target level is passed', () => {
    const early = createMockPlayerCharacter({ level: 1, race: DRAGONBORN_DATA });
    const late = createMockPlayerCharacter({ level: 20, race: DRAGONBORN_DATA });

    expect(getRacialMovementSpeedsForLevel(early)).toEqual({});
    expect(getRacialMovementSpeedsForLevel(late)).toEqual({ fly: 30 });
  });

  it('is the level-gated half of the level-blind parser it wraps', () => {
    const character = createMockPlayerCharacter({ level: 1, race: DRAGONBORN_DATA });

    // The existing helper cannot see the level, which is the gap this closes.
    expect(deriveAlternateMovementSpeeds(character)).toEqual({ fly: 30 });
    expect(getRacialMovementSpeedsForLevel(character, 1)).toEqual({});
  });

  it('keeps an ungated racial flight available from level 1', () => {
    const character = createMockPlayerCharacter({ level: 1, race: AARAKOCRA_DATA });

    expect(getRacialMovementSpeedsForLevel(character, 1)).toEqual({ fly: 30 });
  });

  it('never gates a mode written on the core Speed line', () => {
    const character = createMockPlayerCharacter({
      level: 1,
      race: { id: 'sea_elf', name: 'Sea Elf', description: '', traits: ['Speed: 30 feet, Swim 30 feet'] },
    });

    expect(getRacialMovementSpeedsForLevel(character, 1)).toEqual({ swim: 30 });
    expect(getRacialMovementUnlocksForLevel(character, 1)).toEqual([
      { mode: 'swim', speedFeet: 30, minLevel: 1, traitName: 'Speed' },
    ]);
  });

  it('reports nothing for a race with only a walking speed', () => {
    const character = createMockPlayerCharacter({
      level: 20,
      race: { id: 'human', name: 'Human', description: '', traits: ['Speed: 30 feet'] },
    });

    expect(getRacialMovementSpeedsForLevel(character, 20)).toEqual({});
  });
});

describe('Draconic Flight as a Long Rest resource (agora-431e)', () => {
  // The base Dragonborn trait text used to state no activation and no rest
  // limit, so the shared racial parser had no resource to emit. With the
  // canonical 2024 wording the existing level-gated grant pass seeds the use
  // itself, which is what makes the unlock real rather than prose-only.
  const RESOURCE_KEY = 'racial_feature_dragonborn__draconic_flight_level_5__resource';

  it('seeds no flight use below level 5', () => {
    const character = applyRacialSpellGrantsByLevel(
      createMockPlayerCharacter({ level: 4, race: DRAGONBORN_DATA }),
      4,
    );

    expect(character.limitedUses?.[RESOURCE_KEY]).toBeUndefined();
  });

  it('seeds one Long Rest use at level 5', () => {
    const character = applyRacialSpellGrantsByLevel(
      createMockPlayerCharacter({ level: 5, race: DRAGONBORN_DATA }),
      5,
    );

    expect(character.limitedUses?.[RESOURCE_KEY]).toEqual(
      expect.objectContaining({ current: 1, max: 1, resetOn: 'long_rest' }),
    );
  });
});
