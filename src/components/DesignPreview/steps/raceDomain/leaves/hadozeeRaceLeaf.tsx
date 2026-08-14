// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 14/08/2026, 01:47:57
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
import { getRacialTraitLibrary } from '../../../../../data/races';
import type { RacialReaction } from '../../../../../data/races/racialTraits';
import type { CombatCharacter } from '../../../../../types/combat';
import type { PlayerCharacter, Race } from '../../../../../types';
import { applyRacialSpellGrantsByLevel } from '../../../../../utils/character/characterUtils';
import { calculateProficiencyBonus } from '../../../../../utils/character/savingThrowUtils';
import {
  calculateDamage,
  canTakeReaction,
  createPlayerCombatCharacter,
  rollDice,
} from '../../../../../utils/combat/combatUtils';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../../../../utils/combat/actionEconomyUtils';
import { applyDamageAndCheckDowned } from '../../../../../utils/combat/deathSaveUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Hadozee race one inspectable Resilience
 * transaction in the Tactical Sandbox Race domain.
 *
 * It reads Hadozee Resilience from the production racial-trait parser, builds
 * a level-5 combat actor through the normal quick-character bridge, and then
 * resolves one incoming damage packet with native d6, reaction, damage, and
 * downing helpers. The remaining traits stay tied to the supplied canonical
 * Race record, with unsupported movement and object interactions called out
 * instead of being represented by local fake state.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: ACTIVE_RACES data, the racial trait library, production actor
 * assembly, native action/damage/HP helpers, and the Race leaf contract.
 */

// ============================================================================
// Canonical Hadozee Facts And Parsed Reaction
// ============================================================================
// These helpers read the supplied Race and the shared racial parser. The leaf
// does not copy Hadozee rule text into a second source of truth.
// ============================================================================

export const HADOZEE_RESILIENCE_ACTOR_ID = 'hadozee-resilience-actor';
export const HADOZEE_PREVIEW_LEVEL = 5;
export const HADOZEE_DEFAULT_INCOMING_DAMAGE = 12;
export const HADOZEE_DEFAULT_D6_FACE = 4;
export const HADOZEE_RESILIENCE_CONTROL_ID = 'hadozee-resilience-apply';
export const HADOZEE_DECLINE_CONTROL_ID = 'hadozee-resilience-decline';
export const HADOZEE_DAMAGE_CONTROL_ID = 'hadozee-resilience-damage';
export const HADOZEE_D6_CONTROL_ID = 'hadozee-resilience-d6';

const HADOZEE_RESILIENCE_TRAIT_NAME = 'Hadozee Resilience';
const HADOZEE_CANONICAL_REACTION_ID = 'hadozee__hadozee_resilience__reaction';
const HADOZEE_BASELINE_HP = 10;
const REACTION_COST = { type: 'reaction' as const };

export interface HadozeeCanonicalFacts {
  size: string | null;
  speed: string | null;
  dexterousFeet: string | null;
  glide: string | null;
  resilience: string | null;
}

export interface HadozeeResilienceReactionMetadata {
  reaction: RacialReaction;
  reactionId: string;
  dice: string;
  addProficiencyBonus: boolean;
  triggerType: string;
}

/** Read one authored trait by its stable name prefix. */
function getCanonicalTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Read the canonical Hadozee facts that this leaf can display honestly. */
export function getCanonicalHadozeeFacts(race: Race): HadozeeCanonicalFacts {
  return {
    size: getCanonicalTrait(race, 'Size'),
    speed: getCanonicalTrait(race, 'Speed'),
    dexterousFeet: getCanonicalTrait(race, 'Dexterous Feet'),
    glide: getCanonicalTrait(race, 'Glide'),
    resilience: getCanonicalTrait(race, HADOZEE_RESILIENCE_TRAIT_NAME),
  };
}

/**
 * Find Hadozee Resilience in the shared parsed racial library.
 *
 * The parser stores reactions under a feature's modifier buckets, so this
 * accessor validates the reaction id, trigger, dice, and proficiency rider
 * before the leaf will execute it. That keeps the local executor a narrow
 * translation boundary rather than a second parser or rules definition.
 */
export function getCanonicalHadozeeResilienceReaction(
  race: Race,
): HadozeeResilienceReactionMetadata | null {
  if (race.id !== 'hadozee') return null;

  const parsedTrait = getRacialTraitLibrary().byRaceId[race.id]
    ?.find(trait => trait.traitName === HADOZEE_RESILIENCE_TRAIT_NAME);
  if (!parsedTrait || parsedTrait.type === 'spell') return null;

  const parsedReaction = parsedTrait.modifierBuckets?.reactions
    ?.find(reaction => reaction.id === HADOZEE_CANONICAL_REACTION_ID);
  const damageReduction = parsedReaction?.effect?.damageReduction;
  const triggerType = parsedReaction?.trigger?.type;

  if (
    !parsedReaction
    || !/^(?:1)?d6$/i.test(damageReduction?.dice ?? '')
    || damageReduction?.addProficiencyBonus !== true
    || damageReduction?.appliesTo !== 'damage_taken'
    || damageReduction?.frequency !== 'every_time'
    || triggerType !== 'on_target_takes_damage'
  ) {
    return null;
  }

  return {
    reaction: parsedReaction,
    reactionId: parsedReaction.id,
    dice: damageReduction.dice,
    addProficiencyBonus: damageReduction.addProficiencyBonus,
    triggerType,
  };
}

/** Confirm that the active Hadozee record still has every supported fact. */
export function hasCanonicalHadozeeFacts(race: Race): boolean {
  const facts = getCanonicalHadozeeFacts(race);
  const reaction = getCanonicalHadozeeResilienceReaction(race);

  return race.id === 'hadozee'
    && race.name === 'Hadozee'
    && facts.size !== null
    && /medium or small/i.test(facts.size)
    && facts.speed !== null
    && /30 feet/i.test(facts.speed)
    && /climb 30 feet/i.test(facts.speed)
    && facts.dexterousFeet !== null
    && facts.glide !== null
    && facts.resilience !== null
    && reaction !== null;
}

// ============================================================================
// Production Actor Assembly
// ============================================================================
// The actor begins as a normal PlayerCharacter and crosses the production
// persistent-to-combat bridge. Only its current HP and id are set for a
// deterministic proof packet; no hand-built CombatCharacter is introduced.
// ============================================================================

export interface HadozeeActorAssembly {
  character: PlayerCharacter | null;
  actor: CombatCharacter | null;
  reaction: HadozeeResilienceReactionMetadata | null;
  outcome: string;
}

/** Build the deliberate level-5/PB+3 actor used by every reset baseline. */
export function createHadozeeActor(race: Race): HadozeeActorAssembly {
  const reaction = getCanonicalHadozeeResilienceReaction(race);
  const character = createQuickCharacter({
    name: 'Hadozee Resilience Tester',
    raceId: race.id,
    classId: 'fighter',
    level: HADOZEE_PREVIEW_LEVEL,
    stats: [14, 14, 14, 10, 10, 10],
  });

  if (!character) {
    return {
      character: null,
      actor: null,
      reaction,
      outcome: 'Assembly rejected: production quick-character generation returned no actor.',
    };
  }

  // The racial projection is the same production parser used during character
  // assembly. It is intentionally applied even though Resilience is a reaction
  // rather than a rest resource, so parser coverage remains part of the proof.
  const parsedCharacter = applyRacialSpellGrantsByLevel(character, HADOZEE_PREVIEW_LEVEL);
  const productionActor = createPlayerCombatCharacter(parsedCharacter);

  if (!reaction) {
    return {
      character: parsedCharacter,
      actor: { ...productionActor, id: HADOZEE_RESILIENCE_ACTOR_ID },
      reaction: null,
      outcome: 'Assembly boundary: parsed Hadozee Resilience reaction metadata is unavailable.',
    };
  }

  // Start below maximum HP so a declined 12-damage packet visibly demonstrates
  // the native player downing transition while Apply leaves the actor standing.
  const actor: CombatCharacter = {
    ...productionActor,
    id: HADOZEE_RESILIENCE_ACTOR_ID,
    currentHP: Math.min(HADOZEE_BASELINE_HP, productionActor.maxHP),
  };
  const proficiencyBonus = calculateProficiencyBonus(actor.level);

  return {
    character: parsedCharacter,
    actor,
    reaction,
    outcome: `Ready: ${actor.name}; level ${actor.level}; PB +${proficiencyBonus}; Reaction ready; HP ${actor.currentHP}/${actor.maxHP}.`,
  };
}

// ============================================================================
// Narrow Hadozee Resilience Transaction
// ============================================================================
// The shared combat layer has native reaction affordability/payment and HP
// damage/downing helpers, but no high-level executor for parsed racial damage
// reduction reactions. This local adapter therefore performs only the proven
// translation: parsed d6 + PB, reaction payment, and final native HP damage.
// ============================================================================

export type HadozeeResolutionStatus = 'applied' | 'declined' | 'rejected';
export type HadozeeResolutionReason =
  | 'applied'
  | 'declined'
  | 'canonical_reaction_missing'
  | 'assembly_unavailable'
  | 'reaction_unavailable';

export interface HadozeeResilienceResolution {
  status: HadozeeResolutionStatus;
  reason: HadozeeResolutionReason;
  incomingDamage: number;
  d6Face: number | null;
  proficiencyBonus: number;
  reduction: number;
  finalDamage: number;
  hitPointsBefore: number | null;
  hitPointsAfter: number | null;
  reactionBeforeAvailable: boolean | null;
  reactionAfterAvailable: boolean | null;
  reactionSpent: boolean;
  downed: boolean;
}

export interface HadozeeScenarioState {
  assembly: HadozeeActorAssembly;
  incomingDamage: number;
  d6Face: number;
  outcome: string;
  lastResolution: HadozeeResilienceResolution | null;
}

/** Create the exact baseline restored by mount and parent resetCount. */
export function createHadozeeScenario(
  race: Race,
  incomingDamage = HADOZEE_DEFAULT_INCOMING_DAMAGE,
  d6Face = HADOZEE_DEFAULT_D6_FACE,
): HadozeeScenarioState {
  const assembly = createHadozeeActor(race);
  return {
    assembly,
    incomingDamage,
    d6Face,
    outcome: assembly.outcome,
    lastResolution: null,
  };
}

/** Build a rejection receipt without changing the actor or rolling dice. */
function rejectedResolution(
  reason: HadozeeResolutionReason,
  actor: CombatCharacter | null,
  incomingDamage: number,
): HadozeeResilienceResolution {
  return {
    status: 'rejected',
    reason,
    incomingDamage,
    d6Face: null,
    proficiencyBonus: actor ? calculateProficiencyBonus(actor.level) : 0,
    reduction: 0,
    finalDamage: 0,
    hitPointsBefore: actor?.currentHP ?? null,
    hitPointsAfter: actor?.currentHP ?? null,
    reactionBeforeAvailable: actor ? !actor.actionEconomy.reaction.used : null,
    reactionAfterAvailable: actor ? !actor.actionEconomy.reaction.used : null,
    reactionSpent: false,
    downed: actor?.currentHP === 0,
  };
}

/** Resolve Apply or Decline as one immutable state transition. */
export function resolveHadozeeResilience(
  scenario: HadozeeScenarioState,
  choice: 'apply' | 'decline',
): HadozeeScenarioState {
  const actor = scenario.assembly.actor;
  const reaction = scenario.assembly.reaction;

  if (!reaction) {
    return {
      ...scenario,
      outcome: 'Hadozee Resilience rejected atomically: canonical parsed reaction metadata is unavailable; no roll, reaction, or HP changed.',
      lastResolution: rejectedResolution('canonical_reaction_missing', actor, scenario.incomingDamage),
    };
  }
  if (!actor) {
    return {
      ...scenario,
      outcome: 'Hadozee Resilience rejected atomically: production actor assembly is unavailable; no roll, reaction, or HP changed.',
      lastResolution: rejectedResolution('assembly_unavailable', null, scenario.incomingDamage),
    };
  }

  // Native damage calculation establishes the incoming packet before the racial
  // reduction. The actor has no authored resistance, so this remains 12 here.
  const incomingDamage = calculateDamage(scenario.incomingDamage, null, actor, 'bludgeoning');
  const hitPointsBefore = actor.currentHP;
  const reactionBeforeAvailable = canTakeReaction(actor) && canAffordActionCost(actor, REACTION_COST);

  if (choice === 'decline') {
    // Declining is a valid atomic choice: the packet resolves normally, but no
    // d6 is rolled and the reaction remains ready for a later trigger.
    const damagedActor = applyDamageAndCheckDowned(actor, incomingDamage, false);
    const resolution: HadozeeResilienceResolution = {
      status: 'declined',
      reason: 'declined',
      incomingDamage,
      d6Face: null,
      proficiencyBonus: calculateProficiencyBonus(actor.level),
      reduction: 0,
      finalDamage: incomingDamage,
      hitPointsBefore,
      hitPointsAfter: damagedActor.currentHP,
      reactionBeforeAvailable,
      reactionAfterAvailable: !damagedActor.actionEconomy.reaction.used,
      reactionSpent: false,
      downed: damagedActor.currentHP === 0 && hitPointsBefore > 0,
    };

    return {
      ...scenario,
      assembly: { ...scenario.assembly, actor: damagedActor },
      outcome: `Hadozee Resilience declined atomically: no d6 rolled and no reaction spent; ${incomingDamage} damage applied; HP ${hitPointsBefore} -> ${damagedActor.currentHP}; ${damagedActor.currentHP === 0 ? 'downed' : 'standing'}.`,
      lastResolution: resolution,
    };
  }

  if (!reactionBeforeAvailable) {
    return {
      ...scenario,
      outcome: 'Hadozee Resilience rejected atomically: Reaction unavailable; no d6, damage, HP, or Reaction state changed.',
      lastResolution: rejectedResolution('reaction_unavailable', actor, incomingDamage),
    };
  }

  // The parser correctly describes one d6 as "d6", while rollDice's grammar
  // requires an explicit count. Normalize only that notation at the native
  // helper boundary; the displayed receipt still reports the parsed d6 rule.
  const nativeDice = /^\d+d\d+$/i.test(reaction.dice) ? reaction.dice : `1${reaction.dice}`;
  // The pinned random source produces the selected face through native rollDice.
  const d6Face = rollDice(nativeDice, {
    rng: () => (scenario.d6Face - 1) / 6,
  });
  const proficiencyBonus = calculateProficiencyBonus(actor.level);
  const reduction = d6Face + (reaction.addProficiencyBonus ? proficiencyBonus : 0);
  const finalDamage = Math.max(0, incomingDamage - reduction);
  const paidActor = consumeActionCost(actor, REACTION_COST);
  const damagedActor = applyDamageAndCheckDowned(paidActor, finalDamage, false);
  const resolution: HadozeeResilienceResolution = {
    status: 'applied',
    reason: 'applied',
    incomingDamage,
    d6Face,
    proficiencyBonus,
    reduction,
    finalDamage,
    hitPointsBefore,
    hitPointsAfter: damagedActor.currentHP,
    reactionBeforeAvailable,
    reactionAfterAvailable: !damagedActor.actionEconomy.reaction.used,
    reactionSpent: true,
    downed: damagedActor.currentHP === 0 && hitPointsBefore > 0,
  };

  return {
    ...scenario,
    assembly: { ...scenario.assembly, actor: damagedActor },
    outcome: `Hadozee Resilience applied: incoming ${incomingDamage}; d6 ${d6Face} + PB ${proficiencyBonus} = reduction ${reduction}; final damage ${finalDamage}; HP ${hitPointsBefore} -> ${damagedActor.currentHP}; Reaction spent; ${damagedActor.currentHP === 0 ? 'downed' : 'standing'}.`,
    lastResolution: resolution,
  };
}

// ============================================================================
// Visible Race Leaf Surface
// ============================================================================
// The panel exposes canonical facts, deterministic controls, the native
// transaction receipt, parent-reset state, and explicit unsupported boundaries.
// ============================================================================

const HadozeeRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, state, onScenarioEvent }) => {
  const [scenario, setScenario] = useState(() => createHadozeeScenario(race));
  const facts = getCanonicalHadozeeFacts(race);
  const actor = scenario.assembly.actor;
  const reaction = scenario.assembly.reaction;
  const resolution = scenario.lastResolution;

  // Publish the exact transaction receipt that the visible panel renders.
  const handleResolve = (choice: 'apply' | 'decline') => {
    const nextScenario = resolveHadozeeResilience(scenario, choice);
    setScenario(nextScenario);
    onScenarioEvent(`HADOZEE RESILIENCE ${choice.toUpperCase()}: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="hadozee-resilience-title" data-testid="hadozee-race-leaf">
      <h4 id="hadozee-resilience-title">Hadozee · Resilience</h4>

      <div data-testid="hadozee-canonical-facts">
        <p>Size choice: {facts.size ?? 'canonical fact missing'}</p>
        <p>Speed and climb: {facts.speed ?? 'canonical fact missing'}</p>
        <p>Dexterous Feet: {facts.dexterousFeet ?? 'canonical fact missing'}</p>
        <p>Glide: {facts.glide ?? 'canonical fact missing'}</p>
        <p>Hadozee Resilience: {facts.resilience ?? 'canonical fact missing'}</p>
      </div>

      <p data-testid="hadozee-actor-facts">
        Actor: <strong>{actor?.name ?? 'missing'}</strong>; Level {actor?.level ?? 'unknown'}; PB +{actor ? calculateProficiencyBonus(actor.level) : 'unknown'}; HP {actor?.currentHP ?? 'unknown'} / {actor?.maxHP ?? 'unknown'}; Reaction {actor && !actor.actionEconomy.reaction.used ? 'ready' : 'spent/unavailable'}.
      </p>

      <div aria-label="Hadozee deterministic controls">
        <label htmlFor={HADOZEE_DAMAGE_CONTROL_ID}>Incoming damage</label>
        <select
          id={HADOZEE_DAMAGE_CONTROL_ID}
          value={scenario.incomingDamage}
          onChange={event => setScenario(current => ({
            ...current,
            incomingDamage: Number(event.target.value),
          }))}
        >
          <option value={HADOZEE_DEFAULT_INCOMING_DAMAGE}>12 damage (downing proof)</option>
          <option value="8">8 damage (standing proof)</option>
        </select>

        <label htmlFor={HADOZEE_D6_CONTROL_ID}>Pinned Resilience d6 face</label>
        <select
          id={HADOZEE_D6_CONTROL_ID}
          value={scenario.d6Face}
          onChange={event => setScenario(current => ({
            ...current,
            d6Face: Number(event.target.value),
          }))}
        >
          {[1, 2, 3, 4, 5, 6].map(face => (
            <option key={face} value={face}>Face {face}</option>
          ))}
        </select>

        <Button id={HADOZEE_RESILIENCE_CONTROL_ID} type="button" variant="primary" size="sm" onClick={() => handleResolve('apply')}>
          Apply Resilience
        </Button>
        <Button id={HADOZEE_DECLINE_CONTROL_ID} type="button" variant="secondary" size="sm" onClick={() => handleResolve('decline')}>
          Decline Resilience
        </Button>
      </div>

      <p aria-live="polite" role="status" data-testid="hadozee-outcome">{scenario.outcome}</p>
      <div data-testid="hadozee-resolution">
        {resolution
          ? `Status ${resolution.status}; incoming ${resolution.incomingDamage}; d6 ${resolution.d6Face ?? 'not rolled'}; PB +${resolution.proficiencyBonus}; reduction ${resolution.reduction}; final damage ${resolution.finalDamage}; HP ${resolution.hitPointsBefore} -> ${resolution.hitPointsAfter}; Reaction before ${resolution.reactionBeforeAvailable ? 'ready' : 'unavailable'}, after ${resolution.reactionAfterAvailable ? 'ready' : 'unavailable'}; spent ${resolution.reactionSpent ? 'yes' : 'no'}; downed ${resolution.downed ? 'yes' : 'no'}.`
          : 'No Hadozee Resilience transaction resolved yet.'}
      </div>

      <p data-testid="hadozee-reaction-parser">
        Parsed reaction: {reaction?.reactionId ?? 'missing'}; trigger {reaction?.triggerType ?? 'missing'}; formula {reaction ? `${reaction.dice} + proficiency bonus` : 'missing'}; frequency is reaction-economy based, not a per-rest use pool.
      </p>

      <p data-testid="hadozee-boundary">
        Boundary: this leaf proves only the parsed damage-reduction reaction, native d6, reaction payment, incoming/final damage, HP, and player downing transition. Dexterous Feet, Glide, climb speed, size choice, falling, horizontal glide movement, object manipulation, map position, and 2D/3D rendering remain canonical facts or explicit boundaries here. The local adapter exists because no shared high-level racial-reaction executor currently owns this parsed Resilience transaction. Parent resetCount remounts the actor and restores HP, Reaction, controls, and result.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

// Parent Reset increments resetCount; the keyed boundary restores every local
// choice, actor HP, Reaction state, and transaction receipt to baseline.
export const HadozeeRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <HadozeeRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'hadozee-resilience',
  raceId: 'hadozee',
  label: 'Hadozee Resilience',
  description: 'Resolve deterministic Hadozee Resilience through parsed reaction metadata, native d6/reaction payment, and HP/downing helpers.',
  Component: HadozeeRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
