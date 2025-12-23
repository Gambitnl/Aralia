/**
 * @file src/data/dialogue/topics.ts
 * Initial dataset for conversation topics.
 */

import { ConversationTopic } from '../../types/dialogue';

export const INITIAL_TOPICS: ConversationTopic[] = [
  {
    id: 'global_who_are_you',
    label: 'Who are you?',
    category: 'personal',
    playerPrompt: 'Can you tell me a bit about yourself?',
    isGlobal: true,
    isOneTime: true,
    unlocksTopics: [],
  },
  {
    id: 'global_rumors',
    label: 'Heard any rumors?',
    category: 'rumor',
    playerPrompt: 'What is the news around here?',
    isGlobal: true,
    prerequisites: [
      {
        type: 'relationship',
        value: 0, // Neutral or better
      },
    ],
  },
  {
    id: 'global_trade',
    label: 'Show me your wares.',
    category: 'trade',
    playerPrompt: 'I would like to trade.',
    isGlobal: true, // Only technically global, but specific NPCs might not be merchants.
                    // However, `canNPCDiscuss` handles "willingness", and merchant logic is handled by role elsewhere.
                    // For pure dialogue, asking to trade is valid.
  },
  {
    id: 'global_directions',
    label: 'I need directions.',
    category: 'lore',
    playerPrompt: 'Can you point me to the nearest settlement?',
    isGlobal: true,
  },
];
