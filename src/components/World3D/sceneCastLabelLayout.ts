/** Captions stay readable at a phone edge without changing anyone's world pose.
 * Pack the projected heads in stable cast order. The caption may move within
 * the viewport; the body, camera and interaction targets remain authoritative. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 17:04:19
 * Dependents: components/World3D/SceneCast.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Vector3, type Camera, type Object3D } from 'three';

type Viewport = {width:number;height:number};
type CaptionPoint = {id:string;x:number;y:number};
export type CastCaptionObstacle = {x:number;y:number;width:number;height:number};
export type CastLabelProjector = (anchor:Object3D,camera:Camera,size:Viewport)=>[number,number];

export function fitCastLabels(points:readonly CaptionPoint[],size:Viewport,obstacles:readonly CastCaptionObstacle[]=[]):Map<string,[number,number]> {
  const result=new Map<string,[number,number]>();
  if(!(size.width>0&&size.height>0))return result;
  const margin=Math.min(8,size.width/4,size.height/4);
  const width=Math.min(180,size.width-2*margin),height=Math.min(26,size.height-2*margin);
  const blocked=obstacles.filter(rect=>[rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)&&rect.width>0&&rect.height>0);
  const fit=(value:number,extent:number,half:number)=>Math.max(margin+half,Math.min(extent-margin-half,value));
  for(const point of points){
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
    const x=fit(point.x,size.width,width/2),base=fit(point.y,size.height,height/2);
    const candidates=[base];
    // Try below an existing caption or notice first, rather than pushing a talk
    // control behind the player's name/warning or the top-row world controls.
    for(const [,otherY] of result.values())candidates.push(fit(otherY+height+4,size.height,height/2),fit(otherY-height-4,size.height,height/2));
    for(const rect of blocked)candidates.push(fit(rect.y+rect.height+height/2+4,size.height,height/2),fit(rect.y-height/2-4,size.height,height/2));
    for(let step=1;step<=points.length+blocked.length;step++)for(const direction of [1,-1])candidates.push(fit(base+direction*step*(height+4),size.height,height/2));
    const y=candidates.find(y=>[...result.values()].every(([otherX,otherY])=>Math.abs(x-otherX)>=width+4||Math.abs(y-otherY)>=height+4)
      &&blocked.every(rect=>x+width/2+4<=rect.x||x-width/2-4>=rect.x+rect.width||y+height/2+4<=rect.y||y-height/2-4>=rect.y+rect.height))??base;
    result.set(point.id,[x,y]);
  }
  return result;
}

/** Every callback projects the complete known anchor set at the current camera.
 * It does not rely on React mounting or frame-callback order to reset a cache. */
export function createCastLabelProjectors(ids:readonly string[],readObstacles:()=>readonly CastCaptionObstacle[]=()=>[]):(id:string)=>CastLabelProjector {
  const anchors=new Map<string,Object3D>(),point=new Vector3();
  return id=>(anchor,camera,size)=>{
    anchors.set(id,anchor);
    const points=ids.flatMap(id=>{
      const current=anchors.get(id);if(!current)return [];
      point.setFromMatrixPosition(current.matrixWorld).project(camera);
      return [{id,x:(point.x+1)*size.width/2,y:(1-point.y)*size.height/2}];
    });
    return fitCastLabels(points,size,readObstacles()).get(id)??[size.width/2,size.height/2];
  };
}
