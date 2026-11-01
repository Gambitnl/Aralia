/** First-generation clearance against the mounted ground-floor structure.
 * Accepted legacy repair receipts continue to use their original plot/disc
 * context. This index changes no terrain, building, door state or saved prop. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 03:58:01
 * Dependents: systems/worldforge/props/prospectivePropPlacement.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWorld } from '../bridge/groundChunkLoader';
import type { SitePart } from '../bridge/interiorParts';
import { siteOrientationFromQuad, sitePartScenePosition } from '../bridge/sitePartTransform';
import { exteriorRouteExclusions } from './exteriorPropRevision';
import { boundsOverlap, convexFootprint, footprintBounds, footprintDistance, footprintRouteDistance,
  validFootprint, type FootprintBounds, type FootprintPoint } from './propFootprint';

type PolygonObstacle={id:string;points:readonly FootprintPoint[];gap:number;bounds:FootprintBounds};
type RouteObstacle={id:string;a:FootprintPoint;b:FootprintPoint;gap:number;bounds:FootprintBounds};
/** Four-meter bins only reject impossible contacts. Exact polygon/segment
 * distances still decide every nearby contact, including route end caps. */
class FootprintIndex<T extends {bounds:FootprintBounds}> {
  private bins=new Map<string,Set<T>>();
  private members=new Map<T,string[]>();
  private wide=new Set<T>();
  private keys(bounds:FootprintBounds):string[]|undefined {
    const x0=Math.floor(bounds.minX/4),x1=Math.floor(bounds.maxX/4),z0=Math.floor(bounds.minZ/4),z1=Math.floor(bounds.maxZ/4);
    if((x1-x0+1)*(z1-z0+1)>1024)return;
    const keys:string[]=[];for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)keys.push(`${x}:${z}`);return keys;
  }
  add(row:T):void {const keys=this.keys(row.bounds);this.members.set(row,keys??[]);
    if(!keys){this.wide.add(row);return;}for(const key of keys){let bin=this.bins.get(key);if(!bin){bin=new Set();this.bins.set(key,bin);}bin.add(row);}}
  remove(row:T):void {for(const key of this.members.get(row)??[]){const bin=this.bins.get(key);bin?.delete(row);if(!bin?.size)this.bins.delete(key);}this.wide.delete(row);this.members.delete(row);}
  near(bounds:FootprintBounds):T[] {const keys=this.keys(bounds),rows=new Set(this.wide);
    if(!keys)return [...this.members.keys()].filter(row=>boundsOverlap(bounds,row.bounds));
    for(const key of keys)for(const row of this.bins.get(key)??[])rows.add(row);
    return [...rows].filter(row=>boundsOverlap(bounds,row.bounds));}
}

function partCorners(building:GroundWorld['buildings'][number],part:SitePart):FootprintPoint[] {
  const frame={...siteOrientationFromQuad(building.cornersM),groupX:building.xM,groupZ:building.zM,surfaceY:0};
  return convexFootprint([[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz])=>{
    const p=sitePartScenePosition({x:part.x+sx*part.w/2,z:part.z+sz*part.d/2,h:0},frame);
    return {x:p.x,z:p.z};
  }));
}
/** Circumscribed samples reserve the complete quarter-turn, including its
 * middle, rather than only the open and closed leaf boxes. */
export function freshDoorSwingFootprint(building:GroundWorld['buildings'][number],part:SitePart):FootprintPoint[] {
  if(!part.door||![part.x,part.z,part.w,part.d].every(Number.isFinite)||part.w<=0||part.d<=0)return [];
  const door=part.door,hinge={x:door.axis==='x'?part.x-part.w/2:part.x,z:door.axis==='x'?part.z:part.z-part.d/2};
  const turn=door.axis==='x'?door.swingZ:-door.swingX;
  if(Math.abs(turn)!==1)return [];
  const frame={...siteOrientationFromQuad(building.cornersM),groupX:building.xM,groupZ:building.zM,surfaceY:0};
  const points:FootprintPoint[]=[],inflate=1/Math.cos(Math.PI/64);
  for(let step=0;step<=16;step++)for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
    const angle=turn*Math.PI/2*step/16,x=(part.x+sx*part.w/2-hinge.x)*inflate,z=(part.z+sz*part.d/2-hinge.z)*inflate;
    const p=sitePartScenePosition({x:hinge.x+x*Math.cos(angle)-z*Math.sin(angle),z:hinge.z+x*Math.sin(angle)+z*Math.cos(angle),h:0},frame);
    points.push({x:p.x,z:p.z});
  }return convexFootprint(points);
}

export function createFreshPropClearance(ground:GroundWorld) {
  const structure=new FootprintIndex<PolygonObstacle>(),routes=new FootprintIndex<RouteObstacle>(),neighbours=new FootprintIndex<PolygonObstacle>();
  const props=new Map<string,PolygonObstacle>(),problems:string[]=[],fallbackBuildings:string[]=[];
  const addStructure=(id:string,points:readonly FootprintPoint[],gap:number)=>{
    if(!validFootprint(points)){problems.push(`invalid-building-footprint:${id}`);return;}
    structure.add({id,points,gap,bounds:footprintBounds(points,gap)});
  };
  for(const building of ground.buildings){
    if(building.cornersM.length<4||!validFootprint(building.cornersM)){problems.push(`invalid-building-frame:${building.id}`);continue;}
    // Floors reserve the private interior, even where no wall crosses it.
    // Separate slabs retain real recesses and open L-shaped corners.
    const parts=(building.parts??[]).filter(p=>!p.furnishing&&(
      (p.walkSurface==='floor'&&Math.abs(p.baseY??0)<=.3)
      ||(p.tag==='exterior'&&(p.baseY??0)<2.5&&(p.baseY??0)+p.h>0)
      ||(p.stairSolid&&(p.baseY??0)<2.5)
      ||p.ensembleDetailKind==='arcade-column'));
    if(!parts.length){fallbackBuildings.push(building.id);addStructure(building.id,building.cornersM,.5);}
    for(const part of parts){
      if(![part.x,part.z,part.w,part.d,part.h].every(Number.isFinite)||part.w<=0||part.d<=0||part.h<=0){problems.push(`invalid-structural-part:${building.id}`);continue;}
      addStructure(building.id,partCorners(building,part),.5);
    }
    for(const part of building.parts??[])if(part.door?.level===0)addStructure(`door-swing:${building.id}`,freshDoorSwingFootprint(building,part),.05);
  }
  for(const route of exteriorRouteExclusions(ground)){
    if(!Number.isFinite(route.clearanceM)||route.clearanceM<0||route.points.some(p=>![p.x,p.z].every(Number.isFinite))){problems.push(`invalid-route:${route.id}`);continue;}
    for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],gap=route.clearanceM;
      routes.add({id:route.id,a,b,gap,bounds:footprintBounds([a,b],gap)});}
  }
  const inspect=(points:readonly FootprintPoint[],ownId:string|undefined,checkNeighbours:boolean,firstOnly:boolean):string[]=>{
      if(problems.length)return [...problems];
      if(!validFootprint(points))return ['invalid-prop-footprint'];
      const issues=new Set<string>(),bounds=footprintBounds(points);
      if(bounds.minX<=0||bounds.minZ<=0||bounds.maxX>=ground.extentMetersX||bounds.maxZ>=ground.extentMetersZ){issues.add('window-edge');if(firstOnly)return [...issues];}
      for(const row of structure.near(bounds))if(footprintDistance(points,row.points)<=row.gap){issues.add(row.id);if(firstOnly)return [...issues];}
      for(const row of routes.near(bounds))if(footprintRouteDistance(points,row.a,row.b)<=row.gap){issues.add(row.id);if(firstOnly)return [...issues];}
      if(checkNeighbours)for(const row of neighbours.near(bounds))if(row.id!==ownId&&footprintDistance(points,row.points)<=row.gap){issues.add(row.id);if(firstOnly)return [...issues];}
      return [...issues];

  };
  return {
    fallbackBuildings,
    setProp(id:string,points:readonly FootprintPoint[]){const previous=props.get(id);if(previous)neighbours.remove(previous);
      if(!validFootprint(points)){props.delete(id);return;}
      const row={id,points,gap:.05,bounds:footprintBounds(points,.05)};props.set(id,row);neighbours.add(row);},
    removeProp(id:string){const previous=props.get(id);if(previous)neighbours.remove(previous);props.delete(id);},
    issuesFor:(points:readonly FootprintPoint[],ownId?:string,checkNeighbours=true)=>inspect(points,ownId,checkNeighbours,false),
    isClear:(points:readonly FootprintPoint[],ownId?:string,checkNeighbours=true):boolean=>inspect(points,ownId,checkNeighbours,true).length===0,
  };
}
