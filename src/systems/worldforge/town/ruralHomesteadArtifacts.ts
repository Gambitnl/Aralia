/**
 * Carry admitted new farm homes into the existing artifact building contract.
 * The caller must opt in after choosing candidate rural sources; ordinary and
 * saved towns keep their earlier output. Named families retain their f-id,
 * fields/crops retain their source join, and refused needs remain visible.
 * Each proposed yard must fit its declared field, parent or scrub source;
 * that siting check gives no land title or work attendance permission.
 * Reservation queries prepare crop/prop consumers to keep whole footprints out
 * of yards and approaches. They do not grant ownership or prove terrain/native
 * passage; those consumers must apply them before physical prototype adoption.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 13:20:26
 * Dependents: systems/worldforge/props/propLandUse.ts, systems/worldforge/town/townPlanAdapter.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {TownPlan as EnginePlan} from './townEngine';
import type {TownPlan as ArtifactPlan} from '../artifacts';
import type {RuralHomesteadPlan} from './ruralHomesteads';
import {RURAL_PLOT_ID_BASE} from './ruralHomesteads';
import type {FarmCrop} from './farmCrops';
import type {Pt} from '../submap/submapEngine';
import {footprintDistance,footprintFitsLot,footprintRouteDistance,validFootprint,type FootprintPoint} from '../props/propFootprint';

/** All geometry is in the artifact's feet frame. Source use is not legal title. */
export interface RuralArtifactSources {
  /** Explicit source recipe; never inferred from an occupation or an old save. */
  layoutRecipe:'rural-family-v1';
  homesteads:RuralHomesteadPlan;
  fields:Array<{farmParcelIndex:number;polygon:Pt[];crop:FarmCrop}>;
}
const shape=(p:readonly Pt[]):FootprintPoint[]=>p.map(([x,z])=>({x,z}));
const copy=(p:readonly Pt[]):Pt[]=>p.map(([x,y])=>[x,y]);

/** Append reserved identities; urban plot/street ids are never renumbered. */
export function buildRuralHomesteadArtifacts(
  plan:Pick<EnginePlan,'ruralHomesteads'|'farmsteads'|'outskirts'>,
  occupiedPlotIds:readonly number[],occupiedStreetIds:readonly number[],
):{plots:ArtifactPlan['plots'];streets:ArtifactPlan['streets'];sources:RuralArtifactSources}{
  if(!plan.ruralHomesteads||plan.ruralHomesteads.version!==1)throw new Error('Rural artifacts require explicit planned homestead sources.');
  const homesteads=structuredClone(plan.ruralHomesteads),farmFields=plan.outskirts.filter(f=>f.kind==='farm');
  const plotIds=new Set(occupiedPlotIds),streetIds=new Set(occupiedStreetIds),known=new Set<string>();
  const fields=new Map<number,RuralArtifactSources['fields'][number]>();
  const plots:ArtifactPlan['plots']=[],streets:ArtifactPlan['streets']=[];
  for(const site of homesteads.sites){
    const matches=plan.farmsteads.filter(f=>f.id===site.farmId),farm=matches[0],ordinal=/^f(0|[1-9]\d*)$/.exec(site.farmId);
    const field=farmFields[site.farmParcelIndex],path=site.approach;
    const scrubIndex=/^scrub-parcel:(0|[1-9]\d*)$/.exec((site.yardSource?.id??''));
    const scrubParcel=scrubIndex?plan.outskirts[Number(scrubIndex[1])]:undefined;
    const homeLand=site.yardSource?.kind==='scrub-parcel'
      ? scrubParcel?.kind==='scrub'?scrubParcel.polygon:undefined
      : site.yardSource?.kind==='parent-parcel'&&field?.farmParent?.id===site.yardSource.id?field.farmParent.polygon
        : site.yardSource?.kind==='field'&&site.yardSource.id==='field:'+site.farmParcelIndex?field?.polygon:undefined;
    if(matches.length!==1||known.has(site.farmId)||!ordinal||site.plotId!==RURAL_PLOT_ID_BASE+Number(ordinal[1])
      ||!Number.isSafeInteger(site.plotId)||plotIds.has(site.plotId)||streetIds.has(site.plotId)
      ||farm.occupants!==site.occupants||farm.farmParcelIndex!==site.farmParcelIndex
      ||farm.x!==site.sourceCenter[0]||farm.y!==site.sourceCenter[1]
      ||!homeLand||!validFootprint(shape(homeLand))||!footprintFitsLot(shape(site.yard),shape(homeLand),0)
      ||!field||!validFootprint(shape(field.polygon))||!validFootprint(shape(site.house))||!validFootprint(shape(site.yard))
      ||!footprintFitsLot(shape(site.house),shape(site.yard),0)||!Number.isInteger(site.occupants)||site.occupants<1||site.occupants>8
      ||!Number.isFinite(path.width)||Math.abs(path.width-8)>1e-6
      ||path.points.length<2||path.points.some(p=>p.length!==2||!p.every(Number.isFinite))
      ||!occupiedStreetIds.includes(path.streetIndex)
      ||(path.sharedWithFarmId&&!known.has(path.sharedWithFarmId)))throw new Error('Rural artifact source identity or geometry is inconsistent.');
    const existing=fields.get(site.farmParcelIndex);
    if(existing&&existing.crop!==site.crop)throw new Error('Households sharing a source field must share its crop.');
    fields.set(site.farmParcelIndex,{farmParcelIndex:site.farmParcelIndex,polygon:copy(field.polygon),crop:site.crop});
    known.add(site.farmId);plotIds.add(site.plotId);streetIds.add(site.plotId);
    // Common is the existing lazy farm-family input. Inventing a wealthy style
    // here could add servants and change the family seen on the source map.
    plots.push({id:site.plotId,footprint:copy(site.house),role:'farm',storeys:1,
      pop:{buildingType:'farmstead',residential:true,occupants:site.occupants,homeId:site.farmId,district:'common'}});
    streets.push({id:site.plotId,centerline:copy(path.points),widthFt:path.width});
  }
  for(const declined of homesteads.declined){
    const matches=plan.farmsteads.filter(f=>f.id===declined.farmId),farm=matches[0];
    if(known.has(declined.farmId)||matches.length!==1||farm.occupants!==declined.occupants
      ||farm.farmParcelIndex!==declined.farmParcelIndex)throw new Error('Rural refused household identity is inconsistent.');
    known.add(declined.farmId);
  }
  if(known.size!==plan.farmsteads.length)throw new Error('Rural artifacts must retain every admitted or refused household intent.');
  return {plots,streets,sources:{layoutRecipe:'rural-family-v1',homesteads,fields:[...fields.values()]}};
}

/** Whole crop/decorative-prop footprints must clear reserved home ground.
 * Assigned farm work stock may use its own yard through the existing parcel
 * siting rules; this gate is for cultivation and unaffiliated scatter. */
export function clearsRuralHomeReservations(polygon:readonly FootprintPoint[],sources:RuralArtifactSources,marginFt=0,servingPlotId?:number):boolean{
  if(!validFootprint(polygon)||!Number.isFinite(marginFt)||marginFt<0)return false;
  // A recorded home's own work stock may occupy its yard, but never its
  // approach. A duplicate or unknown source cannot borrow that exception.
  if(servingPlotId!==undefined&&sources.homesteads.sites.filter(site=>site.plotId===servingPlotId).length!==1)return false;
  for(const site of sources.homesteads.sites){
    if(site.plotId!==servingPlotId&&footprintDistance(polygon,shape(site.yard))<=marginFt)return false;
    const path=site.approach;
    for(let i=1;i<path.points.length;i++){
      const a=path.points[i-1],b=path.points[i];
      if(footprintRouteDistance(polygon,{x:a[0],z:a[1]},{x:b[0],z:b[1]})<=path.width/2+marginFt)return false;
    }
    // The planner reserves square bends, wider at corners than a round cap.
    for(const [x,y]of path.points.slice(1,-1)){
      const r=path.width/2,cap:Pt[]=[[x-r,y-r],[x+r,y-r],[x+r,y+r],[x-r,y+r]];
      if(footprintDistance(polygon,shape(cap))<=marginFt)return false;
    }
  }return true;
}

/** A crop cell stays on its actual source strip as well as outside home ground. */
export function ruralCultivationFits(polygon:readonly FootprintPoint[],farmParcelIndex:number,sources:RuralArtifactSources,marginFt=0):boolean{
  const field=sources.fields.find(f=>f.farmParcelIndex===farmParcelIndex);
  return !!field&&footprintFitsLot(polygon,shape(field.polygon),marginFt)&&clearsRuralHomeReservations(polygon,sources,marginFt);
}
