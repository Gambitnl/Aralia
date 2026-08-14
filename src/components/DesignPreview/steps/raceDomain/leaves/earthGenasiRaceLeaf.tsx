// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is an isolated Race-domain leaf with no sibling-leaf imports.
 *
 * Last Sync: 13/08/2026, 11:00:00
 * Dependents: RaceDomainRegistry.ts discovers this module through import.meta.glob.
 * Imports: canonical Race data, native movement/action helpers, and the shared leaf contract.
 *
 * MULTI-AGENT SAFETY:
 * If this module's exports/imports change, re-run the sync tool for this file.
 */
// @dependencies-end

import React, { useState } from 'react';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { BattleMapTile, CombatCharacter, Position } from '../../../../../types/combat';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../../utils/combat/actionEconomyUtils';
import {
  calculatePathMovementCost,
  calculateStepMovementCost,
  isDifficultMovementCost,
} from '../../../../../utils/combat/movementUtils';
import { getElevationTransitionCostFeet } from '../../../../../utils/spatial/elevationGeometry';
import { createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { calculateProficiencyBonus } from '../../../../../utils/character/savingThrowUtils';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Earth Genasi race one deterministic Earth Walk
 * movement transaction inside the Tactical Sandbox Race domain.
 *
 * The parent Race shell supplies canonical race data and the event callback.
 * This leaf builds one production combat actor, compares the native ordinary
 * path cost with a narrow Earth Walk terrain-multiplier adapter, and commits
 * only movement through the native action-economy helpers. Merge with Stone
 * spell grants remain visible canonical facts because this leaf has no safe
 * spell-casting transaction to invoke.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: Earth Genasi Race traits, quick combat assembly, movementUtils,
 * actionEconomyUtils, and the shared Race-domain registration contract.
 */

// ============================================================================
// Canonical Earth Genasi Facts
// ============================================================================
// The Race record remains the source of truth for Earth Walk and Merge with
// Stone. These readers deliberately parse the authored record instead of
// copying a second set of racial rules into the preview.
// ============================================================================

export const EARTH_GENASI_EARTH_WALK_CONTROL_ID = 'earth-genasi-earth-walk-path';
export const EARTH_GENASI_ACTOR_ID = 'earth-genasi-earth-walk-actor';

export type EarthGenasiPathChoice = 'legal' | 'over-budget';

export interface CanonicalEarthGenasiSpellFact {
  minLevel: number;
  spellId: string;
}

export function getCanonicalEarthWalkTrait(race: Race): string | undefined {
  return race.traits.find(trait => /^Earth Walk:/i.test(trait.trim()));
}

export function hasCanonicalEarthWalk(race: Race): boolean {
  const earthWalk = getCanonicalEarthWalkTrait(race);
  return race.id === 'earth_genasi'
    && Boolean(earthWalk)
    && /Difficult Terrain/i.test(earthWalk ?? '')
    && /ground or a floor/i.test(earthWalk ?? '');
}

export function getCanonicalMergeWithStoneTrait(race: Race): string | undefined {
  return race.traits.find(trait => /^Merge with Stone:/i.test(trait.trim()));
}

export function getCanonicalEarthGenasiSpellProgression(
  race: Race,
): readonly CanonicalEarthGenasiSpellFact[] {
  return (race.knownSpells ?? []).map(spell => ({
    minLevel: spell.minLevel,
    spellId: spell.spellId,
  }));
}

export function getCanonicalEarthGenasiSpellAbilityChoices(
  race: Race,
): readonly string[] {
  const choiceDescription = race.racialSpellChoice?.traitDescription ?? '';
  const choices = choiceDescription.match(/:\s*(.+?)(?:\.|$)/)?.[1];
  return choices
    ? choices.split(',').map(choice => choice.trim()).filter(Boolean)
    : [];
}

export function getCanonicalBladeWardUseLimit(race: Race): 'proficiency_bonus' | null {
  const mergeWithStone = getCanonicalMergeWithStoneTrait(race);
  return mergeWithStone && /times equal to your Proficiency Bonus/i.test(mergeWithStone)
    ? 'proficiency_bonus'
    : null;
}

export function getCanonicalPassWithoutTraceMinLevel(race: Race): number | null {
  return race.knownSpells?.find(spell => spell.spellId === 'pass-without-trace')?.minLevel ?? null;
}

// ============================================================================
// Deterministic Ground Path And Native Cost Comparison
// ============================================================================
// The fixture is intentionally a horizontal floor path. Every destination is
// difficult terrain, so ordinary movement pays the native 2x terrain multiplier
// while Earth Walk pays the same native step distance without that multiplier.
// ============================================================================

function createDifficultFloorTile(position: Position): BattleMapTile {
  // A plain floor tile keeps the proof about walking on the ground/floor rather
  // than letting flight, blockers, or elevation mechanics change the result.
  return {
    id: `${position.x}-${position.y}`,
    coordinates: position,
    terrain: 'difficult',
    elevation: 0,
    movementCost: 10,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

export function createEarthGenasiPath(stepCount: number): readonly BattleMapTile[] {
  // Include the starting square because calculatePathMovementCost charges only
  // destination tiles, matching the shared movement utility's contract.
  return Array.from({ length: stepCount + 1 }, (_, index) => (
    createDifficultFloorTile({ x: index, y: 0 })
  ));
}

function getEarthGenasiPath(choice: EarthGenasiPathChoice): readonly BattleMapTile[] {
  // Three squares fit in the 30-foot baseline; seven squares prove atomic
  // rejection when even Earth Walk's terrain-free cost exceeds that budget.
  return createEarthGenasiPath(choice === 'legal' ? 3 : 7);
}

function isGroundOrFloorDifficultPath(path: readonly BattleMapTile[]): boolean {
  // Earth Walk applies only to a walkable ground/floor route, never to a flight
  // route, a blocked tile, or a path that quietly changes surface semantics.
  return path.length > 1 && path.every(tile => (
    (tile.terrain === 'difficult' || tile.terrain === 'floor')
    && !tile.blocksMovement
  ));
}

/**
 * Calculates Earth Walk cost using the native 5-10-5 step and elevation rules.
 *
 * DEBT: The production path helper has no race-aware terrain policy seam, so
 * this adapter normalizes only difficult terrain to multiplier 1 and then calls
 * the native step helper. The proper fix is a race-aware movement policy passed
 * into production pathfinding and turn movement; this leaf does not expand that
 * unrelated engine contract.
 */
export function calculateEarthWalkPathMovementCost(path: readonly BattleMapTile[]): number {
  let totalCost = 0;
  let diagonalCount = 0;

  // Charge each destination with native step geometry, preserving elevation and
  // normal-tile costs while removing only the difficult-terrain surcharge.
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const next = path[index];
    const dx = next.coordinates.x - previous.coordinates.x;
    const dy = next.coordinates.y - previous.coordinates.y;
    const normalizedMovementCost = isDifficultMovementCost(next.movementCost)
      ? 1
      : next.movementCost;
    const step = calculateStepMovementCost(dx, dy, diagonalCount, normalizedMovementCost);
    totalCost += step.cost + getElevationTransitionCostFeet(previous, next);
    if (step.isDiagonal) {
      diagonalCount += 1;
    }
  }

  return totalCost;
}

// ============================================================================
// Earth Walk Scenario State And Transaction
// ============================================================================
// The scenario stores immutable actor snapshots and a short result receipt.
// Failed movement returns the same actor reference and never spends movement
// or changes position, making the over-budget boundary auditable in tests.
// ============================================================================

export interface EarthGenasiResolution {
  status: 'ready' | 'resolved' | 'rejected';
  reason: string;
  pathChoice: EarthGenasiPathChoice;
  ordinaryMovementFeet: number;
  earthWalkMovementFeet: number;
  movementSavedFeet: number;
  startPosition: Position;
  endPosition: Position;
}

export interface EarthGenasiScenarioState {
  actor: CombatCharacter | null;
  pathChoice: EarthGenasiPathChoice;
  resolution: EarthGenasiResolution;
  outcome: string;
}

const EARTH_GENASI_ACTOR_CONFIG = {
  name: 'Earth Genasi Earth Walk Tester',
  raceId: 'earth_genasi',
  classId: 'fighter',
  level: 1,
  stats: [10, 12, 12, 10, 10, 10] as [number, number, number, number, number, number],
};

function getReadyResolution(pathChoice: EarthGenasiPathChoice): EarthGenasiResolution {
  // The ready receipt exposes both costs before the user commits movement.
  const path = getEarthGenasiPath(pathChoice);
  const ordinaryMovementFeet = calculatePathMovementCost([...path]);
  const earthWalkMovementFeet = calculateEarthWalkPathMovementCost(path);
  const startPosition = path[0].coordinates;
  const endPosition = path[path.length - 1].coordinates;
  return {
    status: 'ready',
    reason: 'ready',
    pathChoice,
    ordinaryMovementFeet,
    earthWalkMovementFeet,
    movementSavedFeet: ordinaryMovementFeet - earthWalkMovementFeet,
    startPosition,
    endPosition,
  };
}

export function createEarthGenasiScenario(race: Race): EarthGenasiScenarioState {
  // Assemble through the same quick combat bridge used by other sandbox leaves
  // so level, speed, HP, and the action-economy shape stay production-shaped.
  const generatedActor = createQuickCombatCharacter(EARTH_GENASI_ACTOR_CONFIG);
  if (!generatedActor || !hasCanonicalEarthWalk(race)) {
    const resolution = getReadyResolution('legal');
    return {
      actor: null,
      pathChoice: 'legal',
      resolution: { ...resolution, status: 'rejected', reason: 'canonical_earth_walk_missing' },
      outcome: 'Earth Walk boundary unavailable: the canonical Earth Walk trait or actor fixture is missing.',
    };
  }

  // Place the actor at the path origin and reset through the native turn-start
  // helper so movement.total is derived from the assembled actor speed.
  const actor = resetEconomy({
    ...generatedActor,
    id: EARTH_GENASI_ACTOR_ID,
    position: { x: 0, y: 0 },
  });
  const resolution = getReadyResolution('legal');
  return {
    actor,
    pathChoice: 'legal',
    resolution,
    outcome: `Ready: Earth Walk path costs ${resolution.earthWalkMovementFeet} ft; ordinary actor path costs ${resolution.ordinaryMovementFeet} ft.`,
  };
}

export function resolveEarthGenasiEarthWalk(
  scenario: EarthGenasiScenarioState,
  pathChoice: EarthGenasiPathChoice = scenario.pathChoice,
): EarthGenasiScenarioState {
  const path = getEarthGenasiPath(pathChoice);
  const readyResolution = getReadyResolution(pathChoice);
  const actor = scenario.actor;

  // Reject missing canonical state or an invalid surface before touching the
  // actor, preserving the same atomic boundary as the combat action executor.
  if (!actor || !isGroundOrFloorDifficultPath(path)) {
    return {
      ...scenario,
      pathChoice,
      resolution: { ...readyResolution, status: 'rejected', reason: 'invalid_ground_path' },
      outcome: 'Earth Walk rejected atomically: the path is not a walkable ground/floor route.',
    };
  }

  const movementCost: { type: 'movement-only'; movementCost: number } = {
    type: 'movement-only',
    movementCost: readyResolution.earthWalkMovementFeet,
  };

  // Native affordability is checked before any position or economy update, so
  // an over-budget path cannot partially move the actor or spend resources.
  if (!canAffordActionCost(actor, movementCost)) {
    return {
      ...scenario,
      pathChoice,
      resolution: { ...readyResolution, status: 'rejected', reason: 'insufficient_movement' },
      outcome: `Earth Walk rejected atomically: ${readyResolution.earthWalkMovementFeet} ft needed, ${actor.actionEconomy.movement.total - actor.actionEconomy.movement.used} ft remaining; position and economy unchanged.`,
    };
  }

  // The native consumption helper pays only movement. Earth Walk does not
  // spend an Action or Bonus Action, and the final position is committed only
  // after the affordability gate succeeds.
  const spentActor = consumeActionCost(actor, movementCost);
  const startPosition = actor.position;
  const endPosition = path[path.length - 1].coordinates;
  const nextActor = { ...spentActor, position: { ...endPosition } };
  const resolution: EarthGenasiResolution = {
    ...readyResolution,
    status: 'resolved',
    reason: 'earth_walk_resolved',
    startPosition,
    endPosition,
  };
  return {
    ...scenario,
    actor: nextActor,
    pathChoice,
    resolution,
    outcome: `Earth Walk RESOLVED: ${path.length - 1} difficult-terrain squares; Earth Genasi paid ${readyResolution.earthWalkMovementFeet} ft vs ordinary ${readyResolution.ordinaryMovementFeet} ft; position ${startPosition.x},${startPosition.y} -> ${endPosition.x},${endPosition.y}.`,
  };
}

// ============================================================================
// Earth Genasi Leaf UI
// ============================================================================
// The visible controls show the cost comparison, movement remaining, position,
// reset remount boundary, event log message, and explicit spell-only boundary.
// ============================================================================

const EarthGenasiRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [pathChoice, setPathChoice] = useState<EarthGenasiPathChoice>('legal');
  const [scenario, setScenario] = useState<EarthGenasiScenarioState>(
    () => createEarthGenasiScenario(race),
  );
  const previewResolution = getReadyResolution(pathChoice);

  // Commit the selected path and publish exactly the resulting transaction to
  // the parent shell's event log for visible audit evidence.
  const handleTraverse = () => {
    const nextScenario = resolveEarthGenasiEarthWalk(scenario, pathChoice);
    setScenario(nextScenario);
    onScenarioEvent(`Earth Genasi EARTH WALK ${nextScenario.resolution.status.toUpperCase()}: ${nextScenario.outcome}`);
  };

  const actor = scenario.actor;
  const canonicalSpells = getCanonicalEarthGenasiSpellProgression(race);
  const canonicalMergeWithStone = getCanonicalMergeWithStoneTrait(race);
  const abilityChoices = getCanonicalEarthGenasiSpellAbilityChoices(race);
  const bladeWardUseLimit = getCanonicalBladeWardUseLimit(race);
  const passWithoutTraceMinLevel = getCanonicalPassWithoutTraceMinLevel(race);
  const proficiencyBonus = actor ? calculateProficiencyBonus(actor.level) : null;
  const remainingMovement = actor
    ? actor.actionEconomy.movement.total - actor.actionEconomy.movement.used
    : null;

  return (
    <section aria-labelledby="earth-genasi-earth-walk-title" data-testid="earth-genasi-race-leaf">
      {/* The heading identifies the canonical Earth Walk transaction for assistive tools. */}
      <h4 id="earth-genasi-earth-walk-title">Earth Genasi Earth Walk</h4>

      {/* These facts come from Race data and intentionally do not imply spell execution. */}
      <p data-testid="earth-genasi-canonical-facts">
        Earth Walk: {getCanonicalEarthWalkTrait(race) ?? 'missing'} Merge with Stone: {canonicalMergeWithStone ?? 'missing'} Spell grants: {canonicalSpells.length > 0 ? canonicalSpells.map(spell => `level ${spell.minLevel} ${spell.spellId}`).join(', ') : 'none'}; Blade Ward uses {bladeWardUseLimit === 'proficiency_bonus' ? `PB +${proficiencyBonus ?? 'unknown'}` : 'unknown'} per Long Rest as a Bonus Action; Pass without Trace from level {passWithoutTraceMinLevel ?? 'unknown'}; ability choices: {abilityChoices.length > 0 ? abilityChoices.join(', ') : 'none'}.
      </p>

      {/* The selector makes both a legal and an over-budget movement receipt deterministic. */}
      <label htmlFor={EARTH_GENASI_EARTH_WALK_CONTROL_ID}>Path</label>
      <select
        id={EARTH_GENASI_EARTH_WALK_CONTROL_ID}
        value={pathChoice}
        onChange={event => setPathChoice(event.target.value as EarthGenasiPathChoice)}
      >
        <option value="legal">3-square ground/floor difficult path</option>
        <option value="over-budget">7-square over-budget path</option>
      </select>
      <Button type="button" onClick={handleTraverse}>Traverse Earth Walk path</Button>

      {/* The comparator makes the terrain-surcharge saving visible before and after commit. */}
      <p data-testid="earth-genasi-movement-comparison">
        Path: {previewResolution.pathChoice}; ordinary actor cost {previewResolution.ordinaryMovementFeet} ft; Earth Genasi cost {previewResolution.earthWalkMovementFeet} ft; saved {previewResolution.movementSavedFeet} ft.
      </p>

      {/* These fields expose position and native turn economy rather than only a success label. */}
      <p data-testid="earth-genasi-actor-facts">
        Actor: {actor?.name ?? 'missing'}; Position {actor?.position.x ?? 'unknown'},{actor?.position.y ?? 'unknown'}; Move {actor?.actionEconomy.movement.used ?? 'unknown'}/{actor?.actionEconomy.movement.total ?? 'unknown'} ({remainingMovement ?? 'unknown'} remaining); Action {actor?.actionEconomy.action.used ? 'used' : 'ready'}; Bonus Action {actor?.actionEconomy.bonusAction.used ? 'used' : 'ready'}.
      </p>
      <p aria-live="polite" role="status" data-testid="earth-genasi-outcome">{scenario.outcome}</p>

      {/* This boundary prevents canonical spell facts from being misread as fake casting. */}
      <p data-testid="earth-genasi-spell-boundary">
        Spell boundary: Merge with Stone grants and spellcasting ability choices are canonical facts only here; this leaf does not cast Blade Ward, apply Blade Ward effects, spend PB uses, cast Pass without Trace, or claim spell-slot/2D/3D proof.
      </p>
      <p data-testid="earth-genasi-movement-boundary">
        Movement boundary: native calculatePathMovementCost supplies the ordinary comparator and native action-economy helpers commit movement; because no race-aware terrain bypass exists in production pathfinding, this leaf uses a canonical-derived adapter only around the difficult-terrain multiplier.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed boundary restores the authored
// path, actor position, movement pool, and unresolved receipt baseline.
export const EarthGenasiRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <EarthGenasiRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export. Keeping
// registration local avoids a central list edit shared with other race leaves.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'earth-genasi-earth-walk',
  raceId: 'earth_genasi',
  label: 'Earth Genasi Earth Walk',
  description: 'Compare and resolve canonical Earth Walk movement across ground/floor Difficult Terrain with native movement and action-economy helpers.',
  Component: EarthGenasiRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
