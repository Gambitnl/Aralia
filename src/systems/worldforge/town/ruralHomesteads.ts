/**
 * Plan new farm homes around the same rural households and fields the town knows.
 * Homes first try their retained agricultural parent (or unsplit field), then
 * classified scrub after all original home attempts. Crop fields and family
 * markers stay unchanged; pasture is not proposed as home ground. An eight-foot approach
 * joins an existing public road without crossing another home or yard. This is
 * first-generation source geometry, never a migration of an established home.
 * Terrain support, rendered furnishing clearance and legal access still need
 * the existing ground and gameplay checks before adoption.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 13:35:11
 * Dependents: systems/worldforge/roster/ruralHouseholds.ts, systems/worldforge/town/canonicalTown.ts, systems/worldforge/town/ruralHomesteadArtifacts.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownPlan } from './townEngine';
import { findRuralApproach } from './ruralApproachRoute';
import { ruralFamilyFrontageOffsetFt } from './ruralHouseGeometry';
import type { Pt } from '../submap/submapEngine';
import type { SeedPath } from '../seedPath';
import { cropForFarmParcel, type FarmCrop } from './farmCrops';
import {
  footprintBounds, boundsOverlap, footprintDistance, footprintFitsLot,
  footprintRouteDistance, footprintBoundaryDistance, pointInsideFootprint, validFootprint, type FootprintPoint,
} from '../props/propFootprint';

export const RURAL_PLOT_ID_BASE = 1_000_000;
export interface RuralHomesteadSite {
  farmId: string;
  plotId: number;
  farmParcelIndex: number;
  occupants: number;
  crop: FarmCrop;
  /** Source land for the working yard, distinct from the cultivated strip. */
  yardSource: {kind:'field'|'parent-parcel'|'scrub-parcel';id:string};
  sourceCenter: Pt;
  center: Pt;
  /** Quad corners0-1 face the source public road. */
  house: Pt[];
  yard: Pt[];
  approach: { points: Pt[]; width: number; streetIndex: number; sharedWithFarmId?:string };
}
export interface RuralHomesteadPlan {
  version: 1;
  sites: RuralHomesteadSite[];
  /** Intents left by this bounded search, not proof of global unreachability. */
  declined: Array<{farmId:string;farmParcelIndex?:number;occupants:number;reason:string;rejections?:Record<string,number>}>;
}
const shape=(p:readonly Pt[]):FootprintPoint[]=>p.map(([x,z])=>({x,z}));
function quad(center:Pt,front:Pt,width:number,depth:number):Pt[]{
  const across:Pt=[front[1],-front[0]];
  return [[-1,1],[1,1],[1,-1],[-1,-1]].map(([a,d])=>[
    center[0]+across[0]*a*width/2+front[0]*d*depth/2,
    center[1]+across[1]*a*width/2+front[1]*d*depth/2,
  ]);
}
function closest(p:Pt,a:Pt,b:Pt):Pt{
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
  return [a[0]+dx*t,a[1]+dy*t];
}
function corridor(a:Pt,b:Pt,width:number):Pt[]{
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  return length>1e-8?quad([(a[0]+b[0])/2,(a[1]+b[1])/2],[(b[0]-a[0])/length,(b[1]-a[1])/length],width,length):[];
}
interface Obstacle { polygon:FootprintPoint[]; bounds:ReturnType<typeof footprintBounds> }
interface HomesteadRoad {a:Pt;b:Pt;width:number;streetIndex:number;sourceFarmId?:string}
const obstacle=(p:readonly Pt[]):Obstacle=>{const polygon=shape(p);return {polygon,bounds:footprintBounds(polygon)};};
function clears(p:readonly Pt[],obstacles:readonly Obstacle[],gap:number):boolean{
  const polygon=shape(p),box=footprintBounds(polygon,gap);
  return obstacles.every(o=>!boundsOverlap(box,o.bounds)||footprintDistance(polygon,o.polygon)>=gap);
}

/** Reuse exact polygon clearance while limiting route queries to nearby lots. */
function obstacleIndex(items:readonly Obstacle[],cell:number){
  const bins=new Map<string,Obstacle[]>(),wide:Obstacle[]=[];
  const add=(item:Obstacle)=>{
    const b=item.bounds,x0=Math.floor(b.minX/cell),x1=Math.floor(b.maxX/cell),y0=Math.floor(b.minZ/cell),y1=Math.floor(b.maxZ/cell);
    if((x1-x0+1)*(y1-y0+1)>1024){wide.push(item);return;}
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x+':'+y,list=bins.get(key)??[];list.push(item);bins.set(key,list);}
  };
  items.forEach(add);
  const nearby=(b:ReturnType<typeof footprintBounds>)=>{
    const result=new Set(wide.filter(item=>boundsOverlap(b,item.bounds)));
    for(let x=Math.floor(b.minX/cell);x<=Math.floor(b.maxX/cell);x++)for(let y=Math.floor(b.minZ/cell);y<=Math.floor(b.maxZ/cell);y++)for(const item of bins.get(x+':'+y)??[])if(boundsOverlap(b,item.bounds))result.add(item);
    return result;
  };
  return {add,nearby};
}

/** All dimensions are authored in real feet, then expressed in this plan's frame. */
export function planRuralHomesteads(
  plan:Pick<TownPlan,'farmsteads'|'outskirts'|'plots'|'civic'|'streetNetwork'|'footprint'|'walls'>,
  seed:SeedPath,
  feetPerUnit:number,
):RuralHomesteadPlan{
  if(!Number.isFinite(feetPerUnit)||feetPerUnit<=0)throw new Error('Homesteads require a real plan scale.');
  const unit=(feet:number)=>feet/feetPerUnit;
  const out:RuralHomesteadPlan={version:1,sites:[],declined:[]};
  const fields=plan.outskirts.filter(p=>p.kind==='farm');
  const town=shape(plan.footprint),gap=unit(1),approachWidth=unit(8);
  const walled=plan.walls.ring.length>=3;
  // Rural approaches join the public network outside the walls, including
  // suburban lanes. The enclosed town stays reserved, so a nearer inner
  // street cannot invite a shortcut through walls or private building lots.
  const structures=[...plan.plots.map(p=>obstacle(p.polygon)),...plan.civic.filter(c=>c.kind!=='plaza'&&c.kind!=='bridge'&&c.kind!=='dock').map(c=>obstacle(c.polygon)),
    ...(walled?[obstacle(plan.walls.ring)]:[]),
  ];
  const yards:Obstacle[]=[],paths:Obstacle[]=[];
  const routeObstacles=obstacleIndex(structures,unit(32));
  const wallShape=walled?shape(plan.walls.ring):[];
  const roads:HomesteadRoad[]=plan.streetNetwork.flatMap((s,streetIndex)=>
    s.centerline.slice(1).map((b,i)=>({a:s.centerline[i],b,width:s.width,streetIndex})))
    .filter(r=>Number.isFinite(r.width)&&r.width>0&&[...r.a,...r.b].every(Number.isFinite)
      &&(!walled||footprintRouteDistance(wallShape,{x:r.a[0],z:r.a[1]},{x:r.b[0],z:r.b[1]})>=r.width/2+gap));
  // Build toward the interior of each agricultural parent from its public
  // frontage. A marker-id order scattered early yards and long approaches
  // across space needed by later families. These are unaccepted proposals;
  // original marker identities/positions and established campaigns stay intact.
  const publicRoads=[...roads];
  const distanceToPublicRoad=(point:Pt)=>Math.min(...publicRoads.map(road=>{
    const join=closest(point,road.a,road.b);return Math.hypot(join[0]-point[0],join[1]-point[1]);
  }));
  const orderedFarms=plan.farmsteads.map(farm=>({farm,distance:distanceToPublicRoad([farm.x,farm.y])}))
    .sort((a,b)=>a.distance-b.distance||(a.farm.id<b.farm.id?-1:a.farm.id>b.farm.id?1:0));
  const idCounts=new Map<string,number>();
  for(const farm of plan.farmsteads)idCounts.set(farm.id,(idCounts.get(farm.id)??0)+1);
  // Finish every original agricultural-parent attempt before using unworked
  // scrub. A new fallback cannot displace a previously admitted home or field.
  type HomeLand={id:string;polygon:Pt[]};
  const queue:Array<{farm:TownPlan['farmsteads'][number];homeLand?:HomeLand;lastFallback?:boolean}>=orderedFarms.map(({farm})=>({farm}));
  const admittedFarmIds=new Set<string>(),refusals=new Map<string,Record<string,number>>();
  const scrub=plan.outskirts.flatMap((parcel,index)=>parcel.kind==='scrub'&&validFootprint(shape(parcel.polygon))
    ?[{id:'scrub-parcel:'+index,polygon:parcel.polygon}]:[]);
  for(const {farm,homeLand,lastFallback} of queue){
    if(admittedFarmIds.has(farm.id))continue;
    const rejections:Record<string,number>=refusals.get(farm.id)??{};refusals.set(farm.id,rejections);
    const reject=(reason:string)=>{rejections[reason]=(rejections[reason]??0)+1;};
    const decline=(reason:string)=>out.declined.push({farmId:farm.id,farmParcelIndex:farm.farmParcelIndex,occupants:farm.occupants,reason,
      ...(Object.keys(rejections).length?{rejections}:{})});
    const ordinal=/^f(0|[1-9]\d*)$/.exec(farm.id),plotId=ordinal?RURAL_PLOT_ID_BASE+Number(ordinal[1]):NaN;
    const field=farm.farmParcelIndex===undefined?undefined:fields[farm.farmParcelIndex];
    if(idCounts.get(farm.id)!==1||!Number.isSafeInteger(plotId)||!Number.isInteger(farm.farmParcelIndex)||!field||!validFootprint(shape(field.polygon))
      ||(field.farmParent&&(!field.farmParent.id||!validFootprint(shape(field.farmParent.polygon))))
      ||!Number.isInteger(farm.occupants)||farm.occupants<1||farm.occupants>8||![farm.x,farm.y].every(Number.isFinite)){
      decline('invalid-household-or-field-source');continue;
    }
    if(!roads.length){decline('no-public-road-source');continue;}
    // The existing farm program includes a hall, kitchen, bedrooms and pantry.
    // Larger families get more room; no household is shrunk to rescue a tight lot.
    const width=unit(25+(farm.occupants>3?5:0)+(farm.occupants>6?5:0));
    const depth=unit(35+(farm.occupants>2?5:0)+(farm.occupants>5?5:0));
    const yardLand=homeLand?.polygon??field.farmParent?.polygon??field.polygon,fieldShape=shape(yardLand);
    const angle=field.furrowAngle;
    const grain:Pt=Number.isFinite(angle)?[Math.cos(angle!),Math.sin(angle!)]:[1,0];
    const crossGrain:Pt=[-grain[1],grain[0]];
    const along=yardLand.map(([x,y])=>x*grain[0]+y*grain[1]);
    const across=yardLand.map(([x,y])=>x*crossGrain[0]+y*crossGrain[1]);
    const uMin=Math.min(...along),uMax=Math.max(...along),vMin=Math.min(...across),vMax=Math.max(...across);
    const candidates:Pt[]=[[farm.x,farm.y]];
    // Bounded whole-field search can recover an out-of-field source point.
    // These are unaccepted new houses; the named source marker stays unchanged.
    for(let y=1;y<16;y++)for(let x=1;x<16;x++){
      const u=uMin+(uMax-uMin)*y/16,v=vMin+(vMax-vMin)*x/16;
      candidates.push([grain[0]*u+crossGrain[0]*v,grain[1]*u+crossGrain[1]*v]);
    }
    // Prefer short connections at original public frontage before borrowing
    // deeper land. Shared tracks help access but never redefine this ordering.
    const rankedCandidates=candidates.map(center=>({center,distance:distanceToPublicRoad(center)}))
      .sort((a,b)=>a.distance-b.distance||Math.hypot(a.center[0]-farm.x,a.center[1]-farm.y)-Math.hypot(b.center[0]-farm.x,b.center[1]-farm.y));
    let accepted:RuralHomesteadSite|undefined;
    const fallbackSites:Array<{center:Pt;house:Pt[];yard:Pt[];door:Pt;apron:Pt;goals:Array<HomesteadRoad&{join:Pt}>}>=[];
    for(const {center} of rankedCandidates){
      const seenStreets=new Set<string>();
      const roadChoices=roads.map(road=>({...road,join:closest(center,road.a,road.b)}))
        .sort((a,b)=>Math.hypot(a.join[0]-center[0],a.join[1]-center[1])-Math.hypot(b.join[0]-center[0],b.join[1]-center[1]))
        .filter(road=>{const key=road.streetIndex+':'+(road.sourceFarmId??'town');if(seenStreets.has(key))return false;seenStreets.add(key);return true;});
      // A nearby shared branch supplements the original public connections;
      // it must not replace a clear original route with a blocked nearer one.
      const joins=[...roadChoices.filter(r=>!r.sourceFarmId).slice(0,8),...roadChoices.filter(r=>r.sourceFarmId).slice(0,4)];
      for(const road of joins){
        const distance=Math.hypot(road.join[0]-center[0],road.join[1]-center[1]);
        if(distance<depth/2){reject('road-distance');continue;}
        const towardRoad:Pt=[(road.join[0]-center[0])/distance,(road.join[1]-center[1])/distance];
        // Long narrow fields have an authored grain. A house may face along
        // that grain and use a bent approach rather than rotate across its lot.
        const sign=grain[0]*towardRoad[0]+grain[1]*towardRoad[1]>=0?1:-1;
        const fronts:Pt[]=[towardRoad,...(Number.isFinite(angle)?[[grain[0]*sign,grain[1]*sign] as Pt]:[])];
        for(const front of fronts){
          const house=quad(center,front,width,depth),yard=quad(center,front,width+unit(8),depth+unit(12));
          if(!footprintFitsLot(shape(yard),fieldShape,gap)){reject('yard-source-land');continue;}
          if(!clears(yard,structures,unit(2))){reject(walled&&!clears(yard,[obstacle(plan.walls.ring)],unit(2))?'yard-wall-enclosure':'yard-structure');continue;}
          if(!clears(yard,yards,unit(2))){reject('neighbor-yard');continue;}
          if(!clears(yard,paths,gap)){reject('prior-approach');continue;}
          if(roads.some(r=>footprintRouteDistance(shape(yard),{x:r.a[0],z:r.a[1]},{x:r.b[0],z:r.b[1]})<r.width/2+gap)){reject('yard-road');continue;}
          // The fitted family spine is half a cell off-center in even-width
          // homes. Admit the complete route from that real entry, including
          // fallback searches, rather than moving a saved track afterward.
          const offset=unit(ruralFamilyFrontageOffsetFt(width*feetPerUnit));
          const door:Pt=[center[0]+front[0]*depth/2+front[1]*offset,center[1]+front[1]*depth/2-front[0]*offset];
          const bent=front!==towardRoad;
          const apron:Pt=[door[0]+front[0]*unit(6),door[1]+front[1]*unit(6)];
          // Keep a few complete house/yard candidates for obstacle routing only
          // after every cheap straight/bent choice has failed for this family.
          if(fallbackSites.length<4&&!fallbackSites.some(s=>s.center[0]===center[0]&&s.center[1]===center[1])){
            const searchApron:Pt=[door[0]+front[0]*unit(8),door[1]+front[1]*unit(8)];
            const prefix=corridor(door,searchApron,approachWidth),turn=quad(searchApron,[1,0],approachWidth,approachWidth);
            if(footprintFitsLot(shape(prefix),town,0)&&footprintFitsLot(shape(turn),town,0)
              &&clears(prefix,structures,gap)&&clears(prefix,yards,gap)&&clears(turn,structures,gap)&&clears(turn,yards,gap)&&clears(turn,[obstacle(house)],gap))
              fallbackSites.push({center:[...center],house,yard,door,apron:searchApron,goals:joins});
          }
          const points:Pt[]=bent?[door,apron,road.join]:[door,road.join];
          const routes=points.slice(1).map((p,i)=>corridor(points[i],p,approachWidth));
          // Reserve the whole bend as well as its straight legs. The extra leg
          // cannot cut back through the house whose door it serves.
          if(bent){
            routes.push(quad(apron,[1,0],approachWidth,approachWidth));
            if(!clears(routes[1],[obstacle(house)],gap)){reject('approach-own-house');continue;}
          }
          if(routes.some(path=>!footprintFitsLot(shape(path),town,0))){reject('approach-town-land');continue;}
          if(routes.some(path=>!clears(path,structures,gap))){reject(walled&&routes.some(path=>!clears(path,[obstacle(plan.walls.ring)],gap))?'approach-wall-enclosure':'approach-structure');continue;}
          if(routes.some(path=>!clears(path,yards,gap))){reject('approach-neighbor-yard');continue;}
          accepted={farmId:farm.id,plotId,farmParcelIndex:farm.farmParcelIndex!,occupants:farm.occupants,
            crop:cropForFarmParcel(seed,farm.farmParcelIndex!),
            yardSource:homeLand?{kind:'scrub-parcel',id:homeLand.id}:field.farmParent?{kind:'parent-parcel',id:field.farmParent.id}:{kind:'field',id:'field:'+farm.farmParcelIndex},
            sourceCenter:[farm.x,farm.y],center:[...center],house,yard,
            approach:{points,width:approachWidth,streetIndex:road.streetIndex,
              ...(road.sourceFarmId?{sharedWithFarmId:road.sourceFarmId}:{}),
            }};
          break;
        }
        if(accepted)break;
      }
      if(accepted)break;
    }
    if(!accepted)for(const candidate of fallbackSites){
      const ownHouse=obstacle(candidate.house),radius=approachWidth/2;
      // A capsule admits the whole approach width, including its turn caps.
      // The first six feet leave the door normally; search starts in that
      // forecourt and must remain clear of this house and every other yard.
      const routeClear=(from:Pt,to:Pt)=>{
        const a={x:from[0],z:from[1]},b={x:to[0],z:to[1]};
        if(!pointInsideFootprint(a,town)||!pointInsideFootprint(b,town)||footprintBoundaryDistance([a,b],town)<radius)return false;
        const box=footprintBounds([a,b],radius+gap);
        for(const item of routeObstacles.nearby(box))if(footprintRouteDistance(item.polygon,a,b)<radius+gap)return false;
        return footprintRouteDistance(ownHouse.polygon,a,b)>=radius+gap;
      };
      const pointClear=(point:Pt)=>{
        const cap=quad(point,[1,0],approachWidth,approachWidth),polygon=shape(cap);
        if(!footprintFitsLot(polygon,town,0))return false;
        for(const item of routeObstacles.nearby(footprintBounds(polygon,gap)))if(footprintDistance(polygon,item.polygon)<gap)return false;
        return footprintDistance(polygon,ownHouse.polygon)>=gap;
      };
      // A blocked closest projection is not the whole public street. Its
      // source endpoints are legitimate additional junctions, with the same
      // root identity and full-width admission at every candidate junction.
      const targets=candidate.goals.flatMap(road=>{
        const line=road.sourceFarmId?[road.a,road.b]:plan.streetNetwork[road.streetIndex].centerline;
        return [road.join,line[0],line[line.length-1]].map(join=>({...road,join}));
      });
      const targetSources=new Map<string,number>();
      targets.forEach((road,index)=>{const key=road.streetIndex+':'+(road.sourceFarmId??'town');if(!targetSources.has(key))targetSources.set(key,index);});
      const network=roads.flatMap(road=>{const targetIndex=targetSources.get(road.streetIndex+':'+(road.sourceFarmId??'town'));
        return targetIndex===undefined?[]:[{...road,targetIndex}];
      });
      // Follow the actual public network when reaching it. Existing narrow
      // street centerlines need not happen to land on this yard's grid phase.
      const project=(point:Pt)=>network.map(road=>{const join=closest(point,road.a,road.b);return {road,join,distance:Math.hypot(join[0]-point[0],join[1]-point[1])};});
      const connect=(point:Pt)=>{
        const nearby=project(point).filter(row=>row.distance<=unit(12)).sort((a,b)=>a.distance-b.distance);
        for(const row of nearby)if(routeClear(point,row.join))return {point:row.join,targetIndex:row.road.targetIndex};
      };
      // Broad steps reach a distant street within the bounded budget. Retry
      // finer grids for narrow or awkward passages; every edge and turn still
      // uses the same eight-foot geometry, so scale never relaxes clearance.
      let result:ReturnType<typeof findRuralApproach>;
      for(const feet of [20,10,5]){
        result=findRuralApproach({start:candidate.apron,targets:targets.map(g=>g.join),step:unit(feet),maxExpanded:3000,
          pointClear,targetClear:p=>routeClear(p,p),segmentClear:routeClear,connect,
          estimate:p=>Math.min(...project(p).map(row=>row.distance)),onRefusal:reason=>reject('obstacle-route-'+reason)});
        if(result)break;
      }
      if(!result){reject('bounded-obstacle-route');continue;}
      const road=targets[result.targetIndex],points:Pt[]=[candidate.door,...result.points];
      accepted={farmId:farm.id,plotId,farmParcelIndex:farm.farmParcelIndex!,occupants:farm.occupants,
        crop:cropForFarmParcel(seed,farm.farmParcelIndex!),
        yardSource:homeLand?{kind:'scrub-parcel',id:homeLand.id}:field.farmParent?{kind:'parent-parcel',id:field.farmParent.id}:{kind:'field',id:'field:'+farm.farmParcelIndex},
        sourceCenter:[farm.x,farm.y],center:candidate.center,house:candidate.house,yard:candidate.yard,
        approach:{points,width:approachWidth,streetIndex:road.streetIndex,...(road.sourceFarmId?{sharedWithFarmId:road.sourceFarmId}:{})}};
      break;
    }
    if(!accepted){
      if(!homeLand){
        // Only classified scrub is proposed for home ground. Pasture and other
        // households' fields keep their existing livelihood. Four nearby source
        // parcels bound the search; failure remains an explicit unmet need.
        const alternatives=scrub.map(land=>({land,area:Math.abs(land.polygon.reduce((sum,a,i)=>{const b=land.polygon[(i+1)%land.polygon.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2,
          distance:Math.min(...land.polygon.map(p=>Math.hypot(p[0]-farm.x,p[1]-farm.y)))}))
          .filter(candidate=>candidate.area>=(width+unit(8))*(depth+unit(12)))
          .sort((a,b)=>a.distance-b.distance||a.land.id.localeCompare(b.land.id)).slice(0,4);
        if(alternatives.length){alternatives.forEach((candidate,index)=>queue.push({farm,homeLand:candidate.land,lastFallback:index===alternatives.length-1}));continue;}
      }else if(!lastFallback)continue;
      decline('no-house-yard-and-public-approach-fit');continue;
    }
    admittedFarmIds.add(farm.id);
    out.sites.push(accepted);const acceptedYard=obstacle(accepted.yard);yards.push(acceptedYard);routeObstacles.add(acceptedYard);
    accepted.approach.points.slice(1).forEach((p,i)=>paths.push(obstacle(corridor(accepted!.approach.points[i],p,approachWidth))));
    accepted.approach.points.slice(1,-1).forEach(point=>paths.push(obstacle(quad(point,[1,0],approachWidth,approachWidth))));
    // Neighbors can share the new track after it has left this private yard.
    // Keep the root public-street reference and an acyclic source-farm join;
    // no later route receives permission to cut through an earlier home.
    const ownYard=obstacle(accepted.yard);
    accepted.approach.points.slice(1).forEach((b,i)=>{
      const a=accepted!.approach.points[i];
      for(let step=0;step<20;step++){
        const t=step/20,start:Pt=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
        const publicPart=corridor(start,b,approachWidth);
        if(publicPart.length&&clears(publicPart,[ownYard],gap)){
          roads.push({a:start,b:[...b],width:approachWidth,streetIndex:accepted!.approach.streetIndex,sourceFarmId:accepted!.farmId});
          break;
        }
      }
    });
  }
  return out;
}
