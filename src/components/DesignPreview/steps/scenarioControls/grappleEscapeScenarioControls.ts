// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 02:52:34
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the four deterministic actions for Grapple & Escape.
 *
 * The controls apply or release a real paired Grappled condition, make one
 * fixed successful escape attempt through the shared ability-check resolver,
 * and incapacitate the grappler before the canonical maintenance pass. The
 * Tactical Sandbox host applies the returned combatant roster to both 2D and
 * 3D battle maps; this module keeps no browser-only grapple state.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: shared grapple, condition, and action-economy mechanics.
 */

import type {
  ActiveCondition,
  CombatCharacter,
  StatusEffect,
} from '../../../../types/combat';
import {
  applyGrappledCondition,
  reconcileGrappleMaintenance,
  removeGrappledCondition,
  resolveGrappleEscapeAttempt,
} from '../../../../utils/combat/grappleUtils';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { applyRuntimeStatusCondition } from '../../../../utils/combat/statusConditionUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Board Facts
// ============================================================================
// The scenario builder places these two ids on adjacent cells inside the sand
// reach ring. Actions always restore that authored relationship before applying
// a new hold, making the proof repeatable after escape or auto-release.
// ============================================================================

export const GRAPPLE_ESCAPE_GRAPPLER_ID = 'grapple_escape-tester';
export const GRAPPLE_ESCAPE_TARGET_ID = 'grapple_escape-target';
export const GRAPPLE_ESCAPE_DC = 13;
export const GRAPPLE_ESCAPE_GRAPPLER_INITIATIVE = 18;
export const GRAPPLE_ESCAPE_TARGET_INITIATIVE = 12;

const GRAPPLER_START = { x: 6, y: 5 } as const;
const TARGET_START = { x: 7, y: 5 } as const;
const SANDBOX_SOURCE = 'Tactical Sandbox Grapple';
const INCAPACITATED_SOURCE = 'Tactical Sandbox grapple maintenance control';

// A constant random sample resolves to an 18 on the shared d20 roller. The
// target's real Dexterity and Acrobatics modifiers are still applied afterward.
const SUCCESSFUL_ESCAPE_RNG = (): number => 0.89;

/**
 * Returns the authored full initiative total used only by this preview lane.
 * The production turn manager still rolls normally when no harness injects a
 * roller; these stable totals make every Reset Board begin on the Grappler.
 */
export function getGrappleEscapeInitiativeTotal(character: CombatCharacter): number {
  if (character.id === GRAPPLE_ESCAPE_GRAPPLER_ID) {
    return GRAPPLE_ESCAPE_GRAPPLER_INITIATIVE;
  }
  if (character.id === GRAPPLE_ESCAPE_TARGET_ID) {
    return GRAPPLE_ESCAPE_TARGET_INITIATIVE;
  }
  return character.initiative;
}

// ============================================================================
// Repeatable Character Setup
// ============================================================================
// These helpers clear only the scenario-owned incapacity marker, reset ordinary
// turn resources, and preserve every other combat fact on both actors.
// ============================================================================

function removeSandboxIncapacitated(character: CombatCharacter): CombatCharacter {
  const statusEffects = character.statusEffects.filter(effect => !(
    effect.name === 'Incapacitated' && effect.source === INCAPACITATED_SOURCE
  ));
  const conditions = (character.conditions ?? []).filter(condition => !(
    condition.name === 'Incapacitated' && condition.source === INCAPACITATED_SOURCE
  ));

  if (
    statusEffects.length === character.statusEffects.length
    && conditions.length === (character.conditions ?? []).length
  ) {
    return character;
  }

  return { ...character, statusEffects, conditions };
}

function prepareGrappler(character: CombatCharacter): CombatCharacter {
  const capable = removeSandboxIncapacitated(character);
  return resetEconomy({ ...capable, position: { ...GRAPPLER_START } });
}

function prepareTarget(character: CombatCharacter): CombatCharacter {
  const unheld = removeGrappledCondition(character, GRAPPLE_ESCAPE_GRAPPLER_ID);
  return resetEconomy({ ...unheld, position: { ...TARGET_START } });
}

function createIncapacitatedStatus(): StatusEffect {
  return {
    id: 'grapple-escape-grappler-incapacitated',
    name: 'Incapacitated',
    type: 'debuff',
    description: 'Cannot maintain the adjacent grapple.',
    duration: 10,
    source: INCAPACITATED_SOURCE,
    effect: { type: 'condition' },
  };
}

function createIncapacitatedCondition(): ActiveCondition {
  return {
    name: 'Incapacitated',
    duration: { type: 'rounds', value: 10 },
    appliedTurn: 0,
    source: INCAPACITATED_SOURCE,
  };
}

function requireActors(snapshot: PreviewCombatScenarioControlApplication['snapshot']): {
  grappler: CombatCharacter;
  target: CombatCharacter;
} | null {
  const grappler = snapshot.characters.find(character => character.id === GRAPPLE_ESCAPE_GRAPPLER_ID);
  const target = snapshot.characters.find(character => character.id === GRAPPLE_ESCAPE_TARGET_ID);
  return grappler && target ? { grappler, target } : null;
}

function replaceActors(
  characters: CombatCharacter[],
  grappler: CombatCharacter,
  target: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === grappler.id) return grappler;
    if (character.id === target.id) return target;
    return character;
  });
}

// ============================================================================
// Scenario Action Resolution
// ============================================================================
// Action controls ignore their false reset value during board initialization.
// Clicking a visible action sends true once, then the shared panel returns the
// button to its default without maintaining a second copy of grapple state.
// ============================================================================

function applyGrappleAction(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const actors = requireActors(application.snapshot);

  if (!actors) {
    return { logMessage: 'Grapple control skipped because its two authored actors are unavailable.' };
  }

  const grappler = prepareGrappler(actors.grappler);
  const target = applyGrappledCondition(prepareTarget(actors.target), {
    grapplerId: GRAPPLE_ESCAPE_GRAPPLER_ID,
    escapeDc: GRAPPLE_ESCAPE_DC,
    source: SANDBOX_SOURCE,
  });

  return {
    characters: replaceActors(application.snapshot.characters, grappler, target),
    logMessage: 'Grapple applied: Escape Target is Grappled at 5-foot reach and has 0 feet of movement.',
  };
}

function releaseGrappleAction(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const actors = requireActors(application.snapshot);

  if (!actors) {
    return { logMessage: 'Release control skipped because its two authored actors are unavailable.' };
  }

  const target = removeGrappledCondition(actors.target, GRAPPLE_ESCAPE_GRAPPLER_ID);
  return {
    characters: replaceActors(application.snapshot.characters, actors.grappler, target),
    logMessage: 'Grapple released: Escape Target can use its normal movement again.',
  };
}

function attemptEscapeAction(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const actors = requireActors(application.snapshot);

  if (!actors) {
    return { logMessage: 'Escape attempt skipped because its two authored actors are unavailable.' };
  }

  const result = resolveGrappleEscapeAttempt(
    actors.target,
    'Dexterity',
    'Acrobatics',
    { rng: SUCCESSFUL_ESCAPE_RNG },
  );

  if (!result.attempted || !result.check) {
    return {
      logMessage: `Escape attempt skipped: ${result.reason ?? 'the Grappled condition is unavailable'}.`,
    };
  }

  return {
    characters: replaceActors(application.snapshot.characters, actors.grappler, result.character),
    logMessage: `Escape attempt: d20 ${result.check.roll}, total ${result.check.total} vs DC ${GRAPPLE_ESCAPE_DC} — ${result.success ? 'success; Grappled ends.' : 'failure; Grappled remains.'}`,
  };
}

function incapacitateGrapplerAction(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const actors = requireActors(application.snapshot);

  if (!actors) {
    return { logMessage: 'Maintenance control skipped because its two authored actors are unavailable.' };
  }

  const grappler = applyRuntimeStatusCondition(
    actors.grappler,
    createIncapacitatedStatus(),
    createIncapacitatedCondition(),
  ).character;
  const withIncapacity = replaceActors(application.snapshot.characters, grappler, actors.target);
  const maintenance = reconcileGrappleMaintenance(withIncapacity);
  const released = maintenance.releases.some(release => (
    release.targetId === GRAPPLE_ESCAPE_TARGET_ID
    && release.reason === 'grappler_incapacitated'
  ));

  return {
    characters: maintenance.characters,
    logMessage: released
      ? 'Auto-release: the Grappler became Incapacitated and could no longer maintain Grappled.'
      : 'The Grappler is Incapacitated; no maintained grapple was present to release.',
  };
}

function applyGrappleEscapeControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  // False is the action button's inert reset/default value. Other value types
  // are malformed and remain visible as no-op log messages.
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Grapple & Escape control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'apply-grapple') return applyGrappleAction(application);
  if (application.controlId === 'release-grapple') return releaseGrappleAction(application);
  if (application.controlId === 'attempt-escape') return attemptEscapeAction(application);
  if (application.controlId === 'incapacitate-grappler') return incapacitateGrapplerAction(application);

  return { logMessage: `Unknown Grapple & Escape control: ${application.controlId}.` };
}

// ============================================================================
// Registry Module
// ============================================================================
// Four actions map directly to the required proof chain. The authored board
// begins Grappled; these defaults are inert because action buttons must never
// fire automatically during Reset Board initialization.
// ============================================================================

const grappleEscapeScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'grapple_escape',
  controls: [
    {
      id: 'apply-grapple',
      label: 'Apply Grapple',
      description: 'Reset both actors inside the sand 5-foot reach ring and apply Grappled with DC 13.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'release-grapple',
      label: 'Release Grapple',
      description: 'Remove the maintained hold and restore the target’s production movement pool.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'attempt-escape',
      label: 'Attempt Escape',
      description: 'Spend the target’s action on a deterministic Dexterity (Acrobatics) check against DC 13.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'incapacitate-grappler',
      label: 'Incapacitate Grappler',
      description: 'Apply Incapacitated, then run the canonical maintenance check for automatic release.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyGrappleEscapeControl,
};

export default grappleEscapeScenarioControls;
