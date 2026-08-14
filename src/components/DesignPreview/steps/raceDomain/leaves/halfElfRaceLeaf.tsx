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
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Half-Elf one inspectable Fey Ancestry save
 * transaction in the Race domain.
 *
 * It assembles a disposable actor through the production quick-character and
 * combat bridges, keeps the parser's raw Fey Ancestry projection visible, and
 * compares an ordinary save with a Charmed-context save through native dice and
 * saving-throw helpers. The parser does not carry condition context, so the
 * leaf derives one narrow `charmed` adapter from the canonical trait text.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: ACTIVE_RACES data supplied by the shell, production character
 * assembly, the racial parser, native saving-throw/dice helpers, and the Race
 * domain contract.
 */

// ============================================================================
// Canonical Half-Elf Facts
// ============================================================================
// These readers always use the Race supplied by the shell. A changed or
// incomplete canonical record rejects the demonstration instead of allowing a
// copied fact or hand-selected Character Forge choice to drift.
// ============================================================================

export const HALF_ELF_ACTOR_ID = 'half-elf-fey-ancestry-actor';
export const HALF_ELF_SCENARIO_LEVEL = 5;
export const HALF_ELF_CHARMED_SAVE_DC = 15;

const HALF_ELF_VISION_TRAIT = 'Vision';
const HALF_ELF_FEY_ANCESTRY_TRAIT = 'Fey Ancestry';
const HALF_ELF_SKILL_VERSATILITY_TRAIT = 'Skill Versatility';

/** Find one named trait without importing or depending on another leaf. */
export function getCanonicalHalfElfTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Return the canonical Vision wording used by the facts panel. */
export function getCanonicalHalfElfVisionTrait(race: Race): string | null {
  return getCanonicalHalfElfTrait(race, HALF_ELF_VISION_TRAIT);
}

/** Return the canonical Fey Ancestry wording used by the save adapter. */
export function getCanonicalHalfElfFeyAncestryTrait(race: Race): string | null {
  return getCanonicalHalfElfTrait(race, HALF_ELF_FEY_ANCESTRY_TRAIT);
}

/** Return the canonical two-skill choice wording without choosing skills. */
export function getCanonicalHalfElfSkillVersatilityTrait(race: Race): string | null {
  return getCanonicalHalfElfTrait(race, HALF_ELF_SKILL_VERSATILITY_TRAIT);
}

/** Read the 60-foot range from the canonical Vision trait. */
export function getCanonicalHalfElfDarkvisionRangeFeet(race: Race): number | null {
  const visionTrait = getCanonicalHalfElfVisionTrait(race);
  const range = visionTrait?.match(/within\s+(\d+)\s+feet/i)?.[1];
  return range ? Number(range) : null;
}

/** Confirm every canonical fact surfaced by this leaf is still present. */
export function hasCanonicalHalfElfFeatures(race: Race): boolean {
  const vision = getCanonicalHalfElfVisionTrait(race);
  const feyAncestry = getCanonicalHalfElfFeyAncestryTrait(race);
  const skillVersatility = getCanonicalHalfElfSkillVersatilityTrait(race);
  const abilityBonuses = race.abilityBonuses ?? [];
  const charismaBonus = abilityBonuses.some(
    bonus => bonus.ability === 'Charisma' && bonus.bonus === 2,
  );
  const flexibleBonuses = abilityBonuses.some(
    bonus => bonus.ability === 'Any' && bonus.bonus === 1 && bonus.choiceCount === 2,
  );

  return race.id === 'half_elf'
    && race.name === 'Half-Elf'
    && !!vision
    && /60 feet/i.test(vision)
    && /darkness/i.test(vision)
    && !!feyAncestry
    && /advantage on saving throws/i.test(feyAncestry)
    && /charm/i.test(feyAncestry)
    && /sleep/i.test(feyAncestry)
    && !!skillVersatility
    && /two skills of your choice/i.test(skillVersatility)
    && charismaBonus
    && flexibleBonuses;
}

/** Format canonical ability bonuses without selecting the flexible choices. */
export function getCanonicalHalfElfAbilityBonusFacts(race: Race): readonly string[] {
  const abilityBonuses = race.abilityBonuses ?? [];
  return abilityBonuses.map(bonus => (
    bonus.ability === 'Any'
      ? `Any +${bonus.bonus} (choose ${bonus.choiceCount ?? 1})`
      : `${bonus.ability} +${bonus.bonus}`
  ));
}

// ============================================================================
// Narrow Fey Ancestry Context Adapter
// ============================================================================
// The parser exposes the canonical text as a broad free-text advantage. Native
// saving throws need an effect tag to narrow that advantage to Charmed, so this
// adapter supplies only that missing context and leaves condition lifecycle and
// sleep handling outside this leaf.
// ============================================================================

function isFeyAncestrySaveProjection(modifier: string): boolean {
  return /saving throws?/i.test(modifier) && /charm/i.test(modifier);
}

/** Return the structured native modifier for a canonical Charmed save. */
export function getHalfElfFeyAncestrySaveAdapter(
  race: Race,
): SaveAdvantageModifier | null {
  const trait = getCanonicalHalfElfFeyAncestryTrait(race);
  if (!trait || !/advantage on saving throws/i.test(trait) || !/charm/i.test(trait)) {
    return null;
  }

  return {
    type: 'advantage',
    context: 'saving_throw',
    against: ['charmed'],
    source: 'Fey Ancestry (canonical Charmed context)',
  };
}

/** Prove that production parsing exposed the canonical save projection. */
export function hasHalfElfFeyAncestryParserProjection(
  character: Pick<PlayerCharacter, 'modifiers'> | Pick<CombatCharacter, 'modifiers'> | null,
): boolean {
  return character?.modifiers?.advantage.some(isFeyAncestrySaveProjection) ?? false;
}

/** Remove only the raw projection before the ordinary comparison. */
export function applyHalfElfFeyAncestryContext(actor: CombatCharacter): CombatCharacter {
  const modifiers = actor.modifiers ?? { advantage: [], disadvantage: [], bonuses: [] };
  const contextFreeAdvantages = modifiers.advantage.filter(
    modifier => !isFeyAncestrySaveProjection(modifier),
  );

  return {
    ...actor,
    modifiers: {
      ...modifiers,
      // Keeping the actor context-free prevents the legacy text matcher from
      // granting Fey Ancestry advantage on the ordinary comparison save.
      advantage: contextFreeAdvantages,
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
// ability modifiers, save proficiency, and dice selection remain native.
// ============================================================================

const HALF_ELF_ACTOR_CONFIG = {
  name: 'Half-Elf Fey Ancestry Tester',
  raceId: 'half_elf',
  classId: 'fighter',
  level: HALF_ELF_SCENARIO_LEVEL,
  // Keep flexible racial bonuses unchosen; the canonical +2 and two +1 choices
  // remain visible facts rather than silently becoming Character Forge choices.
  stats: [10, 10, 10, 10, 12, 12] as [number, number, number, number, number, number],
};

export interface HalfElfSaveSnapshot {
  condition: 'ordinary save' | 'avoid/end Charmed';
  d20Rolls: readonly number[];
  save: SavingThrowResult;
}

export interface HalfElfSaveResolution {
  status: 'resolved' | 'rejected';
  reason:
    | 'resolved'
    | 'canonical_trait_missing'
    | 'assembly_unavailable'
    | 'parser_projection_missing'
    | 'context_adapter_missing';
  ordinary: HalfElfSaveSnapshot | null;
  charmed: HalfElfSaveSnapshot | null;
}

export interface HalfElfScenarioState {
  actor: CombatCharacter | null;
  outcome: string;
  lastResolution: HalfElfSaveResolution | null;
}

/** Build a visible rejection without inventing partial mechanic state. */
function unavailableHalfElfScenario(
  reason: HalfElfSaveResolution['reason'],
  outcome: string,
): HalfElfScenarioState {
  return {
    actor: null,
    outcome,
    lastResolution: {
      status: 'rejected',
      reason,
      ordinary: null,
      charmed: null,
    },
  };
}

/** Assemble and parse the production actor used by both save branches. */
export function createHalfElfScenario(race: Race): HalfElfScenarioState {
  if (!hasCanonicalHalfElfFeatures(race)) {
    return unavailableHalfElfScenario(
      'canonical_trait_missing',
      'Fey Ancestry unavailable: canonical Half-Elf facts no longer contain the demonstrated rule set.',
    );
  }

  const quickCharacter = createQuickCharacter(HALF_ELF_ACTOR_CONFIG);
  if (!quickCharacter) {
    return unavailableHalfElfScenario(
      'assembly_unavailable',
      'Fey Ancestry unavailable: production quick-character assembly rejected the canonical actor.',
    );
  }

  // This parser call is the source of the actor's raw Fey Ancestry modifier.
  // The leaf never turns the trait's sleep statement into a fake condition rule.
  const parsedCharacter = applyRacialSpellGrantsByLevel(
    quickCharacter,
    HALF_ELF_SCENARIO_LEVEL,
  );
  if (!hasHalfElfFeyAncestryParserProjection(parsedCharacter)) {
    return unavailableHalfElfScenario(
      'parser_projection_missing',
      'Fey Ancestry unavailable: the production racial parser did not expose the canonical save projection.',
    );
  }

  // The native combat bridge supplies stats, save proficiencies, and modifier
  // lists consumed by rollSavingThrow.
  const actor = createPlayerCombatCharacter(parsedCharacter);
  return {
    actor: {
      ...actor,
      id: HALF_ELF_ACTOR_ID,
    },
    outcome: 'Ready: production Half-Elf actor; ordinary and Charmed-context saving throws are available.',
    lastResolution: null,
  };
}

/** Resolve the ordinary baseline and the canonical Fey Ancestry save. */
export function resolveHalfElfFeyAncestry(
  scenario: HalfElfScenarioState,
  race: Race,
  rng: () => number = Math.random,
): HalfElfScenarioState {
  const actor = scenario.actor;
  const adapter = getHalfElfFeyAncestrySaveAdapter(race);
  if (!actor) {
    return {
      ...scenario,
      outcome: 'Fey Ancestry comparison rejected: the production actor is unavailable.',
      lastResolution: { status: 'rejected', reason: 'assembly_unavailable', ordinary: null, charmed: null },
    };
  }
  if (!hasHalfElfFeyAncestryParserProjection(actor)) {
    return {
      ...scenario,
      outcome: 'Fey Ancestry comparison rejected: the parser-backed save projection is unavailable.',
      lastResolution: { status: 'rejected', reason: 'parser_projection_missing', ordinary: null, charmed: null },
    };
  }
  if (!adapter) {
    return {
      ...scenario,
      outcome: 'Fey Ancestry comparison rejected: the canonical Charmed context adapter is unavailable.',
      lastResolution: { status: 'rejected', reason: 'context_adapter_missing', ordinary: null, charmed: null },
    };
  }

  // The ordinary branch consumes one pinned face. The Charmed branch consumes
  // two faces because the canonical adapter grants native advantage.
  const ordinaryRolls: number[] = [];
  const ordinaryActor = applyHalfElfFeyAncestryContext(actor);
  const ordinarySave = rollSavingThrow(
    ordinaryActor,
    'Wisdom',
    HALF_ELF_CHARMED_SAVE_DC,
    undefined,
    { tags: ['ordinary save'] },
    undefined,
    {
      rng: () => {
        const value = rng();
        ordinaryRolls.push(Math.floor(value * 20) + 1);
        return value;
      },
    },
  );

  const charmedRolls: number[] = [];
  const charmedActor = applyHalfElfFeyAncestryContext(actor);
  const charmedSave = rollSavingThrow(
    charmedActor,
    'Wisdom',
    HALF_ELF_CHARMED_SAVE_DC,
    undefined,
    { tags: ['charmed'] },
    [adapter],
    {
      rng: () => {
        const value = rng();
        charmedRolls.push(Math.floor(value * 20) + 1);
        return value;
      },
    },
  );

  const ordinary: HalfElfSaveSnapshot = {
    condition: 'ordinary save',
    d20Rolls: ordinaryRolls,
    save: ordinarySave,
  };
  const charmed: HalfElfSaveSnapshot = {
    condition: 'avoid/end Charmed',
    d20Rolls: charmedRolls,
    save: charmedSave,
  };

  return {
    ...scenario,
    outcome: `Fey Ancestry resolved: ordinary ${ordinarySave.total} (${ordinarySave.success ? 'success' : 'failure'}); Charmed kept ${charmedSave.roll} from ${charmedRolls.join(' / ')} for ${charmedSave.total} (${charmedSave.success ? 'success' : 'failure'}).`,
    lastResolution: { status: 'resolved', reason: 'resolved', ordinary, charmed },
  };
}

/** Create the visible proof sequence: ordinary 4, then Charmed 4 and 16. */
export function createHalfElfDeterministicRng(): () => number {
  const values = [0.15, 0.15, 0.75];
  return () => values.shift() ?? 0.5;
}

// ============================================================================
// Visible Race Leaf Surface
// ============================================================================
// The panel shows the tested transaction, canonical facts, and exact
// unsupported boundary. The shell's keyed reset remounts this content.
// ============================================================================

function HalfElfRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createHalfElfScenario(race));
  const visionTrait = getCanonicalHalfElfVisionTrait(race);
  const feyAncestryTrait = getCanonicalHalfElfFeyAncestryTrait(race);
  const skillVersatilityTrait = getCanonicalHalfElfSkillVersatilityTrait(race);
  const abilityBonusFacts = getCanonicalHalfElfAbilityBonusFacts(race);
  const darkvisionRange = getCanonicalHalfElfDarkvisionRangeFeet(race);

  // Publish the same native result shown in the panel to the shell event log.
  const handleResolve = () => {
    // Keep the button repeatable so the visible panel always proves why
    // Charmed advantage matters instead of depending on a lucky random roll.
    const nextScenario = resolveHalfElfFeyAncestry(
      scenario,
      race,
      createHalfElfDeterministicRng(),
    );
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    if (resolution?.status === 'resolved') {
      onScenarioEvent(`Half-Elf FEY ANCESTRY RESOLVED: ordinary face ${resolution.ordinary?.d20Rolls.join(' / ')} total ${resolution.ordinary?.save.total} ${resolution.ordinary?.save.success ? 'success' : 'failure'}; Charmed faces ${resolution.charmed?.d20Rolls.join(' / ')} kept ${resolution.charmed?.save.roll} total ${resolution.charmed?.save.total} ${resolution.charmed?.save.success ? 'success' : 'failure'}.`);
    } else {
      onScenarioEvent(`Half-Elf FEY ANCESTRY REJECTED: ${nextScenario.outcome}`);
    }
  };

  return (
    <section aria-labelledby="half-elf-race-title" data-testid="half-elf-race-leaf">
      <h4 id="half-elf-race-title">Half-Elf · Fey Ancestry</h4>

      <p data-testid="half-elf-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; PB +{scenario.actor ? calculateProficiencyBonus(scenario.actor.level) : 'unknown'}; Charisma {scenario.actor?.stats.charisma ?? 'unknown'}; parser Fey Ancestry projection {hasHalfElfFeyAncestryParserProjection(scenario.actor) ? 'native' : 'missing'}.
      </p>

      <Button type="button" variant="primary" size="sm" onClick={handleResolve}>
        Resolve Fey Ancestry save
      </Button>

      <p aria-live="polite" role="status" data-testid="half-elf-outcome">{scenario.outcome}</p>
      <div data-testid="half-elf-save-result">
        {scenario.lastResolution?.status === 'resolved'
          ? <>
            <p>Ordinary context: one d20 face {scenario.lastResolution.ordinary?.d20Rolls.join(' / ')}; modifier {scenario.lastResolution.ordinary ? scenario.lastResolution.ordinary.save.total - scenario.lastResolution.ordinary.save.roll : 'unknown'}; total {scenario.lastResolution.ordinary?.save.total}; DC {scenario.lastResolution.ordinary?.save.dc}; {scenario.lastResolution.ordinary?.save.success ? 'success' : 'failure'}.</p>
            <p>Avoid/end Charmed context: d20 faces {scenario.lastResolution.charmed?.d20Rolls.join(' / ')}; kept face {scenario.lastResolution.charmed?.save.roll}; modifier {scenario.lastResolution.charmed ? scenario.lastResolution.charmed.save.total - scenario.lastResolution.charmed.save.roll : 'unknown'}; total {scenario.lastResolution.charmed?.save.total}; DC {scenario.lastResolution.charmed?.save.dc}; {scenario.lastResolution.charmed?.save.success ? 'success' : 'failure'}; advantage applied.</p>
          </>
          : 'No Fey Ancestry save comparison resolved yet.'}
      </div>

      <div data-testid="half-elf-canonical-facts">
        <strong>Canonical Half-Elf facts:</strong>
        <ul>
          <li>Darkvision: {darkvisionRange ?? 'unavailable'} ft from the canonical Vision trait. Sensing is not simulated.</li>
          <li>Vision source: {visionTrait ?? 'unavailable'}</li>
          <li>Fey Ancestry: {feyAncestryTrait ?? 'unavailable'} The Charmed save is the demonstrated transaction; magic sleep protection is a fact-only boundary.</li>
          <li>Skill Versatility: {skillVersatilityTrait ?? 'unavailable'} Two skill proficiencies remain unchosen.</li>
          <li>Ability bonuses: {abilityBonusFacts.join('; ') || 'unavailable'} No flexible ability choice is auto-selected.</li>
        </ul>
      </div>

      <p data-testid="half-elf-boundary">
        Boundary: the production parser supplies the raw Fey Ancestry projection, while this leaf derives only a canonical Charmed effect tag for native rollSavingThrow. It does not simulate condition application or removal, claim native magic sleep immunity, choose the two skills or flexible ability bonuses, integrate sensing, or claim 2D/3D render proof.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** The shell's resetCount remounts the actor and clears the prior resolution. */
export function HalfElfRaceLeaf(props: RaceDomainLeafProps) {
  return <HalfElfRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

/** Automatic discovery consumes this exact named registration export. */
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'half-elf-fey-ancestry',
  raceId: 'half_elf',
  label: 'Half-Elf · Fey Ancestry',
  description: 'Production-backed ordinary versus Charmed saving throw comparison with canonical Half-Elf facts and explicit unsupported boundaries.',
  Component: HalfElfRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
