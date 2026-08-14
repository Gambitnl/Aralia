import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombatCharacter } from '../../../../types/combat';
import ClassBattlefieldDemo from './ClassBattlefieldDemo';

/**
 * This test proves the Classes-owned bridge keeps one native character state
 * observable while the shared Tactical Sandbox renderer switches between 2D and
 * 3D. Heavy canvas and combat-hook internals are stubbed here; mounted browser
 * proof remains responsible for proving the real BattleMap and BattleMap3D output.
 */

// ============================================================================
// Focused renderer and hook doubles
// ============================================================================
// The bridge test checks state forwarding and reset semantics, not WebGL setup or
// terrain painting. These doubles keep the source test deterministic and small.
const mockInitializeCombat = vi.fn();
const mockTurnManager = {
  turnState: { turnOrder: [] },
  initializeCombat: mockInitializeCombat,
  executeAction: vi.fn(),
  addDamageNumber: vi.fn(),
  isCharacterTurn: vi.fn(() => false),
};

vi.mock('../../../BattleMap/BattleMap', () => ({
  default: ({ characters }: { characters: CombatCharacter[] }) => (
    <div data-testid="mock-wild-heart-2d-renderer">
      2D {characters[0]?.statusEffects.find(status => status.id === 'raging')?.name ?? 'Not raging'}
    </div>
  ),
}));

vi.mock('../../../BattleMap/BattleMap3D', () => ({
  default: ({ characters }: { characters: CombatCharacter[] }) => (
    <div data-testid="mock-wild-heart-3d-renderer">
      3D {characters[0]?.statusEffects.find(status => status.id === 'raging')?.name ?? 'Not raging'}
    </div>
  ),
}));

vi.mock('../../../../hooks/combat/useTurnManager', () => ({
  useTurnManager: () => mockTurnManager,
}));

vi.mock('../../../../hooks/useAbilitySystem', () => ({
  useAbilitySystem: () => ({}),
}));

vi.mock('../../../../hooks/useBattleMapGeneration', () => ({
  generateProceduralSandboxBattleSetup: (
    _biome: string,
    _seed: number,
    characters: CombatCharacter[],
  ) => ({
    mapData: {
      dimensions: { width: 2, height: 2 },
      tiles: new Map(),
      theme: 'forest',
      seed: 31873,
    },
    positionedCharacters: characters.map((character, index) => ({
      ...character,
      position: { x: index, y: 0 },
    })),
  }),
}));

vi.mock('../../../../utils/sandbox/quickCharacterGenerator', () => ({
  createQuickCombatCharacter: () => ({
    id: 'training-target',
    name: 'Training Target',
    team: 'player',
    statusEffects: [],
  }),
}));

// ============================================================================
// Fixtures
// ============================================================================
// Only the fields read by this Classes bridge and its mocked production seams are
// needed. The real mounted route supplies the complete production CombatCharacter.
const baselineCharacter = {
  id: 'wild-heart',
  name: 'Wild Heart Tester',
  team: 'player',
  statusEffects: [],
} as unknown as CombatCharacter;

const ragingCharacter = {
  ...baselineCharacter,
  statusEffects: [{
    id: 'raging',
    name: 'Raging (Bear Spirit)',
    type: 'buff',
    duration: 10,
    modifiers: { resistance: ['fire', 'cold', 'poison', 'radiant'] },
  }],
} as unknown as CombatCharacter;

describe('ClassBattlefieldDemo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards native status state through both renderer modes and resets the view', () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <ClassBattlefieldDemo character={baselineCharacter} onReset={onReset} />,
    );

    expect(screen.getByTestId('wild-heart-2d-map')).toBeInTheDocument();
    expect(screen.getByTestId('mock-wild-heart-2d-renderer')).toHaveTextContent('Not raging');
    expect(screen.getByTestId('wild-heart-battlefield-renderer')).toHaveTextContent('2D');

    // The same roster is handed to the 3D renderer when the reviewer changes view.
    fireEvent.click(screen.getByRole('button', { name: '3D View' }));
    expect(screen.getByTestId('wild-heart-3d-map')).toBeInTheDocument();
    expect(screen.getByTestId('mock-wild-heart-3d-renderer')).toHaveTextContent('Not raging');

    // Parent-owned native Rage state remains visible after the renderer switch.
    rerender(<ClassBattlefieldDemo character={ragingCharacter} onReset={onReset} />);
    expect(screen.getByTestId('wild-heart-battlefield-state')).toHaveTextContent('Raging (Bear Spirit)');
    expect(screen.getByTestId('mock-wild-heart-3d-renderer')).toHaveTextContent('Raging (Bear Spirit)');

    // Reset is delegated to the parent transaction and returns the presentation to 2D.
    fireEvent.click(screen.getByRole('button', { name: 'Reset map state' }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByTestId('wild-heart-2d-map')).toBeInTheDocument();
  });
});
