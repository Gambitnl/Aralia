// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file is an isolated Race-domain leaf.
 *
 * MULTI-AGENT SAFETY:
 * This leaf is intentionally self-contained so a Changeling implementation
 * does not require edits to a shared registry or to another Race leaf.
 */
// @dependencies-end

import React, { useState } from 'react';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { CombatCharacter } from '../../../../../types/combat';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../../utils/combat/actionEconomyUtils';
import { createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file demonstrates the canonical Changeling Shapechanger action in the
 * Tactical Sandbox Race domain.
 *
 * The actor comes from the production quick-character assembly path and pays
 * the shared Action economy. The current runtime has no race-aware appearance
 * resolver, so the visible face, voice, and Small/Medium choice live in a
 * narrow adapter state. That adapter never changes combat statistics, hit
 * points, equipment, or other mechanics.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Changeling trait text, quick combat assembly, and the
 * native action-economy helpers.
 */

// ============================================================================
// Canonical Shapechanger Facts
// ============================================================================
// These helpers keep the demonstration tied to the supplied canonical Race
// record. The adapter below can show only the part of Shapechanger for which
// the current combat model has no production appearance resolver.
// ============================================================================

export const CHANGELING_SHAPECHANGER_CONTROL_ID = 'resolve-changeling-shapechanger';
export const CHANGELING_SHAPECHANGER_APPEARANCE_CONTROL_ID = 'changeling-shapechanger-appearance';
export const CHANGELING_ACTOR_ID = 'changeling-shapechanger-actor';

const CANONICAL_SHAPECHANGER_TRAIT = /^Shapechanger:\s*/i;

export type ChangelingAppearanceId = 'moonlit-medium' | 'cinder-small';
export type ChangelingSize = 'Small' | 'Medium';

export interface ChangelingAppearanceState {
  id: ChangelingAppearanceId | 'original-medium';
  label: string;
  voice: string;
  size: ChangelingSize;
}

export const CHANGELING_APPEARANCE_OPTIONS: readonly ChangelingAppearanceState[] = [
  {
    id: 'moonlit-medium',
    label: 'Moonlit mask',
    voice: 'clear alto',
    size: 'Medium',
  },
  {
    id: 'cinder-small',
    label: 'Cinder mask',
    voice: 'quiet tenor',
    size: 'Small',
  },
];

const ORIGINAL_APPEARANCE: ChangelingAppearanceState = {
  id: 'original-medium',
  label: 'Original face',
  voice: 'original voice',
  size: 'Medium',
};

/** Read the authored Shapechanger trait without copying its rules into a new source. */
export function getCanonicalShapechangerTrait(race: Race): string | null {
  return race.traits.find(trait => CANONICAL_SHAPECHANGER_TRAIT.test(trait.trim())) ?? null;
}

/** Confirm the supplied race still contains the exact Shapechanger facts this leaf can show. */
export function hasCanonicalShapechanger(race: Race): boolean {
  const trait = getCanonicalShapechangerTrait(race);
  return race.id === 'changeling'
    && !!trait
    && /as an action/i.test(trait)
    && /change your appearance and your voice/i.test(trait)
    && /change your size between medium and small/i.test(trait)
    && /none of your game statistics change/i.test(trait)
    // The authored data uses a typographic apostrophe, so match the stable
    // meaning of the equipment clause without normalizing the source text.
    && /clothing and equipment.{0,8}changed/i.test(trait);
}

// ============================================================================
// Production Actor And Appearance Adapter
// ============================================================================
// The combat actor is assembled by the same quick-character seam used by the
// other Race leaves. Appearance is deliberately separate because CombatCharacter
// has no production race-aware face or voice resolver at this boundary.
// ============================================================================

export interface ChangelingShapechangerScenarioState {
  actor: CombatCharacter | null;
  appearance: ChangelingAppearanceState;
  outcome: string;
  lastResolution: ChangelingShapechangerResolution | null;
}

export interface ChangelingShapechangerResolution {
  status: 'resolved' | 'rejected';
  reason?: string;
  actor: CombatCharacter | null;
  appearance: ChangelingAppearanceState;
}

function createChangelingActor(race: Race): CombatCharacter | null {
  // Build real class, race, HP, statistics, equipment, and combat fields so
  // Shapechanger can prove that the appearance adapter does not replace them.
  const generatedActor = createQuickCombatCharacter({
    name: 'Changeling Shapechanger Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 3,
    stats: [10, 14, 12, 10, 10, 14],
  });
  if (!generatedActor || !hasCanonicalShapechanger(race)) return null;

  // Reset through the shared helper so the first Shapechanger use begins with
  // the same Action, Bonus Action, Reaction, and movement counters as combat.
  return resetEconomy({
    ...generatedActor,
    id: CHANGELING_ACTOR_ID,
    name: `${race.name} Shapechanger Tester`,
  });
}

/** Create the canonical baseline restored by the keyed leaf boundary. */
export function createChangelingShapechangerScenario(
  race: Race,
): ChangelingShapechangerScenarioState {
  const actor = createChangelingActor(race);
  const usable = !!actor && hasCanonicalShapechanger(race);
  return {
    actor,
    appearance: { ...ORIGINAL_APPEARANCE },
    outcome: usable
      ? `Ready: ${race.name} Shapechanger; Action ready; original face and voice; Medium.`
      : 'Shapechanger unavailable: the canonical Changeling trait or production actor assembly is missing.',
    lastResolution: null,
  };
}

function rejectShapechanger(
  scenario: ChangelingShapechangerScenarioState,
  reason: string,
): ChangelingShapechangerScenarioState {
  // Return the original actor and appearance references on every rejection so
  // a failed use cannot spend an Action or partially apply a transformation.
  const lastResolution: ChangelingShapechangerResolution = {
    status: 'rejected',
    reason,
    actor: scenario.actor,
    appearance: scenario.appearance,
  };
  return {
    ...scenario,
    lastResolution,
    outcome: `Shapechanger rejected atomically: ${reason} Appearance, Action, HP, statistics, equipment, and mechanics unchanged.`,
  };
}

/** Resolve one deterministic appearance choice through the native Action payer. */
export function resolveChangelingShapechanger(
  scenario: ChangelingShapechangerScenarioState,
  appearanceId: ChangelingAppearanceId,
): ChangelingShapechangerScenarioState {
  const targetAppearance = CHANGELING_APPEARANCE_OPTIONS.find(option => option.id === appearanceId);
  if (!targetAppearance) {
    return rejectShapechanger(scenario, 'the selected appearance is not canonical.');
  }
  if (!scenario.actor) {
    return rejectShapechanger(scenario, 'the production-assembled actor is unavailable.');
  }

  // The Action cost is checked before any appearance state changes, preserving
  // atomic rejection when the actor has already spent this turn's Action.
  const actionCost = { type: 'action' as const };
  if (!canAffordActionCost(scenario.actor, actionCost)) {
    return rejectShapechanger(scenario, 'the Action is already used.');
  }

  // Only the native Action economy and the non-mechanical appearance adapter
  // change. The production actor's statistics, HP, equipment, and abilities
  // are carried forward untouched by this trait demonstration.
  const paidActor = consumeActionCost(scenario.actor, actionCost);
  const lastResolution: ChangelingShapechangerResolution = {
    status: 'resolved',
    actor: paidActor,
    appearance: { ...targetAppearance },
  };
  return {
    actor: paidActor,
    appearance: { ...targetAppearance },
    lastResolution,
    outcome: `Shapechanger resolved: ${targetAppearance.label}; voice ${targetAppearance.voice}; size ${targetAppearance.size}; Action paid. Combat statistics, HP, equipment, and other mechanics unchanged.`,
  };
}

// ============================================================================
// Changeling Leaf UI
// ============================================================================
// The controls expose the canonical trait, the live production actor, the
// appearance adapter, and the native Action result. The parent owns Reset;
// changing resetCount remounts this content and restores the baseline.
// ============================================================================

const ChangelingRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [appearanceId, setAppearanceId] = useState<ChangelingAppearanceId>('moonlit-medium');
  const [scenario, setScenario] = useState<ChangelingShapechangerScenarioState>(
    () => createChangelingShapechangerScenario(race),
  );
  const actor = scenario.actor;
  const targetAppearance = CHANGELING_APPEARANCE_OPTIONS.find(option => option.id === appearanceId);

  const handleResolve = () => {
    const nextScenario = resolveChangelingShapechanger(scenario, appearanceId);
    setScenario(nextScenario);
    onScenarioEvent(
      nextScenario.lastResolution?.status === 'resolved'
        ? `Changeling SHAPECHANGER RESOLVED: ${nextScenario.outcome}`
        : `Changeling SHAPECHANGER REJECTED ATOMICALLY: ${nextScenario.outcome}`,
    );
  };

  return (
    <section aria-labelledby="changeling-shapechanger-title" data-testid="changeling-race-leaf">
      {/* The heading names the canonical trait so the visible control has a clear purpose. */}
      <h4 id="changeling-shapechanger-title">Changeling Shapechanger</h4>
      <p data-testid="changeling-canonical-trait">
        Canonical: {getCanonicalShapechangerTrait(race) ?? 'Shapechanger trait unavailable.'}
      </p>

      {/* This select changes only the deterministic adapter target; the native Action remains authoritative. */}
      <label htmlFor={CHANGELING_SHAPECHANGER_APPEARANCE_CONTROL_ID}>Shapechanger appearance</label>
      <select
        id={CHANGELING_SHAPECHANGER_APPEARANCE_CONTROL_ID}
        value={appearanceId}
        onChange={event => setAppearanceId(event.target.value as ChangelingAppearanceId)}
      >
        {CHANGELING_APPEARANCE_OPTIONS.map(option => (
          <option key={option.id} value={option.id}>
            {option.label} · {option.voice} · {option.size}
          </option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>
        Use Shapechanger (Action)
      </Button>

      {/* These facts expose the real actor and its paid Action, not a fake transformed stat block. */}
      <p data-testid="changeling-actor">
        Actor: {actor?.name ?? 'missing'}; HP {actor?.currentHP ?? 'unknown'}/{actor?.maxHP ?? 'unknown'}; Speed {actor?.stats.speed ?? 'unknown'} ft; Action {actor?.actionEconomy.action.used ? 'used' : 'ready'}; Equipment {actor?.equippedItems?.length ?? 0} item(s).
      </p>
      <p data-testid="changeling-appearance">
        Appearance: {scenario.appearance.label}; Voice: {scenario.appearance.voice}; Size: {scenario.appearance.size}; Target: {targetAppearance?.label ?? 'missing'}.
      </p>
      <p aria-live="polite" role="status" data-testid="changeling-outcome">{scenario.outcome}</p>

      {/* No production appearance resolver exists yet, so this boundary is explicit instead of claiming a mechanical form change. */}
      <p data-testid="changeling-appearance-boundary">
        Unsupported boundary: no production race-aware appearance resolver exists; this adapter changes only visible preview appearance, voice, and Small/Medium state. It does not fake a mechanical transformation or alter combat statistics, HP, equipment, or other mechanics.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed content boundary restores the
// original appearance, actor, Action economy, and unresolved outcome without
// an effect-driven cascading render.
export const ChangelingRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <ChangelingRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. The
// registration stays local so another Race leaf can land without a registry edit.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'changeling',
  raceId: 'changeling',
  label: 'Changeling',
  description: 'Resolve the canonical Shapechanger Action through native actor assembly and action-economy helpers.',
  Component: ChangelingRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
