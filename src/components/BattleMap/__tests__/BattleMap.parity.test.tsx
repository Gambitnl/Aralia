import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BattleMap from '../BattleMap';
import type { BattleMapData, CombatCharacter, LightSource } from '../../../types/combat';

/**
 * This test is the 2D side of the battle-map parity proof.
 *
 * It does not try to retest combat rules. It proves that the 2D renderer still
 * receives the shared hook outputs that drive movement highlights, target
 * highlighting, AoE / teleport overlays, and the CombatView-owned map-update
 * surface.
 */

const mockUseBattleMap = vi.fn();
const mockUseTargetSelection = vi.fn();
const mockUseVisibility = vi.fn();
const mockBattleMapOverlay = vi.fn((_props: unknown) => <div data-testid="battle-map-overlay" />);

vi.mock('../../../hooks/useBattleMap', () => ({
  useBattleMap: (...args: unknown[]) => mockUseBattleMap(...args)
}));

vi.mock('../../../hooks/combat/useTargetSelection', () => ({
  useTargetSelection: (...args: unknown[]) => mockUseTargetSelection(...args)
}));

vi.mock('../../../hooks/combat/useVisibility', () => ({
  useVisibility: (...args: unknown[]) => mockUseVisibility(...args)
}));

vi.mock('../CharacterToken', () => ({
  default: ({ character }: { character: CombatCharacter }) => (
    <div data-testid={`character-${character.id}`} />
  )
}));

vi.mock('../BattleMapOverlay', () => ({
  default: (props: unknown) => mockBattleMapOverlay(props)
}));

const makeTile = (id: string, x: number, y: number) => ({
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

describe('BattleMap parity proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: 'hero',
      validMoves: new Set(['1-0']),
      activePath: [{ id: '0-0' }],
      actionMode: 'move',
      setActionMode: vi.fn(),
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn()
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(['0-1']),
      validTargetSet: new Set(['2-0']),
      teleportDestinationSet: new Set(['1-1'])
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map([
        ['0-0', 'bright'],
        ['1-0', 'bright'],
        ['2-0', 'bright'],
        ['0-1', 'bright'],
        ['1-1', 'bright'],
        ['2-1', 'bright']
      ]),
      visibleTiles: new Set(['0-0', '1-0', '2-0', '0-1', '1-1', '2-1']),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => 'bright')
    });
  });

  it('keeps the same shared state visible as tile movement, target, AoE, and teleport highlights', () => {
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
    const enemy: CombatCharacter = {
      ...hero,
      id: 'enemy',
      name: 'Enemy',
      team: 'enemy',
      position: { x: 2, y: 0 }
    };
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

    render(
      <BattleMap
        mapData={{
          dimensions: { width: 3, height: 2 },
          tiles: new Map([
            ['0-0', makeTile('0-0', 0, 0)],
            ['1-0', makeTile('1-0', 1, 0)],
            ['2-0', makeTile('2-0', 2, 0)],
            ['0-1', makeTile('0-1', 0, 1)],
            ['1-1', makeTile('1-1', 1, 1)],
            ['2-1', makeTile('2-1', 2, 1)]
          ]),
          theme: 'forest',
          seed: 1
        } as unknown as BattleMapData}
        characters={[hero, enemy]}
        combatState={{
          turnManager: {
            turnState: {
              currentTurn: 0,
              turnOrder: [hero.id, enemy.id],
              currentCharacterId: hero.id,
              phase: 'action',
              actionsThisTurn: []
            },
            activeLightSources: [lightSource],
            reactiveTriggers: [],
            damageNumbers: [],
            animations: [],
            spellZones: [{
              id: 'zone-1',
              spellId: 'web',
              casterId: hero.id,
              position: { x: 0, y: 1 },
              areaOfEffect: { type: 'circle', radius: 1 },
              direction: 'north',
              effects: []
            }],
            scheduledSpellEffects: [],
            movementDebuffs: [],
            spellMovementVisuals: [],
            spellDeliveryVisuals: [],
            canAffordAction: vi.fn(() => true)
          } as unknown as React.ComponentProps<typeof BattleMap>['combatState']['turnManager'],
          turnState: {
            currentTurn: 0,
            turnOrder: [hero.id, enemy.id],
            currentCharacterId: hero.id,
            phase: 'action',
            actionsThisTurn: []
          } as unknown as React.ComponentProps<typeof BattleMap>['combatState']['turnState'],
          abilitySystem: {
            targetingMode: true,
            selectedAbility: { id: 'fireball', name: 'Fireball', range: 6 } as any,
            aoePreview: {
              center: { x: 0, y: 1 },
              affectedTiles: [{ x: 0, y: 1 }],
              ability: { id: 'fireball', name: 'Fireball', range: 6 } as any
            },
            teleportDestinationPreview: {
              targetId: enemy.id,
              affectedTiles: [{ x: 1, y: 1 }],
              ability: { id: 'misty-step', name: 'Misty Step', range: 30 } as any
            },
            targetValidationReason: 'This spell can only target enemies.',
            pendingTeleportAssignment: {
              ability: { name: 'Misty Step' },
              destinationsByTargetId: {
                [enemy.id]: { x: 1, y: 1 }
              }
            },
            previewAoE: vi.fn(),
            isValidTarget: vi.fn(),
            cancelTargeting: vi.fn(),
            startTargeting: vi.fn()
          } as unknown as React.ComponentProps<typeof BattleMap>['combatState']['abilitySystem'],
          isCharacterTurn: vi.fn(() => false),
          onCharacterUpdate: vi.fn()
        }}
      />
    );

    const moveTile = screen.getByRole('button', { name: 'Tile floor at 1, 0' });
    const pathTile = screen.getByRole('button', { name: 'Tile floor at 0, 0' });
    const targetTile = screen.getByRole('button', { name: 'Tile floor at 2, 0' });
    const aoeTile = screen.getByRole('button', { name: 'Tile floor at 0, 1' });
    const teleportTile = screen.getByRole('button', { name: 'Tile floor at 1, 1' });

    expect(moveTile.querySelector('.bg-emerald-400\\/20')).toBeInTheDocument();
    expect(pathTile.querySelector('.bg-emerald-300\\/60')).toBeInTheDocument();
    expect(targetTile.querySelector('.bg-rose-500\\/40')).toBeInTheDocument();
    expect(aoeTile.querySelector('.bg-orange-500\\/55')).toBeInTheDocument();
    expect(teleportTile.querySelector('.bg-sky-400\\/55')).toBeInTheDocument();
    expect(screen.getByText('This spell can only target enemies.')).toBeInTheDocument();

    expect(mockBattleMapOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        mapData: expect.any(Object),
        characters: expect.arrayContaining([expect.objectContaining({ id: hero.id }), expect.objectContaining({ id: enemy.id })]),
        activeLightSources: [lightSource],
        spellZones: expect.arrayContaining([expect.objectContaining({ id: 'zone-1' })]),
        aoePreview: expect.objectContaining({
          center: { x: 0, y: 1 },
          affectedTiles: [{ x: 0, y: 1 }]
        }),
        teleportDestinationPreview: expect.objectContaining({
          targetId: enemy.id,
          affectedTiles: [{ x: 1, y: 1 }]
        }),
        assignedTeleportDestinations: [
          expect.objectContaining({
            targetId: enemy.id,
            targetName: 'Enemy',
            destination: { x: 1, y: 1 },
            abilityName: 'Misty Step'
          })
        ]
      })
    );
  });

  it('renders a directionless opening receipt without claiming a route arrow', () => {
    const hero = {
      id: 'opening-hero',
      name: 'Opening Hero',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 10,
      maxHP: 10,
      abilities: [],
      statusEffects: [],
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        speed: 30,
        baseInitiative: 0
      },
      actionEconomy: { action: {}, bonusAction: {}, reaction: {}, movement: {} }
    } as unknown as CombatCharacter;
    const mapData = {
      dimensions: { width: 1, height: 1 },
      tiles: new Map([['0-0', makeTile('0-0', 0, 0)]]),
      theme: 'forest',
      seed: 42,
      encounterContext: {
        kind: 'opening-standoff',
        source: 'worldforge-opening',
        sourceReceiptId: 'opening:42:cell:476',
        sourceWorldCellId: 476,
        anchorTile: { x: 0, y: 0 },
        deployment: {
          player: 'current-position',
          enemy: 'terrain-fit-standoff-constellation'
        },
        omittedFacts: {
          enemyWorldPositions: 'not-authored',
          approachDirection: 'not-authored'
        }
      }
    } as BattleMapData;

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
            activeLightSources: [],
            reactiveTriggers: [],
            damageNumbers: [],
            animations: [],
            spellZones: [],
            scheduledSpellEffects: [],
            movementDebuffs: [],
            spellMovementVisuals: [],
            spellDeliveryVisuals: [],
            canAffordAction: vi.fn(() => true)
          } as unknown as React.ComponentProps<typeof BattleMap>['combatState']['turnManager'],
          turnState: {
            currentTurn: 0,
            turnOrder: [hero.id],
            currentCharacterId: hero.id,
            phase: 'action',
            actionsThisTurn: []
          } as unknown as React.ComponentProps<typeof BattleMap>['combatState']['turnState'],
          abilitySystem: {
            targetingMode: false,
            cancelTargeting: vi.fn(),
            startTargeting: vi.fn(),
            isValidTarget: vi.fn()
          } as unknown as React.ComponentProps<typeof BattleMap>['combatState']['abilitySystem'],
          isCharacterTurn: vi.fn(() => false),
          onCharacterUpdate: vi.fn()
        }}
      />
    );

    expect(screen.getByLabelText(
      "Opening standoff; marks the party's exact source-world position; enemy direction is not authored"
    )).toBeInTheDocument();
    expect(screen.queryByLabelText(/arrow points/)).not.toBeInTheDocument();
  });
});
