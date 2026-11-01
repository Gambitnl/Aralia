/** Canonical locations for authored public ambitions. This layer adds a new
 * place; it never relabels a generated temple or moves a site toward the player. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:40:24
 * Dependents: systems/worldforge/dungeon/world/dungeonSites.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {childSeedPath,rootSeedPath,rngFromPath,streamPath} from '../../seedPath';
import {FEET_PER_FMG_PIXEL} from '../../adapter/atlasArtifact';
import type {Feet} from '../../units';
import type {DungeonSite} from './dungeonSites';

export interface AuthoredCompanionSiteSource {
  readonly sourceId: 'elara_restore_temple_v1';
  readonly version: 1;
  readonly worldSeed: number;
  readonly companionId: 'elara_vance';
  readonly goalId: 'restore_temple';
  readonly name: 'Temple of the Morning';
  readonly entranceName: 'Temple of the Morning: Undercroft';
  readonly builderName: 'the Order of the Morning';
  readonly nearbyBurgId: number;
  readonly nearbyBurgName: string;
  readonly settlementDistanceCells: number;
}

interface Cells {
  h: ArrayLike<number>;
  p: ReadonlyArray<readonly [number,number]>;
  c?: ReadonlyArray<ReadonlyArray<number>>;
  r?: ArrayLike<number>;
  burg?: ArrayLike<number>;
}
interface Burg {i?:number;cell?:number;name?:string;removed?:boolean}

/** V1 selects one ordinary land cell within four land-graph steps of a real
 * settlement. This is construction context, not proof of a traversable route.
 * Physical entrance support and discovery still belong to normal gameplay. */
export function authoredCompanionSitesForWorld(
  worldSeed:number,
  cells:Cells,
  burgs:readonly Burg[],
  existingSites:readonly Pick<DungeonSite,'cellId'>[],
  markerCells:readonly number[]=[],
):DungeonSite[] {
  if(!Number.isSafeInteger(worldSeed)||worldSeed<0||!cells.c||!cells.r)return [];
  const live=burgs.filter((b):b is Burg&{i:number;cell:number;name:string}=>
    typeof b.i==='number'&&Number.isInteger(b.i)&&b.i>0&&!b.removed&&Number.isInteger(b.cell)&&typeof b.name==='string'&&b.name.trim().length>0)
    .sort((a,b)=>a.i-b.i);
  const owners=new Map<number,{burg:typeof live[number];distance:number}>(),queue:number[]=[];
  for(const burg of live){
    if(burg.cell<0||burg.cell>=cells.h.length||cells.h[burg.cell]<20||owners.has(burg.cell))continue;
    owners.set(burg.cell,{burg,distance:0});queue.push(burg.cell);
  }
  for(let cursor=0;cursor<queue.length;cursor++){
    const cell=queue[cursor],owner=owners.get(cell)!;
    if(owner.distance>=4)continue;
    for(const next of cells.c[cell]??[]){
      if(next<0||next>=cells.h.length||cells.h[next]<20||owners.has(next))continue;
      owners.set(next,{burg:owner.burg,distance:owner.distance+1});queue.push(next);
    }
  }
  const occupied=new Set([...existingSites.map(site=>site.cellId),...markerCells,...live.map(burg=>burg.cell)]);
  const candidates=[...owners.keys()].filter(cell=>{
    const point=cells.p[cell],neighbors=cells.c![cell]??[];
    return !occupied.has(cell)&&!cells.burg?.[cell]&&cells.h[cell]>=25&&cells.h[cell]<=65
      &&point?.every(Number.isFinite)&&neighbors.length>0&&!cells.r![cell]
      &&neighbors.every(next=>next>=0&&next<cells.h.length&&cells.h[next]>=20&&!cells.r![next]);
  }).sort((a,b)=>a-b);
  if(!candidates.length)return [];
  // The complete atlas seed is explicit in this NEW stream. The old uint32
  // grammar and every existing geometry/history/encounter draw stay untouched.
  const root=rootSeedPath(worldSeed);
  const rng=rngFromPath(streamPath(childSeedPath(root,`authored-world:${worldSeed}`),'companion-sites-v1'));
  const cell=candidates[rng.nextInt(0,candidates.length)],owner=owners.get(cell)!;
  const authoredGoal:AuthoredCompanionSiteSource=Object.freeze({
    sourceId:'elara_restore_temple_v1',version:1,worldSeed,companionId:'elara_vance',goalId:'restore_temple',
    name:'Temple of the Morning',entranceName:'Temple of the Morning: Undercroft',builderName:'the Order of the Morning',
    nearbyBurgId:owner.burg.i,nearbyBurgName:owner.burg.name,settlementDistanceCells:owner.distance,
  });
  return [{
    sitePath:childSeedPath(childSeedPath(root,`cell:${cell}`),'dungeon:temple-morning-v1'),cellId:cell,
    entranceKind:'ruin-door',theme:'crypt',archetype:'mausoleum',origin:'authored',authoredGoal,
    posFt:{x:Math.round(cells.p[cell][0]*FEET_PER_FMG_PIXEL) as Feet,y:Math.round(cells.p[cell][1]*FEET_PER_FMG_PIXEL) as Feet},
  }];
}
