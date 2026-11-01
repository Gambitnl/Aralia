// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 13:17:07
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import type { Action, Item, PlayerCharacter } from '../../../types';
import { preparePartyMeal } from '../../../systems/travel/partyMeal';

/** Local confirmation keeps the character sheet's source selection visible.
 * Nothing is consumed by opening, changing supplies or canceling this quote. */
export function PartyMealConfirmation({ inventory, party, selectedIndex, onAction, onCancel }:
  { inventory: Item[]; party: PlayerCharacter[]; selectedIndex: number; onAction: (action: Action) => void; onCancel: () => void }) {
  const [rationItem, setRationItem] = useState(inventory[selectedIndex]?.id === 'rations' ? inventory[selectedIndex] : inventory.find(item => item.id === 'rations'));
  const [waterItem, setWaterItem] = useState(inventory[selectedIndex]?.id === 'water-day' ? inventory[selectedIndex] : inventory.find(item => item.id === 'water-day'));
  // Hold the chosen objects, not just row numbers: a changed inventory must not
  // quietly substitute another same-ID stack underneath an open confirmation.
  const rationIndex = rationItem ? inventory.indexOf(rationItem) : -1;
  const waterIndex = waterItem ? inventory.indexOf(waterItem) : -1;
  const meal = { rationIndex, rationItem: rationItem!, waterIndex, waterItem: waterItem!, partyIds: party.map(member => member.id!) };
  const result = preparePartyMeal({ inventory, party, characterSheetModal: {isOpen:false,character:null} }, meal);
  const supply = (id: string, label: string, value: number, change: (value: number) => void) => (
    <label className="block text-sm">{label}
      <select aria-label={label} value={value} onChange={event => change(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded bg-slate-800 p-2 text-white">
        <option value={-1}>Choose supplies</option>
        {inventory.map((item, index) => item.id === id && <option key={index} value={index}>{item.name} — {item.quantity ?? 1} carried{item.acquiredAt ? ` · Acquired ${new Date(item.acquiredAt).toLocaleDateString()}` : ''}</option>)}
      </select>
    </label>
  );
  return <section aria-label="Party meal confirmation" className="mb-3 space-y-3 rounded border border-amber-600 bg-slate-900 p-3 text-slate-100">
    <h4 className="font-bold text-amber-200">Take a party meal</h4>
    <p className="text-sm">Uses {party.length} ration(s) and {party.length} water unit(s), one day-sized portion of each per person. Chosen supplies are used first.</p>
    <p className="text-sm">A proper meal clears starving and fatigued and starts the travel provision clock again. It grants no healing, spell slots, exhaustion recovery or rest benefits.</p>
    {supply('rations', 'Ration supply to use first', rationIndex, index => setRationItem(inventory[index]))}
    {supply('water-day', 'Water supply to use first', waterIndex, index => setWaterItem(inventory[index]))}
    {'error' in result && <p role="status" className="text-sm text-amber-200">{result.error}</p>}
    <div className="flex flex-wrap gap-2">
      <button className="min-h-11 rounded bg-slate-700 px-3" onClick={onCancel}>Cancel meal</button>
      <button disabled={'error' in result} className="min-h-11 rounded bg-green-700 px-3 disabled:opacity-50" onClick={() => {
        onAction({ type: 'USE_ITEM', label: 'Take a party meal', payload: { itemId: inventory[selectedIndex]?.id ?? 'rations', characterId: party[0]?.id ?? '', meal } });
        onCancel();
      }}>Confirm party meal</button>
    </div>
  </section>;
}
