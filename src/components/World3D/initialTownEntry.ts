/** Choose a new town arrival on the town's own public geometry, before anyone
 * receives a saved position. This is not movement or an old-save repair. Every
 * person in the existing opening layout must fit; a finite terrain sample alone
 * cannot justify placing a body inside a house, under a deck or in water. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 09:38:09
 * Dependents: components/World3D/World3DWrapper.tsx, components/World3D/partyJourneyArrival.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {EntityRecipe} from '@/systems/entities3d/types';
import {registerAllParts} from '@/systems/entities3d/parts';
import {generateEntityBlueprint} from '@/systems/entities3d/generateEntityBlueprint';
import {assembleEntity,gameBodyOptions} from '@/systems/entities3d/three/assembleEntity';
import {measurePlacementBody,type PlacementBodyProfile} from './groundPlacementInspection';
import {groundSurfaceYM} from './terrain/groundSurfaceYM';
import {groundWaterMovementAt} from './groundWaterMovement';
import type {GameState} from '@/types/state';
import {recipeFromRichNpc} from '@/systems/entities3d/recipeFromCharacter';
import {isSitePartRenderable,siteOrientationFromQuad,sitePartLocalOffset,worldOffsetToSiteLocal} from '@/systems/worldforge/bridge/sitePartTransform';

type Point={x:number;z:number};
export interface EntryActor {id:string;offset:Point;body:PlacementBodyProfile}
export interface EntryActorRecipe {id:string;offset:Point;recipe:EntityRecipe;isPlayer?:boolean}
export interface PublicTownEntry {x:number;z:number;y:number;source:{kind:'street'|'plaza';index:number};actors:Array<{id:string;xM:number;zM:number;yM:number}>}
export interface EntryOccupant {id:string;xM:number;zM:number;radius:number}
const MARGIN=.15,MAX_DISTANCE=80,MAX_GRADE=Math.tan(40*Math.PI/180);
type EntryBuilding=GroundWorld['buildings'][number];
const partBounds=new WeakMap<EntryBuilding,{yaw:number;radius:number;parts:Array<{x:number;z:number;hx:number;hz:number;bottom:number;top:number}>}>();

/** The plot quad is not the visible structure's outer edge. Porches, columns,
 * facade trim and role motifs can extend into the street. Use their canonical
 * part frame, including dressing that walking's older proxy deliberately skips.
 * Beam bounds are conservative by the existing SitePart contract. This admits
 * only a NEW standing place; it never changes saved feet or movement rules. */
function renderedPartsTouchBody(ground:GroundWorld,point:Point,yM:number,body:PlacementBodyProfile):boolean {
 const halfBody=body.halfWidthM+MARGIN;
 for(const building of ground.buildings??[]){
  let cached=partBounds.get(building);
  if(!cached){
   const {rotationY:yaw,doorZSign}=siteOrientationFromQuad(building.cornersM);
   const parts=(building.parts??[]).filter(p=>isSitePartRenderable(p)&&p.w>0&&p.d>0&&p.h>0).map(p=>{
    const off=sitePartLocalOffset(p,doorZSign);
    return {x:off.x,z:off.z,hx:p.w/2,hz:p.d/2,bottom:p.baseY??0,top:(p.baseY??0)+p.h};
   });
   cached={yaw,parts,radius:Math.max(0,...parts.map(p=>Math.hypot(Math.abs(p.x)+p.hx,Math.abs(p.z)+p.hz)))};
   partBounds.set(building,cached);
  }
  if(Math.hypot(point.x-building.xM,point.z-building.zM)>cached.radius+halfBody*Math.SQRT2)continue;
  const local=worldOffsetToSiteLocal(point.x-building.xM,point.z-building.zM,cached.yaw);
  const cos=Math.abs(Math.cos(cached.yaw)),sin=Math.abs(Math.sin(cached.yaw)),projectedBody=halfBody*(cos+sin);
  const floor=groundSurfaceYM(ground,building.xM,building.zM);
  for(const p of cached.parts){
   if(floor+p.top<=yM||floor+p.bottom>=yM+body.heightM)continue;
   const dx=local.lx-p.x,dz=local.lz-p.z;
   if(Math.abs(dx)>p.hx+projectedBody||Math.abs(dz)>p.hz+projectedBody)continue;
   // Separating axes of both rectangles keep a rotated part's empty AABB
   // corners available, while covering the figure's full measured square.
   const worldX=dx*Math.cos(cached.yaw)+dz*Math.sin(cached.yaw);
   const worldZ=-dx*Math.sin(cached.yaw)+dz*Math.cos(cached.yaw);
   if(Math.abs(worldX)<=halfBody+p.hx*cos+p.hz*sin&&Math.abs(worldZ)<=halfBody+p.hx*sin+p.hz*cos)return true;
  }
 }
 return false;
}

/** Use the same procedural recipes/body construction as the visible figures.
 * Temporary handles own their resources and are disposed after measuring. */
export function measureEntryActors(recipes:EntryActorRecipe[]):EntryActor[] {
 registerAllParts();
 return recipes.map(person=>{
  const blueprint=generateEntityBlueprint(person.recipe);
  const handle=assembleEntity(blueprint,{...gameBodyOptions(blueprint),...(person.isPlayer?{resolutionScale:.7,fieldUpdateHz:10}:{})});
  try {
   if(!person.isPlayer)handle.group.rotation.y=Math.atan2(-person.offset.x,-person.offset.z);
   const body=measurePlacementBody(handle.group);
   if(!body)throw Error(`Cannot measure ${person.id}'s standing body for town entry.`);
   return {id:person.id,offset:person.offset,body};
  } finally {handle.dispose();}
 });
}
function nearest(p:Point,a:Point,b:Point){const dx=b.x-a.x,dz=b.z-a.z;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return {x:a.x+t*dx,z:a.z+t*dz};}
function distance(p:Point,a:Point,b:Point){const n=nearest(p,a,b);return Math.hypot(p.x-n.x,p.z-n.z);}
function inPolygon(p:Point,polygon:Point[]){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;}
function touches(p:Point,radius:number,polygon:Point[]){return inPolygon(p,polygon)||polygon.some((a,i)=>distance(p,a,polygon[(i+1)%polygon.length])<=radius);}
function publicFootprint(ground:GroundWorld,p:Point,radius:number){
 return (ground.roads??[]).some(road=>road.sourceKind==='town-street'&&road.points.some((a,i)=>i>0&&distance(p,road.points[i-1],a)+radius<=road.widthM/2))
  ||(ground.plazas??[]).some(plaza=>inPolygon(p,plaza.pointsM)&&plaza.pointsM.every((a,i)=>distance(p,a,plaza.pointsM[(i+1)%plaza.pointsM.length])>=radius));
}

/** Read-only admission for a proposed public arrival. Conservative plot/deck
 * exclusion avoids guessing which interior floor or bridge level was intended.
 * This does not authorize a route to the point or alter any world geometry. */
export function publicEntryBodyFits(ground:GroundWorld,p:Point,body:PlacementBodyProfile,requirePublic=true):boolean {
 const radius=body.halfWidthM+MARGIN;
 if(![p.x,p.z,body.heightM,radius].every(Number.isFinite)||body.heightM<=0||radius<=MARGIN)return false;
 // A proven journey can also arrive in wilderness. It keeps every physical
 // admission check; only a town's public-street requirement is inapplicable.
 if(p.x-radius<0||p.z-radius<0||p.x+radius>ground.extentMetersX||p.z+radius>ground.extentMetersZ||(requirePublic&&!publicFootprint(ground,p,radius)))return false;
 if((ground.buildings??[]).some(b=>touches(p,radius,b.cornersM)))return false;
 if((ground.decks??[]).some(d=>touches(p,radius,d.cornersM)))return false;
 if((ground.walls??[]).some(w=>w.points.some((a,i)=>i>0&&distance(p,w.points[i-1],a)<=radius+w.widthM/2)))return false;
 const yM=groundSurfaceYM(ground,p.x,p.z);if(!Number.isFinite(yM))return false;
 if(renderedPartsTouchBody(ground,p,yM,body))return false;
 // A standing footprint samples the same surface as walking. New arrivals
 // begin dry; an unresolved ribbon or submerged street is not a safe fallback.
 for(const x of [-1,0,1])for(const z of [-1,0,1]){
  const xM=p.x+x*radius,zM=p.z+z*radius,y=groundSurfaceYM(ground,xM,zM);
  if(!Number.isFinite(y)||Math.abs(y-yM)>Math.hypot(x*radius,z*radius)*MAX_GRADE+1e-7)return false;
  if(groundWaterMovementAt(ground,{xM,zM,yM:y},{...body,standingHeightM:body.heightM}).mode!=='dry')return false;
 }
 return true;
}

/** Initial placement only: sample real street centerlines and plaza interiors,
 * then choose the nearest bounded fit for the entire initial group. No random
 * relocation, terrain edits, consent, quest progress or saved anchors enter here. */
export function selectInitialPublicTownEntry(ground:GroundWorld,focus:Point,actors:EntryActor[],occupied:readonly EntryOccupant[]=[]):PublicTownEntry|null {
 if(!actors.length||actors.some(a=>![a.offset.x,a.offset.z].every(Number.isFinite)))return null;
 const candidates:Array<Point&{source:PublicTownEntry['source']}>=[];
 const add=(p:Point,source:PublicTownEntry['source'])=>{if(Math.hypot(p.x-focus.x,p.z-focus.z)<=MAX_DISTANCE)candidates.push({...p,source});};
 (ground.roads??[]).forEach((road,index)=>{
  if(road.sourceKind!=='town-street')return;
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],n=nearest(focus,a,b),length=Math.hypot(b.x-a.x,b.z-a.z);
   add(n,{kind:'street',index});
   if(!length)continue;
   for(let along=-MAX_DISTANCE;along<=MAX_DISTANCE;along+=2){
    const p={x:n.x+along*(b.x-a.x)/length,z:n.z+along*(b.z-a.z)/length};
    if((p.x-a.x)*(p.x-b.x)+(p.z-a.z)*(p.z-b.z)<=1e-7)add(p,{kind:'street',index});
   }
  }
 });
 (ground.plazas??[]).forEach((plaza,index)=>{
  if(plaza.pointsM.length<3)return;
  const xs=plaza.pointsM.map(p=>p.x),zs=plaza.pointsM.map(p=>p.z);
  const center={x:xs.reduce((a,b)=>a+b,0)/xs.length,z:zs.reduce((a,b)=>a+b,0)/zs.length};add(center,{kind:'plaza',index});
  for(let x=Math.max(Math.min(...xs),focus.x-MAX_DISTANCE);x<=Math.min(Math.max(...xs),focus.x+MAX_DISTANCE);x+=2)
   for(let z=Math.max(Math.min(...zs),focus.z-MAX_DISTANCE);z<=Math.min(Math.max(...zs),focus.z+MAX_DISTANCE);z+=2)
    if(inPolygon({x,z},plaza.pointsM))add({x,z},{kind:'plaza',index});
 });
 candidates.sort((a,b)=>Math.hypot(a.x-focus.x,a.z-focus.z)-Math.hypot(b.x-focus.x,b.z-focus.z)||a.x-b.x||a.z-b.z||a.source.index-b.source.index);
 const seen=new Set<string>();let checked=0;
 for(const point of candidates){
  const key=`${point.x.toFixed(5)}:${point.z.toFixed(5)}`;if(seen.has(key))continue;seen.add(key);if(++checked>2000)break;
  if(actors.some(a=>occupied.some(other=>other.id!==a.id&&Math.hypot(point.x+a.offset.x-other.xM,point.z+a.offset.z-other.zM)<a.body.halfWidthM+MARGIN+other.radius)))continue;
  if(!actors.every(a=>publicEntryBodyFits(ground,{x:point.x+a.offset.x,z:point.z+a.offset.z},a.body)))continue;
  return {...point,y:groundSurfaceYM(ground,point.x,point.z),actors:actors.map(a=>({id:a.id,xM:point.x+a.offset.x,zM:point.z+a.offset.z,yM:groundSurfaceYM(ground,point.x+a.offset.x,point.z+a.offset.z)}))};
 }
 return null;
}

/** Resolve an unobserved activity from its own saved town, independent of the
 * player's entry/camera. A failed fit remains unavailable; it never falls back
 * to a conversational cluster beside the player. Existing points stay exact. */
export function resolveCompanionActivityPlacements(ground:GroundWorld,state:GameState){
 const positions:Record<string,{xM:number;yM:number;zM:number}>={},occupied:EntryOccupant[]=[],unavailable:string[]=[];
 for(const companion of Object.values(state.companions).sort((a,b)=>a.id.localeCompare(b.id))){
  const activity=companion.publicActivity,where=companion.whereabouts,npc=state.generatedNpcs[companion.id];
  if(!activity||!npc||activity.worldSeed!==state.worldSeed||where?.worldSeed!==state.worldSeed||where.locationId!==state.currentLocationId
   ||companion.inParty||state.party.some(p=>p.id===companion.id))continue;
  const measured=measureEntryActors([{id:companion.id,offset:{x:0,z:0},recipe:recipeFromRichNpc(npc,companion.identity.race)}])[0];
  // The renderer's facing depends on the scene origin. A circumscribed bound
  // keeps the new standing place clear for every facing, without changing a model.
  const body={...measured.body,halfWidthM:measured.body.halfWidthM*Math.SQRT2};
  if(where.position&&[where.position.xM,where.position.yM,where.position.zM].every(Number.isFinite))positions[companion.id]={...where.position};
  else if(where.source==='world-activity'){
   const town=ground.towns.find(t=>t.burgId===activity.burgId);
   if(!town){unavailable.push(companion.id);continue;}
   const square=(ground.plazas??[]).map(p=>{const n=p.pointsM.length;return n?{x:p.pointsM.reduce((v,p)=>v+p.x,0)/n,z:p.pointsM.reduce((v,p)=>v+p.z,0)/n}:null;})
    .filter((p):p is Point=>!!p&&Math.hypot(p.x-town.xM,p.z-town.zM)<=town.halfM)
    .sort((a,b)=>Math.hypot(a.x-town.xM,a.z-town.zM)-Math.hypot(b.x-town.xM,b.z-town.zM)||a.x-b.x||a.z-b.z)[0];
   const entry=selectInitialPublicTownEntry(ground,square??{x:town.xM,z:town.zM},[{...measured,body}],occupied);
   if(!entry){unavailable.push(companion.id);continue;}
   positions[companion.id]={xM:entry.x,yM:entry.y,zM:entry.z};
  }
  const point=positions[companion.id];if(point)occupied.push({id:companion.id,xM:point.xM,zM:point.zM,radius:body.halfWidthM+MARGIN});
 }
 return {positions,occupied,unavailable};
}
