/** The landscape brush follows the native ground under the pointer.
 * It draws a contour ring in the existing overlay and picks the same sampled
 * terrain used by the river view. It owns no land or water state. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/10/2026, 03:44:34
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import type {RiverReachView} from './riverReachScene';

export class RiverTerrainBrushView {
  readonly scene=new THREE.Scene();
  private readonly positions=new Float32Array(128*3);
  private readonly geometry=new THREE.BufferGeometry();
  private readonly material=new THREE.MeshBasicMaterial({color:0x7dd3fc,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  private readonly ring:THREE.Mesh;
  constructor(private readonly view:RiverReachView){
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
    // A narrow triangle band stays visible on the native WebGPU output.
    const indices:number[]=[];
    for(let k=0;k<64;k++){const a=k*2,b=((k+1)%64)*2;indices.push(a,a+1,b,a+1,b+1,b);}
    this.geometry.setIndex(indices);
    this.ring=new THREE.Mesh(this.geometry,this.material);this.ring.frustumCulled=false;this.ring.visible=false;this.scene.add(this.ring);
  }
  hide():void{this.ring.visible=false;}
  show(x:number,z:number,radius:number):void{
    for(let k=0;k<64;k++){
      const angle=k/64*Math.PI*2,halfWidth=Math.max(.06,Math.min(.2,radius*.02));
      for(let side=0;side<2;side++){
        const d=radius+(side?1:-1)*halfWidth,px=x+Math.cos(angle)*d,pz=z+Math.sin(angle)*d;
        this.positions.set([px,this.view.groundAt(px,pz)+.15,pz],(k*2+side)*3);
      }
    }
    this.geometry.getAttribute('position').needsUpdate=true;this.ring.visible=true;
  }
  /** March only inside the native landscape, then bisect the first ground
   * contact. A horizontal edit plane would paint through hills or miss cliffs. */
  pick(px:number,py:number,width:number,height:number):{x:number;z:number}|null{
    const camera=this.view.camera,origin=camera.position,dir=new THREE.Vector3(px/width*2-1,1-py/height*2,.5).unproject(camera).sub(origin).normalize(),outer=this.view.data.outer;
    let previous=0,t=camera.near;
    const inside=(x:number,z:number)=>x>=outer.x0&&z>=outer.z0&&x<=outer.x0+(outer.nx-1)*outer.step&&z<=outer.z0+(outer.nz-1)*outer.step;
    for(let k=0;k<768&&t<=camera.far;k++){
      const x=origin.x+dir.x*t,z=origin.z+dir.z*t,y=origin.y+dir.y*t,delta=y-this.view.groundAt(x,z);
      if(inside(x,z)&&delta<=.02){
        let lo=previous,hi=t;
        for(let q=0;q<18;q++){const m=(lo+hi)/2,mx=origin.x+dir.x*m,mz=origin.z+dir.z*m;
          if(origin.y+dir.y*m>this.view.groundAt(mx,mz))lo=m;else hi=m;}
        return {x:origin.x+dir.x*hi,z:origin.z+dir.z*hi};
      }
      previous=t;t+=Math.max(.25,Math.min(20,Math.abs(delta)*.5));
    }
    return null;
  }
  dispose():void{this.geometry.dispose();this.material.dispose();}
}
