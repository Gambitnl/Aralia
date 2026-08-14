// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 17:30:51
 * Dependents: None (Orphan)
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import type { AbilityCost, CombatCharacter } from '../../../../../types/combat';
import type { PlayerCharacter, Race } from '../../../../../types';
import { applyRacialSpellGrantsByLevel } from '../../../../../utils/character/characterUtils';
import { calculateProficiencyBonus } from '../../../../../utils/character/savingThrowUtils';
import { createPlayerCombatCharacter, calculateDamage, rollDice } from '../../../../../utils/combat/combatUtils';
import { consumeActionCost, canAffordActionCost } from '../../../../../utils/combat/actionEconomyUtils';
import { applyHealingAndRestore } from '../../../../../utils/combat/deathSaveUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives Fallen Aasimar one inspectable Healing Hands transaction in
 * the Tactical Sandbox Race domain.
 *
 * It assembles source and target actors through the production character
 * bridge, rolls native d4 dice with a pinned test stream, pays the native
 * Action resource, and applies native capped healing. The other racial traits
 * remain canonical facts or explicit boundaries because this leaf does not
 * have a safe native fear, transformation, rider, sensing, or spell-casting
 * transaction to invoke.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Fallen Aasimar data, production actor assembly, native
 * dice/action/healing/resistance helpers, and the Race domain leaf contract.
 */

// ============================================================================
// Canonical Fallen Aasimar Facts
// ============================================================================
// The feature name is used to derive the same resource identifier emitted by
// the production racial-trait parser. The prose itself remains the authority
// for the visible facts and the guard that prevents stale copied mechanics.
// ============================================================================

export const FALLEN_AASIMAR_ACTOR_ID = 'fallen-aasimar-healing-hands-actor';
export const FALLEN_AASIMAR_TARGET_ID = 'fallen-aasimar-healing-hands-target';
export const FALLEN_AASIMAR_PREVIEW_LEVEL = 5;
export const FALLEN_AASIMAR_RAW_DAMAGE = 15;
export const FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID =
  'racial_feature_fallen_aasimar__healing_hands__resource';

const HEALING_HANDS_TRAIT = 'Healing Hands';
const CELESTIAL_RESISTANCE_TRAIT = 'Celestial Resistance';
const LIGHT_BEARER_TRAIT = 'Light Bearer';
const NECROTIC_SHROUD_TRAIT = 'Necrotic Shroud';
const HEALING_HANDS_COST: AbilityCost = { type: 'action' };

/** Read one named trait directly from the Race supplied by the shell. */
export function getCanonicalFallenAasimarTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Confirm the exact authored mechanics this leaf is willing to demonstrate. */
export function hasCanonicalFallenAasimarFeatures(race: Race): boolean {
  const healingHands = getCanonicalFallenAasimarTrait(race, HEALING_HANDS_TRAIT);
  const resistance = getCanonicalFallenAasimarTrait(race, CELESTIAL_RESISTANCE_TRAIT);
  const lightBearer = getCanonicalFallenAasimarTrait(race, LIGHT_BEARER_TRAIT);
  const shroud = getCanonicalFallenAasimarTrait(race, NECROTIC_SHROUD_TRAIT);

  return race.id === 'fallen_aasimar'
    && race.name === 'Fallen Aasimar'
    && !!healingHands
    && /as an action/i.test(healingHands)
    && /touch a creature/i.test(healingHands)
    && /d4s equal to your proficiency bonus/i.test(healingHands)
    && /once you use this trait/i.test(healingHands)
    && !!resistance
    && /necrotic damage/i.test(resistance)
    && /radiant damage/i.test(resistance)
    && !!lightBearer
    && !!shroud;
}

/** Return the authored Healing Hands wording without rewriting it. */
export function getCanonicalFallenAasimarHealingHandsTrait(race: Race): string | null {
  return getCanonicalFallenAasimarTrait(race, HEALING_HANDS_TRAIT);
}

/** Return the authored resistance wording used by the native damage proof. */
export function getCanonicalFallenAasimarResistanceTrait(race: Race): string | null {
  return getCanonicalFallenAasimarTrait(race, CELESTIAL_RESISTANCE_TRAIT);
}

/** Read the two damage types from the authored Celestial Resistance sentence. */
export function getCanonicalFallenAasimarDamageResistances(race: Race): readonly string[] {
  const resistance = getCanonicalFallenAasimarResistanceTrait(race);
  if (!resistance) return [];
  const match = resistance.match(/resistance to ([a-z]+) damage(?: and ([a-z]+) damage)?/i);
  return match
    ? [...new Set([match[1], match[2]].filter((type): type is string => !!type).map(type => type.toLowerCase()))]
    : [];
}

// ============================================================================
// Production Actor Assembly
// ============================================================================
// The source and target are both created from the normal quick-character and
// persistent-to-combat bridges. Only the target's starting HP is adjusted to
// make the canonical cap visible; no hand-built combat actor is introduced.
// ============================================================================

export interface FallenAasimarActorAssembly {
  character: PlayerCharacter | null;
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  outcome: string;
}

export function createFallenAasimarActors(race: Race): FallenAasimarActorAssembly {
  if (!hasCanonicalFallenAasimarFeatures(race)) {
    return {
      character: null,
      actor: null,
      target: null,
      outcome: 'Assembly rejected: canonical Fallen Aasimar Healing Hands facts are incomplete.',
    };
  }

  // Use the production character generator for both sides of the touch target.
  const sourceCharacter = createQuickCharacter({
    name: 'Fallen Aasimar Healing Hands Tester',
    raceId: race.id,
    classId: 'wizard',
    level: FALLEN_AASIMAR_PREVIEW_LEVEL,
    stats: [10, 10, 12, 10, 10, 14],
  });
  const targetCharacter = createQuickCharacter({
    name: 'Fallen Aasimar Touch Target',
    raceId: race.id,
    classId: 'wizard',
    level: FALLEN_AASIMAR_PREVIEW_LEVEL,
    stats: [10, 10, 12, 10, 10, 14],
  });

  if (!sourceCharacter || !targetCharacter) {
    return {
      character: null,
      actor: null,
      target: null,
      outcome: 'Assembly rejected: production quick-character generation returned no actor.',
    };
  }

  // The native racial projection owns the long-rest resource and resistance.
  const projectedSource = applyRacialSpellGrantsByLevel(sourceCharacter, FALLEN_AASIMAR_PREVIEW_LEVEL);
  const projectedTarget = applyRacialSpellGrantsByLevel(targetCharacter, FALLEN_AASIMAR_PREVIEW_LEVEL);
  const sourceActor = createPlayerCombatCharacter(projectedSource);
  const targetActor = createPlayerCombatCharacter(projectedTarget);
  const parsedResource = projectedSource.limitedUses?.[FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID];

  if (!parsedResource) {
    return {
      character: projectedSource,
      actor: { ...sourceActor, id: FALLEN_AASIMAR_ACTOR_ID },
      target: { ...targetActor, id: FALLEN_AASIMAR_TARGET_ID },
      outcome: 'Healing Hands boundary: the native racial resource projection is unavailable.',
    };
  }

  // DEBT: The combat bridge currently drops persistent limitedUses, and the
  // generic prose parser reads the PB dice phrase as PB uses. Preserve the
  // canonical one-use long-rest rule in this leaf until a shared racial-feature
  // projection fixes both gaps upstream.
  const canonicalHealingHandsResource = {
    ...parsedResource,
    current: 1,
    max: 1 as const,
    resetOn: 'long_rest' as const,
  };
  const canonicalResistanceTypes = getCanonicalFallenAasimarDamageResistances(race)
    .map(type => type.charAt(0).toUpperCase() + type.slice(1));

  // Start two HP below maximum so a pinned 3d4 roll visibly demonstrates cap.
  const target: CombatCharacter = {
    ...targetActor,
    id: FALLEN_AASIMAR_TARGET_ID,
    currentHP: Math.max(1, targetActor.maxHP - 2),
  };
  const actor: CombatCharacter = {
    ...sourceActor,
    id: FALLEN_AASIMAR_ACTOR_ID,
    // This narrow projection keeps the production-created resource visible to
    // the leaf while the combat bridge does not yet carry limitedUses.
    limitedUses: {
      ...(sourceActor.limitedUses ?? {}),
      [FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID]: canonicalHealingHandsResource,
    },
    // The native resistance calculator remains authoritative after this
    // canonical-derived defense projection reaches the combat actor.
    resistances: [...new Set([...(sourceActor.resistances ?? []), ...canonicalResistanceTypes])],
  };

  return {
    character: projectedSource,
    actor,
    target,
    outcome: `Ready: ${actor.name}; level ${actor.level}; Healing Hands ${canonicalHealingHandsResource.current} use${canonicalHealingHandsResource.current === 1 ? '' : 's'} available; target is 2 HP below maximum.`,
  };
}

// ============================================================================
// Native Healing Hands Transaction
// ============================================================================
// Dice and HP changes stay in shared helpers. The local resource decrement is
// the only adapter: the action economy has a native payer for racial spells,
// but no generic payer for a text-parsed racial feature resource yet.
// ============================================================================

export interface FallenAasimarHealingResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'resource_unavailable' | 'resource_exhausted' | 'action_unavailable';
  d4Faces: readonly number[];
  rawHealing: number;
  actualHealing: number;
  beforeHP: number | null;
  afterHP: number | null;
  actionRemaining: number | null;
  resourceRemaining: number | null;
}

export interface FallenAasimarScenarioState {
  assembly: FallenAasimarActorAssembly;
  outcome: string;
  lastResolution: FallenAasimarHealingResolution | null;
}

/** Build the deterministic baseline used at mount and after parent Reset. */
export function createFallenAasimarScenario(race: Race): FallenAasimarScenarioState {
  const assembly = createFallenAasimarActors(race);
  return {
    assembly,
    outcome: assembly.outcome,
    lastResolution: null,
  };
}

function rejectedResolution(
  reason: FallenAasimarHealingResolution['reason'],
  actor: CombatCharacter | null,
  target: CombatCharacter | null,
): FallenAasimarHealingResolution {
  return {
    status: 'rejected',
    reason,
    d4Faces: [],
    rawHealing: 0,
    actualHealing: 0,
    beforeHP: target?.currentHP ?? null,
    afterHP: target?.currentHP ?? null,
    actionRemaining: actor?.actionEconomy.action.remaining ?? null,
    resourceRemaining: actor?.limitedUses?.[FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID]?.current ?? null,
  };
}

/** Spend one parsed feature resource while preserving immutable actor state. */
function spendHealingHandsResource(actor: CombatCharacter): CombatCharacter {
  const resource = actor.limitedUses?.[FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID];
  if (!resource) return actor;

  // DEBT: Feature-resource spending has no shared payer yet. This adapter only
  // decrements the parser-created key; a future generic racial-feature payer
  // should replace it without changing the Healing Hands transaction surface.
  return {
    ...actor,
    limitedUses: {
      ...actor.limitedUses,
      [FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID]: {
        ...resource,
        current: Math.max(0, resource.current - 1),
      },
    },
  };
}

/** Resolve one action, touch target, PB-d4 healing transaction atomically. */
export function resolveFallenAasimarHealing(
  scenario: FallenAasimarScenarioState,
  race: Race,
  rng: () => number = Math.random,
): FallenAasimarScenarioState {
  const actor = scenario.assembly.actor;
  const target = scenario.assembly.target;
  if (!hasCanonicalFallenAasimarFeatures(race)) {
    return { ...scenario, outcome: 'Healing Hands rejected: canonical Fallen Aasimar facts are unavailable.', lastResolution: rejectedResolution('canonical_trait_missing', actor, target) };
  }
  if (!actor || !target) {
    return { ...scenario, outcome: 'Healing Hands rejected: production source or touch target is unavailable.', lastResolution: rejectedResolution('assembly_unavailable', actor, target) };
  }

  const resource = actor.limitedUses?.[FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID];
  if (!resource) {
    return { ...scenario, outcome: 'Healing Hands rejected: parser-created long-rest resource is unavailable.', lastResolution: rejectedResolution('resource_unavailable', actor, target) };
  }
  if (resource.current <= 0) {
    return { ...scenario, outcome: 'Healing Hands rejected atomically: the long-rest resource is exhausted; no dice, HP, or Action changed.', lastResolution: rejectedResolution('resource_exhausted', actor, target) };
  }
  if (!canAffordActionCost(actor, HEALING_HANDS_COST)) {
    return { ...scenario, outcome: 'Healing Hands rejected atomically: the source has no Action remaining; no dice, HP, or resource changed.', lastResolution: rejectedResolution('action_unavailable', actor, target) };
  }

  const proficiencyBonus = calculateProficiencyBonus(actor.level);
  const d4Faces = Array.from({ length: proficiencyBonus }, () => rollDice('1d4', { rng }));
  const rawHealing = d4Faces.reduce((total, face) => total + face, 0);
  const beforeHP = target.currentHP;
  const healedTarget = applyHealingAndRestore(target, rawHealing);
  const actualHealing = healedTarget.currentHP - beforeHP;
  const paidActor = spendHealingHandsResource(consumeActionCost(actor, HEALING_HANDS_COST));
  const resolution: FallenAasimarHealingResolution = {
    status: 'resolved',
    reason: 'resolved',
    d4Faces,
    rawHealing,
    actualHealing,
    beforeHP,
    afterHP: healedTarget.currentHP,
    actionRemaining: paidActor.actionEconomy.action.remaining,
    resourceRemaining: paidActor.limitedUses?.[FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID]?.current ?? null,
  };

  return {
    assembly: { ...scenario.assembly, actor: paidActor, target: healedTarget },
    outcome: `Healing Hands resolved: ${d4Faces.length}d4 rolled ${d4Faces.join(' + ')} = ${rawHealing}; target regained ${actualHealing} HP after the maximum-HP cap; Action and long-rest resource paid.`,
    lastResolution: resolution,
  };
}

// ============================================================================
// Visible Race Leaf Surface
// ============================================================================
// The panel shows the tested transaction, native resistance math, canonical
// facts, and explicit unsupported boundaries. Parent Reset remounts this state.
// ============================================================================

const FallenAasimarRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, state, onScenarioEvent }) => {
  const [scenario, setScenario] = useState(() => createFallenAasimarScenario(race));
  const healingHands = getCanonicalFallenAasimarHealingHandsTrait(race);
  const resistance = getCanonicalFallenAasimarResistanceTrait(race);
  const lightBearer = getCanonicalFallenAasimarTrait(race, LIGHT_BEARER_TRAIT);
  const shroud = getCanonicalFallenAasimarTrait(race, NECROTIC_SHROUD_TRAIT);
  const actor = scenario.assembly.actor;
  const resource = actor?.limitedUses?.[FALLEN_AASIMAR_HEALING_HANDS_RESOURCE_ID];
  const resourceMaximum = resource
    ? (typeof resource.max === 'number' ? resource.max : calculateProficiencyBonus(actor?.level ?? 1))
    : null;
  const resistanceResult = actor ? calculateDamage(FALLEN_AASIMAR_RAW_DAMAGE, null, actor, 'necrotic') : null;

  // Publish exactly the native result that the panel displays to the shell log.
  const handleResolve = () => {
    const nextScenario = resolveFallenAasimarHealing(scenario, race, () => 0.999);
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    onScenarioEvent(resolution?.status === 'resolved'
      ? `Fallen Aasimar HEALING HANDS RESOLVED: faces ${resolution.d4Faces.join(' / ')}; raw ${resolution.rawHealing}; actual ${resolution.actualHealing}; HP ${resolution.beforeHP} -> ${resolution.afterHP}; Action remaining ${resolution.actionRemaining}; resource remaining ${resolution.resourceRemaining}.`
      : `Fallen Aasimar HEALING HANDS REJECTED: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="fallen-aasimar-race-title" data-testid="fallen-aasimar-race-leaf">
      <h4 id="fallen-aasimar-race-title">Fallen Aasimar · Healing Hands</h4>
      <p data-testid="fallen-aasimar-actor">
        Source: {actor?.name ?? 'missing'}; Level {actor?.level ?? 'unknown'}; PB +{actor ? calculateProficiencyBonus(actor.level) : 'unknown'}; Action remaining {actor?.actionEconomy.action.remaining ?? 'unknown'}; resource {resource?.current ?? 'missing'} / {resourceMaximum ?? 'unknown'}.
      </p>
      <p data-testid="fallen-aasimar-target">
        Touch target: {scenario.assembly.target?.name ?? 'missing'}; HP {scenario.assembly.target?.currentHP ?? 'unknown'} / {scenario.assembly.target?.maxHP ?? 'unknown'}.
      </p>

      <Button type="button" variant="primary" size="sm" onClick={handleResolve}>Use Healing Hands</Button>
      <p aria-live="polite" role="status" data-testid="fallen-aasimar-outcome">{scenario.outcome}</p>
      <div data-testid="fallen-aasimar-healing-result">
        {scenario.lastResolution?.status === 'resolved'
          ? `Faces ${scenario.lastResolution.d4Faces.join(' / ')}; raw ${scenario.lastResolution.rawHealing}; actual/capped ${scenario.lastResolution.actualHealing}; HP ${scenario.lastResolution.beforeHP} -> ${scenario.lastResolution.afterHP}; Action remaining ${scenario.lastResolution.actionRemaining}; resource remaining ${scenario.lastResolution.resourceRemaining}.`
          : 'No Healing Hands transaction resolved yet.'}
      </div>

      <div data-testid="fallen-aasimar-resistance-facts">
        <strong>Celestial Resistance:</strong> {resistance ?? 'unavailable'} Native necrotic packet {FALLEN_AASIMAR_RAW_DAMAGE} → {resistanceResult ?? 'unresolved'} through production resistance math. Radiant is canonical fact-only here because one packet is enough to prove the shared resolver path.
      </div>
      <div data-testid="fallen-aasimar-canonical-facts">
        <strong>Canonical facts:</strong>
        <ul>
          <li>Healing Hands: {healingHands ?? 'unavailable'}</li>
          <li>Light Bearer: {lightBearer ?? 'unavailable'} No spell is cast by this leaf.</li>
          <li>Necrotic Shroud: {shroud ?? 'unavailable'}</li>
        </ul>
      </div>
      <p data-testid="fallen-aasimar-boundary">
        Boundary: this proof does not fake Darkvision sensing, Necrotic Shroud transformation duration, fear saves, once-per-turn necrotic rider, or Light spell casting. The parent shell Reset remounts the actor, target HP, Action, resource, and log-visible result; no mounted 2D/3D render claim is made.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed boundary restores every local
// actor, target, Action, resource, and result state without an effect cascade.
export const FallenAasimarRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <FallenAasimarRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export. No shared
// registry edit is needed, keeping this leaf disjoint from sibling work.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'fallen-aasimar-healing-hands',
  raceId: 'fallen_aasimar',
  label: 'Fallen Aasimar · Healing Hands',
  description: 'Production-backed Action, touch-target, proficiency-d4 Healing Hands with native HP cap, resistance math, and explicit trait boundaries.',
  Component: FallenAasimarRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
