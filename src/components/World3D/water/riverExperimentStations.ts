/** Builds quiet, isolated study basins and wooden signs outside the river grid.
 * Only the selected frozen study is fetched and uploaded. Stored faces are
 * diagnostic evidence; this helper never advances or animates frozen water.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 11:20:35
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/World3D/water/RiverExperimentPanel.tsx, components/World3D/water/riverReachScene.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import {RIVER_EXPERIMENTS,type RiverExperimentCapture,type RiverExperimentDescriptor} from '@/systems/world3d/river/riverExperimentCatalog';
import type {RiverPose} from './riverReachScene';
import {RiverExperimentPool} from './riverExperimentPool';
import {buildRiverWaterGeometry,createRiverFlowTextures,createRiverWaterMaterial,type RiverWaterUniforms,type RiverWaterMaterial} from './riverWaterMaterial';
export interface ExperimentStationReading {
  id: string | null;
  loading: boolean;
  error: string | null;
  capture: RiverExperimentCapture | null;
  state: string | null;
  pool?: ReturnType<RiverExperimentPool['receipt']> & {cumulativeMapUploadMs:number;lastMapUploadMs:number};
  sourceIdentity?: Record<string,string>;
}
export class RiverExperimentStations {
  /** Reserved floor and the short camera approach, outside the river channel.
   * Actual plant footprints are tested against this rectangle after generation,
   * so the forest's random placement and original matrices remain unchanged. */
  static readonly clearing={minX:-71,maxX:-19,minZ:-124,maxZ:-82};
  static clearsFootprint(bounds:THREE.Box3):boolean{
    const area=this.clearing;
    return bounds.min.x<=area.maxX&&bounds.max.x>=area.minX&&bounds.min.z<=area.maxZ&&bounds.max.z>=area.minZ;
  }
  readonly group=new THREE.Group();
  private signs: THREE.Mesh[]=[];
  private textures: THREE.Texture[]=[];
  private selectedMesh: THREE.Mesh | null=null;
  private generation=0;
  private bases=new Map<string,THREE.Vector3>();
  private captures=new Map<string,RiverExperimentCapture>();
  private pool:RiverExperimentPool|null=null;
  private poolMesh:THREE.Mesh|null=null;
  private poolBed:THREE.Mesh|null=null;
  private poolWalls:THREE.Mesh[]=[];
  private poolTimer:ReturnType<typeof setInterval>|null=null;
  private poolFlow:ReturnType<typeof createRiverFlowTextures>|null=null;
  private poolMaterial:RiverWaterMaterial|null=null;
  private mapUploadMs=0;
  reading: ExperimentStationReading={id:null,loading:false,error:null,capture:null,state:null};
  constructor(groundAt:(x:number,z:number)=>number,private changed:(reading:ExperimentStationReading)=>void,private waterScene:THREE.Scene,private shared:RiverWaterUniforms){
    const timber=new THREE.MeshStandardMaterial({color:'#65482e',roughness:.95});
    const stone=new THREE.MeshStandardMaterial({color:'#8b8b7b',roughness:1});
    RIVER_EXPERIMENTS.forEach((study,k)=>{
      const x=-60+k*15,z=-112;
      const samples=[[-5,-4],[-5,4],[5,-4],[5,4],[0,0]].map(([dx,dz])=>groundAt(x+dx,z+dz)).filter(Number.isFinite);
      const y=Math.max(0,...samples)+1;
      this.bases.set(study.id,new THREE.Vector3(x,y,z));
      const box=(w:number,h:number,d:number,px:number,py:number,pz:number,material:THREE.Material)=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(px,py,pz);this.group.add(m);return m;
      };
      box(11,.6,9,x,y-.3,z,stone);
      box(11,.6,.25,x,y+.3,z-4.5,timber);box(11,.6,.25,x,y+.3,z+4.5,timber);
      box(.25,.6,9,x-5.5,y+.3,z,timber);box(.25,.6,9,x+5.5,y+.3,z,timber);
      // Keep the support behind the readable board; picking still uses the board mesh.
      box(.2,2,.2,x,y+1,z+4.85,timber);
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='#65482e';ctx.fillRect(0,0,512,192);
      ctx.strokeStyle='#92714b';for(let row=12;row<192;row+=19){ctx.beginPath();ctx.moveTo(0,row);ctx.lineTo(512,row-5);ctx.stroke();}
      ctx.fillStyle='#fff1cf';ctx.textAlign='center';ctx.font='bold 33px system-ui';ctx.fillText(study.name,256,69);
      ctx.font='23px system-ui';ctx.fillText(study.status,256,111);ctx.font='20px system-ui';ctx.fillText('Select sign to inspect',256,151);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.textures.push(texture);
      const sign=new THREE.Mesh(new THREE.BoxGeometry(4.8,1.8,.12),new THREE.MeshStandardMaterial({map:texture,roughness:1}));
      sign.position.set(x,y+2,z+5);sign.userData.experiment=study.id;this.group.add(sign);this.signs.push(sign);
    });
  }
  descriptor(id:string):RiverExperimentDescriptor|undefined{return RIVER_EXPERIMENTS.find(s=>s.id===id);}
  base(id:string):THREE.Vector3{return this.bases.get(id)!.clone();}
  pose(id?:string):RiverPose{
    const b=id?this.base(id):this.base('connected-basin');
    return id?{pos:[b.x+5,b.y+9,b.z+14],look:[b.x,b.y+1,b.z],fov:48}:{pos:[b.x,b.y+21,b.z+24],look:[b.x,b.y+1,b.z],fov:72};
  }
  pick(camera:THREE.Camera,x:number,y:number):string|null{
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),camera);
    return ray.intersectObjects(this.signs,false)[0]?.object.userData.experiment??null;
  }
  private clearMesh(){if(this.selectedMesh){this.group.remove(this.selectedMesh);this.selectedMesh.geometry.dispose();(this.selectedMesh.material as THREE.Material).dispose();this.selectedMesh=null;}}
  private notify(){this.changed({...this.reading});}
  private stopPool(){
    if(this.poolTimer!==null)clearInterval(this.poolTimer);this.poolTimer=null;this.pool?.dispose();this.pool=null;
    if(this.poolMesh){this.waterScene.remove(this.poolMesh);this.poolMesh.geometry.dispose();this.poolMesh=null;}
    this.poolMaterial?.material.dispose();this.poolMaterial=null;
    if(this.poolFlow)Object.values(this.poolFlow).forEach(texture=>texture.dispose());this.poolFlow=null;
    if(this.poolBed){this.group.remove(this.poolBed);this.poolBed.geometry.dispose();(this.poolBed.material as THREE.Material).dispose();this.poolBed=null;}
    for(const wall of this.poolWalls){this.group.remove(wall);wall.geometry.dispose();(wall.material as THREE.Material).dispose();}this.poolWalls=[];
  }
  private startPool(){
    const base=this.base('source-pool');this.pool=new RiverExperimentPool(base.x-3,base.z-2,base.y+.12);this.mapUploadMs=0;
    const positions:number[]=[],s=this.pool.solver,g=s.grid;
    for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++){
      const x=g.x0+i*g.dx,z=g.z0+j*g.dx,y=s.bed[j*g.nx+i];
      for(const p of [[x,y,z],[x,y,z+g.dx],[x+g.dx,y,z],[x+g.dx,y,z],[x,y,z+g.dx],[x+g.dx,y,z+g.dx]])positions.push(...p);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    this.poolBed=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#9f947a',roughness:.96,side:THREE.DoubleSide}));this.group.add(this.poolBed);
    // These three visible rims match the solver's closed boundary edges. The
    // east edge remains open over its actual raised bed sill.
    for(const [w,d,x,z]of [[.12,4,base.x-3.06,base.z],[6,.12,base.x,base.z-2.06],[6,.12,base.x,base.z+2.06]]){
      const wall=new THREE.Mesh(new THREE.BoxGeometry(w,.5,d),new THREE.MeshStandardMaterial({color:'#817b68',roughness:1}));wall.position.set(x,base.y+.35,z);this.poolWalls.push(wall);this.group.add(wall);
    }
    this.updatePoolSurface();
    // Only this selected pool owns a timer. Deselecting it removes both the
    // timer and its independent solver/material resources, without a worker.
    this.poolTimer=setInterval(()=>{
      if(!this.pool||!this.pool.running||document.hidden)return;
      try{this.pool.tick();this.updatePoolSurface();}catch(error){this.pool.failure=String(error);this.pool.setRunning(false);this.reading.error=String(error);this.notify();}
    },100);
  }
  private updatePoolSurface(){
    if(!this.pool)return;const start=performance.now(),map=this.pool.map();
    if(!this.poolFlow){
      this.poolFlow=createRiverFlowTextures(map);
      const {uTime,uFlow2,uFlow2Texel,uFlow2Cell,uGridOrigin,uGridSize,uMainRapidsOptics,uMainRapidsMask,uPoolImpactFrame,uPoolImpactEnergy,uPoolImpactLevel,...shared}=this.shared;
      // The existing opaque/reflection targets and optical values are reused.
      // Grid, current, depth, pool interactions and physical clock stay local.
      this.poolMaterial=createRiverWaterMaterial(map,this.poolFlow,shared);
      this.poolMesh=new THREE.Mesh(buildRiverWaterGeometry(map),this.poolMaterial.material);this.waterScene.add(this.poolMesh);
    }else{
      for(const [name,source]of [['flow0',map.t0],['flow1',map.t1],['flow2',map.t2]] as const){const texture=this.poolFlow[name],bytes=texture.image.data as Uint16Array;for(let k=0;k<source.length;k++)bytes[k]=THREE.DataUtils.toHalfFloat(Math.max(-60000,Math.min(60000,source[k])));texture.needsUpdate=true;}
      const previous=this.poolMesh!.geometry;this.poolMesh!.geometry=buildRiverWaterGeometry(map);previous.dispose();
    }
    this.poolMaterial!.uniforms.uTime.value=this.pool.solver.time;
    const lastMapUploadMs=performance.now()-start;this.mapUploadMs+=lastMapUploadMs;
    this.reading.pool={...this.pool.receipt(),cumulativeMapUploadMs:this.mapUploadMs,lastMapUploadMs};this.notify();
  }
  setPoolSource(on:boolean){this.pool?.setSource(on);this.updatePoolSurface();}
  setPoolRunning(on:boolean){this.pool?.setRunning(on);this.updatePoolSurface();}
  async select(id:string|null){
    const generation=++this.generation;this.clearMesh();this.stopPool();
    this.reading={id,loading:false,error:null,capture:null,state:null};this.notify();
    const study=id?this.descriptor(id):null;if(!study)return;
    if(study.mode==='live'){
      try{this.startPool();const response=await fetch(import.meta.env.BASE_URL+'assets/water-experiments/manifest.json');if(response.ok){const manifest=await response.json();if(generation===this.generation){this.reading.sourceIdentity=manifest.nativeSources;this.notify();}}}catch(error){if(generation===this.generation){this.stopPool();this.reading.error=String(error);this.notify();}}return;
    }
    try{
      this.reading.loading=true;this.notify();
      let capture=this.captures.get(id!);
      if(!capture){
        const base=import.meta.env.BASE_URL+'assets/water-experiments/';
        const manifestResponse=await fetch(base+'manifest.json');if(!manifestResponse.ok)throw Error('Capture manifest unavailable');
        const manifest=await manifestResponse.json(),asset=manifest.assets[id!];if(!asset)throw Error('Capture missing from manifest');
        const response=await fetch(base+asset.file);if(!response.ok)throw Error('Stored geometry unavailable');
        const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
        const actual=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
        if(actual!==asset.sha256)throw Error('Stored geometry identity mismatch');
        capture=JSON.parse(new TextDecoder().decode(bytes)) as RiverExperimentCapture;
        if(capture.id!==id)throw Error('Stored study identity mismatch');this.captures.set(id!,capture);
      }
      if(generation!==this.generation)return;
      this.reading={id,loading:false,error:null,capture,state:capture.states[0].id};this.showState(capture.states[0].id);
    }catch(error){if(generation===this.generation){this.reading.loading=false;this.reading.error=String(error);this.notify();}}
  }
  showState(id:string){
    const capture=this.reading.capture,study=this.reading.id?this.descriptor(this.reading.id):null,state=capture?.states.find(s=>s.id===id);if(!state||!study)return;
    this.clearMesh();const positions:number[]=[];
    // Reflect captured Z into the native scene and reverse each triangle's
    // winding with it, retaining the original outward boundary orientation.
    for(const piece of state.pieces)for(const face of piece)for(let j=1;j<face.length-1;j++)for(const p of [face[0],face[j+1],face[j]]){if(p.some(v=>!Number.isFinite(v)))throw Error('Invalid capture coordinate');positions.push(p[0],p[1],-p[2]);}
    if(!positions.length){this.reading.state=id;this.notify();return;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();
    // Keep one display origin for every saved state. Re-centering each rejected
    // mesh would visually hide the displacement that made the experiment fail.
    const bounds=new THREE.Box3();
    for(const piece of capture!.states[0].pieces)for(const face of piece)for(const p of face)bounds.expandByPoint(new THREE.Vector3(p[0],p[1],-p[2]));
    if(bounds.isEmpty())bounds.set(new THREE.Vector3(),new THREE.Vector3());
    const center=bounds.getCenter(new THREE.Vector3()),base=this.base(study.id);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:state.kind==='rejected'?'#e8a653':'#4a9da8',roughness:.48,side:THREE.DoubleSide}));
    mesh.scale.setScalar(study.displayScale);mesh.position.set(base.x-center.x*study.displayScale,base.y+.12-bounds.min.y*study.displayScale,base.z-center.z*study.displayScale);
    this.group.add(mesh);this.selectedMesh=mesh;this.reading.state=id;this.notify();
  }
  dispose(){++this.generation;this.stopPool();this.clearMesh();this.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});this.textures.forEach(t=>t.dispose());this.group.clear();}
}
