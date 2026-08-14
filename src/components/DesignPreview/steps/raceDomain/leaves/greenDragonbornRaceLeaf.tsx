// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 14/08/2026, 01:17:44
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
import { buildRacialTraitLibrary } from '../../../../../data/races';
import type {
  RacialBreathWeapon,
  RacialFeatureTrait,
} from '../../../../../data/races/racialTraits';
import {
  applyRacialSpellGrantsByLevel,
  resolveRacialResourceId,
} from '../../../../../utils/character/characterUtils';
import {
  calculateSaveDamage,
  rollSavingThrow,
} from '../../../../../utils/character/savingThrowUtils';
import {
  calculateDamage,
  createPlayerCombatCharacter,
  rollDice,
} from '../../../../../utils/combat/combatUtils';
import { applyDamageAndCheckDowned } from '../../../../../utils/combat/deathSaveUtils';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../../utils/combat/actionEconomyUtils';
import {
  createQuickCharacter,
  createQuickCombatCharacter,
} from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { Ability, CombatCharacter } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Green Dragonborn race one deterministic
 * Tactical Sandbox transaction: poison resistance and the level-five Breath
 * Weapon. It starts from the production quick-character builder, preserves the
 * parser's resource facts, and sends damage, saving throws, and action payment
 * through the native combat helpers used by the game.
 *
 * Called by: RaceDomainShell.tsx through automatic leaves/ discovery.
 * Depends on: the canonical Green Dragonborn Race record, the racial trait
 * parser, quick-character assembly, and native combat/save utilities.
 */

// ============================================================================
// Canonical Facts And Stable Controls
// ============================================================================
// These identifiers make the leaf's controls and focused tests stable. Rule
// values are read from the canonical trait row or parser projection below so
// the preview cannot silently become a second source of racial rules.
// ============================================================================

export const GREEN_DRAGONBORN_RESISTANCE_CONTROL_ID = 'resolve-green-dragonborn-resistance';
export const GREEN_DRAGONBORN_BREATH_CONTROL_ID = 'resolve-green-dragonborn-breath';
export const GREEN_DRAGONBORN_SHAPE_CONTROL_ID = 'green-dragonborn-breath-shape';
export const GREEN_DRAGONBORN_SAVE_CONTROL_ID = 'green-dragonborn-save-outcome';
export const GREEN_DRAGONBORN_ACTOR_ID = 'green-dragonborn-race-actor';
export const GREEN_DRAGONBORN_TARGET_ID = 'green-dragonborn-breath-target';
export const GREEN_DRAGONBORN_RESISTANCE_DAMAGE = 15;
export const GREEN_DRAGONBORN_BREATH_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'green_dragonborn__breath_weapon__resource',
);

export type GreenDragonbornDamageType = 'poison' | 'acid';
export type GreenDragonbornBreathShape = 'cone' | 'line';
export type GreenDragonbornSaveOutcome = 'failed' | 'successful';

export interface GreenDragonbornBreathShapeOption {
  shape: GreenDragonbornBreathShape;
  sizeFeet: number;
}

export const GREEN_DRAGONBORN_BREATH_SHAPES: readonly GreenDragonbornBreathShapeOption[] = [
  { shape: 'cone', sizeFeet: 15 },
  { shape: 'line', sizeFeet: 30 },
];

export interface ParsedGreenDragonbornTraits {
  resistance: string[];
  breath: RacialBreathWeapon;
  breathTrait: RacialFeatureTrait;
  breathShapes: readonly GreenDragonbornBreathShapeOption[];
  darkvisionFeet: number;
  flightTrait: string;
}

// ============================================================================
// Canonical Parser Bridge
// ============================================================================
// The race data uses wiki links for display. Removing those links is a narrow
// parser boundary only; all resulting facts still come from the canonical row
// and are then passed into the normal character and combat assembly pipeline.
// ============================================================================

function createParserReadyGreenDragonbornRace(race: Race): Race {
  // Keep the authored words and remove only markup that otherwise hides words
  // such as Poison from the shared racial trait parser.
  return {
    ...race,
    traits: race.traits.map(trait => trait.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')),
  };
}

/** Return the exact canonical trait row whose display name starts this prefix. */
export function getCanonicalGreenDragonbornTrait(
  race: Race,
  traitName: string,
): string | null {
  // Matching the trait label keeps display-only text and rules together in the
  // source row instead of introducing a duplicate local rules table.
  return race.traits.find(trait => (
    trait.trim().toLowerCase().startsWith(`${traitName.toLowerCase()}:`)
  )) ?? null;
}

/** Parse the authored two-shape and linked save wording if the parser needs help. */
export function parseCanonicalGreenDragonbornBreath(
  traitText: string,
): RacialBreathWeapon | null {
  // The parser handles one area shape, while this fallback reads the same
  // canonical sentence and retains its first shape as the native bridge shape.
  const areaMatch = traitText.match(/(\d+)-foot\s+(cone|line)/i);
  const saveMatch = traitText.match(/\b(Dexterity|Constitution)\b\s+(?:modifier|saving throw)/i);
  const damageDiceMatch = traitText.match(/(\d+d\d+)\s+damage/i);
  const damageTypeMatch = traitText.match(/exhalation of\s+([a-z]+)\s+damage/i);
  if (!areaMatch || !saveMatch || !damageDiceMatch || !damageTypeMatch) return null;

  // These fields are the normalized shape expected by the production combat
  // bridge; level scaling is expanded below from the same source sentence.
  return {
    areaShape: areaMatch[2].toLowerCase() as 'cone' | 'line',
    areaSize: Number(areaMatch[1]),
    saveAbility: saveMatch[1] as RacialBreathWeapon['saveAbility'],
    damageDice: damageDiceMatch[1],
    damageType: damageTypeMatch[1],
    scaling: [],
  };
}

/** Read all authored cone/line choices and remove duplicate rows if present. */
function readCanonicalGreenDragonbornShapes(
  traitText: string,
): readonly GreenDragonbornBreathShapeOption[] {
  // Both options are in one canonical sentence, so the selector can expose
  // them without pretending that this leaf placed an AoE on a battle map.
  const seen = new Set<string>();
  const shapes: GreenDragonbornBreathShapeOption[] = [];
  for (const match of traitText.matchAll(/(\d+)-foot\s+(cone|line)/gi)) {
    const shape = match[2].toLowerCase() as GreenDragonbornBreathShape;
    const sizeFeet = Number(match[1]);
    const key = `${shape}:${sizeFeet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    shapes.push({ shape, sizeFeet });
  }
  return shapes;
}

/** Expand the authored increment sentence into native combat dice values. */
function addCanonicalGreenDragonbornScaling(
  breath: RacialBreathWeapon,
  traitText: string,
): RacialBreathWeapon {
  // The parser understands explicit "2d10 at 5th level" rows but this race
  // uses the equivalent "increases by 1d10 at levels 5, 11, and 17" wording.
  const increase = traitText.match(/damage increases by (\d+)d(\d+)\s+at levels?\s+([^.;]+)/i);
  if (!increase) return breath;

  const base = breath.damageDice.match(/(\d+)d(\d+)/i);
  const baseDice = base ? Number(base[1]) : 1;
  const baseSides = base ? Number(base[2]) : Number(increase[2]);
  const incrementDice = Number(increase[1]);
  const levels = [...increase[3].matchAll(/\d+/g)].map(match => Number(match[0]));

  // Each level threshold adds the authored increment to the previous dice.
  return {
    ...breath,
    scaling: levels.map((level, index) => ({
      level,
      dice: `${baseDice + ((index + 1) * incrementDice)}d${baseSides}`,
    })),
  };
}

/** Read the canonical parser projection plus the linked-text facts this leaf needs. */
export function getCanonicalGreenDragonbornTraits(
  race: Race,
): ParsedGreenDragonbornTraits | null {
  // Build a one-race library from normalized canonical text so the leaf uses
  // the same trait parser as character assembly without changing shared data.
  const parserReadyRace = createParserReadyGreenDragonbornRace(race);
  const parsedTraits = buildRacialTraitLibrary({ [race.id]: parserReadyRace }).byRaceId[race.id] ?? [];
  const breathText = getCanonicalGreenDragonbornTrait(race, 'Breath Weapon') ?? '';
  const normalizedBreathText = breathText.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  const breathTrait = parsedTraits.find((trait): trait is RacialFeatureTrait => (
    trait.type !== 'spell' && trait.traitName === 'Breath Weapon'
  ));
  const parsedBreath = breathTrait?.modifierBuckets?.breathWeapon
    ?? parseCanonicalGreenDragonbornBreath(normalizedBreathText);
  const resistanceTrait = parsedTraits.find((trait): trait is RacialFeatureTrait => (
    trait.type !== 'spell' && trait.traitName === 'Damage Resistance'
  ));
  const resistanceText = getCanonicalGreenDragonbornTrait(race, 'Damage Resistance') ?? '';
  const normalizedResistanceText = resistanceText.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  const resistanceFallback = normalizedResistanceText.match(/resistance\s+to\s+([a-z]+)\s+damage/i)?.[1];
  const visionText = getCanonicalGreenDragonbornTrait(race, 'Vision') ?? '';
  const flightTrait = race.traits.find(trait => (
    trait.toLowerCase().startsWith('draconic flight')
  )) ?? '';
  if (!breathTrait || !parsedBreath || !resistanceTrait) return null;

  // Prefer parser resistance facts, with a source-text fallback for a parser
  // boundary. The fallback is still constrained to the canonical trait row.
  const resistance = resistanceTrait.defensiveTraits?.resistances?.length
    ? resistanceTrait.defensiveTraits.resistances
    : resistanceFallback
      ? [resistanceFallback.replace(/^./, value => value.toUpperCase())]
      : [];
  const darkvisionFeet = Number(visionText.match(/(\d+)\s+feet/i)?.[1] ?? 0);
  const breath = addCanonicalGreenDragonbornScaling(parsedBreath, normalizedBreathText);
  const breathShapes = readCanonicalGreenDragonbornShapes(normalizedBreathText);

  return {
    resistance,
    breath,
    breathTrait,
    breathShapes,
    darkvisionFeet,
    flightTrait,
  };
}

/** Confirm that every rule exercised by the leaf is present in canonical data. */
export function hasCanonicalGreenDragonbornRules(race: Race): boolean {
  // A missing source rule makes the scenario unavailable rather than allowing
  // UI state to become an authoritative replacement for game mechanics.
  const parsed = getCanonicalGreenDragonbornTraits(race);
  const resistanceText = getCanonicalGreenDragonbornTrait(race, 'Damage Resistance');
  const breathText = getCanonicalGreenDragonbornTrait(race, 'Breath Weapon');
  const visionText = getCanonicalGreenDragonbornTrait(race, 'Vision');

  return race.id === 'green_dragonborn'
    && !!parsed
    && resistanceText?.toLowerCase().includes('poison') === true
    && parsed.resistance.some(type => type.toLowerCase() === 'poison')
    && parsed.breath.saveAbility === 'Constitution'
    && parsed.breath.damageDice === '1d10'
    && parsed.breath.damageType.toLowerCase() === 'poison'
    && parsed.breath.scaling.some(scale => scale.level === 5 && scale.dice === '2d10')
    && parsed.breathTrait.resources?.some(resource => (
      resource.id === 'green_dragonborn__breath_weapon__resource'
      && resource.maxUses === 'proficiency_bonus'
      && resource.resetOn === 'long_rest'
    )) === true
    && /replace one of your attacks/i.test(breathText ?? '')
    && parsed.breathShapes.some(option => option.shape === 'cone' && option.sizeFeet === 15)
    && parsed.breathShapes.some(option => option.shape === 'line' && option.sizeFeet === 30)
    && parsed.darkvisionFeet === 60
    && /draconic flight/i.test(parsed.flightTrait)
    && /darkvision/i.test(visionText ?? '');
}

// ============================================================================
// Production Actor Assembly
// ============================================================================
// The actor and target are normal quick characters. The actor receives only
// canonical parser facts needed to cross the current assembly gap; combat and
// damage execution remains owned by production helpers after the bridge.
// ============================================================================

export interface GreenDragonbornScenarioState {
  race: Race;
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  damageType: GreenDragonbornDamageType;
  breathShape: GreenDragonbornBreathShape;
  saveOutcome: GreenDragonbornSaveOutcome;
  resistanceFinalDamage: number | null;
  breathRawDamage: number | null;
  breathFinalDamage: number | null;
  breathSaveTotal: number | null;
  outcome: string;
}

/** Build a production combat target with enough HP for both visible branches. */
function createGreenDragonbornTarget(): CombatCharacter | null {
  // The target is assembled by the same quick-character bridge as a combat
  // actor, rather than by hand-authoring a test-shaped CombatCharacter object.
  const target = createQuickCombatCharacter({
    name: 'Green Dragonborn Breath Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 12, 10, 10, 10],
  });
  return target
    ? { ...target, id: GREEN_DRAGONBORN_TARGET_ID, team: 'enemy' }
    : null;
}

/** Assemble the Green Dragonborn actor through production character and combat bridges. */
function createGreenDragonbornActor(race: Race): {
  actor: CombatCharacter | null;
  assembledCharacter: PlayerCharacter | null;
  outcome: string;
} {
  // Level 5 is deliberate: it proves the first canonical Breath Weapon scaling
  // threshold and gives Constitution 14 for an explicit DC 8 + 2 + 3 = 13.
  const quickCharacter = createQuickCharacter({
    name: 'Green Dragonborn - Race Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 14, 10, 10, 10],
  });
  const canonicalTraits = getCanonicalGreenDragonbornTraits(race);
  if (!quickCharacter || !canonicalTraits || !hasCanonicalGreenDragonbornRules(race)) {
    return {
      actor: null,
      assembledCharacter: quickCharacter,
      outcome: 'Green Dragonborn unavailable: canonical traits or production assembly is incomplete.',
    };
  }

  // The shared assembly gets the same normalized race row so it can discover
  // the canonical resource before the combat bridge converts the character.
  const parserAssembledCharacter = applyRacialSpellGrantsByLevel(
    {
      ...quickCharacter,
      race: createParserReadyGreenDragonbornRace(race),
    },
    quickCharacter.level ?? 1,
  );
  const resourceDefinition = canonicalTraits.breathTrait.resources?.find(resource => (
    resource.id === 'green_dragonborn__breath_weapon__resource'
  ));
  if (!resourceDefinition) {
    return {
      actor: null,
      assembledCharacter: parserAssembledCharacter,
      outcome: 'Green Dragonborn unavailable: the canonical Breath Weapon resource was not assembled.',
    };
  }

  // DEBT: The shared assembly cache can receive linked race rows from callers
  // that did not normalize display links first. This leaf-local projection
  // carries only proven resistance, resource, and breath facts across that
  // boundary; the native combat bridge still resolves the transaction.
  const resourceMax = typeof resourceDefinition.maxUses === 'number'
    ? resourceDefinition.maxUses
    : parserAssembledCharacter.proficiencyBonus ?? 2;
  const assembledCharacter: PlayerCharacter = {
    ...parserAssembledCharacter,
    race: createParserReadyGreenDragonbornRace(race),
    resistances: Array.from(new Set([
      ...(parserAssembledCharacter.resistances ?? []),
      ...canonicalTraits.resistance,
    ])),
    limitedUses: {
      ...(parserAssembledCharacter.limitedUses ?? {}),
      [GREEN_DRAGONBORN_BREATH_RESOURCE_ID]: {
        name: `${race.name}: Breath Weapon (Breath Weapon usage)`,
        current: resourceMax,
        max: resourceDefinition.maxUses,
        resetOn: resourceDefinition.resetOn,
      },
    },
    modifiers: {
      ...(parserAssembledCharacter.modifiers ?? {}),
      advantage: [...(parserAssembledCharacter.modifiers?.advantage ?? [])],
      disadvantage: [...(parserAssembledCharacter.modifiers?.disadvantage ?? [])],
      bonuses: [...(parserAssembledCharacter.modifiers?.bonuses ?? [])],
      breathWeapon: { ...canonicalTraits.breath },
    },
  };
  const generatedActor = createPlayerCombatCharacter(assembledCharacter);
  const breathAbility = generatedActor.abilities.find(
    ability => ability.id === 'racial_breath_weapon',
  );
  if (!breathAbility) {
    return {
      actor: null,
      assembledCharacter,
      outcome: 'Green Dragonborn unavailable: the native combat bridge did not expose Breath Weapon.',
    };
  }

  // Carry the canonical PB-scaled resource across the transient combat bridge
  // because that bridge does not preserve every limited-use entry on all paths.
  const actor = resetEconomy({
    ...generatedActor,
    id: GREEN_DRAGONBORN_ACTOR_ID,
    name: `${race.name} - Race Tester`,
    position: { x: 2, y: 2 },
    resistances: assembledCharacter.resistances,
    limitedUses: {
      [GREEN_DRAGONBORN_BREATH_RESOURCE_ID]: {
        name: `${race.name}: Breath Weapon (Breath Weapon usage)`,
        current: resourceMax,
        max: resourceDefinition.maxUses,
        resetOn: resourceDefinition.resetOn,
      },
    },
  });

  return {
    actor,
    assembledCharacter,
    outcome: `Ready: ${actor.name}; level ${actor.level}; Poison resistance; Breath Weapon ${resourceMax}/${resourceDefinition.maxUses} uses; action ready.`,
  };
}

/** Create the deterministic baseline restored by the parent resetCount key. */
export function createGreenDragonbornScenario(race: Race): GreenDragonbornScenarioState {
  // Rebuilding both actors makes reset restore action, resource, target HP, and
  // result state together instead of selectively clearing only the controls.
  const assembled = createGreenDragonbornActor(race);
  return {
    race,
    actor: assembled.actor,
    target: createGreenDragonbornTarget(),
    damageType: 'poison',
    breathShape: 'cone',
    saveOutcome: 'failed',
    resistanceFinalDamage: null,
    breathRawDamage: null,
    breathFinalDamage: null,
    breathSaveTotal: null,
    outcome: assembled.outcome,
  };
}

// ============================================================================
// Native Resistance Transaction
// ============================================================================
// calculateDamage delegates mitigation to the shared resistance calculator.
// The acid packet changes only damage type, making the poison branch visibly
// comparable without adding a second damage implementation.
// ============================================================================

export function resolveGreenDragonbornResistance(
  scenario: GreenDragonbornScenarioState,
  damageType: GreenDragonbornDamageType,
): GreenDragonbornScenarioState {
  // Without a production actor, no resistance result is authoritative.
  if (!scenario.actor) {
    return { ...scenario, damageType, outcome: 'Resistance rejected: production actor is unavailable.' };
  }

  // Native mitigation halves odd resistance damage down to 7 and leaves acid
  // unchanged because the actor only carries Poison resistance.
  const finalDamage = calculateDamage(
    GREEN_DRAGONBORN_RESISTANCE_DAMAGE,
    null,
    scenario.actor,
    damageType,
  );
  const resisted = finalDamage < GREEN_DRAGONBORN_RESISTANCE_DAMAGE;
  return {
    ...scenario,
    damageType,
    resistanceFinalDamage: finalDamage,
    outcome: `Native resistance resolved: ${damageType} raw ${GREEN_DRAGONBORN_RESISTANCE_DAMAGE}, final ${finalDamage} (${resisted ? 'resistance applied' : 'non-poison comparison unchanged'}).`,
  };
}

// ============================================================================
// Native Breath Weapon Transaction
// ============================================================================
// This adapter consumes one real Attack action and one canonical PB-scaled
// resource, then uses deterministic native save and dice inputs for repeatable
// proof. It does not call a spell system or claim map AoE placement.
// ============================================================================

function findGreenDragonbornBreathAbility(actor: CombatCharacter): Ability | undefined {
  // The combat bridge exposes racial Breath Weapon under this stable ability id.
  return actor.abilities.find(ability => ability.id === 'racial_breath_weapon');
}

function deterministicSaveFace(outcome: GreenDragonbornSaveOutcome): number {
  // A natural 1 makes the failed branch certain; a natural 20 makes the success
  // branch certain while preserving the target's native Constitution modifier.
  return outcome === 'failed' ? 1 : 20;
}

export function resolveGreenDragonbornBreath(
  scenario: GreenDragonbornScenarioState,
  breathShape: GreenDragonbornBreathShape,
  saveOutcome: GreenDragonbornSaveOutcome,
): GreenDragonbornScenarioState {
  const actor = scenario.actor;
  const target = scenario.target;
  const ability = actor ? findGreenDragonbornBreathAbility(actor) : undefined;
  const parsed = getCanonicalGreenDragonbornTraits(scenario.race);
  const selectedShape = parsed?.breathShapes.find(option => option.shape === breathShape);
  const resource = actor?.limitedUses?.[GREEN_DRAGONBORN_BREATH_RESOURCE_ID];

  // Validate every spend before rolling. Returning the original actor and
  // target references makes failed action/resource attempts atomic.
  if (!actor || !target || !ability || !selectedShape) {
    return {
      ...scenario,
      breathShape,
      saveOutcome,
      outcome: 'Breath Weapon rejected atomically: canonical actor, target, ability, or shape is unavailable.',
    };
  }
  if (!canAffordActionCost(actor, { type: 'action' })) {
    return {
      ...scenario,
      breathShape,
      saveOutcome,
      outcome: 'Breath Weapon rejected atomically: Attack action replacement is unavailable.',
    };
  }
  if (!resource || resource.current <= 0) {
    return {
      ...scenario,
      breathShape,
      saveOutcome,
      outcome: 'Breath Weapon rejected atomically: no PB-scaled long-rest use remains.',
    };
  }

  // The ability and its DC/dice are read from the production bridge, not from
  // the visible selector state or a hardcoded preview packet.
  const effect = ability.effects.find(candidate => candidate.type === 'damage');
  const saveDC = ability.saveDC ?? 0;
  const saveAbility = ability.saveAbility ?? 'Constitution';
  const damageDice = effect?.dice ?? '1d10';
  const saveResult = rollSavingThrow(
    target,
    saveAbility,
    saveDC,
    undefined,
    { damageType: 'poison' },
    undefined,
    { rng: () => (deterministicSaveFace(saveOutcome) - 1) / 20 },
  );
  const rawDamage = rollDice(damageDice, { rng: () => 0.5 });
  const damageAfterSave = calculateSaveDamage(rawDamage, saveResult, 'half');
  const finalDamage = calculateDamage(damageAfterSave, actor, target, 'Poison');

  // Only after every validation and roll succeeds are action, resource, and HP
  // replaced with their immutable post-transaction snapshots.
  const paidActor = consumeActionCost(actor, { type: 'action' });
  const nextActor: CombatCharacter = {
    ...paidActor,
    limitedUses: {
      ...(paidActor.limitedUses ?? {}),
      [GREEN_DRAGONBORN_BREATH_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
  };
  // The shared HP helper applies temporary HP first and records native damage
  // and downing/death-save transitions instead of only subtracting a number.
  const nextTarget = applyDamageAndCheckDowned(target, finalDamage, false);
  const nextResource = nextActor.limitedUses?.[GREEN_DRAGONBORN_BREATH_RESOURCE_ID];

  return {
    ...scenario,
    actor: nextActor,
    target: nextTarget,
    breathShape,
    saveOutcome,
    breathRawDamage: rawDamage,
    breathFinalDamage: finalDamage,
    breathSaveTotal: saveResult.total,
    outcome: `Native Breath Weapon resolved: ${selectedShape.sizeFeet}-foot ${breathShape}; Attack action replaced; DC ${saveDC} Constitution save ${saveResult.success ? 'successful' : 'failed'} (${saveResult.total}); ${damageDice} rolled ${rawDamage}, final ${finalDamage}; use ${nextResource?.current}/${resource.max}. AoE placement not claimed.`,
  };
}

// ============================================================================
// Green Dragonborn Leaf UI
// ============================================================================
// The compact surface keeps canonical facts, native transaction state, visible
// receipts, and the deferred map/sense/flight boundaries together for operators.
// ============================================================================

const GreenDragonbornRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  // The parent resetCount remounts this component, restoring the full baseline.
  const [scenario, setScenario] = useState<GreenDragonbornScenarioState>(
    () => createGreenDragonbornScenario(race),
  );
  const canonical = getCanonicalGreenDragonbornTraits(race);
  const resource = scenario.actor?.limitedUses?.[GREEN_DRAGONBORN_BREATH_RESOURCE_ID];
  const breathAbility = scenario.actor ? findGreenDragonbornBreathAbility(scenario.actor) : undefined;
  const shapes = canonical?.breathShapes.length ? canonical.breathShapes : GREEN_DRAGONBORN_BREATH_SHAPES;

  // Resolve the selected comparison packet and publish the exact native result.
  const handleResistance = () => {
    const nextScenario = resolveGreenDragonbornResistance(scenario, scenario.damageType);
    setScenario(nextScenario);
    onScenarioEvent(`Green Dragonborn RESISTANCE ${scenario.damageType.toUpperCase()}: ${nextScenario.outcome}`);
  };

  // Replace one Attack action with the native racial ability and publish its
  // deterministic save, damage, resource, and action receipt.
  const handleBreath = () => {
    const nextScenario = resolveGreenDragonbornBreath(
      scenario,
      scenario.breathShape,
      scenario.saveOutcome,
    );
    setScenario(nextScenario);
    onScenarioEvent(`Green Dragonborn BREATH ${scenario.breathShape.toUpperCase()}: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="green-dragonborn-race-title" data-testid="green-dragonborn-race-leaf">
      {/* The heading identifies the canonical racial transactions for assistive tools. */}
      <h4 id="green-dragonborn-race-title">Green Dragonborn Resistance and Breath Weapon</h4>
      <p data-testid="green-dragonborn-canonical-traits">
        Canonical: Poison resistance; Breath Weapon {canonical?.breath.damageDice ?? 'unknown'} {canonical?.breath.damageType ?? 'unknown'}; Constitution save; 15-foot cone or 30-foot line; scales to {canonical?.breath.scaling.find(scale => scale.level === 5)?.dice ?? 'unknown'} at level 5; Darkvision {canonical?.darkvisionFeet ?? 'unknown'} feet; Draconic Flight at level 5.
      </p>

      {/* This selector changes only the comparison packet; native mitigation remains authoritative. */}
      <label htmlFor="green-dragonborn-resistance-type">Resistance packet</label>
      <select
        id="green-dragonborn-resistance-type"
        value={scenario.damageType}
        onChange={event => setScenario(current => ({
          ...current,
          damageType: event.target.value as GreenDragonbornDamageType,
        }))}
      >
        <option value="poison">Poison (canonical resistance)</option>
        <option value="acid">Acid (non-poison comparison)</option>
      </select>
      <Button type="button" onClick={handleResistance}>Resolve native resistance</Button>

      {/* These controls expose the two canonical shapes and deterministic save branches. */}
      <label htmlFor={GREEN_DRAGONBORN_SHAPE_CONTROL_ID}>Breath shape</label>
      <select
        id={GREEN_DRAGONBORN_SHAPE_CONTROL_ID}
        value={scenario.breathShape}
        onChange={event => setScenario(current => ({
          ...current,
          breathShape: event.target.value as GreenDragonbornBreathShape,
        }))}
      >
        {shapes.map(option => (
          <option key={option.shape} value={option.shape}>{option.sizeFeet}-foot {option.shape}</option>
        ))}
      </select>
      <label htmlFor={GREEN_DRAGONBORN_SAVE_CONTROL_ID}>Deterministic save branch</label>
      <select
        id={GREEN_DRAGONBORN_SAVE_CONTROL_ID}
        value={scenario.saveOutcome}
        onChange={event => setScenario(current => ({
          ...current,
          saveOutcome: event.target.value as GreenDragonbornSaveOutcome,
        }))}
      >
        <option value="failed">Failed save (full damage)</option>
        <option value="successful">Successful save (half damage)</option>
      </select>
      <Button type="button" onClick={handleBreath}>Use native Breath Weapon</Button>

      {/* These facts expose production actor state and mutable native resources. */}
      <p data-testid="green-dragonborn-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; Poison resistance: {scenario.actor?.resistances?.join(', ') || 'none'}; Action {scenario.actor?.actionEconomy.action.remaining ?? 'unknown'} remaining; Breath uses {resource?.current ?? 'unknown'}/{resource?.max ?? 'unknown'}; Native ability {breathAbility?.id ?? 'missing'}; Target HP {scenario.target?.currentHP ?? 'unknown'}/{scenario.target?.maxHP ?? 'unknown'}.
      </p>
      <p data-testid="green-dragonborn-resistance-result">
        Resistance packet: {scenario.damageType}; Raw {GREEN_DRAGONBORN_RESISTANCE_DAMAGE}; Final {scenario.resistanceFinalDamage ?? 'not resolved'}.
      </p>
      <p data-testid="green-dragonborn-breath-result">
        Breath packet: {scenario.breathShape}; Save {scenario.breathSaveTotal ?? 'not resolved'}; Raw {scenario.breathRawDamage ?? 'not resolved'}; Final {scenario.breathFinalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="green-dragonborn-outcome">{scenario.outcome}</p>

      {/* This boundary prevents canonical facts from being mistaken for unexecuted runtime mechanics. */}
      <p data-testid="green-dragonborn-boundary">
        Boundary: the canonical Breath Weapon shape choice, Attack action replacement, save, resource, resistance, and HP transaction run here; map AoE placement, native sense integration, and Draconic Flight runtime remain deferred, and Breath Weapon is a race feature rather than a spell.
      </p>
    </section>
  );
};

// Remounting on parent resetCount restores actor, target HP, action, resource,
// selected result, and visible outcome to the production baseline together.
export const GreenDragonbornRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <GreenDragonbornRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery consumes this exact named export without a central list.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'green-dragonborn-resistance-breath',
  raceId: 'green_dragonborn',
  label: 'Green Dragonborn Resistance and Breath Weapon',
  description: 'Resolve canonical poison resistance and Breath Weapon through native combat helpers.',
  Component: GreenDragonbornRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
