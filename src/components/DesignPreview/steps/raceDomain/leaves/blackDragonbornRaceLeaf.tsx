// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 13:48:50
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
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../../utils/combat/actionEconomyUtils';
import { createQuickCharacter, createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { Ability, CombatCharacter } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file demonstrates the canonical Black Dragonborn acid resistance and
 * Breath Weapon in the Tactical Sandbox Race domain.
 *
 * The actor starts as a production quick character, receives the canonical
 * racial parser projection, and is converted by the normal player-to-combat
 * bridge. Acid damage, action payment, saving throws, dice, and save damage all
 * use existing native helpers. The line/cone selector reports the canonical
 * shape choice only; this leaf does not claim map targeting or placement.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: the canonical Black Dragonborn Race record, racial trait parser,
 * quick character assembly, and native combat/save utilities.
 */

// ============================================================================
// Canonical Facts And Stable Controls
// ============================================================================
// These identifiers are stable for focused tests and mounted preview proof.
// The rule values themselves are read from canonical trait text or parser data
// so a future data correction cannot silently leave a copied rule behind.
// ============================================================================

export const BLACK_DRAGONBORN_RESISTANCE_CONTROL_ID = 'resolve-black-dragonborn-resistance';
export const BLACK_DRAGONBORN_BREATH_CONTROL_ID = 'resolve-black-dragonborn-breath';
export const BLACK_DRAGONBORN_SHAPE_CONTROL_ID = 'black-dragonborn-breath-shape';
export const BLACK_DRAGONBORN_SAVE_CONTROL_ID = 'black-dragonborn-save-outcome';
export const BLACK_DRAGONBORN_ACTOR_ID = 'black-dragonborn-race-actor';
export const BLACK_DRAGONBORN_TARGET_ID = 'black-dragonborn-breath-target';
export const BLACK_DRAGONBORN_RESISTANCE_DAMAGE = 15;
export const BLACK_DRAGONBORN_BREATH_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'black_dragonborn__breath_weapon__resource',
);

export type BlackDragonbornDamageType = 'acid' | 'fire';
export type BlackDragonbornBreathShape = 'cone' | 'line';
export type BlackDragonbornSaveOutcome = 'failed' | 'successful';

export interface BlackDragonbornBreathShapeOption {
  shape: BlackDragonbornBreathShape;
  sizeFeet: number;
}

export const BLACK_DRAGONBORN_BREATH_SHAPES: readonly BlackDragonbornBreathShapeOption[] = [
  { shape: 'cone', sizeFeet: 15 },
  { shape: 'line', sizeFeet: 30 },
];

export interface ParsedBlackDragonbornTraits {
  resistance: string[];
  breath: RacialBreathWeapon;
  breathTrait: RacialFeatureTrait;
  breathShapes: readonly BlackDragonbornBreathShapeOption[];
}

/** Parse the small linked-text gap left by the shared modifier parser. */
export function parseCanonicalBlackDragonbornBreath(
  traitText: string,
): RacialBreathWeapon | null {
  const areaMatches = [...traitText.matchAll(/(\d+)-foot\s+(cone|line)/gi)];
  // The authored row states the DC formula as a Constitution modifier beside
  // a linked generic Saving Throw label, so accept that canonical wording as
  // the save ability instead of requiring the parser's monster-style phrase.
  const saveMatch = traitText.match(/\b(Dexterity|Constitution)\b\s+(?:modifier|saving throw)/i);
  const damageDiceMatch = traitText.match(/(\d+d\d+)\s+damage/i);
  const damageTypeMatch = traitText.match(/exhalation of\s+([a-z]+)\s+damage/i);
  if (!areaMatches.length || !saveMatch || !damageDiceMatch || !damageTypeMatch) return null;

  return {
    areaShape: areaMatches[0][2].toLowerCase() as 'cone' | 'line',
    areaSize: Number(areaMatches[0][1]),
    saveAbility: saveMatch[1] as RacialBreathWeapon['saveAbility'],
    damageDice: damageDiceMatch[1],
    damageType: damageTypeMatch[1],
    scaling: [],
  };
}

/** Return the exact canonical trait with the requested display name. */
export function getCanonicalBlackDragonbornTrait(
  race: Race,
  traitName: string,
): string | null {
  return race.traits.find(trait => trait.trim().toLowerCase().startsWith(`${traitName.toLowerCase()}:`)) ?? null;
}

/** Remove only display links before sending this canonical row through assembly. */
function createParserReadyBlackDragonbornRace(race: Race): Race {
  return {
    ...race,
    traits: race.traits.map(trait => trait.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')),
  };
}

/**
 * Read Black Dragonborn's parsed resistance and breath metadata from the same
 * racial trait library used by character assembly.
 */
export function getCanonicalBlackDragonbornTraits(
  race: Race,
): ParsedBlackDragonbornTraits | null {
  // Canonical trait links are display markup, not rule words. Strip only that
  // markup before passing the same Race through the production parser; this is
  // the narrow adapter needed for this corpus and does not copy any mechanic.
  const parserReadyRace = createParserReadyBlackDragonbornRace(race);
  const parsedTraits = buildRacialTraitLibrary({ [race.id]: parserReadyRace }).byRaceId[race.id] ?? [];
  const breathText = getCanonicalBlackDragonbornTrait(race, 'Breath Weapon') ?? '';
  const normalizedBreathText = breathText.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  const breathTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => (
      trait.type !== 'spell' && trait.traitName === 'Breath Weapon'
    ),
  );
  const breath = breathTrait?.modifierBuckets?.breathWeapon
    ?? parseCanonicalBlackDragonbornBreath(normalizedBreathText);
  const resistanceTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => (
      trait.type !== 'spell' && trait.traitName === 'Damage Resistance'
    ),
  );

  if (!breathTrait || !breath || !resistanceTrait) return null;

  // The parser intentionally exposes the first authored area shape. This leaf
  // also reads the second shape from that same canonical sentence so the user
  // can choose cone or line without inventing a new rule or spell record.
  const breathShapes = [...breathText.matchAll(/(\d+)-foot\s+(cone|line)/gi)]
    .map(match => ({
      shape: match[2].toLowerCase() as BlackDragonbornBreathShape,
      sizeFeet: Number(match[1]),
    }))
    .filter((option, index, options) => options.findIndex(candidate => (
      candidate.shape === option.shape && candidate.sizeFeet === option.sizeFeet
    )) === index);

  // The shared parser understands singular "at 5th level" rows. Black
  // Dragonborn's canonical text uses the equivalent compact phrase "increases
  // by 1d10 at levels 5, 11, and 17", so this adapter expands that authored
  // increment into the cumulative dice values the native combat bridge uses.
  // The source sentence remains the authority for every derived value.
  const increaseMatch = breathText.match(/damage increases by (\d+)d(\d+)\s+at levels?\s+([^.;]+)/i);
  if (increaseMatch) {
    const incrementDice = Number(increaseMatch[1]);
    const dieSize = Number(increaseMatch[2]);
    const levels = [...increaseMatch[3].matchAll(/\d+/g)].map(match => Number(match[0]));
    const baseMatch = breath.damageDice.match(/(\d+)d(\d+)/i);
    const baseDice = baseMatch ? Number(baseMatch[1]) : 1;
    const baseSides = baseMatch ? Number(baseMatch[2]) : dieSize;
    breath.scaling = levels.map((level, index) => ({
      level,
      dice: `${baseDice + (index + 1) * incrementDice}d${baseSides}`,
    }));
  }

  return {
    resistance: resistanceTrait.defensiveTraits?.resistances?.length
      ? resistanceTrait.defensiveTraits.resistances
      : ((getCanonicalBlackDragonbornTrait(race, 'Damage Resistance') ?? '')
        .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
        .match(/resistance\s+to\s+([a-z]+)\s+damage/i)?.[1]
        ? [((getCanonicalBlackDragonbornTrait(race, 'Damage Resistance') ?? '')
          .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
          .match(/resistance\s+to\s+([a-z]+)\s+damage/i)?.[1] ?? '')
          .replace(/^./, character => character.toUpperCase())]
        : []),
    breath,
    breathTrait,
    breathShapes,
  };
}

/** Confirm that the canonical row contains the complete mechanic this leaf uses. */
export function hasCanonicalBlackDragonbornRules(race: Race): boolean {
  const parsed = getCanonicalBlackDragonbornTraits(race);
  const resistanceText = getCanonicalBlackDragonbornTrait(race, 'Damage Resistance');
  const breathText = getCanonicalBlackDragonbornTrait(race, 'Breath Weapon');

  return race.id === 'black_dragonborn'
    && !!parsed
    && resistanceText?.toLowerCase().includes('acid') === true
    && parsed.resistance.some(type => type.toLowerCase() === 'acid')
    && parsed.breath.saveAbility === 'Constitution'
    && parsed.breath.damageDice === '1d10'
    && parsed.breath.damageType.toLowerCase() === 'acid'
    && parsed.breath.scaling.some(scale => scale.level === 5 && scale.dice === '2d10')
    && parsed.breathTrait.resources?.some(resource => (
      resource.id === 'black_dragonborn__breath_weapon__resource'
      && resource.maxUses === 'proficiency_bonus'
      && resource.resetOn === 'long_rest'
    )) === true
    && /replace one of your attacks/i.test(breathText ?? '')
    && parsed.breathShapes.some(option => option.shape === 'cone' && option.sizeFeet === 15)
    && parsed.breathShapes.some(option => option.shape === 'line' && option.sizeFeet === 30);
}

// ============================================================================
// Production Actor Assembly
// ============================================================================
// The quick character is first assembled through the real racial parser. The
// bridge then exposes the parsed resistance, resource, and racial ability to a
// transient combat actor. This keeps the preview transaction aligned with
// ordinary character construction instead of creating fixture-shaped actors.
// ============================================================================

export interface BlackDragonbornScenarioState {
  race: Race;
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  damageType: BlackDragonbornDamageType;
  breathShape: BlackDragonbornBreathShape;
  saveOutcome: BlackDragonbornSaveOutcome;
  resistanceFinalDamage: number | null;
  breathRawDamage: number | null;
  breathFinalDamage: number | null;
  breathSaveTotal: number | null;
  outcome: string;
}

function createBreathTarget(): CombatCharacter | null {
  // The target is a normal production combat actor, not a hand-authored mock.
  const target = createQuickCombatCharacter({
    name: 'Breath Weapon Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 12, 10, 10, 10],
  });

  return target
    ? { ...target, id: BLACK_DRAGONBORN_TARGET_ID, team: 'enemy' }
    : null;
}

function createBlackDragonbornActor(race: Race): {
  actor: CombatCharacter | null;
  assembledCharacter: PlayerCharacter | null;
  outcome: string;
} {
  const quickCharacter = createQuickCharacter({
    name: 'Black Dragonborn - Race Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 14, 10, 10, 10],
  });
  const canonicalTraits = getCanonicalBlackDragonbornTraits(race);

  // A missing canonical row, parser result, or assembly result is a hard
  // boundary: no actor is allowed to claim a racial mechanic without all three.
  if (!quickCharacter || !canonicalTraits || !hasCanonicalBlackDragonbornRules(race)) {
    return {
      actor: null,
      assembledCharacter: quickCharacter,
      outcome: 'Black Dragonborn unavailable: canonical traits or production assembly is incomplete.',
    };
  }

  const parserAssembledCharacter = applyRacialSpellGrantsByLevel(
    {
      ...quickCharacter,
      // The shared assembly currently reads the global Race library, whose
      // linked-text rows need this same display-only normalization first.
      race: createParserReadyBlackDragonbornRace(race),
    },
    quickCharacter.level ?? 1,
  );
  const resourceDefinition = canonicalTraits.breathTrait.resources?.find(resource => (
    resource.id === 'black_dragonborn__breath_weapon__resource'
  ));

  // The resource comes from the canonical parser and must be present before
  // the leaf exposes a usable Breath Weapon control.
  if (!resourceDefinition) {
    return {
      actor: null,
      assembledCharacter: parserAssembledCharacter,
      outcome: 'Black Dragonborn unavailable: the canonical Breath Weapon resource was not assembled.',
    };
  }

  // DEBT: The shared assembly cache still reads the linked-text version of
  // this Race, so it does not project the canonical resistance, breath
  // modifier, or resource. This narrow adapter copies only the parsed facts
  // above into the already assembled character; the combat bridge and native
  // resolvers remain authoritative for execution. The durable fix is to make
  // the shared racial library normalize display links before caching.
  const resourceMax = typeof resourceDefinition.maxUses === 'number'
    ? resourceDefinition.maxUses
    : parserAssembledCharacter.proficiencyBonus ?? 2;
  const assembledCharacter: PlayerCharacter = {
    ...parserAssembledCharacter,
    race: createParserReadyBlackDragonbornRace(race),
    resistances: Array.from(new Set([
      ...(parserAssembledCharacter.resistances ?? []),
      ...canonicalTraits.resistance,
    ])),
    limitedUses: {
      ...(parserAssembledCharacter.limitedUses ?? {}),
      [BLACK_DRAGONBORN_BREATH_RESOURCE_ID]: {
        name: `${race.name}: Breath Weapon (Breath Weapon usage)`,
        current: resourceMax,
        max: resourceDefinition.maxUses,
        resetOn: resourceDefinition.resetOn,
      },
    },
    modifiers: {
      advantage: [...(parserAssembledCharacter.modifiers?.advantage ?? [])],
      disadvantage: [...(parserAssembledCharacter.modifiers?.disadvantage ?? [])],
      bonuses: [...(parserAssembledCharacter.modifiers?.bonuses ?? [])],
      ...(parserAssembledCharacter.modifiers ?? {}),
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
      outcome: 'Black Dragonborn unavailable: the native combat bridge did not expose Breath Weapon.',
    };
  }

  // The bridge currently does not preserve limitedUses on every combat path.
  // Carry the parser-produced entry across this narrow boundary so the leaf
  // spends the same PB-scaled, long-rest resource that assembly created.
  const actor = resetEconomy({
    ...generatedActor,
    id: BLACK_DRAGONBORN_ACTOR_ID,
    name: `${race.name} - Race Tester`,
    position: { x: 2, y: 2 },
    limitedUses: {
      [BLACK_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
    outcome: `Ready: ${actor.name}; level ${actor.level}; Acid resistance; Breath Weapon ${resourceMax}/${resourceDefinition.maxUses} uses; action ready.`,
  };
}

/** Build the deterministic baseline used by the UI and focused tests. */
export function createBlackDragonbornScenario(
  race: Race,
): BlackDragonbornScenarioState {
  const assembled = createBlackDragonbornActor(race);
  return {
    race,
    actor: assembled.actor,
    target: createBreathTarget(),
    damageType: 'acid',
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
// calculateDamage is the public combat entry point and delegates to the native
// ResistanceCalculator. The comparison packet deliberately changes only the
// damage type, making acid reduction versus non-acid unchanged damage visible.
// ============================================================================

export function resolveBlackDragonbornResistance(
  scenario: BlackDragonbornScenarioState,
  damageType: BlackDragonbornDamageType,
): BlackDragonbornScenarioState {
  if (!scenario.actor) {
    return { ...scenario, outcome: 'Resistance rejected: production actor is unavailable.' };
  }

  const finalDamage = calculateDamage(
    BLACK_DRAGONBORN_RESISTANCE_DAMAGE,
    null,
    scenario.actor,
    damageType,
  );
  const resisted = finalDamage < BLACK_DRAGONBORN_RESISTANCE_DAMAGE;

  return {
    ...scenario,
    damageType,
    resistanceFinalDamage: finalDamage,
    outcome: `Native resistance resolved: ${damageType} raw ${BLACK_DRAGONBORN_RESISTANCE_DAMAGE}, final ${finalDamage} (${resisted ? 'resistance applied' : 'non-acid comparison unchanged'}).`,
  };
}

// ============================================================================
// Native Breath Weapon Transaction
// ============================================================================
// This adapter composes the parser-created native ability with action economy,
// deterministic saving throws, deterministic dice, save-half damage, and the
// normal damage calculator. It intentionally does not call the spell system or
// claim that a map/AoE target resolver selected creatures in a shape.
// ============================================================================

function getBreathAbility(actor: CombatCharacter): Ability | undefined {
  return actor.abilities.find(ability => ability.id === 'racial_breath_weapon');
}

function getSaveRollFace(outcome: BlackDragonbornSaveOutcome): number {
  return outcome === 'failed' ? 1 : 20;
}

export function resolveBlackDragonbornBreath(
  scenario: BlackDragonbornScenarioState,
  breathShape: BlackDragonbornBreathShape,
  saveOutcome: BlackDragonbornSaveOutcome,
): BlackDragonbornScenarioState {
  const actor = scenario.actor;
  const target = scenario.target;
  const ability = actor ? getBreathAbility(actor) : undefined;
  const canonicalShapes = getCanonicalBlackDragonbornTraits(scenario.race)?.breathShapes
    ?? BLACK_DRAGONBORN_BREATH_SHAPES;
  const selectedShape = canonicalShapes.find(option => option.shape === breathShape);
  const resource = actor?.limitedUses?.[BLACK_DRAGONBORN_BREATH_RESOURCE_ID];

  // Every rejection returns the original actor and target references. That
  // makes an unavailable action/resource visibly and testably atomic.
  if (!actor || !target || !ability || !selectedShape) {
    return { ...scenario, breathShape, saveOutcome, outcome: 'Breath Weapon rejected atomically: canonical actor, target, ability, or shape is unavailable.' };
  }
  if (!canAffordActionCost(actor, { type: 'action' })) {
    return { ...scenario, breathShape, saveOutcome, outcome: 'Breath Weapon rejected atomically: Attack action replacement is unavailable.' };
  }
  if (!resource || resource.current <= 0) {
    return { ...scenario, breathShape, saveOutcome, outcome: 'Breath Weapon rejected atomically: no PB-scaled long-rest use remains.' };
  }

  const effect = ability.effects.find(candidate => candidate.type === 'damage');
  const saveDC = ability.saveDC ?? 0;
  const saveAbility = ability.saveAbility ?? 'Constitution';
  const damageDice = effect?.dice ?? '1d10';
  const saveResult = rollSavingThrow(
    target,
    saveAbility,
    saveDC,
    undefined,
    { damageType: 'acid' },
    undefined,
    { rng: () => (getSaveRollFace(saveOutcome) - 1) / 20 },
  );
  const rawDamage = rollDice(damageDice, { rng: () => 0.5 });
  const afterSaveDamage = calculateSaveDamage(rawDamage, saveResult, 'half');
  const finalDamage = calculateDamage(afterSaveDamage, actor, target, 'acid');
  const paidActor = consumeActionCost(actor, { type: 'action' });
  const nextActor: CombatCharacter = {
    ...paidActor,
    limitedUses: {
      ...(paidActor.limitedUses ?? {}),
      [BLACK_DRAGONBORN_BREATH_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
  };
  const nextTarget = {
    ...target,
    currentHP: Math.max(0, target.currentHP - finalDamage),
  };

  return {
    ...scenario,
    actor: nextActor,
    target: nextTarget,
    breathShape,
    saveOutcome,
    breathRawDamage: rawDamage,
    breathFinalDamage: finalDamage,
    breathSaveTotal: saveResult.total,
    outcome: `Native Breath Weapon resolved: ${selectedShape.sizeFeet}-foot ${breathShape}; Attack action replaced; DC ${saveDC} Constitution save ${saveResult.success ? 'successful' : 'failed'} (${saveResult.total}); ${damageDice} rolled ${rawDamage}, final ${finalDamage}; use ${nextActor.limitedUses?.[BLACK_DRAGONBORN_BREATH_RESOURCE_ID]?.current}/${resource.max}. AoE placement not claimed.`,
  };
}

// ============================================================================
// Black Dragonborn Leaf UI
// ============================================================================
// The UI keeps canonical facts, actor/resource state, both native transactions,
// and the explicit AoE boundary visible in one compact scenario surface.
// ============================================================================

const BlackDragonbornRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState<BlackDragonbornScenarioState>(
    () => createBlackDragonbornScenario(race),
  );

  // Re-run the selected native resistance packet and publish its exact result.
  const handleResistance = () => {
    const nextScenario = resolveBlackDragonbornResistance(scenario, scenario.damageType);
    setScenario(nextScenario);
    onScenarioEvent(`Black Dragonborn RESISTANCE ${scenario.damageType.toUpperCase()}: ${nextScenario.outcome}`);
  };

  // Replace one Attack action with the parser-created racial ability and publish
  // the deterministic save/damage result from the native helper chain.
  const handleBreath = () => {
    const nextScenario = resolveBlackDragonbornBreath(
      scenario,
      scenario.breathShape,
      scenario.saveOutcome,
    );
    setScenario(nextScenario);
    onScenarioEvent(`Black Dragonborn BREATH ${scenario.breathShape.toUpperCase()}: ${nextScenario.outcome}`);
  };

  const canonical = getCanonicalBlackDragonbornTraits(race);
  const actorResource = scenario.actor?.limitedUses?.[BLACK_DRAGONBORN_BREATH_RESOURCE_ID];
  const breathAbility = scenario.actor ? getBreathAbility(scenario.actor) : undefined;

  return (
    <section aria-labelledby="black-dragonborn-race-title" data-testid="black-dragonborn-race-leaf">
      {/* The heading names this canonical racial transaction for assistive tools. */}
      <h4 id="black-dragonborn-race-title">Black Dragonborn Resistance and Breath Weapon</h4>
      <p data-testid="black-dragonborn-canonical-traits">
        Canonical: Acid resistance; Breath Weapon {canonical?.breath.damageDice ?? 'unknown'} {canonical?.breath.damageType ?? 'unknown'}; Constitution save; 15-foot cone or 30-foot line; scales to 2d10 at level 5.
      </p>

      {/* The comparison selector changes only the packet type; native mitigation remains authoritative. */}
      <label htmlFor="black-dragonborn-resistance-type">Resistance packet</label>
      <select
        id="black-dragonborn-resistance-type"
        value={scenario.damageType}
        onChange={event => setScenario(current => ({
          ...current,
          damageType: event.target.value as BlackDragonbornDamageType,
        }))}
      >
        <option value="acid">Acid (canonical resistance)</option>
        <option value="fire">Fire (non-acid comparison)</option>
      </select>
      <Button type="button" onClick={handleResistance}>Resolve native resistance</Button>

      {/* These selectors expose the canonical two-shape choice and deterministic save branch. */}
      <label htmlFor={BLACK_DRAGONBORN_SHAPE_CONTROL_ID}>Breath shape</label>
      <select
        id={BLACK_DRAGONBORN_SHAPE_CONTROL_ID}
        value={scenario.breathShape}
        onChange={event => setScenario(current => ({
          ...current,
          breathShape: event.target.value as BlackDragonbornBreathShape,
        }))}
      >
        {BLACK_DRAGONBORN_BREATH_SHAPES.map(option => (
          <option key={option.shape} value={option.shape}>{option.sizeFeet}-foot {option.shape}</option>
        ))}
      </select>
      <label htmlFor={BLACK_DRAGONBORN_SAVE_CONTROL_ID}>Deterministic save branch</label>
      <select
        id={BLACK_DRAGONBORN_SAVE_CONTROL_ID}
        value={scenario.saveOutcome}
        onChange={event => setScenario(current => ({
          ...current,
          saveOutcome: event.target.value as BlackDragonbornSaveOutcome,
        }))}
      >
        <option value="failed">Failed save (full damage)</option>
        <option value="successful">Successful save (half damage)</option>
      </select>
      <Button type="button" onClick={handleBreath}>Use native Breath Weapon</Button>

      {/* These facts prove real actor values and mutable resource/action state. */}
      <p data-testid="black-dragonborn-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; Acid resistance: {scenario.actor?.resistances?.join(', ') || 'none'}; Action {scenario.actor?.actionEconomy.action.remaining ?? 'unknown'} remaining; Breath uses {actorResource?.current ?? 'unknown'}/{actorResource?.max ?? 'unknown'}; Native ability {breathAbility?.id ?? 'missing'}.
      </p>
      <p data-testid="black-dragonborn-resistance-result">
        Resistance packet: {scenario.damageType}; Raw {BLACK_DRAGONBORN_RESISTANCE_DAMAGE}; Final {scenario.resistanceFinalDamage ?? 'not resolved'}.
      </p>
      <p data-testid="black-dragonborn-breath-result">
        Breath packet: {scenario.breathShape}; Save {scenario.breathSaveTotal ?? 'not resolved'}; Raw {scenario.breathRawDamage ?? 'not resolved'}; Final {scenario.breathFinalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="black-dragonborn-outcome">{scenario.outcome}</p>

      {/* This is the honest boundary around shape geometry and native combat integration. */}
      <p data-testid="black-dragonborn-boundary">
        Boundary: the canonical cone/line choice, Attack action replacement, save, resource, and damage transaction run here; native map AoE targeting/placement is not claimed, and Breath Weapon is a race feature rather than a spell.
      </p>
    </section>
  );
};

// Parent resetCount remounts this content so action, resource, HP, and result
// state return to the deterministic production-assembly baseline.
export const BlackDragonbornRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <BlackDragonbornRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping
// the record local avoids central registry conflicts with other Race workers.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'black-dragonborn-resistance-breath',
  raceId: 'black_dragonborn',
  label: 'Black Dragonborn Resistance and Breath Weapon',
  description: 'Resolve canonical acid resistance and Breath Weapon through native combat helpers.',
  Component: BlackDragonbornRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
