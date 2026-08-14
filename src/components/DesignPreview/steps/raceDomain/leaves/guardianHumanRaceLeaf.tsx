// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 14/08/2026, 01:33:27
 * Dependents: None (Orphan)
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { getRacialModifierBucketsFromTraitText } from '../../../../../data/races/racialTraits';
import { applyRacialSpellGrantsByLevel } from '../../../../../utils/character/characterUtils';
import { rollAbilityCheck, type CheckResult } from '../../../../../utils/character/checkUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { rollDice } from '../../../../../utils/combat/combatUtils';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file demonstrates Guardian Human's Sentinel's Intuition with a real
 * production-assembled actor and the shared ability-check and dice helpers.
 * It keeps the remaining racial traits visible as canonical facts because the
 * preview does not own rest, choice, reaction interception, or spell-list
 * mutation transactions.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: the supplied canonical Race, racial trait parser, production
 * quick-character assembly, applyRacialSpellGrantsByLevel, rollDice, and
 * rollAbilityCheck.
 */

// ============================================================================
// Canonical Guardian Human Facts
// ============================================================================
// The supplied Race remains the only source of authored feature text. The
// parser is used first; the small scope projection below exists only because
// the parser currently collapses the authored two-skill rule to a broad d4
// ability-check rider.
// ============================================================================

export const GUARDIAN_HUMAN_SENTINEL_INTUITION_CONTROL_ID = 'resolve-guardian-human-sentinels-intuition';
export const GUARDIAN_HUMAN_ACTOR_ID = 'guardian-human-sentinels-intuition-actor';

const GUARDIAN_HUMAN_FACT_NAMES = [
  'Resourceful',
  'Skillful',
  'Versatile',
  "Guardian's Shield",
  'Vigilant Guardian',
  'Spells of the Mark',
] as const;

const SENTINELS_INTUITION_TRAIT = /^Sentinel's Intuition:\s*/i;
const SENTINEL_INTUITION_SKILLS = ['Insight', 'Perception'] as const;

/** Find one authored named trait without copying its text into the leaf. */
export function getCanonicalGuardianHumanTrait(
  race: Race,
  traitName: string,
): string | null {
  const prefix = new RegExp(`^${traitName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}:\\s*`, 'i');
  return race.traits.find(trait => prefix.test(trait.trim())) ?? null;
}

/** Return the authored Sentinel's Intuition rule, if canonical data has it. */
export function getCanonicalGuardianHumanSentinelTrait(race: Race): string | null {
  return race.traits.find(trait => SENTINELS_INTUITION_TRAIT.test(trait.trim())) ?? null;
}

/** Return the parser's broad d4 rider instead of duplicating parser wording. */
export function getCanonicalGuardianHumanSentinelRider(race: Race): string | null {
  const trait = getCanonicalGuardianHumanSentinelTrait(race);
  const parsed = trait ? getRacialModifierBucketsFromTraitText(trait) : null;
  return parsed?.bonuses.find(bonus => /d4/i.test(bonus) && /ability check/i.test(bonus)) ?? null;
}

/**
 * Project only the two skills named by the canonical trait for this leaf's
 * deterministic bridge. This is not a second rule source: the skill names are
 * extracted from the authored trait, and the d4 requirement comes from the
 * shared parser output checked above.
 */
export function getCanonicalGuardianHumanSentinelSkills(race: Race): string[] {
  const trait = getCanonicalGuardianHumanSentinelTrait(race);
  const rider = getCanonicalGuardianHumanSentinelRider(race);
  if (!trait || !rider) return [];

  return [...trait.matchAll(/Wisdom\s*\((Insight|Perception)\)/gi)]
    .map(match => match[1])
    .filter((skill, index, skills) => skills.indexOf(skill) === index);
}

/** Confirm every fact shown by the leaf is still present in canonical data. */
export function hasCanonicalGuardianHumanFeatures(race: Race): boolean {
  return race.id === 'guardian_human'
    && race.name === 'Guardian Human'
    && GUARDIAN_HUMAN_FACT_NAMES.every(name => getCanonicalGuardianHumanTrait(race, name) !== null)
    && getCanonicalGuardianHumanSentinelTrait(race) !== null
    && getCanonicalGuardianHumanSentinelRider(race) !== null
    && SENTINEL_INTUITION_SKILLS.every(skill => getCanonicalGuardianHumanSentinelSkills(race).includes(skill));
}

// ============================================================================
// Production Assembly And Native Check Transactions
// ============================================================================
// The actor is created by the same quick-character and racial-grant pipeline
// used by sandbox code. Each applicable check gets one native d4 and then one
// native rollAbilityCheck call; Arcana is deliberately a no-bonus comparison.
// ============================================================================

export type GuardianHumanCheckId = 'insight' | 'perception' | 'arcana';

export interface GuardianHumanCheckResolution {
  id: GuardianHumanCheckId;
  ability: 'Wisdom' | 'Intelligence';
  skill: 'Insight' | 'Perception' | 'Arcana';
  applies: boolean;
  d20Roll: number | null;
  d4Roll: number | null;
  baseTotal: number | null;
  total: number | null;
  check: CheckResult | null;
}

export interface GuardianHumanScenarioState {
  actor: PlayerCharacter | null;
  sentinelTrait: string | null;
  parsedSentinelRider: string | null;
  sentinelSkills: string[];
  outcome: string;
  lastResolutions: readonly GuardianHumanCheckResolution[] | null;
}

/**
 * Supply the same visible proof packet every time the preview button is used.
 * The production helpers still perform every roll; this only pins their random
 * stream so an operator can compare the three outcomes without lucky timing.
 */
export function createGuardianHumanDeterministicRng(): () => number {
  const values = [0.5, 0.45, 0.5, 0.45, 0.45];
  return () => values.shift() ?? 0.45;
}

const GUARDIAN_HUMAN_ACTOR_CONFIG = {
  name: 'Guardian Human - Sentinel Intuition Tester',
  raceId: 'guardian_human',
  classId: 'cleric',
  level: 1,
  // Wisdom 16 becomes 18 through the production quick-character class baseline.
  stats: [10, 10, 10, 10, 16, 10] as [number, number, number, number, number, number],
};

/** Build the parser-backed actor used by all three deterministic comparisons. */
export function createGuardianHumanScenario(race: Race): GuardianHumanScenarioState {
  const sentinelTrait = getCanonicalGuardianHumanSentinelTrait(race);
  const parsedSentinelRider = getCanonicalGuardianHumanSentinelRider(race);
  const sentinelSkills = getCanonicalGuardianHumanSentinelSkills(race);

  if (!hasCanonicalGuardianHumanFeatures(race)) {
    return {
      actor: null,
      sentinelTrait,
      parsedSentinelRider,
      sentinelSkills,
      outcome: "Sentinel's Intuition unavailable: canonical Guardian Human data or parser d4 rider changed.",
      lastResolutions: null,
    };
  }

  const quickCharacter = createQuickCharacter(GUARDIAN_HUMAN_ACTOR_CONFIG);
  if (!quickCharacter) {
    return {
      actor: null,
      sentinelTrait,
      parsedSentinelRider,
      sentinelSkills,
      outcome: "Sentinel's Intuition unavailable: production quick-character assembly returned null.",
      lastResolutions: null,
    };
  }

  const actor = {
    ...applyRacialSpellGrantsByLevel(quickCharacter, quickCharacter.level ?? 1),
    id: GUARDIAN_HUMAN_ACTOR_ID,
    name: `${race.name} - Sentinel Intuition Tester`,
  };

  return {
    actor,
    sentinelTrait,
    parsedSentinelRider,
    sentinelSkills,
    outcome: `Ready: ${actor.name}; parser rider ${parsedSentinelRider}; scoped to ${sentinelSkills.join(' and ')}.`,
    lastResolutions: null,
  };
}

/** Remove only the parser's broad Sentinel rider from the temporary check actor. */
function removeBroadSentinelRider(
  actor: PlayerCharacter,
  parsedSentinelRider: string,
): PlayerCharacter {
  if (!actor.modifiers) return actor;

  return {
    ...actor,
    modifiers: {
      ...actor.modifiers,
      bonuses: actor.modifiers.bonuses.filter(bonus => bonus !== parsedSentinelRider),
    },
  };
}

/** Resolve one native check after optionally rolling the canonical Sentinel d4. */
function resolveGuardianHumanCheck(
  actor: PlayerCharacter,
  parsedSentinelRider: string,
  id: GuardianHumanCheckId,
  rng: () => number,
): GuardianHumanCheckResolution {
  const isSentinelCheck = id === 'insight' || id === 'perception';
  const ability = isSentinelCheck ? 'Wisdom' : 'Intelligence';
  const skill = id === 'insight' ? 'Insight' : id === 'perception' ? 'Perception' : 'Arcana';
  const d4Roll = isSentinelCheck ? rollDice('1d4', { rng }) : null;
  const actorForNativeCheck = removeBroadSentinelRider(actor, parsedSentinelRider);
  const check = rollAbilityCheck(actorForNativeCheck, ability, skill, {
    externalModifier: d4Roll ?? undefined,
    rng,
  });

  return {
    id,
    ability,
    skill,
    applies: isSentinelCheck,
    d20Roll: check.roll,
    d4Roll,
    baseTotal: d4Roll === null ? check.total : check.total - d4Roll,
    total: check.total,
    check,
  };
}

/** Resolve Insight, Perception, and an Arcana exclusion through native helpers. */
export function resolveGuardianHumanSentinelIntuition(
  scenario: GuardianHumanScenarioState,
  race: Race,
  rng: () => number = Math.random,
): GuardianHumanScenarioState {
  if (!scenario.actor) {
    return {
      ...scenario,
      outcome: "Sentinel's Intuition rejected: the production-assembled actor is unavailable.",
      lastResolutions: null,
    };
  }

  const parsedSentinelRider = getCanonicalGuardianHumanSentinelRider(race);
  if (!hasCanonicalGuardianHumanFeatures(race) || !parsedSentinelRider) {
    return {
      ...scenario,
      outcome: "Sentinel's Intuition rejected: the canonical d4 rider or named skill scope is unavailable.",
      lastResolutions: null,
    };
  }

  const resolutions = (['insight', 'perception', 'arcana'] as GuardianHumanCheckId[]).map(id => (
    resolveGuardianHumanCheck(scenario.actor!, parsedSentinelRider, id, rng)
  ));
  const resultText = resolutions.map(result => (
    `${result.skill} base ${result.baseTotal} + ${result.d4Roll === null ? 'no d4' : `d4 ${result.d4Roll}`} = ${result.total}`
  )).join('; ');

  return {
    ...scenario,
    outcome: `Sentinel's Intuition resolved through native checks: ${resultText}.`,
    lastResolutions: resolutions,
  };
}

// ============================================================================
// Guardian Human Leaf UI
// ============================================================================
// The surface exposes canonical facts, actor/check evidence, the event receipt,
// and the explicit adapter boundary without claiming unsupported game actions.
// ============================================================================

const GuardianHumanRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  state,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState(
    () => createGuardianHumanScenario(race),
  );

  const handleResolve = () => {
    const nextScenario = resolveGuardianHumanSentinelIntuition(
      scenario,
      race,
      createGuardianHumanDeterministicRng(),
    );
    setScenario(nextScenario);
    onScenarioEvent(`Guardian Human SENTINEL'S INTUITION: ${nextScenario.outcome}`);
  };

  const resolutions = scenario.lastResolutions ?? [];

  return (
    <section aria-labelledby="guardian-human-sentinels-intuition-title">
      {/* The heading names the canonical transaction for assistive technology. */}
      <h4 id="guardian-human-sentinels-intuition-title">Guardian Human · Sentinel&apos;s Intuition</h4>
      <p data-testid="guardian-human-sentinel-trait">
        Canonical: {scenario.sentinelTrait ?? 'Sentinel&apos;s Intuition trait missing'}
      </p>

      {/* This button runs all requested comparisons from one deterministic native transaction. */}
      <Button
        type="button"
        variant="primary"
        size="sm"
        id={GUARDIAN_HUMAN_SENTINEL_INTUITION_CONTROL_ID}
        onClick={handleResolve}
      >
        Resolve Sentinel&apos;s Intuition checks
      </Button>

      {/* These facts prove production actor assembly and the parser bridge input. */}
      <p data-testid="guardian-human-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Class {scenario.actor?.class.name ?? 'missing'}; Wisdom {scenario.actor?.finalAbilityScores.Wisdom ?? 'unknown'}; parser rider {scenario.parsedSentinelRider ?? 'missing'}; scoped skills {scenario.sentinelSkills.join(', ') || 'missing'}.
      </p>

      {/* Each line exposes the native d20, base total, applicable d4, and final total. */}
      <div data-testid="guardian-human-check-results">
        {resolutions.length === 0
          ? 'No Sentinel\'s Intuition checks resolved yet.'
          : resolutions.map(result => (
            <p key={result.id} data-testid={`guardian-human-${result.id}-result`}>
              {result.skill}: d20 {result.d20Roll}; base {result.baseTotal}; {result.d4Roll === null ? 'd4 not applicable' : `canonical d4 bonus ${result.d4Roll}`}; total {result.total}.
            </p>
          ))}
      </div>
      <p aria-live="polite" role="status" data-testid="guardian-human-outcome">
        {scenario.outcome}
      </p>

      {/* These six traits stay visibly linked to canonical data without fake controls. */}
      <div data-testid="guardian-human-facts">
        <strong>Canonical facts only:</strong>{' '}
        {GUARDIAN_HUMAN_FACT_NAMES
          .map(name => getCanonicalGuardianHumanTrait(race, name) ?? `${name} missing`)
          .join(' | ')}
      </div>

      {/* This boundary separates the tested check from unsupported runtime mechanics. */}
      <p data-testid="guardian-human-boundary">
        Boundary: Resourceful rest/Inspiration, Skillful skill choice, Versatile feat choice, Guardian&apos;s Shield casting/resources, Vigilant Guardian reaction interception and position swapping, Spells of the Mark spell-list mutation, and 2D/3D rendering are facts or deferred boundaries only. No fake choices, rest recovery, spell casts, reactions, position swaps, or spell-list changes are claimed. Adapter boundary: the parser currently exposes a broad d4 ability-check rider, so this leaf removes that rider from a temporary actor copy, projects only canonical Insight/Perception scope, rolls the d4 with native rollDice, and passes it to native rollAbilityCheck; Arcana receives no d4.
      </p>
      {/* Parent resetCount changes the key and restores the production baseline. */}
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

/** Parent resetCount remounts the leaf so actor and results return to baseline. */
export const GuardianHumanRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <GuardianHumanRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery consumes this exact named registration without a central list.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'guardian-human-sentinels-intuition',
  raceId: 'guardian_human',
  label: "Guardian Human · Sentinel's Intuition",
  description: 'Resolve canonical Insight and Perception d4 riders through native checks; Arcana is an explicit exclusion comparison.',
  Component: GuardianHumanRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
