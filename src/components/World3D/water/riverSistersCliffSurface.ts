/**
 * The Sisters cliff is real finite native rock, shared by land drawing and
 * the river's bed. Its continuous fractured planes replace the
 * smooth height-field wall. A vertical ray through THESE stored triangles
 * supplies the current shallow-water solver's upper-ground approximation.
 *
 * This is an authored reference reconstruction, not surveyed geometry.
 * Its underside and overhang are drawn, but the2.5Dwater cannot detach into
 * airborne sheets or occupy space beneath an overhang. Ground collars and
 * material closure still need their separate finite-solid qualification.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/10/2026, 05:21:17
 * Dependents: components/World3D/water/riverReachScene.ts, systems/world3d/river/riverHeadwaters.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import {buildWaterfallCliffGeometry} from './riverWaterfallCliff';
import {RiverCliffFrame,poseNativeCliff} from './riverCliffFrame';
import {bindNativeBoundaryEpoch} from './riverNativeBoundaryAtlas';
import {defaultRiverCourse,RIVER_SHAPE_DEFAULT} from '@/systems/world3d/river/riverReach';
import {WATERFALL,headwaterKey,MAIN_CHANNEL_S} from '@/systems/world3d/river/riverHeadwaters';
import {RECONSTRUCTION_FALLS,reconstructedRapidsAt,reconstructionCrossHeight} from '@/systems/world3d/river/riverRapidsReconstruction';
import {reconstructionSistersForward,reconstructionSistersRelief} from '@/systems/world3d/river/riverReconstructionRock';

const unit=(v:number)=>Math.max(0,Math.min(1,v));
let retained:ReturnType<typeof buildSistersCliffSurface>|undefined;
export function getSistersCliffSurface(){return retained??=buildSistersCliffSurface();}

function buildSistersCliffSurface(){
  const f=RECONSTRUCTION_FALLS[1],course=defaultRiverCourse(),crest=reconstructedRapidsAt(f.startM);
  const crestY=headwaterKey(MAIN_CHANNEL_S+f.startM)!.thalweg,toeY=headwaterKey(MAIN_CHANNEL_S+f.endM)!.thalweg;
  const verticalScale=(crestY-toeY)/(WATERFALL.crestBed+4),lateralScale=f.halfWidthM/144;
  const core=buildWaterfallCliffGeometry({seed:20260928,shape:RIVER_SHAPE_DEFAULT,course,attachedSlabs:false,
    surfacePoint:({lateral,fraction})=>{
      const n=lateral*lateralScale,drop=1-fraction,edge=Math.sin(Math.PI*fraction)**.7;
      const along=reconstructionSistersForward(drop,n)*f.runM;
      const wet=reconstructionCrossHeight(f.startM+along,n,f.halfWidthM),groove=1-unit((wet+.35)/1.8);
      const top=reconstructionCrossHeight(f.startM,n,f.halfWidthM);
      // Recess the worn route by45cm vertically. A2.3m horizontal recess
      // on this steep wall formerly turned into a manufactured deep slot.
      const y=-4+(WATERFALL.crestBed+4)*fraction+(top*fraction**3-.45*groove*edge)/verticalScale;
      const frameDrop=(WATERFALL.crestBed-y)/(WATERFALL.crestBed+4);
      const lateralFade=unit((f.halfWidthM-Math.abs(n))/8);
      // Remove the frame's linear shear before installing the reference's
      // steep upper planes and broader foot. Its actual triangles still
      // provide the native bed; both outer side edges meet the same section.
      return {forward:along-f.runM*frameDrop+edge*lateralFade*reconstructionSistersRelief(n,drop),y};
    }});
  const placed=poseNativeCliff(core,new RiverCliffFrame({owner:'rapids:seven-sisters',source:course.at(WATERFALL.crestS),target:crest,
    sourceFloorY:-4,sourceCrestY:WATERFALL.crestBed,targetFloorY:toeY,targetCrestY:crestY,
    lateralScale,forwardScale:1,runM:f.runM}));
  core.dispose();const geometry=placed.geometry,p=geometry.getAttribute('position'),index=geometry.index!;
  const uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    uv[i*2]=((p.getX(i)-crest.x)*crest.tz-(p.getZ(i)-crest.z)*crest.tx)/2.4;
    uv[i*2+1]=p.getY(i)/2.4;
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.computeBoundingBox();
  const bounds=geometry.boundingBox!,step=4,nx=Math.ceil((bounds.max.x-bounds.min.x)/step)+1,nz=Math.ceil((bounds.max.z-bounds.min.z)/step)+1;
  const bins=Array.from({length:nx*nz},()=>[] as number[]);let entries=0;
  for(let e=0;e<index.count;e+=3){
    const ids=[index.getX(e),index.getX(e+1),index.getX(e+2)],xs=ids.map(i=>p.getX(i)),zs=ids.map(i=>p.getZ(i));
    const i0=Math.max(0,Math.floor((Math.min(...xs)-bounds.min.x)/step)),i1=Math.min(nx-1,Math.floor((Math.max(...xs)-bounds.min.x)/step));
    const j0=Math.max(0,Math.floor((Math.min(...zs)-bounds.min.z)/step)),j1=Math.min(nz-1,Math.floor((Math.max(...zs)-bounds.min.z)/step));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      if(++entries>1000000)throw Error('Sisters triangle projection exceeds bounded capacity');bins[j*nx+i].push(e);
    }
  }
  const heightAt=(x:number,z:number):number|undefined=>{
    if(!Number.isFinite(x)||!Number.isFinite(z))throw RangeError('Nonfinite Sisters ground query');
    if(x<bounds.min.x||x>bounds.max.x||z<bounds.min.z||z>bounds.max.z)return undefined;
    const i=Math.floor((x-bounds.min.x)/step),j=Math.floor((z-bounds.min.z)/step);let highest=-Infinity;
    for(const e of bins[j*nx+i]){
      const a=index.getX(e),b=index.getX(e+1),c=index.getX(e+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
      const determinant=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(determinant===0)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/determinant,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/determinant;
      if(u<0||v<0||u+v>1)continue;
      highest=Math.max(highest,u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c));
    }
    return highest===-Infinity?undefined:highest;
  };
  // A removed terrain quad must have native coverage at every corner. A
  // center-only test left its join endpoint outside the finite cliff edge.
  const coversQuad=(x:number,z:number,dx:number)=>heightAt(x,z)!==undefined&&
    [-.5,.5].every(a=>[-.5,.5].every(b=>heightAt(x+a*dx,z+b*dx)!==undefined));
  geometry.userData.sistersNative=true;
  bindNativeBoundaryEpoch(geometry,{...geometry.userData.nativeBoundary,owner:'rapids:seven-sisters',
    reconstruction:'authored-reference-masses-v3',hydraulics:'upper-native-triangle-height-field',
    closedSolid:false,groundJoins:'unqualified',waterAdmission:false});
  return {...placed,crest,bounds,heightAt,coversQuad,projectionEntries:entries};
}
