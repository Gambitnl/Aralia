
import { renderHook, act } from '@testing-library/react';
import { useGridMovement } from '../useGridMovement'; // Corrected import path
import { BattleMapData, CharacterPosition, CombatCharacter } from '../../../types/combat';
import { vi, describe, it, expect } from 'vitest';

// Mock pathfinding
vi.mock('../../../utils/pathfinding', () => ({
  // TODO(lint-intent): 'mapData' is unused in this test; use it in the assertion path or remove it.
  findPath: vi.fn((start, end, _mapData) => {
    // Simple mock path: just start and end
    return [start, end];
  })
}));

describe('useGridMovement', () => {
  const mockMapData: BattleMapData = {
    dimensions: { width: 5, height: 5 },
    tiles: new Map([
        ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, movementCost: 5, blocksMovement: false, terrain: 'grass', elevation: 0, blocksLoS: false, decoration: null, effects: [] }],
        ['0-1', { id: '0-1', coordinates: { x: 0, y: 1 }, movementCost: 5, blocksMovement: false, terrain: 'grass', elevation: 0, blocksLoS: false, decoration: null, effects: [] }],
        ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, movementCost: 5, blocksMovement: false, terrain: 'grass', elevation: 0, blocksLoS: false, decoration: null, effects: [] }],
        ['1-1', { id: '1-1', coordinates: { x: 1, y: 1 }, movementCost: 5, blocksMovement: false, terrain: 'grass', elevation: 0, blocksLoS: false, decoration: null, effects: [] }]
    ]),
    theme: 'forest',
    seed: 123
  };

  const mockCharacterPositions = new Map<string, CharacterPosition>([
    ['char1', { characterId: 'char1', coordinates: { x: 0, y: 0 } }]
  ]);

    const mockCharacter: CombatCharacter = {
    id: 'char1',
    name: 'Hero',
    level: 1 as any,
    actionEconomy: {
        movement: { total: 30, used: 0 },
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        freeActions: 1
    },
    position: { x: 0, y: 0 },
    stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '1'
    },
    abilities: [],
    team: 'player',
    currentHP: 10,
    maxHP: 10,
    initiative: 10,
    statusEffects: [],
    class: {
        id: 'fighter',
        name: 'Fighter',
        description: '',
        hitDie: 10,
        primaryAbility: ['Strength'],
        savingThrowProficiencies: [],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 0,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: []
    } as any
  };

  it('should initialize with empty state when no character selected', () => {
    const { result } = renderHook(() => useGridMovement({
      mapData: mockMapData,
      characterPositions: mockCharacterPositions,
      selectedCharacter: null
    }));

    expect(result.current.validMoves.size).toBe(0);
    expect(result.current.activePath).toEqual([]);
  });

  it('should automatically calculate valid moves when character is selected', () => {
    const { result, rerender } = renderHook((props) => useGridMovement(props), {
      initialProps: {
          mapData: mockMapData,
          characterPositions: mockCharacterPositions,
          selectedCharacter: null as CombatCharacter | null
      }
    });

    expect(result.current.validMoves.size).toBe(0);

    // Select character
    rerender({
        mapData: mockMapData,
        characterPositions: mockCharacterPositions,
        selectedCharacter: mockCharacter
    });

    expect(result.current.validMoves.has('0-0')).toBe(true);
    expect(result.current.validMoves.has('0-1')).toBe(true);
    expect(result.current.validMoves.has('1-0')).toBe(true);
    expect(result.current.validMoves.has('1-1')).toBe(true);
  });

  it('should calculate path', () => {
    const { result } = renderHook(() => useGridMovement({
        mapData: mockMapData,
        characterPositions: mockCharacterPositions,
        selectedCharacter: mockCharacter
    }));

    const targetTile = mockMapData.tiles.get('0-1')!;

    act(() => {
      result.current.calculatePath(mockCharacter, targetTile);
    });

    expect(result.current.activePath.length).toBeGreaterThan(0);
  });

  it('should clear state (only active path, as validMoves is derived)', () => {
    // TODO(lint-intent): 'rerender' is unused in this test; use it in the assertion path or remove it.
    const { result, rerender: _rerender } = renderHook((props) => useGridMovement(props), {
        initialProps: {
            mapData: mockMapData,
            characterPositions: mockCharacterPositions,
            selectedCharacter: mockCharacter
        }
    });

    expect(result.current.validMoves.size).toBeGreaterThan(0);

    // Calculate a path
    const targetTile = mockMapData.tiles.get('0-1')!;
    act(() => {
        result.current.calculatePath(mockCharacter, targetTile);
    });
    expect(result.current.activePath.length).toBeGreaterThan(0);

    // Clear state
    act(() => {
      result.current.clearMovementState();
    });

    // validMoves should still remain as it is derived from the selection
    expect(result.current.validMoves.size).toBeGreaterThan(0);
    // activePath should be cleared
    expect(result.current.activePath).toEqual([]);
  });
});
