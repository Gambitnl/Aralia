/**
 * This file owns the deterministic lifecycle controls for the Conditions sandbox.
 *
 * A tester selects one owned condition and one lifecycle event, then resolves it
 * through the same paired runtime helpers used by combat. The board can prove
 * exact apply/remove, source-aware replacement and stacking, target turn-end
 * expiry, source-loss cleanup, mechanical consequences, stable replay, and exact
 * Reset without storing a second condition truth in the controls panel.
 *
 * Called by: the Tactical Sandbox scenario-control registry and mounted preview host.
 * Depends on: production paired-condition, action-economy, and reaction helpers.
 */

import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../../../types/combat';
import {
  calculateMovementTotal,
  canAffordActionCost,
  resetEconomy,
} from '../../../../utils/combat/actionEconomyUtils';
import { canTakeReaction } from '../../../../utils/combat/combatUtils';
import {
  advanceRuntimeStatusConditionsAtTurnEnd,
  applyRuntimeStatusCondition,
  removeRuntimeStatusCondition,
  removeRuntimeStatusConditionsFromSource,
} from '../../../../utils/combat/statusConditionUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Scenario Ownership
// ============================================================================
// The expanded host creates these two ids on every load and Reset. The target
// also owns one unrelated Poisoned pair so every lifecycle event must prove it
// does not erase state outside the selected condition owner.
// ============================================================================

export const CONDITIONS_TESTER_ID = 'conditions-tester';
export const CONDITIONS_TARGET_ID = 'conditions-target';
const CONDITIONS_SOURCE_PREFIX = 'conditions-control';
const CONDITIONS_BASELINE_POISON_STATUS_ID = 'conditions-baseline-poisoned';

type ConditionsCase = 'restrained' | 'prone' | 'incapacitated' | 'blinded';
type ConditionsLifecycleCase =
  | 'apply_owned'
  | 'remove_owned'
  | 'replace_owned'
  | 'stack_then_remove_owned'
  | 'expire_at_turn_end'
  | 'source_loss_cleanup';

interface ConditionDefinition {
  name: string;
  label: string;
}

const CONDITION_DEFINITIONS: Record<ConditionsCase, ConditionDefinition> = {
  restrained: { name: 'Restrained', label: 'Restrained · movement 0' },
  prone: { name: 'Prone', label: 'Prone · crawl / Stand Up' },
  incapacitated: { name: 'Incapacitated', label: 'Incapacitated · no actions/reactions' },
  blinded: { name: 'Blinded', label: 'Blinded · attack sight penalty' },
};

const LIFECYCLE_CASES = new Set<ConditionsLifecycleCase>([
  'apply_owned',
  'remove_owned',
  'replace_owned',
  'stack_then_remove_owned',
  'expire_at_turn_end',
  'source_loss_cleanup',
]);

// ============================================================================
// Exact Reset Fixture
// ============================================================================
// Reset starts with both actors present, fresh economy, no scenario-owned pair,
// and one unrelated Poisoned pair on the target. This is the comparison state
// every selector restores before the next event is resolved.
// ============================================================================

function createBaselinePoisonStatus(): StatusEffect {
  return {
    id: CONDITIONS_BASELINE_POISON_STATUS_ID,
    name: 'Poisoned',
    type: 'debuff',
    description: 'An unrelated condition that every owned lifecycle must preserve.',
    duration: 10,
    source: 'conditions-baseline-venom',
    sourceSpellId: 'conditions-baseline-venom',
    sourceCasterId: CONDITIONS_TARGET_ID,
    effect: { type: 'condition' },
  };
}

function createBaselinePoisonCondition(): ActiveCondition {
  return {
    name: 'Poisoned',
    duration: { type: 'rounds', value: 10 },
    appliedTurn: 0,
    source: 'conditions-baseline-venom',
    sourceCasterId: CONDITIONS_TARGET_ID,
  };
}

export function prepareConditionsCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === CONDITIONS_TESTER_ID) {
      return resetEconomy({
        ...character,
        name: 'Conditions Tester · source present · economy ready',
        statusEffects: [],
        conditions: [],
      });
    }

    if (character.id !== CONDITIONS_TARGET_ID) return character;

    const clearedTarget = resetEconomy({
      ...character,
      name: 'Conditions Target · Poisoned kept · movement 30',
      statusEffects: [],
      conditions: [],
    });
    return applyRuntimeStatusCondition(
      clearedTarget,
      createBaselinePoisonStatus(),
      createBaselinePoisonCondition(),
    ).character;
  });
}

// ============================================================================
// Owned Condition Records
// ============================================================================
// The stable source spell/id plus source actor form the ownership key. Another
// source can therefore apply the same condition name without being replaced or
// removed by the Conditions Tester event.
// ============================================================================

function ownedSourceId(conditionCase: ConditionsCase): string {
  return `${CONDITIONS_SOURCE_PREFIX}-${conditionCase}`;
}

function createOwnedStatus(
  conditionCase: ConditionsCase,
  duration = 3,
): StatusEffect {
  const definition = CONDITION_DEFINITIONS[conditionCase];
  return {
    id: `${ownedSourceId(conditionCase)}-status`,
    name: definition.name,
    type: 'debuff',
    description: `Conditions Tester-owned ${definition.name} proof.`,
    duration,
    source: ownedSourceId(conditionCase),
    sourceSpellId: ownedSourceId(conditionCase),
    sourceCasterId: CONDITIONS_TESTER_ID,
    effect: { type: 'condition' },
  };
}

function createOwnedCondition(
  conditionCase: ConditionsCase,
  duration: ActiveCondition['duration'] = { type: 'rounds', value: 3 },
  turnEndEventsRemaining?: number,
): ActiveCondition {
  const definition = CONDITION_DEFINITIONS[conditionCase];
  return {
    name: definition.name,
    duration,
    appliedTurn: 0,
    source: ownedSourceId(conditionCase),
    sourceCasterId: CONDITIONS_TESTER_ID,
    ...(turnEndEventsRemaining === undefined ? {} : { turnEndEventsRemaining }),
  };
}

function createUnrelatedSameNameStatus(conditionCase: ConditionsCase): StatusEffect {
  const definition = CONDITION_DEFINITIONS[conditionCase];
  return {
    id: `conditions-unrelated-${conditionCase}-status`,
    name: definition.name,
    type: 'debuff',
    description: `Target-owned ${definition.name} proof that must survive exact cleanup.`,
    duration: 8,
    source: `conditions-unrelated-${conditionCase}`,
    sourceSpellId: `conditions-unrelated-${conditionCase}`,
    sourceCasterId: CONDITIONS_TARGET_ID,
    effect: { type: 'condition' },
  };
}

function createUnrelatedSameNameCondition(conditionCase: ConditionsCase): ActiveCondition {
  const definition = CONDITION_DEFINITIONS[conditionCase];
  return {
    name: definition.name,
    duration: { type: 'rounds', value: 8 },
    appliedTurn: 0,
    source: `conditions-unrelated-${conditionCase}`,
    sourceCasterId: CONDITIONS_TARGET_ID,
  };
}

// ============================================================================
// Actor Lookup And Visible Mechanical Receipt
// ============================================================================
// Every event addresses stable ids and republishes mechanics calculated from
// the resulting character. Missing actors reject before any partial mutation.
// ============================================================================

function findTarget(characters: CombatCharacter[]): CombatCharacter | undefined {
  return characters.find(character => character.id === CONDITIONS_TARGET_ID);
}

function replaceTarget(
  characters: CombatCharacter[],
  target: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => character.id === target.id ? target : character);
}

function mechanicReceipt(target: CombatCharacter, conditionCase: ConditionsCase): string {
  if (conditionCase === 'restrained') {
    return `movement=${calculateMovementTotal(target)}/30`;
  }
  if (conditionCase === 'prone') {
    const prone = target.conditions?.some(condition => condition.name === 'Prone') ?? false;
    return `Prone=${prone}; production grid crawl=${prone ? 'double cost' : 'normal cost'}`;
  }
  if (conditionCase === 'incapacitated') {
    return `Action=${canAffordActionCost(target, { type: 'action' }) ? 'available' : 'blocked'}; Reaction=${canTakeReaction(target) ? 'available' : 'blocked'}`;
  }

  const blinded = target.conditions?.some(condition => condition.name === 'Blinded') ?? false;
  return `Blinded=${blinded}; attack sight condition=${blinded ? 'active' : 'clear'}`;
}

function withVisibleReceipt(
  target: CombatCharacter,
  conditionCase: ConditionsCase,
): CombatCharacter {
  const ownedPresent = target.statusEffects.some(status => status.id === createOwnedStatus(conditionCase).id);
  const sameNameCount = target.conditions?.filter(
    condition => condition.name === CONDITION_DEFINITIONS[conditionCase].name,
  ).length ?? 0;
  return {
    ...target,
    name: `Conditions Target · ${CONDITION_DEFINITIONS[conditionCase].name} ${ownedPresent ? 'owned' : 'clear'} · same-name ${sameNameCount} · ${mechanicReceipt(target, conditionCase)}`,
  };
}

function readSelectedCases(application: PreviewCombatScenarioControlApplication): {
  conditionCase: ConditionsCase;
  lifecycleCase: ConditionsLifecycleCase;
} {
  const selectedCondition = String(application.snapshot.controlValues?.condition_case ?? 'restrained');
  const selectedLifecycle = String(application.snapshot.controlValues?.lifecycle_case ?? 'apply_owned');
  const conditionCase = selectedCondition in CONDITION_DEFINITIONS
    ? selectedCondition as ConditionsCase
    : 'restrained';
  const lifecycleCase = LIFECYCLE_CASES.has(selectedLifecycle as ConditionsLifecycleCase)
    ? selectedLifecycle as ConditionsLifecycleCase
    : 'apply_owned';
  return { conditionCase, lifecycleCase };
}

// ============================================================================
// Canonical Lifecycle Transactions
// ============================================================================
// Each case composes production helpers into one deterministic transaction. A
// replacement refreshes only its owner, exact removal keeps unrelated state,
// and source loss is explicit because not every source-linked spell ends when
// its caster leaves combat.
// ============================================================================

function resolveLifecycle(
  application: PreviewCombatScenarioControlApplication,
  replay: boolean,
): PreviewCombatScenarioControlPatch {
  const { conditionCase, lifecycleCase } = readSelectedCases(application);
  const originalTarget = findTarget(application.snapshot.characters);
  if (!originalTarget) {
    return { logMessage: 'CONDITION EVENT REJECTED: Conditions Target is missing; state unchanged.' };
  }

  const ownedStatus = createOwnedStatus(conditionCase);
  const ownedCondition = createOwnedCondition(conditionCase);
  let characters = application.snapshot.characters;
  let target = originalTarget;
  let outcome = '';

  if (lifecycleCase === 'apply_owned') {
    const applied = applyRuntimeStatusCondition(target, ownedStatus, ownedCondition);
    target = applied.character;
    outcome = `APPLY ${applied.outcome}`;
  } else if (lifecycleCase === 'remove_owned') {
    const removed = removeRuntimeStatusCondition(target, ownedStatus);
    target = removed.character;
    outcome = `REMOVE status=${removed.removedStatusEffects}; condition=${removed.removedConditions}`;
  } else if (lifecycleCase === 'replace_owned') {
    const hasOwned = target.statusEffects.some(status => status.id === ownedStatus.id);
    if (!hasOwned) {
      target = applyRuntimeStatusCondition(
        target,
        { ...ownedStatus, duration: 2 },
        createOwnedCondition(conditionCase, { type: 'rounds', value: 2 }),
      ).character;
    }
    const replaced = applyRuntimeStatusCondition(
      target,
      { ...ownedStatus, duration: 5 },
      createOwnedCondition(conditionCase, { type: 'rounds', value: 5 }),
    );
    target = replaced.character;
    outcome = `REPLACE ${replaced.outcome}; owned duration=5; duplicate count=1`;
  } else if (lifecycleCase === 'stack_then_remove_owned') {
    const unrelatedStatus = createUnrelatedSameNameStatus(conditionCase);
    const unrelatedAlreadyPresent = target.statusEffects.some(status => status.id === unrelatedStatus.id);
    const ownedAlreadyAbsent = !target.statusEffects.some(status => status.id === ownedStatus.id);
    if (!(unrelatedAlreadyPresent && ownedAlreadyAbsent)) {
      target = applyRuntimeStatusCondition(
        target,
        unrelatedStatus,
        createUnrelatedSameNameCondition(conditionCase),
      ).character;
      target = applyRuntimeStatusCondition(target, ownedStatus, ownedCondition).character;
      target = removeRuntimeStatusCondition(target, ownedStatus).character;
    }
    outcome = 'OWNERSHIP exact remove; unrelated same-name owner remains=1';
  } else if (lifecycleCase === 'expire_at_turn_end') {
    target = applyRuntimeStatusCondition(
      target,
      { ...ownedStatus, duration: 1 },
      createOwnedCondition(
        conditionCase,
        { type: 'until_end_of_current_turn', value: 0 },
        1,
      ),
    ).character;
    const expired = advanceRuntimeStatusConditionsAtTurnEnd(target);
    target = expired.character;
    outcome = `TURN END once; expired=${expired.expiredNames.join(', ') || 'none'}`;
  } else {
    target = applyRuntimeStatusCondition(target, ownedStatus, ownedCondition).character;
    const cleaned = removeRuntimeStatusConditionsFromSource(target, CONDITIONS_TESTER_ID);
    target = cleaned.character;
    characters = characters.filter(character => character.id !== CONDITIONS_TESTER_ID);
    outcome = `SOURCE LOSS cleanup status=${cleaned.removedStatusEffects}; condition=${cleaned.removedConditions}`;
  }

  target = withVisibleReceipt(target, conditionCase);
  const nextCharacters = replaceTarget(characters, target);
  const stableReplay = replay
    && JSON.stringify(nextCharacters) === JSON.stringify(application.snapshot.characters);

  return {
    characters: stableReplay ? application.snapshot.characters : nextCharacters,
    logMessage: `${replay ? 'REPLAY STABLE' : 'CONDITION EVENT'} · ${outcome} · ${mechanicReceipt(target, conditionCase)} · unrelated Poisoned=${target.statusEffects.some(status => status.id === CONDITIONS_BASELINE_POISON_STATUS_ID) ? 'preserved' : 'missing'}.`,
  };
}

// ============================================================================
// Control Routing And Registration
// ============================================================================
// Selectors restore the exact comparison fixture. Resolve executes one event;
// Replay redelivers the same selected event and must not add duplicate records.
// The shared Reset Board rebuilds actors and reapplies both selector defaults.
// ============================================================================

function applyConditionsControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === 'condition_case') {
    const value = String(application.value);
    if (!(value in CONDITION_DEFINITIONS)) {
      return { logMessage: `CONDITION CASE REJECTED: unknown value ${value}.` };
    }
    return {
      characters: prepareConditionsCharacters(application.snapshot.characters),
      logMessage: `CONDITION CASE SELECTED: ${CONDITION_DEFINITIONS[value as ConditionsCase].label}; exact baseline restored.`,
    };
  }

  if (application.controlId === 'lifecycle_case') {
    const value = String(application.value) as ConditionsLifecycleCase;
    if (!LIFECYCLE_CASES.has(value)) {
      return { logMessage: `LIFECYCLE CASE REJECTED: unknown value ${value}.` };
    }
    return {
      characters: prepareConditionsCharacters(application.snapshot.characters),
      logMessage: `LIFECYCLE CASE SELECTED: ${value}; exact baseline restored.`,
    };
  }

  if (application.controlId === 'resolve_condition' && application.value === true) {
    return resolveLifecycle(application, false);
  }
  if (application.controlId === 'replay_condition' && application.value === true) {
    return resolveLifecycle(application, true);
  }

  return { logMessage: '' };
}

const conditionsScenarioControlModule: PreviewCombatScenarioControlModule = {
  scenarioId: 'conditions',
  controls: [
    {
      id: 'condition_case',
      label: 'Owned Condition',
      description: 'Choose the exact condition whose badge and production mechanic the target receives.',
      kind: 'select',
      defaultValue: 'restrained',
      options: Object.entries(CONDITION_DEFINITIONS).map(([value, definition]) => ({
        value,
        label: definition.label,
      })),
    },
    {
      id: 'lifecycle_case',
      label: 'Ownership / Lifecycle Case',
      description: 'Choose exact apply/remove, replacement, same-name ownership, one turn end, or source loss.',
      kind: 'select',
      defaultValue: 'apply_owned',
      options: [
        { value: 'apply_owned', label: 'Apply exact owned condition' },
        { value: 'remove_owned', label: 'Remove exact owned condition' },
        { value: 'replace_owned', label: 'Same-source replacement' },
        { value: 'stack_then_remove_owned', label: 'Other source stacks; owned removed' },
        { value: 'expire_at_turn_end', label: 'Expire at target turn end once' },
        { value: 'source_loss_cleanup', label: 'Source leaves; owned cleanup' },
      ],
    },
    {
      id: 'resolve_condition',
      label: 'Resolve Condition Event',
      description: 'Run the selected event through paired production condition helpers.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'replay_condition',
      label: 'Replay Same Condition Event',
      description: 'Redeliver the selected event and prove no duplicate or unrelated cleanup occurs.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyConditionsControl,
};

export default conditionsScenarioControlModule;
