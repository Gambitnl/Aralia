/**
 * @file questAdapter.test.ts
 * Verifies the Phase 1 bridge from QuestDefinition authoring data to legacy
 * Quest runtime data.
 */
import { describe, expect, it } from 'vitest';
import { QuestStatus, type QuestDefinition } from '@/types';
import { adaptQuestDefinitionToQuest } from '../questAdapter';

const createStagedQuest = (): QuestDefinition => ({
  id: 'q_staged_delivery',
  title: 'A Letter in Three Hands',
  description: 'Find the courier trail.',
  giverId: 'npc_archivist',
  type: 'Side',
  status: QuestStatus.Active,
  currentStageId: 'stage_delivery',
  stages: {
    stage_intro: {
      id: 'stage_intro',
      journalEntry: 'Ask about the missing courier.',
      objectives: [
        {
          id: 'talk_archivist',
          description: 'Talk to the archivist.',
          type: 'Talk',
          isCompleted: true,
        },
      ],
      nextStageIds: ['stage_delivery'],
    },
    stage_delivery: {
      id: 'stage_delivery',
      journalEntry: 'Deliver the recovered letter before dusk.',
      objectives: [
        {
          id: 'deliver_letter',
          description: 'Deliver the recovered letter.',
          type: 'Deliver',
          targetId: 'npc_captain',
          isCompleted: false,
          requiredCount: 1,
          currentCount: 0,
        },
      ],
    },
  },
  rewards: {
    gold: 50,
    xp: 125,
    itemIds: ['sealed_writ'],
    reputation: [{ factionId: 'scribes', change: 2 }],
  },
  failureConditions: [
    {
      type: 'Deadline',
      triggerValue: 12,
      description: 'The captain leaves before receiving the letter.',
      consequence: 'Fail',
    },
  ],
  dateStarted: 10,
  regionId: 'capital_district',
});

describe('adaptQuestDefinitionToQuest', () => {
  it('flattens the active QuestDefinition stage into the legacy Quest runtime shape', () => {
    const adapted = adaptQuestDefinitionToQuest(createStagedQuest());

    expect(adapted).toMatchObject({
      id: 'q_staged_delivery',
      title: 'A Letter in Three Hands',
      description: 'Deliver the recovered letter before dusk.',
      giverId: 'npc_archivist',
      status: QuestStatus.Active,
      questType: 'Side',
      regionHint: 'capital_district',
      deadline: 12,
      deadlineConsequence: {
        action: 'fail_quest',
        message: 'The captain leaves before receiving the letter.',
      },
      rewards: {
        gold: 50,
        xp: 125,
        items: ['sealed_writ'],
        reputation: [{ factionId: 'scribes', change: 2 }],
      },
    });

    expect(adapted.objectives).toEqual([
      {
        id: 'deliver_letter',
        description: 'Deliver the recovered letter.',
        isCompleted: false,
        requiredCount: 1,
        currentCount: 0,
      },
    ]);
  });

  it('throws when the current QuestDefinition stage is missing', () => {
    const brokenQuest = {
      ...createStagedQuest(),
      currentStageId: 'missing_stage',
    };

    expect(() => adaptQuestDefinitionToQuest(brokenQuest)).toThrow(
      'QuestDefinition "q_staged_delivery" references missing stage "missing_stage".'
    );
  });
});
