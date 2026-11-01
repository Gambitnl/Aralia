/** Displays one neighboring terrain test with the native river water pipeline.
 * Its solver owns the wet/air inventory; drawing never supplies extra water.
 * CPU stepping is deliberately explicit while the GPU port is unqualified.
 * This reuses optics, not the original waterfall's calibrated aeration plume.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 07:13:49
 * Dependents: components/World3D/water/waterfallTerrainComparisonView.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { RiverTerrainCourse } from '@/systems/world3d/river/riverTerrainCourse';
import { buildRiverWaterGeometry, createRiverFlowTextures, createRiverWaterMaterial, riverWaterGeometryFrom, type RiverWaterMaterial, type RiverWaterUniforms } from './riverWaterMaterial';
import { buildWaterSheetArrays, toHalfArray } from '@/systems/world3d/river/riverWaterSheet';
import { RiverSpillView, trimSpillSurface } from './riverSpillView';
import { terrainPointToWorld, terrainVectorToWorld, type RiverTerrainFrame } from '@/systems/world3d/river/riverTerrainFrame';

export class RiverTerrainCourseView {
  readonly group = new THREE.Group();
  readonly flow: ReturnType<typeof createRiverFlowTextures>;
  readonly material: RiverWaterMaterial;
  readonly mesh: THREE.Mesh;
  readonly spill: RiverSpillView;
  private lastWall = performance.now();
  private targetTime = 0;
  private lastMap = -Infinity;
  constructor(readonly course: RiverTerrainCourse, sharedUniforms: RiverWaterUniforms, readonly frame?:RiverTerrainFrame) {
    const map=course.map(); this.flow=createRiverFlowTextures(map);
    const {uTime,uFlow2,uFlow2Texel,uFlow2Cell,uGridOrigin,uGridSize,uMainRapidsOptics,uMainRapidsMask,uPoolImpactFrame,uPoolImpactEnergy,uPoolImpactLevel,...shared}=sharedUniforms;
    this.material=createRiverWaterMaterial(map,this.flow,shared,frame);
    this.mesh=new THREE.Mesh(this.worldGeometry(buildRiverWaterGeometry(map)),this.material.material); this.mesh.frustumCulled=false;
    this.spill=new RiverSpillView(this.material.uniforms);this.group.add(this.mesh,this.spill.mesh);
    this.group.name='Native river terrain test';
  }
  private worldGeometry(geometry:THREE.BufferGeometry):THREE.BufferGeometry {
    if(this.frame){const {origin,xAxis,zAxis}=this.frame;geometry.applyMatrix4(new THREE.Matrix4().set(xAxis[0],0,zAxis[0],origin[0],0,1,0,0,xAxis[1],0,zAxis[1],origin[1],0,0,0,1));}
    return geometry;
  }
  setRunning(on:boolean):void {this.course.running=on&&!this.course.failure;this.lastWall=performance.now();this.targetTime=this.course.solver.time;}
  tick():void {
    const now=performance.now(),elapsed=(now-this.lastWall)/1000;this.lastWall=now;
    if(this.course.running&&!document.hidden){
      // A resumed/hidden tab does not accrue an unbounded catch-up workload.
      // Every simulated second still consists of actual accepted native steps.
      this.targetTime+=Math.min(.1,elapsed);
      const started=performance.now();let steps=0;
      try{while(this.course.solver.time<this.targetTime&&steps<8&&performance.now()-started<4){this.course.step();steps++;}}
      catch{this.course.running=false;}
      if(steps&&now-this.lastMap>=250){this.updateSurface();this.lastMap=now;}
    }
    this.spill.update();
  }
  updateSurface():void {
    const map=this.course.map();
    // Use the same bulk half-float packer as the worker's native river maps.
    // It preserves the shader's exact clamped texture bits, while avoiding a
    // Three.js conversion call and nested clamps for every individual texel.
    for(const [name,source]of [['flow0',map.t0],['flow1',map.t1],['flow2',map.t2]] as const){const texture=this.flow[name];toHalfArray(source,texture.image.data as Uint16Array);texture.needsUpdate=true;}
    // Reuse native departure ownership: a submerged lip remains connected.
    // Display updates use the current accepted snapshot, not invented flux.
    const snapshot=this.course.spill.snapshot();
    const sheet=trimSpillSurface(buildWaterSheetArrays(map.grid,map.surface),map.grid,snapshot.exposedFaces);
    const previous=this.mesh.geometry;this.mesh.geometry=this.worldGeometry(riverWaterGeometryFrom(sheet));previous.dispose();
    this.material.uniforms.uTime.value=this.course.solver.time;
    // Physics stays in one local frame. Convert only the display receipt,
    // including the face span; rotating centers alone would change its volume.
    const f=this.frame;
    const packet=(p:typeof snapshot.packets[number])=>f?({...p,
      position:terrainPointToWorld(f,p.position),releasePosition:terrainPointToWorld(f,p.releasePosition),
      velocity:terrainVectorToWorld(f,p.velocity),releaseVelocity:terrainVectorToWorld(f,p.releaseVelocity),
      // Gravity plus the air's drag (2026-11-01): a vector, so it turns with the frame.
      ...(p.acceleration?{acceleration:terrainVectorToWorld(f,p.acceleration)}:{}),
      releaseAcross:terrainVectorToWorld(f,p.faceAxis==='x'?[0,0,1]:[-1,0,0]),
    }):p;
    this.spill.setSnapshot(f?{...snapshot,packets:snapshot.packets.map(packet),arrived:snapshot.arrived?.map(packet)}:snapshot);
  }
  dispose():void{this.setRunning(false);this.group.removeFromParent();this.mesh.geometry.dispose();this.material.material.dispose();Object.values(this.flow).forEach(t=>t.dispose());this.spill.dispose();}
}
