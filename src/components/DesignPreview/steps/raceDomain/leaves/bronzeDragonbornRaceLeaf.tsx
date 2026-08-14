// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 14:21:00
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
 * This file demonstrates Bronze Dragonborn Lightning resistance and Breath Weapon
 * in the Tactical Sandbox Race domain.
 *
 * The leaf starts with a production quick character, carries canonical Bronze
 * facts through the linked-text parser boundary, and resolves the native
 * resistance, action, Constitution save, deterministic damage, and long-rest
 * resource transactions. It reports cone/line choice without claiming map
 * placement or the separate Draconic Flight feature.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: ACTIVE_RACES Bronze Dragonborn data, racial trait parsing,
 * production quick-character assembly, and native combat/save utilities.
 */

// ============================================================================
// Canonical Facts And Stable Controls
// ============================================================================
// These identifiers give focused tests and mounted preview proof stable hooks.
// Rule values still come from the canonical Bronze row or its parsed trait
// metadata so this leaf does not become a second source of racial rules.
// ============================================================================

export const BRONZE_DRAGONBORN_RESISTANCE_CONTROL_ID = 'resolve-bronze-dragonborn-resistance';
export const BRONZE_DRAGONBORN_BREATH_CONTROL_ID = 'resolve-bronze-dragonborn-breath';
export const BRONZE_DRAGONBORN_SHAPE_CONTROL_ID = 'bronze-dragonborn-breath-shape';
export const BRONZE_DRAGONBORN_SAVE_CONTROL_ID = 'bronze-dragonborn-save-outcome';
export const BRONZE_DRAGONBORN_ACTOR_ID = 'bronze-dragonborn-race-actor';
export const BRONZE_DRAGONBORN_TARGET_ID = 'bronze-dragonborn-breath-target';
export const BRONZE_DRAGONBORN_RESISTANCE_DAMAGE = 15;
export const BRONZE_DRAGONBORN_BREATH_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'bronze_dragonborn__breath_weapon__resource',
);

export type BronzeDragonbornDamageType = 'lightning' | 'fire';
export type BronzeDragonbornBreathShape = 'cone' | 'line';
export type BronzeDragonbornSaveOutcome = 'failed' | 'successful';

export interface BronzeDragonbornBreathShapeOption {
  shape: BronzeDragonbornBreathShape;
  sizeFeet: number;
}

export const BRONZE_DRAGONBORN_BREATH_SHAPES: readonly BronzeDragonbornBreathShapeOption[] = [
  { shape: 'cone', sizeFeet: 15 },
  { shape: 'line', sizeFeet: 30 },
];

export interface ParsedBronzeDragonbornTraits {
  resistance: string[];
  breath: RacialBreathWeapon;
  breathTrait: RacialFeatureTrait;
  breathShapes: readonly BronzeDragonbornBreathShapeOption[];
}

// Bronze uses linked display terms. This parser supplies only the small
// wording gap left by the shared modifier parser, while retaining the row as
// the authority for damage type, geometry, save, and scaling facts.
export function parseCanonicalBronzeDragonbornBreath(
  traitText: string,
): RacialBreathWeapon | null {
  const areaMatches = [...traitText.matchAll(/(\d+)-foot\s+(cone|line)/gi)];
  const saveMatch = traitText.match(/\b(Dexterity|Constitution)\b\s+(?:modifier|saving throw)/i);
  const damageDiceMatch = traitText.match(/(\d+d\d+)\s+damage/i);
  const damageTypeMatch = traitText.match(/exhalation of\s+([a-z]+)\s+damage/i);
  if (!areaMatches.length || !saveMatch || !damageDiceMatch || !damageTypeMatch) return null;

  // Native combat consumes this compact metadata for the racial ability.
  return {
    areaShape: areaMatches[0][2].toLowerCase() as 'cone' | 'line',
    areaSize: Number(areaMatches[0][1]),
    saveAbility: saveMatch[1] as RacialBreathWeapon['saveAbility'],
    damageDice: damageDiceMatch[1],
    damageType: damageTypeMatch[1],
    scaling: [],
  };
}

// Return the exact canonical Bronze trait row with the requested display name.
export function getCanonicalBronzeDragonbornTrait(
  race: Race,
  traitName: string,
): string | null {
  return race.traits.find(trait => trait.trim().toLowerCase().startsWith(`${traitName.toLowerCase()}:`)) ?? null;
}

// Strip only display links at the parser boundary. The canonical Race object
// remains untouched so linked text and cached display data are preserved.
function createParserReadyBronzeDragonbornRace(race: Race): Race {
  return {
    ...race,
    traits: race.traits.map(trait => trait.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')),
  };
}

// Read Bronze resistance, breath, geometry, scaling, and resource facts through
// the same racial trait library used by ordinary character assembly.
export function getCanonicalBronzeDragonbornTraits(
  race: Race,
): ParsedBronzeDragonbornTraits | null {
  const parserReadyRace = createParserReadyBronzeDragonbornRace(race);
  const parsedTraits = buildRacialTraitLibrary({ [race.id]: parserReadyRace }).byRaceId[race.id] ?? [];
  const breathText = getCanonicalBronzeDragonbornTrait(race, 'Breath Weapon') ?? '';
  const normalizedBreathText = breathText.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  const breathTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => trait.type !== 'spell' && trait.traitName === 'Breath Weapon',
  );
  const breath = breathTrait?.modifierBuckets?.breathWeapon
    ?? parseCanonicalBronzeDragonbornBreath(normalizedBreathText);
  const resistanceTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => trait.type !== 'spell' && trait.traitName === 'Damage Resistance',
  );

  if (!breathTrait || !breath || !resistanceTrait) return null;

  // Both selectable geometries come from the authored sentence rather than a
  // copied UI rule, keeping the selector tied to canonical Bronze data.
  const breathShapes = [...normalizedBreathText.matchAll(/(\d+)-foot\s+(cone|line)/gi)]
    .map(match => ({
      shape: match[2].toLowerCase() as BronzeDragonbornBreathShape,
      sizeFeet: Number(match[1]),
    }))
    .filter((option, index, options) => options.findIndex(candidate => (
      candidate.shape === option.shape && candidate.sizeFeet === option.sizeFeet
    )) === index);

  // Expand the authored compact sentence into cumulative native dice values,
  // including the required level-5 2d10 transaction used by this leaf.
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

  const resistanceText = getCanonicalBronzeDragonbornTrait(race, 'Damage Resistance') ?? '';
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

// Refuse to expose a Bronze actor unless the canonical row proves every fact
// that this leaf will display or execute.
export function hasCanonicalBronzeDragonbornRules(race: Race): boolean {
  const parsed = getCanonicalBronzeDragonbornTraits(race);
  const resistanceText = getCanonicalBronzeDragonbornTrait(race, 'Damage Resistance');
  const breathText = getCanonicalBronzeDragonbornTrait(race, 'Breath Weapon');

  return race.id === 'bronze_dragonborn'
    && !!parsed
    && resistanceText?.toLowerCase().includes('lightning') === true
    && parsed.resistance.some(type => type.toLowerCase() === 'lightning')
    && parsed.breath.saveAbility === 'Constitution'
    && parsed.breath.damageDice === '1d10'
    && parsed.breath.damageType.toLowerCase() === 'lightning'
    && parsed.breath.scaling.some(scale => scale.level === 5 && scale.dice === '2d10')
    && parsed.breathTrait.resources?.some(resource => (
      resource.id === 'bronze_dragonborn__breath_weapon__resource'
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
// The production quick character crosses racial assembly and the combat bridge.
// The narrow adapter below carries only canonical facts across the known
// linked-text/cache boundary; native combat helpers still own execution.
// ============================================================================

export interface BronzeDragonbornScenarioState {
  race: Race;
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  damageType: BronzeDragonbornDamageType;
  breathShape: BronzeDragonbornBreathShape;
  saveOutcome: BronzeDragonbornSaveOutcome;
  resistanceFinalDamage: number | null;
  breathRawDamage: number | null;
  breathFinalDamage: number | null;
  breathSaveTotal: number | null;
  outcome: string;
}

// Use a production quick combat actor for the target so this proof does not
// hide missing combat state behind a hand-authored mock.
function createBreathTarget(): CombatCharacter | null {
  const target = createQuickCombatCharacter({
    name: 'Bronze Breath Weapon Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 12, 10, 10, 10],
  });

  return target ? { ...target, id: BRONZE_DRAGONBORN_TARGET_ID, team: 'enemy' } : null;
}

function createBronzeDragonbornActor(race: Race): {
  actor: CombatCharacter | null;
  assembledCharacter: PlayerCharacter | null;
  outcome: string;
} {
  const quickCharacter = createQuickCharacter({
    name: 'Bronze Dragonborn - Race Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 14, 10, 10, 10],
  });
  const canonicalTraits = getCanonicalBronzeDragonbornTraits(race);

  // Missing canonical facts are an honest boundary, not permission to invent
  // a Bronze actor with assumed resistance or Breath Weapon rules.
  if (!quickCharacter || !canonicalTraits || !hasCanonicalBronzeDragonbornRules(race)) {
    return {
      actor: null,
      assembledCharacter: quickCharacter,
      outcome: 'Bronze Dragonborn unavailable: canonical traits or production assembly is incomplete.',
    };
  }

  const parserAssembledCharacter = applyRacialSpellGrantsByLevel(
    {
      ...quickCharacter,
      race: createParserReadyBronzeDragonbornRace(race),
    },
    quickCharacter.level ?? 1,
  );
  const resourceDefinition = canonicalTraits.breathTrait.resources?.find(resource => (
    resource.id === 'bronze_dragonborn__breath_weapon__resource'
  ));

  if (!resourceDefinition) {
    return {
      actor: null,
      assembledCharacter: parserAssembledCharacter,
      outcome: 'Bronze Dragonborn unavailable: the canonical Breath Weapon resource was not assembled.',
    };
  }

  // DEBT: One shared assembly cache path still reads linked-text Race rows.
  // This leaf carries forward only Bronze facts already proven by the parser;
  // the durable normalization fix belongs outside this delegated leaf.
  const resourceMax = typeof resourceDefinition.maxUses === 'number'
    ? resourceDefinition.maxUses
    : parserAssembledCharacter.proficiencyBonus ?? 2;
  const assembledCharacter: PlayerCharacter = {
    ...parserAssembledCharacter,
    race: createParserReadyBronzeDragonbornRace(race),
    resistances: Array.from(new Set([
      ...(parserAssembledCharacter.resistances ?? []),
      ...canonicalTraits.resistance,
    ])),
    limitedUses: {
      ...(parserAssembledCharacter.limitedUses ?? {}),
      [BRONZE_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
      outcome: 'Bronze Dragonborn unavailable: the native combat bridge did not expose Breath Weapon.',
    };
  }

  // Carry the parser-produced resource across the known bridge boundary so the
  // transaction spends the same PB-scaled long-rest resource it assembled.
  const actor = resetEconomy({
    ...generatedActor,
    id: BRONZE_DRAGONBORN_ACTOR_ID,
    name: `${race.name} - Race Tester`,
    position: { x: 2, y: 2 },
    limitedUses: {
      [BRONZE_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
export function createBronzeDragonbornScenario(race: Race): BronzeDragonbornScenarioState {
  const assembled = createBronzeDragonbornActor(race);
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
// calculateDamage delegates mitigation to the production resistance helper.
// The Fire comparison changes only damage type, making Lightning reduction and
// unchanged non-Lightning damage visible in the same scenario.
// ============================================================================

export function resolveBronzeDragonbornResistance(
  scenario: BronzeDragonbornScenarioState,
  damageType: BronzeDragonbornDamageType,
): BronzeDragonbornScenarioState {
  if (!scenario.actor) {
    return { ...scenario, outcome: 'Resistance rejected: production actor is unavailable.' };
  }

  const finalDamage = calculateDamage(
    BRONZE_DRAGONBORN_RESISTANCE_DAMAGE,
    null,
    scenario.actor,
    damageType,
  );
  const resisted = finalDamage < BRONZE_DRAGONBORN_RESISTANCE_DAMAGE;

  return {
    ...scenario,
    damageType,
    resistanceFinalDamage: finalDamage,
    outcome: `Native resistance resolved: ${damageType} raw ${BRONZE_DRAGONBORN_RESISTANCE_DAMAGE}, final ${finalDamage} (${resisted ? 'resistance applied' : 'non-lightning comparison unchanged'}).`,
  };
}

// ============================================================================
// Native Breath Weapon Transaction
// ============================================================================
// This is a non-spell Attack action replacement. It uses native action cost,
// deterministic Constitution saving throw, deterministic dice, save-half
// damage, and the normal damage calculator without claiming map AoE placement.
// ============================================================================

function getBreathAbility(actor: CombatCharacter): Ability | undefined {
  return actor.abilities.find(ability => ability.id === 'racial_breath_weapon');
}

function getSaveRollFace(outcome: BronzeDragonbornSaveOutcome): number {
  return outcome === 'failed' ? 1 : 20;
}

export function resolveBronzeDragonbornBreath(
  scenario: BronzeDragonbornScenarioState,
  breathShape: BronzeDragonbornBreathShape,
  saveOutcome: BronzeDragonbornSaveOutcome,
): BronzeDragonbornScenarioState {
  const actor = scenario.actor;
  const target = scenario.target;
  const ability = actor ? getBreathAbility(actor) : undefined;
  const canonicalShapes = getCanonicalBronzeDragonbornTraits(scenario.race)?.breathShapes
    ?? BRONZE_DRAGONBORN_BREATH_SHAPES;
  const selectedShape = canonicalShapes.find(option => option.shape === breathShape);
  const resource = actor?.limitedUses?.[BRONZE_DRAGONBORN_BREATH_RESOURCE_ID];

  // Every rejection returns original actor and target references, proving that
  // an unavailable action or resource is rejected atomically.
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
      [BRONZE_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
    outcome: `Native Breath Weapon resolved: ${selectedShape.sizeFeet}-foot ${breathShape}; Attack action replaced; DC ${saveDC} Constitution save ${saveResult.success ? 'successful' : 'failed'} (${saveResult.total}); ${damageDice} rolled ${rawDamage}, final ${finalDamage}; use ${nextActor.limitedUses?.[BRONZE_DRAGONBORN_BREATH_RESOURCE_ID]?.current}/${resource.max}. AoE placement not claimed.`,
  };
}

// ============================================================================
// Bronze Dragonborn Leaf UI
// ============================================================================
// The compact surface keeps canonical facts, native actor/resource state, both
// transactions, visible events, and explicit geometry/Flight boundaries together.
// ============================================================================

const BronzeDragonbornRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState<BronzeDragonbornScenarioState>(
    () => createBronzeDragonbornScenario(race),
  );

  // Resolve the selected native resistance packet and publish its same result.
  const handleResistance = () => {
    const nextScenario = resolveBronzeDragonbornResistance(scenario, scenario.damageType);
    setScenario(nextScenario);
    onScenarioEvent(`Bronze Dragonborn RESISTANCE ${scenario.damageType.toUpperCase()}: ${nextScenario.outcome}`);
  };

  // Replace one Attack action with the native racial ability and publish the
  // deterministic save and damage result for the parent event log.
  const handleBreath = () => {
    const nextScenario = resolveBronzeDragonbornBreath(
      scenario,
      scenario.breathShape,
      scenario.saveOutcome,
    );
    setScenario(nextScenario);
    onScenarioEvent(`Bronze Dragonborn BREATH ${scenario.breathShape.toUpperCase()}: ${nextScenario.outcome}`);
  };

  const canonical = getCanonicalBronzeDragonbornTraits(race);
  const actorResource = scenario.actor?.limitedUses?.[BRONZE_DRAGONBORN_BREATH_RESOURCE_ID];
  const breathAbility = scenario.actor ? getBreathAbility(scenario.actor) : undefined;

  return (
    <section aria-labelledby="bronze-dragonborn-race-title" data-testid="bronze-dragonborn-race-leaf">
      {/* The heading names the canonical Bronze transaction for assistive tools. */}
      <h4 id="bronze-dragonborn-race-title">Bronze Dragonborn Resistance and Breath Weapon</h4>
      <p data-testid="bronze-dragonborn-canonical-traits">
        Canonical: Lightning resistance; Breath Weapon {canonical?.breath.damageDice ?? 'unknown'} {canonical?.breath.damageType ?? 'unknown'}; Constitution save; 15-foot cone or 30-foot line; scales to 2d10 at level 5.
      </p>

      {/* The comparison selector changes only damage type; native mitigation stays authoritative. */}
      <label htmlFor="bronze-dragonborn-resistance-type">Resistance packet</label>
      <select
        id="bronze-dragonborn-resistance-type"
        value={scenario.damageType}
        onChange={event => setScenario(current => ({
          ...current,
          damageType: event.target.value as BronzeDragonbornDamageType,
        }))}
      >
        <option value="lightning">Lightning (canonical resistance)</option>
        <option value="fire">Fire (non-lightning comparison)</option>
      </select>
      <Button type="button" onClick={handleResistance}>Resolve native resistance</Button>

      {/* These controls expose the canonical shape choice and deterministic save branch. */}
      <label htmlFor={BRONZE_DRAGONBORN_SHAPE_CONTROL_ID}>Breath shape</label>
      <select
        id={BRONZE_DRAGONBORN_SHAPE_CONTROL_ID}
        value={scenario.breathShape}
        onChange={event => setScenario(current => ({
          ...current,
          breathShape: event.target.value as BronzeDragonbornBreathShape,
        }))}
      >
        {BRONZE_DRAGONBORN_BREATH_SHAPES.map(option => (
          <option key={option.shape} value={option.shape}>{option.sizeFeet}-foot {option.shape}</option>
        ))}
      </select>
      <label htmlFor={BRONZE_DRAGONBORN_SAVE_CONTROL_ID}>Deterministic save branch</label>
      <select
        id={BRONZE_DRAGONBORN_SAVE_CONTROL_ID}
        value={scenario.saveOutcome}
        onChange={event => setScenario(current => ({
          ...current,
          saveOutcome: event.target.value as BronzeDragonbornSaveOutcome,
        }))}
      >
        <option value="failed">Failed save (full damage)</option>
        <option value="successful">Successful save (half damage)</option>
      </select>
      <Button type="button" onClick={handleBreath}>Use native Breath Weapon</Button>

      {/* These facts prove native actor values and mutable action/resource state. */}
      <p data-testid="bronze-dragonborn-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; Lightning resistance: {scenario.actor?.resistances?.join(', ') || 'none'}; Action {scenario.actor?.actionEconomy.action.remaining ?? 'unknown'} remaining; Breath uses {actorResource?.current ?? 'unknown'}/{actorResource?.max ?? 'unknown'}; Native ability {breathAbility?.id ?? 'missing'}.
      </p>
      <p data-testid="bronze-dragonborn-resistance-result">
        Resistance packet: {scenario.damageType}; Raw {BRONZE_DRAGONBORN_RESISTANCE_DAMAGE}; Final {scenario.resistanceFinalDamage ?? 'not resolved'}.
      </p>
      <p data-testid="bronze-dragonborn-breath-result">
        Breath packet: {scenario.breathShape}; Save {scenario.breathSaveTotal ?? 'not resolved'}; Raw {scenario.breathRawDamage ?? 'not resolved'}; Final {scenario.breathFinalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="bronze-dragonborn-outcome">{scenario.outcome}</p>

      {/* This is the honest boundary around geometry, AoE placement, and Flight. */}
      <p data-testid="bronze-dragonborn-boundary">
        Boundary: the canonical cone/line choice, Attack action replacement, Constitution save, resource, and damage transaction run here; native map AoE targeting/placement is not claimed, Breath Weapon is a race feature rather than a spell, and Draconic Flight remains an explicit deferred boundary.
      </p>
    </section>
  );
};

// Changing the parent reset count remounts this content and restores actor,
// action, resource, target HP, and result state to the production baseline.
export const BronzeDragonbornRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <BronzeDragonbornRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires one exact named registration export. Keeping it
// local avoids central registry conflicts with other Race workers.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'bronze-dragonborn-resistance-breath',
  raceId: 'bronze_dragonborn',
  label: 'Bronze Dragonborn Resistance and Breath Weapon',
  description: 'Resolve canonical Lightning resistance and Breath Weapon through native combat helpers.',
  Component: BronzeDragonbornRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
