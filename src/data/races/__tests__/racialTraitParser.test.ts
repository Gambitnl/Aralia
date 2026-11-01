import { describe, it, expect } from 'vitest';
import {
  buildRacialTraitLibrary,
  getRacialDefenseBucketsFromTraitText,
  getRacialModifierBucketsFromTraitText,
  normalizeRacialTraitDisplayText,
  type RacialFeatureTrait,
  type RacialSpellTrait,
} from '../racialTraits';
import { BLACK_DRAGONBORN_DATA } from '../black_dragonborn';
import { CHTHONIC_TIEFLING_DATA } from '../chthonic_tiefling';
import { DRACONBLOOD_DRAGONBORN_DATA } from '../draconblood_dragonborn';
import { FIRE_GENASI_DATA } from '../fire_genasi';
import { FOREST_GNOME_DATA } from '../forest_gnome';
import type { Race } from '../../../types';

/**
 * The shared racial parser is the single source every race surface reads. These
 * cases pin the canonical prose shapes that used to force a race leaf to strip
 * markup, re-parse, or hand-build a mechanic of its own.
 */

const featureTrait = (race: Race, traitName: string): RacialFeatureTrait => {
  const trait = buildRacialTraitLibrary({ [race.id]: race }).byRaceId[race.id]
    ?.find(candidate => candidate.type !== 'spell' && candidate.traitName === traitName);
  if (!trait || trait.type === 'spell') throw new Error(`no feature trait named ${traitName} for ${race.id}`);
  return trait;
};

const spellGrants = (race: Race): RacialSpellTrait[] =>
  buildRacialTraitLibrary({ [race.id]: race }).allSpells;

describe('normalizeRacialTraitDisplayText', () => {
  it('unwraps glossary links, Markdown links and emphasis', () => {
    expect(normalizeRacialTraitDisplayText('You have [[resistance|Resistance]] to [[acid_damage|Acid damage]].'))
      .toBe('You have Resistance to Acid damage.');
    expect(normalizeRacialTraitDisplayText('You have [[advantage]] on Intelligence saving throws.'))
      .toBe('You have advantage on Intelligence saving throws.');
    expect(normalizeRacialTraitDisplayText('A [Long Rest](/rules/long-rest) restores **all** uses.'))
      .toBe('A Long Rest restores all uses.');
  });

  it('is idempotent, so a caller that already normalized loses nothing', () => {
    const once = normalizeRacialTraitDisplayText('[[darkvision|Darkvision]] out to 60 feet.');
    expect(normalizeRacialTraitDisplayText(once)).toBe(once);
  });
});

describe('Defense token normalization', () => {
  it('reads a damage type that is stated with a trailing noun', () => {
    expect(getRacialDefenseBucketsFromTraitText('Fire Resistance: You have Resistance to Fire damage.').resistances)
      .toEqual(['Fire']);
  });

  it('reads a damage type through display links', () => {
    expect(getRacialDefenseBucketsFromTraitText('You have [[resistance|Resistance]] to [[acid_damage|Acid damage]].').resistances)
      .toEqual(['Acid']);
  });

  it('separates immunities and vulnerabilities from resistances', () => {
    const buckets = getRacialDefenseBucketsFromTraitText(
      'You have resistance to Cold damage, immunity to Poison damage, and vulnerability to Fire damage.',
    );
    expect(buckets.resistances).toEqual(['Cold']);
    expect(buckets.immunities).toEqual(['Poison']);
    expect(buckets.vulnerabilities).toEqual(['Fire']);
  });

  it('projects Fire Genasi resistance through the cached library (agora-c859)', () => {
    expect(featureTrait(FIRE_GENASI_DATA, 'Fire Resistance').defensiveTraits?.resistances).toEqual(['Fire']);
  });

  it('projects Black Dragonborn resistance from linked canonical text (agora-1525)', () => {
    expect(featureTrait(BLACK_DRAGONBORN_DATA, 'Damage Resistance').defensiveTraits?.resistances).toEqual(['Acid']);
  });
});

describe('Modifier parsing', () => {
  it('reads a "check ... with advantage" sentence (agora-49ed)', () => {
    const buckets = getRacialModifierBucketsFromTraitText(
      'Forceful Presence: When you make a Charisma (Intimidation or Persuasion) check, you can do so with advantage.',
    );
    expect(buckets.advantage).toContain('Charisma (Intimidation or Persuasion) checks');
  });

  it('projects Draconblood Forceful Presence advantage through the library (agora-49ed)', () => {
    expect(featureTrait(DRACONBLOOD_DRAGONBORN_DATA, 'Forceful Presence').modifierBuckets?.advantage)
      .toContain('Charisma (Intimidation or Persuasion) checks');
  });

  it('still reads the plain "advantage on ..." shape, through display links (agora-1525)', () => {
    expect(featureTrait(FOREST_GNOME_DATA, 'Gnomish Cunning').modifierBuckets?.advantage)
      .toEqual(['Intelligence, Wisdom, and Charisma saving throws']);
  });

  it('does not invent an advantage entry for a check with no advantage clause', () => {
    expect(getRacialModifierBucketsFromTraitText('When you make a Strength (Athletics) check, add your d4.').advantage)
      .toEqual([]);
  });

  it('reads a limited-use resource whose rest is inside a display link (agora-1525)', () => {
    expect(featureTrait(FOREST_GNOME_DATA, 'Speak with Animals').resources).toEqual([
      {
        id: 'forest_gnome__speak_with_animals__resource',
        maxUses: 'proficiency_bonus',
        resetOn: 'long_rest',
        sourceLabel: 'Speak with Animals usage',
      },
    ]);
  });
});

describe('Breath weapon parsing (agora-1525)', () => {
  it('reads the 2024 Black Dragonborn row without leaf help', () => {
    const breath = featureTrait(BLACK_DRAGONBORN_DATA, 'Breath Weapon').modifierBuckets?.breathWeapon;
    expect(breath).toBeDefined();
    expect(breath?.areaShape).toBe('cone');
    expect(breath?.areaSize).toBe(15);
    expect(breath?.saveAbility).toBe('Constitution');
    expect(breath?.damageDice).toBe('1d10');
    expect(breath?.damageType.toLowerCase()).toBe('acid');
  });

  it('expands the compact "increases by 1d10 at levels 5, 11, and 17" scaling', () => {
    expect(featureTrait(BLACK_DRAGONBORN_DATA, 'Breath Weapon').modifierBuckets?.breathWeapon?.scaling).toEqual([
      { level: 5, dice: '2d10' },
      { level: 11, dice: '3d10' },
      { level: 17, dice: '4d10' },
    ]);
  });
});

describe('Racial spell parsing (agora-2da3)', () => {
  it('does not turn a slot-casting permission into a spell grant', () => {
    const ids = spellGrants(CHTHONIC_TIEFLING_DATA).map(grant => grant.spellId);
    expect(ids).not.toContain('them-using-any');
    expect(ids.some(id => /\b(them|these|those|any|using)\b/.test(id.replace(/-/g, ' ')))).toBe(false);
  });

  it('keeps the long-rest budget the trait sentence states, against a legacy knownSpells row', () => {
    const grants = spellGrants(CHTHONIC_TIEFLING_DATA);
    expect(grants.find(grant => grant.spellId === 'false-life')?.castingMethod).toBe('once_per_long_rest');
    expect(grants.find(grant => grant.spellId === 'ray-of-enfeeblement')?.castingMethod).toBe('once_per_long_rest');
    // The at-will cantrip in the same trait keeps its own budget.
    expect(grants.find(grant => grant.spellId === 'chill-touch')?.castingMethod).toBe('at_will');
  });

  it('reads each spell at the level its own sentence states', () => {
    const grants = spellGrants(FIRE_GENASI_DATA);
    expect(grants.find(grant => grant.spellId === 'burning-hands')?.minLevel).toBe(3);
    expect(grants.find(grant => grant.spellId === 'flame-blade')?.minLevel).toBe(5);
    expect(grants.find(grant => grant.spellId === 'burning-hands')?.castingMethod).toBe('once_per_long_rest');
  });

  it('reads the "once with this trait ... when you finish a long rest" budget', () => {
    const grants = spellGrants(DRACONBLOOD_DRAGONBORN_DATA);
    expect(grants.find(grant => grant.spellId === 'comprehend-languages')?.castingMethod).toBe('once_per_long_rest');
    expect(grants.find(grant => grant.spellId === 'detect-magic')?.castingMethod).toBe('once_per_long_rest');
  });

  it('emits no prose-shaped spell id for any race in the corpus', () => {
    const races: Record<string, Race> = {
      black_dragonborn: BLACK_DRAGONBORN_DATA,
      chthonic_tiefling: CHTHONIC_TIEFLING_DATA,
      draconblood_dragonborn: DRACONBLOOD_DRAGONBORN_DATA,
      fire_genasi: FIRE_GENASI_DATA,
      forest_gnome: FOREST_GNOME_DATA,
    };
    const ids = buildRacialTraitLibrary(races).allSpells.map(grant => grant.spellId);
    ids.forEach(id => expect(id).toMatch(/^[a-z][a-z0-9-]*$/));
  });
});

describe('Legacy racial spell choice adapter (agora-c859)', () => {
  it('exposes availableAbilities listed in the choice description', () => {
    const choices = buildRacialTraitLibrary({ fire_genasi: FIRE_GENASI_DATA }).byChoiceRaceId.fire_genasi ?? [];
    const legacyChoice = choices.find(choice => choice.id === 'fire_genasi::legacy-choice');
    expect(legacyChoice?.availableAbilities).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
    expect(legacyChoice?.requiredSpellIds).toEqual(['produce-flame', 'burning-hands', 'flame-blade']);
  });

  it('falls through to the canonical trait row when the description only summarizes', () => {
    const choices = buildRacialTraitLibrary({ draconblood_dragonborn: DRACONBLOOD_DRAGONBORN_DATA })
      .byChoiceRaceId.draconblood_dragonborn ?? [];
    const legacyChoice = choices.find(choice => choice.id === 'draconblood_dragonborn::legacy-choice');
    expect(legacyChoice?.availableAbilities).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
  });

  it('leaves availableAbilities unset when no canonical text names an ability', () => {
    const race = {
      ...FIRE_GENASI_DATA,
      id: 'mute_genasi',
      traits: ['Reach to the Blaze: You know the Produce Flame cantrip.'],
      racialSpellChoice: {
        traitName: 'Reach to the Blaze',
        traitDescription: 'Choose your spellcasting ability for these spells.',
      },
    } as Race;
    const choices = buildRacialTraitLibrary({ mute_genasi: race }).byChoiceRaceId.mute_genasi ?? [];
    expect(choices.find(choice => choice.id === 'mute_genasi::legacy-choice')?.availableAbilities).toBeUndefined();
  });
});

describe('Racial spell parsing reconciliation (agora-9d61 / G63)', () => {
  it('parses multi-word spell titles containing "and", "or", and "without" intact', () => {
    const testRace: Race = {
      id: 'test_mark_race',
      name: 'Test Mark Race',
      description: 'Test description',
      traits: [
        'Magic: You can cast the Purify Food and Drink and Unseen Servant spells with this trait.',
        'Detection: You can cast the Detect Magic and Detect Poison and Disease spells with this trait.',
        'Nature: Starting at 3rd level, you can cast Create or Destroy Water once per long rest.',
        'Stealth: Starting at 5th level, you can cast Pass without Trace once per long rest.',
        'Giant: Starting at 3rd level, you can cast the Enlarge/Reduce spell on yourself.',
      ],
      abilityBonuses: [],
    };

    const spells = spellGrants(testRace);
    const ids = spells.map(s => s.spellId);
    expect(ids).toContain('purify-food-and-drink');
    expect(ids).toContain('unseen-servant');
    expect(ids).toContain('detect-magic');
    expect(ids).toContain('detect-poison-and-disease');
    expect(ids).toContain('create-or-destroy-water');
    expect(ids).toContain('pass-without-trace');
    expect(ids).toContain('enlarge-reduce');

    // Confirm no fragmented or invalid tokens were emitted
    expect(ids).not.toContain('drink');
    expect(ids).not.toContain('purify-food');
    expect(ids).not.toContain('detect-poison');
    expect(ids).not.toContain('disease');
    expect(ids).not.toContain('create');
    expect(ids).not.toContain('destroy-water');
    expect(ids).not.toContain('pass');
    expect(ids).not.toContain('enlarge');
  });

  it('rejects demonstrative pronoun "this" as a spell token in prose', () => {
    const forgeborn: Race = {
      id: 'test_forgeborn',
      name: 'Test Forgeborn',
      description: 'Test description',
      traits: [
        'Spellsmith: You know the Mending cantrip. You can also cast Magic Weapon with this trait. When you do so, the spell lasts for 1 hour. Once you cast this spell with this trait, you cannot do so again.',
      ],
      abilityBonuses: [],
    };

    const ids = spellGrants(forgeborn).map(s => s.spellId);
    expect(ids).toContain('mending');
    expect(ids).toContain('magic-weapon');
    expect(ids).not.toContain('this');
  });

  it('maps legacy "gust" cantrip to canonical "elementalism"', () => {
    const stormborn: Race = {
      id: 'test_stormborn',
      name: 'Test Stormborn',
      description: 'Test description',
      traits: [
        'Headwinds: You know the Gust cantrip. Starting at 3rd level, you can cast the Gust of Wind spell once with this trait.',
      ],
      abilityBonuses: [],
    };

    const ids = spellGrants(stormborn).map(s => s.spellId);
    expect(ids).toContain('elementalism');
    expect(ids).toContain('gust-of-wind');
    expect(ids).not.toContain('gust');
  });
});
