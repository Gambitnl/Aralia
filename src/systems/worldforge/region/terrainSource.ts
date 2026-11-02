/** Select the saved world's terrain recipe without changing its town layout,
 * people or position. An absent legacy field is unresolved during admission;
 * ordinary new generation uses the current default. Cache callers must include
 * this explicit selection rather than infer it from a town or the save's age. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 02/11/2026, 18:02:39
 * Dependents: components/World3D/worldGenCore.ts, components/Worldforge/AtlasDemo.tsx, services/saveLoad/loadHistoricalTownSource.ts, services/saveLoad/saveLoadCore.ts, systems/worldforge/bridge/legacySubmapBridge.ts, systems/worldforge/leaf3d/atlasGroundRestore.ts, systems/worldforge/town/historicalTownLoadContract.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts, systems/worldforge/travel/localGroundJourney.ts, types/state.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {generateRegion,type GenerateRegionOptions} from './generateRegion';
import {generateRegion as generateRegionV1} from './generateRegionV1';

export const CURRENT_TERRAIN_REVISION = 2 as const;
export const TERRAIN_SOURCE_REVISIONS = [1,CURRENT_TERRAIN_REVISION] as const;
export type TerrainSourceRevision = typeof TERRAIN_SOURCE_REVISIONS[number];

export function requireTerrainSourceRevision(value:unknown):TerrainSourceRevision {
  if(value===1||value===CURRENT_TERRAIN_REVISION)return value;
  throw Error('This world uses an unsupported terrain source revision.');
}

export function generateRegionFromSource(
  atlas:Parameters<typeof generateRegion>[0],cell:number,seed:Parameters<typeof generateRegion>[2],
  options:GenerateRegionOptions,revision:TerrainSourceRevision=CURRENT_TERRAIN_REVISION,
):ReturnType<typeof generateRegion> {
  return requireTerrainSourceRevision(revision)===1
    ? generateRegionV1(atlas,cell,seed,options)
    : generateRegion(atlas,cell,seed,options);
}
