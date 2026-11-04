/** Light belongs to the chosen object, not the caster's body. The spellbook
 * currently offers the caster's own held objects: their ownership and touch
 * position are established. Room objects need positioned targeting facts before
 * joining this picker. Historical unbound status buffs are never upgraded here.
 * The item marker survives ordinary stow/equip and save/reload; the existing
 * Underdark light list owns expiry. Renderers only project exposed hand objects. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 03/11/2026, 06:54:54
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx, components/CharacterSheet/Spellbook/ObjectLightControls.tsx, components/World3D/GroundCarriedTorch.tsx, hooks/actions/handleResourceActions.ts, state/reducers/characterReducer.ts, systems/underdark/UnderdarkMechanics.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {GamePhase, type GameState, type CastSpellPayload, type Item} from '../../types';
import type {LightSource} from '../../types/underdark';
import {getRacialSpellGrantForSpell} from '../../utils/character';
import {remainingLightMinutes} from '../underdark/carriedItemLight';

export type LightObjectSlot = 'MainHand'|'OffHand';
export const LIGHT_OBJECT_SLOTS: LightObjectSlot[] = ['MainHand','OffHand'];

/** Resolve the real bearer each time. A stored item or departed bearer cannot
 * continue illuminating the current party merely because a source record lives. */
export function resolveObjectLight(state: Pick<GameState,'party'|'underdark'|'gameTime'>, source:LightSource): LightSource {
  if (!source.objectLight) return source;
  const remaining = source.expiresAtGameTime === undefined ? 0 :
    Math.max(0,(source.expiresAtGameTime-state.gameTime.getTime())/60000);
  for (const member of state.party) {
    for (const slot of LIGHT_OBJECT_SLOTS) {
      const item=member.equippedItems?.[slot];
      if(item?.lightSpellId===source.id) return {...source,bearerId:member.id,
        durationRemaining:Math.min(source.durationRemaining,remaining),
        isActive:remaining>0,objectLight:{...source.objectLight,slot}};
    }
  }
  return {...source,isActive:false,durationRemaining:Math.min(source.durationRemaining,remaining)};
}

export function activeObjectLights(state:Pick<GameState,'party'|'underdark'|'gameTime'>):LightSource[] {
  return (state.underdark?.activeLightSources??[]).filter(s=>s.objectLight).map(s=>resolveObjectLight(state,s))
    .filter(s=>s.isActive&&remainingLightMinutes(s,state.gameTime)>0);
}

/** Packed Light still has time left even though it does not illuminate the
 * world. Name its caster, rather than guessing who owns a shared inventory row.
 * A replaced/expired binding offers no current benefit or misleading badge. */
export function objectLightDetails(state:Pick<GameState,'party'|'companions'|'underdark'|'gameTime'>,item:Item):
  {casterName:string;remainingMinutes:number;exposed:boolean}|null {
  const source=item.lightSpellId&&state.underdark?.activeLightSources.find(s=>s.id===item.lightSpellId&&s.objectLight);
  if(!source||!source.objectLight||source.expiresAtGameTime===undefined)return null;
  const remainingMinutes=Math.ceil((source.expiresAtGameTime-state.gameTime.getTime())/60000);
  if(!Number.isFinite(remainingMinutes)||remainingMinutes<=0)return null;
  const id=source.objectLight.casterId;
  const casterName=state.party.find(p=>p.id===id)?.name??state.companions?.[id]?.identity.name??'Unknown caster';
  return {casterName,remainingMinutes,exposed:resolveObjectLight(state,source).isActive};
}

export function prepareObjectLightCast(state:GameState,payload:CastSpellPayload):{patch:Partial<GameState>}|{error:string} {
  const choice=payload.outOfCombat?.light;
  if(state.phase!==GamePhase.PLAYING||payload.spellId!=='light'||payload.spellLevel!==0||!choice)
    return {error:'Choose an object to touch before casting Light.'};
  const caster=state.party.find(p=>p.id===payload.characterId);
  const unable=new Set(['unconscious','incapacitated','paralyzed','stunned']);
  if(!caster||caster.hp<=0||caster.conditions?.some(c=>unable.has(c.toLowerCase()))||
    caster.statusEffects?.some(e=>unable.has(e.name.toLowerCase()))) return {error:'That caster cannot act now.'};
  if(!caster.spellbook?.cantrips.includes('light')&&getRacialSpellGrantForSpell(caster,'light')?.castingMethod!=='at_will')
    return {error:'This character does not know Light.'};
  if(!LIGHT_OBJECT_SLOTS.includes(choice.slot)) return {error:'Choose one of the caster’s own held objects.'};
  const item=caster.equippedItems?.[choice.slot];
  // Compare the reviewed object by reference before committing. The durable
  // marker is attached only here, never guessed from a catalog item ID.
  if(!item||item!==choice.sourceItem||!choice.castId||!/^#[0-9a-f]{6}$/i.test(choice.color))
    return {error:'That object changed. Review it again before casting.'};
  if((item.quantity??1)!==1)return {error:'Separate one held object before casting Light.'};
  if(!Number.isFinite(state.gameTime.getTime()))return {error:'The world clock is unavailable.'};
  const id=`object-light:${caster.id}:${choice.castId}`;
  if(state.underdark.activeLightSources.some(s=>s.id===id))return {error:'This cast has already been resolved.'};
  const source:LightSource={id,type:'spell',name:`Light on ${item.name}`,radius:40,brightRadius:20,dimRadius:20,
    durationRemaining:60,isActive:true,bearerId:caster.id,expiresAtGameTime:state.gameTime.getTime()+3600000,
    objectLight:{casterId:caster.id!,slot:choice.slot,color:choice.color,spellId:'light'}};
  const changedCaster={...caster,equippedItems:{...caster.equippedItems,[choice.slot]:{...item,lightSpellId:id}}};
  // One Light per caster. Other casters, torches and the old unbound status
  // attempt remain untouched; an orphan marker has no active source to project.
  const activeLightSources=state.underdark.activeLightSources.filter(s=>s.objectLight?.casterId!==caster.id).concat(source);
  const messages=[...state.messages,{id:Math.max(0,...state.messages.map(m=>m.id))+1,sender:'system' as const,
    timestamp:new Date(state.gameTime),text:`${caster.name} casts Light on their ${item.name}. It shines for one hour; no spell slot is spent.`}];
  return {patch:{party:state.party.map(p=>p.id===caster.id?changedCaster:p),underdark:{...state.underdark,activeLightSources},messages,
    ...(state.characterSheetModal?.isOpen&&state.characterSheetModal.character?.id===caster.id?
      {characterSheetModal:{...state.characterSheetModal,character:changedCaster}}:{})}};
}
