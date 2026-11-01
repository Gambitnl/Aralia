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
import { createMockGameState, createMockLegacyQuest, createMockPlayerCharacter } from '../../../utils/core';

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

  describe('quest rewards and level progression (GG-460, GG-464)', () => {
    it('applies level progression when quest XP reaches milestone (GG-464)', () => {
      // Level 1 character with 250 XP
      const pc = createMockPlayerCharacter({
        id: 'hero',
        name: 'Hero',
        level: 1,
        xp: 250,
      });

      const questWithXp: Quest = {
        id: 'herbalist_helper',
        title: "Herbalist's Helper",
        description: 'Gather wild herbs for the town healer.',
        status: QuestStatus.Active,
        objectives: [{ id: 'obj-1', description: 'Deliver herbs', isCompleted: true }],
        rewards: {
          xp: 85, // 250 + 85 = 335 XP >= 300 (milestone for Level 2)
        },
      };

      const state = createMockGameState({
        party: [pc],
        questLog: [questWithXp],
      });

      const next = questReducer(state, {
        type: 'COMPLETE_QUEST',
        payload: { questId: 'herbalist_helper' },
      });

      expect(next.party).toBeDefined();
      expect(next.party![0].xp).toBe(335);
      expect(next.party![0].level).toBe(2);
    });

    it('instantiates quest reward items with unique ids and acquiredAt stamps (GG-460)', () => {
      const pc = createMockPlayerCharacter({ id: 'hero', name: 'Hero' });
      const questWithItems: Quest = {
        id: 'alchemist_bounty',
        title: "Alchemist's Bounty",
        description: 'Deliver rare reagents.',
        status: QuestStatus.Active,
        objectives: [{ id: 'obj-1', description: 'Complete delivery', isCompleted: true }],
        rewards: {
          items: ['healing_potion', 'healing_potion'],
        },
      };

      const state = createMockGameState({
        party: [pc],
        inventory: [],
        questLog: [questWithItems],
      });

      const next = questReducer(state, {
        type: 'COMPLETE_QUEST',
        payload: { questId: 'alchemist_bounty' },
      });

      expect(next.inventory).toHaveLength(2);
      const [item1, item2] = next.inventory!;
      expect(item1.id).not.toBe(item2.id); // Must have unique instance IDs, not shared singleton id!
      expect(item1.acquiredAt).toBeDefined();
      expect(item2.acquiredAt).toBeDefined();
    });

    it('applies reputation rewards via FactionManager with ripple effects (GG-465)', () => {
      const pc = createMockPlayerCharacter({ id: 'hero', name: 'Hero' });
      const questWithRep: Quest = {
        id: 'faction_favor',
        title: 'Favor for the Iron Ledger',
        description: 'Recover the ledgers.',
        status: QuestStatus.Active,
        objectives: [{ id: 'obj-1', description: 'Recover books', isCompleted: true }],
        rewards: {
          reputation: [{ factionId: 'iron_ledger', change: 10 }],
        },
      };

      const state = createMockGameState({
        party: [pc],
        questLog: [questWithRep],
        playerFactionStandings: {
          iron_ledger: {
            factionId: 'iron_ledger',
            publicStanding: 5,
            secretStanding: 5,
            rankId: 'outsider',
            favorsOwed: 0,
            renown: 0,
            history: [],
          },
        },
      });

      const next = questReducer(state, {
        type: 'COMPLETE_QUEST',
        payload: { questId: 'faction_favor' },
      });

      expect(next.playerFactionStandings).toBeDefined();
      expect(next.playerFactionStandings!['iron_ledger'].publicStanding).toBe(15);
      expect(next.messages).toBeDefined();
      expect(next.messages!.length).toBeGreaterThan(0);
    });
  });
});
