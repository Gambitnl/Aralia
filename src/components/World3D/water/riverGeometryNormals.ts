/** Rebuild water normals with Three's face order and Float32 rounding.
 * Native water uses plain indexed buffers; unfamiliar layouts retain Three's
 * general implementation. No vertices, faces or lighting inputs are dropped. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/10/2026, 10:29:33
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';

export function updateWaterGeometryNormals(geometry: THREE.BufferGeometry): void {
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),index=geometry.getIndex();
  const plain=(a:unknown):a is THREE.BufferAttribute=>a instanceof THREE.BufferAttribute&&(a.constructor===THREE.BufferAttribute||a.constructor===THREE.Float32BufferAttribute||a.constructor===THREE.Uint16BufferAttribute||a.constructor===THREE.Uint32BufferAttribute);
  if(!plain(position)||!plain(normal)||!plain(index)||position.itemSize!==3||normal.itemSize!==3||index.itemSize!==1
    ||position.normalized||normal.normalized||index.normalized||!(position.array instanceof Float32Array)||!(normal.array instanceof Float32Array)
    ||!(index.array instanceof Uint16Array||index.array instanceof Uint32Array)||normal.count!==position.count||index.count%3!==0
    ||position.array.buffer===normal.array.buffer){geometry.computeVertexNormals();return;}
  const p=position.array,n=normal.array,ix=index.array;
  n.fill(0);
  for(let i=0;i<ix.length;i+=3){
    const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
    const cbx=p[c]-p[b],cby=p[c+1]-p[b+1],cbz=p[c+2]-p[b+2];
    const abx=p[a]-p[b],aby=p[a+1]-p[b+1],abz=p[a+2]-p[b+2];
    const x=cby*abz-cbz*aby,y=cbz*abx-cbx*abz,z=cbx*aby-cby*abx;
    // Read all three old values before writing, matching Three even when a
    // degenerate face repeats an index. Every addition still rounds to Float32.
    const ax=n[a]+x,ay=n[a+1]+y,az=n[a+2]+z;
    const bx=n[b]+x,by=n[b+1]+y,bz=n[b+2]+z;
    const cx=n[c]+x,cy=n[c+1]+y,cz=n[c+2]+z;
    n[a]=ax;n[a+1]=ay;n[a+2]=az;n[b]=bx;n[b+1]=by;n[b+2]=bz;n[c]=cx;n[c+1]=cy;n[c+2]=cz;
  }
  for(let i=0;i<n.length;i+=3){
    const x=n[i],y=n[i+1],z=n[i+2],inverse=1/(Math.sqrt(x*x+y*y+z*z)||1);
    n[i]=x*inverse;n[i+1]=y*inverse;n[i+2]=z*inverse;
  }
  normal.needsUpdate=true;
}
