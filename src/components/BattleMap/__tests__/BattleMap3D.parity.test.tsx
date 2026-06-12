import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BattleMap3D from '../BattleMap3D';
import type { BattleMapData, CombatCharacter, LightLevel, LightSource } from '../../../types/combat';

/**
 * This test is the 3D side of the battle-map parity proof.
 *
 * It keeps the renderer boundary honest: the 3D scene must receive the same
 * shared movement, target, overlay, and visibility state that the 2D map uses.
 */

const mockUseBattleMap = vi.fn();
const mockUseTargetSelection = vi.fn();
const mockUseVisibility = vi.fn();
const mockTerrainMesh = vi.fn(() => null);
const mockGridOverlay = vi.fn(() => null);
const mockGrassLayer = vi.fn(() => null);
const mockWaterSystem = vi.fn(() => null);
const mockDecorationProps = vi.fn(() => null);
const mockGroundScatter = vi.fn(() => null);
const mockEzTreeLayer = vi.fn(() => null);
const mockCharacterActor = vi.fn(() => null);
const mockCameraController = vi.fn(() => null);
const mockVFXSystem = vi.fn(() => null);
const mockLivingWorld = vi.fn(() => null);
const mockTargetingDecals = vi.fn();

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-canvas">{children}</div>
}));

vi.mock('@react-three/drei', () => ({
  ContactShadows: () => null
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bloom: () => null,
  Vignette: () => null
}));

vi.mock('postprocessing', () => ({
  BlendFunction: { NORMAL: 'normal' }
}));

vi.mock('../../../hooks/useBattleMap', () => ({
  useBattleMap: (...args: unknown[]) => mockUseBattleMap(...args)
}));

vi.mock('../../../hooks/combat/useTargetSelection', () => ({
  useTargetSelection: (...args: unknown[]) => mockUseTargetSelection(...args)
}));

vi.mock('../../../hooks/combat/useVisibility', () => ({
  useVisibility: (...args: unknown[]) => mockUseVisibility(...args)
}));

vi.mock('../terrain', () => ({
  TerrainMesh: (...args: unknown[]) => mockTerrainMesh(...args),
  GridOverlay: (...args: unknown[]) => mockGridOverlay(...args),
  GrassLayer: (...args: unknown[]) => mockGrassLayer(...args),
  WaterSystem: (...args: unknown[]) => mockWaterSystem(...args),
  DecorationProps: (...args: unknown[]) => mockDecorationProps(...args),
  GroundScatter: (...args: unknown[]) => mockGroundScatter(...args),
  EzTreeLayer: (...args: unknown[]) => mockEzTreeLayer(...args),
  DistantTerrain: () => null,
  GroundMist: () => null,
  makeTerrainHeightSampler: () => () => 0
}));

vi.mock('../characters', () => ({
  CharacterActor: (...args: unknown[]) => mockCharacterActor(...args)
}));

vi.mock('../TargetingDecals', () => ({
  default: (props: unknown) => { mockTargetingDecals(props); return null; }
}));

vi.mock('../camera', () => ({
  CameraController: (...args: unknown[]) => mockCameraController(...args)
}));

vi.mock('../vfx', () => ({
  VFXSystem: (...args: unknown[]) => mockVFXSystem(...args),
  LivingWorld: (...args: unknown[]) => mockLivingWorld(...args)
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

describe('BattleMap3D parity proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: 'hero',
      validMoves: new Set(['1-0']),
      activePath: [{ id: '0-0' }],
      actionMode: 'move',
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn()
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(['0-1']),
      validTargetSet: new Set(['2-0']),
      teleportDestinationSet: new Set(['1-1'])
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map<string, LightLevel>([
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

  it('forwards the shared movement, overlay, and targeting state into the 3D renderer surfaces', () => {
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
      <BattleMap3D
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
            damageNumbers: [{ id: 'damage-1', position: { x: 0, y: 0 }, value: 8, type: 'damage' }],
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
          } as any,
          turnState: {
            currentTurn: 0,
            turnOrder: [hero.id, enemy.id],
            currentCharacterId: hero.id,
            phase: 'action',
            actionsThisTurn: []
          } as any,
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
            pendingTeleportAssignment: {
              ability: { name: 'Misty Step' },
              destinationsByTargetId: {
                [enemy.id]: { x: 1, y: 1 }
              }
            },
            isValidTarget: vi.fn()
          } as any,
          isCharacterTurn: vi.fn(() => false),
          onCharacterUpdate: vi.fn()
        }}
      />
    );

    expect(mockTerrainMesh.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      validMoves: new Set(['1-0']),
      activePath: [{ id: '0-0' }],
      actionMode: 'move'
    }));
    expect(mockGridOverlay.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      validMoves: new Set(['1-0']),
      activePath: [{ id: '0-0' }],
      actionMode: 'move'
    }));
    expect(mockCharacterActor).toHaveBeenCalled();

    const enemyActorCall = mockCharacterActor.mock.calls.find(([props]) => (props as { character: CombatCharacter }).character.id === enemy.id);
    expect(enemyActorCall?.[0]).toEqual(expect.objectContaining({
      character: expect.objectContaining({ id: enemy.id }),
      isTargetable: true,
      targetingMode: true
    }));

    // The AoE template renders via TargetingDecals (terrain-conforming, task
    // 81), not VFXSystem's removed flat-plane AoEPreview.
    expect(mockTargetingDecals.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      aoeSet: new Set(['0-1']),
      validTargetSet: new Set(['2-0']),
      teleportDestinationSet: new Set(['1-1']),
      targetingMode: true
    }));
    expect(mockVFXSystem.mock.calls[0]?.[0]).not.toHaveProperty('aoePreviewTiles');

    expect(mockVFXSystem.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      activeLightSources: [lightSource],
      lightLevels: expect.any(Map),
      visibleTiles: expect.any(Set),
      damageNumbers: [{ id: 'damage-1', position: { x: 0, y: 0 }, value: 8, type: 'damage' }],
      teleportDestinationPreviewTiles: new Set(['1-1']),
      teleportDestinationPreviewTarget: expect.objectContaining({ id: enemy.id, name: 'Enemy' }),
      teleportDestinationPreviewAbilityName: 'Misty Step',
      assignedTeleportDestinations: [
        expect.objectContaining({
          targetId: enemy.id,
          targetName: 'Enemy',
          destination: { x: 1, y: 1 },
          abilityName: 'Misty Step'
        })
      ],
      targetingMode: true
    }));
  });
});
