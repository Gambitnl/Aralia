/** Atomically settle an observed source prop and its inventory item, never a client-supplied reward. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:15:01
 * Dependents: state/reducers/worldReducer.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {GamePhase} from '../../../../types/core';
import type {GameState} from '../../../../types/state';
import {ALL_ITEMS} from '../../../../data/items';
import {instantiateItem} from '../../../../state/reducers/characterReducer';
import {generateDungeonForIdentity} from './deriveIdentity';
import {buildDungeonLevelStack} from './dungeonLevels';
import {withOpenedDungeonDoors} from './dungeonDoorActions';
import {validateDungeonExplorationPosition} from './dungeonExplorationResume';
import {prepareCarriedTorch} from '../../../underdark/carriedItemLight';
import {nearbyDungeonObjects} from './dungeonObjectActions';
import {interactWithDungeonObject} from './dungeonObjectActions';
import {recordDungeonProgress} from './dungeonLifecycle';

export interface DungeonObjectRequest {dungeonId:string;objectId:string;intent:'examine'|'collect'|'light_torch';inventoryIndex?:number}

export function resolveDungeonObject(state:GameState,request:DungeonObjectRequest):Partial<GameState> {
  const record=state.dungeonExpeditions?.[request.dungeonId];
  const visit=record?.progress.activeVisit;
  if(state.phase!==GamePhase.PLAYING || !record || !visit ||
    !state.party.some(member=>member.hp>0) || visit.returnContext.worldSeed!==state.worldSeed ||
    visit.returnContext.cellId!==state.playerCell?.cellId) return {};
  try {
    // Regenerate through the same canonical owner used by entry. The request carries no plan,
    // position, item id, quantity or outcome for the reducer to trust.
    const entry={identity:record.identity,entranceKind:visit.entranceKind,returnContext:visit.returnContext,
      plan:generateDungeonForIdentity(record.identity,visit.returnContext.worldSeed)};
    if(!validateDungeonExplorationPosition(record,entry)) return {};
    const level=buildDungeonLevelStack(record.identity,entry.plan,visit.returnContext.worldSeed)[visit.depth];
    const plan=withOpenedDungeonDoors(level.plan,level.identity,record.progress.openedRouteIds);
    if(request.intent==='light_torch') {
      // Reuse the actual fixed flame only after canonical reach checks. Never remove its source prop.
      const target=nearbyDungeonObjects(plan,level.identity,visit.playerCell,
        record.progress.exploredCellKeysByLevel[level.identity.levelId]??[]).find(object=>object.id===request.objectId);
      const bearer=state.party.find(member=>member.hp>0);
      if(target?.prop.kind!=='torch'||!bearer)return {};
      const light=prepareCarriedTorch(state,{itemId:'torch',characterId:bearer.id,inventoryIndex:request.inventoryIndex},target.id);
      return 'patch' in light?light.patch:{};
    }
    const result=interactWithDungeonObject(plan,level.identity,visit.playerCell,
      record.progress.exploredCellKeysByLevel[level.identity.levelId]??[],record.progress.objectFindings??{},
      request.objectId,request.intent,{claimedTreasureIds:record.progress.claimedTreasureIds,clearedEncounterIds:record.progress.clearedEncounterIds});
    if(!result) return {};
    const rewards=result.rewards??(result.itemId?[{itemId:result.itemId,quantity:1}]:[]);
    if(rewards.some(reward=>!ALL_ITEMS[reward.itemId]||!Number.isSafeInteger(reward.quantity)||reward.quantity<1))return {};
    // Check every real item before recording any claim. A missing template consumes neither cache nor reward.
    const items=rewards.flatMap(reward=>Array.from({length:reward.quantity},()=>instantiateItem({...ALL_ITEMS[reward.itemId],sourceId:result.id})));
    return {
      ...(items.length ? {inventory:[...state.inventory,...items]} : {}),
      dungeonExpeditions:{...state.dungeonExpeditions,[request.dungeonId]:recordDungeonProgress(record,{
        objectFindings:{[result.id]:result.finding},
        ...(result.claimedTreasureId?{claimedTreasureIds:[result.claimedTreasureId]}:{}),
      })},
    };
  } catch(error) {
    // A stale attachment must not grant a substitute item or clear the source prop.
    console.warn('Dungeon object source is unavailable.',error);
    return {};
  }
}
