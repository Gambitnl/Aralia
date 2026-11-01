/** Camera-independent construction. Old revisions are terminated by the
 * owner; only a complete matching revision may replace the GPU light field. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 06:14:36
 * Dependents: components/World3D/water/riverBoundaryWorkerCache.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Box3, BufferAttribute, BufferGeometry, Color, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { RiverBoundaryLightCache, sampleWaterfallRockAlbedo, type BoundarySurfaceSampler } from './riverBoundaryLight';
import type { BoundaryWorkerRequest } from './riverBoundaryWorkerCache';
const scope=self as unknown as {onmessage:(event:MessageEvent<BoundaryWorkerRequest>)=>void;postMessage:(message:unknown,transfer?:Transferable[])=>void};
scope.onmessage=event=>{
  try {
    const request=event.data;
    const meshes=request.meshes.map(data=>{
      const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(data.positions,3));
      if(data.normals)geometry.setAttribute('normal',new BufferAttribute(data.normals,3));if(data.indices)geometry.setIndex(new BufferAttribute(data.indices,1));if(data.tones)geometry.setAttribute('rockTone',new BufferAttribute(data.tones,1));
      geometry.setDrawRange(data.drawStart,data.drawCount);const material=new MeshBasicMaterial();const surface=data.surface;
      const sampler:BoundarySurfaceSampler={supports:()=>true,sample(hit){
        if(surface.kind==='plain')return{albedo:new Color(...surface.color),normal:hit.normal.clone()};
        const tone=data.tones?hit.indices.reduce((sum,i,k)=>sum+data.tones![i]*hit.barycentric.getComponent(k),0):1;
        return{albedo:sampleWaterfallRockAlbedo(surface.pixels,hit.point,hit.normal,tone,surface.diagnostic),normal:hit.normal.clone()};
      }};
      material.userData.boundarySurfaceSampler=sampler;const mesh=new Mesh(geometry,material);mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(data.matrix);return mesh;
    });
    const cache=new RiverBoundaryLightCache();cache.configure(meshes,request.revision,new Box3(new Vector3().fromArray(request.bounds),new Vector3().fromArray(request.bounds,3)),new Vector3().fromArray(request.sun));
    let lastReport=0;
    const advance=()=>{
      try{
        // This runs off the camera thread. Longer batches reduce browser
        // timer delays without changing ray order or the completed light field.
        // Main-thread geometry copying keeps its separate 2 ms budget.
        cache.step(32);const receipt=cache.receipt();
        if(receipt.error){scope.postMessage({error:receipt.error,receipt});return;}
        if(receipt.ready){scope.postMessage({receipt,horizon:cache.horizon,zenith:cache.zenith,sun:cache.sun},[cache.horizon.buffer,cache.zenith.buffer,cache.sun.buffer]);return;}
        if(performance.now()-lastReport>500){scope.postMessage({receipt});lastReport=performance.now();}
        setTimeout(advance,0);
      }catch(error){scope.postMessage({error:String(error)});}
    };
    setTimeout(advance,0);
  }catch(error){scope.postMessage({error:String(error)});}
};
