// TODO(lint-intent): 'vi' is unused in this test; use it in the assertion path or remove it.
import { describe, it, expect, vi as _vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibility } from '../useVisibility';
import { CombatState, BattleMapData, LightSource, CombatCharacter } from '../../types/combat';

// Mock VisibilitySystem to isolate hook logic (optional, but good for speed)
// But since VisibilitySystem is pure logic, we can use the real one for integration testing the hook.

function createMockState(): CombatState {
  const mapData: BattleMapData = {
    dimensions: { width: 10, height: 10 },
    tiles: new Map(),
    theme: 'dungeon',
    seed: 123
  };

  for(let x=0; x<10; x++) {
      for(let y=0; y<10; y++) {
          mapData.tiles.set(`${x}-${y}`, {
              id: `${x}-${y}`,
              coordinates: {x,y},
              terrain: 'floor',
              elevation: 0,
              movementCost: 1,
              blocksLoS: false,
              blocksMovement: false,
              decoration: null,
              effects: []
          });
      }
  }

  const char: CombatCharacter = {
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: {
          senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 },
          strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
          baseInitiative: 0, speed: 30, cr: '1'
      },
      activeEffects: [],
      // ... minimal stubs
      level: 1, team: 'player', currentHP: 10, maxHP: 10, initiative: 10,
      statusEffects: [], activeLightSources: [], abilities: [], actionEconomy: {
          action: { used: false, remaining: 1 },
          bonusAction: { used: false, remaining: 1 },
          reaction: { used: false, remaining: 1 },
          movement: { used: 0, total: 30 },
          freeActions: 1
      }
  } as unknown as CombatCharacter; // Casting to skip full interface implementation for test

  const light: LightSource = {
      id: 'l1',
      sourceSpellId: 's1',
      casterId: 'hero',
      brightRadius: 10,
      dimRadius: 0,
      attachedTo: 'point',
      position: { x: 5, y: 5 },
      createdTurn: 1
  };

  return {
      isActive: true,
      characters: [char],
      activeLightSources: [light],
      mapData,
      turnState: { currentTurn: 1, turnOrder: ['hero'], currentCharacterId: 'hero', phase: 'action', actionsThisTurn: [] },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [],
      reactiveTriggers: []
  };
}

describe('useVisibility', () => {
    it('should return light levels and visible tiles', () => {
        const state = createMockState();

        const { result } = renderHook(() => useVisibility({
            combatState: state,
            viewerId: 'hero'
        }));

        expect(result.current.lightLevels.get('5-5')).toBe('bright');
        expect(result.current.visibleTiles.has('5-5')).toBe(true);
        expect(result.current.canSeeTile('5-5')).toBe(true);
        expect(result.current.getLightLevel('5-5')).toBe('bright');

        // Check out of range
        expect(result.current.lightLevels.get('9-9')).toBe('darkness'); // or undefined/darkness
        expect(result.current.visibleTiles.has('9-9')).toBe(false);
    });

    it('should handle missing map data gracefully', () => {
        const state = createMockState();
        state.mapData = undefined;

        const { result } = renderHook(() => useVisibility({
            combatState: state,
            viewerId: 'hero'
        }));

        expect(result.current.visibleTiles.size).toBe(0);
        expect(result.current.lightLevels.size).toBe(0);
    });
});
