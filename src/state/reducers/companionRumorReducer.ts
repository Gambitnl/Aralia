/**
 * A deliberate shared reading adds one attributed memory and spoken opinion.
 * It leaves inventory, trust, quests and recruitment with their existing owners.
 * Authored rows are already recorded here, so ending the conversation must not
 * manufacture a second AI summary or approval award for reading the same note.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 15:47:05
 * Dependents: state/reducers/companionReducer.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { CompanionRumorSelection, CompanionMemory } from '@/types/companions';
import { generateId } from '@/utils/core/idGenerator';
import { rumorConversationCompanion, rumorOpinion, shareableRumorNotes } from '@/systems/companions/companionRumors';

export function discussCompanionRumor(state: GameState, selection: CompanionRumorSelection): Partial<GameState> {
  const companion = rumorConversationCompanion(state, selection.companionId);
  const conversation = state.activeConversation;
  if (!companion || !conversation || conversation.pendingResponse || !conversation.isPlayerTurn || !Number.isFinite(state.worldSeed)) return {};
  // Resolve the actual retained receipt again. A stale card cannot quote an
  // item that has been replaced, sold or changed since it was displayed.
  const note = shareableRumorNotes(state).find(note => note.inventoryIndex === selection.inventoryIndex
    && note.item.id === selection.itemId && note.item.sourceId === selection.sourceId && note.item.description === selection.description);
  if (!note) return {};
  const now = state.gameTime.getTime();
  const traveler = state.party[0];
  const prior = companion.memories?.find(memory => memory.hearsay && memory.hearsay.sourceId === note.item.sourceId
    && memory.hearsay.account === note.item.description && memory.hearsay.sharedInWorldSeed === state.worldSeed);
  const opinion = rumorOpinion(companion, note.item.description);
  const memory: CompanionMemory | undefined = prior ? undefined : {
    id: generateId(), type: 'event', timestamp: now, importance: 7,
    tags: ['shared-account', 'hearsay', note.item.sourceId!],
    text: `${traveler?.name ?? 'The traveler'} showed me a purchased account: ${note.item.description} I said: ${opinion.reply}`,
    hearsay: {
      sourceId: note.item.sourceId!, itemId: note.item.id, subject: note.subject, account: note.item.description,
      sharedById: traveler?.id ?? 'player', sharedByName: traveler?.name ?? 'The traveler', sharedInWorldSeed: state.worldSeed!,
    },
  };
  const factId = `${companion.id}:preference:discussed-journey-terms`;
  return {
    companions: { ...state.companions, [companion.id]: {
      ...companion,
      memories: memory ? [...(companion.memories ?? []), memory] : companion.memories,
      discoveredFacts: companion.discoveredFacts?.some(fact => fact.id === factId) ? companion.discoveredFacts : [...(companion.discoveredFacts ?? []),
        { id: factId, category: 'preference', fact: opinion.preference, discoveredAt: now, source: 'conversation' }],
    } },
    activeConversation: { ...conversation, messages: [...conversation.messages,
      { id: generateId(), speakerId: 'player', text: prior ? `Could we consider "${note.subject}" again?` : `Would you read this account with me? ${note.item.description}`, timestamp: now, memoryHandled: true },
      { id: generateId(), speakerId: companion.id, text: opinion.reply, timestamp: now, memoryHandled: true },
    ] },
  };
}
