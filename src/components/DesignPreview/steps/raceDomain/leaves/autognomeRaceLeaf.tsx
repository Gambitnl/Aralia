// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 12:27:55
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
import { ALL_ITEMS } from '../../../../../data/items';
import { getRacialModifierBucketsFromTraitText } from '../../../../../data/races/racialTraits';
import {
  applyRacialSpellGrantsByLevel,
} from '../../../../../utils/character/characterUtils';
import {
  calculateArmorClass,
  getAbilityModifierValue,
} from '../../../../../utils/character/statUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Autognome race one deterministic Armor Class
 * transaction inside the Tactical Sandbox Race domain.
 *
 * It builds a real PlayerCharacter, applies the production racial-trait parser,
 * and delegates both the unarmored and armored calculations to calculateArmorClass.
 * The UI reports the actor, Dexterity modifier, equipment, AC comparison, and
 * exact unsupported boundary instead of claiming the other Autognome traits.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Autognome traits, character assembly, real item data,
 * and src/utils/character/statUtils.ts.
 */

// ============================================================================
// Canonical Trait And Control Facts
// ============================================================================
// These helpers read the supplied Race and reuse the same parser that the
// character assembly pipeline uses. The leaf never copies a second rule string
// into the scenario, so a canonical data change makes the proof unavailable
// until the parser and this focused leaf agree again.
// ============================================================================

export const AUTOGNOME_ARMOR_CLASS_CONTROL_ID = 'resolve-autognome-armor-class';
export const AUTOGNOME_ARMOR_MODE_CONTROL_ID = 'autognome-armor-mode';
export const AUTOGNOME_ACTOR_ID = 'autognome-armored-casing-actor';
export const AUTOGNOME_ARMOR_ITEM_ID = 'leather_armor';

export type AutognomeArmorMode = 'unarmored' | 'leather-armor';

const ARMORED_CASING_TRAIT = /^Armored Casing:\s*/i;

/** Return the exact Armored Casing text from the active canonical race. */
export function getCanonicalArmoredCasingTrait(race: Race): string | null {
  return race.traits.find(trait => ARMORED_CASING_TRAIT.test(trait.trim())) ?? null;
}

/**
 * Read the base AC through the production racial modifier parser. This keeps
 * the displayed 13 tied to the same parsed bucket consumed by assembly.
 */
export function getCanonicalArmoredCasingBaseAC(race: Race): number | null {
  const trait = getCanonicalArmoredCasingTrait(race);
  if (!trait) return null;

  // Use the same parser that applyRacialSpellGrantsByLevel uses for assembly;
  // a second regular expression here would let the display drift from runtime.
  return getRacialModifierBucketsFromTraitText(trait).baseArmorClass ?? null;
}

/** Confirm that the supplied race still contains the complete demonstrated rule. */
export function hasCanonicalArmoredCasing(race: Race): boolean {
  const trait = getCanonicalArmoredCasingTrait(race);
  return race.id === 'autognome'
    && !!trait
    && /while you are not wearing armor/i.test(trait)
    && getCanonicalArmoredCasingBaseAC(race) === 13
    && /your Dexterity modifier/i.test(trait);
}

// ============================================================================
// Production Assembly And AC Transaction
// ============================================================================
// The preview leaf has no persistent character snapshot to borrow. It therefore
// uses the same quick-character seam as the central sandbox, applies the real
// racial parser, and supplies a real item from ALL_ITEMS for the guard case.
// ============================================================================

export interface AutognomeArmorClassScenarioState {
  actor: PlayerCharacter | null;
  selectedMode: AutognomeArmorMode;
  armorClass: number | null;
  unarmoredArmorClass: number | null;
  armoredArmorClass: number | null;
  outcome: string;
  lastResolution: AutognomeArmorClassResolution | null;
}

export interface AutognomeArmorClassResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'armor_item_missing';
  mode: AutognomeArmorMode;
  armorClass: number | null;
}

const AUTOGNOME_ACTOR_CONFIG = {
  name: 'Autognome Armored Casing Tester',
  raceId: 'autognome',
  classId: 'fighter',
  level: 1,
  stats: [10, 14, 12, 10, 10, 10] as [number, number, number, number, number, number],
};

const getArmorItem = () => ALL_ITEMS[AUTOGNOME_ARMOR_ITEM_ID];

/** Calculate AC while keeping the selected torso equipment explicit. */
function calculateScenarioArmorClass(
  actor: PlayerCharacter,
  mode: AutognomeArmorMode,
): { actor: PlayerCharacter; armorClass: number } | null {
  const armorItem = getArmorItem();
  if (mode === 'leather-armor' && !armorItem) return null;

  // An undefined Torso slot is the native unarmored shape used by
  // calculateArmorClass; the armored mode uses the real Leather Armor item.
  const equippedItems = mode === 'leather-armor'
    ? { ...actor.equippedItems, Torso: armorItem }
    : { ...actor.equippedItems, Torso: undefined };
  const equippedActor: PlayerCharacter = { ...actor, equippedItems };
  return {
    actor: equippedActor,
    armorClass: calculateArmorClass(equippedActor, equippedActor.activeEffects),
  };
}

/** Build the canonical actor and calculate both sides of the Armored Casing guard. */
export function createAutognomeArmorClassScenario(
  race: Race,
): AutognomeArmorClassScenarioState {
  const unavailable = (
    reason: AutognomeArmorClassResolution['reason'],
    outcome: string,
  ): AutognomeArmorClassScenarioState => ({
    actor: null,
    selectedMode: 'unarmored',
    armorClass: null,
    unarmoredArmorClass: null,
    armoredArmorClass: null,
    outcome,
    lastResolution: {
      status: 'rejected',
      reason,
      mode: 'unarmored',
      armorClass: null,
    },
  });

  if (!hasCanonicalArmoredCasing(race)) {
    return unavailable(
      'canonical_trait_missing',
      'Armored Casing unavailable: the canonical Autognome trait does not contain the demonstrated 13 + Dexterity, unarmored rule.',
    );
  }

  const quickCharacter = createQuickCharacter(AUTOGNOME_ACTOR_CONFIG);
  if (!quickCharacter) {
    return unavailable(
      'assembly_unavailable',
      'Armored Casing unavailable: production quick-character assembly returned null.',
    );
  }

  // This is the same racial-feature projection used by the character creator.
  // Without it, the AC helper would see only the generic 10 + Dexterity base.
  const assembledCharacter = applyRacialSpellGrantsByLevel(
    quickCharacter,
    quickCharacter.level ?? 1,
  );
  const actor: PlayerCharacter = {
    ...assembledCharacter,
    id: AUTOGNOME_ACTOR_ID,
    name: `${race.name} · Armored Casing Tester`,
  };
  const unarmored = calculateScenarioArmorClass(actor, 'unarmored');
  const armored = calculateScenarioArmorClass(actor, 'leather-armor');
  if (!unarmored || !armored) {
    return unavailable(
      'armor_item_missing',
      'Armored Casing comparison unavailable: the canonical Leather Armor item is missing from ALL_ITEMS.',
    );
  }

  return {
    actor: unarmored.actor,
    selectedMode: 'unarmored',
    armorClass: unarmored.armorClass,
    unarmoredArmorClass: unarmored.armorClass,
    armoredArmorClass: armored.armorClass,
    outcome: `Ready: ${actor.name}; native AC is ${unarmored.armorClass} unarmored and ${armored.armorClass} while wearing ${getArmorItem()?.name}.`,
    lastResolution: null,
  };
}

/** Resolve one deterministic equipment mode through the native AC helper. */
export function resolveAutognomeArmorClass(
  scenario: AutognomeArmorClassScenarioState,
  mode: AutognomeArmorMode,
): AutognomeArmorClassScenarioState {
  if (!scenario.actor) {
    return {
      ...scenario,
      selectedMode: mode,
      outcome: 'Armored Casing rejected: the production-assembled Autognome actor is missing.',
      lastResolution: {
        status: 'rejected',
        reason: scenario.lastResolution?.reason ?? 'assembly_unavailable',
        mode,
        armorClass: null,
      },
    };
  }

  const resolved = calculateScenarioArmorClass(scenario.actor, mode);
  if (!resolved) {
    return {
      ...scenario,
      selectedMode: mode,
      outcome: 'Armored Casing rejected: the canonical Leather Armor item is missing from ALL_ITEMS.',
      lastResolution: {
        status: 'rejected',
        reason: 'armor_item_missing',
        mode,
        armorClass: null,
      },
    };
  }

  const dexterityModifier = getAbilityModifierValue(resolved.actor.finalAbilityScores.Dexterity);
  const armorName = resolved.actor.equippedItems.Torso?.name ?? 'no armor';
  return {
    ...scenario,
    actor: resolved.actor,
    selectedMode: mode,
    armorClass: resolved.armorClass,
    outcome: mode === 'unarmored'
      ? `Armored Casing resolved: base AC 13 + Dexterity modifier ${dexterityModifier} = ${resolved.armorClass}; no armor equipped.`
      : `Armored Casing guard resolved: ${armorName} is equipped, so the racial base AC is ignored; native armor calculation = ${resolved.armorClass}.`,
    lastResolution: {
      status: 'resolved',
      reason: 'resolved',
      mode,
      armorClass: resolved.armorClass,
    },
  };
}

// ============================================================================
// Autognome Leaf UI
// ============================================================================
// The controls keep canonical text, actor/equipment facts, the native AC
// comparison, event evidence, and the unsupported boundary visible together.
// The parent shell owns Reset; changing resetCount remounts this content.
// ============================================================================

const AutognomeRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [mode, setMode] = useState<AutognomeArmorMode>('unarmored');
  const [scenario, setScenario] = useState(
    () => createAutognomeArmorClassScenario(race),
  );
  const trait = getCanonicalArmoredCasingTrait(race);
  const actor = scenario.actor;
  const dexterityModifier = actor
    ? getAbilityModifierValue(actor.finalAbilityScores.Dexterity)
    : null;

  const handleResolve = () => {
    const nextScenario = resolveAutognomeArmorClass(scenario, mode);
    setScenario(nextScenario);
    onScenarioEvent(
      nextScenario.lastResolution?.status === 'resolved'
        ? `Autognome ARMORED CASING ${mode.toUpperCase()}: ${nextScenario.outcome}`
        : `Autognome ARMORED CASING REJECTED: ${nextScenario.outcome}`,
    );
  };

  return (
    <section aria-labelledby="autognome-armored-casing-title" data-testid="autognome-race-leaf">
      {/* The heading names the exact canonical trait transaction for assistive tools. */}
      <h4 id="autognome-armored-casing-title">Autognome · Armored Casing</h4>
      <p data-testid="autognome-canonical-trait">
        Canonical: {trait ?? 'Armored Casing trait missing'}
      </p>

      {/* The selector changes only the equipment case; calculateArmorClass remains authoritative. */}
      <label htmlFor={AUTOGNOME_ARMOR_MODE_CONTROL_ID}>Equipment case</label>
      <select
        id={AUTOGNOME_ARMOR_MODE_CONTROL_ID}
        value={mode}
        onChange={event => setMode(event.target.value as AutognomeArmorMode)}
      >
        <option value="unarmored">Unarmored · Armored Casing applies</option>
        <option value="leather-armor">Leather Armor · Armored Casing guard</option>
      </select>
      <Button type="button" onClick={handleResolve}>
        Resolve Autognome AC
      </Button>

      {/* These facts expose the assembled actor and real equipment shape, not just a selected label. */}
      <p data-testid="autognome-armor-actor">
        Actor: {actor?.name ?? 'missing'}; Class {actor?.class.id ?? 'unknown'} level {actor?.level ?? 'unknown'}; Dexterity modifier {dexterityModifier ?? 'unknown'}; Wearing {actor?.equippedItems.Torso?.name ?? 'no armor'}; AC {scenario.armorClass ?? 'not resolved'}.
      </p>
      <p data-testid="autognome-armor-comparison">
        Native comparison: unarmored AC {scenario.unarmoredArmorClass ?? 'unavailable'}; Leather Armor AC {scenario.armoredArmorClass ?? 'unavailable'}.
      </p>
      <p aria-live="polite" role="status" data-testid="autognome-armor-outcome">
        {scenario.outcome}
      </p>

      {/* This identifies the real parser and assembly path used to produce the actor. */}
      <p data-testid="autognome-assembly-boundary">
        Assembly path: createQuickCharacter → applyRacialSpellGrantsByLevel → calculateArmorClass; Leather Armor comes from ALL_ITEMS.
      </p>

      {/* These traits remain deliberately outside the claim until native mechanics exist. */}
      <p data-testid="autognome-unsupported-boundary">
        Unsupported boundary: this leaf does not claim Built for Success randomness, Healing Machine, poison resistance or condition saves, Sentry&apos;s Rest, Specialized Design, rests, 2D, or 3D.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. The keyed boundary restores the default
// unarmored selection and the production-assembled AC comparison together.
export const AutognomeRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <AutognomeRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping
// it local avoids a shared registry edit and preserves merge-safe leaf ownership.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'autognome-armored-casing',
  raceId: 'autognome',
  label: 'Autognome Armored Casing',
  description: 'Resolve canonical 13 + Dexterity unarmored AC and its armored guard through native assembly helpers.',
  Component: AutognomeRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
