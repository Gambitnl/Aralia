/**
 * @file src/data/dialogue/topics.ts
 * Initial dataset for conversation topics.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:20:13
 * Dependents: services/dialogueService.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
    // Shared topic, offered only to merchant roles or owners of real storefront
    // stock. Dialogue availability and selection both check that source.
    isGlobal: true,
  },
  {
    id: 'global_directions',
    label: 'I need directions.',
    category: 'lore',
    playerPrompt: 'Can you point me to the nearest settlement?',
    isGlobal: true,
  },
];
