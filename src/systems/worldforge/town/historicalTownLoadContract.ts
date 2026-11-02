/** Lightweight save/worker contract. Successful preflight identifies the town
 * layout and independent terrain recipe; it never regenerates saved progress. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 18:02:39
 * Dependents: services/saveLoad/loadHistoricalTownSource.ts, services/saveLoad/saveLoadCore.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts
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
import type {TerrainSourceRevision} from '../region/terrainSource';

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
