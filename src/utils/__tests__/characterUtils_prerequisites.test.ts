
import { describe, it, expect } from 'vitest';
import { evaluateFeatPrerequisites } from '../characterUtils';
import { Feat, FeatPrerequisiteContext, AbilityScores } from '../../types';

describe('evaluateFeatPrerequisites', () => {
  const defaultContext: FeatPrerequisiteContext = {
    level: 1,
    raceId: 'human',
    classId: 'fighter',
    abilityScores: {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10,
    },
    hasFightingStyle: false,
    knownFeats: [],
  };

  const createFeat = (overrides: Partial<Feat> = {}): Feat => ({
    id: 'test-feat',
    name: 'Test Feat',
    description: 'A test feat',
    source: 'PHB',
    prerequisites: {},
    benefits: {},
    ...overrides,
  });

  it('should be eligible when no prerequisites exist', () => {
    const feat = createFeat();
    const result = evaluateFeatPrerequisites(feat, defaultContext);
    expect(result.isEligible).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  it('should fail if level is too low', () => {
    const feat = createFeat({
      prerequisites: { minLevel: 4 },
    });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, level: 3 });
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Requires level 4+');
  });

  it('should pass if level is sufficient', () => {
    const feat = createFeat({
      prerequisites: { minLevel: 4 },
    });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, level: 4 });
    expect(result.isEligible).toBe(true);
  });

  it('should fail if race restriction is not met', () => {
    const feat = createFeat({
      prerequisites: { raceId: 'elf' },
    });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, raceId: 'human' });
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Restricted to a specific race');
  });

  it('should pass if race restriction is met', () => {
    const feat = createFeat({
      prerequisites: { raceId: 'elf' },
    });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, raceId: 'elf' });
    expect(result.isEligible).toBe(true);
  });

  it('should fail if class restriction is not met', () => {
    const feat = createFeat({
      prerequisites: { classId: 'wizard' },
    });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, classId: 'fighter' });
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Restricted to a specific class');
  });

  it('should pass if class restriction is met', () => {
    const feat = createFeat({
      prerequisites: { classId: 'wizard' },
    });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, classId: 'wizard' });
    expect(result.isEligible).toBe(true);
  });

  it('should fail if ability score is too low', () => {
    const feat = createFeat({
      prerequisites: {
        abilityScores: { Dexterity: 13 },
      },
    });
    const result = evaluateFeatPrerequisites(feat, {
      ...defaultContext,
      abilityScores: { ...defaultContext.abilityScores, Dexterity: 12 },
    });
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Dexterity 13+');
  });

  it('should pass if ability score is sufficient', () => {
    const feat = createFeat({
      prerequisites: {
        abilityScores: { Dexterity: 13 },
      },
    });
    const result = evaluateFeatPrerequisites(feat, {
      ...defaultContext,
      abilityScores: { ...defaultContext.abilityScores, Dexterity: 13 },
    });
    expect(result.isEligible).toBe(true);
  });

  it('should fail if fighting style is required but missing', () => {
    const feat = createFeat({
      prerequisites: { requiresFightingStyle: true },
    });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, hasFightingStyle: false });
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Requires Fighting Style class feature');
  });

  it('should pass if fighting style is required and present', () => {
    const feat = createFeat({
      prerequisites: { requiresFightingStyle: true },
    });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, hasFightingStyle: true });
    expect(result.isEligible).toBe(true);
  });

  it('should fail if feat is already known', () => {
    const feat = createFeat({ id: 'alert' });
    const result = evaluateFeatPrerequisites(feat, { ...defaultContext, knownFeats: ['alert'] });
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Already learned');
  });

  it('should report multiple unmet prerequisites', () => {
    const feat = createFeat({
      prerequisites: {
        minLevel: 8,
        abilityScores: { Strength: 15 },
      },
    });
    const result = evaluateFeatPrerequisites(feat, {
      ...defaultContext,
      level: 1,
      abilityScores: { ...defaultContext.abilityScores, Strength: 10 },
    });
    expect(result.isEligible).toBe(false);
    expect(result.unmet).toContain('Requires level 8+');
    expect(result.unmet).toContain('Strength 15+');
  });
});
