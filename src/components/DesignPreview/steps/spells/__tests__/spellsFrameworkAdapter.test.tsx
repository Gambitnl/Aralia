import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombatCharacter, TurnState } from '../../../../../types/combat';
import type {
  PreviewCombatScenarioCombatState,
  PreviewCombatScenarioFrameworkProps,
  PreviewCombatScenarioRenderMode,
} from '../../PreviewCombatScenarioFramework';
import {
  SPELLS_SCENARIO_IDS,
  createSpellsScenarioBoard,
  spellsScenarioAdapterRegistry,
} from '..';

/**
 * This test mounts the Spells adapter through the published framework contract.
 * It proves all four canonical selections, production board hydration, renderer
 * context handoff, lifecycle ordering, injected scenario content, right-rail
 * slots, and the framework proof node without requiring WebGL or a browser capture.
 *
 * The native map and panel components are replaced only with observable probes below;
 * the adapter itself still imports and renders those native components in production.
 */

// ============================================================================
// Native renderer probes
// ============================================================================
// These probes make the shared combat state and hydrated board visible to Vitest while
// keeping canvas/WebGL outside this focused adapter contract test.
vi.mock('../../../../BattleMap/BattleMap', () => ({
  default: ({ mapData, characters, combatState }: {
    mapData: { dimensions: { width: number; height: number }; seed?: number } | null;
    characters: CombatCharacter[];
    combatState: PreviewCombatScenarioCombatState;
  }) => (
    <div data-testid="spells-2d-renderer" data-map-hydrated={String(Boolean(mapData))} data-map-seed={mapData?.seed ?? 'none'} data-actor-count={characters.length} data-turn-owner={combatState.turnState.currentCharacterId ?? 'none'}>
      2D renderer
    </div>
  ),
}));

vi.mock('../../../../BattleMap/BattleMap3D', () => ({
  default: ({ mapData, characters, combatState }: {
    mapData: { dimensions: { width: number; height: number }; seed?: number } | null;
    characters: CombatCharacter[];
    combatState: PreviewCombatScenarioCombatState;
  }) => (
    <div data-testid="spells-3d-renderer" data-map-hydrated={String(Boolean(mapData))} data-map-seed={mapData?.seed ?? 'none'} data-actor-count={characters.length} data-turn-owner={combatState.turnState.currentCharacterId ?? 'none'}>
      3D renderer
    </div>
  ),
}));

// ============================================================================
// Framework host fixture
// ============================================================================
// The board comes from the adapter's production factory. Only hook-shaped callbacks are
// test plumbing, which keeps this test focused on the adapter/framework boundary.
function createCombatStateFixture(characters: CombatCharacter[]): PreviewCombatScenarioCombatState {
  const turnState: TurnState = {
    currentTurn: 1,
    turnOrder: characters.map(character => character.id),
    currentCharacterId: characters[0]?.id ?? null,
    phase: 'action',
    actionsThisTurn: [],
  };
  const turnManager = {
    turnState,
    skipToCharacter: vi.fn(),
    executeAction: vi.fn(() => true),
    canAffordAction: vi.fn(() => true),
    endTurn: vi.fn(),
  } as unknown as PreviewCombatScenarioCombatState['turnManager'];
  const abilitySystem = { startTargeting: vi.fn() } as unknown as PreviewCombatScenarioCombatState['abilitySystem'];

  return {
    turnManager,
    turnState,
    abilitySystem,
    isCharacterTurn: vi.fn(() => true),
    onCharacterUpdate: vi.fn(),
  };
}

function renderSpellsAdapter() {
  const board = createSpellsScenarioBoard();
  const combatState = createCombatStateFixture(board.characters);
  const adapter = spellsScenarioAdapterRegistry.get('spells', 'fire-bolt');
  if (!adapter) throw new Error('The canonical Fire Bolt Spells adapter was not registered.');

  const events: string[] = [];
  const resetHandler = vi.fn(() => events.push('host-reset'));
  const cameraResetHandler = vi.fn(() => events.push('camera-reset'));
  const cameraModeHandler = vi.fn((mode: PreviewCombatScenarioRenderMode) => events.push(`camera-mode:${mode}`));

  const Harness: React.FC = () => {
    const [renderMode, setRenderMode] = useState<PreviewCombatScenarioRenderMode>('2d');
    const props: PreviewCombatScenarioFrameworkProps = {
      domain: { domainId: 'spells', domainLabel: 'Spells' },
      scenario: { scenarioId: 'fire-bolt', scenarioLabel: 'Fire Bolt' },
      mapData: board.mapData,
      characters: board.characters,
      combatState,
      renderMode,
      onRenderModeChange: mode => setRenderMode(mode),
      onReset: resetHandler,
      renderers: { twoD: () => null, threeD: () => null },
      sidebar: null,
      rightRail: { turn: null, abilities: null, combatLog: null },
      cameraLifecycle: { onReset: cameraResetHandler, onModeChange: cameraModeHandler },
      proof: { testId: 'spells-framework-proof' },
    };
    return <>{adapter.render(props)}</>;
  };

  render(<Harness />);
  return { board, events, resetHandler, cameraResetHandler };
}

// ============================================================================
// Adapter contract proof
// ============================================================================
describe('Spells framework adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });

  it('registers exactly the four canonical spell entries and hydrates a production board', () => {
    const board = createSpellsScenarioBoard();
    expect(spellsScenarioAdapterRegistry.adapters).toHaveLength(4);
    expect(spellsScenarioAdapterRegistry.adapters.map(adapter => adapter.scenario.scenarioId)).toEqual([...SPELLS_SCENARIO_IDS]);
    expect(board.mapData.dimensions.width).toBeGreaterThan(0);
    expect(board.characters).toHaveLength(2);
    expect(board.characters.every(character => character.id && character.position)).toBe(true);
  });

  it('authors a distinct Rules-style tactical setup for every spell', () => {
    const boards = SPELLS_SCENARIO_IDS.map(id => ({ id, board: createSpellsScenarioBoard(id) }));

    // Every board uses the same production map grammar as Rules: a bounded dungeon,
    // deliberate cover, difficult ground, elevation, and stable canonical actor IDs.
    boards.forEach(({ board }) => {
      expect(board.mapData.dimensions).toEqual({ width: 16, height: 12 });
      expect(board.mapData.theme).toBe('dungeon');
      expect(board.mapData.tiles.get('0-0')?.terrain).toBe('wall');
      expect([...board.mapData.tiles.values()].some(tile => tile.terrain === 'difficult')).toBe(true);
      expect([...board.mapData.tiles.values()].some(tile => tile.providesCover)).toBe(true);
      expect([...board.mapData.tiles.values()].some(tile => tile.elevation > 0)).toBe(true);
      expect(board.characters.map(character => character.id)).toEqual([
        'spells-preview-caster',
        'spells-training-target',
      ]);
    });
    expect(new Set(boards.map(({ board }) => board.mapData.seed)).size).toBe(SPELLS_SCENARIO_IDS.length);

    // The spell-specific actor facts are part of the authored test setup rather than
    // decorative labels: Thunderwave is adjacent and Cure Wounds has a wounded ally.
    const thunderwave = createSpellsScenarioBoard('thunderwave');
    expect(thunderwave.characters[0]?.position).toEqual({ x: 6, y: 5 });
    expect(thunderwave.characters[1]?.position).toEqual({ x: 7, y: 5 });
    const cureWounds = createSpellsScenarioBoard('cure-wounds');
    expect(cureWounds.characters[1]?.team).toBe('player');
    expect(cureWounds.characters[1]?.currentHP).toBeLessThan(cureWounds.characters[1]?.maxHP ?? 0);
  });

  it('shows selector, mechanics, live state, right rail, native 2D/3D slots, reset ordering, and proof', () => {
    const { events, resetHandler, cameraResetHandler } = renderSpellsAdapter();
    const proof = screen.getByTestId('spells-framework-proof');
    expect(proof).toHaveAttribute('data-framework-domain', 'spells');
    expect(proof).toHaveAttribute('data-scenario-id', 'fire-bolt');
    expect(proof).toHaveAttribute('data-render-mode', '2d');
    expect(proof).toHaveAttribute('data-map-hydrated', 'true');
    expect(proof).toHaveAttribute('data-actor-count', '2');
    expect(screen.getByTestId('spells-2d-renderer')).toHaveAttribute('data-map-seed', '4101');
    expect(screen.getByTestId('spells-tactical-sandbox-sidebar')).toHaveTextContent('Tactical Sandbox');
    expect(screen.getByTestId('spells-selected-mechanics')).toHaveTextContent('attack roll');
    expect(screen.getByTestId('spells-right-rail-turn')).toBeInTheDocument();
    expect(screen.getByTestId('spells-right-rail-actions')).toBeInTheDocument();
    expect(screen.getByTestId('spells-right-rail-abilities')).toBeInTheDocument();
    expect(screen.getByTestId('spells-right-rail-log')).toBeInTheDocument();

    const selector = within(screen.getByRole('list', { name: 'Available spells' }));
    expect(selector.getAllByRole('button')).toHaveLength(4);
    fireEvent.click(selector.getByRole('button', { name: /Thunderwave/ }));
    expect(proof).toHaveAttribute('data-scenario-id', 'thunderwave');
    expect(screen.getByTestId('spells-2d-renderer')).toHaveAttribute('data-map-seed', '4102');
    expect(screen.getByTestId('spells-selected-scenario-content')).toHaveTextContent('Thunderwave');
    fireEvent.click(selector.getByRole('button', { name: /Cure Wounds/ }));
    expect(screen.getByRole('heading', { name: 'Cure Wounds' })).toBeInTheDocument();
    fireEvent.click(selector.getByRole('button', { name: /Shield/ }));
    expect(screen.getByRole('heading', { name: 'Shield' })).toBeInTheDocument();
    expect(screen.getByTestId('spells-2d-renderer')).toHaveAttribute('data-map-seed', '4104');
    expect(screen.getByTestId('spells-adapter-selection-receipt')).toHaveTextContent('Sight Cone On');

    fireEvent.click(screen.getByTestId('preview-combat-scenario-render-mode-toggle'));
    expect(screen.getByTestId('spells-3d-renderer')).toBeInTheDocument();
    expect(proof).toHaveAttribute('data-render-mode', '3d');
    fireEvent.click(screen.getByRole('button', { name: /Reset Board/ }));
    expect(proof).toHaveAttribute('data-scenario-id', 'fire-bolt');
    expect(proof).toHaveAttribute('data-render-mode', '2d');
    expect(screen.getByTestId('spells-2d-renderer')).toHaveAttribute('data-map-seed', '4101');
    expect(resetHandler).toHaveBeenCalledTimes(1);
    expect(cameraResetHandler).toHaveBeenCalledTimes(1);
    expect(events.indexOf('camera-reset')).toBeLessThan(events.indexOf('host-reset'));
  });
});
