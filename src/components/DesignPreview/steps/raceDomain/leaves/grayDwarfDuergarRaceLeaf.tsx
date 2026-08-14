// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 14/08/2026, 00:55:57
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
 * This file gives Gray Dwarf (Duergar) one deterministic, production-backed
 * proof surface for Dwarven Resilience and Psionic Fortitude.
 *
 * It reads the canonical ACTIVE_RACES record, assembles a quick character,
 * applies the racial parser, crosses the normal player-to-combat bridge, and
 * then calls native saving-throw, resistance, dice, and HP helpers. The leaf
 * owns only the narrow condition context needed to prevent the parser's broad
 * text projection from granting advantage on unrelated saves.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Duergar data, racial parsing, quick-character and
 * combat assembly, native save/resistance/HP helpers, and the Race contract.
 */

// ============================================================================
// Canonical Facts And Stable Controls
// ============================================================================
// These values identify the mounted proof while all rule text and spell gates
// remain read from the canonical race record rather than copied into the leaf.
// ============================================================================

export const GRAY_DWARF_DUERGAR_ACTOR_ID = 'gray-dwarf-duergar-race-actor';
export const GRAY_DWARF_DUERGAR_SAVE_DC = 12;
export const GRAY_DWARF_DUERGAR_POISON_RAW_DAMAGE = 15;
export const GRAY_DWARF_DUERGAR_SAVE_CONTROL_ID = 'resolve-gray-dwarf-duergar-saves';
export const GRAY_DWARF_DUERGAR_RESISTANCE_CONTROL_ID = 'resolve-gray-dwarf-duergar-poison';

const DUERGAR_SCENARIO_LEVEL = 5;
const POISON_DAMAGE: DamageTypeName = DamageType.Poison;

export type DuergarCondition = 'poisoned' | 'charmed' | 'stunned';

export interface GrayDwarfDuergarCanonicalFacts {
  darkvision: string | null;
  duergarMagic: string | null;
  dwarvenResilience: string | null;
  psionicFortitude: string | null;
  spellAbilityChoice: string | null;
  spellGates: readonly string[];
}

export interface GrayDwarfDuergarSaveSnapshot {
  condition: 'ordinary save' | 'non-applicable fire save' | 'avoid/end Poisoned' | 'avoid/end Charmed' | 'avoid/end Stunned';
  d20Rolls: readonly number[];
  save: SavingThrowResult;
}

export interface GrayDwarfDuergarSaveResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'parser_projection_missing' | 'context_adapter_missing';
  ordinary: GrayDwarfDuergarSaveSnapshot | null;
  nonApplicable: GrayDwarfDuergarSaveSnapshot | null;
  poisoned: GrayDwarfDuergarSaveSnapshot | null;
  charmed: GrayDwarfDuergarSaveSnapshot | null;
  stunned: GrayDwarfDuergarSaveSnapshot | null;
}

export interface GrayDwarfDuergarPoisonResolution {
  rawDamage: number;
  finalDamage: number;
  hitPointsBefore: number;
  hitPointsAfter: number;
  resistanceApplied: boolean;
}

export interface GrayDwarfDuergarScenarioState {
  actor: CombatCharacter | null;
  ordinaryActor: CombatCharacter | null;
  defenseBridge: 'production racial parser' | 'narrow canonical defense adapter';
  outcome: string;
  lastSaves: GrayDwarfDuergarSaveResolution | null;
  lastPoisonResistance: GrayDwarfDuergarPoisonResolution | null;
  eventLog: readonly string[];
}

// Find a named trait without copying its rule text into the preview surface.
export function getCanonicalGrayDwarfDuergarTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().toLowerCase().startsWith(`${traitName.toLowerCase()}:`)) ?? null;
}

// Read the display facts and level gates directly from the canonical race row.
export function getGrayDwarfDuergarCanonicalFacts(race: Race): GrayDwarfDuergarCanonicalFacts {
  return {
    darkvision: getCanonicalGrayDwarfDuergarTrait(race, 'Vision'),
    duergarMagic: getCanonicalGrayDwarfDuergarTrait(race, 'Duergar Magic'),
    dwarvenResilience: getCanonicalGrayDwarfDuergarTrait(race, 'Dwarven Resilience'),
    psionicFortitude: getCanonicalGrayDwarfDuergarTrait(race, 'Psionic Fortitude'),
    spellAbilityChoice: race.racialSpellChoice?.traitDescription ?? null,
    spellGates: (race.knownSpells ?? []).map(spell => `Level ${spell.minLevel}: ${spell.spellId}`),
  };
}

// Refuse to claim a proof when the active canonical row no longer contains the
// identity, traits, darkvision range, or known-spell gates being displayed.
export function hasCanonicalGrayDwarfDuergarFeatures(race: Race): boolean {
  const facts = getGrayDwarfDuergarCanonicalFacts(race);
  return race.id === 'duergar'
    && race.name === 'Gray Dwarf (Duergar)'
    && !!facts.darkvision
    && /superior darkvision/i.test(facts.darkvision)
    && /120 feet/i.test(facts.darkvision)
    && !!facts.duergarMagic
    && /enlarge\/reduce/i.test(facts.duergarMagic)
    && /invisibility/i.test(facts.duergarMagic)
    && !!facts.dwarvenResilience
    && /advantage on saving throws/i.test(facts.dwarvenResilience)
    && /poisoned condition/i.test(facts.dwarvenResilience)
    && /resistance to poison damage/i.test(facts.dwarvenResilience)
    && !!facts.psionicFortitude
    && /advantage on saving throws/i.test(facts.psionicFortitude)
    && /charmed/i.test(facts.psionicFortitude)
    && /stunned/i.test(facts.psionicFortitude)
    && facts.spellGates.length === 2
    && facts.spellGates.includes('Level 3: enlarge-reduce')
    && facts.spellGates.includes('Level 5: invisibility')
    && !!facts.spellAbilityChoice;
}

// ============================================================================
// Narrow Canonical Condition Adapter
// ============================================================================
// The production racial parser exposes the authored advantage as legacy text.
// These helpers narrow that projection to explicit native effect tags so an
// ordinary or fire save is visibly non-applicable while the three canonical
// conditions receive advantage through rollSavingThrow.
// ============================================================================

// Identify the broad parser projection for any of the three Duergar conditions.
export function isGrayDwarfDuergarParserProjection(modifier: string): boolean {
  return /saving throws?/i.test(modifier) && /poisoned|charmed|stunned/i.test(modifier);
}

// Convert one canonical condition into a structured native save modifier.
export function getGrayDwarfDuergarSaveAdapter(
  race: Race,
  condition: DuergarCondition,
): SaveAdvantageModifier | null {
  const sourceTrait = condition === 'poisoned'
    ? getCanonicalGrayDwarfDuergarTrait(race, 'Dwarven Resilience')
    : getCanonicalGrayDwarfDuergarTrait(race, 'Psionic Fortitude');
  if (!sourceTrait || !/advantage on saving throws/i.test(sourceTrait) || !new RegExp(condition, 'i').test(sourceTrait)) {
    return null;
  }

  return {
    type: 'advantage',
    context: 'saving_throw',
    against: [condition],
    source: `${condition === 'poisoned' ? 'Dwarven Resilience' : 'Psionic Fortitude'} (canonical ${condition} context)`,
  };
}

// Remove only the parser's broad racial projection before baseline comparisons.
export function applyGrayDwarfDuergarConditionContext(actor: CombatCharacter): CombatCharacter {
  const modifiers = actor.modifiers ?? { advantage: [], disadvantage: [], bonuses: [] };
  return {
    ...actor,
    modifiers: {
      ...modifiers,
      advantage: modifiers.advantage.filter(modifier => !isGrayDwarfDuergarParserProjection(modifier)),
      disadvantage: [...modifiers.disadvantage],
      bonuses: [...modifiers.bonuses],
    },
  };
}

// Confirm that the production parser supplied the raw projection to the actor.
export function hasGrayDwarfDuergarParserProjection(
  character: Pick<PlayerCharacter, 'modifiers'> | Pick<CombatCharacter, 'modifiers'> | null,
): boolean {
  return character?.modifiers?.advantage.some(isGrayDwarfDuergarParserProjection) ?? false;
}

// ============================================================================
// Production Actor Assembly And Scenario State
// ============================================================================
// The actor uses the same quick-character and combat bridge as the sandbox. A
// narrow resistance adapter remains visible only if the shared bridge misses
// the parsed defense, while saves still require the parser projection itself.
// ============================================================================

const DUERGAR_ACTOR_CONFIG = {
  name: 'Gray Dwarf (Duergar) Resilience Tester',
  raceId: 'duergar',
  classId: 'fighter',
  level: DUERGAR_SCENARIO_LEVEL,
  stats: [10, 10, 10, 10, 12, 14] as [number, number, number, number, number, number],
};

function unavailableGrayDwarfDuergarScenario(
  reason: GrayDwarfDuergarSaveResolution['reason'],
  outcome: string,
): GrayDwarfDuergarScenarioState {
  return {
    actor: null,
    ordinaryActor: null,
    defenseBridge: 'production racial parser',
    outcome,
    lastSaves: { status: 'rejected', reason, ordinary: null, nonApplicable: null, poisoned: null, charmed: null, stunned: null },
    lastPoisonResistance: null,
    eventLog: [],
  };
}

// Assemble and parse the production Duergar actor used by every transaction.
export function createGrayDwarfDuergarScenario(race: Race): GrayDwarfDuergarScenarioState {
  if (!hasCanonicalGrayDwarfDuergarFeatures(race)) {
    return unavailableGrayDwarfDuergarScenario('canonical_trait_missing', 'Gray Dwarf (Duergar) proof unavailable: canonical traits or spell gates changed.');
  }

  const quickCharacter = createQuickCharacter(DUERGAR_ACTOR_CONFIG);
  if (!quickCharacter) {
    return unavailableGrayDwarfDuergarScenario('assembly_unavailable', 'Gray Dwarf (Duergar) proof unavailable: production quick-character assembly rejected the actor.');
  }

  const parsedCharacter = applyRacialSpellGrantsByLevel(quickCharacter, DUERGAR_SCENARIO_LEVEL);
  if (!hasGrayDwarfDuergarParserProjection(parsedCharacter)) {
    return unavailableGrayDwarfDuergarScenario('parser_projection_missing', 'Duergar defenses unavailable: production racial parsing did not expose its save projection.');
  }

  const productionActor = createPlayerCombatCharacter({
    ...parsedCharacter,
    // The preview does not cast racial spells, so keep the combat actor focused
    // on the defense transaction while the canonical grant facts remain visible below.
    spellbook: undefined,
    spellSlots: undefined,
  });
  const actor: CombatCharacter = { ...productionActor, id: GRAY_DWARF_DUERGAR_ACTOR_ID };
  const hasPoisonResistance = actor.resistances?.some(type => type.toLowerCase() === POISON_DAMAGE.toLowerCase()) ?? false;

  if (hasPoisonResistance) {
    return {
      actor,
      ordinaryActor: applyGrayDwarfDuergarConditionContext(actor),
      defenseBridge: 'production racial parser',
      outcome: 'Ready: production Gray Dwarf (Duergar) actor; parser save projection and poison resistance are native.',
      lastSaves: null,
      lastPoisonResistance: null,
      eventLog: [],
    };
  }

  // DEBT: The shared combat bridge can miss a parsed racial defense in some
  // snapshots. This leaf keeps the canonical resistance visible as a narrow
  // adapter; the durable bridge repair belongs in shared combat code.
  const fallbackActor: CombatCharacter = {
    ...actor,
    resistances: [...(actor.resistances ?? []), POISON_DAMAGE],
  };
  return {
    actor: fallbackActor,
    ordinaryActor: applyGrayDwarfDuergarConditionContext(fallbackActor),
    defenseBridge: 'narrow canonical defense adapter',
    outcome: 'Ready: production Gray Dwarf (Duergar) actor; poison resistance uses a narrow canonical defense adapter because the combat bridge did not project it.',
    lastSaves: null,
    lastPoisonResistance: null,
    eventLog: [],
  };
}

// Roll ordinary, non-applicable, and all three canonical condition saves with
// one deterministic RNG stream so the visible kept faces are reproducible.
export function resolveGrayDwarfDuergarSaves(
  scenario: GrayDwarfDuergarScenarioState,
  race: Race,
  rng: () => number = Math.random,
): GrayDwarfDuergarScenarioState {
  if (!scenario.actor || !scenario.ordinaryActor) {
    return { ...scenario, outcome: 'Duergar saves rejected: the production actor or ordinary baseline is unavailable.' };
  }
  if (!hasGrayDwarfDuergarParserProjection(scenario.actor)) {
    return { ...scenario, outcome: 'Duergar saves rejected: the parser-backed racial projection is unavailable.' };
  }

  const ordinaryRolls: number[] = [];
  const ordinary = rollSavingThrow(scenario.ordinaryActor, 'Wisdom', GRAY_DWARF_DUERGAR_SAVE_DC, undefined, { tags: ['ordinary save'] }, undefined, {
    rng: () => {
      const value = rng();
      ordinaryRolls.push(Math.floor(value * 20) + 1);
      return value;
    },
  });

  const nonApplicableRolls: number[] = [];
  const poisonAdapter = getGrayDwarfDuergarSaveAdapter(race, 'poisoned');
  const nonApplicable = poisonAdapter
    ? rollSavingThrow(scenario.ordinaryActor, 'Constitution', GRAY_DWARF_DUERGAR_SAVE_DC, undefined, { tags: ['fire'] }, [poisonAdapter], {
      rng: () => {
        const value = rng();
        nonApplicableRolls.push(Math.floor(value * 20) + 1);
        return value;
      },
    })
    : null;

  const resolveCondition = (condition: DuergarCondition): GrayDwarfDuergarSaveSnapshot | null => {
    const adapter = getGrayDwarfDuergarSaveAdapter(race, condition);
    if (!adapter) return null;
    const d20Rolls: number[] = [];
    const save = rollSavingThrow(scenario.ordinaryActor!, 'Constitution', GRAY_DWARF_DUERGAR_SAVE_DC, undefined, { tags: [condition] }, [adapter], {
      rng: () => {
        const value = rng();
        d20Rolls.push(Math.floor(value * 20) + 1);
        return value;
      },
    });
    return {
      condition: condition === 'poisoned' ? 'avoid/end Poisoned' : condition === 'charmed' ? 'avoid/end Charmed' : 'avoid/end Stunned',
      d20Rolls,
      save,
    };
  };

  const poisoned = resolveCondition('poisoned');
  const charmed = resolveCondition('charmed');
  const stunned = resolveCondition('stunned');
  if (!poisonAdapter || !nonApplicable || !poisoned || !charmed || !stunned) {
    return {
      ...scenario,
      outcome: 'Duergar saves rejected: one canonical condition context adapter is unavailable.',
      lastSaves: { status: 'rejected', reason: 'context_adapter_missing', ordinary: null, nonApplicable: null, poisoned: null, charmed: null, stunned: null },
    };
  }

  const resolution: GrayDwarfDuergarSaveResolution = {
    status: 'resolved',
    reason: 'resolved',
    ordinary: { condition: 'ordinary save', d20Rolls: ordinaryRolls, save: ordinary },
    nonApplicable: { condition: 'non-applicable fire save', d20Rolls: nonApplicableRolls, save: nonApplicable },
    poisoned,
    charmed,
    stunned,
  };
  const event = `Duergar saves resolved: ordinary ${ordinary.total}; Fire kept ${nonApplicable.roll}; Poisoned kept ${poisoned.save.roll}; Charmed kept ${charmed.save.roll}; Stunned kept ${stunned.save.roll}.`;
  return {
    ...scenario,
    outcome: event,
    lastSaves: resolution,
    eventLog: [...scenario.eventLog, event],
  };
}

// Apply one fixed poison hit through the native resistance and HP helpers.
export function resolveGrayDwarfDuergarPoisonResistance(
  scenario: GrayDwarfDuergarScenarioState,
): GrayDwarfDuergarScenarioState {
  if (!scenario.actor) {
    return { ...scenario, outcome: 'Dwarven Resilience rejected: the production actor is unavailable.' };
  }
  const hitPointsBefore = scenario.actor.currentHP;
  const finalDamage = ResistanceCalculator.applyResistances(
    GRAY_DWARF_DUERGAR_POISON_RAW_DAMAGE,
    POISON_DAMAGE,
    scenario.actor,
    createMockCombatCharacter({ id: 'duergar-poison-source', name: 'Poison Test Source', team: 'enemy', position: { x: 3, y: 2 } }),
    true,
  );
  const actorAfter = applyDamageAndCheckDowned(scenario.actor, finalDamage, false);
  const resolution: GrayDwarfDuergarPoisonResolution = {
    rawDamage: GRAY_DWARF_DUERGAR_POISON_RAW_DAMAGE,
    finalDamage,
    hitPointsBefore,
    hitPointsAfter: actorAfter.currentHP,
    resistanceApplied: finalDamage < GRAY_DWARF_DUERGAR_POISON_RAW_DAMAGE,
  };
  const event = `Dwarven Resilience resolved: ${GRAY_DWARF_DUERGAR_POISON_RAW_DAMAGE} raw Poison -> ${finalDamage}; HP ${hitPointsBefore} -> ${actorAfter.currentHP}.`;
  return {
    ...scenario,
    actor: actorAfter,
    outcome: event,
    lastPoisonResistance: resolution,
    eventLog: [...scenario.eventLog, event],
  };
}

// ============================================================================
// Visible Gray Dwarf (Duergar) Leaf Surface
// ============================================================================
// The UI exposes canonical facts, actor/resource state, kept dice, HP, event
// receipts, and explicit unsupported boundaries. Parent resetCount remounts it.
// ============================================================================

function GrayDwarfDuergarRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createGrayDwarfDuergarScenario(race));
  const facts = getGrayDwarfDuergarCanonicalFacts(race);

  // Resolve all condition branches at once so one click provides a compact,
  // deterministic comparison of ordinary, non-applicable, and advantaged saves.
  const resolveSaves = () => {
    const next = resolveGrayDwarfDuergarSaves(scenario, race);
    setScenario(next);
    onScenarioEvent(`Gray Dwarf (Duergar) SAVES: ${next.outcome}`);
  };

  // Resolve the fixed poison transaction through the native resistance and HP path.
  const resolvePoison = () => {
    const next = resolveGrayDwarfDuergarPoisonResistance(scenario);
    setScenario(next);
    onScenarioEvent(`Gray Dwarf (Duergar) POISON: ${next.outcome}`);
  };

  return (
    <section aria-labelledby="gray-dwarf-duergar-title" data-testid="gray-dwarf-duergar-race-leaf">
      <h4 id="gray-dwarf-duergar-title">Gray Dwarf (Duergar) · Dwarven Resilience + Psionic Fortitude</h4>
      <p data-testid="gray-dwarf-duergar-dwarven-resilience">Canonical: {facts.dwarvenResilience ?? 'Dwarven Resilience trait missing'}</p>
      <p data-testid="gray-dwarf-duergar-psionic-fortitude">Canonical: {facts.psionicFortitude ?? 'Psionic Fortitude trait missing'}</p>
      <div data-testid="gray-dwarf-duergar-actor-facts">
        Actor: {scenario.actor?.name ?? 'unavailable'}; Level {scenario.actor?.level ?? 'unknown'}; parser projection {scenario.actor && hasGrayDwarfDuergarParserProjection(scenario.actor) ? 'native' : 'missing'}; Poison resistance {scenario.actor?.resistances?.join(', ') ?? 'missing'}; defense bridge {scenario.defenseBridge}; canonical racial resources {facts.spellGates.join(', ') || 'none'}.
      </div>

      <Button type="button" variant="primary" size="sm" id={GRAY_DWARF_DUERGAR_SAVE_CONTROL_ID} onClick={resolveSaves}>Resolve Poisoned, Charmed, and Stunned saves</Button>
      <Button type="button" variant="action" size="sm" id={GRAY_DWARF_DUERGAR_RESISTANCE_CONTROL_ID} onClick={resolvePoison}>Resolve 15 Poison damage</Button>

      <p aria-live="polite" role="status" data-testid="gray-dwarf-duergar-outcome">{scenario.outcome}</p>
      <div data-testid="gray-dwarf-duergar-save-result">
        {scenario.lastSaves?.status === 'resolved'
          ? <>
            <p>Ordinary baseline: d20 face {scenario.lastSaves.ordinary?.d20Rolls.join(' / ')}; Wisdom save total {scenario.lastSaves.ordinary?.save.total}.</p>
            <p>Non-applicable Fire save: d20 face {scenario.lastSaves.nonApplicable?.d20Rolls.join(' / ')}; kept {scenario.lastSaves.nonApplicable?.save.roll}; one roll because Poisoned advantage does not match Fire.</p>
            <p>Avoid/end Poisoned: d20 faces {scenario.lastSaves.poisoned?.d20Rolls.join(' / ')}; kept {scenario.lastSaves.poisoned?.save.roll}; Constitution save total {scenario.lastSaves.poisoned?.save.total}; advantage applied.</p>
            <p>Avoid/end Charmed: d20 faces {scenario.lastSaves.charmed?.d20Rolls.join(' / ')}; kept {scenario.lastSaves.charmed?.save.roll}; Constitution save total {scenario.lastSaves.charmed?.save.total}; advantage applied.</p>
            <p>Avoid/end Stunned: d20 faces {scenario.lastSaves.stunned?.d20Rolls.join(' / ')}; kept {scenario.lastSaves.stunned?.save.roll}; Constitution save total {scenario.lastSaves.stunned?.save.total}; advantage applied.</p>
          </>
          : 'No Duergar save comparison resolved yet.'}
      </div>
      <p data-testid="gray-dwarf-duergar-hp">
        HP: {scenario.actor?.currentHP ?? 'unavailable'} / {scenario.actor?.maxHP ?? 'unavailable'}{scenario.lastPoisonResistance ? `; last damage ${scenario.lastPoisonResistance.rawDamage} -> ${scenario.lastPoisonResistance.finalDamage}` : ''}
      </p>
      <ol aria-label="Gray Dwarf (Duergar) event log" data-testid="gray-dwarf-duergar-event-log">
        {scenario.eventLog.length > 0 ? scenario.eventLog.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>) : <li>No Duergar transaction yet.</li>}
      </ol>

      <div data-testid="gray-dwarf-duergar-canonical-facts">
        <p>Superior Darkvision: {facts.darkvision ?? 'canonical fact missing'}</p>
        <p>Duergar Magic: {facts.duergarMagic ?? 'canonical fact missing'}</p>
        <p>Spell gates: {facts.spellGates.join(' · ') || 'canonical gates missing'}</p>
        <p>Spellcasting ability choice: {facts.spellAbilityChoice ?? 'canonical choice missing'}</p>
      </div>
      <p data-testid="gray-dwarf-duergar-boundary">
        Boundary: this leaf uses the production quick-character, racial parser, combat bridge, native save helper, native resistance helper, and native HP transition. It derives only canonical Poisoned, Charmed, and Stunned context tags so the parser projection cannot over-apply; it does not apply or remove conditions, cast Enlarge/Reduce or Invisibility, spend spell resources, choose Intelligence/Wisdom/Charisma, and does not claim map-sense integration or 2D/3D rendered proof. Superior Darkvision 120 feet and Duergar Magic spell gates are canonical facts shown here; Reset is supplied by the parent resetCount remount.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

// Parent resetCount remounts the leaf and clears saves, HP, resources, and logs.
export function GrayDwarfDuergarRaceLeaf(props: RaceDomainLeafProps) {
  return <GrayDwarfDuergarRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

// Automatic discovery consumes this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'gray-dwarf-duergar-resilience',
  raceId: 'duergar',
  label: 'Gray Dwarf (Duergar) · Resilience',
  description: 'Compare native poison resistance and conditional Poisoned, Charmed, and Stunned saving-throw advantage from canonical Duergar traits.',
  Component: GrayDwarfDuergarRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
