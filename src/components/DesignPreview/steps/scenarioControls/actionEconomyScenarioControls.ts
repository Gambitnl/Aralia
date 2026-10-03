/**
 * This file adapts the Action Economy Stress Test controls to production combat state.
 *
 * A tester selects one resource event, resolves it, deliberately attempts a
 * second spent use, replays the same stable event, and advances the real turn
 * manager. The adapter does not calculate affordability or reset resources: it
 * delegates payment and replay to actionEconomyResolution and asks the mounted
 * host to use its ordinary End Turn transaction.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: the production action-economy transaction and shared control contract.
 */

import {
  resolveActionEconomyEvent,
  type ActionEconomyResourceCase,
} from '../../../../systems/combat/actionEconomyResolution';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Scenario Identity And Controls
// ============================================================================
// The scenario builder already owns these actor ids and real initiative. Every
// resource event uses a stable id per selected case so Replay can prove a second
// delivery is harmless while a distinct spent attempt remains a clear rejection.
// ============================================================================

const TESTER_ID = 'action_economy-tester';
const TARGET_ID = 'action_economy-target';
const RESOURCE_CASE_CONTROL_ID = 'resource-case';
const RESOLVE_EVENT_CONTROL_ID = 'resolve-resource-event';
const ATTEMPT_SPENT_CONTROL_ID = 'attempt-spent-resource';
const REPLAY_EVENT_CONTROL_ID = 'replay-resource-event';
const ADVANCE_TURN_CONTROL_ID = 'advance-turn-boundary';

const RESOURCE_CASES = new Set<ActionEconomyResourceCase>([
  'action',
  'bonus_action',
  'reaction_outside_turn',
  'free_interaction',
  'movement',
  'combined_sequence',
  'action_surge',
]);

const controls: PreviewCombatScenarioControlModule['controls'] = [
  {
    id: RESOURCE_CASE_CONTROL_ID,
    label: 'Resource event',
    description: 'Choose one independent resource, the combined sequence, or advertised Action Surge.',
    kind: 'select',
    defaultValue: 'action',
    options: [
      { value: 'action', label: 'Action' },
      { value: 'bonus_action', label: 'Bonus Action' },
      { value: 'reaction_outside_turn', label: 'Reaction outside turn' },
      { value: 'free_interaction', label: 'Free object interaction' },
      { value: 'movement', label: 'Movement (30 ft)' },
      { value: 'combined_sequence', label: 'Combined sequence' },
      { value: 'action_surge', label: 'Action Surge (if advertised)' },
    ],
  },
  {
    id: RESOLVE_EVENT_CONTROL_ID,
    label: 'Resolve resource event',
    description: 'Pay the selected cost through the production economy transaction.',
    kind: 'action',
    defaultValue: false,
  },
  {
    id: ATTEMPT_SPENT_CONTROL_ID,
    label: 'Attempt new use while spent',
    description: 'Deliver a distinct event and prove rejection happens before any further mutation.',
    kind: 'action',
    defaultValue: false,
  },
  {
    id: REPLAY_EVENT_CONTROL_ID,
    label: 'Replay same stable event',
    description: 'Redeliver the first event id and prove it cannot spend or refresh anything twice.',
    kind: 'action',
    defaultValue: false,
  },
  {
    id: ADVANCE_TURN_CONTROL_ID,
    label: 'Advance real turn',
    description: 'End the current owner turn; another actor resets first, then the tester resets only on its own turn.',
    kind: 'action',
    defaultValue: false,
  },
];

// ============================================================================
// Selected Case And Production Dispatch
// ============================================================================

function getSelectedCase(application: PreviewCombatScenarioControlApplication): ActionEconomyResourceCase | null {
  const selected = application.controlId === RESOURCE_CASE_CONTROL_ID
    ? application.value
    : application.snapshot.controlValues?.[RESOURCE_CASE_CONTROL_ID];
  return typeof selected === 'string' && RESOURCE_CASES.has(selected as ActionEconomyResourceCase)
    ? selected as ActionEconomyResourceCase
    : null;
}

function resolveSelectedEvent(
  application: PreviewCombatScenarioControlApplication,
  delivery: 'resolve' | 'replay',
  eventOrdinal: 1 | 2,
): PreviewCombatScenarioControlPatch {
  const resourceCase = getSelectedCase(application);
  if (!resourceCase) {
    return { logMessage: 'Action Economy event rejected: choose a valid resource case first.' };
  }

  const result = resolveActionEconomyEvent({
    characters: application.snapshot.characters,
    actorId: TESTER_ID,
    reactionActorId: TARGET_ID,
    currentTurnOwnerId: application.snapshot.turnState?.currentCharacterId ?? null,
    eventId: `cs18-${resourceCase}-${eventOrdinal}`,
    resourceCase,
    delivery,
  });

  return {
    characters: result.outcome === 'accepted' ? result.characters : undefined,
    logMessage: result.message,
  };
}

// ============================================================================
// Registered Scenario Module
// ============================================================================

export const actionEconomyScenarioControlModule: PreviewCombatScenarioControlModule = {
  scenarioId: 'action_economy',
  controls,
  applyControl: application => {
    if (application.controlId === RESOURCE_CASE_CONTROL_ID) {
      const selected = getSelectedCase(application);
      return {
        logMessage: selected
          ? `Action Economy case selected: ${selected.replaceAll('_', ' ')}.`
          : 'Action Economy case selection ignored because the value is invalid.',
      };
    }

    if (application.controlId === RESOLVE_EVENT_CONTROL_ID) {
      return resolveSelectedEvent(application, 'resolve', 1);
    }

    if (application.controlId === ATTEMPT_SPENT_CONTROL_ID) {
      return resolveSelectedEvent(application, 'resolve', 2);
    }

    if (application.controlId === REPLAY_EVENT_CONTROL_ID) {
      return resolveSelectedEvent(application, 'replay', 1);
    }

    if (application.controlId === ADVANCE_TURN_CONTROL_ID) {
      return {
        endTurn: true,
        logMessage: 'Action Economy requested the production End Turn transaction; only the next owner receives its start-of-turn reset.',
      };
    }

    return {
      logMessage: `Unknown Action Economy scenario control: ${application.controlId}.`,
    };
  },
};

export default actionEconomyScenarioControlModule;
