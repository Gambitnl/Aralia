// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 11:20:07
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
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import {
  FLYING_AERIAL_AIRSPACE_GUARD_ID,
  FLYING_AERIAL_BLOCKED_DESTINATION,
  FLYING_AERIAL_FIRST_DESTINATION,
  FLYING_AERIAL_FLYER_ID,
  FLYING_AERIAL_OFF_BOARD_DESTINATION,
  FLYING_AERIAL_START,
  prepareFlyingAerialMovementCharacters,
  prepareFlyingAerialMovementMapData,
} from '../../scenarioControls/flyingAerialMovementScenarioControls';
import {
  resolveAerialMovement,
  type AerialMovementResolution,
} from '../../../../../utils/combat/aerialMovementUtils';
import {
  createQuickCombatCharacter,
  type QuickCharacterConfig,
} from '../../../../../utils/sandbox/quickCharacterGenerator';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Aarakocra race one deterministic flight
 * transaction inside the Tactical Sandbox Race domain.
 *
 * The parent Race shell supplies the canonical Race record and the event
 * callback. This leaf prepares a small visible board, delegates movement to
 * the production aerial resolver, and reports the actor, Fly resource, and
 * outcome so a tester can audit the rule without trusting UI-only state.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: Aarakocra Race traits, the shared aerial scenario adapter, and
 * src/utils/combat/aerialMovementUtils.ts.
 */

// ============================================================================
// Canonical Trait Extraction
// ============================================================================
// Aarakocra stores its walking speed and Flight rule as canonical trait text.
// Reading those facts from the supplied Race keeps this leaf linked to the
// production roster instead of copying the generic aerial fixture's 40 feet.
// ============================================================================

export const AARAKOCRA_FLIGHT_CONTROL_ID = 'resolve-aarakocra-flight';
export const AARAKOCRA_FLIGHT_TARGET_CONTROL_ID = 'aarakocra-flight-target';

export type AarakocraFlightTargetId = 'first-leg' | 'next-leg' | 'blocked-airspace' | 'off-board';

export interface AarakocraFlightTarget {
  id: AarakocraFlightTargetId;
  label: string;
  destination: { x: number; y: number };
  destinationAltitudeFeet: number;
}

export const AARAKOCRA_FLIGHT_TARGETS: readonly AarakocraFlightTarget[] = [
  {
    id: 'first-leg',
    label: 'Legal first leg · 6,6@20 ft',
    destination: { ...FLYING_AERIAL_FIRST_DESTINATION },
    destinationAltitudeFeet: 20,
  },
  {
    id: 'next-leg',
    label: 'Next leg · 8,6@20 ft',
    destination: { x: 8, y: 6 },
    destinationAltitudeFeet: 20,
  },
  {
    id: 'blocked-airspace',
    label: 'Blocked airspace · 11,8@20 ft',
    destination: { ...FLYING_AERIAL_BLOCKED_DESTINATION },
    destinationAltitudeFeet: 20,
  },
  {
    id: 'off-board',
    label: 'Off board · 16,6@20 ft',
    destination: { ...FLYING_AERIAL_OFF_BOARD_DESTINATION },
    destinationAltitudeFeet: 20,
  },
];

/** Read the walking-speed fact from the canonical Speed trait. */
export function getCanonicalWalkingSpeedFeet(race: Race): number | null {
  const speedTrait = race.traits.find(trait => /^Speed:/i.test(trait.trim()));
  const speed = speedTrait?.match(/(\d+)\s*feet/i)?.[1];
  return speed ? Number(speed) : null;
}

/** Confirm that the canonical text grants flight equal to walking speed. */
export function hasCanonicalAarakocraFlight(race: Race): boolean {
  return race.id === 'aarakocra' && race.traits.some(trait => (
    /Flight:/i.test(trait) && /flying speed equal to your walking speed/i.test(trait)
  ));
}

// ============================================================================
// Deterministic Production-Mechanics Fixture
// ============================================================================
// The Race leaf contract does not receive the full combat snapshot, so this
// fixture supplies only the board and actors needed to exercise the shared
// movement resolver. Actors come from the same quick-character construction
// seam used by the central Design Preview host, while the resolver still owns
// route legality and action-budget payment.
// ============================================================================

export interface AarakocraFlightScenarioState {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  lastResolution: AerialMovementResolution | null;
  outcome: string;
}

function createAerialFixtureMap(): BattleMapData {
  // The board is deliberately just wide enough to keep the authored legal
  // lane visible while making the off-board target an actual resolver failure.
  const dimensions = { width: 14, height: 12 };
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'grass',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }

  // Reuse the canonical aerial adapter so difficult terrain, raised ground,
  // blockers, ceilings, and occupied airspace stay aligned with production
  // Flying & Aerial Movement proof.
  return prepareFlyingAerialMovementMapData({
    dimensions,
    tiles,
    theme: 'grass',
    seed: 3001,
  });
}

function replaceCharacter(
  characters: CombatCharacter[],
  replacement: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => (
    character.id === replacement.id ? replacement : character
  ));
}

interface AarakocraFixtureSpec {
  id: string;
  position: { x: number; y: number };
  team: CombatCharacter['team'];
  config: QuickCharacterConfig;
}

/** Build the canonical-speed board used on mount and whenever resetCount changes. */
export function createAarakocraFlightScenario(race: Race): AarakocraFlightScenarioState {
  const walkingSpeedFeet = getCanonicalWalkingSpeedFeet(race) ?? 0;
  const mapData = createAerialFixtureMap();
  const fixtureSpecs: readonly AarakocraFixtureSpec[] = [
    {
      id: FLYING_AERIAL_FLYER_ID,
      position: { ...FLYING_AERIAL_START },
      team: 'player',
      config: {
        name: 'Aarakocra Flight Tester',
        raceId: 'aarakocra',
        classId: 'fighter',
        level: 1,
        stats: [10, 15, 12, 10, 10, 10],
      },
    },
    {
      id: 'flying_aerial_movement-ground-creature',
      position: { x: 10, y: 6 },
      team: 'enemy',
      config: {
        name: 'Ground Warden',
        raceId: 'human',
        classId: 'fighter',
        level: 1,
        stats: [12, 10, 12, 10, 10, 10],
      },
    },
    {
      id: FLYING_AERIAL_AIRSPACE_GUARD_ID,
      position: { x: 6, y: 10 },
      team: 'player',
      config: {
        name: 'Aerie Guard',
        raceId: 'human',
        classId: 'fighter',
        level: 1,
        stats: [10, 12, 12, 10, 10, 10],
      },
    },
  ];

  // The production quick-character seam can honestly fail for an invalid
  // catalog configuration. Keep that failure visible instead of creating a
  // placeholder replacement that would hide a broken canonical roster link.
  const generatedCharacters = fixtureSpecs.map(spec => {
    const character = createQuickCombatCharacter(spec.config);
    return character
      ? {
          ...character,
          id: spec.id,
          position: { ...spec.position },
          team: spec.team,
        }
      : null;
  });
  const baseCharacters = generatedCharacters.filter(
    (character): character is CombatCharacter => character !== null,
  );
  if (baseCharacters.length !== fixtureSpecs.length) {
    return {
      mapData,
      characters: baseCharacters,
      lastResolution: null,
      outcome: 'Flight fixture unavailable: canonical quick-character generation returned null.',
    };
  }

  // The shared aerial adapter adds its authored altitude, airspace, and
  // movement-ledger facts to these production-built characters.
  const preparedCharacters = prepareFlyingAerialMovementCharacters(baseCharacters);
  const preparedFlyer = preparedCharacters.find(character => character.id === FLYING_AERIAL_FLYER_ID);

  // The source trait says Fly equals walking speed. Set only the movement facts
  // that the shared adapter intentionally leaves generic so the resolver
  // receives the canonical 30-foot fact from the selected Race.
  const flyer: CombatCharacter | undefined = preparedFlyer && {
    ...preparedFlyer,
    name: `${race.name} · Fly ${walkingSpeedFeet} ft · 3,6@10 ft · Move 0/${walkingSpeedFeet}`,
    creatureTypes: ['Humanoid'],
    stats: {
      ...preparedFlyer.stats,
      speed: walkingSpeedFeet,
      extraMovementSpeeds: {
        ...preparedFlyer.stats.extraMovementSpeeds,
        fly: hasCanonicalAarakocraFlight(race) ? walkingSpeedFeet : 0,
      },
    },
    actionEconomy: {
      ...preparedFlyer.actionEconomy,
      movement: { used: 0, total: walkingSpeedFeet },
    },
  };

  const characters = flyer
    ? replaceCharacter(preparedCharacters, flyer)
    : preparedCharacters;
  const actor = characters.find(character => character.id === FLYING_AERIAL_FLYER_ID);
  const outcome = actor && hasCanonicalAarakocraFlight(race)
    ? `Ready: ${actor.name}. Flight equals walking speed from canonical traits.`
    : 'Flight unavailable: canonical Aarakocra Flight and Speed traits were not both present.';

  return {
    mapData,
    characters,
    lastResolution: null,
    outcome,
  };
}

/** Resolve one selected target through the native aerial movement transaction. */
export function resolveAarakocraFlight(
  scenario: AarakocraFlightScenarioState,
  targetId: AarakocraFlightTargetId,
): AarakocraFlightScenarioState {
  const target = AARAKOCRA_FLIGHT_TARGETS.find(candidate => candidate.id === targetId);
  const flyer = scenario.characters.find(character => character.id === FLYING_AERIAL_FLYER_ID);
  if (!target || !flyer) {
    return {
      ...scenario,
      outcome: 'Flight rejected: the deterministic Aarakocra actor or target is missing.',
    };
  }

  // The shared resolver checks contiguous route, airspace, full footprint, and
  // movement-only action economy before returning a changed character.
  const resolution = resolveAerialMovement({
    character: flyer,
    destination: target.destination,
    destinationAltitudeFeet: target.destinationAltitudeFeet,
    mapData: scenario.mapData,
    characters: scenario.characters,
  });
  const before = `${flyer.position.x},${flyer.position.y}@${flyer.aerialMovement?.altitudeFeet ?? 0} ft; Move ${flyer.actionEconomy.movement.used}/${flyer.actionEconomy.movement.total}`;

  if (!resolution.allowed) {
    return {
      ...scenario,
      lastResolution: resolution,
      outcome: `Flight rejected atomically: ${resolution.reason} Unchanged: ${before}.`,
    };
  }

  const moved = replaceCharacter(scenario.characters, resolution.character);
  return {
    ...scenario,
    characters: moved,
    lastResolution: resolution,
    outcome: `Flight resolved: ${resolution.character.name}. Cost ${resolution.costFeet} ft; Move ${resolution.character.actionEconomy.movement.used}/${resolution.character.actionEconomy.movement.total}.`,
  };
}

function getFlyer(scenario: AarakocraFlightScenarioState): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === FLYING_AERIAL_FLYER_ID);
}

// ============================================================================
// Aarakocra Leaf UI
// ============================================================================
// This small control surface keeps the actor/resource/outcome facts visible in
// one place. Reset is owned by the parent shell, and resetCount is the explicit
// signal that returns this leaf to its canonical baseline.
// ============================================================================

const AarakocraRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [targetId, setTargetId] = useState<AarakocraFlightTargetId>('first-leg');
  const [scenario, setScenario] = useState<AarakocraFlightScenarioState>(
    () => createAarakocraFlightScenario(race),
  );

  const flyer = getFlyer(scenario);
  const target = AARAKOCRA_FLIGHT_TARGETS.find(candidate => candidate.id === targetId);
  const walkingSpeedFeet = getCanonicalWalkingSpeedFeet(race);

  const handleResolve = () => {
    const nextScenario = resolveAarakocraFlight(scenario, targetId);
    setScenario(nextScenario);
    const result = nextScenario.lastResolution;
    const event = result?.allowed
      ? `Aarakocra FLIGHT RESOLVED: ${result.costFeet} ft paid; Move ${result.character.actionEconomy.movement.used}/${result.character.actionEconomy.movement.total}; ${result.character.position.x},${result.character.position.y}@${result.character.aerialMovement?.altitudeFeet ?? 0} ft.`
      : `Aarakocra FLIGHT REJECTED ATOMICALLY: ${nextScenario.outcome}`;
    onScenarioEvent(event);
  };

  return (
    <section aria-labelledby="aarakocra-flight-title" data-testid="aarakocra-race-leaf">
      {/* The heading names the canonical trait transaction for assistive tools. */}
      <h4 id="aarakocra-flight-title">Aarakocra Flight</h4>
      <p data-testid="aarakocra-canonical-traits">
        Canonical: Speed {walkingSpeedFeet ?? 'unknown'} ft; Flight equals walking speed.
      </p>

      {/* The select changes only the authored destination; the resolver remains authoritative. */}
      <label htmlFor={AARAKOCRA_FLIGHT_TARGET_CONTROL_ID}>Flight target</label>
      <select
        id={AARAKOCRA_FLIGHT_TARGET_CONTROL_ID}
        value={targetId}
        onChange={event => setTargetId(event.target.value as AarakocraFlightTargetId)}
      >
        {AARAKOCRA_FLIGHT_TARGETS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>
        Resolve Aarakocra flight
      </Button>

      {/* These facts prove the live actor and movement resource, not just the selected label. */}
      <p data-testid="aarakocra-flight-actor">
        Actor: {flyer?.name ?? 'missing'}; Position {flyer?.position.x},{flyer?.position.y}@{flyer?.aerialMovement?.altitudeFeet ?? 0} ft; Fly {flyer?.stats.extraMovementSpeeds?.fly ?? 0} ft; Move {flyer?.actionEconomy.movement.used}/{flyer?.actionEconomy.movement.total}.
      </p>
      <p data-testid="aarakocra-flight-target">Target: {target?.label ?? 'missing'}</p>
      <p aria-live="polite" role="status" data-testid="aarakocra-flight-outcome">{scenario.outcome}</p>

      {/* No production helper currently enforces Aarakocra armour restrictions. */}
      <p data-testid="aarakocra-armor-boundary">
        Unsupported boundary: medium/heavy-armor Flight restriction is canonical data only; no production flight-armor validator is available, so this leaf does not fake enforcement.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed content boundary remounts the
// leaf state from canonical facts, avoiding an effect-driven cascading render
// while making reset behavior explicit and deterministic.
export const AarakocraRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <AarakocraRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping
// the registration local means another Race leaf can land without registry edits.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'aarakocra-flight',
  raceId: 'aarakocra',
  label: 'Aarakocra Flight',
  description: 'Resolve canonical Flight equal to walking speed through the native aerial movement resolver.',
  Component: AarakocraRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
