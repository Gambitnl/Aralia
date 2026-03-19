import { describe, it, expect } from 'vitest';
import { buildSpellProfile } from './generate-spell-profiles';

const RAW_ACID_SPLASH = {
  id: 'acid-splash',
  name: 'Acid Splash',
  level: 0,
  school: 'Evocation',
  legacy: false,
  classes: ['Artificer', 'Sorcerer', 'Wizard'],
  ritual: false,
  attackType: '',
  castingTime: { value: 1, unit: 'action' },
  components: { verbal: true, somatic: true, material: false },
  duration: { concentration: false },
  targeting: { type: 'area' },
  effects: [{ type: 'DAMAGE' }],
  arbitrationType: 'mechanical',
};

describe('buildSpellProfile', () => {
  it('maps raw spell JSON to a canonical profile', () => {
    const profile = buildSpellProfile(RAW_ACID_SPLASH as any);
    expect(profile).toEqual({
      id: 'acid-splash',
      name: 'Acid Splash',
      level: 0,
      school: 'Evocation',
      classes: ['Artificer', 'Sorcerer', 'Wizard'],
      castingTimeUnit: 'action',
      concentration: false,
      ritual: false,
      components: { verbal: true, somatic: true, material: false },
      effectTypes: ['DAMAGE'],
      targetingType: 'area',
      attackType: 'none',
      arbitrationRequired: false,
      legacy: false,
    });
  });

  it('maps bonus_action casting time correctly', () => {
    const raw = { ...RAW_ACID_SPLASH, castingTime: { unit: 'bonus_action' } };
    expect(buildSpellProfile(raw as any).castingTimeUnit).toBe('bonus_action');
  });

  it('maps non-standard casting times to special', () => {
    const raw = { ...RAW_ACID_SPLASH, castingTime: { unit: 'minute' } };
    expect(buildSpellProfile(raw as any).castingTimeUnit).toBe('special');
  });

  it('maps arbitrationType ai_dm to arbitrationRequired: true', () => {
    const raw = { ...RAW_ACID_SPLASH, arbitrationType: 'ai_dm' };
    expect(buildSpellProfile(raw as any).arbitrationRequired).toBe(true);
  });

  it('collects all effectTypes from effects array', () => {
    const raw = {
      ...RAW_ACID_SPLASH,
      effects: [{ type: 'TERRAIN' }, { type: 'STATUS_CONDITION' }],
    };
    expect(buildSpellProfile(raw as any).effectTypes).toEqual([
      'TERRAIN',
      'STATUS_CONDITION',
    ]);
  });
});
