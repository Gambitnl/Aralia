/** Actual native triangles must supply the same bed as the drawn component.
 * These controls do not qualify reference likeness, closed material or3Dwater. */
import {beforeAll,afterAll,describe,expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {getSistersCliffSurface} from '../riverSistersCliffSurface';
import {inspectNativeCliffPerimeter} from '../riverCliffFrame';
import {appendWaterfallCoreCollar} from '../riverWaterfallCliff';
import {nativeBoundaryEpochCurrent} from '../riverNativeBoundaryAtlas';
import {defaultRiverCourse,makeTerrainHeight,courseKeyAt} from '@/systems/world3d/river/riverReach';
import {setRiverHeadwaters} from '@/systems/world3d/river/riverHeadwaters';

describe('finite native Sisters land and hydraulic projection',()=>{
  let surface:ReturnType<typeof getSistersCliffSurface>;
  beforeAll(()=>{setRiverHeadwaters(true,true);surface=getSistersCliffSurface();},60000);
  afterAll(()=>setRiverHeadwaters(false));
  it('retains finite real geometry and explicitly refuses unsupported solid/water qualification',()=>{
    expect(surface.geometry.index!.count/3).toBeGreaterThan(100000);
    expect(surface.projectionEntries).toBeLessThanOrEqual(1000000);
    expect(surface.bounds.max.y).toBeLessThan(0);expect(nativeBoundaryEpochCurrent(surface.geometry)).toBe(true);
    expect(surface.geometry.userData.nativeBoundary).toMatchObject({owner:'rapids:seven-sisters',closedSolid:false,waterAdmission:false});
  });
  it('matches an independent downward ray against all stored native faces',()=>{
    const p=surface.geometry.getAttribute('position'),index=surface.geometry.index!,c=surface.crest;
    const ray=new THREE.Ray(),a=new THREE.Vector3(),b=new THREE.Vector3(),v=new THREE.Vector3(),hit=new THREE.Vector3();
    for(const n of [-65,-25,0,30,65])for(const f of [12,28,40]){
      const x=c.x+c.tx*f+c.tz*n,z=c.z+c.tz*f-c.tx*n;
      ray.origin.set(x,100,z);ray.direction.set(0,-1,0);let highest=-Infinity;
      for(let e=0;e<index.count;e+=3){
        a.fromBufferAttribute(p,index.getX(e));b.fromBufferAttribute(p,index.getX(e+1));v.fromBufferAttribute(p,index.getX(e+2));
        if(ray.intersectTriangle(a,b,v,false,hit))highest=Math.max(highest,hit.y);
      }
      expect(highest).toBeGreaterThan(-Infinity);expect(surface.heightAt(x,z)).toBeCloseTo(highest,7);
    }
  },60000);
  it('uses those actual triangles in the native terrain while preserving the original quiet channel',()=>{
    const course=defaultRiverCourse(),terrain=makeTerrainHeight(course,20260928),c=surface.crest;
    for(const n of [-60,-20,20,60])for(const f of [12,28,40]){
      const x=c.x+c.tx*f+c.tz*n,z=c.z+c.tz*f-c.tx*n;
      expect(terrain(x,z)).toBeCloseTo(surface.heightAt(x,z)!,7);
    }
    // Check actual original source/pool/quiet addresses against their native
    // baseline; a broad finite wall must not move their protected land.
    // The original shared fork already changes its north bank near s50;
    // the separated quiet reach begins beyond that existing junction.
    const points=[-200,-155,-120,70,120,220,300].flatMap(s=>[-.8,0,.8].map(side=>{
      const p=course.atCurve(s),n=courseKeyAt(s).halfW*side,x=p.x+p.tz*n,z=p.z-p.tx*n;return {x,z,y:terrain(x,z)};
    }));
    setRiverHeadwaters(true,false);const baseline=makeTerrainHeight(course,20260928);
    try{for(const p of points)expect(p.y).toBeCloseTo(baseline(p.x,p.z),8);}finally{setRiverHeadwaters(true,true);}
  });
  it('leaves outside land unowned and rejects corrupt coordinates',()=>{
    expect(surface.heightAt(surface.bounds.max.x+1,surface.bounds.max.z+1)).toBeUndefined();
    expect(()=>surface.heightAt(NaN,0)).toThrow(RangeError);
  });
  it('joins both actual cliff edges to the adjoining land without a tall collar wall',()=>{
    const terrain=makeTerrainHeight(defaultRiverCourse(),20260928),c=surface.crest;
    for(const f of [5,10,20,30,40])for(const sign of [-1,1]){
      const inside=surface.heightAt(c.x+c.tx*f+c.tz*89*sign,c.z+c.tz*f-c.tx*89*sign)!;
      const outside=terrain(c.x+c.tx*f+c.tz*91*sign,c.z+c.tz*f-c.tx*91*sign);
      // Two meters of actual rock/soil may have small relief; the former
      // curved bed differed from this straight native face by up to28meters.
      expect(Math.abs(outside-inside)).toBeLessThan(4);
    }
  });
  it('has the reference steep upper wall and broader foot in its actual triangle projection',()=>{
    const c=surface.crest;
    for(const n of [-80,0,80]){
      const at=(f:number)=>surface.heightAt(c.x+c.tx*f+c.tz*n,c.z+c.tz*f-c.tx*n)!;
      const upper=(at(4.5)-at(15.75))/11.25,lower=(at(31.5)-at(42.75))/11.25;
      expect(Number.isFinite(upper)&&Number.isFinite(lower)).toBe(true);
      expect(lower).toBeGreaterThan(0);expect(upper).toBeGreaterThan(lower*3);
    }
  });
  it('retains one finite outer perimeter without importing the source-specific attached blocks',()=>{
    const boundary=inspectNativeCliffPerimeter(surface.geometry);
    expect(boundary.branched).toBe(false);expect(boundary.loops).toHaveLength(1);
    expect(boundary.orientationConflicts).toBe(0);expect(boundary.nonManifoldEdges).toBe(0);
    expect(boundary.allEdgesPaired).toBe(false);
    expect(surface.geometry.userData.attachedSlabs).toHaveLength(0);
  });
  it('constructs the complete fine-grid perimeter without querying outside the finite cliff',()=>{
    const dx=.5,x0=Math.floor(surface.bounds.min.x/dx)*dx,z0=Math.floor(surface.bounds.min.z/dx)*dx;
    const nx=Math.ceil((surface.bounds.max.x-x0)/dx)+1,nz=Math.ceil((surface.bounds.max.z-z0)/dx)+1,mask=new Uint8Array(nx*nz);
    for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++)if(surface.coversQuad(x0+(i+1)*dx,z0+(j+1)*dx,dx))mask[j*nx+i]=1;
    let edges=0,elements=0;
    for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){
      const id=j*nx+i;if(!mask[id])continue;
      const corners=[[i+.5,j+.5],[i+1.5,j+.5],[i+1.5,j+1.5],[i+.5,j+1.5]],neighbors=[j>0?id-nx:-1,i<nx-2?id+1:-1,j<nz-2?id+nx:-1,i>0?id-1:-1];
      for(let e=0;e<4;e++)if(neighbors[e]<0||!mask[neighbors[e]]){
        const point=(p:number[])=>{const x=x0+p[0]*dx,z=z0+p[1]*dx;return new THREE.Vector3(x,Math.fround(surface.heightAt(x,z)!),z);};
        const positions:number[]=[];appendWaterfallCoreCollar(surface.sample,point(corners[e]),point(corners[(e+1)%4]),surface.crest,positions);
        edges++;elements+=positions.length/3;
      }
    }
    expect(edges).toBeGreaterThan(100);expect(elements).toBeGreaterThan(0);
  },60000);
});
