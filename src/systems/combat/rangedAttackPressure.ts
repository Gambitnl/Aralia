/**
 * Shared nearby-enemy pressure for ranged attacks and their intent previews.
 * Uses existing footprint, sight and incapacitation rules. It reads live facts;
 * no condition, enemy placement, attack bonus or saved outcome is rewritten.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 07:53:58
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/spell/spellAttack.ts, components/Combat/CombatView.tsx, utils/combat/combatAI.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {Ability,CombatCharacter,CombatState} from '@/types/combat';
import {getCharacterDistance,getOccupiedTiles} from '@/utils/combat/combatUtils';
import {isIncapacitated} from '@/utils/combat/deathSaveUtils';
import {getCombatDistanceFeet,getCombatantAltitudeFeet} from '@/utils/spatial/elevationGeometry';
import {canSeeTarget,canInteract} from '@/utils/planar';
import {hasUndetectedHiddenSource,observerVisibility} from '@/systems/perception/stealthResolution';
import {isRangedWeapon,isThrownAttackAbilityId} from '@/utils/combat/weaponRange';

export const RANGED_PRESSURE_REASON='a nearby enemy can see you';

/** Save-based spells never inherit a ranged-attack warning from their range. */
export function isRangedAttackAbility(ability:Ability):boolean {
 if(ability.type==='spell'){
  const spell: import('@/types/spells').Spell | undefined=ability.spell;
  if(spell?.attackType==='melee'||spell?.id==='primal-savagery'||(spell?.targeting?.type as string)==='melee')return false;
  const objectHitBridge=spell?.effects?.some(effect=>effect.type==='DAMAGE'&&effect.condition?.type==='hit'&&effect.createdObjects?.some(object=>object.ignitesTouchedObjects===true&&object.appearsIn==='target_object'));
  return spell?.attackType==='ranged'||spell?.id==='guiding-bolt'||Boolean(objectHitBridge)||(ability.attackType==='spell'&&ability.range>1);
 }
 if(ability.type!=='attack')return false;
 if(isThrownAttackAbilityId(ability.id))return true;
 if(ability.weapon)return isRangedWeapon(ability.weapon)||Boolean(ability.weapon.properties?.some(p=>p.toLowerCase()==='range'));
 return ability.range>1;
}

export function hasCrossbowCloseCombatException(attacker:CombatCharacter,ability?:Ability):boolean {
 return Boolean(ability&&(attacker.feats??[]).some(f=>f.toLowerCase().replaceAll('_',' ').replaceAll('-',' ')==='crossbow expert')
  && /crossbow/i.test(ability.weapon?.name??ability.name));
}

/** The existing target validator's elevation-aware distance owns this rule.
 * Footprints, flight and source terrain keep their current range meaning;
 * grid adjacency alone cannot impose a penalty across an out-of-reach ledge. */
export function rangedAttackPressure(state:Pick<CombatState,'characters'|'mapData'|'activeLightSources'>,attacker:CombatCharacter,ability?:Ability):boolean {
 if(hasCrossbowCloseCombatException(attacker,ability))return false;
 const named=(c:CombatCharacter,name:string)=>[...(c.conditions??[]),...(c.statusEffects??[])].some(e=>e.name.toLowerCase()===name);
 return state.characters.some(enemy=>{
  if(enemy.id===attacker.id||enemy.team===attacker.team||enemy.currentHP<=0||isIncapacitated(enemy)||(state.mapData?getCombatDistanceFeet(enemy,attacker,state.mapData)>5:getCharacterDistance(enemy,attacker)>1))return false;
  const senseFeet=Math.max(enemy.stats.senses?.blindsight??0,enemy.stats.senses?.truesight??0);
  if(named(enemy,'blinded')&&(enemy.stats.senses?.blindsight??0)<5)return false;
  if(named(attacker,'invisible')&&senseFeet<5)return false;
  if(hasUndetectedHiddenSource(attacker,enemy.id))return false;
  // Old Hidden records have no observer ledger. Keep them unseen; a modern
  // detected Hide source, by contrast, must not hide from that same observer.
  const hiddenStatuses=(attacker.statusEffects??[]).filter(e=>e.name.toLowerCase()==='hidden');
  if(hiddenStatuses.some(e=>!e.stealth)||(!hiddenStatuses.some(e=>e.stealth)&&named(attacker,'hidden')))return false;
  if(!canSeeTarget(enemy,attacker,state as CombatState)||!canInteract(enemy,attacker,state as CombatState))return false;
  if(!state.mapData)return true;
  for(const enemyPos of getOccupiedTiles(enemy))for(const actorPos of getOccupiedTiles(attacker)){
   if(Math.max(Math.abs(enemyPos.x-actorPos.x),Math.abs(enemyPos.y-actorPos.y))>1)continue;
   const horizontalFeet=Math.max(Math.abs(enemyPos.x-actorPos.x),Math.abs(enemyPos.y-actorPos.y))*5;
   if(horizontalFeet+Math.abs(getCombatantAltitudeFeet(enemy,state.mapData,enemyPos)-getCombatantAltitudeFeet(attacker,state.mapData,actorPos))>5)continue;
   if(observerVisibility({...enemy,position:enemyPos},{...attacker,position:actorPos},state.mapData,state.activeLightSources??[])!=='hidden')return true;
  }
  return false;
 });
}
