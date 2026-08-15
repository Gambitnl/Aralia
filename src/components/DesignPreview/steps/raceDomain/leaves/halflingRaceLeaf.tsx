// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 14/08/2026, 02:15:05
 * Dependents: None (Orphan)
 * Imports: 9 files
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
  calculateProficiencyBonus,
  rollSavingThrow,
  type SaveAdvantageModifier,
  type SavingThrowResult,
} from '../../../../../utils/character/savingThrowUtils';
import { createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { CombatCharacter } from '../../../../../types/combat';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { SavingThrowAbility } from '../../../../../types/spellEffectTypes';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Halfling one inspectable Brave saving-throw transaction.
 *
 * The leaf assembles a disposable actor through the production quick-character and combat
 * bridges, keeps the racial parser's raw Brave projection visible, and compares one ordinary
 * save with a Frightened-context save through native dice and saving-throw helpers. The parser
 * currently produces a broad free-text advantage, so the leaf narrows only this canonical
 * context with a structured adapter rather than claiming every save is advantaged.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: the Race supplied by ACTIVE_RACES, production character assembly, the racial
 * parser, native saving-throw/dice helpers, and the shared Race-domain contract.
 */

// ============================================================================
// Canonical Halfling Facts
// ============================================================================
// These readers always use the Race supplied by the shell. A changed or incomplete
// canonical record rejects the demonstration instead of allowing copied race facts to drift.
// ============================================================================

export const HALFLING_ACTOR_ID = 'halfling-brave-actor';
export const HALFLING_SCENARIO_LEVEL = 5;
export const HALFLING_SAVE_DC = 12;

const HALFLING_SIZE_TRAIT = 'Size';
const HALFLING_SPEED_TRAIT = 'Speed';
const HALFLING_BRAVE_TRAIT = 'Brave';
const HALFLING_NIMBLENESS_TRAIT = 'Halfling Nimbleness';
const HALFLING_LUCK_TRAIT = 'Luck';
const HALFLING_STEALTHY_TRAIT = 'Naturally Stealthy';

/** Find one named trait without importing another race leaf or duplicating race data. */
export function getCanonicalHalflingTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Read the canonical size category shown in the facts panel. */
export function getCanonicalHalflingSize(race: Race): string | null {
  return getCanonicalHalflingTrait(race, HALFLING_SIZE_TRAIT)?.match(/^Size:\s*([^(:]+)/i)?.[1]?.trim() ?? null;
}

/** Read the canonical walking speed shown in the facts panel. */
export function getCanonicalHalflingSpeedFeet(race: Race): number | null {
  const speedTrait = getCanonicalHalflingTrait(race, HALFLING_SPEED_TRAIT);
  const speed = speedTrait?.match(/(\d+)\s+feet/i)?.[1];
  return speed ? Number(speed) : null;
}

/** Confirm every canonical fact surfaced by this leaf is still present. */
export function hasCanonicalHalflingFeatures(race: Race): boolean {
  const size = getCanonicalHalflingSize(race);
  const speed = getCanonicalHalflingSpeedFeet(race);
  const brave = getCanonicalHalflingTrait(race, HALFLING_BRAVE_TRAIT);
  const nimbleness = getCanonicalHalflingTrait(race, HALFLING_NIMBLENESS_TRAIT);
  const luck = getCanonicalHalflingTrait(race, HALFLING_LUCK_TRAIT);
  const stealthy = getCanonicalHalflingTrait(race, HALFLING_STEALTHY_TRAIT);

  return race.id === 'halfling'
    && race.name === 'Halfling'
    && size === 'Small'
    && speed === 30
    && !!brave
    && /advantage on saving throws/i.test(brave)
    && /avoid or end the Frightened condition/i.test(brave)
    && !!nimbleness
    && /size larger than you/i.test(nimbleness)
    && !!luck
    && /reroll the die/i.test(luck)
    && /Mechanical implementation of reroll not yet in place/i.test(luck)
    && !!stealthy
    && /Hide action/i.test(stealthy);
}

/** Return the parser-created raw Brave advantage projection from the player actor. */
export function hasHalflingBraveParserProjection(
  actor: Pick<PlayerCharacter, 'modifiers'> | Pick<CombatCharacter, 'modifiers'> | null,
): boolean {
  return actor?.modifiers?.advantage.some(modifier => (
    /saving throws?/i.test(modifier) && /frightened/i.test(modifier)
  )) ?? false;
}

// ============================================================================
// Narrow Brave Context Adapter
// ============================================================================
// The production parser exposes Brave as broad free text. Native saving throws
// need an effect tag to narrow that advantage to the canonical Frightened context,
// so this adapter supplies only that missing context and leaves condition lifecycle
// outside this leaf.
// ============================================================================

/** Return the structured native modifier for a canonical Frightened save. */
export function getHalflingBraveSaveAdapter(race: Race): SaveAdvantageModifier | null {
  const braveTrait = getCanonicalHalflingTrait(race, HALFLING_BRAVE_TRAIT);
  if (!braveTrait || !/advantage on saving throws/i.test(braveTrait) || !/Frightened/i.test(braveTrait)) {
    return null;
  }

  return {
    type: 'advantage',
    context: 'saving_throw',
    against: ['frightened'],
    source: 'Brave (canonical Frightened context)',
  };
}

/** Remove only the broad raw Brave projection before comparing save contexts. */
export function removeHalflingBraveParserProjection(actor: CombatCharacter): CombatCharacter {
  const modifiers = actor.modifiers ?? { advantage: [], disadvantage: [], bonuses: [] };

  return {
    ...actor,
    modifiers: {
      ...modifiers,
      // This keeps the ordinary comparison genuinely ordinary and prevents the
      // legacy text matcher from applying Brave to every saving throw.
      advantage: modifiers.advantage.filter(modifier => !(
        /saving throws?/i.test(modifier) && /frightened/i.test(modifier)
      )),
      disadvantage: [...modifiers.disadvantage],
      bonuses: [...modifiers.bonuses],
    },
  };
}

// ============================================================================
// Production Actor And Deterministic Save Transaction
// ============================================================================
// The actor is created by the same quick-character and persistent-to-combat
// bridge used by sandbox scenarios. Only the RNG stream is pinned for proof;
// ability modifiers, save proficiency, and native dice selection remain shared.
// ============================================================================

const HALFLING_ACTOR_CONFIG = {
  name: 'Halfling Brave Tester',
  raceId: 'halfling',
  classId: 'fighter',
  level: HALFLING_SCENARIO_LEVEL,
  stats: [10, 10, 10, 10, 10, 10] as [number, number, number, number, number, number],
};

export interface HalflingSaveSnapshot {
  context: 'ordinary non-Frightened save' | 'avoid/end Frightened';
  d20Rolls: readonly number[];
  save: SavingThrowResult;
}

export interface HalflingSaveResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'parser_projection_missing' | 'context_adapter_missing';
  ordinary: HalflingSaveSnapshot | null;
  frightened: HalflingSaveSnapshot | null;
}

export interface HalflingScenarioState {
  actor: PlayerCharacter | null;
  combatActor: CombatCharacter | null;
  outcome: string;
  lastResolution: HalflingSaveResolution | null;
}

/** Build a visible rejection without inventing partial mechanic state. */
function unavailableHalflingScenario(
  reason: HalflingSaveResolution['reason'],
  outcome: string,
): HalflingScenarioState {
  return {
    actor: null,
    combatActor: null,
    outcome,
    lastResolution: {
      status: 'rejected',
      reason,
      ordinary: null,
      frightened: null,
    },
  };
}

/** Assemble and parse the production actor used by both save branches. */
export function createHalflingBraveScenario(race: Race): HalflingScenarioState {
  if (!hasCanonicalHalflingFeatures(race)) {
    return unavailableHalflingScenario(
      'canonical_trait_missing',
      'Brave unavailable: canonical Halfling facts no longer contain the demonstrated rule set.',
    );
  }

  const quickCharacter = createQuickCharacter(HALFLING_ACTOR_CONFIG);
  if (!quickCharacter) {
    return unavailableHalflingScenario(
      'assembly_unavailable',
      'Brave unavailable: production quick-character assembly rejected the canonical Halfling actor.',
    );
  }

  // This parser call is the source of the actor's raw Brave modifier. The leaf
  // does not turn Halfling Nimbleness, Luck, or Naturally Stealthy into fake actions.
  const parsedCharacter = applyRacialSpellGrantsByLevel(
    { ...quickCharacter, race },
    HALFLING_SCENARIO_LEVEL,
  );
  if (!hasHalflingBraveParserProjection(parsedCharacter)) {
    return unavailableHalflingScenario(
      'parser_projection_missing',
      'Brave unavailable: the production racial parser did not expose the canonical save projection.',
    );
  }

  // The native combat bridge supplies stats, save proficiencies, and modifier
  // lists consumed by rollSavingThrow.
  const combatActor = createPlayerCombatCharacter({
    ...parsedCharacter,
    id: HALFLING_ACTOR_ID,
  });

  return {
    actor: { ...parsedCharacter, id: HALFLING_ACTOR_ID },
    combatActor,
    outcome: 'Ready: production Halfling actor; ordinary and Frightened-context saving throws are available.',
    lastResolution: null,
  };
}

/** Resolve the ordinary baseline and the canonical Brave save with pinned faces. */
export function resolveHalflingBrave(
  scenario: HalflingScenarioState,
  race: Race,
  rng: () => number = Math.random,
): HalflingScenarioState {
  const adapter = getHalflingBraveSaveAdapter(race);
  if (!scenario.actor || !scenario.combatActor) {
    return {
      ...scenario,
      outcome: 'Brave comparison rejected: the production actor is unavailable.',
      lastResolution: { status: 'rejected', reason: 'assembly_unavailable', ordinary: null, frightened: null },
    };
  }
  if (!hasHalflingBraveParserProjection(scenario.actor)) {
    return {
      ...scenario,
      outcome: 'Brave comparison rejected: the parser-backed save projection is unavailable.',
      lastResolution: { status: 'rejected', reason: 'parser_projection_missing', ordinary: null, frightened: null },
    };
  }
  if (!adapter) {
    return {
      ...scenario,
      outcome: 'Brave comparison rejected: the canonical Frightened context adapter is unavailable.',
      lastResolution: { status: 'rejected', reason: 'context_adapter_missing', ordinary: null, frightened: null },
    };
  }

  // Capture one common low face and one high face. The ordinary branch consumes
  // only the low face; the Brave branch consumes both through native advantage.
  const firstRandom = rng();
  const secondRandom = rng();
  const ordinaryActor = removeHalflingBraveParserProjection(scenario.combatActor);
  const frightenedActor = removeHalflingBraveParserProjection(scenario.combatActor);
  const frightenedRandomValues = [firstRandom, secondRandom];
  const ordinarySave = rollSavingThrow(
    ordinaryActor,
    'Wisdom' as SavingThrowAbility,
    HALFLING_SAVE_DC,
    undefined,
    { tags: ['ordinary'] },
    undefined,
    { rng: () => firstRandom },
  );
  const frightenedSave = rollSavingThrow(
    frightenedActor,
    'Wisdom' as SavingThrowAbility,
    HALFLING_SAVE_DC,
    undefined,
    { tags: ['frightened'] },
    [adapter],
    { rng: () => frightenedRandomValues.shift() ?? secondRandom },
  );
  const d20Rolls = [
    Math.floor(firstRandom * 20) + 1,
    Math.floor(secondRandom * 20) + 1,
  ];
  const ordinary: HalflingSaveSnapshot = {
    context: 'ordinary non-Frightened save',
    d20Rolls: [d20Rolls[0]],
    save: ordinarySave,
  };
  const frightened: HalflingSaveSnapshot = {
    context: 'avoid/end Frightened',
    d20Rolls,
    save: frightenedSave,
  };

  return {
    ...scenario,
    outcome: `Brave resolved: ordinary ${ordinarySave.total} (${ordinarySave.success ? 'success' : 'failure'}); Frightened kept ${frightenedSave.roll} from ${d20Rolls.join(' / ')} for ${frightenedSave.total} (${frightenedSave.success ? 'success' : 'failure'}).`,
    lastResolution: { status: 'resolved', reason: 'resolved', ordinary, frightened },
  };
}

/** Create the visible proof sequence: ordinary 2, then Frightened 2 and 20. */
export function createHalflingDeterministicRng(): () => number {
  const values = [0.05, 0.95];
  return () => values.shift() ?? 0.5;
}

// ============================================================================
// Visible Race Leaf Surface
// ============================================================================
// The panel shows the tested transaction, canonical facts, and exact unsupported
// boundary. The shell's keyed reset remounts this content and clears its result.
// ============================================================================

function HalflingRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createHalflingBraveScenario(race));
  const size = getCanonicalHalflingSize(race);
  const speed = getCanonicalHalflingSpeedFeet(race);
  const braveTrait = getCanonicalHalflingTrait(race, HALFLING_BRAVE_TRAIT);
  const nimblenessTrait = getCanonicalHalflingTrait(race, HALFLING_NIMBLENESS_TRAIT);
  const luckTrait = getCanonicalHalflingTrait(race, HALFLING_LUCK_TRAIT);
  const stealthyTrait = getCanonicalHalflingTrait(race, HALFLING_STEALTHY_TRAIT);

  // Publish the same native result shown in the panel to the shell event log.
  const handleResolve = () => {
    // Keep the button repeatable so the visible panel always proves the same
    // ordinary-versus-advantaged transaction instead of depending on randomness.
    const nextScenario = resolveHalflingBrave(
      scenario,
      race,
      createHalflingDeterministicRng(),
    );
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    if (resolution?.status === 'resolved') {
      onScenarioEvent(`Halfling BRAVE RESOLVED: ordinary face ${resolution.ordinary?.d20Rolls.join(' / ')} total ${resolution.ordinary?.save.total} ${resolution.ordinary?.save.success ? 'success' : 'failure'}; Frightened faces ${resolution.frightened?.d20Rolls.join(' / ')} kept ${resolution.frightened?.save.roll} total ${resolution.frightened?.save.total} ${resolution.frightened?.save.success ? 'success' : 'failure'}.`);
    } else {
      onScenarioEvent(`Halfling BRAVE REJECTED: ${nextScenario.outcome}`);
    }
  };

  return (
    <section aria-labelledby="halfling-race-title" data-testid="halfling-race-leaf">
      <h4 id="halfling-race-title">Halfling · Brave</h4>

      <p data-testid="halfling-actor-facts">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; PB +{scenario.actor ? calculateProficiencyBonus(scenario.actor.level ?? 1) : 'unknown'}; Wisdom {scenario.combatActor?.stats.wisdom ?? 'unknown'}; parser Brave projection {hasHalflingBraveParserProjection(scenario.actor) ? 'native' : 'missing'}.
      </p>

      <Button type="button" variant="primary" size="sm" onClick={handleResolve}>
        Resolve Brave Frightened save
      </Button>

      <p aria-live="polite" role="status" data-testid="halfling-outcome">{scenario.outcome}</p>
      <div data-testid="halfling-save-result">
        {scenario.lastResolution?.status === 'resolved'
          ? <>
            <p>Ordinary non-Frightened context: d20 face {scenario.lastResolution.ordinary?.d20Rolls.join(' / ')}; modifier {scenario.lastResolution.ordinary ? scenario.lastResolution.ordinary.save.total - (scenario.lastResolution.ordinary.save.roll ?? 0) : 'unknown'}; total {scenario.lastResolution.ordinary?.save.total}; DC {scenario.lastResolution.ordinary?.save.dc}; {scenario.lastResolution.ordinary?.save.success ? 'success' : 'failure'}; one roll.</p>
            <p>Avoid/end Frightened context: d20 faces {scenario.lastResolution.frightened?.d20Rolls.join(' / ')}; kept face {scenario.lastResolution.frightened?.save.roll}; modifier {scenario.lastResolution.frightened ? scenario.lastResolution.frightened.save.total - (scenario.lastResolution.frightened.save.roll ?? 0) : 'unknown'}; total {scenario.lastResolution.frightened?.save.total}; DC {scenario.lastResolution.frightened?.save.dc}; {scenario.lastResolution.frightened?.save.success ? 'success' : 'failure'}; native advantage applied.</p>
          </>
          : 'No Brave save comparison resolved yet.'}
      </div>

      <div data-testid="halfling-canonical-facts">
        <strong>Canonical Halfling facts:</strong>
        <ul>
          <li>Size: {size ?? 'unavailable'}.</li>
          <li>Speed: {speed ?? 'unavailable'} feet.</li>
          <li>Brave: {braveTrait ?? 'unavailable'} The Frightened save is the demonstrated transaction.</li>
          <li>Halfling Nimbleness: {nimblenessTrait ?? 'unavailable'} Movement and occupancy are not simulated.</li>
          <li>Naturally Stealthy: {stealthyTrait ?? 'unavailable'} Hide enforcement is not simulated.</li>
          <li>Luck: {luckTrait ?? 'unavailable'} The canonical row says its mechanical reroll implementation is not yet in place.</li>
        </ul>
      </div>

      <p data-testid="halfling-boundary">
        Boundary: the production parser supplies the raw Brave projection, while this leaf derives only a canonical Frightened effect tag for native rollSavingThrow. It does not simulate condition application or removal, Luck rerolls, map movement, occupancy, Hide enforcement, or 2D/3D render proof.
      </p>
      <p data-testid="halfling-event-log" aria-live="polite">{state.eventLog.at(-1) ?? 'No Halfling scenario event logged yet.'}</p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** The shell's resetCount remounts the actor and clears the prior resolution. */
export function HalflingRaceLeaf(props: RaceDomainLeafProps) {
  return <HalflingRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

/** Automatic discovery consumes this exact named registration export. */
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'halfling-brave',
  raceId: 'halfling',
  label: 'Halfling · Brave',
  description: 'Production-backed Brave advantage on saves to avoid or end Frightened, compared with an otherwise identical ordinary save; Luck and movement-related traits remain explicit boundaries.',
  Component: HalflingRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
