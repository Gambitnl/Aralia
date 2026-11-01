/**
 * @file src/utils/character/__tests__/progression.subclassMilestone.test.ts
 *
 * Tests for subclass milestone player choice gating (agora-c0bb / GG-453).
 *
 * What this tests:
 * 1. Automatic level-up via `applyXpAndHandleLevelUps` halts before advancing
 *    into a subclass milestone if no explicit subclass choice is provided,
 *    banking the XP and keeping `canLevelUp` true for the LevelUpModal UI.
 * 2. `performLevelUp` never defaults to the first subclass in the list when
 *    no subclass choice is provided.
 * 3. Edition-specific subclass milestones (2024 all classes at level 3;
 *    2014 Wizard/Druid at level 2) are strictly respected.
 * 4. `GRANT_EXPERIENCE` action in characterReducer banks the XP and does not
 *    silently assign a subclass.
 */

import { describe, it, expect } from 'vitest';
import {
  performLevelUp,
  applyXpAndHandleLevelUps,
  canLevelUp,
} from '../progression';
import { CLASSES_DATA } from '../../../data/classes';
import { createMockPlayerCharacter } from '../../core/factories';
import { characterReducer } from '../../../state/reducers/characterReducer';
import { GameState } from '../../../types';
import { initialGameState } from '../../../state/initialState';

describe('Subclass milestone player choice gating (GG-453 / agora-c0bb)', () => {
  describe('performLevelUp', () => {
    it('does not assign a subclass at level 3 when no choice is provided', () => {
      const fighterL2 = createMockPlayerCharacter({
        class: CLASSES_DATA['fighter'],
        level: 2,
        xp: 900,
        subclassId: undefined,
      });

      const leveled = performLevelUp(fighterL2, {});
      expect(leveled.level).toBe(3);
      expect(leveled.subclassId).toBeUndefined();
    });

    it('honors an explicit subclass choice at level 3', () => {
      const fighterL2 = createMockPlayerCharacter({
        class: CLASSES_DATA['fighter'],
        level: 2,
        xp: 900,
        subclassId: undefined,
      });

      const leveled = performLevelUp(fighterL2, { subclassId: 'battle_master' });
      expect(leveled.level).toBe(3);
      expect(leveled.subclassId).toBe('battle_master');
      // Battle Master superiority dice pool should be initialized
      expect(leveled.limitedUses?.superiority_dice?.current).toBe(4);
    });

    it('preserves an existing subclass when leveling up further', () => {
      const fighterL3 = createMockPlayerCharacter({
        class: CLASSES_DATA['fighter'],
        level: 3,
        xp: 2700,
        subclassId: 'battle_master',
      });

      const leveled = performLevelUp(fighterL3, { abilityScoreIncreases: { Strength: 2 } });
      expect(leveled.level).toBe(4);
      expect(leveled.subclassId).toBe('battle_master');
    });
  });

  describe('applyXpAndHandleLevelUps', () => {
    it('2024: halts automatic leveling before level 3 when no subclass choice is provided', () => {
      // Level 2 Fighter with 300 XP gains 600 XP -> total 900 XP (enough for level 3)
      const fighterL2 = createMockPlayerCharacter({
        class: CLASSES_DATA['fighter'],
        level: 2,
        xp: 300,
        subclassId: undefined,
      });

      const result = applyXpAndHandleLevelUps(fighterL2, 600, undefined, '2024');

      // Halts at level 2: XP is banked, canLevelUp is true, subclass is not chosen for the player
      expect(result.level).toBe(2);
      expect(result.xp).toBe(900);
      expect(canLevelUp(result)).toBe(true);
      expect(result.subclassId).toBeUndefined();
    });

    it('2024: advances to level 3 when explicit subclass choice is provided', () => {
      const fighterL2 = createMockPlayerCharacter({
        class: CLASSES_DATA['fighter'],
        level: 2,
        xp: 300,
        subclassId: undefined,
      });

      const result = applyXpAndHandleLevelUps(
        fighterL2,
        600,
        { subclassId: 'battle_master' },
        '2024',
      );

      expect(result.level).toBe(3);
      expect(result.xp).toBe(900);
      expect(result.subclassId).toBe('battle_master');
    });

    it('2024: allows automatic leveling from level 1 to level 2 without halting (not a subclass milestone)', () => {
      const fighterL1 = createMockPlayerCharacter({
        class: CLASSES_DATA['fighter'],
        level: 1,
        xp: 0,
        subclassId: undefined,
      });

      const result = applyXpAndHandleLevelUps(fighterL1, 300, undefined, '2024');

      // Advances from level 1 to level 2 automatically
      expect(result.level).toBe(2);
      expect(result.xp).toBe(300);
      expect(result.subclassId).toBeUndefined();
    });

    it('2014: halts automatic leveling before level 2 for Wizard when no subclass choice is provided', () => {
      // Under 2014 rules, Wizard chooses subclass at level 2
      const wizardL1 = createMockPlayerCharacter({
        class: CLASSES_DATA['wizard'],
        level: 1,
        xp: 0,
        subclassId: undefined,
      });

      const result = applyXpAndHandleLevelUps(wizardL1, 300, undefined, '2014');

      // Halts at level 1: XP is banked, canLevelUp is true, subclass is not chosen for the player
      expect(result.level).toBe(1);
      expect(result.xp).toBe(300);
      expect(canLevelUp(result)).toBe(true);
      expect(result.subclassId).toBeUndefined();
    });

    it('2014: advances Wizard to level 2 when explicit subclass choice is provided', () => {
      const wizardL1 = createMockPlayerCharacter({
        class: CLASSES_DATA['wizard'],
        level: 1,
        xp: 0,
        subclassId: undefined,
      });

      const result = applyXpAndHandleLevelUps(
        wizardL1,
        300,
        { subclassId: 'evocation' },
        '2014',
      );

      expect(result.level).toBe(2);
      expect(result.xp).toBe(300);
      expect(result.subclassId).toBe('evocation');
    });
  });

  describe('characterReducer GRANT_EXPERIENCE integration', () => {
    it('banks XP and pauses at subclass milestone without picking a default subclass', () => {
      const fighterL2 = createMockPlayerCharacter({
        id: 'pc-fighter-1',
        name: 'Valeros',
        class: CLASSES_DATA['fighter'],
        level: 2,
        xp: 300,
        subclassId: undefined,
      });

      const state: GameState = {
        ...initialGameState,
        rulesEdition: '2024',
        party: [fighterL2],
      };

      const partial = characterReducer(state, {
        type: 'GRANT_EXPERIENCE',
        payload: { amount: 600 },
      });

      const updatedFighter = partial.party?.[0];
      expect(updatedFighter).toBeDefined();
      expect(updatedFighter?.level).toBe(2);
      expect(updatedFighter?.xp).toBe(900);
      expect(updatedFighter?.subclassId).toBeUndefined();
      expect(canLevelUp(updatedFighter!)).toBe(true);
    });
  });
});
