// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 11:39:41
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
 * This file gives the canonical Air Genasi race one deterministic resistance
 * transaction inside the Tactical Sandbox Race domain.
 *
 * The parent Race shell supplies canonical race data and the event callback.
 * This leaf creates a production combat actor, translates the canonical
 * Lightning Resistance trait into the actor field required by the existing
 * character bridge, and sends a lightning or fire packet through
 * calculateDamage and ResistanceCalculator. The UI also shows canonical speed
 * and spell-progression facts, while clearly marking breath and spell casting
 * as unsupported here because this leaf has no native execution helper for them.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: Air Genasi Race traits, quick character construction, and
 * src/utils/combat/combatUtils.ts.
 */

// ============================================================================
// Canonical Air Genasi Facts
// ============================================================================
// The Race record is the only source of truth for the displayed resistance,
// speed, and racial-spell progression facts. The leaf does not duplicate a
// roster trait as a separate scenario constant.
// ============================================================================

export const AIR_GENASI_RESISTANCE_CONTROL_ID = 'resolve-air-genasi-resistance';
export const AIR_GENASI_RESISTANCE_DAMAGE = 15;
export const AIR_GENASI_ACTOR_ID = 'air-genasi-resistance-actor';

export type AirGenasiDamageType = 'lightning' | 'fire';

export interface CanonicalAirGenasiSpellFact {
  minLevel: number;
  spellId: string;
}

export function getCanonicalAirGenasiDamageResistances(
  race: Race,
): readonly string[] {
  const damageTypes = race.traits.flatMap(trait => {
    const match = trait.match(/resistance to ([a-z]+) damage/i);
    return match ? [match[1].toLowerCase()] : [];
  });

  // A future data edit should not create duplicate visible defenses or actor
  // entries if the same trait is accidentally authored twice.
  return [...new Set(damageTypes)];
}

export function hasCanonicalAirGenasiLightningResistance(race: Race): boolean {
  return race.id === 'air_genasi'
    && getCanonicalAirGenasiDamageResistances(race).includes('lightning');
}

export function getCanonicalAirGenasiSpeedFeet(race: Race): number | null {
  const speedTrait = race.traits.find(trait => /^Speed:/i.test(trait.trim()));
  const speed = speedTrait?.match(/(\d+)\s*feet/i)?.[1];
  return speed ? Number(speed) : null;
}

export function getCanonicalAirGenasiSpellProgression(
  race: Race,
): readonly CanonicalAirGenasiSpellFact[] {
  return (race.knownSpells ?? []).map(spell => ({
    minLevel: spell.minLevel,
    spellId: spell.spellId,
  }));
}

// ============================================================================
// Production Combat Actor And Damage Transaction
// ============================================================================
// The quick-character generator is the production construction seam used by
// the wider Design Preview sandbox. Its current persistent-to-combat bridge
// does not project resistance from readable Race trait text, so this narrow
// adapter materializes only the parsed canonical defense before native damage
// resolution. It does not calculate or apply half damage itself.
// ============================================================================

export interface AirGenasiResistanceScenarioState {
  actor: CombatCharacter | null;
  damageType: AirGenasiDamageType;
  rawDamage: number;
  finalDamage: number | null;
  outcome: string;
}

const AIR_GENASI_ACTOR_CONFIG: QuickCharacterConfig = {
  name: 'Air Genasi Resistance Tester',
  raceId: 'air_genasi',
  classId: 'fighter',
  level: 1,
  stats: [10, 12, 12, 10, 10, 10],
};

function materializeCanonicalAirGenasiResistances(
  character: CombatCharacter,
  race: Race,
): CombatCharacter {
  const canonicalResistances = getCanonicalAirGenasiDamageResistances(race);

  // Preserve any production-projected defenses and add only defenses named by
  // the supplied canonical Race. The native calculator remains authoritative.
  return {
    ...character,
    id: AIR_GENASI_ACTOR_ID,
    resistances: [...new Set([
      ...(character.resistances ?? []),
      ...canonicalResistances,
    ])],
  };
}

export function createAirGenasiResistanceScenario(
  race: Race,
): AirGenasiResistanceScenarioState {
  const generatedActor = createQuickCombatCharacter(AIR_GENASI_ACTOR_CONFIG);
  if (!generatedActor) {
    return {
      actor: null,
      damageType: 'lightning',
      rawDamage: AIR_GENASI_RESISTANCE_DAMAGE,
      finalDamage: null,
      outcome: 'Resistance fixture unavailable: production quick-character generation returned null.',
    };
  }

  const actor = materializeCanonicalAirGenasiResistances(generatedActor, race);
  const canonicalResistanceReady = hasCanonicalAirGenasiLightningResistance(race);
  return {
    actor,
    damageType: 'lightning',
    rawDamage: AIR_GENASI_RESISTANCE_DAMAGE,
    finalDamage: null,
    outcome: canonicalResistanceReady
      ? `Ready: ${actor.name}; lightning resistance is linked from the canonical Air Genasi Resistance trait.`
      : 'Resistance boundary unavailable: the canonical Air Genasi lightning-resistance trait was not present.',
  };
}

export function resolveAirGenasiResistance(
  scenario: AirGenasiResistanceScenarioState,
  damageType: AirGenasiDamageType = scenario.damageType,
): AirGenasiResistanceScenarioState {
  if (!scenario.actor) {
    return {
      ...scenario,
      damageType,
      outcome: 'Damage rejected: the deterministic Air Genasi actor is missing.',
    };
  }

  // calculateDamage delegates mitigation and odd-number floor rounding to the
  // native ResistanceCalculator used by the combat engine.
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
// Air Genasi Leaf UI
// ============================================================================
// The controls keep actor, canonical defense, raw packet, final native result,
// and event-producing outcome visible together. Reset is owned by the parent
// shell; the keyed wrapper below remounts this content when resetCount changes.
// ============================================================================

const AirGenasiRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [damageType, setDamageType] = useState<AirGenasiDamageType>('lightning');
  const [scenario, setScenario] = useState<AirGenasiResistanceScenarioState>(
    () => createAirGenasiResistanceScenario(race),
  );

  // Resolve the selected deterministic packet and publish the same native
  // outcome so the parent event log and the leaf cannot disagree.
  const handleResolve = () => {
    const nextScenario = resolveAirGenasiResistance(scenario, damageType);
    setScenario(nextScenario);
    onScenarioEvent(
      `Air Genasi RESISTANCE ${damageType.toUpperCase()}: ${nextScenario.outcome}`,
    );
  };

  const actor = scenario.actor;
  const canonicalResistances = getCanonicalAirGenasiDamageResistances(race);
  const canonicalSpellProgression = getCanonicalAirGenasiSpellProgression(race);
  const canonicalSpeedFeet = getCanonicalAirGenasiSpeedFeet(race);

  return (
    <section aria-labelledby="air-genasi-resistance-title" data-testid="air-genasi-race-leaf">
      {/* The heading identifies the canonical Air Genasi transaction for assistive tools. */}
      <h4 id="air-genasi-resistance-title">Air Genasi Resistance</h4>
      <p data-testid="air-genasi-canonical-traits">
        Canonical: {canonicalResistances.length > 0 ? canonicalResistances.join(', ') : 'none'} resistance; Speed {canonicalSpeedFeet ?? 'unknown'} ft; Mingle with the Wind progression: {canonicalSpellProgression.length > 0
          ? canonicalSpellProgression.map(spell => `level ${spell.minLevel} ${spell.spellId}`).join(', ')
          : 'none'}.
      </p>

      {/* The selector changes only the authored packet; native damage logic remains authoritative. */}
      <label htmlFor={AIR_GENASI_RESISTANCE_CONTROL_ID}>Damage type</label>
      <select
        id={AIR_GENASI_RESISTANCE_CONTROL_ID}
        value={damageType}
        onChange={event => setDamageType(event.target.value as AirGenasiDamageType)}
      >
        <option value="lightning">Lightning (canonical resistance)</option>
        <option value="fire">Fire (non-lightning comparison)</option>
      </select>
      <Button type="button" onClick={handleResolve}>
        Resolve Air Genasi damage
      </Button>

      {/* These facts expose the production actor and live HP/resource boundary, not just a selected label. */}
      <p data-testid="air-genasi-resistance-actor">
        Actor: {actor?.name ?? 'missing'}; Class {actor?.class.id ?? 'unknown'} level {actor?.level ?? 'unknown'}; HP {actor?.currentHP ?? 'unknown'}/{actor?.maxHP ?? 'unknown'}; Resistance: {actor?.resistances?.join(', ') || 'none'}.
      </p>
      <p data-testid="air-genasi-resistance-packet">
        Packet: {scenario.damageType}; Raw {scenario.rawDamage}; Final {scenario.finalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="air-genasi-resistance-outcome">
        {scenario.outcome}
      </p>

      {/* This boundary is explicit so future character-assembly work can move the projection upstream. */}
      <p data-testid="air-genasi-assembly-boundary">
        Assembly boundary: canonical trait text is materialized into CombatCharacter.resistances in this leaf because the shared character bridge only reads legacy race.resistance data.
      </p>
      <p data-testid="air-genasi-unsupported-boundaries">
        Unsupported boundary: Unending Breath and Mingle with the Wind spell execution are not claimed here; this leaf shows their canonical data facts only because no native execution helper is part of this transaction.
      </p>
    </section>
  );
};

// Parent resetCount changes remount the content, restoring the selected packet,
// unresolved result, and actor HP from canonical deterministic setup.
export const AirGenasiRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <AirGenasiRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping
// registration local lets the central registry discover this leaf without a
// shared list edit that would overlap other race workers.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'air-genasi-resistance',
  raceId: 'air_genasi',
  label: 'Air Genasi Resistance',
  description: 'Resolve canonical lightning resistance through the native damage calculator.',
  Component: AirGenasiRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
