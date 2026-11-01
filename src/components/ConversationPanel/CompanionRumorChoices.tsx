/** Purchased information can be shared explicitly even when free-text generation
 * is unavailable. Each person receives it only when the player chooses to speak. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 15:47:05
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import type { GameState } from '@/types/state';
import type { AppAction } from '@/state/actionTypes';
import { rumorConversationCompanion, shareableRumorNotes } from '@/systems/companions/companionRumors';

export function CompanionRumorChoices({ state, dispatch, disabled }: { state: GameState; dispatch: React.Dispatch<AppAction>; disabled: boolean }) {
  const notes = shareableRumorNotes(state);
  if (!notes.length) return null;
  return <>{state.activeConversation?.participants.map(id => {
    const companion = rumorConversationCompanion(state, id);
    if (!companion) return null;
    return <section key={id} aria-label={`Share an account with ${companion.identity.name}`} className="rounded-lg border border-sky-500/30 bg-slate-900 p-3 text-xs text-gray-200">
      <p className="font-semibold text-sky-200">An account to discuss</p>
      <div className="mt-2 flex flex-col gap-2">{notes.map(({ item, inventoryIndex, subject }) => {
        const discussed = companion.memories?.some(memory => memory.hearsay && memory.hearsay.sourceId === item.sourceId && memory.hearsay.account === item.description && memory.hearsay.sharedInWorldSeed === state.worldSeed);
        return <button key={`${inventoryIndex}:${item.id}`} type="button" disabled={disabled}
          className="min-h-11 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-left text-xs text-gray-100 hover:bg-gray-700 disabled:opacity-50"
          onClick={() => dispatch({ type: 'DISCUSS_COMPANION_RUMOR', payload: { companionId: id, inventoryIndex, itemId: item.id, sourceId: item.sourceId!, description: item.description } })}
        >{discussed ? 'Revisit' : 'Discuss'} {subject}</button>;
      })}</div>
    </section>;
  })}</>;
}
