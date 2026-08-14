// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is an isolated Race-domain leaf with no sibling-leaf imports.
 *
 * Last Sync: 13/08/2026, 15:46:00
 * Dependents: RaceDomainRegistry.ts discovers this module through import.meta.glob.
 * Imports: canonical Race data, racial trait parsing, native damage and HP helpers,
 * quick combat assembly, and the shared leaf contract.
 *
 * MULTI-AGENT SAFETY:
 * This leaf is intentionally disjoint from other race leaves and the registry.
 *
 * @dependencies-end
 */

import React, { useState } from 'react';
import { getRacialSpellCastingAbilityChoicesForRace } from '../../../../../data/races';
import { getRacialDefenseBucketsFromTraitText } from '../../../../../data/races/racialTraits';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { CombatCharacter } from '../../../../../types/combat';
import { applyDamageAndCheckDowned } from '../../../../../utils/combat/deathSaveUtils';
import { calculateDamage } from '../../../../../utils/combat/combatUtils';
import {
  createQuickCombatCharacter,
  type QuickCharacterConfig,
} from '../../../../../utils/sandbox/quickCharacterGenerator';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Fire Genasi race one deterministic Fire
 * Resistance transaction inside the Tactical Sandbox Race domain.
 *
 * The parent Race shell supplies canonical race data and the event callback.
 * This leaf creates a production combat actor, parses Fire Resistance from the
 * authored racial trait, and sends a fixed fire packet through the native
 * damage and HP helpers. It also displays Reach to the Blaze spell facts and
 * level gates without pretending to cast a spell or manage spell resources.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: Fire Genasi Race traits, the racial trait parser, quick combat
 * assembly, combatUtils.ts, deathSaveUtils.ts, and the shared leaf contract.
 */

// ============================================================================
// Canonical Fire Genasi Facts
// ============================================================================
// The Race record and production racial parser are the only sources for the
// displayed defense, spell progression, and spell-ability choice facts. The
// leaf does not maintain a second Fire Genasi rules record.
// ============================================================================

export const FIRE_GENASI_RESISTANCE_CONTROL_ID = 'resolve-fire-genasi-resistance';
export const FIRE_GENASI_RESISTANCE_DAMAGE = 15;
export const FIRE_GENASI_ACTOR_ID = 'fire-genasi-resistance-actor';

export interface CanonicalFireGenasiSpellFact {
  minLevel: number;
  spellId: string;
}

/**
 * Parse every defensive trait through the shared racial parser and return the
 * defenses the supplied Race actually authored.
 */
export function getCanonicalFireGenasiDamageResistances(
  race: Race,
): readonly string[] {
  const damageTypes = race.traits.flatMap(trait => (
    getRacialDefenseBucketsFromTraitText(trait).resistances
  ));

  // A future data edit should not create duplicate actor defenses or duplicate
  // visible facts if the same trait is accidentally authored twice.
  if (damageTypes.length > 0) return [...new Set(damageTypes)];

  // DEBT: The shared racial parser currently finds the defense phrase but its
  // token normalizer can return no damage type for this authored wording. This
  // bounded fallback preserves the canonical Fire Genasi transaction until the
  // shared parser is repaired; it recognizes only the exact Fire Resistance
  // phrase and never invents a new race or defense.
  const canonicalFireFallback = race.traits.some(trait => (
    /resistance\s+to\s+fire\s+damage/i.test(trait)
  ));
  return canonicalFireFallback ? ['Fire'] : [];
}

/**
 * Confirm that the canonical race, rather than a similarly named fixture,
 * supplies Fire Resistance for this leaf.
 */
export function hasCanonicalFireGenasiFireResistance(race: Race): boolean {
  return race.id === 'fire_genasi'
    && getCanonicalFireGenasiDamageResistances(race)
      .some(damageType => damageType.toLowerCase() === 'fire');
}

/**
 * Read the authored Reach to the Blaze paragraph so the preview can show the
 * exact canonical gate and rest wording without copying it into this leaf.
 */
export function getCanonicalReachToTheBlazeTrait(race: Race): string | undefined {
  return race.traits.find(trait => /^Reach to the Blaze:/i.test(trait.trim()));
}

/**
 * Read racial spell ids and gates from the canonical Race record.
 */
export function getCanonicalFireGenasiSpellProgression(
  race: Race,
): readonly CanonicalFireGenasiSpellFact[] {
  return (race.knownSpells ?? []).map(spell => ({
    minLevel: spell.minLevel,
    spellId: spell.spellId,
  }));
}

/**
 * Read the spellcasting ability choices from the production racial parser.
 */
export function getCanonicalFireGenasiSpellAbilityChoices(
  race: Race,
): readonly string[] {
  const choice = getRacialSpellCastingAbilityChoicesForRace(race.id)[0];
  if (choice?.availableAbilities?.length) return choice.availableAbilities;

  // DEBT: The production legacy-race choice adapter preserves its canonical
  // source text and required spell ids but does not expose availableAbilities.
  // Parse only the three ability names from that canonical text until the
  // shared choice projection is widened.
  const sourceText = choice?.sourceTraitDescription
    ?? race.racialSpellChoice?.traitDescription
    ?? '';
  return [...new Set(
    sourceText.match(/\b(Intelligence|Wisdom|Charisma)\b/gi) ?? [],
  )].map(ability => `${ability[0].toUpperCase()}${ability.slice(1).toLowerCase()}`);
}

// ============================================================================
// Production Combat Actor And Damage Transaction
// ============================================================================
// The quick-character generator is the production construction seam used by
// the wider Design Preview sandbox. Its persistent-to-combat bridge does not
// currently project readable Race trait text into CombatCharacter.resistances,
// so this narrow adapter materializes only the parsed canonical defense before
// native damage resolution. It does not calculate half damage or mutate HP.
// ============================================================================

export interface FireGenasiResistanceScenarioState {
  actor: CombatCharacter | null;
  rawDamage: number;
  finalDamage: number | null;
  outcome: string;
}

const FIRE_GENASI_ACTOR_CONFIG: QuickCharacterConfig = {
  name: 'Fire Genasi Resistance Tester',
  raceId: 'fire_genasi',
  classId: 'fighter',
  level: 1,
  stats: [10, 12, 12, 10, 10, 10],
};

/**
 * Attach the parsed canonical defense to the production actor while preserving
 * any defenses the production bridge already supplied.
 */
function materializeCanonicalFireGenasiResistances(
  character: CombatCharacter,
  race: Race,
): CombatCharacter {
  const canonicalResistances = getCanonicalFireGenasiDamageResistances(race);

  // The native calculator remains authoritative; this adapter only bridges the
  // current gap between readable racial trait data and the combat actor field.
  return {
    ...character,
    id: FIRE_GENASI_ACTOR_ID,
    resistances: [...new Set([
      ...(character.resistances ?? []),
      ...canonicalResistances,
    ])],
  };
}

/**
 * Build a fresh production actor and expose whether the canonical defense is
 * ready for the deterministic packet.
 */
export function createFireGenasiResistanceScenario(
  race: Race,
): FireGenasiResistanceScenarioState {
  const generatedActor = createQuickCombatCharacter(FIRE_GENASI_ACTOR_CONFIG);
  if (!generatedActor) {
    return {
      actor: null,
      rawDamage: FIRE_GENASI_RESISTANCE_DAMAGE,
      finalDamage: null,
      outcome: 'Resistance fixture unavailable: production quick-character generation returned null.',
    };
  }

  const actor = materializeCanonicalFireGenasiResistances(generatedActor, race);
  const canonicalResistanceReady = hasCanonicalFireGenasiFireResistance(race);
  return {
    actor,
    rawDamage: FIRE_GENASI_RESISTANCE_DAMAGE,
    finalDamage: null,
    outcome: canonicalResistanceReady
      ? `Ready: ${actor.name}; Fire Resistance is linked from the canonical Fire Genasi trait.`
      : 'Resistance boundary unavailable: the canonical Fire Genasi Fire Resistance trait was not present.',
  };
}

/**
 * Resolve one raw Fire packet through native resistance math and native HP
 * bookkeeping, returning a new scenario so repeat clicks remain deterministic.
 */
export function resolveFireGenasiResistance(
  scenario: FireGenasiResistanceScenarioState,
): FireGenasiResistanceScenarioState {
  if (!scenario.actor) {
    return {
      ...scenario,
      outcome: 'Damage rejected: the deterministic Fire Genasi actor is missing.',
    };
  }

  // calculateDamage delegates resistance and odd-number floor rounding to the
  // same ResistanceCalculator used by the combat engine.
  const finalDamage = calculateDamage(
    scenario.rawDamage,
    null,
    scenario.actor,
    'fire',
  );
  const hitPointsBefore = scenario.actor.currentHP;

  // The shared HP helper owns temporary HP, downing, and death-save transitions.
  const nextActor = applyDamageAndCheckDowned(scenario.actor, finalDamage);
  const resisted = scenario.actor.resistances?.some(
    resistance => resistance.toLowerCase() === 'fire',
  ) ?? false;

  return {
    ...scenario,
    actor: nextActor,
    finalDamage,
    outcome: `Native damage resolved: fire raw ${scenario.rawDamage}, final ${finalDamage} (${resisted ? 'resistance applied' : 'unchanged boundary'}); HP ${hitPointsBefore} -> ${nextActor.currentHP}.`,
  };
}

// ============================================================================
// Fire Genasi Leaf UI
// ============================================================================
// The controls keep the actor, canonical defense, raw packet, final native
// result, repeat behavior, and event-producing outcome visible together. Reset
// remains owned by the parent shell; the keyed wrapper remounts this content
// when resetCount changes.
// ============================================================================

const FireGenasiRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState<FireGenasiResistanceScenarioState>(
    () => createFireGenasiResistanceScenario(race),
  );

  // Resolve another fixed packet and publish the same native outcome so the
  // parent event log and the leaf cannot disagree about what happened.
  const handleResolve = () => {
    const nextScenario = resolveFireGenasiResistance(scenario);
    setScenario(nextScenario);
    onScenarioEvent(
      `Fire Genasi RESISTANCE FIRE: ${nextScenario.outcome}`,
    );
  };

  const actor = scenario.actor;
  const canonicalResistances = getCanonicalFireGenasiDamageResistances(race);
  const canonicalSpellProgression = getCanonicalFireGenasiSpellProgression(race);
  const canonicalSpellAbilityChoices = getCanonicalFireGenasiSpellAbilityChoices(race);
  const canonicalReachTrait = getCanonicalReachToTheBlazeTrait(race);

  return (
    <section aria-labelledby="fire-genasi-resistance-title" data-testid="fire-genasi-race-leaf">
      {/* The heading identifies the canonical Fire Genasi transaction for assistive tools. */}
      <h4 id="fire-genasi-resistance-title">Fire Genasi Resistance</h4>
      <p data-testid="fire-genasi-canonical-facts">
        Canonical: {canonicalResistances.length > 0 ? canonicalResistances.join(', ') : 'none'} resistance; Reach to the Blaze: {canonicalSpellProgression.length > 0
          ? canonicalSpellProgression.map(spell => `level ${spell.minLevel} ${spell.spellId}`).join(', ')
          : 'no racial spells'}; ability choices: {canonicalSpellAbilityChoices.length > 0
          ? canonicalSpellAbilityChoices.join(', ')
          : 'none'}.
      </p>
      <p data-testid="fire-genasi-reach-to-the-blaze">
        {canonicalReachTrait ?? 'Reach to the Blaze canonical trait unavailable.'}
      </p>

      {/* The button repeats one fixed packet; it never spends a spell slot or rest resource. */}
      <Button type="button" onClick={handleResolve}>
        Resolve Fire Genasi damage
      </Button>

      {/* These facts expose the production actor and live HP/resource boundary, not only a label. */}
      <p data-testid="fire-genasi-resistance-actor">
        Actor: {actor?.name ?? 'missing'}; Class {actor?.class.id ?? 'unknown'} level {actor?.level ?? 'unknown'}; HP {actor?.currentHP ?? 'unknown'}/{actor?.maxHP ?? 'unknown'}; Resistance: {actor?.resistances?.join(', ') || 'none'}.
      </p>
      <p data-testid="fire-genasi-resistance-packet">
        Packet: fire; Raw {scenario.rawDamage}; Final {scenario.finalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="fire-genasi-resistance-outcome">
        {scenario.outcome}
      </p>

      {/* This boundary remains visible because the shared actor bridge does not yet project trait text upstream. */}
      <p data-testid="fire-genasi-assembly-boundary">
        Assembly boundary: canonical trait text is materialized into CombatCharacter.resistances in this leaf because the shared character bridge does not yet project this Fire Resistance.
      </p>
      <p data-testid="fire-genasi-spell-boundary">
        Unsupported boundary: this leaf does not claim Reach to the Blaze spell casting or spell-slot or rest-resource projection; it shows canonical spell facts and level gates only.
      </p>
    </section>
  );
};

// Parent resetCount changes remount the content, restoring the unresolved packet,
// full actor HP, and deterministic canonical facts from the supplied Race.
export const FireGenasiRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <FireGenasiRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping
// registration local avoids a shared registry edit owned by another worker.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'fire-genasi-resistance',
  raceId: 'fire_genasi',
  label: 'Fire Genasi Resistance',
  description: 'Resolve canonical Fire Resistance through the native damage and HP helpers.',
  Component: FireGenasiRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
