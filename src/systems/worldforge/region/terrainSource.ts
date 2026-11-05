/** Select the saved world's regional and foundation recipe without changing its town layout,
 * people or position. An absent legacy field is unresolved during admission;
 * ordinary new generation uses the current default. Cache callers must include
 * this explicit selection rather than infer it from a town or the save's age. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 04/11/2026, 21:37:49
 * Dependents: components/World3D/worldGenCore.ts, components/Worldforge/AtlasDemo.tsx, hooks/app/useAppAtlasRuntime.ts, services/saveLoad/loadHistoricalTownSource.ts, services/saveLoad/saveLoadCore.ts, systems/worldforge/artifacts.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/legacySubmapBridge.ts, systems/worldforge/leaf3d/atlasGroundRestore.ts, systems/worldforge/town/historicalTownLoadContract.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts, systems/worldforge/travel/localGroundJourney.ts, types/state.ts
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
// Sources 1/2 retain their established height-node foundations. Sources 3/4
// pair those regional generators with the retained cell-center foundation mask.
// A historical combination still needs independent admission or explicit choice.
export const TERRAIN_SOURCE_REVISIONS = [1,CURRENT_TERRAIN_REVISION,3,4] as const;
export type TerrainSourceRevision = typeof TERRAIN_SOURCE_REVISIONS[number];

export function requireTerrainSourceRevision(value:unknown):TerrainSourceRevision {
  if(value===1||value===CURRENT_TERRAIN_REVISION||value===3||value===4)return value;
  throw Error('This world uses an unsupported terrain source revision.');
}

/** Preserve old cache keys while preventing a retained foundation source from
 * borrowing another Region/Local. This changes no generation seed path. */
export function terrainSourceCacheTag(revision:TerrainSourceRevision=CURRENT_TERRAIN_REVISION):string {
  const source=requireTerrainSourceRevision(revision);
  return source===1?'/terrain:pre-oct30':source===2?'':`/terrain:profile:${source}`;
}

/** The pad mask is source geometry, never permission to move a saved body. */
export function terrainSourceFoundationGrid(revision:TerrainSourceRevision=CURRENT_TERRAIN_REVISION):'cell-center'|'height-sample' {
  const source=requireTerrainSourceRevision(revision);
  return source===3||source===4?'cell-center':'height-sample';
}

export function generateRegionFromSource(
  atlas:Parameters<typeof generateRegion>[0],cell:number,seed:Parameters<typeof generateRegion>[2],
  options:GenerateRegionOptions,revision:TerrainSourceRevision=CURRENT_TERRAIN_REVISION,
):ReturnType<typeof generateRegion> {
  const source=requireTerrainSourceRevision(revision);
  const region=source===1||source===3
    ? generateRegionV1(atlas,cell,seed,options)
    : generateRegion(atlas,cell,seed,options);
  // Existing artifacts retain their exact shape. New historical profiles carry
  // additive provenance through the normal worker, Atlas and rest build paths.
  return source===3||source===4?{...region,terrainSourceRevision:source}:region;
}
