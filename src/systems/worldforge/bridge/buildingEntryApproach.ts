/** Street-to-entry support belongs to real structural parts. The source terrain,
 * foundation, floor and door stay in place; walking keeps its ordinary limits. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 06:06:42
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWorld } from './groundChunkLoader';
import type { SitePart } from './interiorParts';
import { STAIR_COLOR } from './interiorParts';
import { siteOrientationFromQuad, sitePartScenePosition } from './sitePartTransform';

type Building = GroundWorld['buildings'][number];
type Point = {x: number; z: number};
const TAG = 'entry-approach';
const TREAD = .28;
const MAX_RISER = .17;

/** Both shapes are convex source quads. Touching edges are permitted, but a
 * new stoop cannot consume a neighboring building's footprint. */
function overlaps(a: Point[], b: Point[]): boolean {
  for (const polygon of [a,b]) for (let i=0;i<polygon.length;i++) {
    const p=polygon[i],q=polygon[(i+1)%polygon.length],nx=q.z-p.z,nz=p.x-q.x;
    const pa=a.map(v=>v.x*nx+v.z*nz),pb=b.map(v=>v.x*nx+v.z*nz);
    if(Math.max(...pa)<=Math.min(...pb)+1e-7 || Math.max(...pb)<=Math.min(...pa)+1e-7)return false;
  }
  return true;
}

export function addBuildingEntryApproaches(
  buildings: Building[],
  surfaceYAt: (xM: number, zM: number) => number,
  canSupportAt: (xM: number, zM: number) => boolean = () => true,
): Building[] {
  return buildings.map(building=>{
    if(building.cornersM.length!==4 || building.parts.some(p=>p.tag===TAG))return building;
    const orientation=siteOrientationFromQuad(building.cornersM);
    const base=surfaceYAt(building.xM,building.zM);
    if(!Number.isFinite(base))return building;
    const world=(x:number,z:number):Point=>{
      const p=sitePartScenePosition({x,z,h:0},{groupX:building.xM,groupZ:building.zM,surfaceY:base,...orientation});
      return {x:p.x,z:p.z};
    };
    const additions:SitePart[]=[];
    for(const leaf of building.parts.filter(p=>p.door?.level===0)){
      const door=leaf.door!;
      if(Math.abs(door.swingX)+Math.abs(door.swingZ)!==1)continue;
      const nx=-door.swingX,nz=-door.swingZ,tx=-nz,tz=nx;
      const floor=building.parts.find(p=>p.walkSurface==='floor'&&Math.abs(p.baseY??0)<.3
        &&Math.abs(leaf.x-nx*.08-p.x)<=p.w/2+1e-7&&Math.abs(leaf.z-nz*.08-p.z)<=p.d/2+1e-7);
      if(!floor)continue;
      const top=base+(floor.baseY??0)+floor.h;
      // Find the actual outer foundation face beside this source opening.
      // Blueprint entries are on its inner edge, not outside the wall thickness.
      let face=0;
      for(const p of building.parts){
        if(p.tag!=='exterior'||(p.baseY??0)>0)continue;
        const along=(p.x-leaf.x)*tx+(p.z-leaf.z)*tz;
        const halfAlong=Math.abs(tx)*p.w/2+Math.abs(tz)*p.d/2;
        if(Math.abs(along)>halfAlong+1e-7)continue;
        face=Math.max(face,(p.x-leaf.x)*nx+(p.z-leaf.z)*nz+Math.abs(nx)*p.w/2+Math.abs(nz)*p.d/2);
      }
      if(face>1)continue;
      const landingEnd=Math.max(.65,face+.18),width=Math.max(1.15,door.axis==='x'?leaf.w:leaf.d);
      const point=(out:number,along=0)=>world(leaf.x+nx*out+tx*along,leaf.z+nz*out+tz*along);
      const contact=point(face+.3),gap=top-surfaceYAt(contact.x,contact.z);
      if(!Number.isFinite(gap)||gap<=.2)continue;
      let approach:SitePart[]|undefined;
      // Preserve the original modest stoop first. The inspected public Temple
      // needs a separate, guarded flight: its falling street defeats the old
      // six-tread/one-meter scope despite a clear landing. Other roles keep
      // that scope; neither profile changes the walking step or source grade.
      // Prefer the existing fully exposed stoop exactly. Soil-contact treads
      // are a second pass only for entrances the original derivation refused.
      const profiles=[{maxCount:6,maxRise:1,guarded:false},
        ...(building.role==='temple'?[{maxCount:8,maxRise:1.25,guarded:true}]:[])];
      for(const profile of profiles)for(const meetsSoil of [false,true])for(let count=1;count<=profile.maxCount&&!approach;count++){
        const end=landingEnd+count*TREAD;
        const bottomSamples=[-.5,0,.5].map(t=>point(end+.25,t*width));
        const bottom=Math.min(...bottomSamples.map(p=>surfaceYAt(p.x,p.z)));
        const rise=(top-bottom)/(count+1);
        if(!Number.isFinite(rise)||rise<=0||rise>MAX_RISER||top-bottom>profile.maxRise)continue;
        const boxes=[{near:-.06,far:landingEnd,top,kind:'landing' as const},
          ...Array.from({length:count},(_,i)=>({near:landingEnd+i*TREAD,far:landingEnd+(i+1)*TREAD,top:top-(i+1)*rise,kind:'tread' as const}))];
        const candidate:SitePart[]=[];let admitted=true;
        for(const box of boxes){
          const corners=[point(box.near,-width/2),point(box.near,width/2),point(box.far,width/2),point(box.far,-width/2)];
          const center=point((box.near+box.far)/2);
          const samples=[...corners,center],ground=samples.map(p=>surfaceYAt(p.x,p.z));
          if(ground.some(y=>!Number.isFinite(y))
            ||((!meetsSoil||box.kind==='landing')&&ground.some(y=>y>box.top-.005))
            ||samples.some(p=>!canSupportAt(p.x,p.z))
            ||buildings.some(other=>other!==building&&Math.hypot(other.xM-center.x,other.zM-center.z)<15
              &&other.cornersM.length===4&&overlaps(corners,other.cornersM))){admitted=false;break;}
          // On a sloping street, lower treads meet the existing soil before the
          // upper treads reach the landing. That is a supported stair, not a
          // reason to reject the whole entrance. Leave terrain untouched and
          // omit fully buried treads; the ordinary walker still owns step and
          // body-clearance admission. The landing must remain above all soil.
          if(box.kind==='tread'&&ground.every(y=>y>=box.top-.005))continue;
          const bottomY=Math.min(...ground)-.04,mid=(box.near+box.far)/2;
          candidate.push({x:leaf.x+nx*mid,z:leaf.z+nz*mid,
            w:door.axis==='x'?width:box.far-box.near,d:door.axis==='x'?box.far-box.near:width,
            h:box.top-bottomY,baseY:bottomY-base,colorHex:STAIR_COLOR,tag:TAG,
            walkSurface:box.kind,stairSolid:true});
        }
        if(admitted&&candidate.some(p=>p.walkSurface==='tread')){
          if(profile.guarded){
            // Shared beam metadata draws an actual sloped rail. Its conservative
            // collision box remains at the side, preserving a clear central
            // passage. Close-set posts also guard the exposed landing edges;
            // the door and bottom approach stay open for ordinary walking.
            const thickness=.04,side=width/2-thickness/2,hand=.95;
            const beam=(out0:number,out1:number,along:number,y0:number,y1:number)=>{
              const x0=leaf.x+nx*out0+tx*along,z0=leaf.z+nz*out0+tz*along;
              const x1=leaf.x+nx*out1+tx*along,z1=leaf.z+nz*out1+tz*along;
              candidate.push({x:(x0+x1)/2,z:(z0+z1)/2,w:Math.abs(x1-x0)+thickness,d:Math.abs(z1-z0)+thickness,
                h:Math.abs(y1-y0)+thickness,baseY:Math.min(y0,y1)-base-thickness/2,colorHex:STAIR_COLOR,tag:TAG,
                beam:{dx:x1-x0,dy:y1-y0,dz:z1-z0,thickness}});
            };
            for(const sign of [-1,1]){
              const along=sign*side;
              beam(-.04,landingEnd,along,top+hand,top+hand);
              beam(landingEnd,end,along,top+hand,top-count*rise+hand);
              const intervals=Math.ceil((end+.04)/.14);
              for(let i=0;i<=intervals;i++){
                const out=-.04+(end+.04)*i/intervals;
                const tread=out<landingEnd?0:Math.min(count,Math.floor((out-landingEnd)/TREAD)+1);
                const soil=point(out,along),postBase=Math.max(top-tread*rise,surfaceYAt(soil.x,soil.z));
                const rail=top+hand-Math.max(0,(out-landingEnd)/TREAD)*rise;
                if(rail>postBase)beam(out,out,along,postBase,rail);
              }
            }
          }
          approach=candidate;
        }
      }
      if(approach)additions.push(...approach);
    }
    // Existing source part objects stay intact and in order. Every consumer sees
    // the same added solids; no private render-only ramp or physics exception.
    return additions.length?{...building,parts:[...building.parts,...additions]}:building;
  });
}
