/**
 * Race-leaf / shared-parser parity (agora-db71.19).
 *
 * Four race leaves used to carry their own copy of a rule the shared racial
 * parser could not yet read: a Fire Resistance fallback, a glossary-link
 * stripper, a Breath Weapon re-parser plus its scaling expansion, and a
 * hand-authored Forceful Presence advantage scope. PK-01 widened the parser and
 * those copies were deleted.
 *
 * These cases are the reason each one can stay deleted. They assert the SHARED
 * parser output directly against the value the retired copy used to produce, so
 * if the parser ever narrows again this file fails here rather than the leaf
 * quietly disagreeing with the character sheet.
 *
 * Called by: focused Race-domain Vitest checks.
 * Depends on: the canonical race records and src/data/races/racialTraits.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  buildRacialTraitLibrary,
  getRacialDefenseBucketsFromTraitText,
  type RacialFeatureTrait,
} from '../../../../../../data/races/racialTraits';
import { FIRE_GENASI_DATA } from '../../../../../../data/races/fire_genasi';
import { FOREST_GNOME_DATA } from '../../../../../../data/races/forest_gnome';
import { BLACK_DRAGONBORN_DATA } from '../../../../../../data/races/black_dragonborn';
import { DRACONBLOOD_DRAGONBORN_DATA } from '../../../../../../data/races/draconblood_dragonborn';
import { getCanonicalFireGenasiDamageResistances } from '../fireGenasiRaceLeaf';
import { getCanonicalBlackDragonbornTraits } from '../blackDragonbornRaceLeaf';
import type { Race } from '../../../../../../types';

/** The parsed non-spell trait with this display name, or undefined. */
const featureTrait = (race: Race, traitName: string): RacialFeatureTrait | undefined => {
  const parsed = buildRacialTraitLibrary({ [race.id]: race }).byRaceId[race.id] ?? [];
  return parsed.find((trait): trait is RacialFeatureTrait => (
    trait.type !== 'spell' && trait.traitName === traitName
  ));
};

describe('retired race-leaf fallbacks stay retired (agora-db71.19)', () => {
  it('reads Fire Genasi Fire Resistance from the shared parser, with no leaf fallback', () => {
    // The deleted fallback returned ['Fire'] from its own regex. The shared
    // parser now returns exactly that, so the leaf reads only the parser.
    const fromSharedParser = FIRE_GENASI_DATA.traits.flatMap(trait => (
      getRacialDefenseBucketsFromTraitText(trait).resistances
    ));

    expect(fromSharedParser).toEqual(['Fire']);
    expect(getCanonicalFireGenasiDamageResistances(FIRE_GENASI_DATA)).toEqual(fromSharedParser);
  });

  it('parses Forest Gnome Gnomish Cunning from the canonical Race without a leaf link stripper', () => {
    // The canonical row wraps "advantage" in a glossary link. The retired leaf
    // helper stripped that markup first; the parser now normalizes it itself,
    // so the unmodified Race must still yield the mental-save advantage.
    const cunning = featureTrait(FOREST_GNOME_DATA, 'Gnomish Cunning');

    expect(FOREST_GNOME_DATA.traits.some(trait => trait.includes('[[advantage]]'))).toBe(true);
    expect(cunning?.modifierBuckets?.advantage)
      .toEqual(['Intelligence, Wisdom, and Charisma saving throws']);
  });

  it('parses the whole Black Dragonborn Breath Weapon, scaling included, from the shared parser', () => {
    // The retired leaf re-parsed this row and then expanded the compact
    // "increases by 1d10 at levels 5, 11, and 17" phrase by hand.
    const breath = featureTrait(BLACK_DRAGONBORN_DATA, 'Breath Weapon')?.modifierBuckets?.breathWeapon;

    expect(breath).toEqual({
      areaShape: 'cone',
      areaSize: 15,
      saveAbility: 'Constitution',
      damageDice: '1d10',
      damageType: 'Acid',
      scaling: [
        { level: 5, dice: '2d10' },
        { level: 11, dice: '3d10' },
        { level: 17, dice: '4d10' },
      ],
    });
  });

  it('hands the leaf the parser record unchanged, including the Acid resistance', () => {
    const parsed = getCanonicalBlackDragonbornTraits(BLACK_DRAGONBORN_DATA);
    const breath = featureTrait(BLACK_DRAGONBORN_DATA, 'Breath Weapon')?.modifierBuckets?.breathWeapon;

    expect(parsed?.breath).toEqual(breath);
    expect(parsed?.resistance).toEqual(['Acid']);
    // Both authored shapes still come off the canonical sentence.
    expect(parsed?.breathShapes).toEqual([
      { shape: 'cone', sizeFeet: 15 },
      { shape: 'line', sizeFeet: 30 },
    ]);
  });

  it('projects the Draconblood Forceful Presence advantage scope from the shared parser', () => {
    // The retired leaf appended this exact string when the parser gave nothing.
    const forceful = featureTrait(DRACONBLOOD_DRAGONBORN_DATA, 'Forceful Presence');

    expect(forceful?.modifierBuckets?.advantage)
      .toEqual(['Charisma (Intimidation or Persuasion) checks']);
  });
});
