import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BattleMap from '../BattleMap';
import type { BattleMapData, CombatCharacter, Position } from '../../../types/combat';

/**
 * These tests protect the optional object-interaction layer on the 2D battle map.
 *
 * Normal combat can keep treating map objects as spell-targeting data. The
 * combat scenario sandbox needs a little more: a real object marker that can be
 * selected and moved on the grid so its attached light source can move with it.
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

const createTile = (x: number, y: number) => ({
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

function renderObjectMap(activeObjectId: string | null, onObjectMove = vi.fn(), assetOverlayVisible = true) {
  const mapData: BattleMapData = {
    dimensions: { width: 3, height: 1 },
    tiles: new Map([
      ['0-0', createTile(0, 0)],
      ['1-0', createTile(1, 0)],
      ['2-0', createTile(2, 0)]
    ]),
    targetableObjects: [{
      id: 'cover-sandbox-torch',
      name: 'Sandbox Torch',
      position: { x: 1, y: 0 },
      isFixedToSurface: false
    }],
    theme: 'dungeon',
    seed: 1
  } as BattleMapData;
  const hero = {
    id: 'hero',
    name: 'Hero',
    team: 'player',
    position: { x: 0, y: 0 },
    abilities: [],
    stats: {},
    actionEconomy: {}
  } as unknown as CombatCharacter;
  const onObjectSelect = vi.fn();

  mockUseVisibility.mockReturnValue({
    lightLevels: new Map([['0-0', 'bright'], ['1-0', 'bright'], ['2-0', 'bright']]),
    visibleTiles: new Set(['0-0', '1-0', '2-0']),
    canSeeTile: () => true,
    getLightLevel: () => 'bright'
  });

  render(
    <BattleMap
      mapData={mapData}
      characters={[hero]}
      assetOverlayVisible={assetOverlayVisible}
      objectInteraction={{
        activeObjectId,
        movableObjectIds: ['cover-sandbox-torch'],
        onObjectSelect,
        onObjectMove
      }}
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
          canAffordAction: vi.fn(() => false)
        // DEBT: BattleMap currently expects the full turn-manager return
        // shape. This test only needs the object interaction path, so this
        // compact fixture fills the fields BattleMap reads instead of building
        // the full combat hook. A shared BattleMap fixture should replace this.
        } as any,
        turnState: {
          currentTurn: 0,
          turnOrder: [hero.id],
          currentCharacterId: hero.id,
          phase: 'action',
          actionsThisTurn: []
        // DEBT: This mirrors the minimal turn-state shape used by nearby
        // BattleMap tests. A typed fixture would make this safer once the map
        // tests are consolidated.
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
        // DEBT: The real ability-system hook has a broad surface. Object
        // movement does not use it, so this test supplies only the fields that
        // BattleMap reads during rendering.
        } as any,
        isCharacterTurn: vi.fn(() => false),
        onCharacterUpdate: vi.fn()
      }}
    />
  );

  return { onObjectSelect, onObjectMove };
}

describe('BattleMap object interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects a movable targetable object from its map marker', () => {
    const { onObjectSelect } = renderObjectMap(null);

    fireEvent.click(screen.getByRole('button', { name: 'Select Sandbox Torch object' }));

    expect(onObjectSelect).toHaveBeenCalledWith('cover-sandbox-torch');
  });

  it('moves the selected object when a destination tile is clicked', () => {
    const onObjectMove = vi.fn();
    renderObjectMap('cover-sandbox-torch', onObjectMove);

    fireEvent.click(screen.getByRole('button', { name: 'Tile floor at 2, 0' }));

    expect(onObjectMove).toHaveBeenCalledWith('cover-sandbox-torch', { x: 2, y: 0 } satisfies Position);
  });

  it('hides targetable asset markers when the parent disables the asset overlay', () => {
    renderObjectMap(null, vi.fn(), false);

    expect(screen.queryByRole('button', { name: 'Select Sandbox Torch object' })).not.toBeInTheDocument();
  });
});
