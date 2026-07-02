import { describe, expect, it } from 'vitest';
import { findPreRollBuffOffers, buildCheckBoostStatusEffect } from '../preRollBuffOffer';

// Narrow spell shapes mirroring the real JSON payloads (guidance.json /
// enhance-ability.json) — only the fields the module reads.
const GUIDANCE = {
  id: 'guidance', name: 'Guidance', level: 0,
  duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
  effects: [{ abilityCheckModifier: { appliesTo: 'ability_check', bonusDice: '1d4', skillSelection: 'chosen_skill' } }],
};
const ENHANCE_ABILITY = {
  id: 'enhance-ability', name: 'Enhance Ability', level: 2,
  duration: { type: 'timed', value: 1, unit: 'hour', concentration: true },
  effects: [{ abilityCheckModifier: { appliesTo: 'ability_check', bonusDice: '', flatModifier: 'advantage', skillSelection: 'chosen_ability' } }],
};
const FIREBOLT = { id: 'fire-bolt', name: 'Fire Bolt', level: 0, effects: [{}] };

const baseCharacter = (over: object = {}) => ({
  id: 'pc-1',
  statusEffects: [],
  spellSlots: {
    level_1: { current: 2, max: 2 },
    level_2: { current: 1, max: 1 },
  },
  ...over,
}) as never;

describe('findPreRollBuffOffers', () => {
  it('offers a known check-boost cantrip for free', () => {
    const offers = findPreRollBuffOffers({
      character: baseCharacter(),
      skillName: 'Stealth',
      spells: [GUIDANCE, FIREBOLT],
    });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ spellId: 'guidance', kind: 'bonus-dice', bonusDice: '1d4', castAtLevel: 0 });
  });

  it('offers a leveled advantage spell at its lowest available slot', () => {
    const offers = findPreRollBuffOffers({
      character: baseCharacter(),
      skillName: 'Stealth',
      spells: [ENHANCE_ABILITY],
    });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ spellId: 'enhance-ability', kind: 'advantage', castAtLevel: 2 });
  });

  it('skips a leveled spell with no available slot', () => {
    const offers = findPreRollBuffOffers({
      character: baseCharacter({ spellSlots: { level_2: { current: 0, max: 1 } } }),
      skillName: 'Stealth',
      spells: [ENHANCE_ABILITY],
    });
    expect(offers).toHaveLength(0);
  });

  it('does not offer a bonus-dice spell when a bonus-dice boost is already active for this skill', () => {
    const active = buildCheckBoostStatusEffect({ spell: GUIDANCE, skillName: 'Stealth', casterId: 'pc-1' });
    const offers = findPreRollBuffOffers({
      character: baseCharacter({ statusEffects: [active] }),
      skillName: 'Stealth',
      spells: [GUIDANCE],
    });
    expect(offers).toHaveLength(0);
  });

  it('still offers when the active boost targets a DIFFERENT chosen skill', () => {
    const active = buildCheckBoostStatusEffect({ spell: GUIDANCE, skillName: 'Athletics', casterId: 'pc-1' });
    const offers = findPreRollBuffOffers({
      character: baseCharacter({ statusEffects: [active] }),
      skillName: 'Stealth',
      spells: [GUIDANCE],
    });
    expect(offers).toHaveLength(1);
  });

  it('offers nothing for spells without an ability-check payload', () => {
    expect(findPreRollBuffOffers({ character: baseCharacter(), skillName: 'Stealth', spells: [FIREBOLT] })).toHaveLength(0);
  });
});

describe('buildCheckBoostStatusEffect', () => {
  it('mirrors the combat engine shape for a Guidance-style bonus die', () => {
    const eff = buildCheckBoostStatusEffect({ spell: GUIDANCE, skillName: 'Stealth', casterId: 'pc-1' });
    expect(eff.name).toBe('Guidance (Stealth)');
    expect(eff.type).toBe('buff');
    expect(eff.source).toBe('Guidance');
    expect(eff.sourceCasterId).toBe('pc-1');
    expect(eff.modifiers?.skill).toBe('Stealth');
    expect(eff.abilityCheckModifier).toMatchObject({ appliesTo: 'ability_check', bonusDice: '1d4' });
    // 1 minute → 10 rounds, like the engine's duration normalization.
    expect(eff.duration).toBe(10);
  });

  it('mirrors the Enhance Ability shape for advantage, scoped to the rolled skill', () => {
    const eff = buildCheckBoostStatusEffect({ spell: ENHANCE_ABILITY, skillName: 'Stealth', casterId: 'pc-1' });
    expect(eff.name).toBe('Enhance Ability (Stealth)');
    expect(eff.modifiers?.advantage).toEqual(['check']);
    expect(eff.modifiers?.skill).toBe('Stealth');
    // 1 hour → 600 rounds, like EnhanceAbilityCommand.getDurationRounds.
    expect(eff.duration).toBe(600);
  });
});
