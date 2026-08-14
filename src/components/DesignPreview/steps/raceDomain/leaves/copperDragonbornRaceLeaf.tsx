// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This leaf is intentionally self-contained so automatic Race domain discovery
 * can register Copper Dragonborn without coupling one race's proof to another.
 */
// @dependencies-end

import React, { useState } from 'react';
import { buildRacialTraitLibrary } from '../../../../../data/races';
import type { RacialBreathWeapon, RacialFeatureTrait } from '../../../../../data/races/racialTraits';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { calculateSaveDamage, rollSavingThrow } from '../../../../../utils/character/savingThrowUtils';
import { calculateDamage, createPlayerCombatCharacter, rollDice } from '../../../../../utils/combat/combatUtils';
import { canAffordActionCost, consumeActionCost, resetEconomy } from '../../../../../utils/combat/actionEconomyUtils';
import { createQuickCharacter, createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { Ability, CombatCharacter } from '../../../../../types/combat';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file demonstrates the canonical Copper Dragonborn acid resistance and
 * Breath Weapon in the Tactical Sandbox Race domain.
 *
 * The actor begins with production quick-character assembly, receives only the
 * canonical Copper Dragonborn parser projection, and then uses native combat,
 * saving-throw, dice, damage, and action-economy helpers. The shape selector
 * reports the authored choice but does not claim map targeting or placement.
 * Draconic Flight is displayed as an unsupported boundary because this leaf has
 * no native flight bridge to execute or verify.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Copper Dragonborn data, racial trait parsing, quick
 * character assembly, and native combat/save utilities.
 */

// ============================================================================
// Canonical Facts And Stable Controls
// ============================================================================
// These identifiers make the deterministic preview controls and focused tests
// stable while the rule values remain sourced from the canonical trait rows.
// ============================================================================

export const COPPER_DRAGONBORN_RESISTANCE_CONTROL_ID = 'resolve-copper-dragonborn-resistance';
export const COPPER_DRAGONBORN_BREATH_CONTROL_ID = 'resolve-copper-dragonborn-breath';
export const COPPER_DRAGONBORN_SHAPE_CONTROL_ID = 'copper-dragonborn-breath-shape';
export const COPPER_DRAGONBORN_SAVE_CONTROL_ID = 'copper-dragonborn-save-outcome';
export const COPPER_DRAGONBORN_ACTOR_ID = 'copper-dragonborn-race-actor';
export const COPPER_DRAGONBORN_TARGET_ID = 'copper-dragonborn-breath-target';
export const COPPER_DRAGONBORN_RESISTANCE_DAMAGE = 15;
export const COPPER_DRAGONBORN_BREATH_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'copper_dragonborn__breath_weapon__resource',
);

export type CopperDragonbornDamageType = 'acid' | 'fire';
export type CopperDragonbornBreathShape = 'cone' | 'line';
export type CopperDragonbornSaveOutcome = 'failed' | 'successful';

export interface CopperDragonbornBreathShapeOption {
  shape: CopperDragonbornBreathShape;
  sizeFeet: number;
}

export const COPPER_DRAGONBORN_BREATH_SHAPES: readonly CopperDragonbornBreathShapeOption[] = [
  { shape: 'cone', sizeFeet: 15 },
  { shape: 'line', sizeFeet: 30 },
];

export interface ParsedCopperDragonbornTraits {
  resistance: string[];
  breath: RacialBreathWeapon;
  breathTrait: RacialFeatureTrait;
  breathShapes: readonly CopperDragonbornBreathShapeOption[];
}

// ============================================================================
// Canonical Trait Projection
// ============================================================================
// Copper Dragonborn's authored rows contain display links around rule words.
// This narrow adapter removes only those links before the existing production
// parser sees the row; it does not duplicate or invent a racial mechanic.
// ============================================================================

export function parseCanonicalCopperDragonbornBreath(
  traitText: string,
): RacialBreathWeapon | null {
  // Read the authored shape, save ability, base dice, and damage type from the
  // same trait sentence that the player sees in the canonical race data.
  const areaMatches = [...traitText.matchAll(/(\d+)-foot\s+(cone|line)/gi)];
  const saveMatch = traitText.match(/\b(Dexterity|Constitution)\b\s+(?:modifier|saving throw)/i);
  const damageDiceMatch = traitText.match(/(\d+d\d+)\s+damage/i);
  const damageTypeMatch = traitText.match(/exhalation of\s+([a-z]+)\s+damage/i);
  if (!areaMatches.length || !saveMatch || !damageDiceMatch || !damageTypeMatch) return null;

  // Return the same normalized shape consumed by the native racial ability
  // bridge, leaving level scaling to the canonical adapter below.
  return {
    areaShape: areaMatches[0][2].toLowerCase() as 'cone' | 'line',
    areaSize: Number(areaMatches[0][1]),
    saveAbility: saveMatch[1] as RacialBreathWeapon['saveAbility'],
    damageDice: damageDiceMatch[1],
    damageType: damageTypeMatch[1],
    scaling: [],
  };
}

/** Return the exact canonical Copper Dragonborn trait with the requested name. */
export function getCanonicalCopperDragonbornTrait(race: Race, traitName: string): string | null {
  // Trait names are the stable prefix used by the shared racial library.
  return race.traits.find(trait => trait.trim().toLowerCase().startsWith(`${traitName.toLowerCase()}:`)) ?? null;
}

function createParserReadyCopperDragonbornRace(race: Race): Race {
  // Preserve every canonical word while removing display-only [[link|label]]
  // wrappers that otherwise prevent the shared parser from recognizing terms.
  return {
    ...race,
    traits: race.traits.map(trait => trait.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')),
  };
}

export function getCanonicalCopperDragonbornTraits(race: Race): ParsedCopperDragonbornTraits | null {
  // Ask the production racial trait library for resistance and Breath Weapon,
  // then use the authored sentence only to recover its second shape and scaling.
  const parserReadyRace = createParserReadyCopperDragonbornRace(race);
  const parsedTraits = buildRacialTraitLibrary({ [race.id]: parserReadyRace }).byRaceId[race.id] ?? [];
  const breathText = getCanonicalCopperDragonbornTrait(race, 'Breath Weapon') ?? '';
  const normalizedBreathText = breathText.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  const breathTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => trait.type !== 'spell' && trait.traitName === 'Breath Weapon',
  );
  const breath = breathTrait?.modifierBuckets?.breathWeapon ?? parseCanonicalCopperDragonbornBreath(normalizedBreathText);
  const resistanceTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => trait.type !== 'spell' && trait.traitName === 'Damage Resistance',
  );
  if (!breathTrait || !breath || !resistanceTrait) return null;

  // Expose both authored area choices without changing the native ability's
  // production representation of the first shape.
  const breathShapes = [...breathText.matchAll(/(\d+)-foot\s+(cone|line)/gi)]
    .map(match => ({
      shape: match[2].toLowerCase() as CopperDragonbornBreathShape,
      sizeFeet: Number(match[1]),
    }))
    .filter((option, index, options) => options.findIndex(candidate => (
      candidate.shape === option.shape && candidate.sizeFeet === option.sizeFeet
    )) === index);

  // The shared parser handles one level increment at a time, while this row
  // states all cumulative milestones. Expand the authored increments for the
  // native actor bridge so level 5 uses 2d10 and later levels stay traceable.
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

  // Prefer the production parser's defensive bucket, with a narrowly scoped
  // text fallback for this linked corpus if that bucket is empty.
  const resistanceText = getCanonicalCopperDragonbornTrait(race, 'Damage Resistance') ?? '';
  const resistanceMatch = resistanceText
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .match(/resistance\s+to\s+([a-z]+)\s+damage/i);
  return {
    resistance: resistanceTrait.defensiveTraits?.resistances?.length
      ? resistanceTrait.defensiveTraits.resistances
      : resistanceMatch?.[1] ? [resistanceMatch[1].replace(/^./, character => character.toUpperCase())] : [],
    breath,
    breathTrait,
    breathShapes: breathShapes.length ? breathShapes : COPPER_DRAGONBORN_BREATH_SHAPES,
  };
}

/** Confirm that this leaf has every canonical rule needed for its transaction. */
export function hasCanonicalCopperDragonbornRules(race: Race): boolean {
  // Refuse to claim a usable leaf if canonical identity, parser output, or the
  // native resource definition is incomplete.
  const parsed = getCanonicalCopperDragonbornTraits(race);
  const resistanceText = getCanonicalCopperDragonbornTrait(race, 'Damage Resistance');
  const breathText = getCanonicalCopperDragonbornTrait(race, 'Breath Weapon');
  return race.id === 'copper_dragonborn'
    && !!parsed
    && resistanceText?.toLowerCase().includes('acid') === true
    && parsed.resistance.some(type => type.toLowerCase() === 'acid')
    && parsed.breath.saveAbility === 'Constitution'
    && parsed.breath.damageDice === '1d10'
    && parsed.breath.damageType.toLowerCase() === 'acid'
    && parsed.breath.scaling.some(scale => scale.level === 5 && scale.dice === '2d10')
    && parsed.breathTrait.resources?.some(resource => (
      resource.id === 'copper_dragonborn__breath_weapon__resource'
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
// The scenario uses a real quick character and the player-to-combat bridge.
// Only the linked-text parser boundary is adapted; all execution remains in
// the production actor and native resolver chain.
// ============================================================================

export interface CopperDragonbornScenarioState {
  race: Race;
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  damageType: CopperDragonbornDamageType;
  breathShape: CopperDragonbornBreathShape;
  saveOutcome: CopperDragonbornSaveOutcome;
  resistanceFinalDamage: number | null;
  breathRawDamage: number | null;
  breathFinalDamage: number | null;
  breathSaveTotal: number | null;
  outcome: string;
}

function createBreathTarget(): CombatCharacter | null {
  // Create the comparison creature through the normal quick combat factory so
  // HP, abilities, and saving-throw inputs have production shapes.
  const target = createQuickCombatCharacter({
    name: 'Breath Weapon Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 12, 10, 10, 10],
  });
  return target ? { ...target, id: COPPER_DRAGONBORN_TARGET_ID, team: 'enemy' } : null;
}

function createCopperDragonbornActor(race: Race): {
  actor: CombatCharacter | null;
  assembledCharacter: PlayerCharacter | null;
  outcome: string;
} {
  // Start from the production quick-character fixture at level 5 so scaling,
  // proficiency bonus, and Constitution-based save DC are native values.
  const quickCharacter = createQuickCharacter({
    name: 'Copper Dragonborn - Race Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 14, 10, 10, 10],
  });
  const canonicalTraits = getCanonicalCopperDragonbornTraits(race);
  if (!quickCharacter || !canonicalTraits || !hasCanonicalCopperDragonbornRules(race)) {
    return {
      actor: null,
      assembledCharacter: quickCharacter,
      outcome: 'Copper Dragonborn unavailable: canonical traits or production assembly is incomplete.',
    };
  }

  // Use the same racial spell/resource assembly entry point as character
  // creation, with only display links normalized for this canonical row.
  const parserAssembledCharacter = applyRacialSpellGrantsByLevel(
    {
      ...quickCharacter,
      race: createParserReadyCopperDragonbornRace(race),
    },
    quickCharacter.level ?? 1,
  );
  const resourceDefinition = canonicalTraits.breathTrait.resources?.find(resource => (
    resource.id === 'copper_dragonborn__breath_weapon__resource'
  ));
  if (!resourceDefinition) {
    return {
      actor: null,
      assembledCharacter: parserAssembledCharacter,
      outcome: 'Copper Dragonborn unavailable: the canonical Breath Weapon resource was not assembled.',
    };
  }

  // DEBT: Shared assembly currently reads the globally cached linked-text Race
  // row, so this narrow adapter re-applies only parsed resistance, resource,
  // and breath facts. The durable fix is shared link normalization in the
  // racial library; the combat bridge remains authoritative here.
  const resourceMax = typeof resourceDefinition.maxUses === 'number'
    ? resourceDefinition.maxUses
    : parserAssembledCharacter.proficiencyBonus ?? 2;
  const assembledCharacter: PlayerCharacter = {
    ...parserAssembledCharacter,
    race: createParserReadyCopperDragonbornRace(race),
    resistances: Array.from(new Set([...(parserAssembledCharacter.resistances ?? []), ...canonicalTraits.resistance])),
    limitedUses: {
      ...(parserAssembledCharacter.limitedUses ?? {}),
      [COPPER_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
  const breathAbility = generatedActor.abilities.find(ability => ability.id === 'racial_breath_weapon');
  if (!breathAbility) {
    return {
      actor: null,
      assembledCharacter,
      outcome: 'Copper Dragonborn unavailable: the native combat bridge did not expose Breath Weapon.',
    };
  }

  // DEBT: The bridge does not preserve this racial limited-use entry on every
  // path. Carry the parser-produced value across this boundary so the preview
  // spends the same PB-scaled long-rest resource that assembly created.
  const actor = resetEconomy({
    ...generatedActor,
    id: COPPER_DRAGONBORN_ACTOR_ID,
    name: `${race.name} - Race Tester`,
    position: { x: 2, y: 2 },
    limitedUses: {
      [COPPER_DRAGONBORN_BREATH_RESOURCE_ID]: {
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

/** Build the deterministic baseline used by the preview and focused tests. */
export function createCopperDragonbornScenario(race: Race): CopperDragonbornScenarioState {
  // Reassemble actor, target, action, resource, and result state from one clean
  // production baseline whenever the parent changes resetCount.
  const assembled = createCopperDragonbornActor(race);
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
// The public combat damage calculator delegates mitigation to the native
// resistance implementation, making the 15-to-7 acid proof observable.
// ============================================================================

export function resolveCopperDragonbornResistance(
  scenario: CopperDragonbornScenarioState,
  damageType: CopperDragonbornDamageType,
): CopperDragonbornScenarioState {
  // A missing production actor is a hard boundary rather than permission to
  // report a fabricated resistance result.
  if (!scenario.actor) return { ...scenario, outcome: 'Resistance rejected: production actor is unavailable.' };
  const finalDamage = calculateDamage(
    COPPER_DRAGONBORN_RESISTANCE_DAMAGE,
    null,
    scenario.actor,
    damageType,
  );
  const resisted = finalDamage < COPPER_DRAGONBORN_RESISTANCE_DAMAGE;
  return {
    ...scenario,
    damageType,
    resistanceFinalDamage: finalDamage,
    outcome: `Native resistance resolved: ${damageType} raw ${COPPER_DRAGONBORN_RESISTANCE_DAMAGE}, final ${finalDamage} (${resisted ? 'resistance applied' : 'non-acid comparison unchanged'}).`,
  };
}

// ============================================================================
// Native Breath Weapon Transaction
// ============================================================================
// This transaction uses the native racial ability, action economy, saving
// throw, dice, save-half, damage, resource, and HP paths. It does not claim
// that a map target resolver selected creatures inside the authored shape.
// ============================================================================

function getBreathAbility(actor: CombatCharacter): Ability | undefined {
  // The ability must come from the player-to-combat bridge, not a local fixture.
  return actor.abilities.find(ability => ability.id === 'racial_breath_weapon');
}

function getSaveRollFace(outcome: CopperDragonbornSaveOutcome): number {
  // Deterministic controls choose the extreme d20 face while native modifiers
  // and DC calculation still run through rollSavingThrow.
  return outcome === 'failed' ? 1 : 20;
}

export function resolveCopperDragonbornBreath(
  scenario: CopperDragonbornScenarioState,
  breathShape: CopperDragonbornBreathShape,
  saveOutcome: CopperDragonbornSaveOutcome,
): CopperDragonbornScenarioState {
  // Resolve all production prerequisites before changing action, resource, or
  // HP state so rejected transactions remain atomic and repeatable in tests.
  const actor = scenario.actor;
  const target = scenario.target;
  const ability = actor ? getBreathAbility(actor) : undefined;
  const canonicalShapes = getCanonicalCopperDragonbornTraits(scenario.race)?.breathShapes ?? COPPER_DRAGONBORN_BREATH_SHAPES;
  const selectedShape = canonicalShapes.find(option => option.shape === breathShape);
  const resource = actor?.limitedUses?.[COPPER_DRAGONBORN_BREATH_RESOURCE_ID];
  if (!actor || !target || !ability || !selectedShape) {
    return { ...scenario, breathShape, saveOutcome, outcome: 'Breath Weapon rejected atomically: canonical actor, target, ability, or shape is unavailable.' };
  }
  if (!canAffordActionCost(actor, { type: 'action' })) {
    return { ...scenario, breathShape, saveOutcome, outcome: 'Breath Weapon rejected atomically: Attack action replacement is unavailable.' };
  }
  if (!resource || resource.current <= 0) {
    return { ...scenario, breathShape, saveOutcome, outcome: 'Breath Weapon rejected atomically: no PB-scaled long-rest use remains.' };
  }

  // Read save and damage metadata from the native racial ability assembled at
  // level 5; the expected 2d10 and DC 13 therefore come from production data.
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

  // Pay action and resource only after every native calculation succeeds, then
  // apply the resolved damage to the normal combat target HP field.
  const paidActor = consumeActionCost(actor, { type: 'action' });
  const nextActor: CombatCharacter = {
    ...paidActor,
    limitedUses: {
      ...(paidActor.limitedUses ?? {}),
      [COPPER_DRAGONBORN_BREATH_RESOURCE_ID]: { ...resource, current: resource.current - 1 },
    },
  };
  const nextTarget = { ...target, currentHP: Math.max(0, target.currentHP - finalDamage) };
  return {
    ...scenario,
    actor: nextActor,
    target: nextTarget,
    breathShape,
    saveOutcome,
    breathRawDamage: rawDamage,
    breathFinalDamage: finalDamage,
    breathSaveTotal: saveResult.total,
    outcome: `Native Breath Weapon resolved: ${selectedShape.sizeFeet}-foot ${breathShape}; Attack action replaced; DC ${saveDC} Constitution save ${saveResult.success ? 'successful' : 'failed'} (${saveResult.total}); ${damageDice} rolled ${rawDamage}, final ${finalDamage}; use ${nextActor.limitedUses?.[COPPER_DRAGONBORN_BREATH_RESOURCE_ID]?.current}/${resource.max}. AoE placement not claimed.`,
  };
}

// ============================================================================
// Copper Dragonborn Leaf UI
// ============================================================================
// The compact surface exposes canonical facts, native mutable state, both
// transactions, event logging, keyed reset behavior, and unsupported edges.
// ============================================================================

const CopperDragonbornRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, onScenarioEvent }) => {
  // Keyed parent remounting below makes this local scenario state reset cleanly.
  const [scenario, setScenario] = useState<CopperDragonbornScenarioState>(() => createCopperDragonbornScenario(race));
  const canonical = getCanonicalCopperDragonbornTraits(race);
  const actorResource = scenario.actor?.limitedUses?.[COPPER_DRAGONBORN_BREATH_RESOURCE_ID];
  const breathAbility = scenario.actor ? getBreathAbility(scenario.actor) : undefined;

  // Resolve the selected resistance packet and publish the exact native result.
  const handleResistance = () => {
    const nextScenario = resolveCopperDragonbornResistance(scenario, scenario.damageType);
    setScenario(nextScenario);
    onScenarioEvent(`Copper Dragonborn RESISTANCE ${scenario.damageType.toUpperCase()}: ${nextScenario.outcome}`);
  };

  // Replace one Attack action with the native racial ability and publish its
  // deterministic save, damage, action, resource, and HP outcome.
  const handleBreath = () => {
    const nextScenario = resolveCopperDragonbornBreath(scenario, scenario.breathShape, scenario.saveOutcome);
    setScenario(nextScenario);
    onScenarioEvent(`Copper Dragonborn BREATH ${scenario.breathShape.toUpperCase()}: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="copper-dragonborn-race-title" data-testid="copper-dragonborn-race-leaf">
      {/* The heading identifies the canonical racial transaction for assistive tools. */}
      <h4 id="copper-dragonborn-race-title">Copper Dragonborn Resistance and Breath Weapon</h4>
      <p data-testid="copper-dragonborn-canonical-traits">
        Canonical: Acid resistance; Breath Weapon {canonical?.breath.damageDice ?? 'unknown'} {canonical?.breath.damageType ?? 'unknown'}; Constitution save; 15-foot cone or 30-foot line; scales to 2d10 at level 5.
      </p>

      {/* The comparison selector changes only damage type; native mitigation remains authoritative. */}
      <label htmlFor={COPPER_DRAGONBORN_RESISTANCE_CONTROL_ID}>Resistance packet</label>
      <select
        id={COPPER_DRAGONBORN_RESISTANCE_CONTROL_ID}
        value={scenario.damageType}
        onChange={event => setScenario(current => ({ ...current, damageType: event.target.value as CopperDragonbornDamageType }))}
      >
        <option value="acid">Acid (canonical resistance)</option>
        <option value="fire">Fire (non-acid comparison)</option>
      </select>
      <Button type="button" onClick={handleResistance}>Resolve native resistance</Button>

      {/* These selectors expose the authored shape choice and deterministic save branch. */}
      <label htmlFor={COPPER_DRAGONBORN_SHAPE_CONTROL_ID}>Breath shape</label>
      <select
        id={COPPER_DRAGONBORN_SHAPE_CONTROL_ID}
        value={scenario.breathShape}
        onChange={event => setScenario(current => ({ ...current, breathShape: event.target.value as CopperDragonbornBreathShape }))}
      >
        {COPPER_DRAGONBORN_BREATH_SHAPES.map(option => (
          <option key={option.shape} value={option.shape}>{option.sizeFeet}-foot {option.shape}</option>
        ))}
      </select>
      <label htmlFor={COPPER_DRAGONBORN_SAVE_CONTROL_ID}>Deterministic save branch</label>
      <select
        id={COPPER_DRAGONBORN_SAVE_CONTROL_ID}
        value={scenario.saveOutcome}
        onChange={event => setScenario(current => ({ ...current, saveOutcome: event.target.value as CopperDragonbornSaveOutcome }))}
      >
        <option value="failed">Failed save (full damage)</option>
        <option value="successful">Successful save (half damage)</option>
      </select>
      <Button type="button" onClick={handleBreath}>Use native Breath Weapon</Button>

      {/* These facts prove the native actor, action economy, resource, and ability are visible. */}
      <p data-testid="copper-dragonborn-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; Acid resistance: {scenario.actor?.resistances?.join(', ') || 'none'}; Action {scenario.actor?.actionEconomy.action.remaining ?? 'unknown'} remaining; Breath uses {actorResource?.current ?? 'unknown'}/{actorResource?.max ?? 'unknown'}; Native ability {breathAbility?.id ?? 'missing'}.
      </p>
      <p data-testid="copper-dragonborn-resistance-result">
        Resistance packet: {scenario.damageType}; Raw {COPPER_DRAGONBORN_RESISTANCE_DAMAGE}; Final {scenario.resistanceFinalDamage ?? 'not resolved'}.
      </p>
      <p data-testid="copper-dragonborn-breath-result">
        Breath packet: {scenario.breathShape}; Save {scenario.breathSaveTotal ?? 'not resolved'}; Raw {scenario.breathRawDamage ?? 'not resolved'}; Final {scenario.breathFinalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="copper-dragonborn-outcome">{scenario.outcome}</p>

      {/* This boundary prevents the preview from pretending that unsupported geometry or Flight ran. */}
      <p data-testid="copper-dragonborn-boundary">
        Boundary: canonical cone/line choice, Attack action replacement, save, resource, and damage transaction run here; native map AoE targeting/placement is not claimed, Breath Weapon is a race feature rather than a spell, and Draconic Flight is unsupported because no native flight bridge is exposed.
      </p>
    </section>
  );
};

// Parent resetCount remounts this content so action, resource, HP, and results
// return to the deterministic production-assembly baseline.
export const CopperDragonbornRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <CopperDragonbornRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export. The record
// stays local so sibling leaves remain independent registration units.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'copper-dragonborn-resistance-breath',
  raceId: 'copper_dragonborn',
  label: 'Copper Dragonborn Resistance and Breath Weapon',
  description: 'Resolve canonical acid resistance and Breath Weapon through native combat helpers.',
  Component: CopperDragonbornRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
