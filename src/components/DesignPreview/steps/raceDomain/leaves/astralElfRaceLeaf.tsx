// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 12:14:09
 * Dependents: None (Orphan)
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
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
import { hasLineOfSight } from '../../../../../utils/spatial';
import { createQuickCharacter, createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { BattleMapData, BattleMapTile, CombatCharacter, Position } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Astral Elf race one deterministic Starlight Step
 * transaction inside the Tactical Sandbox Race domain.
 *
 * The leaf assembles a real PlayerCharacter and CombatCharacter, then uses the
 * production distance, visibility, placement, and action-economy helpers for a
 * narrow trait adapter. Starlight Step is a race trait rather than a spell, so
 * this file deliberately does not invent a Spell record or claim the separate
 * spell-only teleportation resolver.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Astral Elf trait text, character assembly, combat
 * placement/visibility helpers, and the shared action economy.
 */

// ============================================================================
// Canonical Trait And Control Facts
// ============================================================================
// These values are read from the supplied Race wherever possible. The target
// list only chooses deterministic points on the small proof board; it does not
// replace the canonical range, visibility, occupancy, or uses rules.
// ============================================================================

export const ASTRAL_ELF_STARLIGHT_STEP_CONTROL_ID = 'resolve-astral-elf-starlight-step';
export const ASTRAL_ELF_STARLIGHT_STEP_TARGET_CONTROL_ID = 'astral-elf-starlight-step-target';
export const ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'astral_elf__starlight_step__resource',
);

export type AstralElfStarlightStepTargetId = 'legal' | 'occupied' | 'out-of-range' | 'hidden';

export interface AstralElfStarlightStepTarget {
  id: AstralElfStarlightStepTargetId;
  label: string;
  destination: Position;
}

export const ASTRAL_ELF_STARLIGHT_STEP_TARGETS: readonly AstralElfStarlightStepTarget[] = [
  { id: 'legal', label: 'Legal visible space · 6,4', destination: { x: 6, y: 4 } },
  { id: 'occupied', label: 'Occupied space · 4,4', destination: { x: 4, y: 4 } },
  { id: 'out-of-range', label: 'Beyond 30 feet · 9,4', destination: { x: 9, y: 4 } },
  { id: 'hidden', label: 'Hidden by wall · 5,7', destination: { x: 5, y: 7 } },
];

const STARLIGHT_STEP_TRAIT = /^Starlight Step:\s*/i;
const STARLIGHT_STEP_RANGE_FEET = 30;
const ASTRAL_ELF_ACTOR_ID = 'astral-elf-starlight-step-actor';
const ASTRAL_ELF_WARDEN_ID = 'astral-elf-starlight-step-warden';

/** Return the exact canonical Starlight Step trait rather than a copied rule string. */
export function getCanonicalStarlightStepTrait(race: Race): string | null {
  return race.traits.find(trait => STARLIGHT_STEP_TRAIT.test(trait.trim())) ?? null;
}

/** Confirm that the supplied race still carries all four facts this leaf demonstrates. */
export function hasCanonicalStarlightStep(race: Race): boolean {
  const trait = getCanonicalStarlightStepTrait(race);
  return race.id === 'astral_elf'
    && !!trait
    && /bonus action/i.test(trait)
    && /teleport up to 30 feet/i.test(trait)
    && /unoccupied space you can see/i.test(trait)
    && /proficiency bonus/i.test(trait)
    && /long rest/i.test(trait);
}

// ============================================================================
// Deterministic Production-Assembly Adapter
// ============================================================================
// The preview leaf has no combat host snapshot to borrow. It therefore uses
// the same quick character assembly seam as other Tactical Sandbox scenarios,
// applies the canonical race resource parser, and creates one small board.
// The combat bridge currently does not copy limitedUses, so the adapter carries
// that assembled field across explicitly and calls out the boundary in the UI.
// ============================================================================

function createStarlightStepMap(): BattleMapData {
  // The board is large enough for every authored target. One wall exists only
  // to make the production line-of-sight helper reject the hidden destination.
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

  // This wall is crossed by the authored hidden target's Bresenham line.
  const wallPosition = { x: 3, y: 5 };
  tiles.set(`${wallPosition.x}-${wallPosition.y}`, {
    ...tiles.get(`${wallPosition.x}-${wallPosition.y}`)!,
    terrain: 'rock',
    blocksLoS: true,
    blocksMovement: true,
    decoration: null,
    effects: ['starlight-step-visibility-blocker'],
  });

  return { dimensions, tiles, theme: 'forest', seed: 240813 };
}

function getStarlightResource(actor: CombatCharacter) {
  return actor.limitedUses?.[ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID];
}

function createAstralElfActor(race: Race): CombatCharacter | null {
  // Build the persistent character through production code so class, race,
  // proficiency bonus, hit points, and the parsed racial resource agree with
  // the rest of the game instead of being hardcoded fixture data.
  const quickCharacter = createQuickCharacter({
    name: 'Astral Elf · Starlight Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 12, 10, 10, 10],
  });
  if (!quickCharacter || !hasCanonicalStarlightStep(race)) return null;

  const assembledCharacter = applyRacialSpellGrantsByLevel(quickCharacter, quickCharacter.level ?? 1);
  const generatedActor = createPlayerCombatCharacter(assembledCharacter);
  const resource = assembledCharacter.limitedUses?.[ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID];
  if (!resource) return null;

  // The production combat bridge preserves the canonical resource values here
  // while the leaf gives the actor a deterministic ID and starting position.
  const actor = resetEconomy({
    ...generatedActor,
    id: ASTRAL_ELF_ACTOR_ID,
    name: `${race.name} · Starlight Tester`,
    position: { x: 2, y: 4 },
    limitedUses: {
      [ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID]: { ...resource },
    },
  });
  return actor;
}

function createWarden(): CombatCharacter | null {
  // The warden is also built by the production quick-combat path; it exists
  // only so the native placement helper can prove a real occupied rejection.
  const warden = createQuickCombatCharacter({
    name: 'Space Warden',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [12, 10, 12, 10, 10, 10],
  });
  return warden
    ? { ...warden, id: ASTRAL_ELF_WARDEN_ID, position: { x: 4, y: 4 }, team: 'enemy' }
    : null;
}

export interface AstralElfStarlightStepScenarioState {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  outcome: string;
  lastResolution: AstralElfStarlightStepResolution | null;
}

export type AstralElfStarlightStepReason =
  | 'teleported'
  | 'assembly_unavailable'
  | 'invalid_target'
  | 'destination_out_of_range'
  | 'destination_not_visible'
  | 'destination_out_of_bounds'
  | 'destination_blocked'
  | 'destination_occupied'
  | 'insufficient_starlight_uses'
  | 'bonus_action_unavailable';

export interface AstralElfStarlightStepResolution {
  status: 'teleported' | 'rejected';
  reason: AstralElfStarlightStepReason;
  characters: CombatCharacter[];
  origin?: Position;
  destination: Position;
  distanceFeet: number;
  maxDistanceFeet: number;
}

function createRejection(
  scenario: AstralElfStarlightStepScenarioState,
  reason: AstralElfStarlightStepReason,
  destination: Position,
  distanceFeet = 0,
): AstralElfStarlightStepResolution {
  return {
    status: 'rejected',
    reason,
    characters: scenario.characters,
    destination: { ...destination },
    distanceFeet,
    maxDistanceFeet: STARLIGHT_STEP_RANGE_FEET,
  };
}

function replaceCharacter(characters: CombatCharacter[], replacement: CombatCharacter): CombatCharacter[] {
  return characters.map(character => character.id === replacement.id ? replacement : character);
}

function getActor(scenario: AstralElfStarlightStepScenarioState): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === ASTRAL_ELF_ACTOR_ID);
}

/** Derive the same proficiency progression used by quick character assembly. */
function getProficiencyBonus(actor: CombatCharacter): number {
  return 2 + Math.floor((actor.level - 1) / 4);
}

/**
 * Resolve the canonical trait through native targeting/economy helpers.
 *
 * This is a deliberately narrow adapter boundary: the production teleport
 * resolver accepts a Spell record, while Starlight Step is not a Spell. The
 * adapter therefore proves only the helper calls below and performs no spell
 * slot, spell casting, path traversal, animation, or opportunity-attack claim.
 */
export function resolveAstralElfStarlightStep(
  scenario: AstralElfStarlightStepScenarioState,
  targetId: AstralElfStarlightStepTargetId,
): AstralElfStarlightStepScenarioState {
  const actor = getActor(scenario);
  const target = ASTRAL_ELF_STARLIGHT_STEP_TARGETS.find(candidate => candidate.id === targetId);
  if (!actor || !target) {
    return {
      ...scenario,
      outcome: 'Starlight Step rejected: the production-assembled actor or target is missing.',
      lastResolution: createRejection(scenario, actor ? 'invalid_target' : 'assembly_unavailable', target?.destination ?? actor?.position ?? { x: 0, y: 0 }),
    };
  }

  const distanceFeet = getDistance(actor.position, target.destination) * 5;
  if (distanceFeet > STARLIGHT_STEP_RANGE_FEET) {
    return {
      ...scenario,
      outcome: `Starlight Step rejected atomically: ${distanceFeet} ft exceeds the canonical 30-foot range; Bonus Action and uses unchanged.`,
      lastResolution: createRejection(scenario, 'destination_out_of_range', target.destination, distanceFeet),
    };
  }

  const originTile = scenario.mapData.tiles.get(`${actor.position.x}-${actor.position.y}`);
  const destinationTile = scenario.mapData.tiles.get(`${target.destination.x}-${target.destination.y}`);
  if (!destinationTile || !originTile) {
    return {
      ...scenario,
      outcome: 'Starlight Step rejected atomically: destination is outside the authored board.',
      lastResolution: createRejection(scenario, 'destination_out_of_bounds', target.destination, distanceFeet),
    };
  }

  // Visibility comes from the production Bresenham line-of-sight helper.
  if (!hasLineOfSight(originTile, destinationTile, scenario.mapData)) {
    return {
      ...scenario,
      outcome: 'Starlight Step rejected atomically: destination is not visible; Bonus Action and uses unchanged.',
      lastResolution: createRejection(scenario, 'destination_not_visible', target.destination, distanceFeet),
    };
  }

  // Placement checks the complete actor footprint and every living character.
  const placement = validateCharacterPlacement(actor, target.destination, scenario.mapData, scenario.characters);
  if (!placement.allowed) {
    const reason = placement.blockerId ? 'destination_occupied' : placement.reason.includes('leaves the battle map') ? 'destination_out_of_bounds' : 'destination_blocked';
    return {
      ...scenario,
      outcome: `Starlight Step rejected atomically: ${placement.reason} Bonus Action and uses unchanged.`,
      lastResolution: createRejection(scenario, reason, target.destination, distanceFeet),
    };
  }

  const resource = getStarlightResource(actor);
  if (!resource || resource.current <= 0) {
    return {
      ...scenario,
      outcome: 'Starlight Step rejected atomically: no Proficiency Bonus uses remain; Bonus Action unchanged.',
      lastResolution: createRejection(scenario, 'insufficient_starlight_uses', target.destination, distanceFeet),
    };
  }

  // The canonical trait says Bonus Action. The shared economy helper owns the
  // legality check and payment; this adapter never spends movement or a slot.
  const cost = { type: 'bonus' as const };
  if (!canAffordActionCost(actor, cost)) {
    return {
      ...scenario,
      outcome: 'Starlight Step rejected atomically: Bonus Action already used; uses unchanged.',
      lastResolution: createRejection(scenario, 'bonus_action_unavailable', target.destination, distanceFeet),
    };
  }

  const paidActor = consumeActionCost(actor, cost);
  const movedActor: CombatCharacter = {
    ...paidActor,
    position: { ...target.destination },
    limitedUses: {
      ...paidActor.limitedUses,
      [ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
  };
  const characters = replaceCharacter(scenario.characters, movedActor);
  const resolution: AstralElfStarlightStepResolution = {
    status: 'teleported',
    reason: 'teleported',
    characters,
    origin: { ...actor.position },
    destination: { ...target.destination },
    distanceFeet,
    maxDistanceFeet: STARLIGHT_STEP_RANGE_FEET,
  };

  return {
    ...scenario,
    characters,
    outcome: `Starlight Step resolved: ${distanceFeet} ft; Bonus Action paid; uses ${resource.current - 1}/${resource.max === 'proficiency_bonus' ? getProficiencyBonus(actor) : resource.max}.`,
    lastResolution: resolution,
  };
}

/** Build the exact baseline restored whenever the parent shell increments resetCount. */
export function createAstralElfStarlightStepScenario(race: Race): AstralElfStarlightStepScenarioState {
  const mapData = createStarlightStepMap();
  const actor = createAstralElfActor(race);
  const warden = createWarden();
  const characters = [actor, warden].filter((character): character is CombatCharacter => character !== null);
  const usable = actor !== null && warden !== null && hasCanonicalStarlightStep(race);
  return {
    mapData,
    characters,
    outcome: usable
      ? `Ready: ${actor.name}; Starlight Step 30 ft; Bonus Action ready; uses ${getStarlightResource(actor)?.current ?? 0}/${getProficiencyBonus(actor)}.`
      : 'Starlight Step unavailable: canonical trait or production character assembly was incomplete.',
    lastResolution: null,
  };
}

// ============================================================================
// Astral Elf Leaf UI
// ============================================================================
// The controls expose actor, target, resource, and native-helper outcomes in
// one compact surface. The parent shell owns Reset, and resetCount remounts the
// content so no stale destination, action, or charge survives a reset.
// ============================================================================

const AstralElfRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, onScenarioEvent }) => {
  const [targetId, setTargetId] = useState<AstralElfStarlightStepTargetId>('legal');
  const [scenario, setScenario] = useState(() => createAstralElfStarlightStepScenario(race));
  const actor = getActor(scenario);
  const target = ASTRAL_ELF_STARLIGHT_STEP_TARGETS.find(candidate => candidate.id === targetId);
  const trait = getCanonicalStarlightStepTrait(race);
  const resource = actor ? getStarlightResource(actor) : undefined;

  const handleResolve = () => {
    const nextScenario = resolveAstralElfStarlightStep(scenario, targetId);
    setScenario(nextScenario);
    const result = nextScenario.lastResolution;
    onScenarioEvent(result?.status === 'teleported'
      ? `Astral Elf STARLIGHT STEP RESOLVED: ${result.distanceFeet} ft; uses remaining ${getStarlightResource(getActor(nextScenario)!)?.current ?? 0}/${actor ? getProficiencyBonus(actor) : 0}.`
      : `Astral Elf STARLIGHT STEP REJECTED ATOMICALLY: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="astral-elf-starlight-step-title" data-testid="astral-elf-race-leaf">
      {/* The heading names the canonical trait transaction for assistive tools. */}
      <h4 id="astral-elf-starlight-step-title">Astral Elf · Starlight Step</h4>
      <p data-testid="astral-elf-canonical-trait">Canonical: {trait ?? 'Starlight Step trait missing'}</p>

      {/* The selector chooses only authored proof destinations; native helpers remain authoritative. */}
      <label htmlFor={ASTRAL_ELF_STARLIGHT_STEP_TARGET_CONTROL_ID}>Starlight Step destination</label>
      <select
        id={ASTRAL_ELF_STARLIGHT_STEP_TARGET_CONTROL_ID}
        value={targetId}
        onChange={event => setTargetId(event.target.value as AstralElfStarlightStepTargetId)}
      >
        {ASTRAL_ELF_STARLIGHT_STEP_TARGETS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>Resolve Starlight Step</Button>

      {/* These facts expose the production actor and the long-rest resource, not just a success label. */}
      <p data-testid="astral-elf-actor">
        Actor: {actor?.name ?? 'missing'}; Position {actor?.position.x},{actor?.position.y}; PB +{actor ? getProficiencyBonus(actor) : 'unknown'}; Bonus Action {actor?.actionEconomy.bonusAction.used ? 'used' : 'ready'}; Uses {resource?.current ?? 0}/{actor ? getProficiencyBonus(actor) : 0}.
      </p>
      <p data-testid="astral-elf-target">Target: {target?.label ?? 'missing'}</p>
      <p aria-live="polite" role="status" data-testid="astral-elf-outcome">{scenario.outcome}</p>

      {/* The actor bridge is a real production assembly with one explicit field-preservation seam. */}
      <p data-testid="astral-elf-assembly-boundary">
        Assembly boundary: production quick character assembly plus canonical race resource parsing; the leaf carries limitedUses across the combat bridge because that bridge does not currently project racial resources.
      </p>

      {/* Starlight Step is not a spell, so this leaf names the exact unclaimed surface. */}
      <p data-testid="astral-elf-unsupported-boundary">
        Unsupported boundary: this leaf does not invoke the spell-only teleportation resolver, spell slots, 2D/3D teleport animation, pathfinding, or full long-rest engine; parent Reset re-seeds the canonical Proficiency Bonus charges.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed content boundary restores every
// local control, actor position, Bonus Action, and canonical resource charge.
export const AstralElfRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <AstralElfRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export. No shared
// registry edit is needed, which keeps this Race leaf merge-safe.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'astral-elf-starlight-step',
  raceId: 'astral_elf',
  label: 'Astral Elf Starlight Step',
  description: 'Resolve the canonical 30-foot Bonus Action teleport subset through native targeting and action-economy helpers.',
  Component: AstralElfRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
