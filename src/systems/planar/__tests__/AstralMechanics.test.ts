
import { describe, it, expect, vi } from 'vitest';
import { AstralMechanics, PsychicWindResult } from '../AstralMechanics';
import { GameState } from '../../../types/index';
import * as combatUtils from '../../../utils/combatUtils';

// Mock rollDice to control randomness
vi.mock('../../../utils/combatUtils', () => ({
  rollDice: vi.fn(),
  createPlayerCombatCharacter: vi.fn(), // If needed by other imports
}));

describe('AstralMechanics', () => {
  describe('calculateAstralSpeed', () => {
    it('should return 3 * Intelligence score', () => {
      expect(AstralMechanics.calculateAstralSpeed(10)).toBe(30);
      expect(AstralMechanics.calculateAstralSpeed(18)).toBe(54);
      expect(AstralMechanics.calculateAstralSpeed(8)).toBe(24);
    });
  });

  describe('checkForPsychicWind', () => {
    it('should return no encounter when roll is low', () => {
      // Mock d20 roll < 18
      vi.mocked(combatUtils.rollDice).mockReturnValueOnce(10);

      const result = AstralMechanics.checkForPsychicWind();
      expect(result.encountered).toBe(false);
      expect(result.effectType).toBe('none');
    });

    it('should trigger displacement on encounter roll 1-8', () => {
      // First roll 19 (Encounter triggered), Second roll 5 (Displacement)
      vi.mocked(combatUtils.rollDice)
        .mockReturnValueOnce(19) // Encounter check
        .mockReturnValueOnce(5); // Effect check

      const result = AstralMechanics.checkForPsychicWind();
      expect(result.encountered).toBe(true);
      expect(result.effectType).toBe('location_displacement');
      expect(result.displacementLocation).toBeDefined();
    });

    it('should trigger mental disorientation on encounter roll 9-12', () => {
      // First roll 19 (Encounter triggered), Second roll 10 (Disorientation)
      vi.mocked(combatUtils.rollDice)
        .mockReturnValueOnce(19)
        .mockReturnValueOnce(10);

      const result = AstralMechanics.checkForPsychicWind();
      expect(result.encountered).toBe(true);
      expect(result.effectType).toBe('mental_disorientation');
      expect(result.saveDC).toBe(15);
    });

    it('should trigger damage on encounter roll 13-20', () => {
      // First roll 19 (Encounter triggered), Second roll 15 (Damage)
      vi.mocked(combatUtils.rollDice)
        .mockReturnValueOnce(19)
        .mockReturnValueOnce(15);

      const result = AstralMechanics.checkForPsychicWind();
      expect(result.encountered).toBe(true);
      expect(result.effectType).toBe('damage');
      expect(result.damage).toBe('4d6');
    });
  });

  describe('processPsychicWind', () => {
    it('should add a notification to game state if encounter occurred', () => {
      const mockState: GameState = {
        notifications: [],
        // Stub other required fields
        party: [],
        inventory: [],
        gameTime: new Date(),
        currentLocation: { id: 'test', name: 'test', type: 'city' } as any,
        quests: [],
        activeContracts: []
      } as any;

      const result: PsychicWindResult = {
        encountered: true,
        roll: 19,
        effectType: 'damage',
        description: 'A storm hits!',
        damage: '4d6'
      };

      AstralMechanics.processPsychicWind(mockState, result);

      expect(mockState.notifications.length).toBe(1);
      expect(mockState.notifications[0].message).toContain('Astral Phenomenon');
      expect(mockState.notifications[0].message).toContain('A storm hits!');
    });

    it('should do nothing if no encounter occurred', () => {
       const mockState: GameState = { notifications: [] } as any;
       const result: PsychicWindResult = {
        encountered: false,
        roll: 10,
        effectType: 'none',
        description: 'Calm.'
      };

      AstralMechanics.processPsychicWind(mockState, result);
      expect(mockState.notifications.length).toBe(0);
    });
  });
});
