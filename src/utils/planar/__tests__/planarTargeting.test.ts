
import { describe, it, expect } from 'vitest';
import { canInteract, canSeeTarget, getCharacterPhase } from '../planarTargeting';
import { CombatCharacter, CombatState } from '@/types/combat';
import { ETHEREAL_PLANE, MATERIAL_PLANE } from '@/data/planes';
import { createMockCombatCharacter } from '@/utils/factories';

// Mock helper
const createMockState = (characters: CombatCharacter[] = []): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 0,
    turnOrder: [],
    currentCharacterId: null,
    phase: 'planning',
    actionsThisTurn: []
  },
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves: [],
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: [],
  mapData: {
    dimensions: { width: 10, height: 10 },
    tiles: new Map(),
    theme: 'dungeon',
    seed: 123
  },
  currentPlane: MATERIAL_PLANE
});

describe('planarTargeting', () => {
  describe('getCharacterPhase', () => {
    it('should return Material Plane by default', () => {
      const char = createMockCombatCharacter({ id: 'c1', name: 'Char' });
      const state = createMockState([char]);
      expect(getCharacterPhase(char, state)).toBe(MATERIAL_PLANE.id);
    });

    it('should return overridden plane if active effect exists', () => {
      const char = createMockCombatCharacter({
        id: 'c1',
        name: 'Blinking Char',
              activeEffects: [{
                  id: 'ae-1',
                  spellId: 'blink',
                  casterId: 'c1',
                  sourceName: 'Blink',
                  type: 'buff',
                  duration: { type: 'rounds', value: 10 },
                  startTime: 0,
                  mechanics: {
                    planarPhase: ETHEREAL_PLANE.id
                  }
                }]
      });
      const state = createMockState([char]);
      expect(getCharacterPhase(char, state)).toBe(ETHEREAL_PLANE.id);
    });
  });

  describe('canSeeTarget', () => {
    const normal = createMockCombatCharacter({ id: 'normal', name: 'Normal' });
              const ethereal = createMockCombatCharacter({
                id: 'ethereal',
                name: 'Ethereal',
                activeEffects: [{
                  id: 'ae-2',
                  spellId: 'blink',
                  casterId: 'ethereal',
                  sourceName: 'Blink',
                  type: 'buff',
                  duration: { type: 'rounds', value: 10 },
                  startTime: 0,
                  mechanics: { planarPhase: ETHEREAL_PLANE.id, planarVision: [MATERIAL_PLANE.id] }
                }]
              });
    const state = createMockState([normal, ethereal]);

    it('should allow vision on same plane', () => {
      expect(canSeeTarget(normal, normal, state)).toBe(true);
    });

    it('should NOT allow Material to see Ethereal', () => {
      expect(canSeeTarget(normal, ethereal, state)).toBe(false);
    });

    it('should allow Ethereal to see Material (via planarVision mechanic)', () => {
      expect(canSeeTarget(ethereal, normal, state)).toBe(true);
    });
  });

  describe('canInteract', () => {
    const normal = createMockCombatCharacter({ id: 'normal', name: 'Normal' });
              const ethereal = createMockCombatCharacter({
                id: 'ethereal',
                name: 'Ethereal',
                activeEffects: [{
                  id: 'ae-3',
                  spellId: 'blink',
                  casterId: 'ethereal',
                  sourceName: 'Blink',
                  type: 'buff',
                  duration: { type: 'rounds', value: 10 },
                  startTime: 0,
                  mechanics: { planarPhase: ETHEREAL_PLANE.id }
                }]
              });
    const state = createMockState([normal, ethereal]);

    it('should allow interaction on same plane', () => {
      expect(canInteract(normal, normal, state)).toBe(true);
    });

    it('should block interaction across planes', () => {
      expect(canInteract(normal, ethereal, state)).toBe(false);
      expect(canInteract(ethereal, normal, state)).toBe(false);
    });
  });
});
