/** Ask a present companion about an authored public destination. The answer
 * and retained record use the same world source as its actual entrance. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 21:12:40
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
import { publicCompanionDestinations } from '@/systems/companions/companionGoalDestinations';

export function CompanionGoalDestinationChoices({state, dispatch, disabled}: {
  state: GameState; dispatch: React.Dispatch<AppAction>; disabled: boolean;
}) {
  return <>{state.activeConversation?.participants.flatMap(id => publicCompanionDestinations(state, id).map(({goal, site, source}) =>
    <section key={`${id}:${goal.id}`} aria-label="Ask about personal plans" className="rounded-lg border border-amber-500/30 bg-slate-900 p-3 text-xs text-gray-200">
      <p className="font-semibold text-amber-200">Your own plans</p>
      <button type="button" disabled={disabled} className="mt-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-left text-xs text-gray-100 hover:bg-gray-700 disabled:opacity-50"
        onClick={() => dispatch({type:'DISCUSS_COMPANION_DESTINATION', payload:{companionId:id, goalId:goal.id, worldSeed:source.worldSeed, sitePath:site.sitePath}})}>
        {goal.disclosedDestination?.worldSeed === source.worldSeed ? 'Recall' : 'Ask about'} {source.name}
      </button>
    </section>))}</>;
}
