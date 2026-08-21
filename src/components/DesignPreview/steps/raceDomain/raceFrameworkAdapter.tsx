import React from 'react';
import BattleMap from '../../../BattleMap/BattleMap';
import BattleMap3D from '../../../BattleMap/BattleMap3D';
import {
  PreviewCombatScenarioFramework,
  createPreviewCombatScenarioAdapterRegistry,
  definePreviewCombatScenarioAdapter,
} from '../PreviewCombatScenarioFramework';
import type {
  PreviewCombatScenarioAdapter,
  PreviewCombatScenarioFrameworkProps,
} from '../PreviewCombatScenarioFramework';
import { raceDomainRegistry } from './raceDomainRegistry';
import type { RaceDomainRegistry } from './raceDomainTypes';

/**
 * This file adapts the canonical Race roster to the shared tactical preview
 * framework. It gives the Races tab its selector and proof labels while the
 * framework remains the only owner of the mounted shell, map, reset lifecycle,
 * render-mode lifecycle, and host-provided combat slots.
 * Called by: the Races integration and focused adapter tests.
 * Depends on: the public preview framework contract, ACTIVE_RACES registry,
 * and the production BattleMap and BattleMap3D renderers.
 */

// ============================================================================
// Controlled Race Selection Contract
// ============================================================================
// The framework currently supplies no race-change callback. This small adapter
// seam lets a future host provide one explicitly without pretending that a
// selector changed combat state when the host has not accepted the change.
// ============================================================================

export interface RaceFrameworkAdapterOptions {
  registry?: RaceDomainRegistry;
  selectedRaceId?: string | null;
  onRaceSelect?: (raceId: string) => void;
}

export interface RaceFrameworkAdapterSurfaceProps extends RaceFrameworkAdapterOptions {
  frameworkProps: PreviewCombatScenarioFrameworkProps;
}

export interface RaceFrameworkAdapterRegistration {
  adapter: PreviewCombatScenarioAdapter;
  registry: ReturnType<typeof createPreviewCombatScenarioAdapterRegistry>;
}

// ============================================================================
// Canonical Selection Helpers
// ============================================================================
// Every selector value is resolved against the same registry used to render
// the options. Invalid or absent values therefore land on the authored first
// Race instead of producing a fabricated selection or an empty fake scenario.
// ============================================================================

export function resolveCanonicalRaceId(
  registry: RaceDomainRegistry,
  requestedRaceId?: string | null,
): string | null {
  // The first canonical entry is the deterministic authored fallback.
  const fallbackRaceId = registry.races[0]?.id ?? null;
  return requestedRaceId && registry.getRaceById(requestedRaceId)
    ? requestedRaceId
    : fallbackRaceId;
}

// ============================================================================
// Race Framework Surface
// ============================================================================
// This component creates content for the shared framework slots only. It does
// not create another shell or map wrapper, and it forwards the host's incoming
// combat nodes unchanged so action, turn, ability, and engine-log truth remain
// owned by the existing combat host.
// ============================================================================

export const RaceFrameworkAdapterSurface: React.FC<RaceFrameworkAdapterSurfaceProps> = ({
  frameworkProps,
  registry = raceDomainRegistry,
  selectedRaceId,
  onRaceSelect,
}) => {
  // Resolve selection from canonical data before rendering labels or options.
  const resolvedRaceId = resolveCanonicalRaceId(registry, selectedRaceId);
  const selectedRace = resolvedRaceId ? registry.getRaceById(resolvedRaceId) : undefined;

  // Make the selector callback explicit. Without a host callback this is a
  // read-only projection; it cannot secretly mutate the framework's state.
  const handleRaceSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRaceId = resolveCanonicalRaceId(registry, event.target.value);
    if (nextRaceId) {
      onRaceSelect?.(nextRaceId);
    }
  };

  // Race content is prepended to the existing sidebar so the host's controls
  // remain present and ordered after the domain selector.
  const sidebar = (
    <>
      <section aria-labelledby="races-framework-title" data-testid="races-framework-sidebar">
        <p className="text-[10px] uppercase tracking-wider text-amber-300">Races</p>
        <h2 id="races-framework-title">Race framework adapter</h2>
        <p>Canonical race selection and framework-owned combat proof.</p>
        <label htmlFor="races-framework-selector">Race</label>
        <select
          id="races-framework-selector"
          aria-describedby="races-framework-selection-state"
          value={resolvedRaceId ?? ''}
          onChange={handleRaceSelect}
          disabled={!onRaceSelect}
        >
          {registry.races.map(race => (
            <option key={race.id} value={race.id}>{race.name}</option>
          ))}
        </select>
        <p id="races-framework-selection-state" data-testid="races-framework-selection">
          Selected Race: {selectedRace?.name ?? 'No canonical race'}
        </p>
        {!onRaceSelect && (
          // DEBT: The published framework has no race-change callback. The
          // selector is intentionally read-only until a host supplies one.
          <p data-testid="races-framework-selection-boundary">
            Selection callback unavailable; showing canonical selection only.
          </p>
        )}
      </section>
      {frameworkProps.sidebar}
    </>
  );

  // This projection labels race state without presenting it as the engine's
  // combat log. The incoming live-state slot remains visible below it.
  const liveState = (
    <>
      <section aria-label="Race framework live state" data-testid="races-framework-live-state">
        <span>Race: {selectedRace?.name ?? 'No canonical race'}</span>
        <span>Selection is a content projection, not an engine combat log.</span>
      </section>
      {frameworkProps.liveState}
    </>
  );

  // Renderers consume the framework's exact context, including canonical map,
  // actors, and combat state. The adapter does not build a second map or shell.
  const renderers = {
    twoD: (context: Parameters<NonNullable<PreviewCombatScenarioFrameworkProps['renderers']['twoD']>>[0]) => (
      <BattleMap
        mapData={context.mapData}
        characters={context.characters}
        combatState={context.combatState}
      />
    ),
    threeD: (context: Parameters<NonNullable<PreviewCombatScenarioFrameworkProps['renderers']['threeD']>>[0]) => (
      <BattleMap3D
        mapData={context.mapData}
        characters={context.characters}
        combatState={context.combatState}
      />
    ),
  };

  return (
    <PreviewCombatScenarioFramework
      {...frameworkProps}
      domain={{ domainId: 'races', domainLabel: 'Races' }}
      sidebar={sidebar}
      liveState={liveState}
      renderers={renderers}
      rightRail={{
        turn: frameworkProps.rightRail.turn,
        actionEconomy: frameworkProps.rightRail.actionEconomy,
        abilities: frameworkProps.rightRail.abilities,
        combatLog: frameworkProps.rightRail.combatLog,
      }}
    />
  );
};

// ============================================================================
// Public Races Adapter And Registry
// ============================================================================
// The factory keeps the public adapter lookup typed and deterministic. Its
// scenario is content-only; reset, mode changes, and proof continue through
// the framework props supplied by the mounted host.
// ============================================================================

export function createRaceFrameworkAdapter(
  options: RaceFrameworkAdapterOptions = {},
): RaceFrameworkAdapterRegistration {
  // Capture only the explicit selection seam and registry; framework state is
  // still received at render time and passed through to the shared shell.
  const adapter = definePreviewCombatScenarioAdapter({
    domain: { domainId: 'races', domainLabel: 'Races' },
    scenario: { scenarioId: 'races', scenarioLabel: 'Races' },
    render: frameworkProps => (
      <RaceFrameworkAdapterSurface
        frameworkProps={frameworkProps}
        registry={options.registry ?? raceDomainRegistry}
        selectedRaceId={options.selectedRaceId}
        onRaceSelect={options.onRaceSelect}
      />
    ),
  });

  // Keep a one-adapter registry so callers can use the same public lookup
  // contract as the shared host without importing local implementation files.
  return {
    adapter,
    registry: createPreviewCombatScenarioAdapterRegistry([adapter]),
  };
}

export const raceFrameworkAdapterRegistration = createRaceFrameworkAdapter();
export const raceFrameworkAdapter = raceFrameworkAdapterRegistration.adapter;
export const raceFrameworkAdapterRegistry = raceFrameworkAdapterRegistration.registry;

export default raceFrameworkAdapter;
