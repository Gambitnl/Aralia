import { describe, it, expect, vi } from 'vitest';
import { attemptLockpick, attemptForceLock, resolveTrapEffect } from '../mechanicsUtils';
import { Lock, Trap } from '../../types/mechanics';
import * as combatUtils from '../combatUtils';

// Mock rollDice to control outcomes
vi.mock('../combatUtils', () => ({
  rollDice: vi.fn(),
}));

describe('Lock Mechanics', () => {
  const basicLock: Lock = {
    id: 'chest_lock_01',
    dc: 15,
    isLocked: true,
    isTrapped: true,
    breakDC: 18,
  };

  it('should succeed when roll + mods >= DC', () => {
    // Roll 10 + 3 (DEX) + 2 (Prof) = 15 (DC 15) -> Success
    vi.mocked(combatUtils.rollDice).mockReturnValue(10);

    const result = attemptLockpick(3, 2, basicLock);

    expect(result.success).toBe(true);
    expect(result.triggeredTrap).toBe(false);
    expect(result.margin).toBe(0);
  });

  it('should fail when roll + mods < DC', () => {
    // Roll 9 + 3 (DEX) + 2 (Prof) = 14 (DC 15) -> Failure
    vi.mocked(combatUtils.rollDice).mockReturnValue(9);

    const result = attemptLockpick(3, 2, basicLock);

    expect(result.success).toBe(false);
    expect(result.triggeredTrap).toBe(false); // Failed by 1, so no trap trigger (needs 5)
  });

  it('should trigger trap on critical failure (margin >= 5)', () => {
    // Roll 4 + 3 (DEX) + 2 (Prof) = 9 (DC 15) -> Failed by 6
    vi.mocked(combatUtils.rollDice).mockReturnValue(4);

    const result = attemptLockpick(3, 2, basicLock);

    expect(result.success).toBe(false);
    expect(result.triggeredTrap).toBe(true);
  });

  it('should allow forcing a lock if breakDC exists', () => {
    // Roll 15 + 4 (STR) = 19 (DC 18) -> Success
    vi.mocked(combatUtils.rollDice).mockReturnValue(15);

    const result = attemptForceLock(4, basicLock);
    expect(result.success).toBe(true);
  });

  it('should fail forcing a lock if roll is too low', () => {
    // Roll 10 + 4 (STR) = 14 (DC 18) -> Failure
    vi.mocked(combatUtils.rollDice).mockReturnValue(10);

    const result = attemptForceLock(4, basicLock);
    expect(result.success).toBe(false);
  });
});

describe('Trap Mechanics', () => {
  const poisonTrap: Trap = {
    id: 'poison_needle',
    name: 'Poison Needle',
    description: 'A tiny needle hidden in the lock',
    detectionDC: 15,
    disarmDC: 15,
    triggerCondition: 'interact',
    isHidden: true,
    isActive: true,
    resetable: false,
    effect: {
      type: 'damage',
      damage: '1d4',
      damageType: 'poison',
      saveDC: 12,
      saveAbility: 'CON',
    },
  };

  it('should resolve damage effects correctly', () => {
    vi.mocked(combatUtils.rollDice).mockReturnValue(3); // 1d4 = 3

    const result = resolveTrapEffect(poisonTrap);

    expect(result.damageValue).toBe(3);
    expect(result.description).toContain('Poison Needle');
    expect(result.description).toContain('3 poison damage');
  });
});
