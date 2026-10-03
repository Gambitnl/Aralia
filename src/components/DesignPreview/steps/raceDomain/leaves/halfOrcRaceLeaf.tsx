// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 14/08/2026, 02:27:59
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
import { DamageCommand } from '../../../../../commands/effects/DamageCommand';
import type { CommandContext } from '../../../../../commands/base/SpellCommand';
import { buildRacialTraitLibrary } from '../../../../../data/races/racialTraits';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { createMockCombatState, createMockGameState } from '../../../../../utils/core';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { CombatCharacter } from '../../../../../types/combat';
import type { DamageEffect } from '../../../../../types/spells';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Half-Orc race a deterministic Savage Attacks
 * comparison in the Tactical Sandbox Race domain.
 *
 * The actor is assembled through the production quick-character and racial
 * parser path. Each comparison calls the production DamageCommand, which owns
 * critical dice, the Savage Attacks extra die, target HP, and combat logging.
 * The panel also shows canonical Vision and Relentless Endurance facts and the
 * exact reducer boundary that currently prevents Half-Orc endurance rescue.
 *
 * Called by: raceDomainRegistry.ts through automatic ./leaves discovery.
 * Depends on: canonical Half-Orc data, the racial parser, production combat
 * assembly, DamageCommand, and the Race domain event/reset contract.
 */

// ============================================================================
// Canonical Half-Orc Facts And Resource Keys
// ============================================================================
// These constants identify only canonical trait/resource names and deterministic
// control values. The displayed rule wording always comes from the Race object.
// ============================================================================

export const HALF_ORC_ACTOR_ID = 'half-orc-savage-attacks-actor';
export const HALF_ORC_TARGET_ID = 'half-orc-savage-attacks-target';
export const HALF_ORC_SCENARIO_LEVEL = 5;
export const HALF_ORC_TARGET_HP = 30;
export const HALF_ORC_TARGET_AC = 15;
export const HALF_ORC_WEAPON_DAMAGE_DICE = '1d6';
export const HALF_ORC_FIXED_DAMAGE_FACE = 1;
export const HALF_ORC_ENDURANCE_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'half_orc__relentless_endurance__resource',
);
export const ORC_REDUCER_ENDURANCE_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'orc__relentless_endurance__resource',
);

export type HalfOrcDamageScenarioId = 'melee-critical' | 'melee-normal' | 'ranged-critical';

export const HALF_ORC_DAMAGE_SCENARIOS: readonly {
  id: HalfOrcDamageScenarioId;
  label: string;
  description: string;
}[] = [
  {
    id: 'melee-critical',
    label: 'Melee critical',
    description: 'Critical melee weapon hit: the native rider should add one weapon die.',
  },
  {
    id: 'melee-normal',
    label: 'Normal melee hit',
    description: 'Otherwise identical normal melee hit: no critical rider should apply.',
  },
  {
    id: 'ranged-critical',
    label: 'Ranged critical',
    description: 'Otherwise identical ranged critical: Savage Attacks should not apply.',
  },
];

const HALF_ORC_VISION_TRAIT = 'Vision';
const HALF_ORC_RELENTLESS_ENDURANCE_TRAIT = 'Relentless Endurance';
const HALF_ORC_SAVAGE_ATTACKS_TRAIT = 'Savage Attacks';

/** Find one named trait in the Race supplied by the active roster. */
export function getCanonicalHalfOrcTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Return the canonical Vision wording used for the darkvision fact. */
export function getCanonicalHalfOrcVisionTrait(race: Race): string | null {
  return getCanonicalHalfOrcTrait(race, HALF_ORC_VISION_TRAIT);
}

/** Return the canonical Relentless Endurance wording shown beside its gap. */
export function getCanonicalHalfOrcRelentlessEnduranceTrait(race: Race): string | null {
  return getCanonicalHalfOrcTrait(race, HALF_ORC_RELENTLESS_ENDURANCE_TRAIT);
}

/** Return the canonical Savage Attacks wording used by the native damage path. */
export function getCanonicalHalfOrcSavageAttacksTrait(race: Race): string | null {
  return getCanonicalHalfOrcTrait(race, HALF_ORC_SAVAGE_ATTACKS_TRAIT);
}

/** Read the canonical 60-foot range instead of maintaining a second sense table. */
export function getCanonicalHalfOrcDarkvisionRangeFeet(race: Race): number | null {
  const visionTrait = getCanonicalHalfOrcVisionTrait(race);
  const range = visionTrait?.match(/within\s+(\d+)\s+feet/i)?.[1];
  return range ? Number(range) : null;
}

/** Confirm the visible rule facts before a scenario can claim to be Half-Orc proof. */
export function hasCanonicalHalfOrcFeatures(race: Race): boolean {
  const vision = getCanonicalHalfOrcVisionTrait(race);
  const endurance = getCanonicalHalfOrcRelentlessEnduranceTrait(race);
  const savageAttacks = getCanonicalHalfOrcSavageAttacksTrait(race);
  return race.id === 'half_orc'
    && race.name === 'Half-Orc'
    && !!vision
    && /within\s+60\s+feet/i.test(vision)
    && !!endurance
    && /reduced to 0 hit points/i.test(endurance)
    && /1 hit point/i.test(endurance)
    && !!savageAttacks
    && /critical hit with a melee weapon attack/i.test(savageAttacks)
    && /one additional time/i.test(savageAttacks);
}

/** Read the parser record that turns the canonical trait into Savage Attacks. */
export function getHalfOrcSavageAttacksParserTrait(race: Race) {
  const parsedTraits = buildRacialTraitLibrary({ [race.id]: race }).byRaceId[race.id] ?? [];
  return parsedTraits.find(
    trait => trait.type !== 'spell'
      && trait.traitName === HALF_ORC_SAVAGE_ATTACKS_TRAIT
      && trait.modifierBuckets?.savageAttacks === true,
  ) ?? null;
}

/** Confirm the production parser, rather than this leaf, owns the modifier. */
export function hasHalfOrcSavageAttacksParserProjection(character: PlayerCharacter | null): boolean {
  return character?.modifiers?.savageAttacks === true;
}

// ============================================================================
// Production Actor And DamageCommand Adapter
// ============================================================================
// This adapter supplies only stable IDs, HP/AC fixtures, and the critical/range
// context that DamageCommand needs. It does not reimplement Savage Attacks.
// ============================================================================

const HALF_ORC_ACTOR_CONFIG = {
  name: 'Half-Orc · Savage Attacks Tester',
  raceId: 'half_orc',
  classId: 'fighter',
  level: HALF_ORC_SCENARIO_LEVEL,
  stats: [16, 12, 14, 10, 10, 10] as [number, number, number, number, number, number],
};

const HALF_ORC_TARGET_CONFIG = {
  name: 'Half-Orc Savage Attacks Target',
  raceId: 'human',
  classId: 'fighter',
  level: 1,
  stats: [10, 10, 10, 10, 10, 10] as [number, number, number, number, number, number],
};

export interface HalfOrcScenarioState {
  parserCharacter: PlayerCharacter | null;
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  results: Partial<Record<HalfOrcDamageScenarioId, HalfOrcDamageResolution>>;
  outcome: string;
}

export interface HalfOrcDamageResolution {
  status: 'resolved' | 'rejected';
  scenarioId: HalfOrcDamageScenarioId;
  damage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  savageAttacksExtraDamage: number;
  savageAttacksLog: string | null;
  damageLog: string | null;
  combatLogMessages: string[];
}

/** Build the player actor through quick-character creation and the racial parser. */
function createParsedHalfOrcActor(race: Race): { parserCharacter: PlayerCharacter; actor: CombatCharacter } | null {
  const quickCharacter = createQuickCharacter(HALF_ORC_ACTOR_CONFIG);
  if (!quickCharacter) return null;

  // The selected ACTIVE_RACES record is authoritative for this preview, while
  // applyRacialSpellGrantsByLevel remains the production parser and projection path.
  const parserCharacter = applyRacialSpellGrantsByLevel(
    { ...quickCharacter, race },
    HALF_ORC_SCENARIO_LEVEL,
  );
  if (!hasHalfOrcSavageAttacksParserProjection(parserCharacter)) return null;

  // This bridge carries parser-owned modifiers into the combat snapshot that
  // DamageCommand reads at execution time.
  const actor = createPlayerCombatCharacter(parserCharacter);
  return {
    parserCharacter,
    actor: {
      ...actor,
      id: HALF_ORC_ACTOR_ID,
      name: `${race.name} · Savage Attacks Tester`,
      position: { x: 2, y: 2 },
      team: 'player',
    },
  };
}

/** Build a disposable target through the same production combat bridge. */
function createHalfOrcTarget(): CombatCharacter | null {
  const quickTarget = createQuickCharacter(HALF_ORC_TARGET_CONFIG);
  if (!quickTarget) return null;

  const target = createPlayerCombatCharacter(quickTarget);
  return {
    ...target,
    id: HALF_ORC_TARGET_ID,
    name: 'Target Dummy · AC 15 · 30 HP',
    position: { x: 3, y: 2 },
    team: 'enemy',
    armorClass: HALF_ORC_TARGET_AC,
    baseAC: HALF_ORC_TARGET_AC,
    currentHP: HALF_ORC_TARGET_HP,
    maxHP: HALF_ORC_TARGET_HP,
    abilities: [],
  };
}

/** Create a fresh command context for one comparison without changing rules. */
function createDamageContext(
  actor: CombatCharacter,
  target: CombatCharacter,
  scenarioId: HalfOrcDamageScenarioId,
): CommandContext {
  const isCritical = scenarioId !== 'melee-normal';
  return {
    spellId: `half-orc-${scenarioId}`,
    spellName: 'Longsword',
    castAtLevel: 1,
    caster: actor,
    targets: [target],
    gameState: createMockGameState(),
    isCritical,
    weaponProperties: scenarioId === 'ranged-critical' ? ['ranged'] : ['melee'],
    damageRng: () => (HALF_ORC_FIXED_DAMAGE_FACE - 1) / 6,
    damageEventId: `half-orc-${scenarioId}-damage`,
  };
}

/** Resolve one mode through native DamageCommand and retain its observable logs. */
export async function resolveHalfOrcDamage(
  scenario: HalfOrcScenarioState,
  scenarioId: HalfOrcDamageScenarioId,
): Promise<HalfOrcScenarioState> {
  const actor = scenario.actor;
  const target = scenario.target;
  if (!actor || !target) {
    return {
      ...scenario,
      outcome: `${scenarioId} rejected: production actor or target assembly is unavailable.`,
      results: {
        ...scenario.results,
        [scenarioId]: {
          status: 'rejected',
          scenarioId,
          damage: 0,
          targetHpBefore: target?.currentHP ?? 0,
          targetHpAfter: target?.currentHP ?? 0,
          savageAttacksExtraDamage: 0,
          savageAttacksLog: null,
          damageLog: null,
          combatLogMessages: [],
        },
      },
    };
  }

  const state = createMockCombatState({ characters: [actor, target], combatLog: [] });
  const effect: DamageEffect = {
    type: 'DAMAGE',
    damage: { dice: HALF_ORC_WEAPON_DAMAGE_DICE, type: 'Slashing' },
    trigger: { type: 'immediate' },
    condition: { type: 'hit' },
  };
  const result = await new DamageCommand(
    effect,
    createDamageContext(actor, target, scenarioId),
  ).execute(state);
  const updatedTarget = result.characters.find(character => character.id === HALF_ORC_TARGET_ID) ?? target;
  const combatLogMessages = result.combatLog.map(entry => entry.message);
  const savageAttacksLog = combatLogMessages.find(message => /Savage Attacks adds/i.test(message)) ?? null;
  const damageLog = result.combatLog.find(entry => entry.type === 'damage')?.message ?? null;
  const damage = target.currentHP - updatedTarget.currentHP;
  const savageAttacksExtraDamage = savageAttacksLog?.match(/adds \+(\d+)/i)?.[1];
  const resolution: HalfOrcDamageResolution = {
    status: 'resolved',
    scenarioId,
    damage,
    targetHpBefore: target.currentHP,
    targetHpAfter: updatedTarget.currentHP,
    savageAttacksExtraDamage: savageAttacksExtraDamage ? Number(savageAttacksExtraDamage) : 0,
    savageAttacksLog,
    damageLog,
    combatLogMessages,
  };

  return {
    ...scenario,
    results: { ...scenario.results, [scenarioId]: resolution },
    outcome: `${scenarioId} resolved through DamageCommand: ${damage} damage; target HP ${target.currentHP} → ${updatedTarget.currentHP}.`,
  };
}

/** Restore the exact actor and target baseline used by every independent mode. */
export function createHalfOrcScenario(race: Race): HalfOrcScenarioState {
  if (!hasCanonicalHalfOrcFeatures(race) || !getHalfOrcSavageAttacksParserTrait(race)) {
    return {
      parserCharacter: null,
      actor: null,
      target: null,
      results: {},
      outcome: 'Half-Orc comparison unavailable: canonical trait or parser linkage is incomplete.',
    };
  }

  const assembled = createParsedHalfOrcActor(race);
  const target = createHalfOrcTarget();
  if (!assembled || !target) {
    return {
      parserCharacter: assembled?.parserCharacter ?? null,
      actor: assembled?.actor ?? null,
      target,
      results: {},
      outcome: 'Half-Orc comparison unavailable: production quick-character or combat assembly failed.',
    };
  }

  const enduranceResource = assembled.parserCharacter.limitedUses?.[HALF_ORC_ENDURANCE_RESOURCE_ID];
  return {
    parserCharacter: assembled.parserCharacter,
    actor: assembled.actor,
    target,
    results: {},
    outcome: `Ready: ${race.name}; parser Savage Attacks native; target HP ${target.currentHP}/${target.maxHP}; damage dice ${HALF_ORC_WEAPON_DAMAGE_DICE}; fixed damage face ${HALF_ORC_FIXED_DAMAGE_FACE}; Half-Orc endurance resource ${enduranceResource?.current ?? 'missing'}/${enduranceResource?.max ?? 'missing'}.`,
  };
}

// ============================================================================
// Visible Half-Orc Leaf Surface
// ============================================================================
// Each button runs one fresh DamageCommand comparison and reports the same
// result through the shell event log. Parent resetCount remounts this content.
// ============================================================================

function HalfOrcRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createHalfOrcScenario(race));
  const visionTrait = getCanonicalHalfOrcVisionTrait(race);
  const enduranceTrait = getCanonicalHalfOrcRelentlessEnduranceTrait(race);
  const savageAttacksTrait = getCanonicalHalfOrcSavageAttacksTrait(race);
  const darkvisionRange = getCanonicalHalfOrcDarkvisionRangeFeet(race);
  const enduranceResource = scenario.parserCharacter?.limitedUses?.[HALF_ORC_ENDURANCE_RESOURCE_ID];

  const handleResolve = (scenarioId: HalfOrcDamageScenarioId) => {
    void resolveHalfOrcDamage(scenario, scenarioId).then(nextScenario => {
      // Merge independent button results so rapid comparisons do not overwrite
      // one another when each native command resolves from the same baseline.
      setScenario(currentScenario => ({
        ...nextScenario,
        results: { ...currentScenario.results, ...nextScenario.results },
      }));
      const resolution = nextScenario.results[scenarioId];
      onScenarioEvent(resolution?.status === 'resolved'
        ? `Half-Orc ${scenarioId.toUpperCase()} RESOLVED: ${resolution.damage} damage; target HP ${resolution.targetHpBefore} → ${resolution.targetHpAfter}; ${resolution.savageAttacksLog ?? 'no Savage Attacks extra-die log.'}`
        : `Half-Orc ${scenarioId.toUpperCase()} REJECTED: ${nextScenario.outcome}`);
    });
  };

  return (
    <section aria-labelledby="half-orc-race-title" data-testid="half-orc-race-leaf">
      <h4 id="half-orc-race-title">Half-Orc · Savage Attacks</h4>

      <p data-testid="half-orc-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; parser Savage Attacks {hasHalfOrcSavageAttacksParserProjection(scenario.parserCharacter) ? 'native' : 'missing'}; deterministic damage {HALF_ORC_FIXED_DAMAGE_FACE} on each d6 face.
      </p>

      <div aria-label="Half-Orc Savage Attacks comparisons">
        {HALF_ORC_DAMAGE_SCENARIOS.map(option => (
          <Button key={option.id} type="button" onClick={() => handleResolve(option.id)}>
            Resolve {option.label}
          </Button>
        ))}
      </div>

      <p aria-live="polite" role="status" data-testid="half-orc-outcome">{scenario.outcome}</p>

      <div data-testid="half-orc-results">
        {HALF_ORC_DAMAGE_SCENARIOS.map(option => {
          const result = scenario.results[option.id];
          return (
            <p key={option.id} data-testid={`half-orc-result-${option.id}`}>
              {option.label}: {result
                ? `${result.damage} damage; target HP ${result.targetHpBefore} → ${result.targetHpAfter}; extra Savage Attacks die ${result.savageAttacksExtraDamage > 0 ? `+${result.savageAttacksExtraDamage}` : 'none'}; DamageCommand log ${result.damageLog ?? 'missing'}; extra-die log ${result.savageAttacksLog ?? 'none'}.`
                : 'not resolved.'}
            </p>
          );
        })}
      </div>

      <div data-testid="half-orc-canonical-facts">
        <strong>Canonical Half-Orc facts:</strong>
        <ul>
          <li>Darkvision: {darkvisionRange ?? 'unavailable'} ft from the canonical Vision trait.</li>
          <li>Vision source: {visionTrait ?? 'unavailable'}</li>
          <li>Relentless Endurance: {enduranceTrait ?? 'unavailable'}</li>
          <li>Savage Attacks: {savageAttacksTrait ?? 'unavailable'}</li>
          <li>Parser resource: {HALF_ORC_ENDURANCE_RESOURCE_ID}; current {enduranceResource?.current ?? 'missing'} / max {enduranceResource?.max ?? 'missing'}.</li>
        </ul>
      </div>

      <p data-testid="half-orc-endurance-boundary">
        Runtime boundary: characterReducer currently checks only {ORC_REDUCER_ENDURANCE_RESOURCE_ID}. The parser exposes {HALF_ORC_ENDURANCE_RESOURCE_ID}, but this leaf does not fake a 1 HP rescue or claim native Half-Orc endurance until the reducer accepts the Half-Orc resource. DamageCommand proof is limited to Savage Attacks damage, target HP, and combat log output.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** Parent resetCount remounts the leaf, restoring its baseline and result list. */
export function HalfOrcRaceLeaf(props: RaceDomainLeafProps) {
  return <HalfOrcRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

/** Automatic discovery consumes this exact named registration export. */
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'half-orc-savage-attacks',
  raceId: 'half_orc',
  label: 'Half-Orc · Savage Attacks',
  description: 'Native DamageCommand comparison for melee critical, normal melee, and ranged critical damage with canonical endurance boundary facts.',
  Component: HalfOrcRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
