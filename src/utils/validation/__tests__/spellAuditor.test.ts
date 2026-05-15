
import { describe, it, expect } from 'vitest';
import { auditSpell } from '../spellAuditor';

// Spell targeting filters are intentionally explicit so the spell schema can
// tell the difference between "this mechanic is absent" and "this mechanic was
// forgotten." These audit tests are about scaling issues, so they use neutral
// not-applicable filter values everywhere targeting is not under test.
function createNeutralTargetFilter() {
  return {
    creatureTypes: [],
    excludeCreatureTypes: [],
    sizes: [],
    alignments: [],
    hasCondition: [],
    isNativeToPlane: false,
    willing: 'not_applicable',
    objectEligibility: {
      wornOrCarried: 'not_applicable',
      magicalStatus: 'not_applicable',
      fixedToSurface: 'not_applicable',
      maxSize: 'not_applicable',
      maxWeightPounds: 'not_applicable',
      maxWeightScaling: 'not_applicable',
    },
    communicationPrerequisites: {
      canHearCaster: 'not_applicable',
      canUnderstandCaster: 'not_applicable',
      canSeeCaster: 'not_applicable',
    },
    abilityThreshold: {
      ability: 'not_applicable',
      operator: 'not_applicable',
      value: 'not_applicable',
    },
    selfRelation: 'not_applicable',
  };
}

describe('spellAuditor', () => {
  it('detects phantom scaling (text without logic)', () => {
    // We need a valid spell according to the strict Schema
    const mockSpell = {
      id: 'test-spell',
      name: 'Test Spell',
      aliases: [],
      level: 1,
      school: 'Evocation',
      source: 'PHB',
      legacy: false,
      ritual: false, // Added missing required field
      rarity: 'common', // Added missing required field
      attackType: 'none', // Added missing required field
      classes: ['Wizard'],
      subClasses: [],
      subClassesVerification: 'unverified',
      castingTime: { value: 1, unit: 'action', combatCost: { type: 'action', condition: '' }, explorationCost: { value: 0, unit: 'minute' } },
      range: { type: 'ranged', distance: 60 },
      components: { verbal: true, somatic: true, material: false, isConsumed: false, materialDescription: '', materialCost: 0 },
      duration: { type: 'instantaneous', concentration: false, value: 0, unit: 'round' },
      targeting: { type: 'single', range: 60, validTargets: ['creatures'], lineOfSight: true, maxTargets: 1, areaOfEffect: { shape: 'Sphere', size: 0 }, filter: createNeutralTargetFilter() },
      effects: [
        {
          type: 'DAMAGE',
          trigger: { type: 'immediate' },
          condition: { type: 'hit' },
          damage: { dice: '1d6', type: 'Fire' },
          description: 'Deals damage'
        }
      ],
      arbitrationType: 'mechanical',
      aiContext: { prompt: '', playerInputRequired: false },
      description: 'A test spell.',
      higherLevels: 'When cast at higher levels, deals +1d6 damage.', // TEXT EXISTS
      tags: []
    };

    const result = auditSpell(mockSpell);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'phantom_scaling',
        severity: 'warning'
      })
    ]));
  });

  it('passes when scaling logic exists', () => {
    const mockSpell = {
      id: 'test-spell-good',
      name: 'Test Spell Good',
      aliases: [],
      level: 1,
      school: 'Evocation',
      source: 'PHB',
      legacy: false,
      ritual: false, // Added missing required field
      rarity: 'common', // Added missing required field
      attackType: 'none', // Added missing required field
      classes: ['Wizard'],
      subClasses: [],
      subClassesVerification: 'unverified',
      castingTime: { value: 1, unit: 'action', combatCost: { type: 'action', condition: '' }, explorationCost: { value: 0, unit: 'minute' } },
      range: { type: 'ranged', distance: 60 },
      components: { verbal: true, somatic: true, material: false, isConsumed: false, materialDescription: '', materialCost: 0 },
      duration: { type: 'instantaneous', concentration: false, value: 0, unit: 'round' },
      targeting: { type: 'single', range: 60, validTargets: ['creatures'], lineOfSight: true, maxTargets: 1, areaOfEffect: { shape: 'Sphere', size: 0 }, filter: createNeutralTargetFilter() },
      effects: [
        {
          type: 'DAMAGE',
          trigger: { type: 'immediate' },
          condition: { type: 'hit' },
          damage: { dice: '1d6', type: 'Fire' },
          description: 'Deals damage',
          scaling: {
             type: 'slot_level',
             bonusPerLevel: '+1d6'
          }
        }
      ],
      arbitrationType: 'mechanical',
      aiContext: { prompt: '', playerInputRequired: false },
      description: 'A test spell.',
      higherLevels: 'When cast at higher levels, deals +1d6 damage.',
      tags: []
    };

    const result = auditSpell(mockSpell);
    // Should NOT have phantom_scaling
    const phantom = result.issues.find(i => i.type === 'phantom_scaling');
    expect(phantom).toBeUndefined();
  });

  it('detects complex scaling strings', () => {
     const mockSpell = {
      id: 'test-complex',
      name: 'Complex Spell',
      aliases: [],
      level: 1,
      school: 'Evocation',
      source: 'PHB',
      legacy: false,
      ritual: false, // Added missing required field
      rarity: 'common', // Added missing required field
      attackType: 'none', // Added missing required field
      classes: ['Wizard'],
      subClasses: [],
      subClassesVerification: 'unverified',
      castingTime: { value: 1, unit: 'action', combatCost: { type: 'action', condition: '' }, explorationCost: { value: 0, unit: 'minute' } },
      range: { type: 'ranged', distance: 60 },
      components: { verbal: true, somatic: true, material: false, isConsumed: false, materialDescription: '', materialCost: 0 },
      duration: { type: 'instantaneous', concentration: false, value: 0, unit: 'round' },
      targeting: { type: 'single', range: 60, validTargets: ['creatures'], lineOfSight: true, maxTargets: 1, areaOfEffect: { shape: 'Sphere', size: 0 }, filter: createNeutralTargetFilter() },
      effects: [
        {
          type: 'DAMAGE',
          trigger: { type: 'immediate' },
          condition: { type: 'hit' },
          damage: { dice: '1d6', type: 'Fire' },
          description: 'Deals damage',
          scaling: {
             type: 'slot_level',
             bonusPerLevel: '+1 dart (1d4+1 each)' // Complex string
          }
        }
      ],
      arbitrationType: 'mechanical',
      aiContext: { prompt: '', playerInputRequired: false },
      description: 'A test spell.',
      higherLevels: 'Scales weirdly.',
      tags: []
    };

    const result = auditSpell(mockSpell);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'complex_scaling',
        severity: 'info'
      })
    ]));
  });
});
