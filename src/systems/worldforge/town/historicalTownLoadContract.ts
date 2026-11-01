/** Lightweight save/worker contract. Only the existing TownSim revision is
 * selected on successful preflight; no new saved world or status store exists. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 22:46:21
 * Dependents: services/saveLoad/loadHistoricalTownSource.ts, services/saveLoad/saveLoadCore.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '../../../types';
import type {TownLayoutRevision} from './townLayoutRevision';

export type HistoricalTownLoadResult =
  | {status:'not-needed'}
  | {status:'unresolved';message:string}
  | {status:'qualified';burgId:number;revision:TownLayoutRevision;
      observations:number;founders:number;surfaceY:number};

/** Avoid atlas generation/worker startup for saves without a played,
 * unversioned foundation in the current cell. Absence grants no revision. */
export function needsHistoricalTownLoad(state:GameState):boolean {
  const cell=state.playerCell?.cellId;
  return cell!==undefined && Object.values(state.townSim??{}).some(town=>town.layoutRevision===undefined
    && Object.values(town.buildingSources??{}).some(source=>source.cellId===cell));
}
