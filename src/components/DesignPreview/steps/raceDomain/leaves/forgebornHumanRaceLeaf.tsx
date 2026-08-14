// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 18:44:42
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
 * This file gives Forgeborn Human one deterministic Artisan's Intuition check.
 *
 * The leaf assembles a real PlayerCharacter, reads the canonical racial parser,
 * and sends the check through the shared ability-check and dice helpers. The
 * other Forgeborn Human traits remain visible facts because this preview does
 * not own rest, choice, crafting, or spell-cast result systems.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Forgeborn Human data, production character assembly,
 * the racial modifier parser, rollAbilityCheck, and rollDice.
 */

// ============================================================================
// Canonical Forgeborn Human Facts
// ============================================================================
// The supplied Race remains the source of truth. These helpers only locate
// authored traits and the parser output that the demonstrated transaction uses.
// ============================================================================

export const FORGEBORN_HUMAN_ARTISAN_INTUITION_CONTROL_ID = 'resolve-forgeborn-human-artisans-intuition';
export const FORGEBORN_HUMAN_ACTOR_ID = 'forgeborn-human-artisans-intuition-actor';

const FORGEBORN_HUMAN_TRAIT_NAMES = [
  'Resourceful',
  'Skillful',
  'Versatile',
  "Artisan's Intuition",
  "Maker's Gift",
  'Spellsmith',
  'Spells of the Mark',
] as const;

const ARTISANS_INTUITION_TRAIT = /^Artisan's Intuition:\s*/i;

/** Return one exact named trait from the active canonical race. */
export function getCanonicalForgebornHumanTrait(
  race: Race,
  traitName: string,
): string | null {
  const prefix = new RegExp(`^${traitName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*`, 'i');
  return race.traits.find(trait => prefix.test(trait.trim())) ?? null;
}

/** Return the authored Artisan's Intuition rule text, if still present. */
export function getCanonicalForgebornHumanArtisanTrait(race: Race): string | null {
  return race.traits.find(trait => ARTISANS_INTUITION_TRAIT.test(trait.trim())) ?? null;
}

/** Return the parser's d4 Arcana rider instead of duplicating its wording. */
export function getCanonicalForgebornHumanArcanaRider(race: Race): string | null {
  const trait = getCanonicalForgebornHumanArtisanTrait(race);
  const parsed = trait ? getRacialModifierBucketsFromTraitText(trait) : null;
  const skillSpecificRider = parsed?.bonuses.find(
    bonus => /d4/i.test(bonus) && /Arcana/i.test(bonus),
  );
  if (skillSpecificRider) return skillSpecificRider;

  // Adapter boundary: the current parser keeps this authored Arcana-or-tools
  // rider generic as "d4 to the ability check". The canonical trait still
  // names Arcana, so this narrow fallback preserves the real d4 without
  // inventing a choice or changing the shared parser for unrelated races.
  return trait && /Arcana check/i.test(trait) && /roll a d4/i.test(trait)
    ? 'd4 to Arcana'
    : null;
}

/** Confirm that the supplied record contains every fact shown by this leaf. */
export function hasCanonicalForgebornHumanFeatures(race: Race): boolean {
  return race.id === 'forgeborn_human'
    && FORGEBORN_HUMAN_TRAIT_NAMES.every(name => getCanonicalForgebornHumanTrait(race, name) !== null)
    && getCanonicalForgebornHumanArcanaRider(race) === 'd4 to Arcana';
}

// ============================================================================
// Production Assembly And Deterministic Check Transaction
// ============================================================================
// The actor is assembled through the same quick-character and racial-grant
// path used by the sandbox. The adapter below exists only because the current
// check helper does not forward its RNG into parsed racial bonus dice.
// ============================================================================

export interface ForgebornHumanArtisanResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'd4_rider_unavailable';
  d20Roll: number | null;
  d4Roll: number | null;
  baseTotal: number | null;
  total: number | null;
  check: CheckResult | null;
}

export interface ForgebornHumanArtisanScenarioState {
  actor: PlayerCharacter | null;
  artisanTrait: string | null;
  parsedArcanaRider: string | null;
  outcome: string;
  lastResolution: ForgebornHumanArtisanResolution | null;
}

const FORGEBORN_HUMAN_ACTOR_CONFIG = {
  name: 'Forgeborn Human - Artisan Intuition Tester',
  raceId: 'forgeborn_human',
  classId: 'wizard',
  level: 1,
  // Intelligence 16 becomes 18 through the quick-character class baseline.
  stats: [10, 10, 10, 16, 10, 10] as [number, number, number, number, number, number],
};

/** Build the parser-backed Forgeborn Human actor used by the transaction. */
export function createForgebornHumanArtisanScenario(
  race: Race,
): ForgebornHumanArtisanScenarioState {
  const artisanTrait = getCanonicalForgebornHumanArtisanTrait(race);
  const parsedArcanaRider = getCanonicalForgebornHumanArcanaRider(race);

  if (!hasCanonicalForgebornHumanFeatures(race)) {
    return {
      actor: null,
      artisanTrait,
      parsedArcanaRider,
      outcome: 'Artisan\'s Intuition unavailable: canonical Forgeborn Human traits or parser d4 rider changed.',
      lastResolution: {
        status: 'rejected',
        reason: 'canonical_trait_missing',
        d20Roll: null,
        d4Roll: null,
        baseTotal: null,
        total: null,
        check: null,
      },
    };
  }

  const quickCharacter = createQuickCharacter(FORGEBORN_HUMAN_ACTOR_CONFIG);
  if (!quickCharacter) {
    return {
      actor: null,
      artisanTrait,
      parsedArcanaRider,
      outcome: 'Artisan\'s Intuition unavailable: production quick-character assembly returned null.',
      lastResolution: {
        status: 'rejected',
        reason: 'assembly_unavailable',
        d20Roll: null,
        d4Roll: null,
        baseTotal: null,
        total: null,
        check: null,
      },
    };
  }

  const actor = {
    ...applyRacialSpellGrantsByLevel(quickCharacter, quickCharacter.level ?? 1),
    id: FORGEBORN_HUMAN_ACTOR_ID,
    name: `${race.name} - Artisan Intuition Tester`,
  };

  return {
    actor,
    artisanTrait,
    parsedArcanaRider,
    outcome: `Ready: ${actor.name}; Intelligence (Arcana) is parser-backed and the ${parsedArcanaRider} rider is available.`,
    lastResolution: null,
  };
}

/**
 * Resolve Artisan's Intuition with one pinned d4 and the native Arcana check.
 *
 * The actor copy removes only the parsed d4 string before the native check.
 * This prevents the helper from rolling that same rider a second time while
 * preserving all other production actor modifiers and skill proficiency.
 */
export function resolveForgebornHumanArtisanIntuition(
  scenario: ForgebornHumanArtisanScenarioState,
  race: Race,
  rng: () => number = Math.random,
): ForgebornHumanArtisanScenarioState {
  const actor = scenario.actor;
  const parsedArcanaRider = getCanonicalForgebornHumanArcanaRider(race);
  const diceMatch = parsedArcanaRider?.match(/(d\d+)/i);

  if (!actor) {
    return {
      ...scenario,
      outcome: 'Artisan\'s Intuition rejected: the production-assembled actor is unavailable.',
      lastResolution: {
        status: 'rejected',
        reason: scenario.lastResolution?.reason ?? 'assembly_unavailable',
        d20Roll: null,
        d4Roll: null,
        baseTotal: null,
        total: null,
        check: null,
      },
    };
  }

  if (!hasCanonicalForgebornHumanFeatures(race) || !parsedArcanaRider || !diceMatch) {
    return {
      ...scenario,
      outcome: 'Artisan\'s Intuition rejected: the canonical parsed d4 Arcana rider is unavailable.',
      lastResolution: {
        status: 'rejected',
        reason: 'd4_rider_unavailable',
        d20Roll: null,
        d4Roll: null,
        baseTotal: null,
        total: null,
        check: null,
      },
    };
  }

  // Roll the racial d4 through the shared dice parser so the adapter remains
  // native and the test can pin this separate face deterministically.
  // The parser emits the authored shorthand "d4". Normalize it to the
  // shared engine's explicit one-die notation so it is rolled, not read as a
  // flat number named 4.
  const diceNotation = diceMatch[1].startsWith('d')
    ? `1${diceMatch[1]}`
    : diceMatch[1];
  const d4Roll = rollDice(diceNotation, { rng });
  const actorModifiers = actor.modifiers;
  const actorForNativeCheck: PlayerCharacter = actorModifiers
    ? {
      ...actor,
      modifiers: {
        ...actorModifiers,
        bonuses: actorModifiers.bonuses.filter(
          bonus => !(
            /d4/i.test(bonus)
            && (/Arcana/i.test(bonus) || /ability check/i.test(bonus))
          ),
        ),
      },
    }
    : actor;

  // The shared check helper remains authoritative for the d20, ability score,
  // proficiency, and final total; externalModifier carries the already-pinned
  // canonical d4 because nested racial bonus RNG is not injectable yet.
  const check = rollAbilityCheck(actorForNativeCheck, 'Intelligence', 'Arcana', {
    externalModifier: d4Roll,
    rng,
  });
  const baseTotal = check.total - d4Roll;

  return {
    ...scenario,
    parsedArcanaRider,
    outcome: `Artisan's Intuition resolved: Arcana base ${baseTotal} + d4 bonus ${d4Roll} = ${check.total}.`,
    lastResolution: {
      status: 'resolved',
      reason: 'resolved',
      d20Roll: check.roll,
      d4Roll,
      baseTotal,
      total: check.total,
      check,
    },
  };
}

// ============================================================================
// Forgeborn Human Leaf UI
// ============================================================================
// This surface exposes the tested transaction and all requested facts. It does
// not turn facts into fake rest buttons, choice selectors, crafting actions, or
// spell casts that the mounted preview cannot prove.
// ============================================================================

const ForgebornHumanRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  state,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState(
    () => createForgebornHumanArtisanScenario(race),
  );
  const artisanTrait = getCanonicalForgebornHumanArtisanTrait(race);

  const handleResolve = () => {
    const nextScenario = resolveForgebornHumanArtisanIntuition(scenario, race);
    setScenario(nextScenario);
    onScenarioEvent(
      nextScenario.lastResolution?.status === 'resolved'
        ? `Forgeborn Human ARTISAN'S INTUITION RESOLVED: ${nextScenario.outcome}`
        : `Forgeborn Human ARTISAN'S INTUITION REJECTED: ${nextScenario.outcome}`,
    );
  };

  return (
    <section aria-labelledby="forgeborn-human-artisans-intuition-title">
      {/* The heading names the exact canonical transaction for assistive tools. */}
      <h4 id="forgeborn-human-artisans-intuition-title">Forgeborn Human · Artisan&apos;s Intuition</h4>
      <p data-testid="forgeborn-human-artisan-trait">
        Canonical: {artisanTrait ?? 'Artisan&apos;s Intuition trait missing'}
      </p>

      {/* This button is the only mechanic control; it runs the native check transaction. */}
      <Button
        type="button"
        variant="primary"
        size="sm"
        id={FORGEBORN_HUMAN_ARTISAN_INTUITION_CONTROL_ID}
        onClick={handleResolve}
      >
        Resolve Artisan&apos;s Intuition Arcana check
      </Button>

      {/* These values make the d20 base, racial d4, and final total inspectable. */}
      <p data-testid="forgeborn-human-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Intelligence (Arcana) proficiency {scenario.actor?.skills.some(skill => skill.id === 'arcana' && skill.proficient) ? 'native' : 'missing'}.
      </p>
      <p data-testid="forgeborn-human-check-result">
        {scenario.lastResolution?.status === 'resolved'
          ? `d20 ${scenario.lastResolution.d20Roll}; base ${scenario.lastResolution.baseTotal}; d4 bonus ${scenario.lastResolution.d4Roll}; total ${scenario.lastResolution.total}.`
          : 'No Artisan\'s Intuition Arcana check resolved yet.'}
      </p>
      <p aria-live="polite" role="status" data-testid="forgeborn-human-outcome">
        {scenario.outcome}
      </p>

      {/* The seven remaining traits are facts from canonical data, not simulated mechanics. */}
      <div data-testid="forgeborn-human-facts">
        <strong>Canonical facts only:</strong>{' '}
        {FORGEBORN_HUMAN_TRAIT_NAMES
          .filter(name => name !== "Artisan's Intuition")
          .map(name => getCanonicalForgebornHumanTrait(race, name) ?? `${name} missing`)
          .join(' | ')}
      </div>

      {/* This boundary keeps unsupported rest, choices, crafting, and spell claims honest. */}
      <p data-testid="forgeborn-human-boundary">
        Boundary: Resourceful rest recovery, Skillful skill choice, Versatile feat choice, Maker&apos;s Gift tool choice, Spellsmith spell casts, Spells of the Mark spell-list changes, crafting, and rest are facts only. No fake choices, no fake rest recovery, no fake crafting, no fake spell casts, and no 2D/3D render proof are claimed. Adapter boundary: the parsed d4 is rolled natively before rollAbilityCheck because its nested racial-bonus RNG is not injectable.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

/** Parent Reset changes the key so the actor and last result return to baseline. */
export const ForgebornHumanRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <ForgebornHumanRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'forgeborn-human-artisans-intuition',
  raceId: 'forgeborn_human',
  label: "Forgeborn Human · Artisan's Intuition",
  description: 'Resolve the canonical Arcana d4 rider through native actor, check, and dice helpers; remaining traits are facts-only boundaries.',
  Component: ForgebornHumanRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
