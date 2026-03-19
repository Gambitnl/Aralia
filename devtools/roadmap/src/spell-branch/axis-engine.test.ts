// devtools/roadmap/src/spell-branch/axis-engine.test.ts
import { describe, it, expect } from 'vitest';
import { computeAxisEngine } from './axis-engine';
import type { SpellCanonicalProfile } from './types';

// Minimal fixture profiles
const PROFILES: SpellCanonicalProfile[] = [
  {
    id: 'magic-missile',
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    classes: ['Wizard'],
    castingTimeUnit: 'action',
    concentration: false,
    ritual: false,
    components: { verbal: true, somatic: true, material: false },
    effectTypes: ['DAMAGE'],
    targetingType: 'single',
    attackType: '',
    arbitrationRequired: false,
    legacy: false,
  },
  {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    classes: ['Wizard', 'Sorcerer'],
    castingTimeUnit: 'reaction',
    concentration: false,
    ritual: false,
    components: { verbal: true, somatic: true, material: false },
    effectTypes: ['DEFENSIVE'],
    targetingType: 'self',
    attackType: '',
    arbitrationRequired: false,
    legacy: false,
  },
  {
    id: 'detect-magic',
    name: 'Detect Magic',
    level: 0,
    school: 'Divination',
    classes: ['Cleric', 'Druid', 'Wizard'],
    castingTimeUnit: 'action',
    concentration: true,
    ritual: true,
    components: { verbal: true, somatic: true, material: false },
    effectTypes: ['UTILITY'],
    targetingType: 'self',
    attackType: '',
    arbitrationRequired: false,
    legacy: false,
  },
];

describe('computeAxisEngine — no choices', () => {
  it('returns all spells when no choices made', () => {
    const result = computeAxisEngine(PROFILES, []);
    expect(result.filteredSpells).toHaveLength(3);
    expect(result.spellCount).toBe(3);
  });

  it('includes class axis with only values that exist', () => {
    const result = computeAxisEngine(PROFILES, []);
    const classAxis = result.availableAxes.find((a) => a.axisId === 'class');
    expect(classAxis).toBeDefined();
    const classValues = classAxis!.values.map((v) => v.value).sort();
    expect(classValues).toEqual(['Cleric', 'Druid', 'Sorcerer', 'Wizard']);
  });

  it('shows correct spell count per class value', () => {
    const result = computeAxisEngine(PROFILES, []);
    const classAxis = result.availableAxes.find((a) => a.axisId === 'class')!;
    const wizard = classAxis.values.find((v) => v.value === 'Wizard')!;
    expect(wizard.count).toBe(3); // all three spells are available to Wizard
  });
});

describe('computeAxisEngine — with choices', () => {
  it('filters spell set by class choice', () => {
    const result = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Cleric' },
    ]);
    expect(result.filteredSpells).toHaveLength(1);
    expect(result.filteredSpells[0].id).toBe('detect-magic');
  });

  it('removes chosen axis from available axes', () => {
    const result = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Wizard' },
    ]);
    const axisIds = result.availableAxes.map((a) => a.axisId);
    expect(axisIds).not.toContain('class');
  });

  it('recomputes remaining axis values from filtered set', () => {
    // After choosing Wizard, only Evocation + Abjuration + Divination remain
    const result = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Wizard' },
    ]);
    const schoolAxis = result.availableAxes.find((a) => a.axisId === 'school')!;
    const schools = schoolAxis.values.map((v) => v.value).sort();
    expect(schools).toEqual(['Abjuration', 'Divination', 'Evocation']);
  });

  it('chains two choices correctly', () => {
    const result = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Wizard' },
      { axisId: 'school', value: 'Abjuration' },
    ]);
    expect(result.filteredSpells).toHaveLength(1);
    expect(result.filteredSpells[0].id).toBe('shield');
  });
});

describe('computeAxisEngine — effectType axis (multi-value spells)', () => {
  it('counts spells correctly when a spell has multiple effect types', () => {
    const multiEffect: SpellCanonicalProfile = {
      id: 'grease',
      name: 'Grease',
      level: 1,
      school: 'Conjuration',
      classes: ['Wizard'],
      castingTimeUnit: 'action',
      concentration: false,
      ritual: false,
      components: { verbal: true, somatic: true, material: true },
      effectTypes: ['TERRAIN', 'STATUS_CONDITION'],
      targetingType: 'area',
      attackType: '',
      arbitrationRequired: false,
      legacy: false,
    };
    const result = computeAxisEngine([multiEffect], []);
    const effectAxis = result.availableAxes.find((a) => a.axisId === 'effectType')!;
    const types = effectAxis.values.map((v) => v.value).sort();
    expect(types).toEqual(['STATUS_CONDITION', 'TERRAIN']);
  });
});
