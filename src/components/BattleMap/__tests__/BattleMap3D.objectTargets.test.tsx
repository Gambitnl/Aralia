import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BattleMap3D from '../BattleMap3D';
import type { BattleMapData, CombatCharacter, LightLevel } from '../../../types/combat';

/**
 * This test protects the 3D presentation path for spell-targetable map objects.
 *
 * Object-targeting validation can already return registered map objects as
 * legal targets. The 3D renderer also needs a visible handle so switching from
 * 2D to 3D does not hide the selectable object from the player.
 */

const mockUseBattleMap = vi.fn<(...args: unknown[]) => unknown>();
const mockUseTargetSelection = vi.fn<(...args: unknown[]) => unknown>();
const mockUseVisibility = vi.fn<(...args: unknown[]) => unknown>();

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-canvas">{children}</div>
}));

vi.mock('@react-three/drei', () => ({
  ContactShadows: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>
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
  TerrainMesh: () => null,
  GridOverlay: () => null,
  GrassLayer: () => null,
  WaterSystem: () => null,
  DecorationProps: () => null,
  GroundScatter: () => null,
  EzTreeLayer: () => null,
  DistantTerrain: () => null,
  GroundMist: () => null,
  makeTerrainHeightSampler: () => () => 0
}));

vi.mock('../characters', () => ({
  CharacterActor: () => null
}));

vi.mock('../TargetingDecals', () => ({
  default: () => null
}));

vi.mock('../camera', () => ({
  CameraController: () => null
}));

vi.mock('../vfx', () => ({
  VFXSystem: () => null,
  LivingWorld: () => null
}));

const makeTile = (x: number, y: number) => ({
  id: `${x}-${y}`,
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

const hero = {
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

function renderObjectTargetMap() {
  const mapData: BattleMapData = {
    dimensions: { width: 3, height: 2 },
    tiles: new Map([
      ['0-0', makeTile(0, 0)],
      ['1-0', makeTile(1, 0)],
      ['2-0', makeTile(2, 0)],
      ['0-1', makeTile(0, 1)],
      ['1-1', makeTile(1, 1)],
      ['2-1', makeTile(2, 1)]
    ]),
    targetableObjects: [{
      id: 'loose-stone',
      name: 'Loose Stone',
      position: { x: 2, y: 0 },
      size: 'Tiny',
      weightPounds: 2,
      isWornOrCarried: false,
      isMagical: false,
      isFixedToSurface: false
    }],
    theme: 'dungeon',
    seed: 8
  } as unknown as BattleMapData;

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
          activeLightSources: [],
          reactiveTriggers: [],
          damageNumbers: [],
          spellZones: [],
          scheduledSpellEffects: [],
          movementDebuffs: [],
          spellMovementVisuals: [],
          spellDeliveryVisuals: []
        } as any,
        turnState: {
          currentTurn: 0,
          turnOrder: [hero.id],
          currentCharacterId: hero.id,
          phase: 'action',
          actionsThisTurn: []
        } as any,
        abilitySystem: {
          targetingMode: true,
          selectedAbility: {
            id: 'fire-bolt',
            name: 'Fire Bolt',
            range: 120,
            spell: {
              id: 'fire-bolt',
              targeting: { type: 'single', range: 120, validTargets: ['creatures', 'objects'], lineOfSight: false }
            }
          },
          aoePreview: null,
          teleportDestinationPreview: null,
          pendingTeleportAssignment: null,
          targetValidationReason: null,
          isValidTarget: vi.fn()
        } as any,
        isCharacterTurn: vi.fn(() => false),
        onCharacterUpdate: vi.fn()
      }}
    />
  );
}

describe('BattleMap3D object targets', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: hero.id,
      validMoves: new Set(),
      activePath: [],
      actionMode: 'ability',
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn()
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(),
      validTargetSet: new Set(['2-0']),
      teleportDestinationSet: new Set()
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

  it('renders registered targetable objects as valid 3D spell target handles', () => {
    renderObjectTargetMap();

    expect(screen.getByTestId('targetable-object-3d-loose-stone')).toHaveTextContent('OBJ');
    expect(screen.getByTitle('Loose Stone object - valid spell target')).toHaveClass('bg-amber-300');
  });
});
