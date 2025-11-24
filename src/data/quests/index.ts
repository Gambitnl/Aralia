/**
 * @file src/data/quests/index.ts
 * Defines initial quests for the Aralia RPG.
 */
import { Quest, QuestStatus } from '../../types';

export const INITIAL_QUESTS: Record<string, Quest> = {
  'lost_map': {
    id: 'lost_map',
    title: 'The Lost Map',
    description: 'A villager mentioned a lost map fragment near the forest clearing. It might lead to something interesting.',
    giverId: 'villager_generic', // Placeholder
    status: QuestStatus.Active,
    objectives: [
      { id: 'find_map', description: 'Find the Old Map Fragment.', isCompleted: false },
      { id: 'return_map', description: 'Return the map to the town scholar (Placeholder).', isCompleted: false }
    ],
    rewards: {
      gold: 10,
      xp: 50
    },
    dateStarted: Date.now()
  },
  'explore_ruins': {
    id: 'explore_ruins',
    title: 'Echoes of the Past',
    description: 'Rumors speak of ancient ruins to the east. Investigate them.',
    giverId: 'system',
    status: QuestStatus.Active,
    objectives: [
      { id: 'find_ruins', description: 'Locate the Ancient Ruins Entrance.', isCompleted: false },
      { id: 'enter_courtyard', description: 'Enter the Ruins Courtyard.', isCompleted: false }
    ],
    rewards: {
      xp: 100
    },
    dateStarted: Date.now()
  }
};
