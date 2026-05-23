import { describe, it, expect } from 'vitest';
import { canAffordActionCost, consumeActionCost, createDefaultActionEconomy, resetEconomy } from '../actionEconomyUtils';
import { createMockCombatCharacter } from '../../factories';
import { resolveRacialSpellLimitedUseId } from '../../character/characterUtils';

type LimitedUseEntry = {
  name: string;
  current: number;
  max: number;
  resetOn: 'long_rest' | 'short_rest';
};

type LimitedUseCharacter = ReturnType<typeof createMockCombatCharacter> & {
  limitedUses?: Record<string, LimitedUseEntry>;
};

describe('actionEconomyUtils', () => {
  describe('createDefaultActionEconomy', () => {
    it('should initialize with correct default values', () => {
      const moveTotal = 30;
      const economy = createDefaultActionEconomy(moveTotal);

      expect(economy.action).toEqual({ used: false, remaining: 1 });
      expect(economy.bonusAction).toEqual({ used: false, remaining: 1 });
      expect(economy.reaction).toEqual({ used: false, remaining: 1 });
      expect(economy.movement).toEqual({ used: 0, total: moveTotal });
      expect(economy.freeActions).toBe(1);
    });

    it('should handle zero movement', () => {
      const economy = createDefaultActionEconomy(0);
      expect(economy.movement).toEqual({ used: 0, total: 0 });
    });
  });

  describe('resetEconomy', () => {
    it('should reset a character\'s action economy', () => {
      const character = createMockCombatCharacter({
        stats: { speed: 40, strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, cr: "1" },
        actionEconomy: {
            action: { used: true, remaining: 0 },
            bonusAction: { used: true, remaining: 0 },
            reaction: { used: true, remaining: 0 },
            legendary: { used: 0, total: 0 },
            movement: { used: 30, total: 30 },
            freeActions: 0,
        },
      });

      const resetCharacter = resetEconomy(character);

      expect(resetCharacter.actionEconomy.action.used).toBe(false);
      expect(resetCharacter.actionEconomy.action.remaining).toBe(1);
      expect(resetCharacter.actionEconomy.bonusAction.used).toBe(false);
      expect(resetCharacter.actionEconomy.bonusAction.remaining).toBe(1);
      expect(resetCharacter.actionEconomy.reaction.used).toBe(false);
      expect(resetCharacter.actionEconomy.reaction.remaining).toBe(1);
      expect(resetCharacter.actionEconomy.movement.used).toBe(0);
      expect(resetCharacter.actionEconomy.movement.total).toBe(40);
      expect(resetCharacter.actionEconomy.freeActions).toBe(1);
    });

    it('should handle characters with 0 speed', () => {
       const character = createMockCombatCharacter({
        stats: { speed: 0, strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, cr: "1" }
      });
      const resetCharacter = resetEconomy(character);
      expect(resetCharacter.actionEconomy.movement.total).toBe(0);
    });

    it('should return a new object reference', () => {
        const character = createMockCombatCharacter();
        const resetCharacter = resetEconomy(character);
        expect(resetCharacter).not.toBe(character);
        expect(resetCharacter.actionEconomy).not.toBe(character.actionEconomy);
    });
  });

  describe('canAffordActionCost and consumeActionCost', () => {
    it('supports racial once-per-rest spells by consuming limited uses before spell slots and allowing fallback when enabled', () => {
      const limitedUseId = resolveRacialSpellLimitedUseId('deep_gnome', 'disguise-self');

      const character = createMockCombatCharacter({
        limitedUses: {
          [limitedUseId]: {
            name: 'Deep Gnome: disguise self',
            current: 1,
            max: 1,
            resetOn: 'long_rest',
          },
        },
        spellSlots: {
          level_1: { current: 1, max: 1 },
          level_3: { current: 2, max: 2 },
        },
        spellbook: {
          cantrips: [],
          knownSpells: [],
          preparedSpells: ['disguise-self'],
          racialSpellGrants: [
            {
              sourceRaceId: 'deep_gnome',
              spellId: 'disguise-self',
              minLevel: 3,
              castingMethod: 'once_per_long_rest',
              upcastable: false,
              maxCastLevel: 3,
              countsAsPrepared: false,
            },
          ],
        },
      } as never) as LimitedUseCharacter;

      // The combat helper reads this runtime field directly, so the fixture
      // assigns it after creation instead of relying on the factory's static type.
      character.limitedUses = {
        [limitedUseId]: {
          name: 'Deep Gnome: disguise self',
          current: 1,
          max: 1,
          resetOn: 'long_rest',
        },
      };

      const racialCost = { type: 'action' as const, spellSlotLevel: 3, castSource: { type: 'racial' as const, spellId: 'disguise-self', allowSlotFallback: true } };

      expect(canAffordActionCost(character, racialCost)).toBe(true);
      const afterLimitedUse = consumeActionCost(character, racialCost) as LimitedUseCharacter;
      expect(afterLimitedUse.limitedUses?.[limitedUseId].current).toBe(0);
      expect(afterLimitedUse.spellSlots?.level_3.current).toBe(2);
      expect(afterLimitedUse.actionEconomy.action.used).toBe(true);

      const limitedFallbackCharacter = createMockCombatCharacter({
        ...character,
        actionEconomy: { ...character.actionEconomy, action: { used: false, remaining: 1 } },
        limitedUses: {
          [limitedUseId]: {
            name: 'Deep Gnome: disguise self',
            current: 0,
            max: 1,
            resetOn: 'long_rest',
          },
        },
      } as never) as LimitedUseCharacter;

      expect(canAffordActionCost(limitedFallbackCharacter, racialCost)).toBe(true);
      const limitedFallback = consumeActionCost(limitedFallbackCharacter, racialCost) as LimitedUseCharacter;
      expect(limitedFallback.limitedUses?.[limitedUseId].current).toBe(0);
      expect(limitedFallback.spellSlots?.level_3.current).toBe(1);
      expect(limitedFallback.actionEconomy.action.used).toBe(true);
    });

    it('blocks racial spells cast above the racial max when upcast is disabled', () => {
      const character = createMockCombatCharacter({
        spellSlots: {
          level_5: { current: 1, max: 1 },
        },
        spellbook: {
          cantrips: [],
          knownSpells: [],
          preparedSpells: ['nondetection'],
          racialSpellGrants: [
            {
              sourceRaceId: 'deep_gnome',
              spellId: 'nondetection',
              minLevel: 5,
              castingMethod: 'once_per_long_rest',
              upcastable: false,
              maxCastLevel: 5,
              countsAsPrepared: false,
            },
          ],
        },
      } as never);

      const racialCost = { type: 'action' as const, spellSlotLevel: 6, castSource: { type: 'racial' as const, spellId: 'nondetection', allowSlotFallback: true } };
      expect(canAffordActionCost(character, racialCost)).toBe(false);
      expect(consumeActionCost(character, racialCost).spellSlots?.level_6).toBeUndefined();
    });

    it('marks an action as spent so a second action cannot be afforded', () => {
      const character = createMockCombatCharacter();

      // A normal attack spends the one action a creature gets on its turn.
      const afterAttack = consumeActionCost(character, { type: 'action' });

      expect(afterAttack.actionEconomy.action.used).toBe(true);
      expect(canAffordActionCost(afterAttack, { type: 'action' })).toBe(false);
      expect(canAffordActionCost(afterAttack, { type: 'bonus' })).toBe(true);
    });

    it('adds movement spent through the same action economy path used by movement actions', () => {
      const character = createMockCombatCharacter();

      // Movement-only actions should spend feet without consuming the action or
      // bonus action; this keeps ordinary movement separate from attacking.
      const afterMove = consumeActionCost(character, { type: 'movement-only', movementCost: 10 });

      expect(afterMove.actionEconomy.movement.used).toBe(10);
      expect(afterMove.actionEconomy.action.used).toBe(false);
      expect(canAffordActionCost(afterMove, { type: 'movement-only', movementCost: 25 })).toBe(false);
    });
  });
});
