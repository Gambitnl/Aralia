import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RULES_EDITION,
  RULES_EDITIONS,
  getRulesEdition,
  getSubclassLevel,
  isRulesEdition,
  nextRulesEdition,
  type RulesEdition,
} from '../rulesEdition';
import { initialGameState } from '../../state/initialState';
import type { GameState } from '../../types/state';

/**
 * Tests for the global rules-edition setting (agora-18ab).
 *
 * Remy ruled that both the 2014 and 2024 Player's Handbooks are offered, chosen
 * by one global switch persisted with the campaign save. `getRulesEdition` is the
 * single reader, so these tests pin the default in the one place it lives.
 */
describe('rulesEdition', () => {
  // ==========================================================================
  // The setting itself
  // ==========================================================================

  it('defaults to the 2024 Player\'s Handbook', () => {
    expect(DEFAULT_RULES_EDITION).toBe('2024');
    expect(RULES_EDITIONS).toEqual(['2024', '2014']);
  });

  it('starts a new campaign on the 2024 edition', () => {
    expect(initialGameState.rulesEdition).toBe('2024');
    expect(getRulesEdition(initialGameState)).toBe('2024');
  });

  it('reads an explicitly chosen edition back', () => {
    expect(getRulesEdition({ rulesEdition: '2014' })).toBe('2014');
    expect(getRulesEdition({ rulesEdition: '2024' })).toBe('2024');
  });

  // ==========================================================================
  // Old saves
  // ==========================================================================

  it('reads a save that predates the field as 2024', () => {
    // A campaign saved before the rules-edition switch existed has no field at
    // all. It must load as 2024 rather than undefined.
    const oldSave = { ...initialGameState } as Partial<GameState>;
    delete oldSave.rulesEdition;

    expect('rulesEdition' in oldSave).toBe(false);
    expect(getRulesEdition(oldSave as GameState)).toBe('2024');
  });

  it('falls back to 2024 for a missing, null, or corrupt value', () => {
    expect(getRulesEdition(undefined)).toBe('2024');
    expect(getRulesEdition(null)).toBe('2024');
    expect(getRulesEdition({})).toBe('2024');
    expect(getRulesEdition({ rulesEdition: '2011' as RulesEdition })).toBe('2024');
  });

  // ==========================================================================
  // Cycling and guards
  // ==========================================================================

  it('cycles between the two editions', () => {
    expect(nextRulesEdition('2024')).toBe('2014');
    expect(nextRulesEdition('2014')).toBe('2024');
  });

  it('guards unknown values', () => {
    expect(isRulesEdition('2014')).toBe(true);
    expect(isRulesEdition('2024')).toBe(true);
    expect(isRulesEdition('2e')).toBe(false);
    expect(isRulesEdition(2024)).toBe(false);
    expect(isRulesEdition(undefined)).toBe(false);
  });

  // ==========================================================================
  // Subclass levels
  // ==========================================================================

  it('puts the warlock patron at level 1 under 2014 and level 3 under 2024', () => {
    expect(getSubclassLevel('warlock', '2014')).toBe(1);
    expect(getSubclassLevel('warlock', '2024')).toBe(3);
  });

  it('keeps every class at level 3 under the 2024 edition', () => {
    const classIds = ['cleric', 'sorcerer', 'warlock', 'druid', 'wizard', 'fighter', 'rogue'];
    for (const classId of classIds) {
      expect(getSubclassLevel(classId, '2024')).toBe(3);
    }
  });

  it('restores the 2014 exceptions for the other classes that differ', () => {
    expect(getSubclassLevel('cleric', '2014')).toBe(1);
    expect(getSubclassLevel('sorcerer', '2014')).toBe(1);
    expect(getSubclassLevel('druid', '2014')).toBe(2);
    expect(getSubclassLevel('wizard', '2014')).toBe(2);
  });

  it('leaves classes whose subclass level never moved at level 3', () => {
    for (const classId of ['fighter', 'barbarian', 'bard', 'ranger', 'rogue', 'paladin', 'monk', 'artificer']) {
      expect(getSubclassLevel(classId, '2014')).toBe(3);
      expect(getSubclassLevel(classId, '2024')).toBe(3);
    }
  });
});
