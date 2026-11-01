/** The spellbook's contained-water modes use the existing CAST_SPELL
 * transaction. One owned vessel changes with one slot; no loose water stack,
 * new container, healing or companion permission is manufactured. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 17:15:11
 * Dependents: components/CharacterSheet/Spellbook/CastSpellControls.tsx, hooks/actions/handleResourceActions.ts, state/reducers/characterReducer.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {GamePhase,type GameState,type CastSpellPayload} from '../../types';
import {containedWaterGallons,waterCapacityGallons,GALLONS_PER_WATER_DAY} from '../travel/containedWater';
export const CONTAINED_WATER_SPELL_ID='create-or-destroy-water';

export function prepareContainedWaterCast(state:GameState,payload:CastSpellPayload):{patch:Partial<GameState>;gallons:number;waterDays:number}|{error:string} {
  const choice=payload.outOfCombat?.water,caster=state.party.find(p=>p.id===payload.characterId);
  if (state.phase!==GamePhase.PLAYING||payload.spellId!==CONTAINED_WATER_SPELL_ID||!choice||!['create','destroy'].includes(choice.mode)) return {error:'Choose a contained-water mode and an open vessel before casting.'};
  if (!caster||caster.hp<=0||caster.conditions?.some(c=>['unconscious','incapacitated','paralyzed','stunned'].includes(c.toLowerCase()))||caster.statusEffects?.some(e=>['unconscious','incapacitated','paralyzed','stunned'].includes(e.name.toLowerCase()))) return {error:'That caster cannot act now.'};
  if (!caster.spellbook?.preparedSpells.includes(CONTAINED_WATER_SPELL_ID)) return {error:'Create or Destroy Water is not prepared.'};
  const level=payload.spellLevel,key=`level_${level}` as keyof NonNullable<typeof caster.spellSlots>,slot=caster.spellSlots?.[key];
  if (!Number.isInteger(level)||level<1||level>9||!slot||slot.current<1) return {error:'No suitable spell slot remains.'};
  const index=choice.inventoryIndex,vessel=state.inventory[index];
  if (!Number.isSafeInteger(index)||index<0||!vessel||vessel!==choice.sourceItem||!choice.castId||vessel.containedWater?.lastCastId===choice.castId) return {error:'That vessel changed. Review it again before casting.'};
  const capacity=waterCapacityGallons(vessel),current=containedWaterGallons(vessel);
  if (!capacity) return {error:'Choose a vessel with a known liquid capacity and valid contents.'};
  if (vessel.containedWater&&(!Number.isFinite(vessel.containedWater.gallons)||vessel.containedWater.gallons<0||vessel.containedWater.gallons>capacity)) return {error:'The recorded contents of that vessel need review; nothing was changed.'};
  if (!Number.isFinite(state.gameTime.getTime())) return {error:'The world clock is unavailable; nothing was changed.'};
  const gallons=Math.min(10*level,choice.mode==='create'?capacity-current:current);
  if (gallons<=1e-9) return {error:choice.mode==='create'?'That vessel is already full. No spell slot was spent.':'That vessel contains no water to destroy. No spell slot was spent.'};
  const inventory=[...state.inventory];
  const filled={...vessel,containedWater:{gallons:choice.mode==='create'?current+gallons:current-gallons,lastCastId:choice.castId}};
  const quantity=vessel.quantity??1;
  // A carried stack contains real separate vessels. Fill one unit rather than
  // copying liquid across the whole stack or requiring a nonexistent split UI.
  inventory[index]=quantity>1?{...vessel,quantity:quantity-1}:filled;
  if(quantity>1)inventory.splice(index+1,0,{...filled,quantity:1});
  const changedCaster={...caster,spellSlots:{...caster.spellSlots!,[key]:{...slot,current:slot.current-1}}};
  const party=state.party.map(p=>p.id===caster.id?changedCaster:p);
  const messages=[...state.messages,{id:Math.max(0,...state.messages.map(m=>m.id))+1,sender:'system' as const,timestamp:new Date(state.gameTime),
    text:`${caster.name} casts Create or Destroy Water: ${choice.mode==='create'?'creates':'destroys'} ${gallons.toFixed(2)} gallons in ${vessel.name} (${(gallons/GALLONS_PER_WATER_DAY).toFixed(2)} water-days). One level ${level} slot is spent.`}];
  return {gallons,waterDays:gallons/GALLONS_PER_WATER_DAY,patch:{inventory,party,messages,
    ...(state.characterSheetModal?.isOpen&&state.characterSheetModal.character?.id===caster.id?{characterSheetModal:{...state.characterSheetModal,character:changedCaster}}:{})}};
}
