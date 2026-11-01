/** Authored personal-story choices share the floating conversation's scroll area.
 * These fixed promises and transfers have defined game effects; free-form words
 * continue through the existing intent reader and never take this shortcut. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 12:51:04
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 4 files
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
import { preparationChoices, preparationCompanion } from '@/systems/companions/companionPreparations';
import { daysOfFood, daysOfWater } from '@/systems/travel/provisioning';

export function CompanionPreparationChoices({ state, dispatch, disabled }: { state: GameState; dispatch: React.Dispatch<AppAction>; disabled: boolean }) {
  const companion = preparationCompanion(state);
  const choices = preparationChoices(state);
  if (!companion || !choices.length) return null;
  const stage = companion.questline?.currentStageId;
  return <section aria-label="Elara's preparations" className="rounded-lg border border-amber-500/30 bg-slate-900/70 p-3 text-xs text-gray-200">
    <p className="font-semibold text-amber-200">Elara’s preparations</p>
    {stage === 'collecting' && <p className="my-2">You promised 2 rations and 2 water-days. You carry {daysOfFood(state.inventory)} rations and {daysOfWater(state.inventory)} water-days.</p>}
    {stage === 'supplied' && <p className="my-2">Elara’s own supplies: {daysOfFood(companion.inventory ?? [])} rations, {daysOfWater(companion.inventory ?? [])} water-days. Her restoration goal remains unfinished.</p>}
    <div className="mt-2 flex flex-col gap-2">{choices.map(({ choice, label, disabled: unavailable }) => <button
      key={choice} type="button" disabled={disabled || unavailable}
      className="min-h-11 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-left text-xs text-gray-100 hover:bg-gray-700 disabled:opacity-50"
      onClick={() => dispatch({ type: 'COMPANION_PREPARATION_CHOICE', payload: { companionId: companion.id, choice } })}
    >{label}</button>)}</div>
  </section>;
}
