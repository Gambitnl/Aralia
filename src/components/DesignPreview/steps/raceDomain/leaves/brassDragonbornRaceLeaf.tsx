// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 14:11:07
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
 * This file demonstrates the canonical Brass Dragonborn fire resistance and
 * Breath Weapon in the Tactical Sandbox Race domain.
 *
 * The actor starts from a production quick character, crosses the normal
 * racial assembly and player-to-combat bridge, and then resolves resistance,
 * action payment, saving throw, deterministic dice, save-half damage, and the
 * long-rest resource through native helpers. The cone/line selector reports
 * the canonical shape only; it does not claim map targeting or placement.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: ACTIVE_RACES Brass Dragonborn data, racial trait parsing,
 * production quick character assembly, and native combat/save utilities.
 */

// ============================================================================
// Canonical Facts And Stable Controls
// ============================================================================
// These identifiers make focused tests and mounted preview proof deterministic.
// Rule values are read from the canonical Brass row or parser whenever the
// shared data model exposes them, so this leaf cannot silently invent a second
// version of the racial mechanic.
// ============================================================================

export const BRASS_DRAGONBORN_RESISTANCE_CONTROL_ID = 'resolve-brass-dragonborn-resistance';
export const BRASS_DRAGONBORN_BREATH_CONTROL_ID = 'resolve-brass-dragonborn-breath';
export const BRASS_DRAGONBORN_SHAPE_CONTROL_ID = 'brass-dragonborn-breath-shape';
export const BRASS_DRAGONBORN_SAVE_CONTROL_ID = 'brass-dragonborn-save-outcome';
export const BRASS_DRAGONBORN_ACTOR_ID = 'brass-dragonborn-race-actor';
export const BRASS_DRAGONBORN_TARGET_ID = 'brass-dragonborn-breath-target';
export const BRASS_DRAGONBORN_RESISTANCE_DAMAGE = 15;
export const BRASS_DRAGONBORN_BREATH_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'brass_dragonborn__breath_weapon__resource',
);

export type BrassDragonbornDamageType = 'fire' | 'acid';
export type BrassDragonbornBreathShape = 'cone' | 'line';
export type BrassDragonbornSaveOutcome = 'failed' | 'successful';

export interface BrassDragonbornBreathShapeOption {
  shape: BrassDragonbornBreathShape;
  sizeFeet: number;
}

export const BRASS_DRAGONBORN_BREATH_SHAPES: readonly BrassDragonbornBreathShapeOption[] = [
  { shape: 'cone', sizeFeet: 15 },
  { shape: 'line', sizeFeet: 30 },
];

export interface ParsedBrassDragonbornTraits {
  resistance: string[];
  breath: RacialBreathWeapon;
  breathTrait: RacialFeatureTrait;
  breathShapes: readonly BrassDragonbornBreathShapeOption[];
}

// The Brass row uses linked display terms. This parser fills only the small
// wording gap left by the shared modifier parser while keeping the canonical
// row authoritative for every rule value.
export function parseCanonicalBrassDragonbornBreath(
  traitText: string,
): RacialBreathWeapon | null {
  const areaMatches = [...traitText.matchAll(/(\d+)-foot\s+(cone|line)/gi)];
  const saveMatch = traitText.match(/\b(Dexterity|Constitution)\b\s+(?:modifier|saving throw)/i);
  const damageDiceMatch = traitText.match(/(\d+d\d+)\s+damage/i);
  const damageTypeMatch = traitText.match(/exhalation of\s+([a-z]+)\s+damage/i);
  if (!areaMatches.length || !saveMatch || !damageDiceMatch || !damageTypeMatch) return null;

  // The native combat bridge consumes this compact metadata for the racial
  // ability, then uses its normal save and damage transaction.
  return {
    areaShape: areaMatches[0][2].toLowerCase() as 'cone' | 'line',
    areaSize: Number(areaMatches[0][1]),
    saveAbility: saveMatch[1] as RacialBreathWeapon['saveAbility'],
    damageDice: damageDiceMatch[1],
    damageType: damageTypeMatch[1],
    scaling: [],
  };
}

// Return the exact canonical Brass row with the requested display name.
export function getCanonicalBrassDragonbornTrait(
  race: Race,
  traitName: string,
): string | null {
  return race.traits.find(trait => trait.trim().toLowerCase().startsWith(`${traitName.toLowerCase()}:`)) ?? null;
}

// Strip display links only at the production parser boundary. The Race object
// used by the shell remains untouched, preserving linked-text and cache intent.
function createParserReadyBrassDragonbornRace(race: Race): Race {
  return {
    ...race,
    traits: race.traits.map(trait => trait.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')),
  };
}

// Read Brass resistance, breath, geometry, scaling, and resource facts through
// the same racial trait library used by ordinary character assembly.
export function getCanonicalBrassDragonbornTraits(
  race: Race,
): ParsedBrassDragonbornTraits | null {
  const parserReadyRace = createParserReadyBrassDragonbornRace(race);
  const parsedTraits = buildRacialTraitLibrary({ [race.id]: parserReadyRace }).byRaceId[race.id] ?? [];
  const breathText = getCanonicalBrassDragonbornTrait(race, 'Breath Weapon') ?? '';
  const normalizedBreathText = breathText.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  const breathTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => trait.type !== 'spell' && trait.traitName === 'Breath Weapon',
  );
  const breath = breathTrait?.modifierBuckets?.breathWeapon
    ?? parseCanonicalBrassDragonbornBreath(normalizedBreathText);
  const resistanceTrait = parsedTraits.find(
    (trait): trait is RacialFeatureTrait => trait.type !== 'spell' && trait.traitName === 'Damage Resistance',
  );

  if (!breathTrait || !breath || !resistanceTrait) return null;

  // Both geometries come from the authored sentence, so the selector remains
  // tied to the canonical row instead of duplicating a rule in the preview.
  const breathShapes = [...normalizedBreathText.matchAll(/(\d+)-foot\s+(cone|line)/gi)]
    .map(match => ({
      shape: match[2].toLowerCase() as BrassDragonbornBreathShape,
      sizeFeet: Number(match[1]),
    }))
    .filter((option, index, options) => options.findIndex(candidate => (
      candidate.shape === option.shape && candidate.sizeFeet === option.sizeFeet
    )) === index);

  // Expand the canonical compact level sentence into cumulative dice values
  // consumed by the native combat ability at level 5 and beyond.
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

  const resistanceText = getCanonicalBrassDragonbornTrait(race, 'Damage Resistance') ?? '';
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

// Refuse to expose a Brass actor unless the canonical rows prove every fact
// that this leaf will display or execute.
export function hasCanonicalBrassDragonbornRules(race: Race): boolean {
  const parsed = getCanonicalBrassDragonbornTraits(race);
  const resistanceText = getCanonicalBrassDragonbornTrait(race, 'Damage Resistance');
  const breathText = getCanonicalBrassDragonbornTrait(race, 'Breath Weapon');

  return race.id === 'brass_dragonborn'
    && !!parsed
    && resistanceText?.toLowerCase().includes('fire') === true
    && parsed.resistance.some(type => type.toLowerCase() === 'fire')
    && parsed.breath.saveAbility === 'Constitution'
    && parsed.breath.damageDice === '1d10'
    && parsed.breath.damageType.toLowerCase() === 'fire'
    && parsed.breath.scaling.some(scale => scale.level === 5 && scale.dice === '2d10')
    && parsed.breathTrait.resources?.some(resource => (
      resource.id === 'brass_dragonborn__breath_weapon__resource'
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
// A production quick character crosses the real racial assembly and combat
// bridge. The adapter below carries only canonical facts across the known
// linked-text cache gap; native combat helpers still own execution.
// ============================================================================

export interface BrassDragonbornScenarioState {
  race: Race;
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  damageType: BrassDragonbornDamageType;
  breathShape: BrassDragonbornBreathShape;
  saveOutcome: BrassDragonbornSaveOutcome;
  resistanceFinalDamage: number | null;
  breathRawDamage: number | null;
  breathFinalDamage: number | null;
  breathSaveTotal: number | null;
  outcome: string;
}

// Use a production quick combat actor for the target so the preview does not
// conceal missing combat state behind a hand-authored mock.
function createBreathTarget(): CombatCharacter | null {
  const target = createQuickCombatCharacter({
    name: 'Brass Breath Weapon Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 12, 10, 10, 10],
  });

  return target ? { ...target, id: BRASS_DRAGONBORN_TARGET_ID, team: 'enemy' } : null;
}

function createBrassDragonbornActor(race: Race): {
  actor: CombatCharacter | null;
  assembledCharacter: PlayerCharacter | null;
  outcome: string;
} {
  const quickCharacter = createQuickCharacter({
    name: 'Brass Dragonborn - Race Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 14, 10, 10, 10],
  });
  const canonicalTraits = getCanonicalBrassDragonbornTraits(race);

  // Missing canonical facts are an honest boundary instead of permission to
  // fabricate a Brass actor with assumed resistance or Breath Weapon rules.
  if (!quickCharacter || !canonicalTraits || !hasCanonicalBrassDragonbornRules(race)) {
    return {
      actor: null,
      assembledCharacter: quickCharacter,
      outcome: 'Brass Dragonborn unavailable: canonical traits or production assembly is incomplete.',
    };
  }

  const parserAssembledCharacter = applyRacialSpellGrantsByLevel(
    {
      ...quickCharacter,
      race: createParserReadyBrassDragonbornRace(race),
    },
    quickCharacter.level ?? 1,
  );
  const resourceDefinition = canonicalTraits.breathTrait.resources?.find(resource => (
    resource.id === 'brass_dragonborn__breath_weapon__resource'
  ));

  if (!resourceDefinition) {
    return {
      actor: null,
      assembledCharacter: parserAssembledCharacter,
      outcome: 'Brass Dragonborn unavailable: the canonical Breath Weapon resource was not assembled.',
    };
  }

  // DEBT: The shared assembly cache still reads linked-text Race rows on one
  // path. This adapter carries only Brass facts already proven by the parser;
  // the native combat bridge and resolvers remain authoritative. The durable
  // fix belongs in shared racial-library normalization outside this leaf.
  const resourceMax = typeof resourceDefinition.maxUses === 'number'
    ? resourceDefinition.maxUses
    : parserAssembledCharacter.proficiencyBonus ?? 2;
  const assembledCharacter: PlayerCharacter = {
    ...parserAssembledCharacter,
    race: createParserReadyBrassDragonbornRace(race),
    resistances: Array.from(new Set([
      ...(parserAssembledCharacter.resistances ?? []),
      ...canonicalTraits.resistance,
    ])),
    limitedUses: {
      ...(parserAssembledCharacter.limitedUses ?? {}),
      [BRASS_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
      outcome: 'Brass Dragonborn unavailable: the native combat bridge did not expose Breath Weapon.',
    };
  }

  // Carry the parser-produced resource across the known bridge boundary so
  // this leaf spends the same PB-scaled long-rest resource assembly created.
  const actor = resetEconomy({
    ...generatedActor,
    id: BRASS_DRAGONBORN_ACTOR_ID,
    name: `${race.name} - Race Tester`,
    position: { x: 2, y: 2 },
    limitedUses: {
      [BRASS_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
    outcome: `Ready: ${actor.name}; level ${actor.level}; Fire resistance; Breath Weapon ${resourceMax}/${resourceDefinition.maxUses} uses; action ready.`,
  };
}

// Build the deterministic baseline used by the UI and focused tests.
export function createBrassDragonbornScenario(race: Race): BrassDragonbornScenarioState {
  const assembled = createBrassDragonbornActor(race);
  return {
    race,
    actor: assembled.actor,
    target: createBreathTarget(),
    damageType: 'fire',
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
// The acid comparison changes only damage type, making fire reduction versus
// unchanged non-fire damage visible in the same scenario.
// ============================================================================

export function resolveBrassDragonbornResistance(
  scenario: BrassDragonbornScenarioState,
  damageType: BrassDragonbornDamageType,
): BrassDragonbornScenarioState {
  if (!scenario.actor) {
    return { ...scenario, outcome: 'Resistance rejected: production actor is unavailable.' };
  }

  const finalDamage = calculateDamage(
    BRASS_DRAGONBORN_RESISTANCE_DAMAGE,
    null,
    scenario.actor,
    damageType,
  );
  const resisted = finalDamage < BRASS_DRAGONBORN_RESISTANCE_DAMAGE;

  return {
    ...scenario,
    damageType,
    resistanceFinalDamage: finalDamage,
    outcome: `Native resistance resolved: ${damageType} raw ${BRASS_DRAGONBORN_RESISTANCE_DAMAGE}, final ${finalDamage} (${resisted ? 'resistance applied' : 'non-fire comparison unchanged'}).`,
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

function getSaveRollFace(outcome: BrassDragonbornSaveOutcome): number {
  return outcome === 'failed' ? 1 : 20;
}

export function resolveBrassDragonbornBreath(
  scenario: BrassDragonbornScenarioState,
  breathShape: BrassDragonbornBreathShape,
  saveOutcome: BrassDragonbornSaveOutcome,
): BrassDragonbornScenarioState {
  const actor = scenario.actor;
  const target = scenario.target;
  const ability = actor ? getBreathAbility(actor) : undefined;
  const canonicalShapes = getCanonicalBrassDragonbornTraits(scenario.race)?.breathShapes
    ?? BRASS_DRAGONBORN_BREATH_SHAPES;
  const selectedShape = canonicalShapes.find(option => option.shape === breathShape);
  const resource = actor?.limitedUses?.[BRASS_DRAGONBORN_BREATH_RESOURCE_ID];

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
    { damageType: 'fire' },
    undefined,
    { rng: () => (getSaveRollFace(saveOutcome) - 1) / 20 },
  );
  const rawDamage = rollDice(damageDice, { rng: () => 0.5 });
  const afterSaveDamage = calculateSaveDamage(rawDamage, saveResult, 'half');
  const finalDamage = calculateDamage(afterSaveDamage, actor, target, 'fire');
  const paidActor = consumeActionCost(actor, { type: 'action' });
  const nextActor: CombatCharacter = {
    ...paidActor,
    limitedUses: {
      ...(paidActor.limitedUses ?? {}),
      [BRASS_DRAGONBORN_BREATH_RESOURCE_ID]: {
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
    outcome: `Native Breath Weapon resolved: ${selectedShape.sizeFeet}-foot ${breathShape}; Attack action replaced; DC ${saveDC} Constitution save ${saveResult.success ? 'successful' : 'failed'} (${saveResult.total}); ${damageDice} rolled ${rawDamage}, final ${finalDamage}; use ${nextActor.limitedUses?.[BRASS_DRAGONBORN_BREATH_RESOURCE_ID]?.current}/${resource.max}. AoE placement not claimed.`,
  };
}

// ============================================================================
// Brass Dragonborn Leaf UI
// ============================================================================
// The compact surface keeps canonical facts, native actor/resource state, both
// transactions, visible events, and the explicit unsupported boundaries together.
// ============================================================================

const BrassDragonbornRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState<BrassDragonbornScenarioState>(
    () => createBrassDragonbornScenario(race),
  );

  // Resolve the selected native resistance packet and publish the same result.
  const handleResistance = () => {
    const nextScenario = resolveBrassDragonbornResistance(scenario, scenario.damageType);
    setScenario(nextScenario);
    onScenarioEvent(`Brass Dragonborn RESISTANCE ${scenario.damageType.toUpperCase()}: ${nextScenario.outcome}`);
  };

  // Replace one Attack action with the native racial ability and publish its
  // deterministic save and damage result for the parent event log.
  const handleBreath = () => {
    const nextScenario = resolveBrassDragonbornBreath(
      scenario,
      scenario.breathShape,
      scenario.saveOutcome,
    );
    setScenario(nextScenario);
    onScenarioEvent(`Brass Dragonborn BREATH ${scenario.breathShape.toUpperCase()}: ${nextScenario.outcome}`);
  };

  const canonical = getCanonicalBrassDragonbornTraits(race);
  const actorResource = scenario.actor?.limitedUses?.[BRASS_DRAGONBORN_BREATH_RESOURCE_ID];
  const breathAbility = scenario.actor ? getBreathAbility(scenario.actor) : undefined;

  return (
    <section aria-labelledby="brass-dragonborn-race-title" data-testid="brass-dragonborn-race-leaf">
      {/* The heading names the canonical Brass transaction for assistive tools. */}
      <h4 id="brass-dragonborn-race-title">Brass Dragonborn Resistance and Breath Weapon</h4>
      <p data-testid="brass-dragonborn-canonical-traits">
        Canonical: Fire resistance; Breath Weapon {canonical?.breath.damageDice ?? 'unknown'} {canonical?.breath.damageType ?? 'unknown'}; Constitution save; 15-foot cone or 30-foot line; scales to 2d10 at level 5.
      </p>

      {/* The comparison selector changes only damage type; native mitigation stays authoritative. */}
      <label htmlFor="brass-dragonborn-resistance-type">Resistance packet</label>
      <select
        id="brass-dragonborn-resistance-type"
        value={scenario.damageType}
        onChange={event => setScenario(current => ({
          ...current,
          damageType: event.target.value as BrassDragonbornDamageType,
        }))}
      >
        <option value="fire">Fire (canonical resistance)</option>
        <option value="acid">Acid (non-fire comparison)</option>
      </select>
      <Button type="button" onClick={handleResistance}>Resolve native resistance</Button>

      {/* These controls expose canonical geometry and a deterministic save branch. */}
      <label htmlFor={BRASS_DRAGONBORN_SHAPE_CONTROL_ID}>Breath shape</label>
      <select
        id={BRASS_DRAGONBORN_SHAPE_CONTROL_ID}
        value={scenario.breathShape}
        onChange={event => setScenario(current => ({
          ...current,
          breathShape: event.target.value as BrassDragonbornBreathShape,
        }))}
      >
        {BRASS_DRAGONBORN_BREATH_SHAPES.map(option => (
          <option key={option.shape} value={option.shape}>{option.sizeFeet}-foot {option.shape}</option>
        ))}
      </select>
      <label htmlFor={BRASS_DRAGONBORN_SAVE_CONTROL_ID}>Deterministic save branch</label>
      <select
        id={BRASS_DRAGONBORN_SAVE_CONTROL_ID}
        value={scenario.saveOutcome}
        onChange={event => setScenario(current => ({
          ...current,
          saveOutcome: event.target.value as BrassDragonbornSaveOutcome,
        }))}
      >
        <option value="failed">Failed save (full damage)</option>
        <option value="successful">Successful save (half damage)</option>
      </select>
      <Button type="button" onClick={handleBreath}>Use native Breath Weapon</Button>

      {/* These facts prove native actor values and mutable action/resource state. */}
      <p data-testid="brass-dragonborn-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; Fire resistance: {scenario.actor?.resistances?.join(', ') || 'none'}; Action {scenario.actor?.actionEconomy.action.remaining ?? 'unknown'} remaining; Breath uses {actorResource?.current ?? 'unknown'}/{actorResource?.max ?? 'unknown'}; Native ability {breathAbility?.id ?? 'missing'}.
      </p>
      <p data-testid="brass-dragonborn-resistance-result">
        Resistance packet: {scenario.damageType}; Raw {BRASS_DRAGONBORN_RESISTANCE_DAMAGE}; Final {scenario.resistanceFinalDamage ?? 'not resolved'}.
      </p>
      <p data-testid="brass-dragonborn-breath-result">
        Breath packet: {scenario.breathShape}; Save {scenario.breathSaveTotal ?? 'not resolved'}; Raw {scenario.breathRawDamage ?? 'not resolved'}; Final {scenario.breathFinalDamage ?? 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="brass-dragonborn-outcome">{scenario.outcome}</p>

      {/* This statement is the honest boundary around geometry and future flight. */}
      <p data-testid="brass-dragonborn-boundary">
        Boundary: the canonical cone/line choice, Attack action replacement, save, resource, and damage transaction run here; native map AoE targeting/placement is not claimed, Breath Weapon is a race feature rather than a spell, and Draconic Flight remains an explicit deferred boundary.
      </p>
    </section>
  );
};

// Changing the parent reset count remounts this content and restores actor,
// action, resource, target HP, and result state to the production baseline.
export const BrassDragonbornRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <BrassDragonbornRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires one exact named registration export. Keeping it
// local avoids central registry conflicts with other Race workers.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'brass-dragonborn-resistance-breath',
  raceId: 'brass_dragonborn',
  label: 'Brass Dragonborn Resistance and Breath Weapon',
  description: 'Resolve canonical fire resistance and Breath Weapon through native combat helpers.',
  Component: BrassDragonbornRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
