/**
 * Level-gated racial movement modes (agora-431e).
 *
 * `deriveAlternateMovementSpeeds` used to read a race's whole trait list at once
 * with no level, so a level-1 Dragonborn read as already flying (GG-259). It is
 * level-gated now. These cases pin the level window: Draconic Flight is silent until
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

  // GG-259: this case used to pin the fault (the public helper returned
  // { fly: 30 } for a level-1 Dragonborn). The helper is level-gated now.
  it('deriveAlternateMovementSpeeds gives a level-1 Dragonborn no flight', () => {
    const character = createMockPlayerCharacter({ level: 1, race: DRAGONBORN_DATA });

    expect(deriveAlternateMovementSpeeds(character)).toEqual({});
    expect(getRacialMovementSpeedsForLevel(character, 1)).toEqual({});
  });

  it('deriveAlternateMovementSpeeds unlocks Draconic Flight at level 5, not level 4', () => {
    expect(deriveAlternateMovementSpeeds(createMockPlayerCharacter({ level: 4, race: DRAGONBORN_DATA }))).toEqual({});
    expect(deriveAlternateMovementSpeeds(createMockPlayerCharacter({ level: 5, race: DRAGONBORN_DATA }))).toEqual({ fly: 30 });
    // An explicit level overrides the character's own level.
    expect(deriveAlternateMovementSpeeds(createMockPlayerCharacter({ level: 1, race: DRAGONBORN_DATA }), 5)).toEqual({ fly: 30 });
  });

  it('deriveAlternateMovementSpeeds keeps an ungated level-1 flight (Aarakocra)', () => {
    expect(deriveAlternateMovementSpeeds(createMockPlayerCharacter({ level: 1, race: AARAKOCRA_DATA }))).toEqual({ fly: 30 });
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

  // Unlisted inline race objects (custom races, NPCs, or save fixtures whose
  // race.id is not in ALL_RACES_DATA) fall back to parsing character.race.traits
  // through buildRacialTraitLibrary so trait-prose movement modes are preserved
  // alongside their level windows (WF-G277).
  it('resolves trait-prose movement speeds for an unlisted inline race ID (WF-G277)', () => {
    const character = createMockPlayerCharacter({
      level: 1,
      race: {
        id: 'custom_cliff_strider',
        name: 'Cliff Strider',
        description: 'An inline custom race not registered in ALL_RACES_DATA.',
        traits: [
          'Speed: 30 feet',
          'Stone Grip: You have a climbing speed equal to your walking speed.',
          'Gossamer Wings (Level 5): Starting at 5th level, you have a flying speed equal to your walking speed.',
        ],
      },
    });

    // At level 1, the ungated climbing trait is active while the level-5 flight trait is withheld.
    expect(getRacialMovementSpeedsForLevel(character, 1)).toEqual({ climb: 30 });
    expect(getRacialMovementUnlocksForLevel(character, 1)).toEqual([
      expect.objectContaining({
        mode: 'climb',
        speedFeet: 30,
        minLevel: 1,
        traitName: 'Stone Grip',
      }),
    ]);

    // At level 5, the level-gated flight trait unlocks alongside climbing.
    expect(getRacialMovementSpeedsForLevel(character, 5)).toEqual({ climb: 30, fly: 30 });
    expect(getRacialMovementUnlocksForLevel(character, 5)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: 'climb',
          speedFeet: 30,
          minLevel: 1,
          traitName: 'Stone Grip',
        }),
        expect.objectContaining({
          mode: 'fly',
          speedFeet: 30,
          minLevel: 5,
          traitName: 'Gossamer Wings (Level 5)',
        }),
      ]),
    );
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
