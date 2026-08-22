import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ACTIVE_RACES } from '../../../../../data/races';
import type {
  PreviewCombatScenarioFrameworkProps,
  PreviewCombatScenarioRendererContext,
} from '../../PreviewCombatScenarioFramework';
import {
  createRaceFrameworkAdapter,
  createRaceScenarioBoard,
  raceFrameworkAdapterRegistry,
  resolveCanonicalRaceId,
} from '../raceFrameworkAdapter';
import { createRaceDomainRegistry } from '../raceDomainRegistry';
import type { RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file proves the Races adapter against the published framework contract.
 * It uses a tiny canonical fixture and renderer mocks so the test checks data
 * and slot ownership without loading every race leaf or claiming browser proof.
 * Called by: focused Vitest checks for the Races framework adapter.
 * Depends on: the public framework types and canonical race registry.
 */

// ============================================================================
// Deterministic Framework Fixture
// ============================================================================
// The fixture supplies opaque production-shaped props while the mocked shell
// exposes the adapter's composed slots for direct contract assertions.
// ============================================================================

const { twoDSpy, threeDSpy } = vi.hoisted(() => ({
  twoDSpy: vi.fn(),
  threeDSpy: vi.fn(),
}));

vi.mock('../../../../BattleMap/BattleMap', () => ({
  default: (props: PreviewCombatScenarioRendererContext) => {
    twoDSpy(props);
    return null;
  },
}));

vi.mock('../../../../BattleMap/BattleMap3D', () => ({
  default: (props: PreviewCombatScenarioRendererContext) => {
    threeDSpy(props);
    return null;
  },
}));

function createFrameworkProps(
  overrides: Partial<PreviewCombatScenarioFrameworkProps> = {},
): PreviewCombatScenarioFrameworkProps {
  // The combat engines are opaque to this adapter test; this narrow fixture
  // keeps the test deterministic while preserving the public prop names.
  const turnState = {
    currentTurn: 1,
    turnOrder: ['races-framework-hero', 'races-framework-target'],
    currentCharacterId: 'races-framework-hero',
    phase: 'action',
    actionsThisTurn: [],
  } as PreviewCombatScenarioFrameworkProps['combatState']['turnState'];
  const combatState = {
    turnManager: {
      skipToCharacter: vi.fn(),
    } as unknown as PreviewCombatScenarioFrameworkProps['combatState']['turnManager'],
    turnState,
    abilitySystem: {} as PreviewCombatScenarioFrameworkProps['combatState']['abilitySystem'],
    isCharacterTurn: () => false,
    onCharacterUpdate: vi.fn(),
  };
  return {
    domain: { domainId: 'host', domainLabel: 'Host' },
    scenario: { scenarioId: 'fixture', scenarioLabel: 'Fixture' },
    mapData: { dimensions: { width: 1, height: 1 }, tiles: [] } as PreviewCombatScenarioFrameworkProps['mapData'],
    characters: [{ id: 'actor-1' }] as PreviewCombatScenarioFrameworkProps['characters'],
    combatState,
    renderMode: '2d',
    onRenderModeChange: vi.fn(),
    onReset: vi.fn(),
    renderers: { twoD: twoDSpy, threeD: threeDSpy },
    sidebar: <div data-testid="host-sidebar">host sidebar</div>,
    liveState: <div data-testid="host-live">host live</div>,
    rightRail: {
      turn: <div data-testid="host-turn">turn</div>,
      actionEconomy: <div data-testid="host-action">action</div>,
      abilities: <div data-testid="host-abilities">abilities</div>,
      combatLog: <div data-testid="host-log">engine log</div>,
    },
    ...overrides,
  };
}

// ============================================================================
// Adapter Contract Proof
// ============================================================================
// These tests cover lookup identity, authored race boards, selection replacement,
// slot composition, and the host lifecycle handoff without mounting a second shell.
// ============================================================================

describe('Races framework adapter', () => {
  it('registers canonical Races identity and lookup', () => {
    expect(raceFrameworkAdapterRegistry.get('races', 'races')).toBeDefined();
    expect(raceFrameworkAdapterRegistry.adapters[0].domain).toEqual({ domainId: 'races', domainLabel: 'Races' });
    expect(raceFrameworkAdapterRegistry.adapters[0].scenario).toEqual({ scenarioId: 'races', scenarioLabel: 'Races' });
  });

  it('falls invalid selection back to the authored first canonical race', () => {
    const fixture = ACTIVE_RACES.slice(0, 2);
    const registry = createRaceDomainRegistry(fixture, []);
    expect(resolveCanonicalRaceId(registry, 'missing-race')).toBe(fixture[0].id);
    expect(resolveCanonicalRaceId(registry, fixture[1].id)).toBe(fixture[1].id);
  });

  it('builds distinct Rules-style boards and canonical actors for selected races', () => {
    const fixture = ACTIVE_RACES.slice(0, 2);
    const registry = createRaceDomainRegistry(fixture, []);
    const first = createRaceScenarioBoard(fixture[0].id, registry);
    const second = createRaceScenarioBoard(fixture[1].id, registry);

    // Both races use the full Rules map grammar while their stable seed and terrain
    // placement make selection visibly replace the board.
    [first, second].forEach(board => {
      expect(board.mapData.dimensions).toEqual({ width: 16, height: 12 });
      expect(board.mapData.theme).toBe('dungeon');
      expect(board.mapData.tiles.get('0-0')?.terrain).toBe('wall');
      expect([...board.mapData.tiles.values()].some(tile => tile.terrain === 'difficult')).toBe(true);
      expect([...board.mapData.tiles.values()].some(tile => tile.providesCover)).toBe(true);
      expect([...board.mapData.tiles.values()].some(tile => tile.elevation > 0)).toBe(true);
      expect(board.characters.map(character => character.id)).toEqual([
        'races-framework-hero',
        'races-framework-target',
      ]);
    });
    expect(first.mapData.seed).not.toBe(second.mapData.seed);
    expect(first.characters[0]?.name).toContain(fixture[0].id);
    expect(second.characters[0]?.name).toContain(fixture[1].id);
  });

  it('composes slots, forwards map/actors/combat state to both renderers, and preserves host lifecycle', () => {
    const onReset = vi.fn();
    const onModeChange = vi.fn();
    const onProof = vi.fn();
    const onRaceSelect = vi.fn();
    const fixture = ACTIVE_RACES.slice(0, 2);
    const { adapter } = createRaceFrameworkAdapter({
      registry: createRaceDomainRegistry(fixture, []),
      selectedRaceId: 'missing-race',
      onRaceSelect,
    });
    const view = render(adapter.render(createFrameworkProps({ onReset, onRenderModeChange: onModeChange, proof: { onStateChange: onProof } })));

    expect(screen.getByTestId('races-framework-selection')).toHaveTextContent(fixture[0].name);
    expect(screen.getByTestId('host-sidebar')).toBeInTheDocument();
    // The old host live node described one fixed human board. It is intentionally
    // excluded now because the adapter publishes the selected race and custom-board
    // actor count directly, avoiding a contradictory stale receipt after selection.
    expect(screen.queryByTestId('host-live')).not.toBeInTheDocument();
    expect(screen.getByTestId('races-right-rail-turn')).toBeInTheDocument();
    expect(screen.getByTestId('host-action')).toBeInTheDocument();
    expect(screen.getByTestId('host-abilities')).toBeInTheDocument();
    expect(screen.getByTestId('host-log')).toBeInTheDocument();
    expect(twoDSpy).toHaveBeenCalledWith(expect.objectContaining({ mapData: expect.anything(), characters: expect.any(Array), combatState: expect.any(Object) }));
    expect(screen.getByTestId('preview-combat-scenario-framework-state')).toHaveAttribute(
      'data-framework-domain',
      'races',
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Race under test' }), { target: { value: fixture[1].id } });
    expect(onRaceSelect).toHaveBeenCalledWith(fixture[1].id);
    expect(twoDSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      mapData: expect.objectContaining({ seed: createRaceScenarioBoard(fixture[1].id, createRaceDomainRegistry(fixture, [])).mapData.seed }),
      characters: expect.arrayContaining([expect.objectContaining({ id: 'races-framework-hero' })]),
    }));
    fireEvent.click(screen.getByRole('button', { name: /Reset Board/i }));
    fireEvent.click(screen.getByRole('button', { name: /3D View/i }));
    // The framework reports a controlled mode request; the host owns the state
    // update and feeds the new mode back before the 3D renderer mounts.
    view.rerender(adapter.render(createFrameworkProps({
      onReset,
      onRenderModeChange: onModeChange,
      proof: { onStateChange: onProof },
      renderMode: '3d',
    })));
    expect(threeDSpy).toHaveBeenCalledWith(expect.objectContaining({ mapData: expect.anything(), characters: expect.any(Array), combatState: expect.any(Object) }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith('3d');
    expect(onProof).toHaveBeenCalledWith(expect.objectContaining({
      domainId: 'races',
      scenarioId: 'fixture',
      renderMode: '2d',
      mapHydrated: true,
      actorCount: 2,
    }));
    expect(screen.getByTestId('preview-combat-scenario-framework-state')).toHaveAttribute(
      'data-render-mode',
      '3d',
    );
  });

  it('keeps race selection interactive inside the adapter when no host callback is supplied', () => {
    const fixture = ACTIVE_RACES.slice(0, 2);
    const { adapter } = createRaceFrameworkAdapter({ registry: createRaceDomainRegistry(fixture, []) });
    render(adapter.render(createFrameworkProps()));
    const selector = screen.getByRole('combobox', { name: 'Race under test' });
    expect(selector).toBeEnabled();
    fireEvent.change(selector, { target: { value: fixture[1].id } });
    expect(screen.getByTestId('races-framework-selection')).toHaveTextContent(fixture[1].name);
  });

  it('mounts a registered production mechanic leaf and records its exact event', () => {
    const fixture = ACTIVE_RACES.slice(0, 1);
    const registration: RaceDomainLeafRegistration = {
      id: 'focused-mechanic',
      raceId: fixture[0].id,
      label: 'Focused mechanic',
      description: 'Focused production transaction.',
      Component: ({ onScenarioEvent }) => (
        <button type="button" onClick={() => onScenarioEvent('Focused mechanic resolved')}>Resolve focused mechanic</button>
      ),
    };
    const { adapter } = createRaceFrameworkAdapter({
      registry: createRaceDomainRegistry(fixture, [registration]),
    });

    render(adapter.render(createFrameworkProps()));
    expect(screen.getByTestId('races-framework-leaves')).toHaveTextContent('Focused production transaction.');
    fireEvent.click(screen.getByRole('button', { name: 'Resolve focused mechanic' }));
    expect(screen.getByRole('list', { name: 'Race scenario event log' })).toHaveTextContent('Focused mechanic resolved');
  });
});
