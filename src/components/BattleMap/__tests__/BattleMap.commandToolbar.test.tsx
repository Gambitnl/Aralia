/**
 * This file protects the 2D battle map's compact Move / Attack toolbar.
 *
 * The toolbar is rendered inside the same stacking context as painted ground,
 * fog, and thousands of tactical tiles. These tests prove it remains on the
 * shared combat overlay layer, advertises the actual quick attack it will arm,
 * and mirrors the ability palette's second-click cancellation behavior.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ability, BattleMapData, CombatCharacter } from '../../../types/combat';
import { Z_INDEX } from '../../../styles/zIndex';
import BattleMap from '../BattleMap';

// ============================================================================
// Focused Renderer Stubs
// ============================================================================
// The tests exercise BattleMap's command surface, not canvas paint, fog, token,
// or tile rendering. Replacing those heavy children keeps this regression fast
// while leaving BattleMap's real stacking and command wiring intact.
// ============================================================================

const mockUseBattleMap = vi.fn();

vi.mock('../../../hooks/useBattleMap', () => ({
  useBattleMap: (...args: unknown[]) => mockUseBattleMap(...args),
}));

vi.mock('../../../hooks/combat/useTargetSelection', () => ({
  useTargetSelection: () => ({
    aoeSet: new Set(),
    validTargetSet: new Set(),
    teleportDestinationSet: new Set(),
  }),
}));

vi.mock('../../../hooks/combat/useVisibility', () => ({
  useVisibility: () => ({
    lightLevels: new Map([['0-0', 'bright']]),
    visibleTiles: new Set(['0-0']),
    canSeeTile: () => true,
    getLightLevel: () => 'bright',
  }),
}));

vi.mock('../BattleMapGroundCanvas', () => ({ default: () => <div data-testid="ground-canvas" /> }));
vi.mock('../BattleMapFogCanvas', () => ({ default: () => <div data-testid="fog-canvas" /> }));
vi.mock('../BattleMapOverlay', () => ({ default: () => <div data-testid="battle-map-overlay" /> }));
vi.mock('../BattleMapTile', () => ({ default: () => <div>Tile</div> }));
vi.mock('../CharacterToken', () => ({ default: () => <div data-testid="character-token" /> }));

// ============================================================================
// Fixtures
// ============================================================================

const dash: Ability = {
  id: 'dash',
  name: 'Dash',
  description: 'Move farther this turn.',
  type: 'movement',
  cost: { type: 'action' },
  targeting: 'self',
  range: 0,
  effects: [],
};

const longsword: Ability = {
  id: 'longsword',
  name: 'Longsword',
  description: 'Make a direct melee attack.',
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 1,
  effects: [],
};

const hero = {
  id: 'hero',
  name: 'Hero',
  team: 'player',
  position: { x: 0, y: 0 },
  currentHP: 10,
  maxHP: 10,
  abilities: [dash, longsword],
  statusEffects: [],
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    speed: 30,
    baseInitiative: 0,
  },
  actionEconomy: { action: {}, bonusAction: {}, reaction: {}, movement: {} },
} as unknown as CombatCharacter;

const mapData = {
  dimensions: { width: 1, height: 1 },
  tiles: new Map([['0-0', {
    id: '0-0',
    coordinates: { x: 0, y: 0 },
    terrain: 'floor',
    elevation: 0,
    movementCost: 1,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    environmentalEffects: [],
    effects: [],
  }]]),
  theme: 'forest',
  seed: 1,
} as unknown as BattleMapData;

const renderCommandToolbar = ({
  targetingMode = false,
  targetValidationReason = null,
}: {
  targetingMode?: boolean;
  targetValidationReason?: string | null;
} = {}) => {
  const startTargeting = vi.fn();
  const cancelTargeting = vi.fn();
  const setActionMode = vi.fn();

  // The hook's resolved mode normally follows targeting state. Reproduce that
  // public contract so BattleMap can render the correct pressed segment.
  mockUseBattleMap.mockReturnValue({
    characterPositions: new Map([[hero.id, { characterId: hero.id, coordinates: hero.position }]]),
    selectedCharacterId: hero.id,
    validMoves: new Set(),
    activePath: [],
    actionMode: targetingMode ? 'ability' : 'move',
    setActionMode,
    handleTileClick: vi.fn(),
    handleCharacterClick: vi.fn(),
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
            actionsThisTurn: [],
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
          canAffordAction: vi.fn(() => true),
        } as never,
        turnState: {
          currentTurn: 0,
          turnOrder: [hero.id],
          currentCharacterId: hero.id,
          phase: 'action',
          actionsThisTurn: [],
        } as never,
        abilitySystem: {
          targetingMode,
          selectedAbility: targetingMode ? longsword : null,
          targetValidationReason,
          aoePreview: null,
          teleportDestinationPreview: null,
          pendingTeleportAssignment: null,
          previewAoE: vi.fn(),
          isValidTarget: vi.fn(),
          startTargeting,
          cancelTargeting,
        } as never,
        isCharacterTurn: vi.fn(() => true),
        onCharacterUpdate: vi.fn(),
      }}
    />,
  );

  return { startTargeting, cancelTargeting, setActionMode };
};

describe('BattleMap command toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stays above the painted board and arms the named direct attack', () => {
    const { startTargeting, setActionMode } = renderCommandToolbar();

    const toolbar = screen.getByTestId('battle-map-command-toolbar');
    const move = screen.getByRole('button', { name: 'Move on the battle map' });
    const attack = screen.getByRole('button', { name: 'Attack with Longsword' });

    // A numeric registry value avoids the unresolved CSS-variable class that
    // previously left the toolbar at z-index:auto beneath the terrain tiles.
    expect(toolbar).toHaveStyle({ zIndex: Z_INDEX.COMBAT_OVERLAY });
    expect(move).toHaveAttribute('aria-pressed', 'true');
    expect(attack).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(attack);

    expect(setActionMode).toHaveBeenCalledWith('ability');
    expect(startTargeting).toHaveBeenCalledWith(longsword, hero);
  });

  it('keeps validation feedback above the board and cancels an armed shortcut', () => {
    const { cancelTargeting, setActionMode } = renderCommandToolbar({
      targetingMode: true,
      targetValidationReason: 'Longsword needs an enemy target.',
    });

    const attack = screen.getByRole('button', { name: 'Attack with Longsword' });
    const validation = screen.getByRole('status');

    expect(attack).toHaveAttribute('aria-pressed', 'true');
    expect(validation).toHaveStyle({ zIndex: Z_INDEX.COMBAT_OVERLAY });
    expect(validation).toHaveClass('top-16');

    fireEvent.click(attack);

    expect(cancelTargeting).toHaveBeenCalledTimes(1);
    expect(setActionMode).toHaveBeenCalledWith('move');
  });
});
