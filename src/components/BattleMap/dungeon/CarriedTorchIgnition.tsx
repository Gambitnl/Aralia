/** Presentation only: choose a real carried source before the existing ignition action.
 * Fuel, quantities and refusal reasons come from gameplay; this view grants no light. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 03:11:33
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, {useId} from 'react';
import {Button} from '../../ui/Button';

export interface CarriedTorchChoice {
  inventoryIndex: number;
  fuelMinutes: number;
  quantity: number;
  error?: string | null;
}

export function CarriedTorchIgnition({choices,disabled=false,onIgnite}: {
  choices: readonly CarriedTorchChoice[];
  disabled?: boolean;
  onIgnite: (inventoryIndex:number)=>void;
}) {
  const id=useId();
  if(!choices.length)return null;
  return <div role="group" aria-label="Choose a carried torch" className="mt-2 space-y-2">
    <p className="text-amber-200">Choose fuel before lighting. Uses one carried torch; keeps its remaining fuel. 20 ft bright + 20 ft dim.</p>
    {choices.map((choice,ordinal)=>{
      const usable=Number.isFinite(choice.fuelMinutes)&&choice.fuelMinutes>0;
      const error=choice.error??(!usable?'That torch has no usable fuel.':null);
      const errorId=id+'-'+choice.inventoryIndex;
      return <div key={choice.inventoryIndex} className="rounded border border-amber-200/20 p-2">
        <p className="mb-1 text-stone-200">Torch {ordinal+1} · {choice.quantity} carried · {usable?'about '+Math.ceil(choice.fuelMinutes)+' min fuel':'no usable fuel'}</p>
        <Button type="button" size="sm" className="min-h-11 w-full"
          disabled={disabled||Boolean(error)} aria-describedby={error?errorId:undefined}
          onClick={()=>onIgnite(choice.inventoryIndex)}>
          Light torch {ordinal+1} ({usable?Math.ceil(choice.fuelMinutes)+' min fuel':'unusable fuel'})
        </Button>
        {error&&<p id={errorId} role="status" className="mt-1 text-amber-200">{error}</p>}
      </div>;
    })}
  </div>;
}
