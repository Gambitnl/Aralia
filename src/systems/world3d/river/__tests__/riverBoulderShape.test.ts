import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boulderBounds, boulderTopAt, mainBoulderShape, mulberry32, valueNoise, type Boulder } from '../riverReach';
import { createBoulderShapeCache } from '../riverBoulderShape';
import { MAIN_CHANNEL_S } from '../riverHeadwaters';
import { buildFlowMap } from '../riverFlowField';

const rock = (seed = 447733920): Boulder => ({ x: 66.45507, y: 1.54, z: 10.11063,
  rx: 1.12, ry: 1.00363477, rz: 0.91, rot: 0.71, seed, s: MAIN_CHANNEL_S + 92, inChannel: true });

/** Independent existing THREE renderer oracle; this is the pre-shared rock path. */
function rendered(b: Boulder) {
  const raw = new THREE.IcosahedronGeometry(1,Math.max(b.rx,b.rz) >= .8 ? 3 : 2);
  raw.deleteAttribute('normal'); raw.deleteAttribute('uv');
  const g = mergeVertices(raw,1e-4), p = g.getAttribute('position'), out = new Float32Array(p.array.length);
  const v = new THREE.Vector3(), rr = mulberry32(b.seed ^ 0x2c1b), cuts: number[][] = [];
  const n = 4 + Math.floor(rr()*4), flat = ((b.seed >>> 3)%5) === 0 ? .55 : 1;
  for (let i = 0; i < n; i++) {
    const th = rr()*Math.PI*2, ph = Math.acos(rr()*1.6-.6);
    cuts.push([Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th),.45+.35*rr()]);
  }
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p,k);
    for (const [x,y,z,d] of cuts) {
      const dp = v.x*x+v.y*y+v.z*z;
      if (dp > d) { const back = (dp-d)*.92; v.x-=x*back; v.y-=y*back; v.z-=z*back; }
    }
    const bump = 1+.14*valueNoise(v.x*1.4+b.seed%97,v.z*1.4+v.y*1.2,b.seed&0xffff)
      +.05*valueNoise(v.x*4.5+v.y*2.5,v.z*4.5,(b.seed>>3)&0xffff);
    const x=v.x*b.rx*bump,z=v.z*b.rz*bump;
    let y=v.y*b.ry*bump;
    if (y<0) y*=.6; else if(y>b.ry*flat) y=b.ry*flat+(y-b.ry*flat)*.15;
    out[k*3]=b.x+(x*Math.cos(b.rot)-z*Math.sin(b.rot)); out[k*3+1]=b.y+y;
    out[k*3+2]=b.z+(x*Math.sin(b.rot)+z*Math.cos(b.rot));
  }
  const indices = Array.from(g.index!.array);
  raw.dispose(); g.dispose();
  return { positions: out, indices };
}

describe('main rock mesh authority', () => {
  it('matches every rendered Float32 vertex and index across both detail levels and flat tops', () => {
    for (const seed of [447733920,295799600,102463419,267574660,331829731,0,8,17,987654]) {
      for (const r of [.6,1.12]) {
        const b = {...rock(seed), rx:r, rz:r*.8}, a=mainBoulderShape(b), old=rendered(b);
        expect(Array.from(a.positions)).toEqual(Array.from(old.positions));
        expect(Array.from(a.indices)).toEqual(old.indices);
      }
    }
  });
  it('agrees with independent THREE vertical triangle rays, including edges and outside holes', () => {
    for (const seed of [447733920,295799600,331829731]) {
      const b=rock(seed), shape=mainBoulderShape(b), old=rendered(b);
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(old.positions,3)); g.setIndex(old.indices);
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
      const ray=new THREE.Raycaster();
      for(let j=0;j<=20;j++) for(let i=0;i<=20;i++) {
        const x=b.x-1.5+i*.15,z=b.z-1.5+j*.15;
        ray.set(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(m)[0], got=shape.heightAt(x,z);
        if(hit) expect(got).toBeCloseTo(hit.point.y,7); else expect(got).toBe(-Infinity);
      }
      g.dispose(); (m.material as THREE.Material).dispose();
    }
  });
  it('keeps original ellipsoid results and bounds exactly, even with the same seed', () => {
    for(const s of [undefined,0,99,MAIN_CHANNEL_S-1]) {
      const b={...rock(),s};
      for(let j=-5;j<=5;j++) for(let i=-5;i<=5;i++) {
        const x=b.x+i*.2,z=b.z+j*.2, dx=x-b.x,dz=z-b.z,c=Math.cos(b.rot),sn=Math.sin(b.rot);
        const q=1-((dx*c+dz*sn)/b.rx)**2-((-dx*sn+dz*c)/b.rz)**2;
        expect(boulderTopAt(b,x,z)).toBe(q<=0 ? -Infinity : b.y+b.ry*Math.sqrt(q));
      }
      const r=Math.max(b.rx,b.rz); expect(boulderBounds(b)).toEqual({minX:b.x-r,maxX:b.x+r,minZ:b.z-r,maxZ:b.z+r});
    }
  });
  it('removes the measured 269 mm invisible cap from the actual main-third rock', () => {
    const b: Boulder = { x:66.45506704952375,z:10.110632766860023,y:1.8610381172753079,
      rx:.9311881314976668,ry:.6825966540966176,rz:1.0267613064905619,rot:2.9357045957429113,
      seed:447733920,s:1091.656643365277,inChannel:true };
    const m=mainBoulderShape(b),old=rendered(b);
    expect(Array.from(m.positions)).toEqual(Array.from(old.positions));
    expect(m.bounds.maxY).toBe(2.275116443634033);
    expect(b.y+b.ry-m.bounds.maxY).toBeCloseTo(.2685183277378922,12);
    for(let t=0;t<m.indices.length;t+=3) {
      const a=m.indices[t]*3,c=m.indices[t+1]*3,d=m.indices[t+2]*3;
      const x=(m.positions[a]+m.positions[c]+m.positions[d])/3,z=(m.positions[a+2]+m.positions[c+2]+m.positions[d+2])/3;
      expect(boulderTopAt(b,x,z)).toBeLessThanOrEqual(m.bounds.maxY+1e-9);
    }
  });
  it('invalidates edited transforms and uses actual waterline support points', () => {
    const cache=createBoulderShapeCache(mulberry32,valueNoise),b=rock(),a=cache(b);
    expect(cache({...b})).toBe(a);
    const moved=cache({...b,x:b.x+2,ry:b.ry*.5}); expect(moved).not.toBe(a);
    expect(moved.bounds.minX-a.bounds.minX).toBeCloseTo(2,5);
    const level=(a.bounds.minY+a.bounds.maxY)*.5,contact=a.contactAt(level,1,0);
    for(const p of [contact.upstream,contact.downstream,contact.left,contact.right]) expect(a.heightAt(...p)).toBeGreaterThanOrEqual(level-1e-5);
    expect(contact.upstream[0]).toBeLessThan(contact.downstream[0]);
    expect(a.bounds.maxY).toBeLessThan(b.y+b.ry);
    expect(boulderTopAt(b,b.x,b.z)).toBe(a.heightAt(b.x,b.z));
  });
  it('retains original mapper outputs and fades a genuinely submerged main rock', () => {
    const b: Boulder = { x:66.45506704952375,z:10.110632766860023,y:1.8610381172753079,
      rx:.9311881314976668,ry:.6825966540966176,rz:1.0267613064905619,rot:2.9357045957429113,
      seed:447733920,s:1091.656643365277,inChannel:true };
    const n=64*64;
    const field={grid:{x0:b.x-8,z0:b.z-8,dx:.25,nx:64,nz:64},h:new Float32Array(n).fill(.7),
      bed:new Float32Array(n).fill(1.90101974),u:new Float32Array(n).fill(1.92276),
      v:new Float32Array(n),uRms:new Float32Array(n),waterfallImpact:null};
    const legacy=buildFlowMap(field,undefined,undefined,[{...b,s:undefined}]);
    const original=buildFlowMap(field,undefined,undefined,[{...b,s:0}]);
    for(const key of ['t0','t1','t2','surface'] as const) expect(original[key]).toEqual(legacy[key]);
    const main=buildFlowMap(field,undefined,undefined,[b]);
    const maxHeight=(map:typeof main) => {
      let max=0;for(let i=0;i<n;i++)max=Math.max(max,Math.abs(map.t2[i*4]));return max;
    };
    // The drawn top is 326 mm below this level: no emergent pillow is warranted.
    expect(maxHeight(main)).toBeLessThan(maxHeight(legacy)*.2);
  });
});
