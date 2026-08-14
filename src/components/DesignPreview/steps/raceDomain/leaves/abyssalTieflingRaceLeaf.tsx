// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 11:31:19
 * Dependents: None (Orphan)
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { CombatCharacter } from '../../../../../types/combat';
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
 * This file gives the canonical Abyssal Tiefling race one deterministic
 * resistance transaction inside the Tactical Sandbox Race domain.
 *
 * The parent Race shell supplies the canonical Race record and the event
 * callback. This leaf creates a production combat actor, translates the
 * canonical trait text into the combat actor's native resistance field where
 * the existing character bridge cannot yet do so, and sends a poison or cold
 * packet through calculateDamage and ResistanceCalculator.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: Abyssal Tiefling Race traits, quick character construction, and
 * src/utils/combat/combatUtils.ts.
 */

// ============================================================================
// Canonical Trait Extraction
// ============================================================================
// The Race data currently stores damage resistance as readable trait text.
// This parser keeps the leaf linked to that canonical text instead of copying
// a second roster fact into the scenario. The returned names are the same
// lowercase damage-type values consumed by ResistanceCalculator.
// ============================================================================

export const ABYSSAL_RESISTANCE_CONTROL_ID = 'resolve-abyssal-resistance';
export const ABYSSAL_RESISTANCE_DAMAGE = 15;
export const ABYSSAL_TIEFLING_ACTOR_ID = 'abyssal-tiefling-resistance-actor';

export type AbyssalDamageType = 'poison' | 'cold';

export function getCanonicalDamageResistances(race: Race): readonly string[] {
  const damageTypes = race.traits.flatMap(trait => {
    const match = trait.match(/resistance to ([a-z]+) damage/i);
    return match ? [match[1].toLowerCase()] : [];
  });

  // A trait list should not create duplicate defenses if a future canonical
  // data edit mentions the same damage type more than once.
  return [...new Set(damageTypes)];
}

export function hasCanonicalAbyssalResistance(race: Race): boolean {
  return race.id === 'abyssal_tiefling'
    && getCanonicalDamageResistances(race).includes('poison');
}

// ============================================================================
// Production Combat Actor And Damage Transaction
// ============================================================================
// The quick-character generator is the same production construction seam used
// by the wider Design Preview sandbox. Its current persistent-to-combat bridge
// reads an optional legacy race.resistance field, while this canonical Race
// only exposes the rule as trait text. This small adapter materializes the
// parsed canonical result into CombatCharacter.resistances so the native
// resistance boundary can evaluate it without UI-only or manual damage math.
// ============================================================================

export interface AbyssalResistanceScenarioState {
  actor: CombatCharacter | null;
  damageType: AbyssalDamageType;
  rawDamage: number;
  finalDamage: number | null;
  outcome: string;
}

const ABYSSAL_ACTOR_CONFIG: QuickCharacterConfig = {
  name: 'Abyssal Tiefling Resistance Tester',
  raceId: 'abyssal_tiefling',
  classId: 'fighter',
  level: 1,
  stats: [10, 12, 12, 10, 10, 10],
};

function materializeCanonicalResistances(
  character: CombatCharacter,
  race: Race,
): CombatCharacter {
  const canonicalResistances = getCanonicalDamageResistances(race);

  // Preserve any defenses already projected by the production bridge, then
  // add only the damage types actually named by the supplied canonical Race.
  return {
    ...character,
    id: ABYSSAL_TIEFLING_ACTOR_ID,
    resistances: [...new Set([
      ...(character.resistances ?? []),
      ...canonicalResistances,
    ])],
  };
}

export function createAbyssalResistanceScenario(
  race: Race,
): AbyssalResistanceScenarioState {
  const generatedActor = createQuickCombatCharacter(ABYSSAL_ACTOR_CONFIG);
  if (!generatedActor) {
    return {
      actor: null,
      damageType: 'poison',
      rawDamage: ABYSSAL_RESISTANCE_DAMAGE,
      finalDamage: null,
      outcome: 'Resistance fixture unavailable: production quick-character generation returned null.',
    };
  }

  const actor = materializeCanonicalResistances(generatedActor, race);
  const canonicalResistanceReady = hasCanonicalAbyssalResistance(race);
  return {
    actor,
    damageType: 'poison',
    rawDamage: ABYSSAL_RESISTANCE_DAMAGE,
    finalDamage: null,
    outcome: canonicalResistanceReady
      ? `Ready: ${actor.name}; poison resistance is linked from the canonical Abyssal Resistance trait.`
      : 'Resistance boundary unavailable: the canonical Abyssal poison-resistance trait was not present.',
  };
}

export function resolveAbyssalResistance(
  scenario: AbyssalResistanceScenarioState,
  damageType: AbyssalDamageType = scenario.damageType,
): AbyssalResistanceScenarioState {
  if (!scenario.actor) {
    return {
      ...scenario,
      damageType,
      outcome: 'Damage rejected: the deterministic Abyssal Tiefling actor is missing.',
    };
  }

  // calculateDamage delegates to ResistanceCalculator, which owns immunity,
  // resistance, vulnerability, and floor-rounding rules for this packet.
  const finalDamage = calculateDamage(
    scenario.rawDamage,
    null,
    scenario.actor,
    damageType,
  );
  const hitPointsBefore = scenario.actor.currentHP;
  const hitPointsAfter = Math.max(0, hitPointsBefore - finalDamage);
  const nextActor = { ...scenario.actor, currentHP: hitPointsAfter };
  const resisted = scenario.actor.resistances?.some(
    resistance => resistance.toLowerCase() === damageType,
  ) ?? false;

  return {
    ...scenario,
    actor: nextActor,
    damageType,
    finalDamage,
    outcome: `Native damage resolved: ${damageType} raw ${scenario.rawDamage}, final ${finalDamage} (${resisted ? 'resistance applied' : 'unchanged boundary'}); HP ${hitPointsBefore} -> ${hitPointsAfter}.`,
  };
}

// ============================================================================
// Abyssal Tiefling Leaf UI
// ============================================================================
// The controls keep the actor, canonical defense, raw packet, final native
// result, and event-producing outcome visible together. Reset is owned by the
// parent shell; its resetCount is handled by the keyed wrapper below.
// ============================================================================

const AbyssalTieflingRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [damageType, setDamageType] = useState<AbyssalDamageType>('poison');
  const [scenario, setScenario] = useState<AbyssalResistanceScenarioState>(
    () => createAbyssalResistanceScenario(race),
  );

  const handleResolve = () => {
    const nextScenario = resolveAbyssalResistance(scenario, damageType);
    setScenario(nextScenario);
    onScenarioEvent(
      `Abyssal RESISTANCE ${damageType.toUpperCase()}: ${nextScenario.outcome}`,
    );
  };

  const actor = scenario.actor;
  const canonicalResistances = getCanonicalDamageResistances(race);

  return (
    <section aria-labelledby="abyssal-tiefling-resistance-title" data-testid="abyssal-tiefling-race-leaf">
      {/* The heading names the canonical resistance transaction for assistive tools. */}
      <h4 id="abyssal-tiefling-resistance-title">Abyssal Resistance</h4>
      <p data-testid="abyssal-canonical-traits">
        Canonical: {canonicalResistances.length > 0 ? canonicalResistances.join(', ') : 'none'} resistance from Race traits.
      </p>

      {/* The select changes only the authored packet type; the production damage path remains authoritative. */}
      <label htmlFor={ABYSSAL_RESISTANCE_CONTROL_ID}>Damage type</label>
      <select
        id={ABYSSAL_RESISTANCE_CONTROL_ID}
        value={damageType}
        onChange={event => setDamageType(event.target.value as AbyssalDamageType)}
      >
        <option value="poison">Poison (canonical resistance)</option>
        <option value="cold">Cold (non-poison comparison)</option>
      </select>
      <Button type="button" onClick={handleResolve}>
        Resolve Abyssal damage
      </Button>

      {/* These facts prove the production actor and live HP/resource boundary, not just the selected label. */}
      <p data-testid="abyssal-resistance-actor">
        Actor: {actor?.name ?? 'missing'}; Class {actor?.class.id ?? 'unknown'} level {actor?.level ?? 'unknown'}; HP {actor?.currentHP ?? 'unknown'}/{actor?.maxHP ?? 'unknown'}; Resistance: {actor?.resistances?.join(', ') || 'none'}.
      </p>
      <p data-testid="abyssal-resistance-packet">
        Packet: {scenario.damageType}; Raw {scenario.rawDamage}; Final {scenario.finalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="abyssal-resistance-outcome">
        {scenario.outcome}
      </p>

      {/* The adapter is explicit so future character-assembly work can move this projection upstream without hiding the current boundary. */}
      <p data-testid="abyssal-assembly-boundary">
        Assembly boundary: canonical trait text is materialized into CombatCharacter.resistances in this leaf because the shared character bridge only reads legacy race.resistance data.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed content boundary remounts the
// leaf state from canonical facts, avoiding hidden selected-packet or HP state.
export const AbyssalTieflingRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <AbyssalTieflingRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping
// the registration local lets the central registry discover this leaf without
// taking ownership of its mechanics or test fixture.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'abyssal-tiefling-resistance',
  raceId: 'abyssal_tiefling',
  label: 'Abyssal Tiefling Resistance',
  description: 'Resolve canonical poison resistance through the native damage calculator.',
  Component: AbyssalTieflingRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
