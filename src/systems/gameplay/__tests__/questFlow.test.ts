/**
 * This file tests the quest lifecycle, objective tracking, deadline enforcement, and reward payouts.
 *
 * Quests drive the player's narrative progress in Aralia. Players accept quests from NPCs,
 * advance multi-stage objectives as they explore and fight, receive gold/XP/item rewards upon
 * completion, and face failure consequences if in-game deadlines pass before completion.
 *
 * Called by: Vitest test runner (part of the gameplay test suite)
 * Depends on: questReducer, QuestManager, questJournal, adventureLog, and core utilities
 */

import { describe, it, expect } from 'vitest';
import { questReducer } from '../../../state/reducers/questReducer';
import { checkQuestDeadlines } from '../../../systems/quests/QuestManager';
import { GameState, Quest, QuestStatus, QuestObjectiveProgress } from '../../../types';
import { AppAction } from '../../../state/actionTypes';
import {
  createMockGameState,
  createMockLegacyQuest,
  createMockPlayerCharacter,
  getGameDay
} from '../../../utils/core';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================
// This section provides helpers to construct mock quests with multi-stage
// objectives, deadlines, and configured rewards (gold, items, experience).
// ============================================================================

/**
 * Creates a mock quest with custom objectives, rewards, and optional deadline.
 *
 * COV-1: this used to hand-build the legacy `Quest` literal here. It now goes
 * through the shared `createMockLegacyQuest` factory (src/utils/core/factories.ts),
 * which builds a `QuestDefinition` and runs it through the runtime quest adapter,
 * so a change to the Quest shape lands in one factory instead of every suite.
 *
 * What is preserved: every value this suite asserts on - the quest id, title,
 * giver, the three ordered objectives, the gold/xp/item rewards, and the fixed
 * `dateStarted` the deadline tests measure against. The scenario is unchanged;
 * only its construction moved.
 *
 * Two things changed as part of the move, both pre-existing type errors:
 * - the objective list is typed `QuestObjectiveProgress` (the runtime shape a
 *   `Quest` actually carries) rather than the authoring-time `QuestObjective`,
 *   which requires a mechanical `type` these fixtures never set;
 * - the `location: 'Forgotten Crypt'` field is dropped because `Quest` has no
 *   `location` (the flavor is kept in the title/description; `regionHint` is the
 *   real field if a future test needs to pin a place).
 */
function createMockQuest(overrides: Partial<Quest> = {}): Quest {
  const defaultObjectives: QuestObjectiveProgress[] = [
    { id: 'obj_find_clues', description: 'Search the old ruins for clues', isCompleted: false },
    { id: 'obj_defeat_bandit', description: 'Defeat the bandit ringleader', isCompleted: false },
    { id: 'obj_return_relic', description: 'Return the lost relic to the magistrate', isCompleted: false }
  ];

  return createMockLegacyQuest(
    {
      id: 'quest_ruins_relic',
      title: 'The Relic of the Forgotten Crypt',
      description: 'Recover the ancient artifact before scavengers sell it off.',
      status: QuestStatus.Active,
      type: 'Side',
      giverId: 'npc_magistrate_aldous',
      dateStarted: 1000000
    },
    {
      // The adapter derives description/objectives/rewards from the active stage,
      // so these legacy-shape overrides pin the values the assertions below read.
      description: 'Recover the ancient artifact before scavengers sell it off.',
      objectives: defaultObjectives,
      rewards: {
        gold: 250,
        xp: 400,
        items: ['potion-of-healing', 'torch']
      },
      ...overrides
    }
  );
}

// ============================================================================
// Quest Acceptance & Step-by-Step Objective Progression
// ============================================================================
// Tests accepting quests into the log, step-by-step completion of objectives,
// and state notifications.
// ============================================================================

describe('Gameplay Flow - Quest Acceptance & Objective Tracking', () => {
  it('accepts a new quest, pushes notification, and records journal event', () => {
    const state: GameState = {
      ...createMockGameState(),
      questLog: [],
      // `journalEntries` was set here but is not a GameState field (the journal
      // lives under `journal`), so it type-errored and did nothing. The reducer's
      // journal bridge is asserted in state/reducers/__tests__/questReducer.test.ts.
      notifications: []
    };

    const newQuest = createMockQuest();
    const action: AppAction = {
      type: 'ACCEPT_QUEST',
      payload: newQuest
    };

    const nextState = questReducer(state, action);

    // Quest log must contain the new quest
    expect(nextState.questLog).toHaveLength(1);
    expect(nextState.questLog?.[0].id).toBe('quest_ruins_relic');
    expect(nextState.questLog?.[0].status).toBe(QuestStatus.Active);

    // Acceptance notification pushed
    expect(nextState.notifications?.length).toBeGreaterThan(0);
    expect(nextState.notifications?.[0].message).toContain('Quest Accepted: The Relic of the Forgotten Crypt');
  });

  it('rejects duplicate quest acceptance for already tracked quests', () => {
    const existingQuest = createMockQuest();
    const state: GameState = {
      ...createMockGameState(),
      questLog: [existingQuest]
    };

    const duplicateAction: AppAction = {
      type: 'ACCEPT_QUEST',
      payload: existingQuest
    };

    const nextState = questReducer(state, duplicateAction);

    // Should return empty partial state (no state modifications)
    expect(nextState.questLog).toBeUndefined();
  });

  it('updates individual objective progress without prematurely completing the quest', () => {
    const quest = createMockQuest();
    const state: GameState = {
      ...createMockGameState(),
      questLog: [quest],
      notifications: []
    };

    // Complete the first of three objectives
    const action: AppAction = {
      type: 'UPDATE_QUEST_OBJECTIVE',
      payload: {
        questId: 'quest_ruins_relic',
        objectiveId: 'obj_find_clues',
        isCompleted: true
      }
    };

    const nextState = questReducer(state, action);
    const updatedQuest = nextState.questLog?.[0];

    expect(updatedQuest).toBeDefined();
    // First objective is marked complete
    expect(updatedQuest?.objectives[0].isCompleted).toBe(true);
    // Other objectives remain incomplete
    expect(updatedQuest?.objectives[1].isCompleted).toBe(false);
    // Overall status remains Active
    expect(updatedQuest?.status).toBe(QuestStatus.Active);
    // Notification dispatched
    expect(nextState.notifications?.[0].message).toContain('Quest Updated');
  });
});

// ============================================================================
// Automatic Quest Completion and Reward Payouts
// ============================================================================
// When all objectives are completed, the quest automatically completes,
// awarding gold, items, and experience to party members.
// ============================================================================

describe('Gameplay Flow - Quest Completion & Reward Distribution', () => {
  it('automatically completes quest when last objective is fulfilled and awards gold, items, and XP', () => {
    // Quest with 2 of 3 objectives already completed
    const almostDoneQuest = createMockQuest({
      objectives: [
        { id: 'obj_find_clues', description: 'Find clues', isCompleted: true },
        { id: 'obj_defeat_bandit', description: 'Defeat bandit', isCompleted: true },
        { id: 'obj_return_relic', description: 'Return relic', isCompleted: false }
      ],
      rewards: {
        gold: 150,
        xp: 300,
        items: ['torch']
      }
    });

    const pc1 = createMockPlayerCharacter({ id: 'pc1', name: 'Warrior', xp: 100 });
    const pc2 = createMockPlayerCharacter({ id: 'pc2', name: 'Mage', xp: 200 });

    const state: GameState = {
      ...createMockGameState(),
      questLog: [almostDoneQuest],
      gold: 50,
      inventory: [],
      party: [pc1, pc2],
      adventureLog: [],
      notifications: []
    };

    // Mark the final objective complete
    const finishAction: AppAction = {
      type: 'UPDATE_QUEST_OBJECTIVE',
      payload: {
        questId: 'quest_ruins_relic',
        objectiveId: 'obj_return_relic',
        isCompleted: true
      }
    };

    const nextState = questReducer(state, finishAction);
    const completedQuest = nextState.questLog?.[0];

    // Status updated to Completed
    expect(completedQuest?.status).toBe(QuestStatus.Completed);
    expect(completedQuest?.objectives.every(o => o.isCompleted)).toBe(true);

    // Gold reward added (50 + 150 = 200)
    expect(nextState.gold).toBe(200);

    // XP distributed to all party members (pc1: 100 + 300 = 400, pc2: 200 + 300 = 500)
    expect(nextState.party?.[0].xp).toBe(400);
    expect(nextState.party?.[1].xp).toBe(500);

    // Torch item added to inventory
    expect(nextState.inventory?.length).toBeGreaterThan(0);
    expect(nextState.inventory?.some(i => i.name === 'Torch')).toBe(true);

    // Adventure log recorded
    expect(nextState.adventureLog?.some(entry => entry.kind === 'quest')).toBe(true);

    // Completion notification dispatched
    expect(nextState.notifications?.some(n => n.message.includes('Quest Completed'))).toBe(true);
  });

  it('manually completes a quest via COMPLETE_QUEST action and awards all rewards', () => {
    const quest = createMockQuest();
    const pc = createMockPlayerCharacter({ id: 'pc1', xp: 50 });

    const state: GameState = {
      ...createMockGameState(),
      questLog: [quest],
      gold: 100,
      party: [pc],
      inventory: []
    };

    const completeAction: AppAction = {
      type: 'COMPLETE_QUEST',
      payload: { questId: quest.id }
    };

    const nextState = questReducer(state, completeAction);

    expect(nextState.questLog?.[0].status).toBe(QuestStatus.Completed);
    expect(nextState.gold).toBe(350); // 100 + 250
    expect(nextState.party?.[0].xp).toBe(450); // 50 + 400
  });
});

// ============================================================================
// Quest Deadline Checks and Failure Invariants
// ============================================================================
// Verifies deadline evaluations based on in-game day calculations, failure
// state transitions, and the rule that failed quests cannot be revived.
// ============================================================================

describe('Gameplay Flow - Quest Deadlines & Failure Handling', () => {
  it('evaluates active quest deadlines against world game day and marks missed quests failed', () => {
    const currentClock = new Date('2026-08-26T12:00:00Z');
    const currentDay = getGameDay(currentClock);

    // Quest whose deadline was yesterday (currentDay - 1)
    const expiredQuest = createMockQuest({
      id: 'quest_timed',
      title: 'Urgent Delivery',
      deadline: currentDay - 1,
      deadlineConsequence: {
        action: 'fail_quest',
        message: 'The caravan departed without your parcel.'
      }
    });

    // Quest whose deadline is in the future (currentDay + 5)
    const safeQuest = createMockQuest({
      id: 'quest_safe',
      title: 'Long-term Bounty',
      deadline: currentDay + 5
    });

    const state: GameState = {
      ...createMockGameState(),
      gameTime: currentClock,
      questLog: [expiredQuest, safeQuest]
    };

    const result = checkQuestDeadlines(state);

    const updatedExpired = result.state.questLog.find(q => q.id === 'quest_timed');
    const updatedSafe = result.state.questLog.find(q => q.id === 'quest_safe');

    // Expired quest must be marked Failed
    expect(updatedExpired?.status).toBe(QuestStatus.Failed);
    // Safe quest must remain Active
    expect(updatedSafe?.status).toBe(QuestStatus.Active);

    // System log generated for the failed quest
    expect(result.logs.some(l => l.text.includes('The caravan departed'))).toBe(true);
  });

  it('preserves failure status when objective updates are dispatched on failed quests (non-resurrection)', () => {
    const failedQuest = createMockQuest({
      status: QuestStatus.Failed,
      objectives: [
        { id: 'obj_1', description: 'Objective 1', isCompleted: false },
        { id: 'obj_2', description: 'Objective 2', isCompleted: false }
      ]
    });

    const state: GameState = {
      ...createMockGameState(),
      questLog: [failedQuest]
    };

    // Attempt to mark an objective complete on a failed quest
    const updateAction: AppAction = {
      type: 'UPDATE_QUEST_OBJECTIVE',
      payload: {
        questId: failedQuest.id,
        objectiveId: 'obj_1',
        isCompleted: true
      }
    };

    const nextState = questReducer(state, updateAction);

    // Reducer should ignore objective updates on failed quests
    expect(nextState.questLog).toBeUndefined();
  });
});
