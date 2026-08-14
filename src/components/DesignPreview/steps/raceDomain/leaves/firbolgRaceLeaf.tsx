import React, { useState } from 'react';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { canAffordActionCost, consumeActionCost, resetEconomy } from '../../../../../utils/combat/actionEconomyUtils';
import { applyRuntimeStatusCondition, removeRuntimeStatusCondition } from '../../../../../utils/combat/statusConditionUtils';
import { calculateProficiencyBonus } from '../../../../../utils/character/savingThrowUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../../../../types/combat';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Firbolg race a deterministic Hidden Step
 * transaction in the Tactical Sandbox Race domain.
 *
 * The transaction assembles a production player and combat actor, pays the
 * native Bonus Action and parsed Proficiency Bonus resource, and writes the
 * Invisible condition through the shared paired-status helper. Firbolg Magic,
 * Powerful Build, and Speech of Beast and Leaf remain canonical fact panels;
 * this leaf does not invent spell casting, carrying, or social systems.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Firbolg data, production character assembly, the
 * racial resource parser, action economy, paired condition storage/removal,
 * and the shared Race domain contract.
 */

// ============================================================================
// Canonical Firbolg Facts And Hidden Step Resource
// ============================================================================
// Every rule sentence shown here is read from the supplied Race. The resource
// key is only the stable parser key; its current/max/reset values come from the
// production racial trait library rather than a preview-only counter.
// ============================================================================

export const FIRBOLG_HIDDEN_STEP_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'firbolg__hidden_step__resource',
);
export const FIRBOLG_HIDDEN_STEP_ACTOR_ID = 'firbolg-hidden-step-actor';
export const FIRBOLG_HIDDEN_STEP_SOURCE = 'Firbolg Hidden Step';
export const FIRBOLG_HIDDEN_STEP_LEVEL = 5;

const FIRBOLG_MAGIC_TRAIT = /^Firbolg Magic:\s*/i;
const FIRBOLG_HIDDEN_STEP_TRAIT = /^Hidden Step:\s*/i;
const FIRBOLG_POWERFUL_BUILD_TRAIT = /^Powerful Build:\s*/i;
const FIRBOLG_SPEECH_TRAIT = /^Speech of Beast and Leaf:\s*/i;

/** Return one exact named trait from the canonical Firbolg record. */
function getCanonicalFirbolgTrait(race: Race, matcher: RegExp): string | null {
  return race.traits.find(trait => matcher.test(trait.trim())) ?? null;
}

/** Return the canonical Firbolg Magic rule text for the fact panel. */
export function getCanonicalFirbolgMagicTrait(race: Race): string | null {
  return getCanonicalFirbolgTrait(race, FIRBOLG_MAGIC_TRAIT);
}

/** Return the exact Hidden Step rule used by the parser and transaction. */
export function getCanonicalFirbolgHiddenStepTrait(race: Race): string | null {
  return getCanonicalFirbolgTrait(race, FIRBOLG_HIDDEN_STEP_TRAIT);
}

/** Return the canonical Powerful Build carrying-capacity fact. */
export function getCanonicalFirbolgPowerfulBuildTrait(race: Race): string | null {
  return getCanonicalFirbolgTrait(race, FIRBOLG_POWERFUL_BUILD_TRAIT);
}

/** Return the canonical limited Beast and Leaf communication fact. */
export function getCanonicalFirbolgSpeechTrait(race: Race): string | null {
  return getCanonicalFirbolgTrait(race, FIRBOLG_SPEECH_TRAIT);
}

/** Confirm that all facts this leaf displays still exist in active Firbolg data. */
export function hasCanonicalFirbolgFeatures(race: Race): boolean {
  const magic = getCanonicalFirbolgMagicTrait(race);
  const hiddenStep = getCanonicalFirbolgHiddenStepTrait(race);
  const powerfulBuild = getCanonicalFirbolgPowerfulBuildTrait(race);
  const speech = getCanonicalFirbolgSpeechTrait(race);
  const knownSpellIds = new Set(race.knownSpells?.map(spell => spell.spellId) ?? []);

  return race.id === 'firbolg'
    && race.name === 'Firbolg'
    && !!magic
    && /detect magic/i.test(magic)
    && /disguise self/i.test(magic)
    && /long rest/i.test(magic)
    && knownSpellIds.has('detect-magic')
    && knownSpellIds.has('disguise-self')
    && !!hiddenStep
    && /bonus action/i.test(hiddenStep)
    && /invisible/i.test(hiddenStep)
    && /start of your next turn/i.test(hiddenStep)
    && /attack/i.test(hiddenStep)
    && /damage roll/i.test(hiddenStep)
    && /saving throw/i.test(hiddenStep)
    && /proficiency bonus/i.test(hiddenStep)
    && /long rest/i.test(hiddenStep)
    && !!powerfulBuild
    && /carrying capacity/i.test(powerfulBuild)
    && !!speech
    && /Beasts/i.test(speech)
    && /Plants/i.test(speech)
    && /Charisma checks/i.test(speech);
}

/** Read the production-parsed Hidden Step resource from the combat actor. */
export function getFirbolgHiddenStepResource(actor: CombatCharacter | null | undefined) {
  return actor?.limitedUses?.[FIRBOLG_HIDDEN_STEP_RESOURCE_ID];
}

/** Confirm that the racial parser projected Powerful Build onto the actor. */
export function hasFirbolgPowerfulBuildProjection(actor: CombatCharacter | null | undefined): boolean {
  return actor?.modifiers?.powerfulBuild === true;
}

// ============================================================================
// Production Actor Assembly
// ============================================================================
// The preview uses the same persistent-character and combat bridges as the
// mounted game. The only adapter seam is carrying the parsed limited-use entry
// across the bridge because the current bridge does not project racial uses.
// ============================================================================

function createFirbolgActor(race: Race): CombatCharacter | null {
  // This level gives the fixture PB +3, making the parsed three-use resource
  // and its long-rest reset visible without creating a special-case level.
  const quickCharacter = createQuickCharacter({
    name: 'Firbolg · Hidden Step Tester',
    raceId: race.id,
    classId: 'fighter',
    level: FIRBOLG_HIDDEN_STEP_LEVEL,
    stats: [16, 12, 14, 10, 10, 10],
  });
  if (!quickCharacter || !hasCanonicalFirbolgFeatures(race)) return null;

  // The parser supplies Firbolg Magic grants, Powerful Build, and Hidden Step
  // resource metadata from the canonical race rather than copied fixture data.
  const assembledCharacter = applyRacialSpellGrantsByLevel(quickCharacter, FIRBOLG_HIDDEN_STEP_LEVEL);
  const generatedActor = createPlayerCombatCharacter(assembledCharacter);
  const resource = assembledCharacter.limitedUses?.[FIRBOLG_HIDDEN_STEP_RESOURCE_ID];
  if (!resource || !hasFirbolgPowerfulBuildProjection(generatedActor)) return null;

  // DEBT: The production persistent-to-combat bridge currently drops racial
  // limitedUses. Carry only this parsed entry across the explicit preview
  // boundary; a shared bridge fix should remove this adapter in a later task.
  return resetEconomy({
    ...generatedActor,
    id: FIRBOLG_HIDDEN_STEP_ACTOR_ID,
    name: `${race.name} · Hidden Step Tester`,
    limitedUses: {
      [FIRBOLG_HIDDEN_STEP_RESOURCE_ID]: { ...resource },
    },
  });
}

// ============================================================================
// Hidden Step Condition And Resolution
// ============================================================================
// Activation pays every prerequisite before writing Invisible. Ending uses
// exact owned removal, so a later combat condition with another source cannot
// be deleted by this leaf. The mounted engine's race-aware event callback is
// not available here, so the controls expose deterministic attack/damage/save
// break and next-turn expiry through this narrow adapter.
// ============================================================================

export type FirbolgHiddenStepBreakTrigger = 'attack' | 'damage' | 'save';
export type FirbolgHiddenStepResolutionReason =
  | 'activated'
  | 'already_invisible'
  | 'assembly_unavailable'
  | 'bonus_action_unavailable'
  | 'resource_unavailable'
  | 'ended_on_attack'
  | 'ended_on_damage'
  | 'ended_on_save'
  | 'ended_on_next_turn'
  | 'no_active_hidden_step';

export interface FirbolgHiddenStepResolution {
  status: 'activated' | 'ended' | 'rejected';
  reason: FirbolgHiddenStepResolutionReason;
  trigger?: FirbolgHiddenStepBreakTrigger | 'next_turn';
}

export interface FirbolgHiddenStepScenarioState {
  actor: CombatCharacter | null;
  outcome: string;
  lastResolution: FirbolgHiddenStepResolution | null;
}

/** Build an unavailable scenario without fabricating a partial actor state. */
function unavailableScenario(outcome: string): FirbolgHiddenStepScenarioState {
  return {
    actor: null,
    outcome,
    lastResolution: { status: 'rejected', reason: 'assembly_unavailable' },
  };
}

/** Build the paired Invisible records used by the native combat condition model. */
function createInvisibleRecords(): { status: StatusEffect; condition: ActiveCondition } {
  // The special duration preserves the exact "start of next turn" rule text;
  // the explicit next-turn control below calls native owned removal because a
  // leaf cannot subscribe to the mounted race-aware turn clock.
  const breakTriggers = [
    'caster_makes_attack_roll',
    'caster_deals_damage',
    'caster_forces_save',
    'duration_expires',
  ] as const;
  return {
    status: {
      id: 'firbolg-hidden-step-invisible',
      name: 'Invisible',
      type: 'buff',
      duration: 1,
      description: 'Invisible until the start of the next turn or until an attack, damage roll, or saving throw trigger.',
      source: FIRBOLG_HIDDEN_STEP_SOURCE,
      breakTriggers: [...breakTriggers],
      effect: { type: 'condition' },
    },
    condition: {
      name: 'Invisible',
      duration: { type: 'special', value: 1 },
      appliedTurn: 1,
      source: FIRBOLG_HIDDEN_STEP_SOURCE,
      breakTriggers: [...breakTriggers],
    },
  };
}

/** Find the exact Hidden Step-owned status so unrelated Invisible stays intact. */
function getFirbolgHiddenStepStatus(actor: CombatCharacter | null): StatusEffect | undefined {
  return actor?.statusEffects.find(status => (
    status.name === 'Invisible' && status.source === FIRBOLG_HIDDEN_STEP_SOURCE
  ));
}

/** Create the baseline actor and prove the canonical parser/resource boundary. */
export function createFirbolgHiddenStepScenario(race: Race): FirbolgHiddenStepScenarioState {
  const actor = createFirbolgActor(race);
  if (!actor) {
    return unavailableScenario('Hidden Step unavailable: canonical Firbolg facts, Powerful Build projection, or production actor assembly is incomplete.');
  }

  const resource = getFirbolgHiddenStepResource(actor);
  return {
    actor,
    outcome: `Ready: ${actor.name}; Hidden Step Bonus Action ready; uses ${resource?.current ?? 0}/${resource?.max === 'proficiency_bonus' ? calculateProficiencyBonus(actor.level) : resource?.max ?? 0}; reset ${resource?.resetOn ?? 'unavailable'}.`,
    lastResolution: null,
  };
}

/** Activate Hidden Step atomically through the shared action and condition helpers. */
export function resolveFirbolgHiddenStep(
  scenario: FirbolgHiddenStepScenarioState,
): FirbolgHiddenStepScenarioState {
  const actor = scenario.actor;
  if (!actor) return unavailableScenario('Hidden Step rejected: the production-assembled actor is unavailable.');
  if (getFirbolgHiddenStepStatus(actor)) {
    return {
      ...scenario,
      outcome: 'Hidden Step rejected atomically: the actor is already Invisible; Bonus Action and uses are unchanged.',
      lastResolution: { status: 'rejected', reason: 'already_invisible' },
    };
  }

  const resource = getFirbolgHiddenStepResource(actor);
  if (!resource || resource.current <= 0) {
    return {
      ...scenario,
      outcome: 'Hidden Step rejected atomically: no Proficiency Bonus uses remain; Bonus Action and status are unchanged.',
      lastResolution: { status: 'rejected', reason: 'resource_unavailable' },
    };
  }
  if (!canAffordActionCost(actor, { type: 'bonus' })) {
    return {
      ...scenario,
      outcome: 'Hidden Step rejected atomically: Bonus Action already used; uses and status are unchanged.',
      lastResolution: { status: 'rejected', reason: 'bonus_action_unavailable' },
    };
  }

  // Payment is last among the guards and happens before applying Invisible, so
  // a successful result always shows one Bonus Action and one charge spent.
  const paidActor = consumeActionCost(actor, { type: 'bonus' });
  const actorWithResource: CombatCharacter = {
    ...paidActor,
    limitedUses: {
      ...(paidActor.limitedUses ?? {}),
      [FIRBOLG_HIDDEN_STEP_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
  };
  const records = createInvisibleRecords();
  const applied = applyRuntimeStatusCondition(actorWithResource, records.status, records.condition);
  const nextResource = getFirbolgHiddenStepResource(applied.character);
  return {
    actor: applied.character,
    outcome: `Hidden Step resolved: Bonus Action paid; Invisible active until the start of the next turn or a break trigger; uses ${nextResource?.current ?? 0}/${resource.max === 'proficiency_bonus' ? calculateProficiencyBonus(actor.level) : resource.max}.`,
    lastResolution: { status: 'activated', reason: 'activated' },
  };
}

/** End Hidden Step through native exact-owned removal for one deterministic trigger. */
export function breakFirbolgHiddenStep(
  scenario: FirbolgHiddenStepScenarioState,
  trigger: FirbolgHiddenStepBreakTrigger,
): FirbolgHiddenStepScenarioState {
  const actor = scenario.actor;
  const status = getFirbolgHiddenStepStatus(actor);
  if (!actor || !status) {
    return {
      ...scenario,
      outcome: 'Hidden Step break rejected: no active Firbolg-owned Invisible status exists.',
      lastResolution: { status: 'rejected', reason: 'no_active_hidden_step', trigger },
    };
  }

  const removed = removeRuntimeStatusCondition(actor, status);
  const reason = trigger === 'attack'
    ? 'ended_on_attack'
    : trigger === 'damage'
      ? 'ended_on_damage'
      : 'ended_on_save';
  return {
    ...scenario,
    actor: removed.character,
    outcome: `Hidden Step ended on ${trigger} trigger: Invisible removed; the spent resource remains consumed.`,
    lastResolution: { status: 'ended', reason, trigger },
  };
}

/** End Hidden Step at the explicit next-turn boundary using native removal. */
export function advanceFirbolgHiddenStepToNextTurn(
  scenario: FirbolgHiddenStepScenarioState,
): FirbolgHiddenStepScenarioState {
  const actor = scenario.actor;
  const status = getFirbolgHiddenStepStatus(actor);
  if (!actor || !status) {
    return {
      ...scenario,
      outcome: 'Hidden Step next-turn expiry rejected: no active Firbolg-owned Invisible status exists.',
      lastResolution: { status: 'rejected', reason: 'no_active_hidden_step', trigger: 'next_turn' },
    };
  }

  const removed = removeRuntimeStatusCondition(actor, status);
  return {
    ...scenario,
    actor: removed.character,
    outcome: 'Hidden Step expired at the deterministic next-turn boundary: Invisible removed; the spent resource remains consumed.',
    lastResolution: { status: 'ended', reason: 'ended_on_next_turn', trigger: 'next_turn' },
  };
}

// ============================================================================
// Visible Firbolg Race Leaf
// ============================================================================
// The small surface shows actor/action/resource/status facts, canonical traits,
// deterministic break/expiry controls, parent event logging, and honest gaps.
// The shell's keyed reset remounts this content and restores all three uses.
// ============================================================================

function FirbolgRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createFirbolgHiddenStepScenario(race));
  const actor = scenario.actor;
  const resource = getFirbolgHiddenStepResource(actor);
  const hiddenStepStatus = getFirbolgHiddenStepStatus(actor);
  const handleResolution = (nextScenario: FirbolgHiddenStepScenarioState) => {
    setScenario(nextScenario);
    onScenarioEvent(`Firbolg HIDDEN STEP ${nextScenario.lastResolution?.status?.toUpperCase() ?? 'UPDATED'}: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="firbolg-hidden-step-title" data-testid="firbolg-race-leaf">
      <h4 id="firbolg-hidden-step-title">Firbolg · Hidden Step</h4>
      <p data-testid="firbolg-hidden-step-canonical-trait">Canonical: {getCanonicalFirbolgHiddenStepTrait(race) ?? 'Hidden Step trait missing'}</p>
      <p data-testid="firbolg-hidden-step-actor">
        Actor: {actor?.name ?? 'missing'}; Level {actor?.level ?? 'unknown'}; PB +{actor?.level ? calculateProficiencyBonus(actor.level) : 'unknown'}; Bonus Action {actor?.actionEconomy.bonusAction.used ? 'used' : 'ready'}; Invisible {hiddenStepStatus ? 'active' : 'inactive'}; Uses {resource?.current ?? 0}/{resource?.max === 'proficiency_bonus' && actor ? calculateProficiencyBonus(actor.level) : resource?.max ?? 0} ({resource?.resetOn ?? 'unavailable'}).
      </p>
      <Button type="button" variant="primary" size="sm" onClick={() => handleResolution(resolveFirbolgHiddenStep(scenario))}>
        Resolve Hidden Step
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => handleResolution(breakFirbolgHiddenStep(scenario, 'attack'))}>
        Break on attack
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => handleResolution(advanceFirbolgHiddenStepToNextTurn(scenario))}>
        Advance to next turn
      </Button>
      <p aria-live="polite" role="status" data-testid="firbolg-hidden-step-outcome">{scenario.outcome}</p>
      <p data-testid="firbolg-hidden-step-facts">
        <strong>Firbolg Magic:</strong> {getCanonicalFirbolgMagicTrait(race) ?? 'Canonical fact unavailable.'}
        {' '}<strong>Powerful Build:</strong> {getCanonicalFirbolgPowerfulBuildTrait(race) ?? 'Canonical fact unavailable.'}
        {' '}<strong>Speech of Beast and Leaf:</strong> {getCanonicalFirbolgSpeechTrait(race) ?? 'Canonical fact unavailable.'}
      </p>
      <p data-testid="firbolg-hidden-step-assembly-boundary">
        Assembly boundary: production quick-character assembly and canonical racial parsing supply Firbolg Magic, Powerful Build, and the PB/Long Rest resource; the leaf carries only the parsed resource across the current combat bridge.
      </p>
      <p data-testid="firbolg-hidden-step-lifecycle-boundary">
        Lifecycle boundary: native paired status storage/removal is exercised here, while the mounted attack, damage-roll, saving-throw, and start-of-next-turn event bus is not wired into this leaf. The controls simulate one deterministic break and the next-turn expiry without claiming full combat-loop proof; no spell cast, carrying calculation, social check, 2D, or 3D system is invented.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** Parent Reset changes the key so actor, resource, and status state restart together. */
export function FirbolgRaceLeaf(props: RaceDomainLeafProps) {
  return <FirbolgRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'firbolg-hidden-step',
  raceId: 'firbolg',
  label: 'Firbolg · Hidden Step',
  description: 'Production-backed Bonus Action invisibility with PB/Long Rest uses, deterministic break/expiry controls, and canonical Firbolg fact boundaries.',
  Component: FirbolgRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
