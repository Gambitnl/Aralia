/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/__tests__/lockSystem.test.ts
 * Tests for the Lock and Trap system.
 */

import { describe, it, expect, vi } from 'vitest';
import { attemptLockpick, attemptBreak, detectTrap, disarmTrap } from '../lockSystem';
import { Lock, Trap } from '../types';
import { PlayerCharacter } from '../../../types/character';
import { Item } from '../../../types/items';
import * as combatUtils from '../../../utils/combatUtils';
import * as statUtils from '../../../utils/statUtils';

// Mock dependencies
vi.mock('../../../utils/combatUtils', () => ({
  rollDice: vi.fn(),
}));

vi.mock('../../../utils/statUtils', () => ({
  getAbilityModifierValue: vi.fn(),
}));

// Helper to create a dummy character
const createDummyCharacter = (overrides?: Partial<PlayerCharacter>): PlayerCharacter => ({
  id: 'char-1',
  name: 'Test Character',
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  proficiencyBonus: 2,
  classes: [], // Not a rogue by default
  ...overrides,
} as PlayerCharacter);

const thievesTools: Item = { id: 'thieves-tools', name: 'Thieves Tools', type: 'gear', weight: 1, value: 25, description: 'Tools' };

describe('Lock System', () => {
  describe('attemptLockpick', () => {
    const lock: Lock = { id: 'l1', dc: 15, isLocked: true, isBroken: false, isTrapped: false };

    it('fails if character lacks thieves tools', () => {
      const char = createDummyCharacter({ stats: { ...createDummyCharacter().stats, dexterity: 14 } }); // +2 Dex
      const result = attemptLockpick(char, lock, []);
      expect(result.success).toBe(false);
      expect(result.margin).toBe(-10);
    });

    it('succeeds if roll + dex + prof >= DC', () => {
      const char = createDummyCharacter({
        stats: { ...createDummyCharacter().stats, dexterity: 14 }, // +2 Dex
        classes: [{ name: 'Rogue', level: 1, hitDie: 8 }] // Proficient (+2)
      });

      // Mock stats: Dex 14 -> +2
      vi.mocked(statUtils.getAbilityModifierValue).mockReturnValue(2);

      // Total bonus: +2 (Dex) +2 (Prof) = +4. Needs 11 to beat 15.
      vi.mocked(combatUtils.rollDice).mockReturnValue(11);

      const result = attemptLockpick(char, lock, [thievesTools]);
      expect(result.success).toBe(true);
      expect(result.margin).toBe(0); // 11 + 4 - 15 = 0
    });

    it('fails if roll is too low', () => {
      const char = createDummyCharacter({
        stats: { ...createDummyCharacter().stats, dexterity: 10 }, // +0 Dex
      });
      vi.mocked(statUtils.getAbilityModifierValue).mockReturnValue(0);
      vi.mocked(combatUtils.rollDice).mockReturnValue(10); // Total 10 vs DC 15

      const result = attemptLockpick(char, lock, [thievesTools]);
      expect(result.success).toBe(false);
      expect(result.margin).toBe(-5);
    });

    it('triggers trap on critical failure (margin < -5)', () => {
        const trappedLock: Lock = {
            ...lock,
            isTrapped: true,
            trap: {
                id: 't1', name: 'Needle', detectionDC: 10, disarmDC: 15,
                triggerCondition: 'touch', effect: { damage: { count: 1, sides: 4, bonus: 0 } },
                resetable: false, isDisarmed: false, isTriggered: false
            }
        };
        const char = createDummyCharacter(); // +0 Dex, +0 Prof
        vi.mocked(statUtils.getAbilityModifierValue).mockReturnValue(0);

        // DC 15. Margin < -5 means margin <= -6. 15 - 6 = 9. So need roll of 9 or lower?
        // Wait, roll + mod - DC = margin.
        // 9 + 0 - 15 = -6. Correct.
        vi.mocked(combatUtils.rollDice).mockReturnValue(9);

        const result = attemptLockpick(char, trappedLock, [thievesTools]);
        expect(result.success).toBe(false);
        expect(result.triggeredTrap).toBe(true);
        expect(result.trapEffect).toBeDefined();
    });

    it('does NOT trigger trap on boundary failure (margin == -5)', () => {
        const trappedLock: Lock = {
            ...lock,
            isTrapped: true,
            trap: {
                id: 't1', name: 'Needle', detectionDC: 10, disarmDC: 15,
                triggerCondition: 'touch', effect: {},
                resetable: false, isDisarmed: false, isTriggered: false
            }
        };
        const char = createDummyCharacter();
        vi.mocked(statUtils.getAbilityModifierValue).mockReturnValue(0);

        // Roll 10 -> 10 - 15 = -5. Safe.
        vi.mocked(combatUtils.rollDice).mockReturnValue(10);

        const result = attemptLockpick(char, trappedLock, [thievesTools]);
        expect(result.success).toBe(false);
        expect(result.triggeredTrap).toBe(false);
    });
  });

  describe('attemptBreak', () => {
    it('succeeds breaking a door with sufficient strength check', () => {
      const lock: Lock = { id: 'd1', dc: 10, breakDC: 15, isLocked: true, isBroken: false };
      const char = createDummyCharacter({ stats: { ...createDummyCharacter().stats, strength: 18 } }); // +4 Str
      vi.mocked(statUtils.getAbilityModifierValue).mockReturnValue(4);
      vi.mocked(combatUtils.rollDice).mockReturnValue(11); // Total 15

      const result = attemptBreak(char, lock);
      expect(result.success).toBe(true);
      expect(result.isBroken).toBe(true);
    });

    it('fails if check is too low', () => {
        const lock: Lock = { id: 'd1', dc: 10, breakDC: 20, isLocked: true, isBroken: false };
        const char = createDummyCharacter({ stats: { ...createDummyCharacter().stats, strength: 10 } }); // +0 Str
        vi.mocked(statUtils.getAbilityModifierValue).mockReturnValue(0);
        vi.mocked(combatUtils.rollDice).mockReturnValue(19); // Total 19

        const result = attemptBreak(char, lock);
        expect(result.success).toBe(false);
        expect(result.isBroken).toBe(false);
      });
  });

  describe('detectTrap', () => {
      const trap: Trap = {
          id: 't1', name: 'Pit', detectionDC: 15, disarmDC: 15,
          triggerCondition: 'proximity', effect: {},
          resetable: false, isDisarmed: false, isTriggered: false
      };

      it('detects trap with high perception', () => {
          const char = createDummyCharacter({ stats: { ...createDummyCharacter().stats, wisdom: 16 } }); // +3 Wis
          vi.mocked(statUtils.getAbilityModifierValue).mockReturnValue(3);
          vi.mocked(combatUtils.rollDice).mockReturnValue(12); // 12 + 3 = 15

          const result = detectTrap(char, trap);
          expect(result.success).toBe(true);
          expect(result.trapDetected).toBe(true);
      });
  });

  describe('disarmTrap', () => {
      const trap: Trap = {
        id: 't1', name: 'Gas', detectionDC: 10, disarmDC: 15,
        triggerCondition: 'interaction', effect: {},
        resetable: false, isDisarmed: false, isTriggered: false
    };

    it('fails without tools', () => {
        const char = createDummyCharacter();
        const result = disarmTrap(char, trap, []);
        expect(result.success).toBe(false);
    });

    it('triggers trap on bad fail (margin < -5)', () => {
        const char = createDummyCharacter(); // +0
        vi.mocked(statUtils.getAbilityModifierValue).mockReturnValue(0);
        vi.mocked(combatUtils.rollDice).mockReturnValue(9); // Total 9 vs 15 -> Margin -6

        const result = disarmTrap(char, trap, [thievesTools]);
        expect(result.success).toBe(false);
        expect(result.triggeredTrap).toBe(true);
    });
  });
});
