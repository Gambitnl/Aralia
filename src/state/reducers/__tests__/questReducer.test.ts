/**
 * This file checks the quest reducer's handoff into the journal queue.
 *
 * The Quest Log and Journal systems already share state in the app store, but
 * the reducer path still needs proof that quest transitions leave a journal
 * trail. These tests pin the acceptance and completion flow so later changes
 * do not quietly drop the journal bridge.
 */

import { describe, expect, it } from 'vitest';
import { questReducer } from '../questReducer';
import { Quest, QuestStatus } from '../../../types';
import { createInitialJournalState } from '../../../types/journal';
import { createMockGameState, createMockLegacyQuest } from '../../../utils/core';

describe('questReducer', () => {
  // COV-1: built by the shared quest factory instead of a hand-written literal,
  // so the reducer-facing Quest shape is defined in one place
  // (src/utils/core/factories.ts). The id, title, description, giver, status,
  // and the single objective are the same values the assertions below read.
  const quest: Quest = createMockLegacyQuest(
    {
      id: 'quest-1',
      title: 'Courier Run',
      description: 'Deliver the sealed letter before the market closes.',
      giverId: 'npc-1',
      status: QuestStatus.Active,
    },
    {
      // The adapter takes the description from the active stage's journal entry,
      // so the legacy-shape overrides restate the description and objectives.
      description: 'Deliver the sealed letter before the market closes.',
      objectives: [
        {
          id: 'objective-1',
          description: 'Carry the letter to the harbor',
          isCompleted: false,
        },
      ],
    }
  );

  it('queues journal events when a quest is accepted and completed', () => {
    // Start with an explicit journal so the test can inspect the pending queue
    // without relying on any save-load defaults.
    const state = createMockGameState({
      journal: createInitialJournalState(),
    });

    const acceptedState = questReducer(state, {
      type: 'ACCEPT_QUEST',
      payload: quest,
    });

    expect(acceptedState.questLog).toHaveLength(1);
    expect(acceptedState.journal?.pendingEvents).toHaveLength(1);
    expect(acceptedState.journal?.pendingEvents[0]).toMatchObject({
      type: 'quest_accepted',
      questId: 'quest-1',
      title: 'Quest Accepted: Courier Run',
    });

    const completedState = questReducer(
      {
        ...state,
        questLog: acceptedState.questLog ?? [],
        journal: acceptedState.journal,
      },
      {
        type: 'COMPLETE_QUEST',
        payload: { questId: 'quest-1' },
      }
    );

    expect(completedState.questLog?.[0]?.status).toBe(QuestStatus.Completed);
    expect(completedState.journal?.pendingEvents).toHaveLength(2);
    expect(completedState.journal?.pendingEvents[1]).toMatchObject({
      type: 'quest_completed',
      questId: 'quest-1',
      title: 'Quest Completed: Courier Run',
    });
  });
});
