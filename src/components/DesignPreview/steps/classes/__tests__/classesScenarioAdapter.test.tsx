import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombatCharacter, TurnState } from '../../../../../types/combat';
import { SUBCLASSES } from '../../../../../data/classes/subclasses';
import type {
  PreviewCombatScenarioCombatState,
  PreviewCombatScenarioFrameworkProps,
  PreviewCombatScenarioRenderMode,
} from '../../PreviewCombatScenarioFramework';
import {
  CLASSES_SCENARIO_IDS,
  classesScenarioAdapterRegistry,
  createClassesScenarioBoard,
  getCanonicalClassSelectors,
} from '..';

/**
 * This test mounts the Classes adapter through the published framework contract.
 * It exists to prove the canonical selector-to-identity bridge, authored class boards,
 * renderer handoff, Reset lifecycle, and native right-rail slots without changing Rules.
 * The map components are replaced with small observable render probes because WebGL and
 * canvas layout are outside this contract test; a browser capture remains a separate gate.
 */

// ============================================================================
// Renderer probes
// ============================================================================
// These probes expose the typed renderer context in the DOM so the test can prove that
// 2D and 3D receive the same host combat state and canonical actor roster.
vi.mock('../../../../BattleMap/BattleMap', () => ({
  default: ({
    mapData,
    characters,
    combatState,
  }: {
    mapData: { dimensions: { width: number; height: number }; seed?: number } | null;
    characters: CombatCharacter[];
    combatState: PreviewCombatScenarioCombatState;
  }) => (
    <div
      data-testid="classes-2d-renderer"
      data-map-size={mapData ? `${mapData.dimensions.width}x${mapData.dimensions.height}` : 'none'}
      data-map-seed={mapData?.seed ?? 'none'}
      data-actor-count={characters.length}
      data-turn-owner={combatState.turnState.currentCharacterId ?? 'none'}
    >
      2D renderer
    </div>
  ),
}));

vi.mock('../../../../BattleMap/BattleMap3D', () => ({
  default: ({
    mapData,
    characters,
    combatState,
  }: {
    mapData: { dimensions: { width: number; height: number }; seed?: number } | null;
    characters: CombatCharacter[];
    combatState: PreviewCombatScenarioCombatState;
  }) => (
    <div
      data-testid="classes-3d-renderer"
      data-map-size={mapData ? `${mapData.dimensions.width}x${mapData.dimensions.height}` : 'none'}
      data-map-seed={mapData?.seed ?? 'none'}
      data-actor-count={characters.length}
      data-turn-owner={combatState.turnState.currentCharacterId ?? 'none'}
    >
      3D renderer
    </div>
  ),
}));

// ============================================================================
// Deterministic host fixture
// ============================================================================
// The fixture uses the adapter's production board factory. Only the framework callbacks
// and hook-shaped combat object are local test plumbing; no actor, map, or combat state is
// fabricated in the adapter package itself.
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
    isCharacterTurn: vi.fn(() => true),
  } as unknown as PreviewCombatScenarioCombatState['turnManager'];
  const abilitySystem = {
    startTargeting: vi.fn(),
  } as unknown as PreviewCombatScenarioCombatState['abilitySystem'];

  return {
    turnManager,
    turnState,
    abilitySystem,
    isCharacterTurn: vi.fn(() => true),
    onCharacterUpdate: vi.fn(),
  };
}

interface HarnessState {
  modeChanges: PreviewCombatScenarioRenderMode[];
  resetCount: number;
  cameraResetCount: number;
}

function renderClassesAdapter(): HarnessState {
  const board = createClassesScenarioBoard('barbarian');
  const combatState = createCombatStateFixture(board.characters);
  const adapter = classesScenarioAdapterRegistry.get('classes', 'barbarian');

  if (!adapter) {
    throw new Error('The canonical Barbarian Classes adapter was not registered.');
  }

  const resetHandler = vi.fn();
  const cameraResetHandler = vi.fn();
  const state: HarnessState = {
    modeChanges: [],
    get resetCount() {
      return resetHandler.mock.calls.length;
    },
    get cameraResetCount() {
      return cameraResetHandler.mock.calls.length;
    },
  };

  const Harness: React.FC = () => {
    const [renderMode, setRenderMode] = useState<PreviewCombatScenarioRenderMode>('2d');
    const props: PreviewCombatScenarioFrameworkProps = {
      domain: { domainId: 'classes', domainLabel: 'Classes' },
      scenario: { scenarioId: 'barbarian', scenarioLabel: 'Barbarian' },
      mapData: board.mapData,
      characters: board.characters,
      combatState,
      renderMode,
      onRenderModeChange: mode => {
        state.modeChanges.push(mode);
        setRenderMode(mode);
      },
      onReset: () => {
        resetHandler();
      },
      renderers: {
        twoD: () => null,
        threeD: () => null,
      },
      sidebar: null,
      rightRail: { turn: null, abilities: null, combatLog: null },
      cameraLifecycle: {
        onReset: () => {
          cameraResetHandler();
        },
      },
      proof: { testId: 'classes-framework-proof' },
    };

    return <>{adapter.render(props)}</>;
  };

  render(<Harness />);
  return state;
}

// ============================================================================
// Contract proof
// ============================================================================
describe('Classes scenario adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('registers all canonical classes and preserves every nested subclass row', () => {
    const canonical = getCanonicalClassSelectors();
    const registered = classesScenarioAdapterRegistry.adapters;

    expect(registered).toHaveLength(13);
    expect(registered.map(adapter => adapter.scenario.scenarioId)).toEqual([...CLASSES_SCENARIO_IDS]);
    expect(canonical).toHaveLength(13);

    for (const classData of canonical) {
      const adapter = classesScenarioAdapterRegistry.get('classes', classData.id);
      expect(adapter?.domain.domainId).toBe('classes');
      expect(adapter?.scenario.scenarioLabel).toBe(classData.name);
      expect(classData.subclasses.map(subclass => subclass.id)).toEqual(
        Object.values(SUBCLASSES)
          .flat()
          .filter(subclass => subclass.classId === classData.id)
          .map(subclass => subclass.id),
      );
    }
  });

  it('builds a custom Rules-shaped board for every class while preserving stable actor identities', () => {
    const boards = CLASSES_SCENARIO_IDS.map(classId => createClassesScenarioBoard(classId));

    // Every class receives an authored dungeon fixture with walls, difficult
    // ground, cover, and elevation instead of the old procedural forest.
    for (const board of boards) {
      const tiles = Array.from(board.mapData.tiles.values());
      expect(board.mapData.dimensions).toEqual({ width: 16, height: 12 });
      expect(board.mapData.theme).toBe('dungeon');
      expect(tiles.some(tile => tile.terrain === 'wall' && tile.blocksLoS)).toBe(true);
      expect(tiles.some(tile => tile.terrain === 'difficult' && tile.movementCost === 10)).toBe(true);
      expect(tiles.some(tile => tile.providesCover)).toBe(true);
      expect(tiles.some(tile => tile.elevation === 5)).toBe(true);
      expect(board.characters.map(character => character.id)).toEqual([
        'classes-preview-hero',
        'classes-training-target',
      ]);
    }

    // Distinct authored seeds prove selection changes the scenario board rather
    // than relabeling one shared generic map.
    expect(new Set(boards.map(board => board.mapData.seed)).size).toBe(CLASSES_SCENARIO_IDS.length);
  });

  it('keeps selection, framework proof, production board props, render handoff, Reset, and slots aligned', () => {
    const state = renderClassesAdapter();
    const proof = screen.getByTestId('classes-framework-proof');

    expect(proof).toHaveAttribute('data-framework-domain', 'classes');
    expect(proof).toHaveAttribute('data-scenario-id', 'barbarian');
    expect(proof).toHaveAttribute('data-render-mode', '2d');
    expect(proof).toHaveAttribute('data-map-hydrated', 'true');
    expect(proof).toHaveAttribute('data-actor-count', '2');
    expect(screen.getByTestId('classes-2d-renderer')).toHaveAttribute('data-actor-count', '2');
    expect(screen.getByTestId('classes-2d-renderer')).toHaveAttribute('data-turn-owner');
    expect(screen.getByTestId('classes-2d-renderer')).toHaveAttribute('data-map-seed', '3102');
    expect(screen.getByTestId('classes-tactical-sandbox-sidebar')).toHaveTextContent('Tactical Sandbox');
    expect(screen.getByTestId('classes-selected-subclass-mechanics')).toHaveTextContent('Path of the Berserker');
    expect(screen.getByTestId('berserker-progression-demo')).toBeInTheDocument();
    expect(screen.getByTestId('classes-right-rail-turn')).toBeInTheDocument();
    expect(screen.getByTestId('classes-right-rail-actions')).toBeInTheDocument();
    expect(screen.getByTestId('classes-right-rail-abilities')).toBeInTheDocument();
    expect(screen.getByTestId('classes-right-rail-log')).toBeInTheDocument();

    const classTabs = within(screen.getByRole('tablist', { name: 'Classes' })).getAllByRole('tab');
    expect(classTabs).toHaveLength(13);

    fireEvent.click(screen.getByRole('tab', { name: 'Bard' }));
    expect(proof).toHaveAttribute('data-scenario-id', 'bard');
    expect(screen.getByTestId('classes-2d-renderer')).toHaveAttribute('data-map-seed', '3103');
    expect(screen.getByRole('heading', { name: /Bard · College of Lore/i })).toBeInTheDocument();
    expect(screen.getByTestId('college-of-lore-progression-demo')).toBeInTheDocument();
    expect(screen.getByTestId('classes-adapter-selection-receipt')).toHaveTextContent('Sight Cone On');

    fireEvent.click(screen.getByTestId('preview-combat-scenario-render-mode-toggle'));
    expect(screen.getByTestId('classes-3d-renderer')).toBeInTheDocument();
    expect(proof).toHaveAttribute('data-render-mode', '3d');
    fireEvent.click(screen.getByTestId('preview-combat-scenario-render-mode-toggle'));
    expect(screen.getByTestId('classes-2d-renderer')).toBeInTheDocument();
    expect(state.modeChanges).toEqual(['3d', '2d']);

    fireEvent.click(screen.getByRole('button', { name: /Reset Board/ }));
    expect(proof).toHaveAttribute('data-scenario-id', 'fighter');
    expect(proof).toHaveAttribute('data-render-mode', '2d');
    expect(screen.getByTestId('classes-2d-renderer')).toHaveAttribute('data-map-seed', '3101');
    expect(screen.getByRole('heading', { name: /Fighter · Champion/i })).toBeInTheDocument();
    expect(screen.getByTestId('champion-improved-critical-demo')).toBeInTheDocument();
    expect(state.resetCount).toBe(1);
    expect(state.cameraResetCount).toBe(1);
  });
});
