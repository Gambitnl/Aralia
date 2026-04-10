import { describe, expect, it } from 'vitest';
import type { Spell } from '../../../types/spells';
import {
  ROUND_DURATION_SECONDS,
  RITUAL_CASTING_BONUS_SECONDS,
  canSpellBeCastAsRitual,
  convertSecondsToDisplayValue,
  getCastingTimeTranslation,
  getDisplayUnitForSeconds,
  getSpellCastingDurationSeconds
} from '../spellTimeUtils';

/**
 * These tests protect the shared spell-time translation rules.
 *
 * The rest of the ritual/runtime system now depends on this file for the numeric
 * meaning of spell timing, so these tests lock in the round length, ritual bonus,
 * and the basic display-translation rules in one place.
 */

// ============================================================================
// Shared Spell Fixture
// ============================================================================
// This small spell stub is enough to prove the spell-time math without dragging
// in unrelated spell mechanics.
// ============================================================================

const mockRitualSpell = {
  ritual: true,
  tags: ['RITUAL'],
  castingTime: { value: 1, unit: 'minute' }
} as Pick<Spell, 'ritual' | 'tags' | 'castingTime'>;

describe('spellTimeUtils', () => {
  it('translates action-economy spell times into one combat round', () => {
    const translation = getCastingTimeTranslation({ value: 1, unit: 'action' });

    expect(translation.seconds).toBe(ROUND_DURATION_SECONDS);
    expect(translation.rounds).toBe(1);
    expect(translation.displayUnit).toBe('rounds');
    expect(translation.displayValue).toBe(1);
  });

  it('adds the ritual bonus on top of the spell normal cast time', () => {
    expect(canSpellBeCastAsRitual(mockRitualSpell)).toBe(true);
    expect(getSpellCastingDurationSeconds(mockRitualSpell, false)).toBe(60);
    expect(getSpellCastingDurationSeconds(mockRitualSpell, true)).toBe(60 + RITUAL_CASTING_BONUS_SECONDS);
  });

  it('prefers minute and hour display when a seconds value lands cleanly on those units', () => {
    expect(getDisplayUnitForSeconds(60, 'minute')).toBe('minutes');
    expect(convertSecondsToDisplayValue(660, 'minutes')).toBe(11);
    expect(getDisplayUnitForSeconds(3600, 'hour')).toBe('hours');
    expect(convertSecondsToDisplayValue(3600, 'hours')).toBe(1);
  });

  it('keeps awkward long durations in seconds instead of inflating them into large round counts', () => {
    expect(getDisplayUnitForSeconds(606, 'action')).toBe('seconds');
    expect(convertSecondsToDisplayValue(606, 'seconds')).toBe(606);
  });
});
