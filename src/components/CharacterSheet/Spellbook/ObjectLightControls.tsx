/** The spell illuminates a real owned object. This picker exposes the caster's
 * own held equipment, with no implicit targeting of another person's property.
 * Unpositioned room decorations and packed inventory are not touch targets. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/11/2026, 22:17:11
 * Dependents: components/CharacterSheet/Spellbook/CastSpellControls.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React,{useState} from 'react';
import {useOptionalGameState} from '../../../state/GameContext';
import type {Action,CastSpellPayload,Item,PlayerCharacter} from '../../../types';
import {activeObjectLights,LIGHT_OBJECT_SLOTS,prepareObjectLightCast,type LightObjectSlot} from '../../../systems/gameplay/objectLightCasting';
import {generateId} from '../../../utils/core/idGenerator';
// GG-378: shared button style, the same as the water cast in CastSpellControls.
import { Button } from '../../ui/Button';

export default function ObjectLightControls({character,isReadyToCast,notReadyReason,onAction}:{
  character:PlayerCharacter;isReadyToCast:boolean;notReadyReason?:string;onAction:(action:Action)=>void;
}) {
  const context=useOptionalGameState();
  const [selection,setSelection]=useState<{slot:LightObjectSlot;sourceItem:Item}|null>(null);
  const [color,setColor]=useState('#fff1ca');
  const state=context?.state,caster=state?.party.find(p=>p.id===character.id);
  const heldObjects=LIGHT_OBJECT_SLOTS.flatMap(slot=>{
    const item=caster?.equippedItems?.[slot];
    return item?[{slot,item}]:[];
  });
  // The closed picker should report success only while this caster still holds
  // the marked object and its timed Light source is active. Other casters,
  // packed objects and expired lights do not count as a current result.
  const activeLight=state&&caster?activeObjectLights(state).find(light=>
    light.objectLight?.casterId===caster.id&&light.bearerId===caster.id):undefined;
  const activeSlot=activeLight?.objectLight?.slot;
  const activeItem=activeSlot?caster?.equippedItems?.[activeSlot]:undefined;
  const currentLight=activeLight&&activeSlot&&activeItem?.lightSpellId===activeLight.id?
    {source:activeLight,slot:activeSlot,item:activeItem}:undefined;
  const payload:CastSpellPayload={characterId:character.id!,spellId:'light',spellLevel:0,
    outOfCombat:{targetCharacterId:character.id!,...(selection?{light:{...selection,color,castId:'review'}}:{})}};
  const offer=state?prepareObjectLightCast(state,payload):null;
  const error=!isReadyToCast?(notReadyReason??'This spell is not ready.'):
    selection&&offer&&'error'in offer?offer.error:!selection&&heldObjects.length&&!currentLight?'Choose an object to touch before casting Light.':undefined;
  return <section aria-label="Light object casting" className="border-b border-slate-700 bg-slate-800/30 px-6 py-4 text-sm text-slate-200">
    <p className="font-semibold">Light an object you hold</p>
    <p className="mt-2 text-slate-300">{character.name} touches their own object. It sheds bright light for 20 feet and dim light for another 20 feet, for one hour. Recasting ends their previous Light.</p>
    {currentLight&&<p className="mt-2 text-emerald-200">Current Light: {character.name}'s {currentLight.slot==='MainHand'?'main-hand':'off-hand'} {currentLight.item.name}. Bright light reaches 20 feet, with dim light another 20 feet. {Math.ceil(currentLight.source.durationRemaining)} minutes remain; no spell slot was spent.</p>}
    {!heldObjects.length&&<p role="status" className="mt-2 text-amber-200">No eligible object is held. Equip an object in either hand first; packed items and another person’s objects cannot be selected.</p>}
    <div className="my-3 flex flex-wrap items-center gap-4">
      <label>Object <select aria-label="Object" className="ml-2 rounded border border-slate-500 bg-slate-900 px-3 py-2" value={selection?.slot??''} onChange={e=>{
        const slot=e.target.value as LightObjectSlot,item=caster?.equippedItems?.[slot];
        setSelection(item?{slot,sourceItem:item}:null);
      }}><option value="">Choose an object</option>{heldObjects.map(({slot,item})=>
        <option key={slot} value={slot}>{item.name} ({slot==='MainHand'?'main hand':'off hand'})</option>)}</select></label>
      <label className="flex items-center gap-2">Light color <input type="color" aria-label="Light color" value={color} onChange={e=>setColor(e.target.value)}/></label>
    </div>
    <p className="text-slate-300">The object lights the way while held. Put it away to conceal it; its one-hour duration keeps running. Light cannot target an object worn or carried by someone else.</p>
    {error&&<p role="status" className="mt-2 text-amber-200">{error}</p>}
    <Button type="button" variant="success" className="mt-3" disabled={!state||!selection||!offer||Boolean(error)} onClick={()=>{
      if(!isReadyToCast||!state||!selection||'error'in prepareObjectLightCast(state,payload))return;
      onAction({type:'CAST_SPELL',label:'Cast Light on selected object',payload:{...payload,
        outOfCombat:{...payload.outOfCombat!,light:{...selection,color,castId:generateId()}}}});
      setSelection(null);
    }}>Cast Light on selected object</Button>
  </section>;
}
