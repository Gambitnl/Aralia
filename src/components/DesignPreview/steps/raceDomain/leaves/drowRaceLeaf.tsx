import React, { useState } from 'react';
import { applyRacialSpellGrantsByLevel } from '../../../../../utils/character/characterUtils';
import { rollAbilityCheck, type CheckResult } from '../../../../../utils/character/checkUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Drow race one inspectable Sunlight Sensitivity
 * comparison in the Tactical Sandbox Race domain.
 *
 * It assembles a real PlayerCharacter, applies the production racial parser,
 * and sends the actor through the shared Wisdom (Perception) check and dice
 * helpers. The parser cannot infer the current light context, so this leaf adds
 * one narrow canonical-derived context modifier only for the direct-sunlight
 * branch. The remaining Drow traits stay facts-only boundaries.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Drow data supplied by the shell, production quick
 * character assembly, applyRacialSpellGrantsByLevel, rollAbilityCheck, shared
 * dice, and the Race domain contract.
 */

// ============================================================================
// Canonical Drow Facts
// ============================================================================
// These readers keep the visible facts and the demonstrated condition tied to
// the active Race record. If canonical wording changes, the scenario rejects
// instead of silently presenting an outdated Drow rules summary.
// ============================================================================

export const DROW_ACTOR_ID = 'drow-sunlight-sensitivity-actor';
export const DROW_SCENARIO_LEVEL = 5;

const DROW_VISION_TRAIT = 'Vision';
const DROW_FEY_ANCESTRY_TRAIT = 'Fey Ancestry';
const DROW_KEEN_SENSES_TRAIT = 'Keen Senses';
const DROW_TRANCE_TRAIT = 'Trance';
const DROW_SUNLIGHT_SENSITIVITY_TRAIT = 'Sunlight Sensitivity';
const DROW_MAGIC_TRAIT = 'Drow Magic';

/** Find a named trait in the canonical race without importing a sibling leaf. */
export function getCanonicalDrowTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Return the canonical Superior Darkvision wording used by the fact panel. */
export function getCanonicalDrowVisionTrait(race: Race): string | null {
  return getCanonicalDrowTrait(race, DROW_VISION_TRAIT);
}

/** Return the canonical Sunlight Sensitivity wording used by the context adapter. */
export function getCanonicalDrowSunlightSensitivityTrait(race: Race): string | null {
  return getCanonicalDrowTrait(race, DROW_SUNLIGHT_SENSITIVITY_TRAIT);
}

/** Return the canonical Drow Magic wording without claiming a spell cast. */
export function getCanonicalDrowMagicTrait(race: Race): string | null {
  return getCanonicalDrowTrait(race, DROW_MAGIC_TRAIT);
}

/** Confirm every Drow fact used by this leaf is still present in canonical data. */
export function hasCanonicalDrowFeatures(race: Race): boolean {
  const vision = getCanonicalDrowVisionTrait(race);
  const feyAncestry = getCanonicalDrowTrait(race, DROW_FEY_ANCESTRY_TRAIT);
  const keenSenses = getCanonicalDrowTrait(race, DROW_KEEN_SENSES_TRAIT);
  const trance = getCanonicalDrowTrait(race, DROW_TRANCE_TRAIT);
  const sunlightSensitivity = getCanonicalDrowSunlightSensitivityTrait(race);
  const drowMagic = getCanonicalDrowMagicTrait(race);

  return race.id === 'drow'
    && race.name === 'Drow'
    && !!vision
    && /superior darkvision/i.test(vision)
    && /120 feet/i.test(vision)
    && !!feyAncestry
    && /advantage on saving throws/i.test(feyAncestry)
    && /charmed/i.test(feyAncestry)
    && !!keenSenses
    && /proficiency in the perception skill/i.test(keenSenses)
    && !!trance
    && /long rest in 4 hours/i.test(trance)
    && !!sunlightSensitivity
    && /disadvantage on attack rolls/i.test(sunlightSensitivity)
    && /wisdom \(perception\) checks that rely on sight/i.test(sunlightSensitivity)
    && /direct sunlight/i.test(sunlightSensitivity)
    && !!drowMagic
    && /dancing lights/i.test(drowMagic)
    && /3rd level/i.test(drowMagic)
    && /faerie fire/i.test(drowMagic)
    && /5th level/i.test(drowMagic)
    && /darkness/i.test(drowMagic)
    && /once without expending a spell slot/i.test(drowMagic)
    && /long rest/i.test(drowMagic)
    && /charisma is your spellcasting ability/i.test(drowMagic);
}

// ============================================================================
// Parser Boundary And Context Adapter
// ============================================================================
// The racial parser correctly finds the conditional disadvantage text, but a
// plain PlayerCharacter has no scene-light state. Its readable modifier would
// therefore apply to every Perception check unless this leaf separates the
// condition from the actor and supplies it only for the tested branch.
// ============================================================================

function isDrowSunlightSensitivityProjection(modifier: string): boolean {
  return /perception/i.test(modifier) && /direct sunlight/i.test(modifier);
}

/** Build the only context-specific modifier this leaf is allowed to add. */
export function getDrowSunlightContextAdapter(race: Race): string | null {
  const canonicalTrait = getCanonicalDrowSunlightSensitivityTrait(race);
  if (!canonicalTrait) return null;

  // The label is derived from the canonical trait name so the UI makes the
  // parser gap visible rather than presenting this as an independent rule.
  return `${canonicalTrait.split(':')[0]} (direct sunlight context): Wisdom (Perception) checks that rely on sight`;
}

/** Apply or withhold the canonical sunlight condition while preserving actor data. */
export function applyDrowSunlightContext(
  actor: PlayerCharacter,
  race: Race,
  directSunlight: boolean,
): PlayerCharacter {
  const adapter = getDrowSunlightContextAdapter(race);
  const modifiers = actor.modifiers ?? { advantage: [], disadvantage: [], bonuses: [] };
  // The parser's loose `advantage on` matcher also sees the `advantage on`
  // substring inside `disadvantage on`, so remove the same conditional
  // sunlight projection from both buckets before the context is selected.
  const contextFreeAdvantages = modifiers.advantage.filter(
    modifier => !isDrowSunlightSensitivityProjection(modifier),
  );
  const contextFreeDisadvantages = modifiers.disadvantage.filter(
    modifier => !isDrowSunlightSensitivityProjection(modifier),
  );

  return {
    ...actor,
    modifiers: {
      ...modifiers,
      advantage: [...contextFreeAdvantages],
      disadvantage: directSunlight && adapter
        ? [...contextFreeDisadvantages, adapter]
        : [...contextFreeDisadvantages],
      bonuses: [...modifiers.bonuses],
    },
  };
}

/** Confirm the parser supplied the canonical Keen Senses Perception skill. */
export function hasDrowPerceptionProficiencyProjection(actor: PlayerCharacter | null): boolean {
  return actor?.skills.some(skill => skill.id === 'perception') ?? false;
}

// ============================================================================
// Native Actor And Check Transaction
// ============================================================================
// The scenario keeps actor assembly and the two checks in pure helpers so
// focused tests can prove the real parser, deterministic dice faces, and
// context comparison without relying on a mounted browser.
// ============================================================================

const DROW_ACTOR_CONFIG = {
  name: 'Drow Sunlight Sensitivity Tester',
  raceId: 'drow',
  classId: 'rogue',
  level: DROW_SCENARIO_LEVEL,
  stats: [10, 14, 12, 10, 14, 10] as [number, number, number, number, number, number],
};

export interface DrowCheckSnapshot {
  condition: 'non-sunlight baseline' | 'direct sunlight';
  d20Rolls: readonly number[];
  check: CheckResult;
}

export interface DrowCheckResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'perception_projection_missing' | 'sunlight_adapter_missing';
  baseline: DrowCheckSnapshot | null;
  sunlight: DrowCheckSnapshot | null;
}

export interface DrowScenarioState {
  actor: PlayerCharacter | null;
  outcome: string;
  lastResolution: DrowCheckResolution | null;
}

/** Build the unavailable state used when canonical or production assembly cannot prove the scenario. */
function unavailableDrowScenario(
  reason: DrowCheckResolution['reason'],
  outcome: string,
): DrowScenarioState {
  return {
    actor: null,
    outcome,
    lastResolution: {
      status: 'rejected',
      reason,
      baseline: null,
      sunlight: null,
    },
  };
}

/** Assemble the canonical actor and apply the production racial parser. */
export function createDrowSunlightSensitivityScenario(race: Race): DrowScenarioState {
  if (!hasCanonicalDrowFeatures(race)) {
    return unavailableDrowScenario(
      'canonical_trait_missing',
      'Sunlight Sensitivity unavailable: canonical Drow facts no longer contain the demonstrated rule set.',
    );
  }

  const quickCharacter = createQuickCharacter(DROW_ACTOR_CONFIG);
  if (!quickCharacter) {
    return unavailableDrowScenario(
      'assembly_unavailable',
      'Sunlight Sensitivity unavailable: production quick-character assembly rejected the canonical Drow actor.',
    );
  }

  // The parser supplies Keen Senses and the Drow Magic gates. Conditional
  // sunlight text is retained by the parser, then withheld until a scene
  // context is explicitly selected by the comparison helper below.
  const assembledActor = applyRacialSpellGrantsByLevel(quickCharacter, DROW_SCENARIO_LEVEL);
  if (!hasDrowPerceptionProficiencyProjection(assembledActor)) {
    return unavailableDrowScenario(
      'perception_projection_missing',
      'Sunlight Sensitivity unavailable: the production racial parser did not expose Keen Senses as Perception proficiency.',
    );
  }

  return {
    actor: {
      ...applyDrowSunlightContext(assembledActor, race, false),
      id: DROW_ACTOR_ID,
    },
    outcome: 'Ready: parser-backed Drow actor; non-sunlight baseline and direct-sunlight context comparison are available.',
    lastResolution: null,
  };
}

/** Resolve the same sight-based Perception check once per context through native helpers. */
export function resolveDrowSunlightSensitivity(
  scenario: DrowScenarioState,
  race: Race,
  rng: () => number = Math.random,
): DrowScenarioState {
  const actor = scenario.actor;
  const adapter = getDrowSunlightContextAdapter(race);
  if (!actor) {
    return {
      ...scenario,
      outcome: 'Sunlight Sensitivity comparison rejected: the production actor is unavailable.',
      lastResolution: { status: 'rejected', reason: 'assembly_unavailable', baseline: null, sunlight: null },
    };
  }
  if (!hasDrowPerceptionProficiencyProjection(actor)) {
    return {
      ...scenario,
      outcome: 'Sunlight Sensitivity comparison rejected: the parser-backed Perception proficiency is unavailable.',
      lastResolution: { status: 'rejected', reason: 'perception_projection_missing', baseline: null, sunlight: null },
    };
  }
  if (!adapter) {
    return {
      ...scenario,
      outcome: 'Sunlight Sensitivity comparison rejected: the canonical-derived sunlight context adapter is unavailable.',
      lastResolution: { status: 'rejected', reason: 'sunlight_adapter_missing', baseline: null, sunlight: null },
    };
  }

  // Capture every raw face while rollAbilityCheck chooses the lower sunlight
  // face. The baseline consumes one face; the disadvantaged branch consumes
  // two faces from the same deterministic stream for an honest comparison.
  const baselineRolls: number[] = [];
  const baselineActor = applyDrowSunlightContext(actor, race, false);
  const baselineCheck = rollAbilityCheck(baselineActor, 'Wisdom', 'Perception', {
    rng: () => {
      const randomValue = rng();
      baselineRolls.push(Math.floor(randomValue * 20) + 1);
      return randomValue;
    },
  });

  const sunlightRolls: number[] = [];
  const sunlightActor = applyDrowSunlightContext(actor, race, true);
  const sunlightCheck = rollAbilityCheck(sunlightActor, 'Wisdom', 'Perception', {
    rng: () => {
      const randomValue = rng();
      sunlightRolls.push(Math.floor(randomValue * 20) + 1);
      return randomValue;
    },
  });

  const baseline: DrowCheckSnapshot = {
    condition: 'non-sunlight baseline',
    d20Rolls: baselineRolls,
    check: baselineCheck,
  };
  const sunlight: DrowCheckSnapshot = {
    condition: 'direct sunlight',
    d20Rolls: sunlightRolls,
    check: sunlightCheck,
  };

  return {
    ...scenario,
    outcome: `Sunlight Sensitivity resolved: baseline ${baselineCheck.total}; direct sunlight kept ${sunlightCheck.roll} from ${sunlightRolls.join(' / ')} for ${sunlightCheck.total}.`,
    lastResolution: { status: 'resolved', reason: 'resolved', baseline, sunlight },
  };
}

// ============================================================================
// Visible Race Leaf Surface
// ============================================================================
// The component exposes the tested comparison and canonical facts while
// stating exactly which larger game systems remain outside this leaf.
// ============================================================================

function DrowRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createDrowSunlightSensitivityScenario(race));
  const sunlightTrait = getCanonicalDrowSunlightSensitivityTrait(race);
  const visionTrait = getCanonicalDrowVisionTrait(race);
  const feyAncestryTrait = getCanonicalDrowTrait(race, DROW_FEY_ANCESTRY_TRAIT);
  const keenSensesTrait = getCanonicalDrowTrait(race, DROW_KEEN_SENSES_TRAIT);
  const tranceTrait = getCanonicalDrowTrait(race, DROW_TRANCE_TRAIT);
  const magicTrait = getCanonicalDrowMagicTrait(race);

  // Publish the exact native comparison to the shell log so Reset and the
  // event history remain visible outside this leaf's local state.
  const handleCompare = () => {
    const nextScenario = resolveDrowSunlightSensitivity(scenario, race);
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    if (resolution?.status === 'resolved') {
      onScenarioEvent(`Drow SUNLIGHT SENSITIVITY RESOLVED: baseline ${resolution.baseline?.check.total}; direct sunlight faces ${resolution.sunlight?.d20Rolls.join(' / ')} kept ${resolution.sunlight?.check.roll}; total ${resolution.sunlight?.check.total}.`);
    } else {
      onScenarioEvent(`Drow SUNLIGHT SENSITIVITY REJECTED: ${nextScenario.outcome}`);
    }
  };

  return (
    <section aria-labelledby="drow-scenario-title">
      <h4 id="drow-scenario-title">Sunlight Sensitivity</h4>
      <p data-testid="drow-canonical-trait">{sunlightTrait ?? 'Canonical Sunlight Sensitivity trait unavailable.'}</p>

      <div data-testid="drow-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; PB +{scenario.actor?.proficiencyBonus ?? 'unknown'}; Keen Senses Perception proficiency {hasDrowPerceptionProficiencyProjection(scenario.actor) ? 'native' : 'missing'}; parser-backed Drow Magic grants remain facts-only.
      </div>

      <Button type="button" variant="primary" size="sm" onClick={handleCompare}>
        Compare sunlight Perception check
      </Button>

      <p aria-live="polite" data-testid="drow-outcome">{scenario.outcome}</p>
      <div data-testid="drow-check-result">
        {scenario.lastResolution?.status === 'resolved'
          ? <>
            <p>Non-sunlight baseline: d20 face {scenario.lastResolution.baseline?.d20Rolls.join(' / ')}; Wisdom (Perception) total {scenario.lastResolution.baseline?.check.total}.</p>
            <p>Direct sunlight: d20 faces {scenario.lastResolution.sunlight?.d20Rolls.join(' / ')}; kept {scenario.lastResolution.sunlight?.check.roll}; Wisdom (Perception) total {scenario.lastResolution.sunlight?.check.total}; disadvantage applied.</p>
          </>
          : 'No Drow Sunlight Sensitivity comparison resolved yet.'}
      </div>

      <div data-testid="drow-canonical-facts">
        <strong>Canonical Drow facts:</strong>
        <ul>
          <li>Superior Darkvision: {visionTrait ?? 'unavailable'} Sensing is not simulated.</li>
          <li>Fey Ancestry: {feyAncestryTrait ?? 'unavailable'} No saving throw is simulated.</li>
          <li>Keen Senses: {keenSensesTrait ?? 'unavailable'} The Perception proficiency is used by the demonstrated check.</li>
          <li>Trance: {tranceTrait ?? 'unavailable'} No rest transaction is simulated.</li>
          <li>Drow Magic: {magicTrait ?? 'unavailable'} No spell casting transaction is simulated.</li>
        </ul>
      </div>

      <p data-testid="drow-context-boundary">
        Context adapter: the parser cannot infer scene sunlight, so this leaf derives a narrow direct-sunlight Wisdom (Perception) modifier from the canonical Sunlight Sensitivity trait and applies it only to the comparison branch. It does not simulate sensing, saving throws, spell casting, or rest. No 2D/3D render proof is claimed.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** The parent shell's resetCount is a keyed remount boundary for actor/check state. */
export function DrowRaceLeaf(props: RaceDomainLeafProps) {
  return <DrowRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'drow-sunlight-sensitivity',
  raceId: 'drow',
  label: 'Drow · Sunlight Sensitivity',
  description: 'Production-backed Wisdom (Perception) baseline versus direct-sunlight disadvantage; Drow features remain canonical facts-only boundaries.',
  Component: DrowRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
