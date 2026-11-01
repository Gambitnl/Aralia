/** A deliberate party meal uses the existing coupled ration/water currency.
 * It clears the same deprivation as a provisioned leg, resets that leg's meal
 * clock, and grants no HP, spell slots, exhaustion recovery or rest completion. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 13:17:07
 * Dependents: components/CharacterSheet/Overview/PartyMealConfirmation.tsx, hooks/actions/handleItemInteraction.ts, state/reducers/characterReducer.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types/state';
import type { UseItemPayload } from '../../types/actions';
import { getFoodExpirationState } from '../../utils/items/foodFreshness';
import { RATIONS_ITEM_ID, WATER_ITEM_ID } from './provisioning';

export type PartyMealSelection = NonNullable<UseItemPayload['meal']>;
export type PartyMealResult = { error: string } | { patch: Partial<GameState> };

export function preparePartyMeal(state: Pick<GameState, 'party' | 'inventory' | 'characterSheetModal'>,
  selection: PartyMealSelection, now = Date.now()): PartyMealResult {
  const ids = state.party.map(member => member.id);
  if (!ids.length || ids.some(id => !id) || selection.partyIds.length !== ids.length
    || new Set(selection.partyIds).size !== ids.length || !ids.every(id => selection.partyIds.includes(id!))) {
    return { error: 'The party changed. Review the meal and its cost again.' };
  }
  if (state.party.some(member => member.hp <= 0)) return { error: 'Everyone must be conscious to take this party meal.' };
  const portions = (item: GameState['inventory'][number]) => Number.isInteger(item.quantity ?? 1) && (item.quantity ?? 1) > 0 ? item.quantity ?? 1 : 0;
  const usable = (item: GameState['inventory'][number]) => !getFoodExpirationState(item, now).isExpired;
  const choices = [
    { id: RATIONS_ITEM_ID, index: selection.rationIndex, item: selection.rationItem },
    { id: WATER_ITEM_ID, index: selection.waterIndex, item: selection.waterItem },
  ];
  for (const choice of choices) {
    const held = state.inventory[choice.index];
    if (!Number.isInteger(choice.index) || choice.index < 0 || !held || held !== choice.item
      || held.id !== choice.id || !portions(held) || !usable(held)) {
      return { error: 'A selected supply changed or expired. Review the meal again.' };
    }
    const total = state.inventory.filter(item => item.id === choice.id && usable(item)).reduce((sum, item) => sum + portions(item), 0);
    if (total < ids.length) return { error: `The meal needs ${ids.length} ration(s) and ${ids.length} water unit(s). No supplies were used.` };
  }
  const spend = new Map<number, number>();
  for (const choice of choices) {
    let remaining = ids.length;
    // The selected source pays first; other matching stacks fill only the
    // remaining party cost. Preserve every retained entry's own provenance.
    const order = [choice.index, ...state.inventory.map((_, index) => index).filter(index => index !== choice.index)];
    for (const index of order) {
      const item = state.inventory[index];
      if (!remaining || item.id !== choice.id || !usable(item)) continue;
      const used = Math.min(remaining, portions(item));
      if (used) spend.set(index, used);
      remaining -= used;
    }
  }
  const inventory = state.inventory.flatMap((item, index) => {
    const used = spend.get(index);
    if (!used) return [item];
    const quantity = portions(item) - used;
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
  const party = state.party.map(member => ({ ...member,
    conditions: (member.conditions ?? []).filter(condition => condition !== 'starving' && condition !== 'fatigued'),
  }));
  const sheet = state.characterSheetModal;
  return { patch: { inventory, party, travelMinutesRemainder: 0,
    ...(sheet?.isOpen ? { characterSheetModal: { ...sheet, character: party.find(member => member.id === sheet.character?.id) ?? sheet.character } } : {}),
  } };
}
