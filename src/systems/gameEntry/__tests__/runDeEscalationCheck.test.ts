import { describe, expect, it } from 'vitest';
import { resolveCheck, getActiveCheckBoosts } from '../runDeEscalationCheck';

describe('resolveCheck', () => {
  it('succeeds when d20 + modifier meets the DC', () => {
    expect(resolveCheck({ d20: 10, modifier: 6, dc: 15 })).toEqual({ success: true, total: 16, d20: 10, modifier: 6, dc: 15 });
  });
  it('fails when below the DC', () => {
    expect(resolveCheck({ d20: 5, modifier: 3, dc: 15 })).toMatchObject({ success: false, total: 8 });
  });
  it('compares total to DC with no auto-success rule', () => {
    expect(resolveCheck({ d20: 20, modifier: -2, dc: 15 })).toMatchObject({ success: true, total: 18 });
  });
});

describe('getActiveCheckBoosts', () => {
  it('reports an active Guidance buff that matches the skill', () => {
    const character = {
      statusEffects: [
        { id: 'g', name: 'Guidance (Stealth)', type: 'buff', duration: 10, source: 'Guidance',
          abilityCheckModifier: { appliesTo: 'ability_check', bonusDice: '1d4', skillSelection: 'chosen_skill', frequency: 'every_matching_check', durationScope: 'while_active' },
          modifiers: { skill: 'Stealth' } },
      ],
    } as any;
    const boosts = getActiveCheckBoosts(character, 'Stealth');
    expect(boosts.map((b) => b.source)).toEqual(['Guidance']);
  });

  it('ignores a Guidance bound to a different skill', () => {
    const character = { statusEffects: [
      { id: 'g', name: 'Guidance (Athletics)', type: 'buff', duration: 10, source: 'Guidance',
        abilityCheckModifier: { appliesTo: 'ability_check', bonusDice: '1d4', skillSelection: 'chosen_skill', frequency: 'every_matching_check', durationScope: 'while_active' },
        modifiers: { skill: 'Athletics' } },
    ] } as any;
    expect(getActiveCheckBoosts(character, 'Stealth')).toEqual([]);
  });
});
