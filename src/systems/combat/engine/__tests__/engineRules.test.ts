/**
 * Pure combat-engine rules moved out of useCombatEngine (C2, agora-9ed9.2).
 * These run without React. The hook-level behavior stays covered by the
 * existing useCombatEngine tests in src/hooks/combat/engine/__tests__/.
 *
 * Exercises: src/systems/combat/engine/repeatSaves.ts, scheduledEffectRules.ts,
 * tileEffects.ts
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getRepeatSaveDc,
  isRepeatSaveCheckAbility,
  isRepeatSaveRollAbility,
  repeatSaveMatchesTiming,
  repeatSaveProgressionReached,
  runRepeatSaves,
} from '../repeatSaves';
import { removeScheduledSourceLinks, shouldKeepScheduledEffectAfterTrigger } from '../scheduledEffectRules';
import { resolveTileEffects } from '../tileEffects';
import { createMockCombatCharacter } from '../../../../utils/core/factories';

type Repeat = Parameters<typeof repeatSaveMatchesTiming>[0];
type Status = Parameters<typeof repeatSaveProgressionReached>[0];
type Scheduled = Parameters<typeof shouldKeepScheduledEffectAfterTrigger>[0];

describe('repeat-save rules', () => {
  it('matches the primary timing and any additional timing, and nothing else', () => {
    const repeat = { timing: 'turn_end', additionalTimings: ['on_damage'] } as unknown as Repeat;
    expect(repeatSaveMatchesTiming(repeat, 'turn_end')).toBe(true);
    expect(repeatSaveMatchesTiming(repeat, 'on_damage')).toBe(true);
    expect(repeatSaveMatchesTiming(repeat, 'turn_start')).toBe(false);
  });

  it('reads a runtime DC and falls back to 10', () => {
    expect(getRepeatSaveDc({ dc: 15 } as unknown as Repeat)).toBe(15);
    expect(getRepeatSaveDc({} as unknown as Repeat)).toBe(10);
    expect(getRepeatSaveDc({ dc: '15' } as unknown as Repeat)).toBe(10);
  });

  it('separates saving throws from ability checks', () => {
    expect(isRepeatSaveRollAbility('Wisdom')).toBe(true);
    expect(isRepeatSaveRollAbility('wisdom_check')).toBe(false);
    expect(isRepeatSaveCheckAbility('strength_check')).toBe(true);
    expect(isRepeatSaveCheckAbility('Strength')).toBe(false);
    expect(isRepeatSaveCheckAbility(undefined)).toBe(false);
  });

  it('reaches a progression threshold only for the side that was rolled', () => {
    const status = {
      repeatSave: { progression: { successThreshold: 3, failureThreshold: 2 } },
      repeatSaveProgress: { successes: 3, failures: 1 },
    } as unknown as Status;
    expect(repeatSaveProgressionReached(status, true)).toBe(true);
    expect(repeatSaveProgressionReached(status, false)).toBe(false);
    expect(repeatSaveProgressionReached({ repeatSave: {} } as unknown as Status, true)).toBe(false);
  });

  it('returns an untouched copy and logs nothing when no status has a repeat save', () => {
    const character = createMockCombatCharacter({ id: 'hero' });
    const onLogEntry = vi.fn();
    const result = runRepeatSaves({ characters: [character], mapData: null, onLogEntry }, character, 'turn_end');
    expect(result).not.toBe(character);
    expect(result).toEqual(character);
    expect(onLogEntry).not.toHaveBeenCalled();
  });
});

describe('scheduled-effect rules', () => {
  const scheduled = (overrides: Record<string, unknown>) => ({
    id: 's1', spellId: 'spell', casterId: 'caster', targetId: 'hero', effects: [{ trigger: {} }], ...overrides,
  }) as unknown as Scheduled;

  it('drops a schedule whose expiry round has come', () => {
    expect(shouldKeepScheduledEffectAfterTrigger(scheduled({ expiresAtRound: 3 }), 3)).toBe(false);
    expect(shouldKeepScheduledEffectAfterTrigger(scheduled({ expiresAtRound: 4 }), 3)).toBe(true);
  });

  it('keeps recurring frequencies and drops a one-shot one', () => {
    expect(shouldKeepScheduledEffectAfterTrigger(scheduled({ recurringMechanic: { frequency: 'every_time' } }), 1)).toBe(true);
    expect(shouldKeepScheduledEffectAfterTrigger(scheduled({ recurringMechanic: { frequency: 'first_per_turn' } }), 1)).toBe(true);
    expect(shouldKeepScheduledEffectAfterTrigger(scheduled({ recurringMechanic: { frequency: 'once' } }), 1)).toBe(false);
    // No frequency anywhere means the effect keeps applying.
    expect(shouldKeepScheduledEffectAfterTrigger(scheduled({}), 1)).toBe(true);
  });

  it('removes only the statuses owned by this spell AND caster', () => {
    const character = createMockCombatCharacter({ id: 'hero' });
    character.statusEffects = [
      { id: 'own', name: 'Restrained', sourceSpellId: 'spell', sourceCasterId: 'caster' },
      { id: 'other-caster', name: 'Frightened', sourceSpellId: 'spell', sourceCasterId: 'someone-else' },
      { id: 'other-spell', name: 'Poisoned', sourceSpellId: 'another', sourceCasterId: 'caster' },
    ] as unknown as typeof character.statusEffects;
    const result = removeScheduledSourceLinks(character, scheduled({}));
    expect(result.statusEffects.map((status) => status.id)).toEqual(['other-caster', 'other-spell']);
  });
});

describe('tile effects', () => {
  it('does nothing without a map', () => {
    const character = createMockCombatCharacter({ id: 'hero' });
    const handleDamage = vi.fn();
    const onLogEntry = vi.fn();
    expect(resolveTileEffects({ mapData: null, handleDamage, onLogEntry }, character, { x: 1, y: 1 })).toBe(character);
    expect(handleDamage).not.toHaveBeenCalled();
    expect(onLogEntry).not.toHaveBeenCalled();
  });
});
