/**
 * @file src/data/quests/index.ts
 * Defines quest templates and helpers to produce runtime quest instances.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 12:51:04
 * Dependents: components/Town/Intrigue/RumorMill.tsx, hooks/actions/handleItemInteraction.ts, hooks/actions/handleNpcInteraction.ts, state/reducers/companionPreparationReducer.ts, systems/companions/companionPreparations.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Quest, QuestStatus, QuestTemplate } from '../../types';

/**
 * Quest templates are immutable blueprints. The reducer clones these into
 * fresh runtime instances to avoid cross-quest mutation.
 */
export const ELARA_PREPARATIONS_QUEST_ID = 'elara_road_preparations';

export const QUEST_TEMPLATES: Record<string, QuestTemplate> = {
  // This authored chapter prepares Elara's own journey. It establishes no new
  // temple location and pays no currency or recruitment reward for a handover.
  [ELARA_PREPARATIONS_QUEST_ID]: {
    id: ELARA_PREPARATIONS_QUEST_ID,
    title: "Elara: Road Preparations",
    description: "You promised Elara two rations and two days of water for her restoration journey. Hand them to her when you meet again.",
    giverId: 'elara_vance',
    objectives: [{ id: 'handover_supplies', description: 'Give Elara 2 rations and 2 water-days.' }],
    questType: 'Companion',
  },
  lost_map: {
    id: 'lost_map',
    title: 'The Lost Map',
    description: 'A villager mentioned a lost map fragment near the forest clearing. It might lead to something interesting.',
    giverId: 'villager_generic',
    objectives: [
      { id: 'find_map', description: 'Find the Old Map Fragment.' },
      { id: 'return_map', description: 'Return the map to the town scholar.' }
    ],
    rewards: {
      gold: 10,
      xp: 50
    },
    questType: 'Side',
    regionHint: 'Aralia Forest'
  },
  explore_ruins: {
    id: 'explore_ruins',
    title: 'Echoes of the Past',
    description: 'Rumors speak of ancient ruins to the east. Investigate them.',
    giverId: 'system',
    objectives: [
      { id: 'find_ruins', description: 'Locate the Ancient Ruins Entrance.' },
      { id: 'enter_courtyard', description: 'Enter the Ruins Courtyard.' }
    ],
    rewards: {
      xp: 100
    },
    questType: 'Main',
    regionHint: 'Eastern Wilds'
  },
  herbalist_supplies: {
    id: 'herbalist_supplies',
    title: "Herbalist's Helper",
    description: 'Tilda the herbalist needs help restocking rare reagents scattered around the outskirts of Aralia.',
    giverId: 'tilda_herbalist',
    objectives: [
      { id: 'collect_bloom', description: 'Collect three Moonpetal Blooms.' },
      { id: 'deliver_bloom', description: 'Deliver the reagents back to Tilda.' }
    ],
    rewards: {
      gold: 25,
      items: ['healing_potion'],
      xp: 85
    },
    questType: 'Side',
    regionHint: 'Town Outskirts'
  }
};

/**
 * Creates a quest instance from a template, stamping runtime fields that
 * should not live in the immutable template (dates, status, completion flags).
 */
export function instantiateQuest(template: QuestTemplate): Quest {
  return {
    ...template,
    status: QuestStatus.Active,
    objectives: template.objectives.map(obj => ({ ...obj, isCompleted: false })),
    dateStarted: Date.now(),
    dateCompleted: undefined
  };
}

/**
 * Convenience helper used by action handlers to grab a fresh quest instance
 * without having to know about the template mechanics.
 */
export function getQuestById(questId: string): Quest | null {
  const template = QUEST_TEMPLATES[questId];
  if (!template) return null;
  return instantiateQuest(template);
}

/**
 * A ready-to-use map of starter quests. Each entry is a fresh instance so
 * reducers can safely store and mutate the runtime copy.
 */
export const INITIAL_QUESTS: Record<string, Quest> = Object.fromEntries(
  Object.values(QUEST_TEMPLATES).map(template => [template.id, instantiateQuest(template)])
);
