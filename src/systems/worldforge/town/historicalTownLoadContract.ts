/** Lightweight save/worker contract. Successful preflight identifies the town
 * layout and independent terrain recipe; it never regenerates saved progress. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 03/11/2026, 03:31:46
 * Dependents: services/saveLoad/loadHistoricalTownSource.ts, services/saveLoad/saveLoadCore.ts, state/appState.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '../../../types';
import type {TownLayoutRevision} from './townLayoutRevision';
import {TERRAIN_SOURCE_REVISIONS,type TerrainSourceRevision} from '../region/terrainSource';

export type HistoricalTownLoadResult =
  | {status:'not-needed'}
  | {status:'unresolved';message:string}
  | {status:'qualified';burgId:number;revision:TownLayoutRevision;
      observations:number;founders:number;surfaceY:number;terrainRevision?:TerrainSourceRevision};

/** Observed foundations and saved businesses both prove that an unversioned
 * town was played. Neither chooses its reader; the worker independently
 * compares every founding identity, workplace and accepted exterior support. */
export function needsHistoricalTownLoad(state:GameState):boolean {
  const cell=state.playerCell?.cellId;
  return cell!==undefined && Object.values(state.townSim??{}).some(town=>(town.layoutRevision===undefined || state.worldforgeTerrainRevision===undefined)
    && (Object.values(town.buildingSources??{}).some(source=>source.cellId===cell)
      || Object.values(state.worldBusinesses??{}).some(business=>business.burgId===town.burgId
        && business.locationId===`cell_${cell}`)));
}

/** A new arrival has no destination feet yet. Its source receipt identifies the
 * recorded town before movement; it cannot admit or reposition a saved body. */
export interface HistoricalTownArrivalReceipt {
  worldSeed:number; cellId:number; burgId:number; revision:TownLayoutRevision;
  terrainRevision:TerrainSourceRevision; signature:string;
}
export type HistoricalTownArrivalResult = {status:'not-needed'}
  | {status:'unresolved';message:string}
  | {status:'qualified';receipt:HistoricalTownArrivalReceipt};

/** Bind the transient receipt to existing records, not to another status store.
 * The clock is included because an intervening day can change people or shops. */
export function historicalTownArrivalSignature(state:GameState,burgId:number):string {
  return JSON.stringify({worldSeed:state.worldSeed,time:state.gameTime,town:state.townSim[burgId],
    businesses:Object.entries(state.worldBusinesses??{}).filter(([,b])=>b.burgId===burgId),
    people:Object.entries(state.generatedNpcs??{}).filter(([,n])=>(n as {worldforgeHousehold?:{burgId:number}}).worldforgeHousehold?.burgId===burgId)});
}

/** Apply only the independently qualified source in the same MOVE that leaves
 * the origin. Every person, possession and life event stays byte-for-byte. A
 * stale/misdirected receipt cannot rewrite metadata or move an existing body. */
export function historicalTownArrivalUpdate(state:GameState,cellId:number,receipt:HistoricalTownArrivalReceipt):
  Pick<GameState,'townSim'|'worldforgeTerrainRevision'>|undefined {
  const town=state.townSim[receipt.burgId];
  if(!town||receipt.worldSeed!==state.worldSeed||receipt.cellId!==cellId||state.playerCell?.cellId===cellId
    ||![1,2,4].includes(receipt.revision)||!TERRAIN_SOURCE_REVISIONS.includes(receipt.terrainRevision)
    ||town.layoutRevision!==undefined&&town.layoutRevision!==receipt.revision
    ||state.worldforgeTerrainRevision!==undefined&&state.worldforgeTerrainRevision!==receipt.terrainRevision
    ||receipt.signature!==historicalTownArrivalSignature(state,receipt.burgId))return undefined;
  return {townSim:{...state.townSim,[receipt.burgId]:{...town,layoutRevision:receipt.revision}},
    worldforgeTerrainRevision:receipt.terrainRevision};
}
