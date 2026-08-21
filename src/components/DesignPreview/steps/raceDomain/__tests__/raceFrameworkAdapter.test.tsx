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
  raceFrameworkAdapterRegistry,
  resolveCanonicalRaceId,
} from '../raceFrameworkAdapter';
import { createRaceDomainRegistry } from '../raceDomainRegistry';

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

const twoDSpy = vi.fn(() => <div data-testid="mock-2d-map" />);
const threeDSpy = vi.fn(() => <div data-testid="mock-3d-map" />);
const frameworkSpy = vi.fn((props: PreviewCombatScenarioFrameworkProps) => (
  <div data-testid="mock-framework">
    {props.sidebar}
    {props.liveState}
    {props.rightRail.turn}
    {props.rightRail.actionEconomy}
    {props.rightRail.abilities}
    {props.rightRail.combatLog}
    <button type="button" onClick={props.onReset}>host reset</button>
    <button type="button" onClick={() => props.onRenderModeChange('3d')}>host 3d</button>
    <button type="button" onClick={() => props.proof?.onStateChange?.({
      domainId: props.domain.domainId,
      scenarioId: props.scenario.scenarioId,
      renderMode: props.renderMode,
      mapHydrated: props.mapData !== null,
      actorCount: props.characters.length,
    })}>host proof</button>
    {props.renderers.twoD({
      domain: props.domain,
      scenario: props.scenario,
      mapData: props.mapData,
      characters: props.characters,
      combatState: props.combatState,
      mode: '2d',
      cameraLifecycle: {},
    })}
    {props.renderers.threeD({
      domain: props.domain,
      scenario: props.scenario,
      mapData: props.mapData,
      characters: props.characters,
      combatState: props.combatState,
      mode: '3d',
      cameraLifecycle: {},
    })}
  </div>
));

vi.mock('../../PreviewCombatScenarioFramework', async () => {
  const actual = await vi.importActual<typeof import('../../PreviewCombatScenarioFramework')>(
    '../../PreviewCombatScenarioFramework',
  );
  return {
    ...actual,
    PreviewCombatScenarioFramework: frameworkSpy,
  };
});

vi.mock('../../../../BattleMap/BattleMap', () => ({
  default: (props: PreviewCombatScenarioRendererContext) => {
    twoDSpy(props);
    return <div data-testid="battle-map-2d" />;
  },
}));

vi.mock('../../../../BattleMap/BattleMap3D', () => ({
  default: (props: PreviewCombatScenarioRendererContext) => {
    threeDSpy(props);
    return <div data-testid="battle-map-3d" />;
  },
}));

function createFrameworkProps(
  overrides: Partial<PreviewCombatScenarioFrameworkProps> = {},
): PreviewCombatScenarioFrameworkProps {
  // The combat engines are opaque to this adapter test; this narrow fixture
  // keeps the test deterministic while preserving the public prop names.
  const combatState = {
    turnManager: {} as PreviewCombatScenarioFrameworkProps['combatState']['turnManager'],
    turnState: {} as PreviewCombatScenarioFrameworkProps['combatState']['turnState'],
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
// These tests cover lookup identity, selection fallback, renderer forwarding,
// slot composition, and the host lifecycle handoff without mounting a second
// framework shell or creating an adapter-owned map.
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
    render(adapter.render(createFrameworkProps({ onReset, onRenderModeChange: onModeChange, proof: { onStateChange: onProof } })));

    expect(screen.getByTestId('races-framework-selection')).toHaveTextContent(fixture[0].name);
    expect(screen.getByTestId('host-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('host-live')).toBeInTheDocument();
    expect(screen.getByTestId('host-turn')).toBeInTheDocument();
    expect(screen.getByTestId('host-action')).toBeInTheDocument();
    expect(screen.getByTestId('host-abilities')).toBeInTheDocument();
    expect(screen.getByTestId('host-log')).toBeInTheDocument();
    expect(twoDSpy).toHaveBeenCalledWith(expect.objectContaining({ mapData: expect.anything(), characters: expect.any(Array), combatState: expect.any(Object) }));
    expect(threeDSpy).toHaveBeenCalledWith(expect.objectContaining({ mapData: expect.anything(), characters: expect.any(Array), combatState: expect.any(Object) }));
    expect(screen.getByTestId('mock-framework')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-combat-scenario-framework')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Race' }), { target: { value: fixture[1].id } });
    expect(onRaceSelect).toHaveBeenCalledWith(fixture[1].id);
    fireEvent.click(screen.getByRole('button', { name: 'host reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'host 3d' }));
    fireEvent.click(screen.getByRole('button', { name: 'host proof' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith('3d');
    expect(onProof).toHaveBeenCalled();
  });

  it('makes the missing framework race-change boundary visible instead of mutating host state', () => {
    const { adapter } = createRaceFrameworkAdapter({ registry: createRaceDomainRegistry(ACTIVE_RACES.slice(0, 1), []) });
    render(adapter.render(createFrameworkProps()));
    expect(screen.getByTestId('races-framework-selection-boundary')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Race' })).toBeDisabled();
  });
});
