import { describe, it, expect } from 'vitest';
import { evaluateFeatPrerequisites } from '../index';
import { createMockPlayerCharacter } from '../../factories';
import { Feat, FeatPrerequisiteContext } from '../../../types';

describe('evaluateFeatPrerequisites', () => {
  const context: FeatPrerequisiteContext = {
    level: 1,
    raceId: 'human',
    classId: 'fighter',
    abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    hasFightingStyle: false,
    knownFeats: [],
  };

  it('should return eligible if no prerequisites', () => {
    const feat: Feat = { id: 'alert', name: 'Alert', description: '', benefits: {} };
    const result = evaluateFeatPrerequisites(feat, context);
    expect(result.isEligible).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  it('should require minimum level', () => {
    const feat: Feat = {
      id: 'advanced', name: 'Advanced', description: '', benefits: {},
      prerequisites: { minLevel: 4 }
    };
    const result = evaluateFeatPrerequisites(feat, context);
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Requires level 4+');
  });

  it('should pass minimum level check', () => {
    const feat: Feat = {
      id: 'advanced', name: 'Advanced', description: '', benefits: {},
      prerequisites: { minLevel: 4 }
    };
    const result = evaluateFeatPrerequisites(feat, { ...context, level: 5 });
    expect(result.isEligible).toBe(true);
  });

  it('should require specific race', () => {
    const feat: Feat = {
      id: 'elven-accuracy', name: 'Elven Accuracy', description: '', benefits: {},
      prerequisites: { raceId: 'elf' }
    };
    const result = evaluateFeatPrerequisites(feat, context);
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Restricted to a specific race');
  });

  it('should pass specific race check', () => {
    const feat: Feat = {
      id: 'elven-accuracy', name: 'Elven Accuracy', description: '', benefits: {},
      prerequisites: { raceId: 'elf' }
    };
    const result = evaluateFeatPrerequisites(feat, { ...context, raceId: 'elf' });
    expect(result.isEligible).toBe(true);
  });

  it('should require ability score threshold', () => {
    const feat: Feat = {
      id: 'heavy-armor-master', name: 'Heavy Armor Master', description: '', benefits: {},
      prerequisites: { abilityScores: { Strength: 13 } }
    };
    const result = evaluateFeatPrerequisites(feat, context); // Str 10
    expect(result.isEligible).toBe(false);
    expect(result.unmet[0]).toContain('Strength 13+');
  });

  it('should pass ability score threshold check', () => {
    const feat: Feat = {
      id: 'heavy-armor-master', name: 'Heavy Armor Master', description: '', benefits: {},
      prerequisites: { abilityScores: { Strength: 13 } }
    };
    const result = evaluateFeatPrerequisites(feat, { ...context, abilityScores: { ...context.abilityScores, Strength: 14 } });
    expect(result.isEligible).toBe(true);
  });

  it('should require fighting style', () => {
    const feat: Feat = {
      id: 'fighting-initiate', name: 'Fighting Initiate', description: '', benefits: {},
      prerequisites: { requiresFightingStyle: true }
    };
    const result = evaluateFeatPrerequisites(feat, context);
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Requires Fighting Style class feature');
  });

  it('should pass fighting style check', () => {
    const feat: Feat = {
      id: 'fighting-initiate', name: 'Fighting Initiate', description: '', benefits: {},
      prerequisites: { requiresFightingStyle: true }
    };
    const result = evaluateFeatPrerequisites(feat, { ...context, hasFightingStyle: true });
    expect(result.isEligible).toBe(true);
  });

  it('should prevent taking same feat twice', () => {
    const feat: Feat = { id: 'alert', name: 'Alert', description: '', benefits: {} };
    const result = evaluateFeatPrerequisites(feat, { ...context, knownFeats: ['alert'] });
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Already learned');
  });
});
