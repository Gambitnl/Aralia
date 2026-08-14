// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 14:00:04
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
 * This file demonstrates the canonical Blue Dragonborn lightning resistance
 * and Breath Weapon in the Tactical Sandbox Race domain.
 *
 * The actor begins as a production quick character, receives a Blue-specific
 * projection of the canonical racial parser output, and then crosses the
 * normal player-to-combat bridge. Native damage, save, dice, action, and
 * resource helpers execute the tested transaction. The cone/line selector
 * reports the canonical shape choice but does not claim map placement.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: ACTIVE_RACES Blue Dragonborn data, the racial trait parser,
 * quick character assembly, and native combat/save utilities.
 */

// ============================================================================
// Canonical Facts And Stable Controls
// ============================================================================
// These identifiers keep focused tests and mounted proof deterministic. Rule
// values are read from the Blue Dragonborn row or parser whenever possible so
// the preview cannot silently drift from canonical data.
// ============================================================================

export const BLUE_DRAGONBORN_RESISTANCE_CONTROL_ID = 'resolve-blue-dragonborn-resistance';
export const BLUE_DRAGONBORN_BREATH_CONTROL_ID = 'resolve-blue-dragonborn-breath';
export const BLUE_DRAGONBORN_SHAPE_CONTROL_ID = 'blue-dragonborn-breath-shape';
export const BLUE_DRAGONBORN_SAVE_CONTROL_ID = 'blue-dragonborn-save-outcome';
export const BLUE_DRAGONBORN_ACTOR_ID = 'blue-dragonborn-race-actor';
export const BLUE_DRAGONBORN_TARGET_ID = 'blue-dragonborn-breath-target';
export const BLUE_DRAGONBORN_RESISTANCE_DAMAGE = 15;
export const BLUE_DRAGONBORN_BREATH_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'blue_dragonborn__breath_weapon__resource',
);

export type BlueDragonbornDamageType = 'lightning' | 'fire';
export type BlueDragonbornBreathShape = 'cone' | 'line';
export type BlueDragonbornSaveOutcome = 'failed' | 'successful';

export interface BlueDragonbornBreathShapeOption {
  shape: BlueDragonbornBreathShape;
  sizeFeet: number;
}

export const BLUE_DRAGONBORN_BREATH_SHAPES: readonly BlueDragonbornBreathShapeOption[] = [
  { shape: 'cone', sizeFeet: 15 },
  { shape: 'line', sizeFeet: 30 },
];

export interface ParsedBlueDragonbornTraits {
  resistance: string[];
  breath: RacialBreathWeapon;
  breathTrait: RacialFeatureTrait;
  breathShapes: readonly BlueDragonbornBreathShapeOption[];
}

// The authored Blue row uses linked display terms, while the parser expects
// ordinary rule words. This parser keeps the canonical row authoritative and
// only fills the small linked-text gap that the shared parser cannot consume.
export function parseCanonicalBlueDragonbornBreath(
  traitText: string,
): RacialBreathWeapon | null {
  const areaMatches = [...traitText.matchAll(/(\d+)-foot\s+(cone|line)/gi)];
  const saveMatch = traitText.match(/\b(Dexterity|Constitution)\b\s+(?:modifier|saving throw)/i);
  const damageDiceMatch = traitText.match(/(\d+d\d+)\s+damage/i);
  const damageTypeMatch = traitText.match(/exhalation of\s+([a-z]+)\s+damage/i);
  if (!areaMatches.length || !saveMatch || !damageDiceMatch || !damageTypeMatch) return null;

  // The native combat bridge consumes this compact metadata shape for the
  // racial ability and later applies level scaling from the same source row.
  return {
    areaShape: areaMatches[0][2].toLowerCase() as 'cone' | 'line',
    areaSize: Number(areaMatches[0][1]),
    saveAbility: saveMatch[1] as RacialBreathWeapon['saveAbility'],
    damageDice: damageDiceMatch[1],
    damageType: damageTypeMatch[1],
    scaling: [],
  };
}

// Return the exact canonical Blue row with the requested display name.
export function getCanonicalBlueDragonbornTrait(
  race: Race,
  traitName: string,
): string | null {
  return race.traits.find(trait => trait.trim().toLowerCase().startsWith(`${traitName.toLowerCase()}:`)) ?? null;
}

// Strip display links only for the production parser boundary; this does not
// alter the canonical Race object used by the shell or the source-of-truth UI.
function createParserReadyBlueDragonbornRace(race: Race): Race {
  return {
    ...race,
    traits: race.traits.map(trait => trait.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')),
  };
}

// Read resistance, breath, shape, scaling, and resource facts from the Blue
// row through the same racial trait library used by character assembly.
export function getCanonicalBlueDragonbornTraits(
  race: Race,
): ParsedBlueDragonbornTraits | null {
  const parserReadyRace = createParserReadyBlueDragonbornRace(race);
  const parsedTraits = buildRacialTraitLibrary({ [race.id]: parserReadyRace }).byRaceId[race.id] ?? [];
  const breathText = getCanonicalBlueDragonbornTrait(race, 'Breath Weapon') ?? '';
  const normalizedBreathText = breathText.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  const breathTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => trait.type !== 'spell' && trait.traitName === 'Breath Weapon',
  );
  const breath = breathTrait?.modifierBuckets?.breathWeapon
    ?? parseCanonicalBlueDragonbornBreath(normalizedBreathText);
  const resistanceTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => trait.type !== 'spell' && trait.traitName === 'Damage Resistance',
  );

  if (!breathTrait || !breath || !resistanceTrait) return null;

  // Both selectable geometries are read from the authored sentence, not a
  // copied preview constant, so the selector remains tied to Blue data.
  const breathShapes = [...normalizedBreathText.matchAll(/(\d+)-foot\s+(cone|line)/gi)]
    .map(match => ({
      shape: match[2].toLowerCase() as BlueDragonbornBreathShape,
      sizeFeet: Number(match[1]),
    }))
    .filter((option, index, options) => options.findIndex(candidate => (
      candidate.shape === option.shape && candidate.sizeFeet === option.sizeFeet
    )) === index);

  // Expand the authored compact increment into cumulative native dice values.
  const increaseMatch = normalizedBreathText.match(/damage increases by (\d+)d(\d+)\s+at levels?\s+([^.;]+)/i);
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

  const resistanceText = getCanonicalBlueDragonbornTrait(race, 'Damage Resistance') ?? '';
  const fallbackResistance = resistanceText
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .match(/resistance\s+to\s+([a-z]+)\s+damage/i)?.[1];

  return {
    resistance: resistanceTrait.defensiveTraits?.resistances?.length
      ? resistanceTrait.defensiveTraits.resistances
      : fallbackResistance ? [fallbackResistance.replace(/^./, character => character.toUpperCase())] : [],
    breath,
    breathTrait,
    breathShapes,
  };
}

// Confirm the exact Blue mechanic before a usable actor can be exposed.
export function hasCanonicalBlueDragonbornRules(race: Race): boolean {
  const parsed = getCanonicalBlueDragonbornTraits(race);
  const resistanceText = getCanonicalBlueDragonbornTrait(race, 'Damage Resistance');
  const breathText = getCanonicalBlueDragonbornTrait(race, 'Breath Weapon');

  return race.id === 'blue_dragonborn'
    && !!parsed
    && resistanceText?.toLowerCase().includes('lightning') === true
    && parsed.resistance.some(type => type.toLowerCase() === 'lightning')
    && parsed.breath.saveAbility === 'Constitution'
    && parsed.breath.damageDice === '1d10'
    && parsed.breath.damageType.toLowerCase() === 'lightning'
    && parsed.breath.scaling.some(scale => scale.level === 5 && scale.dice === '2d10')
    && parsed.breathTrait.resources?.some(resource => (
      resource.id === 'blue_dragonborn__breath_weapon__resource'
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
// The quick character goes through the real racial assembly and combat bridge.
// A narrow canonical-data adapter is retained only for the linked-text cache
// gap, while combat execution stays in native helpers.
// ============================================================================

export interface BlueDragonbornScenarioState {
  race: Race;
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  damageType: BlueDragonbornDamageType;
  breathShape: BlueDragonbornBreathShape;
  saveOutcome: BlueDragonbornSaveOutcome;
  resistanceFinalDamage: number | null;
  breathRawDamage: number | null;
  breathFinalDamage: number | null;
  breathSaveTotal: number | null;
  outcome: string;
}

// Use a production quick combat actor for the target so the preview does not
// hide missing combat fields behind a hand-authored fixture.
function createBreathTarget(): CombatCharacter | null {
  const target = createQuickCombatCharacter({
    name: 'Blue Breath Weapon Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 12, 10, 10, 10],
  });

  return target ? { ...target, id: BLUE_DRAGONBORN_TARGET_ID, team: 'enemy' } : null;
}

function createBlueDragonbornActor(race: Race): {
  actor: CombatCharacter | null;
  assembledCharacter: PlayerCharacter | null;
  outcome: string;
} {
  const quickCharacter = createQuickCharacter({
    name: 'Blue Dragonborn - Race Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 14, 10, 10, 10],
  });
  const canonicalTraits = getCanonicalBlueDragonbornTraits(race);

  // Missing canonical facts are an honest boundary instead of permission to
  // fabricate a Blue actor with assumed resistance or Breath Weapon rules.
  if (!quickCharacter || !canonicalTraits || !hasCanonicalBlueDragonbornRules(race)) {
    return {
      actor: null,
      assembledCharacter: quickCharacter,
      outcome: 'Blue Dragonborn unavailable: canonical traits or production assembly is incomplete.',
    };
  }

  const parserAssembledCharacter = applyRacialSpellGrantsByLevel(
    {
      ...quickCharacter,
      race: createParserReadyBlueDragonbornRace(race),
    },
    quickCharacter.level ?? 1,
  );
  const resourceDefinition = canonicalTraits.breathTrait.resources?.find(resource => (
    resource.id === 'blue_dragonborn__breath_weapon__resource'
  ));

  if (!resourceDefinition) {
    return {
      actor: null,
      assembledCharacter: parserAssembledCharacter,
      outcome: 'Blue Dragonborn unavailable: the canonical Breath Weapon resource was not assembled.',
    };
  }

  // DEBT: The shared assembly cache still reads linked-text Race rows on one
  // path. This adapter carries only Blue facts already proven by the parser;
  // the native combat bridge and resolvers remain authoritative. The durable
  // fix belongs in shared racial-library normalization, outside this leaf.
  const resourceMax = typeof resourceDefinition.maxUses === 'number'
    ? resourceDefinition.maxUses
    : parserAssembledCharacter.proficiencyBonus ?? 2;
  const assembledCharacter: PlayerCharacter = {
    ...parserAssembledCharacter,
    race: createParserReadyBlueDragonbornRace(race),
    resistances: Array.from(new Set([
      ...(parserAssembledCharacter.resistances ?? []),
      ...canonicalTraits.resistance,
    ])),
    limitedUses: {
      ...(parserAssembledCharacter.limitedUses ?? {}),
      [BLUE_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
      outcome: 'Blue Dragonborn unavailable: the native combat bridge did not expose Breath Weapon.',
    };
  }

  // Carry the parser-produced resource across the known bridge boundary so
  // this leaf spends the same PB-scaled long-rest resource assembly created.
  const actor = resetEconomy({
    ...generatedActor,
    id: BLUE_DRAGONBORN_ACTOR_ID,
    name: `${race.name} - Race Tester`,
    position: { x: 2, y: 2 },
    limitedUses: {
      [BLUE_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
    outcome: `Ready: ${actor.name}; level ${actor.level}; Lightning resistance; Breath Weapon ${resourceMax}/${resourceDefinition.maxUses} uses; action ready.`,
  };
}

// Build the deterministic baseline used by the UI and focused tests.
export function createBlueDragonbornScenario(race: Race): BlueDragonbornScenarioState {
  const assembled = createBlueDragonbornActor(race);
  return {
    race,
    actor: assembled.actor,
    target: createBreathTarget(),
    damageType: 'lightning',
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
// calculateDamage delegates mitigation to the production ResistanceCalculator.
// The fire comparison changes only damage type, making lightning reduction and
// unchanged non-lightning damage visible in the same scenario.
// ============================================================================

export function resolveBlueDragonbornResistance(
  scenario: BlueDragonbornScenarioState,
  damageType: BlueDragonbornDamageType,
): BlueDragonbornScenarioState {
  if (!scenario.actor) {
    return { ...scenario, outcome: 'Resistance rejected: production actor is unavailable.' };
  }

  const finalDamage = calculateDamage(
    BLUE_DRAGONBORN_RESISTANCE_DAMAGE,
    null,
    scenario.actor,
    damageType,
  );
  const resisted = finalDamage < BLUE_DRAGONBORN_RESISTANCE_DAMAGE;

  return {
    ...scenario,
    damageType,
    resistanceFinalDamage: finalDamage,
    outcome: `Native resistance resolved: ${damageType} raw ${BLUE_DRAGONBORN_RESISTANCE_DAMAGE}, final ${finalDamage} (${resisted ? 'resistance applied' : 'non-lightning comparison unchanged'}).`,
  };
}

// ============================================================================
// Native Breath Weapon Transaction
// ============================================================================
// This is a non-spell Attack action replacement. It uses native action cost,
// deterministic saving throw, deterministic dice, save-half damage, and the
// normal damage calculator, while explicitly avoiding map AoE placement claims.
// ============================================================================

function getBreathAbility(actor: CombatCharacter): Ability | undefined {
  return actor.abilities.find(ability => ability.id === 'racial_breath_weapon');
}

function getSaveRollFace(outcome: BlueDragonbornSaveOutcome): number {
  return outcome === 'failed' ? 1 : 20;
}

export function resolveBlueDragonbornBreath(
  scenario: BlueDragonbornScenarioState,
  breathShape: BlueDragonbornBreathShape,
  saveOutcome: BlueDragonbornSaveOutcome,
): BlueDragonbornScenarioState {
  const actor = scenario.actor;
  const target = scenario.target;
  const ability = actor ? getBreathAbility(actor) : undefined;
  const canonicalShapes = getCanonicalBlueDragonbornTraits(scenario.race)?.breathShapes
    ?? BLUE_DRAGONBORN_BREATH_SHAPES;
  const selectedShape = canonicalShapes.find(option => option.shape === breathShape);
  const resource = actor?.limitedUses?.[BLUE_DRAGONBORN_BREATH_RESOURCE_ID];

  // Every rejection returns the original actor and target references, proving
  // that an unavailable action or resource is rejected atomically.
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
    { damageType: 'lightning' },
    undefined,
    { rng: () => (getSaveRollFace(saveOutcome) - 1) / 20 },
  );
  const rawDamage = rollDice(damageDice, { rng: () => 0.5 });
  const afterSaveDamage = calculateSaveDamage(rawDamage, saveResult, 'half');
  const finalDamage = calculateDamage(afterSaveDamage, actor, target, 'lightning');
  const paidActor = consumeActionCost(actor, { type: 'action' });
  const nextActor: CombatCharacter = {
    ...paidActor,
    limitedUses: {
      ...(paidActor.limitedUses ?? {}),
      [BLUE_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
    outcome: `Native Breath Weapon resolved: ${selectedShape.sizeFeet}-foot ${breathShape}; Attack action replaced; DC ${saveDC} Constitution save ${saveResult.success ? 'successful' : 'failed'} (${saveResult.total}); ${damageDice} rolled ${rawDamage}, final ${finalDamage}; use ${nextActor.limitedUses?.[BLUE_DRAGONBORN_BREATH_RESOURCE_ID]?.current}/${resource.max}. AoE placement not claimed.`,
  };
}

// ============================================================================
// Blue Dragonborn Leaf UI
// ============================================================================
// The compact surface keeps canonical facts, native actor/resource state, both
// transactions, visible events, and the explicit geometry boundary together.
// ============================================================================

const BlueDragonbornRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState<BlueDragonbornScenarioState>(
    () => createBlueDragonbornScenario(race),
  );

  // Resolve the selected native resistance packet and publish the same result.
  const handleResistance = () => {
    const nextScenario = resolveBlueDragonbornResistance(scenario, scenario.damageType);
    setScenario(nextScenario);
    onScenarioEvent(`Blue Dragonborn RESISTANCE ${scenario.damageType.toUpperCase()}: ${nextScenario.outcome}`);
  };

  // Replace one Attack action with the native racial ability and publish its
  // deterministic save and damage result for the parent event log.
  const handleBreath = () => {
    const nextScenario = resolveBlueDragonbornBreath(
      scenario,
      scenario.breathShape,
      scenario.saveOutcome,
    );
    setScenario(nextScenario);
    onScenarioEvent(`Blue Dragonborn BREATH ${scenario.breathShape.toUpperCase()}: ${nextScenario.outcome}`);
  };

  const canonical = getCanonicalBlueDragonbornTraits(race);
  const actorResource = scenario.actor?.limitedUses?.[BLUE_DRAGONBORN_BREATH_RESOURCE_ID];
  const breathAbility = scenario.actor ? getBreathAbility(scenario.actor) : undefined;

  return (
    <section aria-labelledby="blue-dragonborn-race-title" data-testid="blue-dragonborn-race-leaf">
      {/* The heading names the canonical Blue transaction for assistive tools. */}
      <h4 id="blue-dragonborn-race-title">Blue Dragonborn Resistance and Breath Weapon</h4>
      <p data-testid="blue-dragonborn-canonical-traits">
        Canonical: Lightning resistance; Breath Weapon {canonical?.breath.damageDice ?? 'unknown'} {canonical?.breath.damageType ?? 'unknown'}; Constitution save; 15-foot cone or 30-foot line; scales to 2d10 at level 5.
      </p>

      {/* The comparison selector changes only damage type; native mitigation stays authoritative. */}
      <label htmlFor="blue-dragonborn-resistance-type">Resistance packet</label>
      <select
        id="blue-dragonborn-resistance-type"
        value={scenario.damageType}
        onChange={event => setScenario(current => ({
          ...current,
          damageType: event.target.value as BlueDragonbornDamageType,
        }))}
      >
        <option value="lightning">Lightning (canonical resistance)</option>
        <option value="fire">Fire (non-lightning comparison)</option>
      </select>
      <Button type="button" onClick={handleResistance}>Resolve native resistance</Button>

      {/* These controls expose the canonical shape choice and deterministic save branch. */}
      <label htmlFor={BLUE_DRAGONBORN_SHAPE_CONTROL_ID}>Breath shape</label>
      <select
        id={BLUE_DRAGONBORN_SHAPE_CONTROL_ID}
        value={scenario.breathShape}
        onChange={event => setScenario(current => ({
          ...current,
          breathShape: event.target.value as BlueDragonbornBreathShape,
        }))}
      >
        {BLUE_DRAGONBORN_BREATH_SHAPES.map(option => (
          <option key={option.shape} value={option.shape}>{option.sizeFeet}-foot {option.shape}</option>
        ))}
      </select>
      <label htmlFor={BLUE_DRAGONBORN_SAVE_CONTROL_ID}>Deterministic save branch</label>
      <select
        id={BLUE_DRAGONBORN_SAVE_CONTROL_ID}
        value={scenario.saveOutcome}
        onChange={event => setScenario(current => ({
          ...current,
          saveOutcome: event.target.value as BlueDragonbornSaveOutcome,
        }))}
      >
        <option value="failed">Failed save (full damage)</option>
        <option value="successful">Successful save (half damage)</option>
      </select>
      <Button type="button" onClick={handleBreath}>Use native Breath Weapon</Button>

      {/* These facts prove native actor values and mutable action/resource state. */}
      <p data-testid="blue-dragonborn-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; Lightning resistance: {scenario.actor?.resistances?.join(', ') || 'none'}; Action {scenario.actor?.actionEconomy.action.remaining ?? 'unknown'} remaining; Breath uses {actorResource?.current ?? 'unknown'}/{actorResource?.max ?? 'unknown'}; Native ability {breathAbility?.id ?? 'missing'}.
      </p>
      <p data-testid="blue-dragonborn-resistance-result">
        Resistance packet: {scenario.damageType}; Raw {BLUE_DRAGONBORN_RESISTANCE_DAMAGE}; Final {scenario.resistanceFinalDamage ?? 'not resolved'}.
      </p>
      <p data-testid="blue-dragonborn-breath-result">
        Breath packet: {scenario.breathShape}; Save {scenario.breathSaveTotal ?? 'not resolved'}; Raw {scenario.breathRawDamage ?? 'not resolved'}; Final {scenario.breathFinalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="blue-dragonborn-outcome">{scenario.outcome}</p>

      {/* This statement is the honest boundary around geometry and combat integration. */}
      <p data-testid="blue-dragonborn-boundary">
        Boundary: the canonical cone/line choice, Attack action replacement, save, resource, and damage transaction run here; native map AoE targeting/placement is not claimed, Breath Weapon is a race feature rather than a spell, and Draconic Flight remains an explicit deferred boundary.
      </p>
    </section>
  );
};

// Changing the parent reset count remounts this content and restores actor,
// action, resource, target HP, and result state to the production baseline.
export const BlueDragonbornRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <BlueDragonbornRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires one exact named registration export. Keeping it
// local avoids central registry conflicts with other Race workers.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'blue-dragonborn-resistance-breath',
  raceId: 'blue_dragonborn',
  label: 'Blue Dragonborn Resistance and Breath Weapon',
  description: 'Resolve canonical lightning resistance and Breath Weapon through native combat helpers.',
  Component: BlueDragonbornRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
