// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 11:01:59
 * Dependents: components/DesignPreview/steps/raceDomain/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import { ACTIVE_RACES } from '../../../../data/races';
import { Button } from '../../../ui/Button';
import type {
  RaceDomainLeafRegistration,
  RaceDomainScenarioState,
  RaceDomainShellProps,
} from './raceDomainTypes';
import {
  createRaceDomainScenarioState,
} from './raceDomainTypes';
import { createRaceDomainRegistry } from './raceDomainRegistry';

/**
 * This component is the accessible Tactical Sandbox Race domain shell.
 *
 * It renders the canonical ACTIVE_RACES roster, exposes a deterministic Race
 * selector and Reset action, and mounts only explicitly registered leaves. The
 * shell reports selection events but never claims that selection applied a
 * race mechanic; future leaves must connect real production behavior.
 * Called by: the Rules orchestrator through RACE_DOMAIN_INTEGRATION.
 * Depends on: ACTIVE_RACES, the Race registry, and the leaf state contract.
 */

// ============================================================================
// Event And State Helpers
// ============================================================================
// These helpers keep state transitions visible and repeatable. Every event is
// retained in the small log shown to the tester, which gives later leaf work a
// stable place to publish real resolver or command outcomes.
// ============================================================================

function appendScenarioEvent(
  state: RaceDomainScenarioState,
  message: string,
): RaceDomainScenarioState {
  // Keep the most recent eight messages so a long playtest remains readable.
  const eventLog = [...state.eventLog, message].slice(-8);
  return createRaceDomainScenarioState(state.selectedRaceId, state.resetCount, eventLog);
}

// ============================================================================
// Accessible Race Domain Shell
// ============================================================================
// The select element is intentionally native and labelled. It provides
// keyboard access and a reliable semantic locator for both humans and focused
// tests without changing the existing Tactical Sandbox host mechanics.
// ============================================================================

export const RaceDomainShell: React.FC<RaceDomainShellProps> = ({
  initialSelectedRaceId,
  registry: suppliedRegistry,
  races = ACTIVE_RACES,
  registrations,
  onStateChange,
}) => {
  // Build a registry only when the orchestrator has not supplied one. The
  // default path discovers leaves from the dedicated leaves/ directory while
  // tests can inject a small canonical fixture or precomposed leaf set.
  const registry = useMemo(
    () => suppliedRegistry ?? createRaceDomainRegistry(races, registrations),
    [races, registrations, suppliedRegistry],
  );

  // Choose the first canonical race as the deterministic baseline unless the
  // integration explicitly requests another valid selection.
  const defaultRaceId = registry.races[0]?.id ?? null;
  const startingRaceId = (
    initialSelectedRaceId && registry.getRaceById(initialSelectedRaceId)
      ? initialSelectedRaceId
      : defaultRaceId
  );
  const [state, setState] = useState<RaceDomainScenarioState>(() => (
    createRaceDomainScenarioState(startingRaceId)
  ));

  // Publish a complete immutable snapshot to the host and to future leaves.
  const publishState = (nextState: RaceDomainScenarioState) => {
    setState(nextState);
    onStateChange?.(nextState);
  };

  // A selection is a real state seam only. No race ability, speed, vision, or
  // other mechanic is applied here because those facts belong to production
  // character/combat systems and a registered leaf's explicit transaction.
  const handleRaceSelect = (raceId: string) => {
    const selectedRace = registry.getRaceById(raceId);
    if (!selectedRace) {
      return;
    }

    const nextState = appendScenarioEvent(
      createRaceDomainScenarioState(raceId, state.resetCount, state.eventLog),
      `Selected Race: ${selectedRace.name}`,
    );
    publishState(nextState);
  };

  // Reset restores the canonical first-race baseline and records the reset so
  // mounted proof can show that the scenario did not retain hidden choices.
  const handleReset = () => {
    const resetRace = registry.races[0];
    const nextState = createRaceDomainScenarioState(
      resetRace?.id ?? null,
      state.resetCount + 1,
      resetRace ? [`Reset Race domain to ${resetRace.name}`] : ['Reset Race domain'],
    );
    publishState(nextState);
  };

  // A leaf reports a real event through the same visible state log. The shell
  // does not interpret or rewrite the event, preserving leaf-owned mechanics.
  const handleScenarioEvent = (message: string) => {
    publishState(appendScenarioEvent(state, message));
  };

  const selectedRace = state.selectedRaceId
    ? registry.getRaceById(state.selectedRaceId)
    : undefined;
  const selectedLeaves: readonly RaceDomainLeafRegistration[] = selectedRace
    ? registry.getLeavesForRace(selectedRace.id)
    : [];

  return (
    <section aria-labelledby="race-domain-title" data-testid="race-domain-shell">
      {/* The heading establishes a clear landmark for the Rules tab host. */}
      <div>
        <p>Race</p>
        <h2 id="race-domain-title">Tactical Sandbox Race</h2>
        <p id="race-domain-description">
          Choose a canonical Race to inspect. Race-specific mechanics appear only
          when a leaf registers a real production-backed scenario.
        </p>
      </div>

      {/* Native select semantics keep the selector keyboard and screen-reader accessible. */}
      <div>
        <label htmlFor="race-domain-selector">Race</label>
        <select
          id="race-domain-selector"
          aria-describedby="race-domain-description"
          value={state.selectedRaceId ?? ''}
          onChange={event => handleRaceSelect(event.target.value)}
        >
          {registry.races.length === 0 && <option value="">No selectable Races</option>}
          {registry.races.map(race => (
            <option key={race.id} value={race.id}>{race.name}</option>
          ))}
        </select>
        <Button type="button" variant="secondary" size="sm" onClick={handleReset}>Reset</Button>
      </div>

      {/* This live status turns the selected canonical record into visible proof. */}
      <div aria-live="polite" role="status" data-testid="race-domain-status">
        {selectedRace ? `Selected Race: ${selectedRace.name}` : 'No Race selected'}
      </div>

      {/* The shell renders canonical facts, not fabricated mechanical outcomes. */}
      {selectedRace && (
        <article aria-labelledby="race-domain-selected-title" data-testid="race-domain-selected">
          <h3 id="race-domain-selected-title">{selectedRace.name}</h3>
          <p>{selectedRace.description}</p>
          <p>Canonical traits: {selectedRace.traits.length}</p>
        </article>
      )}

      {/* Future leaves own real scenario UI; the empty boundary is intentionally honest. */}
      <div aria-label="Registered Race scenarios" data-testid="race-domain-leaves">
        {selectedLeaves.length > 0 ? selectedLeaves.map(registration => (
          <div key={registration.id} data-testid={`race-leaf-${registration.id}`}>
            <h3>{registration.label}</h3>
            <p>{registration.description}</p>
            <registration.Component
              race={selectedRace!}
              state={state}
              onScenarioEvent={handleScenarioEvent}
            />
          </div>
        )) : (
          <p data-testid="race-domain-no-leaf">
            No Race-specific scenario is registered for this selection. This shell
            does not invent race mechanics.
          </p>
        )}
      </div>

      {/* Recent events remain visible so real leaf outcomes can be audited after reset. */}
      <ol aria-label="Race scenario event log" data-testid="race-domain-event-log">
        {state.eventLog.map((message, index) => (
          <li key={`${message}-${index}`}>{message}</li>
        ))}
      </ol>
    </section>
  );
};

// The Rules host imports this prop-free surface. The longer shell name remains
// available for focused tests and future domain-local composition.
export const RaceDomainSurface = RaceDomainShell;

export default RaceDomainShell;
