/** Carved altar stone, a linen runner and an open service book make the existing
 * altar readable as furniture. Everything stays attached to its canonical pick;
 * these shapes grant no item, inscription, faith, fuel or service of their own.
 * The conservative source collision stays unchanged. Geometry is merged once
 * per size and disposed when replaced, following the existing shelf renderer. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 20:17:36
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {SitePart} from '../../systems/worldforge/bridge/interiorParts';

type Shape = {at:[number,number,number]; size:[number,number,number]; color?:string; tilt?:number};
const DRESSING_MATERIAL = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88});

function altarShapes(w:number,h:number,d:number) {
  // Work along the altar's long axis. This respects rotated canonical furniture
  // without introducing a second orientation or changing the room's footprint.
  const width=Math.max(w,d),depth=Math.min(w,d),angle=w>=d?0:Math.PI/2;
  const stone:Shape[]=[
    {at:[0,-h*.44,0],size:[width,h*.12,depth]},
    {at:[0,-h*.05,0],size:[width*.64,h*.66,depth*.64]},
    {at:[0,h*.33,0],size:[width*.88,h*.10,depth*.88]},
    {at:[0,h*.44,0],size:[width,h*.12,depth]},
  ];
  const goods:Shape[]=[],top=h/2,clothWidth=width*.36;
  const add=(at:Shape['at'],size:Shape['size'],color:string,tilt?:number)=>goods.push({at,size,color,tilt});
  // The runner has no religious emblem: the generated faith remains the source
  // of the dedication read through the ordinary examination action.
  add([0,top+.004,0],[clothWidth,.008,depth*.98],'#c9bea3');
  for(const sign of [-1,1]) {
    add([0,top-h*.13,sign*depth*.492],[clothWidth,h*.26,.009],'#c9bea3');
    add([0,top-h*.23,sign*depth*.499],[clothWidth*.94,.018,.006],'#74604d');
  }
  const bookWidth=Math.min(.44,width*.36),bookDepth=Math.min(.32,depth*.62);
  const half=bookWidth*.48,tilt=.08;
  for(const sign of [-1,1]) {
    const x=sign*bookWidth*.25,rotation=-sign*tilt;
    add([x,top+.022,0],[half,.012,bookDepth],'#583d35',rotation);
    add([x,top+.042,0],[half*.95,.028,bookDepth*.94],'#e3d6b8',rotation);
    // Quiet page marks suggest a real book without revealing generated words,
    // inventing scripture or exposing knowledge before the player reads it.
    for(let line=0;line<8;line++) {
      const length=half*(line%3===2?.54:.74);
      add([x,top+.058,bookDepth*(line-3.5)*.09],[length,.0015,.003],'#8b7b64',rotation);
    }
  }
  add([0,top+.038,0],[bookWidth*.035,.035,bookDepth],'#6a493a');
  return {stone,goods,angle};
}

function geometry(shapes:Shape[],angle:number,colored=false) {
  const pieces=shapes.map(shape=>{
    const piece=new THREE.BoxGeometry(...shape.size).toNonIndexed();
    if(shape.tilt)piece.rotateZ(shape.tilt);
    piece.translate(...shape.at);piece.rotateY(angle);
    if(colored) {
      const color=new THREE.Color(shape.color),count=piece.getAttribute('position').count;
      const values=new Float32Array(count*3);
      for(let i=0;i<count;i++){values[i*3]=color.r;values[i*3+1]=color.g;values[i*3+2]=color.b;}
      piece.setAttribute('color',new THREE.BufferAttribute(values,3));
    }
    return piece;
  });
  const merged=mergeGeometries(pieces,false)??new THREE.BufferGeometry();
  for(const piece of pieces)piece.dispose();
  merged.computeBoundingBox();return merged;
}

export function AltarGeometry({part}:{part:SitePart}) {
  const mesh=useMemo(()=>{const model=altarShapes(part.w,part.h,part.d);return geometry(model.stone,model.angle);},[part.w,part.h,part.d]);
  useEffect(()=>()=>mesh.dispose(),[mesh]);
  return <primitive object={mesh} attach="geometry" dispose={null}/>;
}

export function AltarDressing({part}:{part:SitePart}) {
  const mesh=useMemo(()=>{const model=altarShapes(part.w,part.h,part.d);return geometry(model.goods,model.angle,true);},[part.w,part.h,part.d]);
  useEffect(()=>()=>mesh.dispose(),[mesh]);
  return <mesh name="world3d:altar-dressing" geometry={mesh} castShadow={false}>
    <primitive object={DRESSING_MATERIAL} attach="material" dispose={null}/>
  </mesh>;
}
