/** Moves actual-triangle tree construction and light rays off the camera
 * thread. Geometry and scan copies yield in small pieces; their observed
 * cost is reported, not represented as a hard real-time scheduling guarantee. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 06:14:36
 * Dependents: components/World3D/water/riverBoundaryLight.worker.ts, components/World3D/water/riverWaterfallView.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Box3, Mesh, Object3D, Vector3 } from 'three';
import { BOUNDARY_LIGHT, type BoundarySurfaceData, type BoundarySurfaceSampler } from './riverBoundaryLight';

export interface BoundaryWorkerPort {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}
let workerFactory: () => BoundaryWorkerPort = () => new Worker(new URL('./riverBoundaryLight.worker.ts', import.meta.url), { type: 'module' });
/** Disposable proof bundles can supply their separately bundled worker URL.
 * Native Vite resolves the default URL. Set before constructing the view. */
export function setRiverBoundaryWorkerFactory(factory: () => BoundaryWorkerPort): void { workerFactory = factory; }
export interface BoundaryMeshTransfer {
  positions: Float32Array; normals: Float32Array | null; tones: Float32Array | null; indices: Uint32Array | null;
  matrix: number[]; drawStart: number; drawCount: number; surface: BoundarySurfaceData;
}
export interface BoundaryWorkerRequest { meshes: BoundaryMeshTransfer[]; bounds: number[]; sun: number[]; revision: string | number; }
type Source = { mesh: Mesh; sampler?: BoundarySurfaceSampler; plain?: readonly [number,number,number] };
type Copy = { from: { count: number; getX(i:number):number; getY(i:number):number; getZ(i:number):number }; to: Float32Array | Uint32Array; size: number; cursor: number };
type PixelCopy = { from: Uint8ClampedArray; to: Uint8ClampedArray; cursor: number };
const LENGTH=BOUNDARY_LIGHT.x*BOUNDARY_LIGHT.y*BOUNDARY_LIGHT.z*BOUNDARY_LIGHT.directions*4;
export class RiverBoundaryWorkerCache {
  horizon:Uint16Array=new Uint16Array(LENGTH);zenith:Uint16Array=new Uint16Array(LENGTH);sun:Uint16Array=new Uint16Array(LENGTH);version=0;
  private worker:BoundaryWorkerPort|null=null;private generation=0;private revision:string|number='none';private request:BoundaryWorkerRequest|null=null;
  private sources:Source[]=[];private sourceIndex=0;private copies:Copy[]=[];private pixels:PixelCopy|null=null;
  private prepared=false;private completed=false;private started=0;private setupMs=0;private mainCopyMs=0;private maximumMainSliceMs=0;private transferMs=0;private geometryBytes=0;private pixelBytes=0;
  private unsupportedMeshes=0;private error:string|null=null;private workerReceipt:Record<string,unknown>={};
  configure(roots:readonly Object3D[],revision:string|number,bounds:Box3,sun:Vector3,sampler?:BoundarySurfaceSampler):void {
    this.worker?.terminate();this.worker=null;const generation=++this.generation,start=performance.now();
    this.revision=revision;this.started=start;this.completed=false;this.prepared=false;this.error=null;this.sources=[];this.sourceIndex=0;this.copies=[];this.pixels=null;this.mainCopyMs=0;this.maximumMainSliceMs=0;this.transferMs=0;this.geometryBytes=0;this.pixelBytes=0;this.unsupportedMeshes=0;this.workerReceipt={};
    this.request={meshes:[],bounds:[...bounds.min.toArray(),...bounds.max.toArray()],sun:sun.toArray(),revision};
    const seen=new Set<Mesh>(),preparation=new Set<BoundarySurfaceSampler>();
    for(const root of roots)root.traverse(object=>{
      if(!(object instanceof Mesh)||seen.has(object))return;seen.add(object);
      let parent:Object3D|null=object;while(parent){if(!parent.visible)return;parent=parent.parent;}
      if(Array.isArray(object.material)){this.unsupportedMeshes++;return;}
      const material=object.material;if(material.transparent)return;
      const own=material.userData.boundarySurfaceSampler as BoundarySurfaceSampler|undefined;
      const selected=sampler?.supports(object)?sampler:own?.supports(object)?own:undefined;
      object.updateWorldMatrix(true,false);
      if(selected){if(!selected.serialize){this.unsupportedMeshes++;return;}this.sources.push({mesh:object,sampler:selected});preparation.add(selected);}
      else if('color' in material&&!('colorNode' in material&&material.colorNode)&&!('map' in material&&material.map)) {
        const c=material.color as {r:number;g:number;b:number};this.sources.push({mesh:object,plain:[c.r,c.g,c.b]});
      } else this.unsupportedMeshes++;
    });
    this.setupMs=performance.now()-start;
    Promise.all([...preparation].map(s=>s.prepare?.())).then(()=>{if(generation===this.generation)this.prepared=true;}).catch(e=>{if(generation===this.generation)this.error=String(e);});
  }
  private queue(source:Source):void {
    const g=source.mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),tone=source.mesh.material;
    const t=!Array.isArray(tone)&&tone.userData.boundaryUsesRockTone?g.getAttribute('rockTone'):null;
    const add=(attribute:typeof p|null,size:number,index=false)=>{
      if(!attribute)return null;const to=index?new Uint32Array(attribute.count*size):new Float32Array(attribute.count*size);
      this.copies.push({from:attribute,to,size,cursor:0});this.geometryBytes+=to.byteLength;return to;
    };
    const surface:BoundarySurfaceData=source.sampler?{...source.sampler.serialize!(source.mesh)}:{kind:'plain',color:source.plain!};
    if(surface.kind==='cliff') {
      // One shared scan copy serves every cliff mesh in this bake.
      const previous=this.request!.meshes.find(m=>m.surface.kind==='cliff');
      if(previous&&previous.surface.kind==='cliff')surface.pixels=previous.surface.pixels;
      else {
        const copied=new Uint8ClampedArray(surface.pixels.data.length);this.pixelBytes=copied.byteLength;
        this.pixels={from:surface.pixels.data,to:copied,cursor:0};surface.pixels={width:surface.pixels.width,height:surface.pixels.height,data:copied};
      }
    }
    this.request!.meshes.push({positions:add(p,3) as Float32Array,normals:add(n??null,3) as Float32Array|null,tones:add(t??null,1) as Float32Array|null,indices:add(g.index,1,true) as Uint32Array|null,matrix:source.mesh.matrixWorld.toArray(),drawStart:g.drawRange.start,drawCount:g.drawRange.count,surface});
  }
  step(budgetMs:number=BOUNDARY_LIGHT.sliceMs):void {
    if(this.worker||this.completed||!this.prepared||this.error||!this.request)return;
    const start=performance.now();let work=0;
    while(performance.now()-start<budgetMs||work===0) {
      work++;
      if(this.copies.length){const copy=this.copies[this.copies.length-1],end=Math.min(copy.from.count,copy.cursor+256);
        for(;copy.cursor<end;copy.cursor++){const i=copy.cursor;copy.to[i*copy.size]=copy.from.getX(i);if(copy.size===3){copy.to[i*3+1]=copy.from.getY(i);copy.to[i*3+2]=copy.from.getZ(i);}}
        if(copy.cursor===copy.from.count)this.copies.pop();continue;
      }
      if(this.pixels){const p=this.pixels,end=Math.min(p.from.length,p.cursor+8192);p.to.set(p.from.subarray(p.cursor,end),p.cursor);p.cursor=end;if(end===p.from.length)this.pixels=null;continue;}
      const source=this.sources[this.sourceIndex++];if(source){this.queue(source);continue;}
      const generation=this.generation;let worker:BoundaryWorkerPort;
      try{worker=workerFactory();}catch(e){this.error=String(e);break;}
      this.worker=worker;
      worker.onmessage=event=>{
        if(generation!==this.generation)return;
        const message=event.data as {receipt?:Record<string,unknown>;error?:string;horizon?:Uint16Array;zenith?:Uint16Array;sun?:Uint16Array};
        if(message.receipt)this.workerReceipt=message.receipt;
        if(message.error){this.error=message.error;worker.terminate();return;}
        if(message.horizon&&message.zenith&&message.sun){this.horizon=message.horizon;this.zenith=message.zenith;this.sun=message.sun;this.completed=true;this.version++;worker.terminate();this.request=null;this.sources=[];}
      };
      worker.onerror=event=>{if(generation===this.generation)this.error=event.message;worker.terminate();};
      const buffers=new Set<ArrayBuffer>();for(const mesh of this.request.meshes){for(const array of [mesh.positions,mesh.normals,mesh.tones,mesh.indices])if(array)buffers.add(array.buffer as ArrayBuffer);if(mesh.surface.kind==='cliff')buffers.add(mesh.surface.pixels.data.buffer as ArrayBuffer);}
      const transferStart=performance.now();worker.postMessage(this.request,[...buffers]);this.transferMs=performance.now()-transferStart;break;
    }
    const elapsed=performance.now()-start;this.mainCopyMs+=elapsed;this.maximumMainSliceMs=Math.max(this.maximumMainSliceMs,elapsed);
  }
  receipt(){return{...this.workerReceipt,ready:this.completed,prepared:this.prepared,revision:this.revision,probes:576,directions:12,textureBytes:this.horizon.byteLength+this.zenith.byteLength+this.sun.byteLength,unsupportedMeshes:this.unsupportedMeshes,setupMs:this.setupMs,mainCopyMs:this.mainCopyMs,maximumMainSliceMs:this.maximumMainSliceMs,transferMs:this.transferMs,geometryBytes:this.geometryBytes,pixelTransferBytes:this.pixelBytes,error:this.error,elapsedMs:this.started?performance.now()-this.started:0,scope:'cliff-only by default; terrain/native rocks unrepresented',approximation:'one-bounce Lambert; 12-direction quadrature; geometric rock normal; base-level scan filtering; no water attenuation'};}
  dispose():void{this.generation++;this.worker?.terminate();this.worker=null;this.request=null;this.sources=[];}
}
