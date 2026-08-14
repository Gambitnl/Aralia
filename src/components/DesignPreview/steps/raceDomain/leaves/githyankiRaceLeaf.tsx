// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 14/08/2026, 00:04:44
 * Dependents: None (Orphan)
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { applyRacialSpellGrantsByLevel } from '../../../../../utils/character/characterUtils';
import { createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { applyDamageAndCheckDowned } from '../../../../../utils/combat/deathSaveUtils';
import { ResistanceCalculator } from '../../../../../utils/combat/resistanceUtils';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { DamageType, type DamageType as DamageTypeName } from '../../../../../types/spells';
import type { CombatCharacter } from '../../../../../types/combat';
import type { Race } from '../../../../../types';
import { Button } from '../../../../ui/Button';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Githyanki race one deterministic Psychic
 * Resilience transaction in the Tactical Sandbox Race domain.
 *
 * The leaf builds a PlayerCharacter with the production race parser, converts
 * it through the normal combat actor bridge, and sends one fixed psychic hit
 * through the shared resistance and HP helpers. It also displays the exact
 * Astral Knowledge and Githyanki Psionics facts without pretending to grant a
 * rest choice or cast a racial spell.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: the canonical Githyanki Race record, racial trait parser,
 * production actor conversion, resistance math, and HP/downing helpers.
 */

// ============================================================================
// Canonical Facts And Deterministic Controls
// ============================================================================
// These values define the narrow proof transaction. The raw hit is fixed so
// the visible result always demonstrates 15 psychic damage becoming 7 after
// the canonical resistance calculation.
// ============================================================================

export const GITHYANKI_PSYCHIC_RESILIENCE_CONTROL_ID = 'resolve-githyanki-psychic-resilience';
export const GITHYANKI_PSYCHIC_RESILIENCE_ACTOR_ID = 'githyanki-psychic-resilience-actor';
export const GITHYANKI_PSYCHIC_SOURCE_ID = 'githyanki-psychic-resilience-source';
export const GITHYANKI_PSYCHIC_RAW_DAMAGE = 15;
const GITHYANKI_LEVEL = 5;
const PSYCHIC_DAMAGE: DamageTypeName = DamageType.Psychic;

export interface GithyankiCanonicalFacts {
  astralKnowledge: string | null;
  githyankiPsionics: string | null;
  psychicResilience: string | null;
  spellAbilityChoice: string | null;
  spellGates: readonly string[];
}

export interface GithyankiPsychicResolution {
  rawDamage: number;
  finalDamage: number;
  hitPointsBefore: number;
  hitPointsAfter: number;
  resistanceApplied: boolean;
}

export interface GithyankiPsychicScenarioState {
  actor: CombatCharacter;
  source: CombatCharacter;
  resolution: GithyankiPsychicResolution | null;
  resolutionCount: number;
  eventLog: readonly string[];
  outcome: string;
  defenseBridge: 'production racial parser' | 'narrow canonical defense adapter';
}

const getTraitStartingWith = (race: Race, prefix: string): string | null => (
  race.traits.find(trait => trait.toLowerCase().startsWith(prefix.toLowerCase())) ?? null
);

/** Read the race record rather than copying its rule text into the preview. */
export function getGithyankiCanonicalFacts(race: Race): GithyankiCanonicalFacts {
  const spellGates = (race.knownSpells ?? []).map(spell => (
    `Level ${spell.minLevel}: ${spell.spellId}`
  ));

  return {
    astralKnowledge: getTraitStartingWith(race, 'Astral Knowledge:'),
    githyankiPsionics: getTraitStartingWith(race, 'Githyanki Psionics:'),
    psychicResilience: getTraitStartingWith(race, 'Psychic Resilience:'),
    spellAbilityChoice: race.racialSpellChoice?.traitDescription ?? null,
    spellGates,
  };
}

/** Confirm that this leaf still points at all canonical Githyanki facts. */
export function hasCanonicalGithyankiFacts(race: Race): boolean {
  const facts = getGithyankiCanonicalFacts(race);
  return race.id === 'githyanki'
    && facts.astralKnowledge !== null
    && facts.githyankiPsionics !== null
    && facts.psychicResilience !== null
    && /psychic damage/i.test(facts.psychicResilience)
    && facts.spellGates.length === 3
    && facts.spellAbilityChoice !== null;
}

// ============================================================================
// Production Actor Assembly And Defense Boundary
// ============================================================================
// The actor starts as a normal PlayerCharacter, receives the same racial
// feature parser used by character progression, and then crosses the usual
// persistent-to-combat adapter. A tiny fallback is retained only for the case
// where that bridge fails to project the already-parsed psychic defense.
// ============================================================================

function createGithyankiActor(race: Race): {
  actor: CombatCharacter;
  defenseBridge: GithyankiPsychicScenarioState['defenseBridge'];
} | null {
  const character = createQuickCharacter({
    name: 'Githyanki Resilience Test',
    raceId: race.id,
    classId: 'fighter',
    level: GITHYANKI_LEVEL,
    stats: [15, 14, 13, 12, 10, 8],
  });
  if (!character) return null;

  // This parser applies level-gated racial data and defensive trait buckets
  // before the actor is handed to combat. No spell is cast by this scenario.
  const parsedCharacter = applyRacialSpellGrantsByLevel(character, GITHYANKI_LEVEL);
  // The parser also prepares the canonical racial spellbook. This proof keeps
  // that data in the displayed Race facts instead of asking the combat bridge
  // to hydrate spell actions without spell records or implying a cast.
  const combatCharacterSource = {
    ...parsedCharacter,
    spellbook: undefined,
    spellSlots: undefined,
  };
  const productionActor = createPlayerCombatCharacter(combatCharacterSource);
  const hasPsychicResistance = productionActor.resistances?.some(
    damageType => damageType.toLowerCase() === PSYCHIC_DAMAGE.toLowerCase(),
  ) ?? false;

  if (hasPsychicResistance) {
    return {
      actor: {
        ...productionActor,
        id: GITHYANKI_PSYCHIC_RESILIENCE_ACTOR_ID,
        position: { x: 2, y: 2 },
      },
      defenseBridge: 'production racial parser',
    };
  }

  // DEBT: The production bridge currently has a fallback for missing racial
  // defense projection. The correct long-term fix is to make the shared bridge
  // preserve every parsed defense bucket; this leaf keeps the gap visible while
  // proving the canonical Psychic resistance and never inventing a new rule.
  const canonicalResistances = productionActor.resistances ?? [];
  return {
    actor: {
      ...productionActor,
      id: GITHYANKI_PSYCHIC_RESILIENCE_ACTOR_ID,
      position: { x: 2, y: 2 },
      resistances: [...canonicalResistances, PSYCHIC_DAMAGE],
    },
    defenseBridge: 'narrow canonical defense adapter',
  };
}

function createPsychicSource(): CombatCharacter {
  // The source only supplies a valid combat attacker context to resistance
  // rules; this proof does not model a spell, spell slot, or spell cast.
  return createMockCombatCharacter({
    id: GITHYANKI_PSYCHIC_SOURCE_ID,
    name: 'Psychic Test Source',
    team: 'enemy',
    position: { x: 3, y: 2 },
  });
}

/** Create the exact baseline restored by the leaf's Reset control. */
export function createGithyankiPsychicScenario(race: Race): GithyankiPsychicScenarioState {
  const assembled = createGithyankiActor(race);
  const source = createPsychicSource();
  if (!assembled) {
    return {
      actor: source,
      source,
      resolution: null,
      resolutionCount: 0,
      eventLog: [],
      outcome: 'Psychic Resilience unavailable: production actor assembly failed.',
      defenseBridge: 'production racial parser',
    };
  }

  return {
    actor: assembled.actor,
    source,
    resolution: null,
    resolutionCount: 0,
    eventLog: [],
    outcome: `Ready: ${assembled.actor.name}; Psychic resistance ${assembled.actor.resistances?.join(', ') ?? 'missing'}.`,
    defenseBridge: assembled.defenseBridge,
  };
}

/** Apply one repeatable fixed hit through native resistance and HP helpers. */
export function resolveGithyankiPsychicResilience(
  scenario: GithyankiPsychicScenarioState,
): GithyankiPsychicScenarioState {
  const hitPointsBefore = scenario.actor.currentHP;
  const finalDamage = ResistanceCalculator.applyResistances(
    GITHYANKI_PSYCHIC_RAW_DAMAGE,
    PSYCHIC_DAMAGE,
    scenario.actor,
    scenario.source,
    true,
  );
  const actorAfter = applyDamageAndCheckDowned(scenario.actor, finalDamage, false);
  const resolution: GithyankiPsychicResolution = {
    rawDamage: GITHYANKI_PSYCHIC_RAW_DAMAGE,
    finalDamage,
    hitPointsBefore,
    hitPointsAfter: actorAfter.currentHP,
    resistanceApplied: finalDamage < GITHYANKI_PSYCHIC_RAW_DAMAGE,
  };
  const nextCount = scenario.resolutionCount + 1;
  const entry = `Repeat ${nextCount}: raw ${GITHYANKI_PSYCHIC_RAW_DAMAGE} Psychic -> ${finalDamage} after resistance; HP ${hitPointsBefore} -> ${actorAfter.currentHP}.`;

  return {
    ...scenario,
    actor: actorAfter,
    resolution,
    resolutionCount: nextCount,
    eventLog: [...scenario.eventLog, entry],
    outcome: `Psychic Resilience resolved: ${GITHYANKI_PSYCHIC_RAW_DAMAGE} raw -> ${finalDamage} Psychic; HP ${hitPointsBefore} -> ${actorAfter.currentHP}.`,
  };
}

// ============================================================================
// Rendered Githyanki Leaf
// ============================================================================
// The UI exposes only the supported transaction and canonical fact surfaces.
// It deliberately labels the unimplemented rest-choice and spell-casting
// boundaries instead of turning static race data into fake runtime state.
// ============================================================================

const GithyankiRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, onScenarioEvent }) => {
  const [scenario, setScenario] = useState(() => createGithyankiPsychicScenario(race));
  const facts = getGithyankiCanonicalFacts(race);

  const resolve = () => {
    const nextScenario = resolveGithyankiPsychicResilience(scenario);
    setScenario(nextScenario);
    onScenarioEvent(`Githyanki PSYCHIC RESILIENCE: ${nextScenario.outcome}`);
  };

  const reset = () => {
    const nextScenario = createGithyankiPsychicScenario(race);
    setScenario(nextScenario);
    onScenarioEvent('Githyanki Psychic Resilience proof reset to the production actor baseline.');
  };

  return (
    <section aria-labelledby="githyanki-psychic-resilience-title" data-testid="githyanki-race-leaf">
      <h4 id="githyanki-psychic-resilience-title">Githyanki · Psychic Resilience</h4>
      <p data-testid="githyanki-canonical-resilience">Canonical: {facts.psychicResilience ?? 'Psychic Resilience trait missing'}</p>

      <div data-testid="githyanki-actor-facts">
        <p>Actor: <strong>{scenario.actor.name}</strong> · Level {scenario.actor.level} · Resistance {scenario.actor.resistances?.join(', ') ?? 'none'}</p>
        <p data-testid="githyanki-hp">HP: <strong>{scenario.actor.currentHP}</strong> / {scenario.actor.maxHP}</p>
        <p data-testid="githyanki-defense-boundary">Defense bridge: {scenario.defenseBridge}; production racial parser is authoritative, with a narrow fallback only when the bridge misses Psychic.</p>
      </div>

      <div aria-label="Githyanki deterministic controls">
        <Button id={GITHYANKI_PSYCHIC_RESILIENCE_CONTROL_ID} type="button" variant="action" size="sm" onClick={resolve}>
          {scenario.resolutionCount === 0 ? 'Resolve 15 Psychic damage' : 'Repeat 15 Psychic damage'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={reset}>Reset proof</Button>
      </div>

      <p aria-live="polite" role="status" data-testid="githyanki-outcome">{scenario.outcome}</p>
      <ol aria-label="Githyanki helper receipt" data-testid="githyanki-event-log">
        {scenario.eventLog.length > 0
          ? scenario.eventLog.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)
          : <li>No psychic damage transaction yet.</li>}
      </ol>

      <div data-testid="githyanki-canonical-facts">
        <p>Astral Knowledge: {facts.astralKnowledge ?? 'canonical fact missing'}</p>
        <p>Githyanki Psionics: {facts.githyankiPsionics ?? 'canonical fact missing'}</p>
        <p>Spell gates: {facts.spellGates.join(' · ') || 'canonical gates missing'}</p>
        <p>Spellcasting ability choice: {facts.spellAbilityChoice ?? 'canonical choice missing'}</p>
      </div>

      <p data-testid="githyanki-unsupported-boundary">
        Unsupported boundary: Astral Knowledge is shown as a canonical long-rest choice only, and Githyanki Psionics is shown as canonical level gates and an ability choice only. This leaf does not grant rest proficiencies, cast Mage Hand, Jump, or Misty Step, consume spell slots, or claim full long-rest spell state.
      </p>
    </section>
  );
};

// Parent Reset changes resetCount; the keyed boundary clears every local hit,
// receipt, and HP display by rebuilding the production actor baseline.
export const GithyankiRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <GithyankiRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'githyanki-psychic-resilience',
  raceId: 'githyanki',
  label: 'Githyanki Psychic Resilience',
  description: 'Resolve deterministic 15 Psychic damage through the production racial parser, resistance calculator, and HP helper.',
  Component: GithyankiRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
