// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 15:15:43
 * Dependents: None (Orphan)
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import spellBundle from '../../../../../data/spells_bundle.json';
import { getRacialSpellCastingAbilityChoicesForRace } from '../../../../../data/races';
import type {
  AbilityScoreName,
  CombatCharacter,
  PlayerCharacter,
  Race,
  RacialSpell,
  RacialSpellGrant,
  Spell,
} from '../../../../../types';
import { applyRacialSpellGrantsByLevel, getRacialSpellGrantsForCharacter } from '../../../../../utils/character/characterUtils';
import { calculateDamage, createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Chthonic Tiefling one deterministic resistance
 * transaction inside the Tactical Sandbox Race domain.
 *
 * The parent Race shell supplies the canonical Race record and event callback.
 * This leaf assembles a production player and combat actor, lets the native
 * damage calculator resolve necrotic resistance, and keeps racial spell gates
 * and the casting-choice bridge visible without pretending to cast a spell.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: Chthonic Tiefling Race data, production character assembly,
 * native resistance calculation, and the Race domain leaf contract.
 */

// ============================================================================
// Canonical Chthonic Tiefling Facts
// ============================================================================
// These constants describe the deterministic packet and default preview level.
// The resistance type and spell roster still come from the supplied canonical
// Race object, so a data correction remains visible to this scenario.
// ============================================================================

export const CHTHONIC_RESISTANCE_CONTROL_ID = 'resolve-chthonic-resistance';
export const CHTHONIC_ABILITY_CONTROL_ID = 'chthonic-magic-ability';
export const CHTHONIC_RESISTANCE_DAMAGE = 15;
export const CHTHONIC_PREVIEW_LEVEL = 5;
export const CHTHONIC_TIEFLING_ACTOR_ID = 'chthonic-tiefling-resistance-actor';
export const CHTHONIC_DEFAULT_ABILITY: AbilityScoreName = 'Charisma';

export type ChthonicDamageType = 'necrotic' | 'fire';

const CANONICAL_SPELLS = spellBundle as unknown as Record<string, Spell>;

/** Read damage defenses directly from the canonical trait prose. */
export function getCanonicalChthonicDamageResistances(
  race: Race,
): readonly string[] {
  const damageTypes = race.traits.flatMap(trait => {
    const match = trait.match(/resistance to ([a-z]+) damage/i);
    return match ? [match[1].toLowerCase()] : [];
  });

  // A future data edit should not make duplicate trait mentions duplicate actor defenses.
  return [...new Set(damageTypes)];
}

/** Confirm that the supplied Race is the canonical Chthonic Tiefling defense. */
export function hasCanonicalChthonicResistance(race: Race): boolean {
  return race.id === 'chthonic_tiefling'
    && getCanonicalChthonicDamageResistances(race).includes('necrotic');
}

/** Return the authored Chthonic spell roster and its level gates unchanged. */
export function getCanonicalChthonicSpellFacts(race: Race): readonly RacialSpell[] {
  if (race.id !== 'chthonic_tiefling') return [];
  return (race.knownSpells ?? []).map(spell => ({ ...spell }));
}

/**
 * Resolve the ability choices offered by the canonical Chthonic Magic prompt.
 * The structured trait library is preferred; the prose fallback keeps this
 * visible even if a legacy choice record has not yet been enriched.
 */
export function getCanonicalChthonicAbilityOptions(
  race: Race,
): readonly AbilityScoreName[] {
  if (race.id !== 'chthonic_tiefling') return [];

  const structuredAbilities = getRacialSpellCastingAbilityChoicesForRace(race.id)
    .flatMap(choice => choice.availableAbilities ?? []);
  if (structuredAbilities.length > 0) {
    return [...new Set(structuredAbilities)];
  }

  const canonicalText = race.racialSpellChoice?.traitDescription
    ?? race.traits.find(trait => trait.startsWith('Chthonic Magic:'))
    ?? '';
  const proseAbilities = canonicalText.match(/\b(Intelligence|Wisdom|Charisma)\b/gi) ?? [];
  return [...new Set(proseAbilities as AbilityScoreName[])];
}

function resolveChosenAbility(
  race: Race,
  requestedAbility: AbilityScoreName,
): AbilityScoreName {
  const options = getCanonicalChthonicAbilityOptions(race);
  return options.includes(requestedAbility) ? requestedAbility : (options[0] ?? requestedAbility);
}

/** Keep the native combat field readable while preserving canonical lowercase parsing. */
function toCombatDamageType(damageType: string): string {
  return damageType.charAt(0).toUpperCase() + damageType.slice(1);
}

// ============================================================================
// Production Actor Assembly
// ============================================================================
// The actor is created through the same production seams used by combat. The
// selected Chthonic ability is retained in racialSelections on the persistent
// character, while class spellcasting remains the wizard's own native ability.
// This distinction prevents a racial choice from silently rewriting class data.
// ============================================================================

export interface ChthonicActorAssembly {
  character: PlayerCharacter | null;
  actor: CombatCharacter | null;
  grants: readonly RacialSpellGrant[];
  selectedAbility: AbilityScoreName;
  outcome: string;
}

export function createChthonicTieflingActor(
  race: Race,
  requestedAbility: AbilityScoreName = CHTHONIC_DEFAULT_ABILITY,
  targetLevel = CHTHONIC_PREVIEW_LEVEL,
): ChthonicActorAssembly {
  const selectedAbility = resolveChosenAbility(race, requestedAbility);
  const level = Math.max(1, targetLevel);
  const quickCharacter = createQuickCharacter({
    name: 'Chthonic Tiefling Resistance Tester',
    raceId: race.id,
    classId: 'wizard',
    level,
    stats: [10, 10, 12, 14, 10, 14],
  });

  if (!quickCharacter) {
    return {
      character: null,
      actor: null,
      grants: [],
      selectedAbility,
      outcome: 'Assembly unavailable: production quick-character generation returned null.',
    };
  }

  // Preserve the user-selected racial ability as real character state before
  // the native racial-grant and defensive-trait projection runs.
  const selectedCharacter: PlayerCharacter = {
    ...quickCharacter,
    racialSelections: {
      ...(quickCharacter.racialSelections ?? {}),
      [race.id]: {
        ...(quickCharacter.racialSelections?.[race.id] ?? {}),
        spellAbility: selectedAbility,
      },
    },
  };

  // This helper owns level gates, spellbook grants, limited-use projections,
  // and the canonical Chthonic Resistance defense on the persistent actor.
  const assembledCharacter = applyRacialSpellGrantsByLevel(selectedCharacter, level);
  const canonicalSpellIds = new Set(
    getCanonicalChthonicSpellFacts(race)
      .filter(spell => spell.minLevel <= level)
      .map(spell => spell.spellId),
  );
  const baselineSpellIds = new Set([
    ...(quickCharacter.spellbook?.cantrips ?? []),
    ...(quickCharacter.spellbook?.knownSpells ?? []),
    ...(quickCharacter.spellbook?.preparedSpells ?? []),
  ]);

  // DEBT: The current text parser can emit a malformed `them-using-any` grant
  // from the canonical Chthonic prose, and legacy knownSpells entries override
  // structured long-rest metadata. Keep the production projection bounded to
  // authored spell IDs until that shared parser/bridge is repaired upstream.
  const canonicalCharacter: PlayerCharacter = {
    ...assembledCharacter,
    spellbook: assembledCharacter.spellbook
      ? {
        ...assembledCharacter.spellbook,
        knownSpells: assembledCharacter.spellbook.knownSpells.filter(spellId => (
          baselineSpellIds.has(spellId) || canonicalSpellIds.has(spellId)
        )),
        preparedSpells: assembledCharacter.spellbook.preparedSpells.filter(spellId => (
          baselineSpellIds.has(spellId) || canonicalSpellIds.has(spellId)
        )),
        racialSpellGrants: assembledCharacter.spellbook.racialSpellGrants?.filter(grant => (
          canonicalSpellIds.has(grant.spellId)
        )),
      }
      : undefined,
  };
  const generatedActor = createPlayerCombatCharacter(canonicalCharacter, CANONICAL_SPELLS);
  const canonicalResistanceTypes = getCanonicalChthonicDamageResistances(race)
    .map(toCombatDamageType);
  const actor: CombatCharacter = {
    ...generatedActor,
    id: CHTHONIC_TIEFLING_ACTOR_ID,
    name: `${race.name} - Resistance Tester`,
    // DEBT: The shared persistent-to-combat bridge does not yet project this
    // trait-text defense. Materialize only the canonical Chthonic defense here
    // so calculateDamage remains the authority for resistance math.
    resistances: [...new Set([
      ...(generatedActor.resistances ?? []),
      ...canonicalResistanceTypes,
    ])],
  };
  const grants = getRacialSpellGrantsForCharacter(canonicalCharacter, level)
    .filter(grant => canonicalSpellIds.has(grant.spellId));

  return {
    character: canonicalCharacter,
    actor,
    grants,
    selectedAbility,
    outcome: hasCanonicalChthonicResistance(race)
      ? `Ready: ${actor.name}; level ${actor.level}; native necrotic resistance assembled; ${grants.length} racial spell grants are level-gated.`
      : 'Resistance boundary unavailable: canonical Chthonic Resistance was not present.',
  };
}

// ============================================================================
// Native Necrotic Damage Transaction
// ============================================================================
// Each resolution reads the current combat actor, sends one packet through
// calculateDamage, and commits HP together with the result. Calling the helper
// again with its returned state therefore proves repeat behavior atomically.
// ============================================================================

export interface ChthonicResistanceScenarioState {
  assembly: ChthonicActorAssembly;
  damageType: ChthonicDamageType;
  rawDamage: number;
  finalDamage: number | null;
  resolutionCount: number;
  outcome: string;
}

export function createChthonicResistanceScenario(
  race: Race,
  selectedAbility: AbilityScoreName = CHTHONIC_DEFAULT_ABILITY,
): ChthonicResistanceScenarioState {
  const assembly = createChthonicTieflingActor(race, selectedAbility);
  return {
    assembly,
    damageType: 'necrotic',
    rawDamage: CHTHONIC_RESISTANCE_DAMAGE,
    finalDamage: null,
    resolutionCount: 0,
    outcome: assembly.outcome,
  };
}

export function resolveChthonicResistance(
  scenario: ChthonicResistanceScenarioState,
  damageType: ChthonicDamageType = scenario.damageType,
): ChthonicResistanceScenarioState {
  const actor = scenario.assembly.actor;
  if (!actor) {
    return {
      ...scenario,
      damageType,
      outcome: 'Damage rejected atomically: the production Chthonic Tiefling actor is missing.',
    };
  }

  // ResistanceCalculator applies the native immunity/resistance/vulnerability
  // order; this leaf only records the resulting HP transaction.
  const finalDamage = calculateDamage(scenario.rawDamage, null, actor, damageType);
  const hitPointsBefore = actor.currentHP;
  const hitPointsAfter = Math.max(0, hitPointsBefore - finalDamage);
  const nextActor: CombatCharacter = { ...actor, currentHP: hitPointsAfter };
  const resisted = actor.resistances?.some(
    resistance => resistance.toLowerCase() === damageType,
  ) ?? false;

  return {
    ...scenario,
    assembly: { ...scenario.assembly, actor: nextActor },
    damageType,
    finalDamage,
    resolutionCount: scenario.resolutionCount + 1,
    outcome: `Native damage resolved: ${damageType} raw ${scenario.rawDamage}, final ${finalDamage} (${resisted ? 'resistance applied' : 'unchanged boundary'}); HP ${hitPointsBefore} -> ${hitPointsAfter}.`,
  };
}

// ============================================================================
// Chthonic Tiefling Leaf UI
// ============================================================================
// The controls expose canonical resistance, raw and resolved damage, HP, spell
// gates, the selected racial ability, and the exact unsupported cast boundary.
// The keyed wrapper below lets the parent shell's Reset remount all local state.
// ============================================================================

const ChthonicTieflingRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState(
    () => createChthonicResistanceScenario(race),
  );
  const canonicalResistances = getCanonicalChthonicDamageResistances(race);
  const canonicalSpells = getCanonicalChthonicSpellFacts(race);
  const abilityOptions = getCanonicalChthonicAbilityOptions(race);
  const actor = scenario.assembly.actor;
  const character = scenario.assembly.character;

  // Rebuilding through production assembly keeps the ability selection and
  // all native level-gated facts synchronized instead of patching one label.
  const handleAbilityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedAbility = event.target.value as AbilityScoreName;
    setScenario(createChthonicResistanceScenario(race, selectedAbility));
    onScenarioEvent(`Chthonic Magic ability selected: ${selectedAbility}.`);
  };

  // Resolve one packet and publish the same native outcome to the shell log.
  const handleResolve = () => {
    const nextScenario = resolveChthonicResistance(scenario, scenario.damageType);
    setScenario(nextScenario);
    onScenarioEvent(
      `Chthonic RESISTANCE ${nextScenario.damageType.toUpperCase()}: ${nextScenario.outcome}`,
    );
  };

  const persistentResources = Object.entries(character?.limitedUses ?? {})
    .filter(([resourceId]) => resourceId.startsWith('racial_chthonic_tiefling_'))
    .map(([resourceId, resource]) => `${resourceId} ${resource.current}/${resource.max} (${resource.resetOn})`);

  return (
    <section aria-labelledby="chthonic-tiefling-resistance-title" data-testid="chthonic-tiefling-race-leaf">
      {/* The heading names the canonical defense transaction for assistive tools. */}
      <h4 id="chthonic-tiefling-resistance-title">Chthonic Resistance</h4>
      <p data-testid="chthonic-canonical-traits">
        Canonical: {canonicalResistances.length > 0 ? canonicalResistances.join(', ') : 'none'} resistance from Chthonic Resistance.
      </p>

      {/* The packet selector changes only the deterministic test input; native damage remains authoritative. */}
      <label htmlFor={CHTHONIC_RESISTANCE_CONTROL_ID}>Damage type</label>
      <select
        id={CHTHONIC_RESISTANCE_CONTROL_ID}
        value={scenario.damageType}
        onChange={event => setScenario({ ...scenario, damageType: event.target.value as ChthonicDamageType })}
      >
        <option value="necrotic">Necrotic (canonical resistance)</option>
        <option value="fire">Fire (comparison)</option>
      </select>
      <Button type="button" onClick={handleResolve}>Resolve Chthonic damage</Button>

      {/* The chosen ability is real racialSelections input, not a rewrite of the wizard's class ability. */}
      <label htmlFor={CHTHONIC_ABILITY_CONTROL_ID}>Chthonic Magic ability</label>
      <select
        id={CHTHONIC_ABILITY_CONTROL_ID}
        value={scenario.assembly.selectedAbility}
        onChange={handleAbilityChange}
      >
        {abilityOptions.map(ability => <option key={ability} value={ability}>{ability}</option>)}
      </select>

      {/* These facts prove the production actor, native HP, and projected defenses together. */}
      <p data-testid="chthonic-resistance-actor">
        Actor: {actor?.name ?? 'missing'}; Level {actor?.level ?? 'unknown'}; HP {actor?.currentHP ?? 'unknown'}/{actor?.maxHP ?? 'unknown'}; Resistance: {actor?.resistances?.join(', ') || 'none'}.
      </p>
      <p data-testid="chthonic-spell-facts">
        Known spells: {canonicalSpells.length > 0 ? canonicalSpells.map(spell => `${spell.spellId} (level ${spell.minLevel})`).join('; ') : 'none'}; Chosen casting ability: {scenario.assembly.selectedAbility}.
      </p>
      <p data-testid="chthonic-native-grants">
        Native grants at level {character?.level ?? 'unknown'}: {scenario.assembly.grants.length > 0 ? scenario.assembly.grants.map(grant => `${grant.spellId} (level ${grant.minLevel})`).join('; ') : 'none'}.
      </p>
      <p data-testid="chthonic-persistent-resources">
        Persistent racial resources: {persistentResources.length > 0 ? persistentResources.join('; ') : 'none projected by the current grant bridge'}.
      </p>
      <p data-testid="chthonic-resistance-packet">
        Packet: {scenario.damageType}; Raw {scenario.rawDamage}; Final {scenario.finalDamage ?? 'not resolved'}; Resolutions {scenario.resolutionCount}.
      </p>
      <p aria-live="polite" role="status" data-testid="chthonic-resistance-outcome">
        {scenario.outcome}
      </p>

      {/* This is the honest boundary: the native grant projection is visible, but no fake cast is dispatched. */}
      <p data-testid="chthonic-assembly-boundary">
        Assembly boundary: production quick character assembly, applyRacialSpellGrantsByLevel, and createPlayerCombatCharacter are used; the selected Chthonic ability remains in racialSelections, while the class wizard ability remains unchanged.
      </p>
      <p data-testid="chthonic-spell-boundary">
        Spell boundary: this leaf shows canonical knownSpells and level gates plus the current native grant/resource projection; it does not claim spell targeting, effect resolution, action payment, slot payment, or rest integration because no mounted Chthonic spell transaction exists here.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed content boundary restores the
// canonical packet, selected ability, actor HP, and unresolved result together.
export const ChthonicTieflingRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <ChthonicTieflingRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'chthonic-tiefling-resistance',
  raceId: 'chthonic_tiefling',
  label: 'Chthonic Tiefling Resistance',
  description: 'Resolve canonical necrotic resistance through the native damage calculator.',
  Component: ChthonicTieflingRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
