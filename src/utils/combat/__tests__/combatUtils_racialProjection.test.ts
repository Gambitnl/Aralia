import { describe, it, expect } from 'vitest';
import {
  createPlayerCombatCharacter,
  parseRacialDamageDefensesFromTraits,
  spendCombatLimitedUse,
} from '../combatUtils';
import { createMockPlayerCharacter } from '../../core/factories';
import type { PlayerCharacter, Race } from '../../../types';

/**
 * Covers the persistent-to-combat racial projection: damage defenses read from
 * trait prose (agora-ddb7) and limited-use resources plus their shared payer
 * (agora-0ad6). Both used to be re-implemented by every Design Preview race
 * leaf, so these tests assert the bridge now produces them on its own.
 */

const raceWithTraits = (id: string, name: string, traits: string[]): Race => ({
  id,
  name,
  description: `${name} test race.`,
  traits,
});

const playerWithRace = (race: Race, overrides: Partial<PlayerCharacter> = {}): PlayerCharacter =>
  createMockPlayerCharacter({ race, ...overrides });

describe('parseRacialDamageDefensesFromTraits', () => {
  it('reads a single canonical resistance out of trait prose', () => {
    const defenses = parseRacialDamageDefensesFromTraits([
      'Chthonic Resistance: You have resistance to necrotic damage.',
    ]);

    expect(defenses.resistances).toEqual(['Necrotic']);
    expect(defenses.immunities).toEqual([]);
    expect(defenses.vulnerabilities).toEqual([]);
  });

  it('reads two types written as separate damage clauses', () => {
    const defenses = parseRacialDamageDefensesFromTraits([
      'Celestial Resistance: You have resistance to necrotic damage and radiant damage.',
    ]);

    expect(defenses.resistances).toEqual(['Necrotic', 'Radiant']);
  });

  it('reads two types sharing one damage anchor', () => {
    const defenses = parseRacialDamageDefensesFromTraits([
      'Natural Resilience: You have resistance to acid and poison damage and advantage on saving throws against poison.',
    ]);

    expect(defenses.resistances).toEqual(['Acid', 'Poison']);
  });

  it('separates immunity and vulnerability clauses from resistance clauses', () => {
    const defenses = parseRacialDamageDefensesFromTraits([
      'You are immune to poison damage, you have vulnerability to fire damage, and you have resistance to cold damage.',
    ]);

    expect(defenses.immunities).toEqual(['Poison']);
    expect(defenses.vulnerabilities).toEqual(['Fire']);
    expect(defenses.resistances).toEqual(['Cold']);
  });

  it('ignores choice-based and blanket prose that names no canonical type', () => {
    const defenses = parseRacialDamageDefensesFromTraits([
      'Damage Resistance: You have resistance to the damage type associated with your Draconic Ancestry.',
      'At 3rd level, you also gain resistance to all damage while the blessing lasts.',
    ]);

    expect(defenses.resistances).toEqual([]);
  });

  it('reads a type that the prose states without the word damage', () => {
    // The shared parser strips "damage" as noise and matches the type words in
    // the clause, so autognome-style prose still projects its poison defense.
    const defenses = parseRacialDamageDefensesFromTraits([
      'Mechanical Nature: You have resistance to poison, immunity to disease, and advantage on saves against being paralyzed.',
    ]);

    expect(defenses.resistances).toEqual(['Poison']);
    expect(defenses.immunities).toEqual([]);
  });

  it('de-duplicates a type mentioned by two traits', () => {
    const defenses = parseRacialDamageDefensesFromTraits([
      'Dwarven Resilience: You have Advantage on saving throws against poison, and you have Resistance to poison damage.',
      'Stout Resilience: You also have resistance to poison damage.',
    ]);

    expect(defenses.resistances).toEqual(['Poison']);
  });

  it('returns empty lists for a race with no traits', () => {
    expect(parseRacialDamageDefensesFromTraits(undefined)).toEqual({
      resistances: [],
      immunities: [],
      vulnerabilities: [],
    });
  });
});

describe('createPlayerCombatCharacter: racial damage defenses', () => {
  it('projects a trait-text resistance without any leaf adaptation', () => {
    const player = playerWithRace(
      raceWithTraits('chthonic_tiefling', 'Chthonic Tiefling', [
        'Chthonic Resistance: You have resistance to necrotic damage.',
      ])
    );

    const combatChar = createPlayerCombatCharacter(player);

    expect(combatChar.resistances).toEqual(['Necrotic']);
  });

  it('keeps the character data spelling and adds no duplicate entry', () => {
    const player = playerWithRace(
      raceWithTraits('chthonic_tiefling', 'Chthonic Tiefling', [
        'Chthonic Resistance: You have resistance to necrotic damage.',
      ]),
      { resistances: ['necrotic'] }
    );

    const combatChar = createPlayerCombatCharacter(player);

    expect(combatChar.resistances).toEqual(['necrotic']);
  });

  it('leaves defenses absent for a race whose traits state none', () => {
    const player = playerWithRace(raceWithTraits('human', 'Human', ['Versatile: You gain one feat.']));

    const combatChar = createPlayerCombatCharacter(player);

    expect(combatChar.resistances).toBeUndefined();
    expect(combatChar.immunities).toBeUndefined();
    expect(combatChar.vulnerabilities).toBeUndefined();
  });
});

describe('createPlayerCombatCharacter: limited-use projection', () => {
  const healingHandsId = 'racial_feature_fallen_aasimar__healing_hands__resource';

  const playerWithHealingHands = (): PlayerCharacter =>
    playerWithRace(
      raceWithTraits('fallen_aasimar', 'Fallen Aasimar', [
        'Celestial Resistance: You have resistance to necrotic damage and radiant damage.',
      ]),
      {
        limitedUses: {
          [healingHandsId]: { name: 'Healing Hands', current: 1, max: 1, resetOn: 'long_rest' },
        },
      }
    );

  it('carries racial feature resources into combat', () => {
    const combatChar = createPlayerCombatCharacter(playerWithHealingHands());

    expect(combatChar.limitedUses?.[healingHandsId]).toEqual({
      name: 'Healing Hands',
      current: 1,
      max: 1,
      resetOn: 'long_rest',
    });
  });

  it('clones each entry so combat cannot write back into the persistent character', () => {
    const player = playerWithHealingHands();
    const combatChar = createPlayerCombatCharacter(player);

    const spent = spendCombatLimitedUse(combatChar, healingHandsId);

    expect(spent.paid).toBe(true);
    expect(player.limitedUses?.[healingHandsId].current).toBe(1);
    expect(combatChar.limitedUses?.[healingHandsId].current).toBe(1);
  });

  it('leaves the field absent for a character with no resources', () => {
    const player = playerWithRace(raceWithTraits('human', 'Human', []), { limitedUses: undefined });

    expect(createPlayerCombatCharacter(player).limitedUses).toBeUndefined();
  });
});

describe('spendCombatLimitedUse', () => {
  const resourceId = 'racial_feature_firbolg__hidden_step__resource';

  const combatantWithUses = (current: number) =>
    createPlayerCombatCharacter(
      playerWithRace(raceWithTraits('firbolg', 'Firbolg', []), {
        limitedUses: {
          [resourceId]: { name: 'Hidden Step', current, max: 'proficiency_bonus', resetOn: 'long_rest' },
        },
      })
    );

  it('pays one use and reports what is left', () => {
    const payment = spendCombatLimitedUse(combatantWithUses(2), resourceId);

    expect(payment.paid).toBe(true);
    expect(payment.remaining).toBe(1);
    expect(payment.character.limitedUses?.[resourceId].current).toBe(1);
    expect(payment.reason).toBeUndefined();
  });

  it('refuses an exhausted resource instead of going negative', () => {
    const combatant = combatantWithUses(0);
    const payment = spendCombatLimitedUse(combatant, resourceId);

    expect(payment.paid).toBe(false);
    expect(payment.reason).toBe('resource_exhausted');
    expect(payment.remaining).toBe(0);
    expect(payment.character).toBe(combatant);
  });

  it('refuses a resource the combatant does not carry', () => {
    const combatant = combatantWithUses(1);
    const payment = spendCombatLimitedUse(combatant, 'racial_feature_missing__resource');

    expect(payment.paid).toBe(false);
    expect(payment.reason).toBe('resource_unavailable');
    expect(payment.remaining).toBeNull();
    expect(payment.character).toBe(combatant);
  });

  it('does not disturb the other resources it carries', () => {
    const combatant = combatantWithUses(2);
    const withExtra = {
      ...combatant,
      limitedUses: {
        ...combatant.limitedUses,
        second_wind: { name: 'Second Wind', current: 1, max: 1 as const, resetOn: 'short_rest' as const },
      },
    };

    const payment = spendCombatLimitedUse(withExtra, resourceId);

    expect(payment.character.limitedUses?.second_wind.current).toBe(1);
    expect(payment.character.limitedUses?.[resourceId].current).toBe(1);
  });
});
