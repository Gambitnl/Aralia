import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BattleMap3D from '../BattleMap3D';
import type { BattleMapData, CombatCharacter, LightLevel, LightSource } from '../../../types/combat';

/**
 * These tests protect the 3D map handoff from tactical visibility state into
 * the VFX renderer.
 *
 * Full WebGL rendering belongs to rendered inspection. This test mocks the
 * canvas, terrain, actor, and VFX components so it can prove the component
 * boundary: BattleMap3D must call useVisibility with live lights and pass the
 * resulting visibleTiles/lightLevels into VFXSystem.
 */

const mockUseVisibility = vi.fn();
const mockVFXSystem = vi.fn(() => null);

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
  useBattleMap: () => ({
    selectedCharacterId: null,
    validMoves: new Set(),
    activePath: [],
    actionMode: null,
    handleTileClick: vi.fn(),
    handleCharacterClick: vi.fn()
  })
}));

vi.mock('../../../hooks/combat/useTargetSelection', () => ({
  useTargetSelection: () => ({
    validTargetSet: new Set(),
    teleportDestinationSet: new Set()
  })
}));

vi.mock('../../../hooks/combat/useVisibility', () => ({
  useVisibility: (args: unknown) => mockUseVisibility(args)
}));

vi.mock('../terrain', () => ({
  TerrainMesh: () => null,
  GridOverlay: () => null,
  GrassLayer: () => null,
  WaterSystem: () => null,
  DecorationProps: () => null,
  GroundScatter: () => null,
  EzTreeLayer: () => null
}));

vi.mock('../characters', () => ({
  CharacterActor: () => null
}));

vi.mock('../camera', () => ({
  CameraController: () => null
}));

vi.mock('../vfx', () => ({
  VFXSystem: (props: unknown) => mockVFXSystem(props),
  LivingWorld: () => null
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

describe('BattleMap3D visibility handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes live light-derived visibility output into VFXSystem', () => {
    const mapData: BattleMapData = {
      dimensions: { width: 2, height: 1 },
      tiles: new Map([
        ['0-0', createTile('0-0', 0, 0)],
        ['1-0', createTile('1-0', 1, 0)]
      ]),
      theme: 'dungeon',
      seed: 1
    // TODO(lint-intent): Replace this fixture cast once map tile factories expose the full BattleMapData shape.
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
      ['0-0', 'bright'],
      ['1-0', 'darkness']
    ]);
    const visibleTiles = new Set(['0-0']);

    mockUseVisibility.mockReturnValue({
      lightLevels,
      visibleTiles,
      canSeeTile: (tileId: string) => visibleTiles.has(tileId),
      getLightLevel: (tileId: string) => lightLevels.get(tileId) || 'darkness'
    });

    render(
      <BattleMap3D
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
            spellZones: [],
            scheduledSpellEffects: [],
            movementDebuffs: [],
            spellMovementVisuals: []
          // TODO(lint-intent): Replace this broad turn-manager cast with a compact BattleMap3D fixture once one exists.
          } as any,
          turnState: {
            currentTurn: 0,
            turnOrder: [hero.id],
            currentCharacterId: hero.id,
            phase: 'action',
            actionsThisTurn: []
          // TODO(lint-intent): Replace this broad turn-state cast with the shared turn-state fixture once BattleMap3D tests have one.
          } as any,
          abilitySystem: {
            targetingMode: false,
            selectedAbility: null,
            aoePreview: null,
            teleportDestinationPreview: null,
            pendingTeleportAssignment: null,
            isValidTarget: vi.fn()
          // TODO(lint-intent): Replace this broad ability-system cast with a compact BattleMap3D fixture once one exists.
          } as any,
          isCharacterTurn: vi.fn(() => false),
          onCharacterUpdate: vi.fn()
        }}
      />
    );

    expect(mockUseVisibility).toHaveBeenCalledWith(expect.objectContaining({
      activeCharacterId: hero.id,
      combatState: expect.objectContaining({
        activeLightSources: [lightSource],
        mapData
      })
    }));
    expect(mockVFXSystem).toHaveBeenCalledWith(expect.objectContaining({
      activeLightSources: [lightSource],
      lightLevels,
      visibleTiles
    }));
  });
});
