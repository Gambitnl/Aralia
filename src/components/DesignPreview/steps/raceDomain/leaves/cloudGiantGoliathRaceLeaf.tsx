// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 15:25:57
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
  createPlayerCombatCharacter,
  getDistance,
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
 * This file gives Cloud Giant Goliath a deterministic Cloud's Jaunt transaction
 * in the Tactical Sandbox Race domain. It assembles a real combat actor, keeps
 * the canonical Proficiency Bonus resource, and uses native distance, sight,
 * placement, and action-economy helpers before applying the narrow race move.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: the canonical Cloud Giant Goliath race, character assembly,
 * combat placement/visibility helpers, and the shared action economy.
 */

// ============================================================================
// Canonical Cloud's Jaunt Facts
// ============================================================================
// These constants identify the parsed racial resource and the authored proof
// points. The supplied Race remains the rule authority; the points only make
// success and failure deterministic for tests and the preview controls.
// ============================================================================

export const CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_CONTROL_ID = 'resolve-cloud-giant-goliath-clouds-jaunt';
export const CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TARGET_CONTROL_ID = 'cloud-giant-goliath-clouds-jaunt-target';
export const CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'cloud_giant_goliath__cloud_s_jaunt__resource',
);
export const CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RANGE_FEET = 30;

export type CloudGiantGoliathCloudsJauntTargetId = 'legal' | 'occupied' | 'out-of-range';

export interface CloudGiantGoliathCloudsJauntTarget {
  id: CloudGiantGoliathCloudsJauntTargetId;
  label: string;
  destination: Position;
}

export const CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TARGETS: readonly CloudGiantGoliathCloudsJauntTarget[] = [
  { id: 'legal', label: 'Legal visible space · 6,4', destination: { x: 6, y: 4 } },
  { id: 'occupied', label: 'Occupied space · 4,4', destination: { x: 4, y: 4 } },
  { id: 'out-of-range', label: 'Beyond 30 feet · 9,4', destination: { x: 9, y: 4 } },
];

const CLOUD_GIANT_GOLIATH_ACTOR_ID = 'cloud-giant-goliath-clouds-jaunt-actor';
const CLOUD_GIANT_GOLIATH_WARDEN_ID = 'cloud-giant-goliath-clouds-jaunt-warden';
const CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TRAIT = /^Cloud's Jaunt:\s*/i;
const CLOUD_GIANT_GOLIATH_LARGE_FORM_TRAIT = /^Large Form:\s*/i;
const CLOUD_GIANT_GOLIATH_POWERFUL_BUILD_TRAIT = /^Powerful Build:\s*/i;

/** Return the exact canonical Cloud's Jaunt trait rather than copied rule text. */
export function getCanonicalCloudGiantGoliathCloudsJauntTrait(race: Race): string | null {
  return race.traits.find(trait => CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TRAIT.test(trait.trim())) ?? null;
}

/** Return the canonical Large Form fact shown beside the supported transaction. */
export function getCanonicalCloudGiantGoliathLargeFormTrait(race: Race): string | null {
  return race.traits.find(trait => CLOUD_GIANT_GOLIATH_LARGE_FORM_TRAIT.test(trait.trim())) ?? null;
}

/** Return the canonical Powerful Build fact shown beside the supported transaction. */
export function getCanonicalCloudGiantGoliathPowerfulBuildTrait(race: Race): string | null {
  return race.traits.find(trait => CLOUD_GIANT_GOLIATH_POWERFUL_BUILD_TRAIT.test(trait.trim())) ?? null;
}

/** Confirm the supplied race still carries the facts this leaf is allowed to prove. */
export function hasCanonicalCloudGiantGoliathCloudsJaunt(race: Race): boolean {
  const jaunt = getCanonicalCloudGiantGoliathCloudsJauntTrait(race);
  const largeForm = getCanonicalCloudGiantGoliathLargeFormTrait(race);
  const powerfulBuild = getCanonicalCloudGiantGoliathPowerfulBuildTrait(race);
  return race.id === 'cloud_giant_goliath'
    && race.name === 'Cloud Giant Goliath'
    && !!jaunt
    && /bonus action/i.test(jaunt)
    && /teleport up to 30 feet/i.test(jaunt)
    && /unoccupied space you can see/i.test(jaunt)
    && /proficiency bonus/i.test(jaunt)
    && /long rest/i.test(jaunt)
    && !!largeForm
    && !!powerfulBuild;
}

// ============================================================================
// Deterministic Production Assembly
// ============================================================================
// The preview has no live combat snapshot to borrow. It therefore uses the
// same quick character and combat assembly seams as other Race leaves, then
// explicitly carries parsed racial limitedUses across the combat bridge.
// ============================================================================

function createCloudGiantGoliathMap(): BattleMapData {
  // A plain board keeps the proof focused on exact destination legality. All
  // authored points are visible and passable; the warden supplies occupancy.
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
  return { dimensions, tiles, theme: 'forest', seed: 240813 };
}

function getCloudGiantGoliathCloudsJauntResource(actor: CombatCharacter) {
  return actor.limitedUses?.[CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID];
}

function getProficiencyBonus(actor: CombatCharacter): number {
  return 2 + Math.floor((actor.level - 1) / 4);
}

function createCloudGiantGoliathActor(race: Race): CombatCharacter | null {
  // Production assembly derives level, proficiency bonus, and racial resources
  // from the canonical race instead of using a hand-authored combat fixture.
  const quickCharacter = createQuickCharacter({
    name: 'Cloud Giant Goliath · Cloud\'s Jaunt Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [16, 12, 14, 10, 10, 10],
  });
  if (!quickCharacter || !hasCanonicalCloudGiantGoliathCloudsJaunt(race)) return null;

  const assembledCharacter = applyRacialSpellGrantsByLevel(quickCharacter, quickCharacter.level ?? 1);
  const generatedActor = createPlayerCombatCharacter(assembledCharacter);
  const resource = assembledCharacter.limitedUses?.[CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID];
  if (!resource) return null;

  // The combat bridge does not currently project every racial limited-use
  // field, so this narrow adapter carries the canonical parsed entry forward.
  return resetEconomy({
    ...generatedActor,
    id: CLOUD_GIANT_GOLIATH_ACTOR_ID,
    name: `${race.name} · Cloud's Jaunt Tester`,
    position: { x: 2, y: 4 },
    limitedUses: {
      [CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID]: { ...resource },
    },
  });
}

function createCloudGiantGoliathWarden(): CombatCharacter | null {
  // The warden exists only to let the native placement helper reject a real
  // occupied destination without replacing the game's collision authority.
  const warden = createQuickCombatCharacter({
    name: 'Cloud Warden',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [12, 10, 12, 10, 10, 10],
  });
  return warden
    ? { ...warden, id: CLOUD_GIANT_GOLIATH_WARDEN_ID, position: { x: 4, y: 4 }, team: 'enemy' }
    : null;
}

export interface CloudGiantGoliathCloudsJauntScenarioState {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  outcome: string;
  lastResolution: CloudGiantGoliathCloudsJauntResolution | null;
}

export type CloudGiantGoliathCloudsJauntReason =
  | 'teleported'
  | 'assembly_unavailable'
  | 'invalid_target'
  | 'destination_out_of_range'
  | 'destination_out_of_bounds'
  | 'destination_not_visible'
  | 'destination_blocked'
  | 'destination_occupied'
  | 'insufficient_clouds_jaunt_uses'
  | 'bonus_action_unavailable';

export interface CloudGiantGoliathCloudsJauntResolution {
  status: 'teleported' | 'rejected';
  reason: CloudGiantGoliathCloudsJauntReason;
  characters: CombatCharacter[];
  origin?: Position;
  destination: Position;
  distanceFeet: number;
  maxDistanceFeet: number;
}

function getCloudGiantGoliathActor(
  scenario: CloudGiantGoliathCloudsJauntScenarioState,
): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === CLOUD_GIANT_GOLIATH_ACTOR_ID);
}

function createCloudGiantGoliathRejection(
  scenario: CloudGiantGoliathCloudsJauntScenarioState,
  reason: CloudGiantGoliathCloudsJauntReason,
  destination: Position,
  distanceFeet = 0,
): CloudGiantGoliathCloudsJauntResolution {
  return {
    status: 'rejected',
    reason,
    characters: scenario.characters,
    destination: { ...destination },
    distanceFeet,
    maxDistanceFeet: CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RANGE_FEET,
  };
}

function replaceCloudGiantGoliathActor(
  characters: CombatCharacter[],
  replacement: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => character.id === replacement.id ? replacement : character);
}

/**
 * Resolve Cloud's Jaunt through native destination legality and economy checks.
 *
 * The production teleport resolver currently accepts a Spell record and owns
 * spell-specific costs. Cloud's Jaunt is a racial feature, not a spell, so this
 * adapter deliberately calls the shared position, sight, placement, and
 * Bonus Action helpers while carrying the parsed racial resource itself.
 */
export function resolveCloudGiantGoliathCloudsJaunt(
  scenario: CloudGiantGoliathCloudsJauntScenarioState,
  targetId: CloudGiantGoliathCloudsJauntTargetId,
): CloudGiantGoliathCloudsJauntScenarioState {
  const actor = getCloudGiantGoliathActor(scenario);
  const target = CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TARGETS.find(candidate => candidate.id === targetId);
  if (!actor || !target) {
    return {
      ...scenario,
      outcome: 'Cloud\'s Jaunt rejected: the production-assembled actor or target is missing.',
      lastResolution: createCloudGiantGoliathRejection(
        scenario,
        actor ? 'invalid_target' : 'assembly_unavailable',
        target?.destination ?? actor?.position ?? { x: 0, y: 0 },
      ),
    };
  }

  const distanceFeet = getDistance(actor.position, target.destination) * 5;
  if (distanceFeet > CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RANGE_FEET) {
    return {
      ...scenario,
      outcome: `Cloud's Jaunt rejected atomically: ${distanceFeet} ft exceeds the canonical 30-foot range; Bonus Action and uses unchanged.`,
      lastResolution: createCloudGiantGoliathRejection(scenario, 'destination_out_of_range', target.destination, distanceFeet),
    };
  }

  const originTile = scenario.mapData.tiles.get(`${actor.position.x}-${actor.position.y}`);
  const destinationTile = scenario.mapData.tiles.get(`${target.destination.x}-${target.destination.y}`);
  if (!originTile || !destinationTile) {
    return {
      ...scenario,
      outcome: 'Cloud\'s Jaunt rejected atomically: destination is outside the authored board.',
      lastResolution: createCloudGiantGoliathRejection(scenario, 'destination_out_of_bounds', target.destination, distanceFeet),
    };
  }

  // Cloud's Jaunt requires a space the user can see. The production Bresenham
  // helper answers that question before any action or racial resource payment.
  if (!hasLineOfSight(originTile, destinationTile, scenario.mapData)) {
    return {
      ...scenario,
      outcome: 'Cloud\'s Jaunt rejected atomically: destination is not visible; Bonus Action and uses unchanged.',
      lastResolution: createCloudGiantGoliathRejection(scenario, 'destination_not_visible', target.destination, distanceFeet),
    };
  }

  // Placement checks the whole combat footprint and every living character.
  const placement = validateCharacterPlacement(actor, target.destination, scenario.mapData, scenario.characters);
  if (!placement.allowed) {
    const reason = placement.blockerId
      ? 'destination_occupied'
      : placement.reason.includes('leaves the battle map') ? 'destination_out_of_bounds' : 'destination_blocked';
    return {
      ...scenario,
      outcome: `Cloud's Jaunt rejected atomically: ${placement.reason} Bonus Action and uses unchanged.`,
      lastResolution: createCloudGiantGoliathRejection(scenario, reason, target.destination, distanceFeet),
    };
  }

  const resource = getCloudGiantGoliathCloudsJauntResource(actor);
  if (!resource || resource.current <= 0) {
    return {
      ...scenario,
      outcome: 'Cloud\'s Jaunt rejected atomically: no Proficiency Bonus uses remain; Bonus Action unchanged.',
      lastResolution: createCloudGiantGoliathRejection(scenario, 'insufficient_clouds_jaunt_uses', target.destination, distanceFeet),
    };
  }

  // The canonical trait costs a Bonus Action. The shared economy helper owns
  // both the legality check and the immutable payment result.
  const cost = { type: 'bonus' as const };
  if (!canAffordActionCost(actor, cost)) {
    return {
      ...scenario,
      outcome: 'Cloud\'s Jaunt rejected atomically: Bonus Action already used; uses unchanged.',
      lastResolution: createCloudGiantGoliathRejection(scenario, 'bonus_action_unavailable', target.destination, distanceFeet),
    };
  }

  const paidActor = consumeActionCost(actor, cost);
  const movedActor: CombatCharacter = {
    ...paidActor,
    position: { ...target.destination },
    limitedUses: {
      ...paidActor.limitedUses,
      [CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
  };
  const characters = replaceCloudGiantGoliathActor(scenario.characters, movedActor);
  const resolution: CloudGiantGoliathCloudsJauntResolution = {
    status: 'teleported',
    reason: 'teleported',
    characters,
    origin: { ...actor.position },
    destination: { ...target.destination },
    distanceFeet,
    maxDistanceFeet: CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RANGE_FEET,
  };

  return {
    ...scenario,
    characters,
    outcome: `Cloud's Jaunt resolved: ${distanceFeet} ft; Bonus Action paid; uses ${resource.current - 1}/${resource.max === 'proficiency_bonus' ? getProficiencyBonus(actor) : resource.max}.`,
    lastResolution: resolution,
  };
}

/** Build the exact baseline restored whenever the parent shell increments resetCount. */
export function createCloudGiantGoliathCloudsJauntScenario(
  race: Race,
): CloudGiantGoliathCloudsJauntScenarioState {
  const mapData = createCloudGiantGoliathMap();
  const actor = createCloudGiantGoliathActor(race);
  const warden = createCloudGiantGoliathWarden();
  const characters = [actor, warden].filter((character): character is CombatCharacter => character !== null);
  const usable = actor !== null && warden !== null && hasCanonicalCloudGiantGoliathCloudsJaunt(race);
  return {
    mapData,
    characters,
    outcome: usable
      ? `Ready: ${actor.name}; Cloud's Jaunt 30 ft; Bonus Action ready; uses ${getCloudGiantGoliathCloudsJauntResource(actor)?.current ?? 0}/${getProficiencyBonus(actor)}.`
      : 'Cloud\'s Jaunt unavailable: canonical trait or production character assembly was incomplete.',
    lastResolution: null,
  };
}

// ============================================================================
// Cloud Giant Goliath Leaf UI
// ============================================================================
// The small control surface exposes the actor's position, resource, action,
// result log, and the exact feature boundary. The parent shell's keyed reset
// remounts this content so no local target or spent state survives Reset.
// ============================================================================

const CloudGiantGoliathRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, onScenarioEvent }) => {
  const [targetId, setTargetId] = useState<CloudGiantGoliathCloudsJauntTargetId>('legal');
  const [scenario, setScenario] = useState(() => createCloudGiantGoliathCloudsJauntScenario(race));
  const actor = getCloudGiantGoliathActor(scenario);
  const target = CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TARGETS.find(candidate => candidate.id === targetId);
  const resource = actor ? getCloudGiantGoliathCloudsJauntResource(actor) : undefined;
  const jauntTrait = getCanonicalCloudGiantGoliathCloudsJauntTrait(race);
  const largeFormTrait = getCanonicalCloudGiantGoliathLargeFormTrait(race);
  const powerfulBuildTrait = getCanonicalCloudGiantGoliathPowerfulBuildTrait(race);

  const handleResolve = () => {
    // Publish the same resolution that is visible in the leaf so the parent
    // shell's event log cannot claim success for a rejected transaction.
    const nextScenario = resolveCloudGiantGoliathCloudsJaunt(scenario, targetId);
    setScenario(nextScenario);
    const result = nextScenario.lastResolution;
    onScenarioEvent(result?.status === 'teleported'
      ? `Cloud Giant Goliath CLOUD'S JAUNT RESOLVED: ${result.distanceFeet} ft; uses remaining ${getCloudGiantGoliathCloudsJauntResource(getCloudGiantGoliathActor(nextScenario)!)?.current ?? 0}/${actor ? getProficiencyBonus(actor) : 0}.`
      : `Cloud Giant Goliath CLOUD'S JAUNT REJECTED ATOMICALLY: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="cloud-giant-goliath-clouds-jaunt-title" data-testid="cloud-giant-goliath-race-leaf">
      {/* The heading names the canonical transaction for users and assistive tools. */}
      <h4 id="cloud-giant-goliath-clouds-jaunt-title">Cloud Giant Goliath · Cloud&apos;s Jaunt</h4>
      <p data-testid="cloud-giant-goliath-canonical-trait">Canonical: {jauntTrait ?? 'Cloud\'s Jaunt trait missing'}</p>

      {/* Only the destination choice is authored; native helpers remain authoritative. */}
      <label htmlFor={CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TARGET_CONTROL_ID}>Cloud&apos;s Jaunt destination</label>
      <select
        id={CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TARGET_CONTROL_ID}
        value={targetId}
        onChange={event => setTargetId(event.target.value as CloudGiantGoliathCloudsJauntTargetId)}
      >
        {CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_TARGETS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>Resolve Cloud&apos;s Jaunt</Button>

      {/* The actor line exposes real position, proficiency, action, and parsed resource facts. */}
      <p data-testid="cloud-giant-goliath-actor">
        Actor: {actor?.name ?? 'missing'}; Position {actor?.position.x},{actor?.position.y}; PB +{actor ? getProficiencyBonus(actor) : 'unknown'}; Bonus Action {actor?.actionEconomy.bonusAction.used ? 'used' : 'ready'}; Uses {resource?.current ?? 0}/{actor ? getProficiencyBonus(actor) : 0}.
      </p>
      <p data-testid="cloud-giant-goliath-target">Target: {target?.label ?? 'missing'}</p>
      <p aria-live="polite" role="status" data-testid="cloud-giant-goliath-outcome">{scenario.outcome}</p>

      {/* These are canonical facts displayed without claiming that unsupported mechanics are active. */}
      <p data-testid="cloud-giant-goliath-giant-facts">Large Form: {largeFormTrait ?? 'missing'} Powerful Build: {powerfulBuildTrait ?? 'missing'}</p>

      {/* The bridge seam is explicit: the resource is canonical even though the combat bridge does not project it. */}
      <p data-testid="cloud-giant-goliath-assembly-boundary">
        Assembly boundary: production quick character assembly plus canonical racial resource parsing; the leaf carries limitedUses across the combat bridge because that bridge does not currently project racial resources.
      </p>

      {/* Cloud's Jaunt is not a spell, so the spell-only resolver and rendering gaps stay visible. */}
      <p data-testid="cloud-giant-goliath-unsupported-boundary">
        Unsupported boundary: this leaf does not invoke the spell-only teleportation resolver, invent a spell record or spell slot, apply Large Form/Powerful Build runtime effects, animate 2D/3D teleportation, run pathfinding, or claim mounted render proof; parent Reset re-seeds the canonical Proficiency Bonus charges.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed content boundary restores the
// local selector, actor position, Bonus Action, and canonical resource charge.
export const CloudGiantGoliathRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <CloudGiantGoliathRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'cloud-giant-goliath-clouds-jaunt',
  raceId: 'cloud_giant_goliath',
  label: 'Cloud Giant Goliath · Cloud\'s Jaunt',
  description: 'Resolve the canonical 30-foot Bonus Action teleport through native distance, sight, placement, and action-economy helpers while exposing unsupported race-aware boundaries.',
  Component: CloudGiantGoliathRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
