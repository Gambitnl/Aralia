/** Show the owned bundle's costs and contents before an ordinary inventory
 * action. The existing handler/reducer still decide whether it can be opened. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 09:00:18
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, {useId} from 'react';
import {Button} from '../../ui/Button';
import {useOptionalGameState} from '../../../state/GameContext';
import {adventuringPackOffer,adventuringPackUseError} from '../../../systems/gameplay/adventuringPacks';
import {generateId} from '../../../utils/core/idGenerator';
import type {Action,Item,UseItemPayload} from '../../../types';

export function AdventuringPackReview({item,inventoryIndex,characterId,onAction}:{
  item:Item;inventoryIndex:number;characterId:string;onAction:(action:Action)=>void;
}):React.ReactElement|null {
  const context = useOptionalGameState();
  const errorId = useId();
  const offer = adventuringPackOffer(item);
  if (!offer) return null;
  const request:UseItemPayload = {itemId:item.id,characterId,inventoryIndex,unpack:{sourceItem:item,openingId:''}};
  const error = offer.error ?? (context ? adventuringPackUseError(context.state,request) : 'Your party must be in play to open this pack.');
  return <details className="w-full basis-full rounded-md border border-amber-900/60 bg-slate-950/50 px-3 py-2">
    <summary className="cursor-pointer py-1 text-sm font-semibold text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
      Review {item.name} contents
    </summary>
    {!offer.error && <>
      <p className="mt-2 text-sm text-slate-200">Opens one of {offer.quantity} bundles into these carried items:</p>
      <ul className="my-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
        {offer.contents.map(part=><li key={part.id}>{part.quantity} × {part.name} · {(part.weight!*(part.quantity ?? 1)).toFixed(2)} lb</li>)}
      </ul>
      <p className="text-sm text-slate-200">Total carrying weight stays {offer.unitWeight.toFixed(2)} lb. {offer.retainedContents ?? 'The backpack includes the remaining packing and straps.'}</p>
      <p className="mt-1 text-sm text-slate-300">No drinking water is added: the waterskin remains a vessel. Food keeps its acquisition age. No recovery or extra world time is granted.</p>
    </>}
    {error && <p id={errorId} className="mt-2 text-sm text-amber-200">{error}</p>}
    <Button className="mt-3 min-h-11" disabled={Boolean(error)} aria-describedby={error ? errorId : undefined}
      onClick={()=>{
        if (!context || adventuringPackUseError(context.state,request)) return;
        onAction({type:'USE_ITEM',label:'Unpack '+item.name,payload:{...request,unpack:{sourceItem:item,openingId:generateId()}}});
      }}>Unpack one {item.name}</Button>
  </details>;
}
