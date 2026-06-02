import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BattleMap from '../BattleMap';
import type { BattleMapData, CombatCharacter, LightSource, LightLevel } from '../../../types/combat';

/**
 * These tests protect the 2D map handoff from live light state into rendered
 * tile visibility.
 *
 * The pure visibility hook already has its own tests. This file stays focused
 * on the component boundary: BattleMap must pass live activeLightSources into
 * useVisibility, then pass the resulting visible/hidden and bright/dim/dark
 * values down into BattleMapTile.
 */

const mockUseVisibility = vi.fn();

vi.mock('../../../hooks/useBattleMap', () => ({
  useBattleMap: () => ({
    characterPositions: new Map(),
    selectedCharacterId: null,
    validMoves: new Set(),
    activePath: [],
    actionMode: null,
    setActionMode: vi.fn(),
    handleTileClick: vi.fn(),
    handleCharacterClick: vi.fn()
  })
}));

vi.mock('../../../hooks/combat/useTargetSelection', () => ({
  useTargetSelection: () => ({
    aoeSet: new Set(),
    validTargetSet: new Set(),
    teleportDestinationSet: new Set()
  })
}));

vi.mock('../../../hooks/combat/useVisibility', () => ({
  useVisibility: (args: unknown) => mockUseVisibility(args)
}));

vi.mock('../CharacterToken', () => ({
  default: ({ character }: { character: CombatCharacter }) => (
    <div data-testid={`character-${character.id}`} />
  )
}));

vi.mock('../BattleMapOverlay', () => ({
  default: () => <div data-testid="battle-map-overlay" />
}));

const createTile = (id: string, x: number, y: number) => ({
  id,
  coordinates: { x, y },
  terrain: 'floor',
  elevation: 0,
  movementCost: 1,
  blocksMovement: false,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: []
});

describe('BattleMap visibility handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('feeds live active lights into useVisibility and renders returned tile masks', () => {
    const mapData: BattleMapData = {
      dimensions: { width: 2, height: 1 },
      tiles: new Map([
        ['0-0', createTile('0-0', 0, 0)],
        ['1-0', createTile('1-0', 1, 0)]
      ]),
      theme: 'dungeon',
      seed: 1
    } as unknown as BattleMapData;
    const hero: CombatCharacter = {
      id: 'hero',
      name: 'Hero',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 10,
      maxHP: 10,
      abilities: [],
      statusEffects: [],
      stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, speed: 30, baseInitiative: 0 },
      actionEconomy: { action: {}, bonusAction: {}, reaction: {}, movement: {} }
    } as unknown as CombatCharacter;
    const lightSource: LightSource = {
      id: 'light-1',
      sourceSpellId: 'light',
      casterId: hero.id,
      brightRadius: 20,
      dimRadius: 20,
      attachedTo: 'caster',
      attachedToCharacterId: hero.id,
      createdTurn: 0
    };
    const lightLevels = new Map<string, LightLevel>([
      ['0-0', 'dim'],
      ['1-0', 'darkness']
    ]);

    mockUseVisibility.mockReturnValue({
      lightLevels,
      visibleTiles: new Set(['0-0']),
      canSeeTile: (tileId: string) => tileId === '0-0',
      getLightLevel: (tileId: string) => lightLevels.get(tileId) || 'darkness'
    });

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero]}
        combatState={{
          turnManager: {
            turnState: {
              currentTurn: 0,
              turnOrder: [hero.id],
              currentCharacterId: hero.id,
              phase: 'action',
              actionsThisTurn: []
            },
            activeLightSources: [lightSource],
            reactiveTriggers: [],
            damageNumbers: [],
            animations: [],
            spellZones: [],
            scheduledSpellEffects: [],
            movementDebuffs: [],
            spellMovementVisuals: [],
            canAffordAction: vi.fn(() => false)
          // TODO(lint-intent): Replace this broad turn-manager cast with a
          // compact BattleMap test fixture once one exists.
          } as any,
          turnState: {
            currentTurn: 0,
            turnOrder: [hero.id],
            currentCharacterId: hero.id,
            phase: 'action',
            actionsThisTurn: []
          // TODO(lint-intent): Replace this broad turn-state cast with the
          // shared turn-state fixture once BattleMap tests have one.
          } as any,
          abilitySystem: {
            targetingMode: false,
            selectedAbility: null,
            aoePreview: null,
            teleportDestinationPreview: null,
            pendingTeleportAssignment: null,
            previewAoE: vi.fn(),
            isValidTarget: vi.fn(),
            cancelTargeting: vi.fn(),
            startTargeting: vi.fn()
          // TODO(lint-intent): Replace this broad ability-system cast with a
          // compact BattleMap test fixture once one exists.
          } as any,
          isCharacterTurn: vi.fn(() => false),
          onCharacterUpdate: vi.fn()
        }}
      />
    );

    // The map must pass the live turn-manager light array into useVisibility,
    // otherwise light spells can render decorative rings without affecting
    // tactical tile visibility.
    expect(mockUseVisibility).toHaveBeenCalledWith(expect.objectContaining({
      activeCharacterId: hero.id,
      combatState: expect.objectContaining({
        activeLightSources: [lightSource],
        mapData
      })
    }));
    expect(screen.getByTitle('(0, 0) - floor - Elev: 0 - dim')).toBeInTheDocument();
    expect(screen.getByTitle('(1, 0) - floor - Elev: 0 - hidden')).toBeInTheDocument();
  });
});
