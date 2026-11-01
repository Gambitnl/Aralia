/** Captures a bounded diffuse probe when the party enters a source room.
 * The live torch, bodies and cutaway never enter a bake. A model/door change
 * discards the presentation cache and samples the actual scene again. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 00:18:51
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {useEffect, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {LightProbeGenerator} from 'three/addons/lights/LightProbeGenerator.js';
import {createDungeonBakeFixtures,type DungeonIndirectLight} from './dungeonIndirectLight';
import type {DungeonVisibilityUniforms} from './dungeonVisibilityMaterial';

export function DungeonIndirectLighting({light,sightline,playerPosition}:{
  light:DungeonIndirectLight;sightline:DungeonVisibilityUniforms;playerPosition?:{x:number;z:number};
}) {
  const {gl,scene}=useThree();
  const completed=useRef(new Set<number>()),busy=useRef(false),alive=useRef(true),frames=useRef(0);
  const pending=useRef<{slot:number;face:number;camera:THREE.CubeCamera;target:THREE.WebGLCubeRenderTarget;started:number;maxFaceMs:number;origin:string;fixtures:ReturnType<typeof createDungeonBakeFixtures>}|null>(null);
  const currentLight=useRef(light);currentLight.current=light;
  useEffect(()=>{completed.current.clear();frames.current=0;return()=>{pending.current?.target.dispose();pending.current?.fixtures.dispose();pending.current=null;};},[light]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useFrame((_state,delta)=>{
    if(!playerPosition||busy.current||(frames.current+=delta)<1.5)return;
    const {x:width,y:height}=light.uniforms.dungeonBounceSize.value;
    const x=Math.floor(playerPosition.x+width/2),y=Math.floor(playerPosition.z+height/2);
    const slot=x>=0&&y>=0&&x<width&&y<height?light.slots[y*width+x]:-1;
    const origin=playerPosition.x+':'+playerPosition.z;
    if(pending.current&&(pending.current.slot!==slot||pending.current.origin!==origin)) {
      pending.current.target.dispose();pending.current.fixtures.dispose();pending.current=null;
    }
    if(slot<0||completed.current.has(slot))return;
    if(!pending.current) {
      const target=new THREE.WebGLCubeRenderTarget(16,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,generateMipmaps:false});
      const camera=new THREE.CubeCamera(0.08,18,target);
      camera.position.copy(light.probes[slot].position);
      camera.coordinateSystem=gl.coordinateSystem;camera.updateCoordinateSystem();camera.updateMatrixWorld();
      const fixtures=createDungeonBakeFixtures(scene);scene.add(fixtures.group);
      pending.current={slot,face:0,camera,target,started:performance.now(),maxFaceMs:0,origin,fixtures};
    }
    const job=pending.current;
    const hidden:THREE.Object3D[]=[];
    const oldBackground=scene.background,oldFog=scene.fog,oldTone=gl.toneMapping;
    const oldSight=sightline.dungeonSightEnabled.value,oldBounce=light.uniforms.dungeonBounceStrength.value;
    const oldTarget=gl.getRenderTarget(),oldFace=gl.getActiveCubeFace(),oldMip=gl.getActiveMipmapLevel(),oldXR=gl.xr.enabled;
    const faceStarted=performance.now();
    try {
      scene.traverse(object=>{
        const source=object as THREE.Light;
        // Only fixed, shadowed fixtures contribute. This does not turn off or
        // move any source light in the ordinary frame, nor bake extra ambient.
        if(object.visible&&(object.userData.dungeonDynamic ||
          (source.isLight && !job.fixtures.lights.has(source as THREE.PointLight)))) {
          object.visible=false;hidden.push(object);
        }
      });
      scene.background=new THREE.Color(0);scene.fog=null;gl.toneMapping=THREE.NoToneMapping;
      sightline.dungeonSightEnabled.value=0;light.uniforms.dungeonBounceStrength.value=0;
      job.fixtures.group.visible=true;
      // One face per ordinary frame bounds the bake instead of synchronously
      // rendering six dungeon views at entry. Walking cancels a partial cube.
      gl.xr.enabled=false;
      gl.setRenderTarget(job.target,job.face);
      gl.render(scene,job.camera.children[job.face] as THREE.Camera);
    } catch(error) {
      console.warn('Dungeon indirect-light capture unavailable; existing direct lighting retained.',error);
      job.target.dispose();job.fixtures.dispose();pending.current=null;completed.current.add(slot);return;
    } finally {
      hidden.forEach(object=>{object.visible=true;});
      job.fixtures.group.visible=false;
      scene.background=oldBackground;scene.fog=oldFog;gl.toneMapping=oldTone;
      sightline.dungeonSightEnabled.value=oldSight;light.uniforms.dungeonBounceStrength.value=oldBounce;
      gl.setRenderTarget(oldTarget,oldFace,oldMip);gl.xr.enabled=oldXR;
    }
    job.maxFaceMs=Math.max(job.maxFaceMs,performance.now()-faceStarted);
    if(++job.face<6)return;
    pending.current=null;job.fixtures.dispose();busy.current=true;completed.current.add(slot);
    void LightProbeGenerator.fromCubeRenderTarget(gl,job.target).then(probe=>{
      if(!alive.current||currentLight.current!==light)return;
      light.publish(slot,probe.sh);
      // Read-only rendered proof; no setters or gameplay state are exposed.
      Object.assign(window,{__dungeonIndirectProbe:{roomId:light.probes[slot].roomId,
        samples:completed.current.size,bakeMs:performance.now()-job.started,maxFaceMs:job.maxFaceMs,
        coefficients:probe.sh.toArray(),fixedFixturesOnly:true}});
    }).catch(error=>console.warn('Dungeon indirect-light readback unavailable; direct lighting retained.',error))
      .finally(()=>{job.target.dispose();busy.current=false;});
  });
  return null;
}
