/** One-shot preflight through the existing world-gen worker. The shared worker
 * client owns cleanup on completion, failure or abort. No source world crosses
 * back to the save: only a qualified revision is copied into existing TownSim.
 * A stale response cannot change a slot or move its player.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 18:02:39
 * Dependents: services/saveLoad/saveLoadCore.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '../../types';
import {runWorkerTask,type WorkerFactory} from '../../workers/workerClient';
import {needsHistoricalTownLoad,type HistoricalTownLoadResult} from '../../systems/worldforge/town/historicalTownLoadContract';
import {HISTORICAL_TOWN_LAYOUT_REVISIONS} from '../../systems/worldforge/town/townLayoutRevision';
import {TERRAIN_SOURCE_REVISIONS} from '../../systems/worldforge/region/terrainSource';

export async function loadHistoricalTownSource(state:GameState,options:{workerFactory?:WorkerFactory;signal?:AbortSignal}={}):Promise<{
  state:GameState;result:HistoricalTownLoadResult;
}> {
  if(!needsHistoricalTownLoad(state))return {state,result:{status:'not-needed'}};
  const before=JSON.stringify(state);
  const result=await runWorkerTask<
    {type:'historicalTownLoad';id:number;state:GameState},
    {type:'historicalTownLoad';id:number;result:HistoricalTownLoadResult}|{type:'error';id:number;message:string},
    HistoricalTownLoadResult
  >({
    factory:options.workerFactory??(()=>new Worker(new URL('../../components/World3D/worldGenWorker.ts',import.meta.url),{type:'module'})),
    request:{type:'historicalTownLoad',id:1,state},
    signal:options.signal??AbortSignal.timeout(120000),
    errorPrefix:'Saved-town source check failed',
    handle:(message,settle)=>{
      if(message.id!==1)return;
      if(message.type==='error')settle.reject(new Error(message.message));
      else if(message.type==='historicalTownLoad')settle.resolve(message.result);
    },
  });
  const refuse=(detail:string)=>({state,result:{status:'unresolved' as const,
    message:`This saved town could not be loaded safely: ${detail} Your saved game has not been changed.`}});
  if(JSON.stringify(state)!==before)return refuse('the load inputs changed during its source check.');
  if(result.status==='not-needed')return refuse('the source check returned no conclusion for the recorded town.');
  if(result.status!=='qualified')return {state,result};
  const town=state.townSim?.[result.burgId],feet=state.playerGroundPos;
  const terrainRevision=result.terrainRevision??state.worldforgeTerrainRevision;
  if(!town||town.burgId!==result.burgId||(town.layoutRevision!==undefined&&town.layoutRevision!==result.revision)
    ||!HISTORICAL_TOWN_LAYOUT_REVISIONS.some(revision=>revision===result.revision)||!feet||feet.yM===undefined
    ||!TERRAIN_SOURCE_REVISIONS.some(revision=>revision===terrainRevision)
    ||(state.worldforgeTerrainRevision!==undefined&&state.worldforgeTerrainRevision!==terrainRevision)
    ||!Number.isFinite(result.surfaceY)||Math.abs(result.surfaceY-feet.yM)>1e-6
    ||result.observations!==Object.keys(town.buildingSources??{}).length||result.observations<0
    ||!Number.isSafeInteger(result.founders)||result.founders<1||result.founders>Object.keys(town.villagers).length
    ||!Object.values(town.buildingSources??{}).every(source=>source.cellId===state.playerCell?.cellId))
    return refuse('the source check no longer matches the saved town.');
  // This is the whole transaction: two explicit source identities, not new
  // terrain, people or progress. Unknown old terrain is never inferred from a
  // town number. The producer must supply its independently admitted recipe.
  // Storage writes still require an ordinary subsequent save.
  return {state:{...state,worldforgeTerrainRevision:terrainRevision,
    townSim:{...state.townSim,[result.burgId]:{...town,layoutRevision:result.revision}}},result};
}
