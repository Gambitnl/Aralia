import React, { useState } from 'react';
import { applyRacialSpellGrantsByLevel } from '../../../../../utils/character/characterUtils';
import {
  rollSavingThrow,
  type SaveAdvantageModifier,
  type SavingThrowResult,
} from '../../../../../utils/character/savingThrowUtils';
import { createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { applyDamageAndCheckDowned } from '../../../../../utils/combat/deathSaveUtils';
import { ResistanceCalculator } from '../../../../../utils/combat/resistanceUtils';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { DamageType, type DamageType as DamageTypeName } from '../../../../../types/spells';
import type { CombatCharacter } from '../../../../../types/combat';
import type { PlayerCharacter, Race } from '../../../../../types';
import { Button } from '../../../../ui/Button';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Githzerai one deterministic Mental Discipline
 * comparison and one compact Psychic Resilience damage transaction.
 *
 * It builds a real player actor with the production racial parser, converts
 * that actor through the normal combat bridge, and calls the native saving
 * throw, dice, resistance, and HP helpers. The psionic spells and ability
 * choice remain canonical facts because this leaf does not cast or select
 * those spells on the player's behalf.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Githzerai data, production character assembly,
 * racial parsing, native save/dice/resistance/HP helpers, and the Race domain
 * contract.
 */

// ============================================================================
// Canonical Facts And Deterministic Constants
// ============================================================================
// These constants make the proof repeatable while the race record remains the
// source of truth for every displayed rule and spell gate.
// ============================================================================

export const GITHZERAI_ACTOR_ID = 'githzerai-mental-discipline-actor';
export const GITHZERAI_SAVE_DC = 12;
export const GITHZERAI_PSYCHIC_RAW_DAMAGE = 15;
export const GITHZERAI_PSYCHIC_RESILIENCE_CONTROL_ID = 'resolve-githzerai-psychic-resilience';

const GITHZERAI_SCENARIO_LEVEL = 5;
const PSYCHIC_DAMAGE: DamageTypeName = DamageType.Psychic;
const MENTAL_DISCIPLINE_PROJECTION = /saving throws?/i;
const MENTAL_DISCIPLINE_CONDITION = /charmed|frightened/i;

export type GithzeraiCondition = 'charmed' | 'frightened';

export interface GithzeraiCanonicalFacts {
  psionics: string | null;
  mentalDiscipline: string | null;
  psychicResilience: string | null;
  spellAbilityChoice: string | null;
  spellGates: readonly string[];
}

export interface GithzeraiSaveSnapshot {
  condition: 'ordinary save' | 'avoid/end Charmed' | 'avoid/end Frightened';
  d20Rolls: readonly number[];
  save: SavingThrowResult;
}

export interface GithzeraiMentalDisciplineResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'parser_projection_missing' | 'context_adapter_missing';
  ordinary: GithzeraiSaveSnapshot | null;
  charmed: GithzeraiSaveSnapshot | null;
  frightened: GithzeraiSaveSnapshot | null;
}

export interface GithzeraiPsychicResolution {
  rawDamage: number;
  finalDamage: number;
  hitPointsBefore: number;
  hitPointsAfter: number;
  resistanceApplied: boolean;
}

export interface GithzeraiScenarioState {
  actor: CombatCharacter | null;
  ordinaryActor: CombatCharacter | null;
  defenseBridge: 'production racial parser' | 'narrow canonical defense adapter';
  outcome: string;
  lastMentalDiscipline: GithzeraiMentalDisciplineResolution | null;
  lastPsychicResilience: GithzeraiPsychicResolution | null;
  eventLog: readonly string[];
}

/** Find a named canonical trait without copying its text into the leaf. */
export function getCanonicalGithzeraiTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Read spell thresholds and the explicit ability-choice fact from canonical data. */
export function getGithzeraiCanonicalFacts(race: Race): GithzeraiCanonicalFacts {
  return {
    psionics: getCanonicalGithzeraiTrait(race, 'Githzerai Psionics'),
    mentalDiscipline: getCanonicalGithzeraiTrait(race, 'Mental Discipline'),
    psychicResilience: getCanonicalGithzeraiTrait(race, 'Psychic Resilience'),
    spellAbilityChoice: race.racialSpellChoice?.traitDescription ?? null,
    spellGates: (race.knownSpells ?? []).map(spell => `Level ${spell.minLevel}: ${spell.spellId}`),
  };
}

/** Refuse to demonstrate a rule if the active canonical record loses a needed fact. */
export function hasCanonicalGithzeraiFeatures(race: Race): boolean {
  const facts = getGithzeraiCanonicalFacts(race);
  return race.id === 'githzerai'
    && !!facts.psionics
    && /mage hand/i.test(facts.psionics)
    && /shield/i.test(facts.psionics)
    && /detect thoughts/i.test(facts.psionics)
    && !!facts.mentalDiscipline
    && /advantage on saving throws/i.test(facts.mentalDiscipline)
    && /charmed/i.test(facts.mentalDiscipline)
    && /frightened/i.test(facts.mentalDiscipline)
    && !!facts.psychicResilience
    && /psychic damage/i.test(facts.psychicResilience)
    && facts.spellGates.length === 3
    && !!facts.spellAbilityChoice;
}

// ============================================================================
// Narrow Mental Discipline Context Adapter
// ============================================================================
// The parser correctly exposes the rule as free text, but the native save
// helper needs an effect tag such as `charmed` or `frightened`. The adapter
// derives only those two canonical tags and prevents the raw projection from
// granting advantage on an unrelated ordinary save.
// ============================================================================

/** Identify the parser's free-text Mental Discipline advantage projection. */
export function isGithzeraiMentalDisciplineProjection(modifier: string): boolean {
  return MENTAL_DISCIPLINE_PROJECTION.test(modifier) && MENTAL_DISCIPLINE_CONDITION.test(modifier);
}

/** Convert one canonical condition into the structured native save modifier. */
export function getGithzeraiMentalDisciplineSaveAdapter(
  race: Race,
  condition: GithzeraiCondition,
): SaveAdvantageModifier | null {
  const mentalDiscipline = getCanonicalGithzeraiTrait(race, 'Mental Discipline');
  if (!mentalDiscipline || !/advantage on saving throws/i.test(mentalDiscipline) || !new RegExp(condition, 'i').test(mentalDiscipline)) {
    return null;
  }

  return {
    type: 'advantage',
    context: 'saving_throw',
    against: [condition],
    source: `Mental Discipline (canonical ${condition} context)`,
  };
}

/** Remove only the broad parser projection before an ordinary baseline save. */
export function applyGithzeraiMentalDisciplineContext(actor: CombatCharacter): CombatCharacter {
  const modifiers = actor.modifiers ?? { advantage: [], disadvantage: [], bonuses: [] };
  return {
    ...actor,
    modifiers: {
      ...modifiers,
      advantage: modifiers.advantage.filter(modifier => !isGithzeraiMentalDisciplineProjection(modifier)),
      disadvantage: [...modifiers.disadvantage],
      bonuses: [...modifiers.bonuses],
    },
  };
}

/** Confirm that production parsing, rather than this leaf, supplied the rule projection. */
export function hasGithzeraiMentalDisciplineParserProjection(
  character: Pick<PlayerCharacter, 'modifiers'> | Pick<CombatCharacter, 'modifiers'> | null,
): boolean {
  return character?.modifiers?.advantage.some(isGithzeraiMentalDisciplineProjection) ?? false;
}

// ============================================================================
// Production Actor Assembly And Scenario State
// ============================================================================
// The actor is created through the same quick-character and combat bridge used
// by the sandbox. A narrow resistance fallback keeps a missing bridge mapping
// visible without replacing the parser as the authoritative source.
// ============================================================================

const GITHZERAI_ACTOR_CONFIG = {
  name: 'Githzerai Mental Discipline Tester',
  raceId: 'githzerai',
  classId: 'fighter',
  level: GITHZERAI_SCENARIO_LEVEL,
  stats: [10, 10, 10, 10, 12, 14] as [number, number, number, number, number, number],
};

function unavailableGithzeraiScenario(
  reason: GithzeraiMentalDisciplineResolution['reason'],
  outcome: string,
): GithzeraiScenarioState {
  return {
    actor: null,
    ordinaryActor: null,
    defenseBridge: 'production racial parser',
    outcome,
    lastMentalDiscipline: { status: 'rejected', reason, ordinary: null, charmed: null, frightened: null },
    lastPsychicResilience: null,
    eventLog: [],
  };
}

/** Assemble and parse the production actor used by all Githzerai transactions. */
export function createGithzeraiScenario(race: Race): GithzeraiScenarioState {
  if (!hasCanonicalGithzeraiFeatures(race)) {
    return unavailableGithzeraiScenario('canonical_trait_missing', 'Githzerai proof unavailable: canonical traits no longer contain the demonstrated rules.');
  }

  const quickCharacter = createQuickCharacter(GITHZERAI_ACTOR_CONFIG);
  if (!quickCharacter) {
    return unavailableGithzeraiScenario('assembly_unavailable', 'Githzerai proof unavailable: production quick-character assembly rejected the actor.');
  }

  const parsedCharacter = applyRacialSpellGrantsByLevel(quickCharacter, GITHZERAI_SCENARIO_LEVEL);
  if (!hasGithzeraiMentalDisciplineParserProjection(parsedCharacter)) {
    return unavailableGithzeraiScenario('parser_projection_missing', 'Mental Discipline unavailable: production racial parsing did not expose its save projection.');
  }

  const productionActor = createPlayerCombatCharacter({
    ...parsedCharacter,
    spellbook: undefined,
    spellSlots: undefined,
  });
  const hasPsychicResistance = productionActor.resistances?.some(type => type.toLowerCase() === PSYCHIC_DAMAGE.toLowerCase()) ?? false;
  const actor: CombatCharacter = {
    ...productionActor,
    id: GITHZERAI_ACTOR_ID,
  };

  if (hasPsychicResistance) {
    return {
      actor,
      ordinaryActor: applyGithzeraiMentalDisciplineContext(actor),
      defenseBridge: 'production racial parser',
      outcome: `Ready: production Githzerai actor; Mental Discipline parser projection native; Psychic resistance native.`,
      lastMentalDiscipline: null,
      lastPsychicResilience: null,
      eventLog: [],
    };
  }

  // DEBT: The combat bridge currently misses this parsed racial defense in some
  // snapshots. The durable fix belongs in the shared bridge; this leaf adds
  // only the canonical Psychic resistance while labeling the boundary.
  const fallbackActor: CombatCharacter = {
    ...actor,
    resistances: [...(actor.resistances ?? []), PSYCHIC_DAMAGE],
  };
  return {
    actor: fallbackActor,
    ordinaryActor: applyGithzeraiMentalDisciplineContext(fallbackActor),
    defenseBridge: 'narrow canonical defense adapter',
    outcome: 'Ready: production Githzerai actor; Psychic resistance uses a narrow canonical defense adapter because the combat bridge did not project it.',
    lastMentalDiscipline: null,
    lastPsychicResilience: null,
    eventLog: [],
  };
}

/** Roll one ordinary save and both canonical condition saves through native helpers. */
export function resolveGithzeraiMentalDiscipline(
  scenario: GithzeraiScenarioState,
  race: Race,
  rng: () => number = Math.random,
): GithzeraiScenarioState {
  if (!scenario.actor || !scenario.ordinaryActor) {
    return { ...scenario, outcome: 'Mental Discipline rejected: the production actor or ordinary baseline is unavailable.' };
  }
  if (!hasGithzeraiMentalDisciplineParserProjection(scenario.actor)) {
    return { ...scenario, outcome: 'Mental Discipline rejected: the parser-backed save projection is unavailable.' };
  }

  // Capture the narrowed baseline once so both native save branches use the
  // same ordinary actor even inside the nested condition resolver.
  const ordinaryActor = scenario.ordinaryActor;
  const ordinaryRolls: number[] = [];
  const ordinarySave = rollSavingThrow(ordinaryActor, 'Wisdom', GITHZERAI_SAVE_DC, undefined, { tags: ['ordinary save'] }, undefined, {
    rng: () => {
      const value = rng();
      ordinaryRolls.push(Math.floor(value * 20) + 1);
      return value;
    },
  });

  const resolveCondition = (condition: GithzeraiCondition): GithzeraiSaveSnapshot | null => {
    const adapter = getGithzeraiMentalDisciplineSaveAdapter(race, condition);
    if (!adapter) return null;
    const d20Rolls: number[] = [];
    const save = rollSavingThrow(ordinaryActor, 'Wisdom', GITHZERAI_SAVE_DC, undefined, { tags: [condition] }, [adapter], {
      rng: () => {
        const value = rng();
        d20Rolls.push(Math.floor(value * 20) + 1);
        return value;
      },
    });
    return {
      condition: condition === 'charmed' ? 'avoid/end Charmed' : 'avoid/end Frightened',
      d20Rolls,
      save,
    };
  };

  const charmed = resolveCondition('charmed');
  const frightened = resolveCondition('frightened');
  if (!charmed || !frightened) {
    return {
      ...scenario,
      outcome: 'Mental Discipline rejected: one canonical condition context adapter is unavailable.',
      lastMentalDiscipline: { status: 'rejected', reason: 'context_adapter_missing', ordinary: null, charmed: null, frightened: null },
    };
  }

  const resolution: GithzeraiMentalDisciplineResolution = {
    status: 'resolved',
    reason: 'resolved',
    ordinary: { condition: 'ordinary save', d20Rolls: ordinaryRolls, save: ordinarySave },
    charmed,
    frightened,
  };
  const event = `Mental Discipline resolved: ordinary ${ordinarySave.total}; Charmed kept ${charmed.save.roll} from ${charmed.d20Rolls.join(' / ')} for ${charmed.save.total}; Frightened kept ${frightened.save.roll} from ${frightened.d20Rolls.join(' / ')} for ${frightened.save.total}.`;
  return {
    ...scenario,
    outcome: event,
    lastMentalDiscipline: resolution,
    eventLog: [...scenario.eventLog, event],
  };
}

/** Apply one fixed psychic hit through the native resistance and HP helpers. */
export function resolveGithzeraiPsychicResilience(scenario: GithzeraiScenarioState): GithzeraiScenarioState {
  if (!scenario.actor) {
    return { ...scenario, outcome: 'Psychic Resilience rejected: the production actor is unavailable.' };
  }
  const hitPointsBefore = scenario.actor.currentHP;
  const finalDamage = ResistanceCalculator.applyResistances(
    GITHZERAI_PSYCHIC_RAW_DAMAGE,
    PSYCHIC_DAMAGE,
    scenario.actor,
    createMockCombatCharacter({ id: 'githzerai-psychic-source', name: 'Psychic Test Source', team: 'enemy', position: { x: 3, y: 2 } }),
    true,
  );
  const actorAfter = applyDamageAndCheckDowned(scenario.actor, finalDamage, false);
  const resolution: GithzeraiPsychicResolution = {
    rawDamage: GITHZERAI_PSYCHIC_RAW_DAMAGE,
    finalDamage,
    hitPointsBefore,
    hitPointsAfter: actorAfter.currentHP,
    resistanceApplied: finalDamage < GITHZERAI_PSYCHIC_RAW_DAMAGE,
  };
  const event = `Psychic Resilience resolved: ${GITHZERAI_PSYCHIC_RAW_DAMAGE} raw Psychic -> ${finalDamage}; HP ${hitPointsBefore} -> ${actorAfter.currentHP}.`;
  return {
    ...scenario,
    actor: actorAfter,
    outcome: event,
    lastPsychicResilience: resolution,
    eventLog: [...scenario.eventLog, event],
  };
}

// ============================================================================
// Visible Githzerai Leaf Surface
// ============================================================================
// The UI exposes faces, kept totals, HP, logs, canonical spell facts, and
// honest unsupported boundaries. Parent resetCount remounts this content.
// ============================================================================

function GithzeraiRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createGithzeraiScenario(race));
  const facts = getGithzeraiCanonicalFacts(race);

  const resolveMentalDiscipline = () => {
    const next = resolveGithzeraiMentalDiscipline(scenario, race);
    setScenario(next);
    onScenarioEvent(`Githzerai MENTAL DISCIPLINE: ${next.outcome}`);
  };

  const resolvePsychicResilience = () => {
    const next = resolveGithzeraiPsychicResilience(scenario);
    setScenario(next);
    onScenarioEvent(`Githzerai PSYCHIC RESILIENCE: ${next.outcome}`);
  };

  const reset = () => {
    setScenario(createGithzeraiScenario(race));
    onScenarioEvent('Githzerai proof reset to the production actor baseline.');
  };

  return (
    <section aria-labelledby="githzerai-mental-discipline-title" data-testid="githzerai-race-leaf">
      <h4 id="githzerai-mental-discipline-title">Githzerai · Mental Discipline</h4>
      <p data-testid="githzerai-mental-discipline-trait">Canonical: {facts.mentalDiscipline ?? 'Mental Discipline trait missing'}</p>
      <div data-testid="githzerai-actor-facts">
        Actor: {scenario.actor?.name ?? 'unavailable'}; Level {scenario.actor?.level ?? 'unknown'}; parser projection {scenario.actor && hasGithzeraiMentalDisciplineParserProjection(scenario.actor) ? 'native' : 'missing'}; Psychic resistance {scenario.actor?.resistances?.join(', ') ?? 'missing'}; defense bridge {scenario.defenseBridge}.
      </div>

      <Button type="button" variant="primary" size="sm" onClick={resolveMentalDiscipline}>Resolve Mental Discipline saves</Button>
      <Button type="button" variant="action" size="sm" id={GITHZERAI_PSYCHIC_RESILIENCE_CONTROL_ID} onClick={resolvePsychicResilience}>Resolve 15 Psychic damage</Button>
      <Button type="button" variant="secondary" size="sm" onClick={reset}>Reset Githzerai proof</Button>

      <p aria-live="polite" role="status" data-testid="githzerai-outcome">{scenario.outcome}</p>
      <div data-testid="githzerai-save-result">
        {scenario.lastMentalDiscipline?.status === 'resolved'
          ? <>
            <p>Ordinary baseline: d20 face {scenario.lastMentalDiscipline.ordinary?.d20Rolls.join(' / ')}; Wisdom save total {scenario.lastMentalDiscipline.ordinary?.save.total}.</p>
            <p>Avoid/end Charmed: d20 faces {scenario.lastMentalDiscipline.charmed?.d20Rolls.join(' / ')}; kept {scenario.lastMentalDiscipline.charmed?.save.roll}; Wisdom save total {scenario.lastMentalDiscipline.charmed?.save.total}; advantage applied.</p>
            <p>Avoid/end Frightened: d20 faces {scenario.lastMentalDiscipline.frightened?.d20Rolls.join(' / ')}; kept {scenario.lastMentalDiscipline.frightened?.save.roll}; Wisdom save total {scenario.lastMentalDiscipline.frightened?.save.total}; advantage applied.</p>
          </>
          : 'No Mental Discipline save comparison resolved yet.'}
      </div>
      <p data-testid="githzerai-hp">
        HP: {scenario.actor?.currentHP ?? 'unavailable'} / {scenario.actor?.maxHP ?? 'unavailable'}{scenario.lastPsychicResilience ? `; last damage ${scenario.lastPsychicResilience.rawDamage} -> ${scenario.lastPsychicResilience.finalDamage}` : ''}
      </p>
      <ol aria-label="Githzerai event log" data-testid="githzerai-event-log">
        {scenario.eventLog.length > 0 ? scenario.eventLog.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>) : <li>No Githzerai transaction yet.</li>}
      </ol>

      <div data-testid="githzerai-canonical-facts">
        <p>Githzerai Psionics: {facts.psionics ?? 'canonical fact missing'}</p>
        <p>Spell gates: {facts.spellGates.join(' · ') || 'canonical gates missing'}</p>
        <p>Spellcasting ability choice: {facts.spellAbilityChoice ?? 'canonical choice missing'}</p>
        <p>Psychic Resilience: {facts.psychicResilience ?? 'canonical fact missing'}</p>
      </div>
      <p data-testid="githzerai-boundary">
        Boundary: the parser supplies the raw Mental Discipline projection; this leaf derives only canonical Charmed and Frightened effect tags for the native save helper. It does not apply or remove conditions, does not cast Mage Hand, Shield, or Detect Thoughts, does not spend spell slots, does not choose Intelligence/Wisdom/Charisma, and does not claim 2D/3D render proof. Psychic Resilience is the only damage transaction shown, and Reset restores the parsed actor baseline.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** Parent resetCount remounts the leaf and clears save, HP, and event state. */
export function GithzeraiRaceLeaf(props: RaceDomainLeafProps) {
  return <GithzeraiRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

/** Automatic discovery consumes this exact named registration export. */
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'githzerai-mental-discipline',
  raceId: 'githzerai',
  label: 'Githzerai · Mental Discipline',
  description: 'Compare ordinary and canonical Charmed/Frightened saves with native advantage, plus a fixed native Psychic Resilience transaction.',
  Component: GithzeraiRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
