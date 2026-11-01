/** Show the party's accepted feet on the existing canonical town plan.
 * This reverses the town bake's affine transform. It never chooses a nearby
 * building, moves the party, discovers a place or changes the source plan. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 01:45:09
 * Dependents: components/MapPane.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '../../../types/state';
import type {Pt} from '../submap/submapEngine';
import {acceptedGroundPoint} from '../travel/localGroundJourney';
import {getBridgeAtlas} from '../bridge/legacySubmapBridge';
import {FEET_PER_FMG_PIXEL} from '../adapter/atlasArtifact';
import {townSpanFtForBurg} from './canonicalTown';
import {CANON_TOWN_SPAN,POPULATION_RATE,townEnvelopeHalfFtForPeople} from './townScale';

export function townMapPosition(state:GameState|undefined,viewWorldSeed:number,burgId:number|undefined):Pt|null {
  if(!state||state.worldSeed!==viewWorldSeed||burgId===undefined)return null;
  const point=acceptedGroundPoint(state);
  if(!point)return null;
  const atlas=getBridgeAtlas(viewWorldSeed),burg=atlas.pack.burgs?.[burgId];
  if(!burg||burg.removed||burg.i!==burgId||burg.cell!==state.playerCell?.cellId)return null;
  const centerX=burg.x*FEET_PER_FMG_PIXEL,centerY=burg.y*FEET_PER_FMG_PIXEL;
  // The same working apron as town presence. Sharing a cell alone does not
  // put a traveler back in town, and no nearest-point fallback is allowed.
  const half=townEnvelopeHalfFtForPeople((burg.population??10)*POPULATION_RATE);
  if(Math.abs(point[0]-centerX)>half||Math.abs(point[1]-centerY)>half)return null;
  const scale=townSpanFtForBurg(atlas,burgId)/CANON_TOWN_SPAN;
  if(!Number.isFinite(scale)||scale<=0)return null;
  const result:Pt=[(point[0]-centerX)/scale,(point[1]-centerY)/scale];
  return result.every(Number.isFinite)?result:null;
}
