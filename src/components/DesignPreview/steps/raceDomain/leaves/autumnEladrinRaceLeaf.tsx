// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 12:44:56
 * Dependents: None (Orphan)
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { calculateProficiencyBonus, rollSavingThrow } from '../../../../../utils/character/savingThrowUtils';
import {
  getAbilityModifierValue,
} from '../../../../../utils/character/statUtils';
import {
  getDistance,
  createPlayerCombatCharacter,
  validateCharacterPlacement,
} from '../../../../../utils/combat/combatUtils';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../../utils/combat/actionEconomyUtils';
import { applyRuntimeStatusCondition } from '../../../../../utils/combat/statusConditionUtils';
import { hasLineOfSight } from '../../../../../utils/spatial';
import { createQuickCharacter, createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type {
  ActiveCondition,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Position,
  StatusEffect,
} from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Autumn Eladrin race a deterministic Fey Step
 * transaction inside the Tactical Sandbox Race domain.
 *
 * The leaf assembles a production PlayerCharacter and CombatCharacter, then
 * uses native distance, visibility, placement, action-economy, save, and
 * condition helpers. Fey Step remains a race trait: no Spell record or spell
 * slot is invented. The rider's one-minute and damage-break facts are stored
 * in the same condition mirrors used by combat, while full combat-clock
 * expiry remains outside this preview adapter.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Autumn Eladrin trait text, racial resource parsing,
 * production character assembly, combat targeting helpers, and native status
 * condition mirroring.
 */

// ============================================================================
// Canonical Trait And Deterministic Controls
// ============================================================================
// The trait text is always read from the supplied Race. Authored target points
// only make the native checks repeatable; they do not replace canonical rules.
// ============================================================================

export const AUTUMN_ELADRIN_FEY_STEP_CONTROL_ID = 'resolve-autumn-eladrin-fey-step';
export const AUTUMN_ELADRIN_FEY_STEP_TARGET_CONTROL_ID = 'autumn-eladrin-fey-step-target';
export const AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'autumn_eladrin__fey_step_autumn__resource',
);

export type AutumnEladrinFeyStepTargetId = 'legal' | 'occupied' | 'out-of-range' | 'hidden';

export interface AutumnEladrinFeyStepTarget {
  id: AutumnEladrinFeyStepTargetId;
  label: string;
  destination: Position;
}

export const AUTUMN_ELADRIN_FEY_STEP_TARGETS: readonly AutumnEladrinFeyStepTarget[] = [
  { id: 'legal', label: 'Legal visible space - 6,4', destination: { x: 6, y: 4 } },
  { id: 'occupied', label: 'Occupied space - 4,4', destination: { x: 4, y: 4 } },
  { id: 'out-of-range', label: 'Beyond 30 feet - 9,4', destination: { x: 9, y: 4 } },
  { id: 'hidden', label: 'Hidden by wall - 5,7', destination: { x: 5, y: 7 } },
];

const AUTUMN_FEY_STEP_TRAIT = /^Fey Step \(Autumn\):\s*/i;
const FEY_STEP_RANGE_FEET = 30;
const FEY_STEP_RIDER_RANGE_FEET = 10;
const AUTUMN_ELADRIN_ACTOR_ID = 'autumn-eladrin-fey-step-actor';
const AUTUMN_ELADRIN_WARDEN_ID = 'autumn-eladrin-fey-step-warden';
const AUTUMN_ELADRIN_RIDER_ONE_ID = 'autumn-eladrin-fey-step-rider-one';
const AUTUMN_ELADRIN_RIDER_TWO_ID = 'autumn-eladrin-fey-step-rider-two';
const AUTUMN_FEY_STEP_SOURCE = 'Fey Step (Autumn)';

/** Return the exact canonical Autumn Fey Step trait instead of copied prose. */
export function getCanonicalAutumnFeyStepTrait(race: Race): string | null {
  return race.traits.find(trait => AUTUMN_FEY_STEP_TRAIT.test(trait.trim())) ?? null;
}

/** Confirm that the supplied race still carries every fact this leaf demonstrates. */
export function hasCanonicalAutumnFeyStep(race: Race): boolean {
  const trait = getCanonicalAutumnFeyStepTrait(race);
  return race.id === 'autumn_eladrin'
    && !!trait
    && /bonus action/i.test(trait)
    && /teleport up to 30 feet/i.test(trait)
    && /unoccupied space you can see/i.test(trait)
    && /proficiency bonus/i.test(trait)
    && /long rest/i.test(trait)
    && /up to two creatures/i.test(trait)
    && /within 10 feet/i.test(trait)
    && /wisdom saving throw/i.test(trait)
    && /charmed by you for 1 minute/i.test(trait)
    && /until you or your companions deal any damage/i.test(trait);
}

// ============================================================================
// Deterministic Production Assembly
// ============================================================================
// The preview has no live combat snapshot, so it creates disposable actors
// through the same quick-character and combat bridges used by other sandbox
// scenarios. The racial resource is parsed from the canonical trait library.
// ============================================================================

function createAutumnFeyStepMap(): BattleMapData {
  // This small board contains every authored destination and rider position.
  const dimensions = { width: 12, height: 10 };
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

  // This wall crosses the authored hidden target's line so native visibility
  // rejects it before the Bonus Action or racial charge can be paid.
  const wallPosition = { x: 3, y: 5 };
  tiles.set(`${wallPosition.x}-${wallPosition.y}`, {
    ...tiles.get(`${wallPosition.x}-${wallPosition.y}`)!,
    terrain: 'rock',
    blocksLoS: true,
    blocksMovement: true,
    effects: ['autumn-fey-step-visibility-blocker'],
  });

  return { dimensions, tiles, theme: 'forest', seed: 240813 };
}

function getFeyStepResource(actor: CombatCharacter) {
  return actor.limitedUses?.[AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID];
}

function createAutumnEladrinActor(race: Race): CombatCharacter | null {
  // Charisma is the deterministic chosen ability for this preview's rider DC.
  // The actor still gets every other field from production character assembly.
  const quickCharacter = createQuickCharacter({
    name: 'Autumn Eladrin - Fey Step Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 12, 10, 10, 16],
  });
  if (!quickCharacter || !hasCanonicalAutumnFeyStep(race)) return null;

  // This parser is the source of the PB-per-Long-Rest resource. It is not a
  // manually fabricated spell grant, and Fey Step is never placed in a spellbook.
  const assembledCharacter = applyRacialSpellGrantsByLevel(quickCharacter, quickCharacter.level ?? 1);
  const generatedActor = createPlayerCombatCharacter(assembledCharacter);
  const resource = assembledCharacter.limitedUses?.[AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID];
  if (!resource) return null;

  // The combat bridge currently does not project racial limitedUses, so this
  // leaf carries that parsed field across the explicit preview seam.
  return resetEconomy({
    ...generatedActor,
    id: AUTUMN_ELADRIN_ACTOR_ID,
    name: `${race.name} - Fey Step Tester`,
    position: { x: 2, y: 4 },
    limitedUses: {
      [AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID]: { ...resource },
    },
  });
}

function createRider(
  id: string,
  name: string,
  position: Position,
  wisdomScore: number,
): CombatCharacter | null {
  // Rider creatures come from the production quick-combat path. Their fixed
  // Wisdom scores and save rolls make the preview show one fail and one success.
  const rider = createQuickCombatCharacter({
    name,
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 10, 10, wisdomScore, 10],
  });
  return rider
    ? { ...rider, id, position, team: 'enemy' }
    : null;
}

function createAutumnFeyStepRiderOne(): CombatCharacter | null {
  return createRider(AUTUMN_ELADRIN_RIDER_ONE_ID, 'Harvest Witness', { x: 7, y: 4 }, 8);
}

function createAutumnFeyStepRiderTwo(): CombatCharacter | null {
  return createRider(AUTUMN_ELADRIN_RIDER_TWO_ID, 'Harvest Guardian', { x: 6, y: 6 }, 16);
}

function createAutumnFeyStepWarden(): CombatCharacter | null {
  // The warden occupies the authored rejection destination so the production
  // placement helper can demonstrate an atomic occupied-space guard.
  const warden = createQuickCombatCharacter({
    name: 'Autumn Space Warden',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [12, 10, 12, 10, 10, 10],
  });
  return warden
    ? { ...warden, id: AUTUMN_ELADRIN_WARDEN_ID, position: { x: 4, y: 4 }, team: 'enemy' }
    : null;
}

// ============================================================================
// Scenario State And Native Resolution
// ============================================================================
// A resolution is either a complete teleport transaction or an unchanged
// rejection. Rider saves happen only after the teleport guard sequence passes.
// ============================================================================

export interface AutumnEladrinFeyStepRiderResult {
  targetId: string;
  targetName: string;
  distanceFeet: number;
  saveRoll: number;
  saveTotal: number;
  dc: number;
  resisted: boolean;
  charmed: boolean;
}

export interface AutumnEladrinFeyStepScenarioState {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  outcome: string;
  lastResolution: AutumnEladrinFeyStepResolution | null;
}

export type AutumnEladrinFeyStepReason =
  | 'teleported'
  | 'assembly_unavailable'
  | 'invalid_target'
  | 'destination_out_of_range'
  | 'destination_not_visible'
  | 'destination_out_of_bounds'
  | 'destination_blocked'
  | 'destination_occupied'
  | 'insufficient_fey_step_uses'
  | 'bonus_action_unavailable';

export interface AutumnEladrinFeyStepResolution {
  status: 'teleported' | 'rejected';
  reason: AutumnEladrinFeyStepReason;
  characters: CombatCharacter[];
  destination: Position;
  origin?: Position;
  distanceFeet: number;
  maxDistanceFeet: number;
  saveDc?: number;
  riderResults: readonly AutumnEladrinFeyStepRiderResult[];
}

function getActor(scenario: AutumnEladrinFeyStepScenarioState): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === AUTUMN_ELADRIN_ACTOR_ID);
}

function replaceCharacter(characters: CombatCharacter[], replacement: CombatCharacter): CombatCharacter[] {
  return characters.map(character => character.id === replacement.id ? replacement : character);
}

function getRiderTargets(scenario: AutumnEladrinFeyStepScenarioState): CombatCharacter[] {
  return scenario.characters.filter(character => (
    character.id === AUTUMN_ELADRIN_RIDER_ONE_ID || character.id === AUTUMN_ELADRIN_RIDER_TWO_ID
  ));
}

function getAutumnSaveDc(actor: CombatCharacter): number {
  // The player-facing choice is Charisma for this deterministic preview actor.
  const charisma = actor.stats.charisma ?? 10;
  return 8 + calculateProficiencyBonus(actor.level || 1) + getAbilityModifierValue(charisma);
}

function createRejection(
  scenario: AutumnEladrinFeyStepScenarioState,
  reason: AutumnEladrinFeyStepReason,
  destination: Position,
  distanceFeet = 0,
): AutumnEladrinFeyStepResolution {
  return {
    status: 'rejected',
    reason,
    characters: scenario.characters,
    destination: { ...destination },
    distanceFeet,
    maxDistanceFeet: FEY_STEP_RANGE_FEET,
    riderResults: [],
  };
}

function applyAutumnRider(
  actor: CombatCharacter,
  target: CombatCharacter,
  saveDc: number,
  saveRoll: number,
): { character: CombatCharacter; result: AutumnEladrinFeyStepRiderResult } {
  // The native saving-throw helper supplies the ability modifier and any
  // target save proficiency/advantage rules while this fixed RNG keeps proof
  // repeatable. No spell record is needed for a race-trait saving throw.
  const save = rollSavingThrow(target, 'Wisdom', saveDc, undefined, undefined, undefined, {
    rng: () => saveRoll,
  });
  const distanceFeet = getDistance(actor.position, target.position) * 5;
  if (save.success) {
    return {
      character: target,
      result: {
        targetId: target.id,
        targetName: target.name,
        distanceFeet,
        saveRoll: save.roll ?? saveRoll,
        saveTotal: save.total,
        dc: saveDc,
        resisted: true,
        charmed: false,
      },
    };
  }

  // The native runtime condition helper writes both conditions and the legacy
  // status mirror. Metadata preserves the one-minute and damage-break facts.
  const condition: ActiveCondition = {
    name: 'Charmed',
    duration: { type: 'minutes', value: 1 },
    appliedTurn: 1,
    source: AUTUMN_FEY_STEP_SOURCE,
    sourceCasterId: actor.id,
    breakTriggers: ['target_takes_damage'],
    socialLifecycle: {
      kind: 'autumn_eladrin_charm',
      endsIfDamagedByCasterOrAllies: true,
    },
  };
  const status: StatusEffect = {
    id: `autumn-fey-step-charmed-${target.id}`,
    name: 'Charmed',
    type: 'debuff',
    duration: 10,
    description: 'Charmed for 1 minute, or until the Autumn Eladrin or companions deal damage.',
    source: AUTUMN_FEY_STEP_SOURCE,
    sourceCasterId: actor.id,
    breakTriggers: ['target_takes_damage'],
    socialLifecycle: {
      kind: 'autumn_eladrin_charm',
      endsIfDamagedByCasterOrAllies: true,
    },
    effect: { type: 'condition' },
  };
  const applied = applyRuntimeStatusCondition(target, status, condition);
  return {
    character: applied.character,
    result: {
      targetId: target.id,
      targetName: target.name,
      distanceFeet,
      saveRoll: save.roll ?? saveRoll,
      saveTotal: save.total,
      dc: saveDc,
      resisted: false,
      charmed: true,
    },
  };
}

/** Resolve the canonical 30-foot teleport and its deterministic Autumn rider. */
export function resolveAutumnEladrinFeyStep(
  scenario: AutumnEladrinFeyStepScenarioState,
  targetId: AutumnEladrinFeyStepTargetId,
): AutumnEladrinFeyStepScenarioState {
  const actor = getActor(scenario);
  const target = AUTUMN_ELADRIN_FEY_STEP_TARGETS.find(candidate => candidate.id === targetId);
  if (!actor || !target) {
    return {
      ...scenario,
      outcome: 'Fey Step (Autumn) rejected: the production-assembled actor or target is missing.',
      lastResolution: createRejection(
        scenario,
        actor ? 'invalid_target' : 'assembly_unavailable',
        target?.destination ?? actor?.position ?? { x: 0, y: 0 },
      ),
    };
  }

  const distanceFeet = getDistance(actor.position, target.destination) * 5;
  if (distanceFeet > FEY_STEP_RANGE_FEET) {
    return {
      ...scenario,
      outcome: `Fey Step (Autumn) rejected atomically: ${distanceFeet} ft exceeds 30 feet; Bonus Action and uses unchanged.`,
      lastResolution: createRejection(scenario, 'destination_out_of_range', target.destination, distanceFeet),
    };
  }

  const originTile = scenario.mapData.tiles.get(`${actor.position.x}-${actor.position.y}`);
  const destinationTile = scenario.mapData.tiles.get(`${target.destination.x}-${target.destination.y}`);
  if (!originTile || !destinationTile) {
    return {
      ...scenario,
      outcome: 'Fey Step (Autumn) rejected atomically: destination is outside the authored board.',
      lastResolution: createRejection(scenario, 'destination_out_of_bounds', target.destination, distanceFeet),
    };
  }

  // Native line-of-sight owns the canonical "space you can see" guard.
  if (!hasLineOfSight(originTile, destinationTile, scenario.mapData)) {
    return {
      ...scenario,
      outcome: 'Fey Step (Autumn) rejected atomically: destination is not visible; Bonus Action and uses unchanged.',
      lastResolution: createRejection(scenario, 'destination_not_visible', target.destination, distanceFeet),
    };
  }

  // Native placement checks the full actor footprint and every other creature.
  const placement = validateCharacterPlacement(actor, target.destination, scenario.mapData, scenario.characters);
  if (!placement.allowed) {
    const reason = placement.blockerId
      ? 'destination_occupied'
      : placement.reason.includes('leaves the battle map')
        ? 'destination_out_of_bounds'
        : 'destination_blocked';
    return {
      ...scenario,
      outcome: `Fey Step (Autumn) rejected atomically: ${placement.reason} Bonus Action and uses unchanged.`,
      lastResolution: createRejection(scenario, reason, target.destination, distanceFeet),
    };
  }

  const resource = getFeyStepResource(actor);
  if (!resource || resource.current <= 0) {
    return {
      ...scenario,
      outcome: 'Fey Step (Autumn) rejected atomically: no Proficiency Bonus uses remain; Bonus Action unchanged.',
      lastResolution: createRejection(scenario, 'insufficient_fey_step_uses', target.destination, distanceFeet),
    };
  }

  // The native action-economy helper owns the Bonus Action legality and payment.
  const cost = { type: 'bonus' as const };
  if (!canAffordActionCost(actor, cost)) {
    return {
      ...scenario,
      outcome: 'Fey Step (Autumn) rejected atomically: Bonus Action already used; uses unchanged.',
      lastResolution: createRejection(scenario, 'bonus_action_unavailable', target.destination, distanceFeet),
    };
  }

  const paidActor = consumeActionCost(actor, cost);
  const movedActor: CombatCharacter = {
    ...paidActor,
    position: { ...target.destination },
    limitedUses: {
      ...paidActor.limitedUses,
      [AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
  };
  let characters = replaceCharacter(scenario.characters, movedActor);
  const saveDc = getAutumnSaveDc(actor);
  const riderResults: AutumnEladrinFeyStepRiderResult[] = [];

  // Up to two authored creatures are checked from the post-teleport position.
  // Each line-of-sight and range check is native; the fixed rolls are proof input.
  for (const riderTarget of getRiderTargets(scenario).slice(0, 2)) {
    const riderTile = scenario.mapData.tiles.get(`${riderTarget.position.x}-${riderTarget.position.y}`);
    const riderDistanceFeet = getDistance(movedActor.position, riderTarget.position) * 5;
    if (!riderTile || riderDistanceFeet > FEY_STEP_RIDER_RANGE_FEET || !hasLineOfSight(destinationTile, riderTile, scenario.mapData)) {
      continue;
    }
    const deterministicRoll = riderTarget.id === AUTUMN_ELADRIN_RIDER_ONE_ID ? 0.1 : 0.95;
    const rider = applyAutumnRider(movedActor, riderTarget, saveDc, deterministicRoll);
    characters = replaceCharacter(characters, rider.character);
    riderResults.push(rider.result);
  }

  const charmedCount = riderResults.filter(result => result.charmed).length;
  const outcome = `Fey Step (Autumn) resolved: ${distanceFeet} ft; Bonus Action paid; uses ${resource.current - 1}/${calculateProficiencyBonus(actor.level || 1)}; DC ${saveDc}; ${charmedCount} creature${charmedCount === 1 ? '' : 's'} charmed.`;
  return {
    ...scenario,
    characters,
    outcome,
    lastResolution: {
      status: 'teleported',
      reason: 'teleported',
      characters,
      origin: { ...actor.position },
      destination: { ...target.destination },
      distanceFeet,
      maxDistanceFeet: FEY_STEP_RANGE_FEET,
      saveDc,
      riderResults,
    },
  };
}

/** Build the baseline restored when the parent shell increments resetCount. */
export function createAutumnEladrinFeyStepScenario(race: Race): AutumnEladrinFeyStepScenarioState {
  const mapData = createAutumnFeyStepMap();
  const actor = createAutumnEladrinActor(race);
  const warden = createAutumnFeyStepWarden();
  const riderOne = createAutumnFeyStepRiderOne();
  const riderTwo = createAutumnFeyStepRiderTwo();
  const characters = [actor, warden, riderOne, riderTwo].filter((character): character is CombatCharacter => character !== null);
  const usable = actor !== null && warden !== null && riderOne !== null && riderTwo !== null && hasCanonicalAutumnFeyStep(race);
  return {
    mapData,
    characters,
    outcome: usable
      ? `Ready: ${actor.name}; Fey Step (Autumn) 30 ft; Bonus Action ready; uses ${getFeyStepResource(actor)?.current ?? 0}/${calculateProficiencyBonus(actor.level || 1)}; rider DC ${getAutumnSaveDc(actor)}.`
      : 'Fey Step (Autumn) unavailable: canonical trait or production character assembly was incomplete.',
    lastResolution: null,
  };
}

// ============================================================================
// Autumn Eladrin Leaf UI
// ============================================================================
// The controls expose canonical text, actor/resource/action facts, rider save
// outcomes, the event callback, and the exact expiry boundary. Parent Reset
// remounts this keyed content so no local selection or charge survives.
// ============================================================================

const AutumnEladrinRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, state, onScenarioEvent }) => {
  const [targetId, setTargetId] = useState<AutumnEladrinFeyStepTargetId>('legal');
  const [scenario, setScenario] = useState(() => createAutumnEladrinFeyStepScenario(race));
  const actor = getActor(scenario);
  const target = AUTUMN_ELADRIN_FEY_STEP_TARGETS.find(candidate => candidate.id === targetId);
  const trait = getCanonicalAutumnFeyStepTrait(race);
  const resource = actor ? getFeyStepResource(actor) : undefined;
  const riderResults = scenario.lastResolution?.riderResults ?? [];

  const handleResolve = () => {
    const nextScenario = resolveAutumnEladrinFeyStep(scenario, targetId);
    setScenario(nextScenario);
    const result = nextScenario.lastResolution;
    onScenarioEvent(result?.status === 'teleported'
      ? `Autumn Eladrin FEY STEP RESOLVED: ${result.distanceFeet} ft; ${result.riderResults.filter(rider => rider.charmed).length} charmed; uses ${getFeyStepResource(getActor(nextScenario)!)?.current ?? 0}/${actor ? calculateProficiencyBonus(actor.level || 1) : 0}.`
      : `Autumn Eladrin FEY STEP REJECTED ATOMICALLY: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="autumn-eladrin-fey-step-title" data-testid="autumn-eladrin-race-leaf">
      {/* The heading and canonical paragraph are the source-backed rules surface. */}
      <h4 id="autumn-eladrin-fey-step-title">Autumn Eladrin - Fey Step (Autumn)</h4>
      <p data-testid="autumn-eladrin-canonical-trait">Canonical: {trait ?? 'Fey Step (Autumn) trait missing'}</p>

      {/* The selector chooses only authored proof destinations; native helpers remain authoritative. */}
      <label htmlFor={AUTUMN_ELADRIN_FEY_STEP_TARGET_CONTROL_ID}>Fey Step destination</label>
      <select
        id={AUTUMN_ELADRIN_FEY_STEP_TARGET_CONTROL_ID}
        value={targetId}
        onChange={event => setTargetId(event.target.value as AutumnEladrinFeyStepTargetId)}
      >
        {AUTUMN_ELADRIN_FEY_STEP_TARGETS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>Resolve Fey Step (Autumn)</Button>

      {/* These facts prove the production actor, position, action, and parsed racial resource. */}
      <p data-testid="autumn-eladrin-actor">
        Actor: {actor?.name ?? 'missing'}; Position {actor?.position.x},{actor?.position.y}; PB +{actor ? calculateProficiencyBonus(actor.level || 1) : 'unknown'}; Chosen DC ability Charisma; Bonus Action {actor?.actionEconomy.bonusAction.used ? 'used' : 'ready'}; Uses {resource?.current ?? 0}/{actor ? calculateProficiencyBonus(actor.level || 1) : 0}.
      </p>
      <p data-testid="autumn-eladrin-target">Target: {target?.label ?? 'missing'}</p>
      <p data-testid="autumn-eladrin-rider-facts">Autumn rider: up to 2 visible creatures within 10 feet after teleport; Wisdom save DC 8 + PB + Charisma; one-minute Charmed condition or damage break.</p>
      <p data-testid="autumn-eladrin-rider-results">
        Rider results: {riderResults.length === 0 ? 'not resolved' : riderResults.map(result => `${result.targetName}: ${result.resisted ? 'resisted' : 'Charmed'} (${result.saveTotal} vs DC ${result.dc})`).join('; ')}
      </p>
      <p aria-live="polite" role="status" data-testid="autumn-eladrin-outcome">{scenario.outcome}</p>

      {/* This explains the one deliberately preserved seam between persistent and combat actors. */}
      <p data-testid="autumn-eladrin-assembly-boundary">
        Assembly boundary: production quick character assembly plus canonical racial resource parsing; the leaf carries limitedUses across the combat bridge because that bridge does not currently project racial resources.
      </p>

      {/* This boundary prevents the preview from claiming mechanics it does not execute. */}
      <p data-testid="autumn-eladrin-unsupported-boundary">
        Unsupported boundary: this leaf does not invent a spell record, spend spell slots, animate 2D/3D teleportation, run pathfinding, or execute the full combat turn/damage expiry loop; native condition metadata records one minute and target-takes-damage break facts.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed boundary restores control,
// actor position, Bonus Action, resource charges, and rider conditions.
export const AutumnEladrinRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <AutumnEladrinRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export. Keeping
// the registration local avoids a shared-registry edit and merge conflict.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'autumn-eladrin-fey-step',
  raceId: 'autumn_eladrin',
  label: 'Autumn Eladrin Fey Step',
  description: 'Resolve the canonical 30-foot Bonus Action teleport and deterministic Autumn charm rider through native helpers.',
  Component: AutumnEladrinRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
