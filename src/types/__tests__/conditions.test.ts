/**
 * @file src/types/__tests__/conditions.test.ts
 * Guards the ConditionType enum against definition drift: every member the enum
 * declares must carry rules text, and the non-standard cold conditions (Frozen,
 * Chilled) must stay real members rather than sliding back into lookup strings.
 */
import { describe, it, expect } from 'vitest';

import { ConditionType, ConditionDefinitions } from '../conditions';

describe('ConditionType', () => {
  it('holds 18 members', () => {
    expect(Object.values(ConditionType)).toHaveLength(18);
  });

  it('includes Frozen and Chilled as real conditions', () => {
    expect(ConditionType.Frozen).toBe('Frozen');
    expect(ConditionType.Chilled).toBe('Chilled');
  });
});

describe('ConditionDefinitions', () => {
  it('has an entry for every ConditionType member', () => {
    for (const condition of Object.values(ConditionType)) {
      expect(ConditionDefinitions[condition], condition).toBeDefined();
    }
    expect(Object.keys(ConditionDefinitions)).toHaveLength(Object.values(ConditionType).length);
  });

  it('gives every entry a description and at least one mechanic', () => {
    for (const condition of Object.values(ConditionType)) {
      const traits = ConditionDefinitions[condition];
      expect(traits.description.length, condition).toBeGreaterThan(0);
      expect(traits.mechanics.length, condition).toBeGreaterThan(0);
    }
  });

  it('marks Frozen incapacitating and leaves Chilled mobile', () => {
    expect(ConditionDefinitions[ConditionType.Frozen].isIncapacitating).toBe(true);
    expect(ConditionDefinitions[ConditionType.Chilled].isIncapacitating).toBeUndefined();
  });
});
