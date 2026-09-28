// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 18:03:47
 * Dependents: components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file gives the Death Saves & Downed State sandbox deterministic controls.
 *
 * A tester chooses an exact d20 face or downed-damage kind, then resolves that
 * event through the same pure death-save, damage, and healing transactions used
 * by live combat. The shared preview host owns the board and Reset Board; this
 * module changes only the scenario's downed player and returns a visible log.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: the shared control contract and production death-state helpers.
 */

import type { CombatCharacter } from '../../../../types/combat';
import {
  applyDamageAndCheckDowned,
  applyHealingAndRestore,
  resolveDeathSavingThrow,
  type DeathSavingThrowOutcome,
} from '../../../../utils/combat/deathSaveUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Scenario Identity and Player Controls
// ============================================================================
// Selectors author deterministic inputs but never resolve rules on their own.
// Action defaults are false, so scenario load and Reset Board remain exact and
// cannot accidentally roll, damage, or heal while defaults are being applied.
// ============================================================================

const TESTER_ID = 'death_saves-tester';
const ROLL_CHOICE_ID = 'death-save-roll';
const RESOLVE_ROLL_ID = 'resolve-death-save';
const DAMAGE_CHOICE_ID = 'downed-damage';
const APPLY_DAMAGE_ID = 'apply-downed-damage';
const APPLY_HEALING_ID = 'apply-healing';
const HEALING_AMOUNT = 5;

const controls: PreviewCombatScenarioControlModule['controls'] = [
  {
    id: ROLL_CHOICE_ID,
    label: 'Death-save roll',
    description: 'Choose the exact d20 face for the next turn-start death save.',
    kind: 'select',
    defaultValue: '10',
    options: [
      { value: '1', label: 'Natural 1 · two failures' },
      { value: '9', label: '9 · one failure' },
      { value: '10', label: '10 · one success' },
      { value: '20', label: 'Natural 20 · regain 1 HP' },
    ],
  },
  {
    id: RESOLVE_ROLL_ID,
    label: 'Resolve turn-start death save',
    description: 'Apply the selected roll through the production death-save transaction.',
    kind: 'action',
    defaultValue: false,
  },
  {
    id: DAMAGE_CHOICE_ID,
    label: 'Damage while downed',
    description: 'Choose normal damage or a critical hit while the tester is at 0 HP.',
    kind: 'select',
    defaultValue: 'normal',
    options: [
      { value: 'normal', label: 'Normal hit · one failure' },
      { value: 'critical', label: 'Critical hit · two failures' },
    ],
  },
  {
    id: APPLY_DAMAGE_ID,
    label: 'Apply selected downed damage',
    description: 'Resolve the chosen hit through production HP and death-save damage rules.',
    kind: 'action',
    defaultValue: false,
  },
  {
    id: APPLY_HEALING_ID,
    label: 'Heal 5 HP',
    description: 'Restore HP, clear death saves, and remove Unconscious through production healing.',
    kind: 'action',
    defaultValue: false,
  },
];

// ============================================================================
// Owned Character Updates
// ============================================================================
// Every action targets the stable scenario id and preserves every other actor
// by reference. Missing or still-loading fixtures return a visible safe no-op.
// ============================================================================

function updateTester(
  snapshot: PreviewCombatScenarioControlSnapshot,
  update: (character: CombatCharacter) => CombatCharacter,
): CombatCharacter[] | null {
  if (!snapshot.characters.some(character => character.id === TESTER_ID)) {
    return null;
  }

  return snapshot.characters.map(character => (
    character.id === TESTER_ID ? update(character) : character
  ));
}

function applyTesterAction(
  application: PreviewCombatScenarioControlApplication,
  update: (character: CombatCharacter) => CombatCharacter,
  logMessage: (before: CombatCharacter, after: CombatCharacter) => string,
): PreviewCombatScenarioControlPatch {
  let before: CombatCharacter | null = null;
  let after: CombatCharacter | null = null;
  const characters = updateTester(application.snapshot, character => {
    before = character;
    after = update(character);
    return after;
  });

  if (!characters || !before || !after) {
    return { logMessage: 'Death-save control was ignored because the scenario tester is unavailable.' };
  }

  return { characters, logMessage: logMessage(before, after) };
}

// ============================================================================
// Deterministic Turn-Start Roll
// ============================================================================
// The selected face is the only authored fact. resolveDeathSavingThrow owns
// pip limits, natural 1/20 behavior, stabilization, death, and recovery.
// ============================================================================

function describeRollOutcome(
  character: CombatCharacter,
  roll: number,
  outcome: DeathSavingThrowOutcome,
): string {
  if (outcome === 'not_eligible') {
    if (character.deathSaves?.isStable) {
      return `${character.name} is Stable; replay makes no death save.`;
    }
    if ((character.deathSaves?.failures ?? 0) >= 3) {
      return `${character.name} is dead after three failures; replay is an exact no-op.`;
    }
    return `${character.name} has recovered and makes no death save.`;
  }

  if (outcome === 'revived') {
    return `${character.name} rolls a natural 20, regains 1 HP, clears death saves, and wakes.`;
  }

  const tracker = character.deathSaves;
  const finalState = outcome === 'stable'
    ? ' Stable after three successes.'
    : outcome === 'dead'
      ? ' Dead after three failures.'
      : '';
  return `${character.name} rolls ${roll}: ${tracker?.successes ?? 0} successes, ${tracker?.failures ?? 0} failures.${finalState}`;
}

function resolveSelectedDeathSave(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const rollText = String(application.snapshot.controlValues?.[ROLL_CHOICE_ID] ?? '10');
  const roll = Number(rollText);
  if (!['1', '9', '10', '20'].includes(rollText)) {
    return { logMessage: `Unknown deterministic death-save roll: ${rollText}.` };
  }

  let outcome: DeathSavingThrowOutcome = 'not_eligible';
  return applyTesterAction(
    application,
    character => {
      const result = resolveDeathSavingThrow(character, roll);
      outcome = result.outcome;
      return result.character;
    },
    (_before, after) => describeRollOutcome(after, roll, outcome),
  );
}

// ============================================================================
// Damage While Downed
// ============================================================================
// Production damage applies one failure, or two for a critical hit, and breaks
// stabilization. The scenario does not infer five-foot critical adjacency;
// the selector explicitly supplies the critical fact supported by the helper.
// ============================================================================

function resolveSelectedDamage(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const damageKind = String(application.snapshot.controlValues?.[DAMAGE_CHOICE_ID] ?? 'normal');
  if (damageKind !== 'normal' && damageKind !== 'critical') {
    return { logMessage: `Unknown downed-damage choice: ${damageKind}.` };
  }

  return applyTesterAction(
    application,
    character => {
      if (character.currentHP !== 0 || !character.deathSaves || character.deathSaves.failures >= 3) {
        return character;
      }
      return applyDamageAndCheckDowned(character, 1, damageKind === 'critical');
    },
    (before, after) => {
      if (before === after) {
        return `${before.name} cannot take another downed-damage failure in the current state; exact no-op.`;
      }
      const failureDelta = (after.deathSaves?.failures ?? 0) - (before.deathSaves?.failures ?? 0);
      const finalState = (after.deathSaves?.failures ?? 0) >= 3 ? ' Dead after three failures.' : '';
      return `${after.name} takes ${damageKind} damage at 0 HP: +${failureDelta} failure${failureDelta === 1 ? '' : 's'}; stabilization ends.${finalState}`;
    },
  );
}

// ============================================================================
// Healing Recovery
// ============================================================================
// Healing is deliberately repeat-safe for this proof surface. The first click
// uses the production helper; later clicks do not stack another teaching heal.
// ============================================================================

function resolveHealing(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  return applyTesterAction(
    application,
    character => character.currentHP > 0
      ? character
      : applyHealingAndRestore(character, HEALING_AMOUNT),
    (before, after) => {
      if (before === after) {
        return `${before.name} is already recovered; repeated healing proof is an exact no-op.`;
      }
      if (after.currentHP === 0) {
        return `${after.name} remains downed because Hit Point recovery is blocked.`;
      }
      return `${after.name} regains ${after.currentHP} HP, clears death saves, and wakes.`;
    },
  );
}

// ============================================================================
// Control Dispatch and Registry Export
// ============================================================================
// Selectors and false action defaults are inert. Only an explicit true action
// resolves a transaction, so Reset Board can recreate the authored 1S/1F state.
// ============================================================================

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === ROLL_CHOICE_ID || application.controlId === DAMAGE_CHOICE_ID) {
    return { logMessage: '' };
  }

  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Death-save action ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === RESOLVE_ROLL_ID) {
    return resolveSelectedDeathSave(application);
  }
  if (application.controlId === APPLY_DAMAGE_ID) {
    return resolveSelectedDamage(application);
  }
  if (application.controlId === APPLY_HEALING_ID) {
    return resolveHealing(application);
  }

  return { logMessage: `Unknown death-save scenario control: ${application.controlId}.` };
}

export const deathSavesScenarioControlModule: PreviewCombatScenarioControlModule = {
  scenarioId: 'death_saves',
  controls,
  applyControl,
};

export default deathSavesScenarioControlModule;
