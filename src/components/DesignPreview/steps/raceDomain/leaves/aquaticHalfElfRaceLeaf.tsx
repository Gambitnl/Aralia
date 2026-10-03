// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 11:53:54
 * Dependents: None (Orphan)
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { AbilityCost, CombatCharacter } from '../../../../../types/combat';
import { applyMovementCostModifiers } from '../../../../../utils/combat/physicsUtils';
import {
  calculateMovementModeTotal,
  canAffordActionCost,
  consumeActionCost,
} from '../../../../../utils/combat/actionEconomyUtils';
import {
  createQuickCombatCharacter,
  type QuickCharacterConfig,
} from '../../../../../utils/sandbox/quickCharacterGenerator';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file demonstrates the canonical Aquatic Half-Elf Swim Speed trait through
 * the production quick-character bridge, native movement-cost physics, and the
 * shared action-economy ledger. It exists because the shared character assembly
 * does not yet project swimming speed, while the Tactical Sandbox needs a
 * visible, deterministic proof of the trait and its exact cost boundary.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Race traits, createQuickCombatCharacter, physicsUtils,
 * actionEconomyUtils, and the Race leaf contract.
 */

// ============================================================================
// Canonical Aquatic Half-Elf Facts
// ============================================================================
// These helpers read the supplied Race record instead of copying the roster
// value into a separate scenario constant. The source currently contains two
// equivalent Swim Speed entries, so the parser deduplicates values before the
// scenario uses one deterministic canonical speed.
// ============================================================================

export const AQUATIC_HALF_ELF_SWIM_CONTROL_ID = 'aquatic-half-elf-swim-mode';
export const AQUATIC_HALF_ELF_SWIM_ACTOR_ID = 'aquatic-half-elf-swim-actor';
export const AQUATIC_HALF_ELF_SWIM_COMPARISON_ACTOR_ID = 'aquatic-half-elf-swim-comparison';
export const AQUATIC_HALF_ELF_SWIM_DISTANCE_FEET = 15;

export type AquaticHalfElfSwimMode = 'native' | 'without-native-speed';

export interface AquaticHalfElfSwimCostComparison {
  nativeCostFeet: number;
  comparisonCostFeet: number;
}

export interface AquaticHalfElfSwimResolution {
  mode: AquaticHalfElfSwimMode;
  allowed: boolean;
  costFeet: number;
  movementBeforeFeet: number;
  movementAfterFeet: number;
  movementTotalFeet: number;
  reason: string;
}

export interface AquaticHalfElfSwimScenarioState {
  actor: CombatCharacter | null;
  comparisonActor: CombatCharacter | null;
  selectedMode: AquaticHalfElfSwimMode;
  lastResolution: AquaticHalfElfSwimResolution | null;
  outcome: string;
}

/**
 * Read every canonical Swim Speed trait and return unique feet values.
 * Matching the trait label and then extracting its feet value handles both the
 * compact and explanatory duplicate entries without double-counting them.
 */
export function getCanonicalAquaticHalfElfSwimSpeedsFeet(
  race: Race,
): readonly number[] {
  const speeds = race.traits.flatMap(trait => {
    if (!/swim(?:ming)? speed/i.test(trait)) {
      return [];
    }

    const match = trait.match(/(\d+)\s*feet/i);
    return match ? [Number(match[1])] : [];
  });

  return [...new Set(speeds)];
}

/** Return the one deterministic canonical speed after duplicate resolution. */
export function getCanonicalAquaticHalfElfSwimSpeedFeet(
  race: Race,
): number | null {
  return getCanonicalAquaticHalfElfSwimSpeedsFeet(race)[0] ?? null;
}

/** Confirm that the selected canonical Race owns the expected Swim Speed fact. */
export function hasCanonicalAquaticHalfElfSwimSpeed(race: Race): boolean {
  return race.id === 'half_elf_aquatic'
    && getCanonicalAquaticHalfElfSwimSpeedFeet(race) === 30;
}

// ============================================================================
// Production Actor And Movement Ledger
// ============================================================================
// The actor starts at the production quick-character boundary. Only the
// missing swim-speed projection is added when shared assembly has not already
// provided it. The comparison actor deliberately removes that one derived
// speed so the same native physics helper can show the no-speed rule.
// ============================================================================

const AQUATIC_HALF_ELF_ACTOR_CONFIG: QuickCharacterConfig = {
  name: 'Aquatic Half-Elf Swim Tester',
  raceId: 'half_elf_aquatic',
  classId: 'fighter',
  level: 1,
  stats: [10, 12, 12, 10, 10, 10],
};

function projectCanonicalSwimSpeedIfMissing(
  character: CombatCharacter,
  swimSpeedFeet: number,
): CombatCharacter {
  const assembledSwimSpeed = character.stats.extraMovementSpeeds?.swim;
  if (typeof assembledSwimSpeed === 'number') {
    return character;
  }

  // This is the narrow adapter seam: preserve every shared stat and movement
  // mode, adding only the canonical fact the shared assembly did not provide.
  return {
    ...character,
    stats: {
      ...character.stats,
      extraMovementSpeeds: {
        ...character.stats.extraMovementSpeeds,
        swim: swimSpeedFeet,
      },
    },
  };
}

function removeSwimSpeed(character: CombatCharacter): CombatCharacter {
  const extraMovementSpeeds = character.stats.extraMovementSpeeds
    ? { ...character.stats.extraMovementSpeeds }
    : undefined;
  if (extraMovementSpeeds) {
    delete extraMovementSpeeds.swim;
  }

  return {
    ...character,
    id: AQUATIC_HALF_ELF_SWIM_COMPARISON_ACTOR_ID,
    name: 'Aquatic Half-Elf without native Swim Speed',
    stats: {
      ...character.stats,
      extraMovementSpeeds,
    },
  };
}

function prepareMovementLedger(
  character: CombatCharacter,
  mode: 'walk' | 'swim',
): CombatCharacter {
  // The shared action economy uses one movement ledger. Its total is derived
  // from the selected movement mode so swimming never borrows an invented pool.
  return {
    ...character,
    actionEconomy: {
      ...character.actionEconomy,
      movement: {
        used: 0,
        total: calculateMovementModeTotal(character, mode),
      },
    },
  };
}

/** Build the deterministic native actor and no-native-speed comparison actor. */
export function createAquaticHalfElfSwimScenario(
  race: Race,
): AquaticHalfElfSwimScenarioState {
  const swimSpeedFeet = getCanonicalAquaticHalfElfSwimSpeedFeet(race);
  const generatedActor = createQuickCombatCharacter(AQUATIC_HALF_ELF_ACTOR_CONFIG);

  if (!generatedActor || swimSpeedFeet === null) {
    return {
      actor: null,
      comparisonActor: null,
      selectedMode: 'native',
      lastResolution: null,
      outcome: 'Swim fixture unavailable: production actor generation or canonical Swim Speed data failed.',
    };
  }

  const canonicalActor = projectCanonicalSwimSpeedIfMissing(generatedActor, swimSpeedFeet);
  const actor = {
    ...prepareMovementLedger(canonicalActor, 'swim'),
    id: AQUATIC_HALF_ELF_SWIM_ACTOR_ID,
  };
  const comparisonActor = prepareMovementLedger(removeSwimSpeed(actor), 'walk');

  return {
    actor,
    comparisonActor,
    selectedMode: 'native',
    lastResolution: null,
    outcome: hasCanonicalAquaticHalfElfSwimSpeed(race)
      ? `Ready: ${actor.name}; canonical Swim Speed ${swimSpeedFeet} ft is available in the native movement ledger.`
      : 'Swim boundary unavailable: the supplied Race is not the canonical 30-foot Aquatic Half-Elf record.',
  };
}

/** Compute both costs through the native physical movement helper. */
export function getAquaticHalfElfSwimCostComparison(): AquaticHalfElfSwimCostComparison {
  return {
    nativeCostFeet: applyMovementCostModifiers(AQUATIC_HALF_ELF_SWIM_DISTANCE_FEET, {
      isSwimming: true,
      hasSwimSpeed: true,
    }),
    comparisonCostFeet: applyMovementCostModifiers(AQUATIC_HALF_ELF_SWIM_DISTANCE_FEET, {
      isSwimming: true,
      hasSwimSpeed: false,
    }),
  };
}

/** Resolve one 15-foot swim through native physics and the action ledger. */
export function resolveAquaticHalfElfSwim(
  scenario: AquaticHalfElfSwimScenarioState,
  mode: AquaticHalfElfSwimMode = scenario.selectedMode,
): AquaticHalfElfSwimScenarioState {
  const selectedActor = mode === 'native' ? scenario.actor : scenario.comparisonActor;
  const hasSwimSpeed = mode === 'native';
  const costFeet = applyMovementCostModifiers(AQUATIC_HALF_ELF_SWIM_DISTANCE_FEET, {
    isSwimming: true,
    hasSwimSpeed,
  });
  const cost: AbilityCost = { type: 'movement-only', movementCost: costFeet };

  if (!selectedActor) {
    return {
      ...scenario,
      selectedMode: mode,
      lastResolution: {
        mode,
        allowed: false,
        costFeet,
        movementBeforeFeet: 0,
        movementAfterFeet: 0,
        movementTotalFeet: 0,
        reason: 'The production Aquatic Half-Elf actor is unavailable.',
      },
      outcome: 'Swim rejected: the production actor is unavailable.',
    };
  }

  const movementBeforeFeet = selectedActor.actionEconomy.movement.used;
  const movementTotalFeet = selectedActor.actionEconomy.movement.total;
  if (!canAffordActionCost(selectedActor, cost)) {
    return {
      ...scenario,
      selectedMode: mode,
      lastResolution: {
        mode,
        allowed: false,
        costFeet,
        movementBeforeFeet,
        movementAfterFeet: movementBeforeFeet,
        movementTotalFeet,
        reason: `Only ${Math.max(0, movementTotalFeet - movementBeforeFeet)} ft remains for this movement ledger.`,
      },
      outcome: `Swim rejected atomically (${mode}): cost ${costFeet} ft; Move remains ${movementBeforeFeet}/${movementTotalFeet}.`,
    };
  }

  // The native helper returns a new character only after affordability passed,
  // so a rejected swim cannot spend movement or partially update the ledger.
  const paidActor = consumeActionCost(selectedActor, cost);
  const movementAfterFeet = paidActor.actionEconomy.movement.used;
  const resolution: AquaticHalfElfSwimResolution = {
    mode,
    allowed: true,
    costFeet,
    movementBeforeFeet,
    movementAfterFeet,
    movementTotalFeet,
    reason: `Native swim cost applied; Move ${movementAfterFeet}/${movementTotalFeet}.`,
  };

  return {
    ...scenario,
    actor: mode === 'native' ? paidActor : scenario.actor,
    comparisonActor: mode === 'without-native-speed' ? paidActor : scenario.comparisonActor,
    selectedMode: mode,
    lastResolution: resolution,
    outcome: `Swim resolved (${mode}): 15 ft distance cost ${costFeet} ft; Move ${movementAfterFeet}/${movementTotalFeet}.`,
  };
}

// ============================================================================
// Aquatic Half-Elf Leaf UI
// ============================================================================
// The controls expose native versus comparison mode, the production actor and
// both movement ledgers. Reset is owned by the parent shell; changing resetCount
// remounts this content so no hidden resource state survives a reset.
// ============================================================================

const AquaticHalfElfRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [mode, setMode] = useState<AquaticHalfElfSwimMode>('native');
  const [scenario, setScenario] = useState<AquaticHalfElfSwimScenarioState>(
    () => createAquaticHalfElfSwimScenario(race),
  );
  const costComparison = getAquaticHalfElfSwimCostComparison();
  const actor = scenario.actor;
  const comparisonActor = scenario.comparisonActor;
  const canonicalSwimSpeedFeet = getCanonicalAquaticHalfElfSwimSpeedFeet(race);

  // Resolve the selected mode and publish the same native outcome to the shell
  // so the parent event log and this leaf remain auditable together.
  const handleResolve = () => {
    const nextScenario = resolveAquaticHalfElfSwim(scenario, mode);
    setScenario(nextScenario);
    onScenarioEvent(`Aquatic Half-Elf SWIM ${mode.toUpperCase()}: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="aquatic-half-elf-swim-title" data-testid="aquatic-half-elf-race-leaf">
      {/* The heading identifies the canonical Swim Speed transaction. */}
      <h4 id="aquatic-half-elf-swim-title">Aquatic Half-Elf Swim Speed</h4>
      <p data-testid="aquatic-half-elf-canonical-traits">
        Canonical: Swim Speed {canonicalSwimSpeedFeet ?? 'unknown'} ft; duplicate trait entries resolve to one value.
      </p>

      {/* This selector makes the native rule and its no-speed comparison repeatable. */}
      <label htmlFor={AQUATIC_HALF_ELF_SWIM_CONTROL_ID}>Swim speed mode</label>
      <select
        id={AQUATIC_HALF_ELF_SWIM_CONTROL_ID}
        value={mode}
        onChange={event => setMode(event.target.value as AquaticHalfElfSwimMode)}
      >
        <option value="native">Native Swim Speed 30 ft</option>
        <option value="without-native-speed">Without native Swim Speed</option>
      </select>
      <Button type="button" onClick={handleResolve}>
        Resolve 15-foot swim
      </Button>

      {/* These ledgers show the production actor, derived speed, and real resource change. */}
      <p data-testid="aquatic-half-elf-swim-actor">
        Actor: {actor?.name ?? 'missing'}; Swim {actor?.stats.extraMovementSpeeds?.swim ?? 0} ft; Move {actor?.actionEconomy.movement.used ?? 'unknown'}/{actor?.actionEconomy.movement.total ?? 'unknown'}.
      </p>
      <p data-testid="aquatic-half-elf-swim-comparison">
        Comparison: {comparisonActor?.name ?? 'missing'}; Swim {comparisonActor?.stats.extraMovementSpeeds?.swim ?? 0} ft; Move {comparisonActor?.actionEconomy.movement.used ?? 'unknown'}/{comparisonActor?.actionEconomy.movement.total ?? 'unknown'}; Native cost {costComparison.nativeCostFeet} ft vs without speed {costComparison.comparisonCostFeet} ft.
      </p>
      <p aria-live="polite" role="status" data-testid="aquatic-half-elf-swim-outcome">
        {scenario.outcome}
      </p>

      {/* Swimming cost and ledgers are native; swimming pathfinding is not yet integrated. */}
      <p data-testid="aquatic-half-elf-swim-boundary">
        Unsupported boundary: movementUtils does not yet integrate swimming mode into BattleMap pathfinding, so this leaf proves native cost and action-budget payment only; it does not claim an aquatic route or 2D/3D placement.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. The keyed content remount restores both
// actors, the selected native default, and their unspent movement ledgers.
export const AquaticHalfElfRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <AquaticHalfElfRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping
// registration local avoids a shared registry edit owned by another worker.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'aquatic-half-elf-swim-speed',
  raceId: 'half_elf_aquatic',
  label: 'Aquatic Half-Elf Swim Speed',
  description: 'Resolve canonical 30-foot Swim Speed through native movement physics and action economy.',
  Component: AquaticHalfElfRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
