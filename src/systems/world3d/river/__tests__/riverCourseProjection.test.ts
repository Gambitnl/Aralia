/** Projection search work may change; its existing sample, tie and arc results
 * must remain identical. The exhaustive oracle has no spatial search index. */
import {describe,it,expect} from 'vitest';
import {RiverCourse,defaultRiverCourse} from '../riverReach';

function exhaustive(course:RiverCourse,x:number,z:number){
  const bx=Math.floor(x/8),bz=Math.floor(z/8);
  const candidates=course.samples.map((p,k)=>{
    const dx=Math.floor(p.x/8)-bx,dz=Math.floor(p.z/8)-bz;
    return {p,k,dx,dz,ring:Math.max(Math.abs(dx),Math.abs(dz)),distance:(p.x-x)**2+(p.z-z)**2};
  });
  const bounded=candidates.filter(c=>c.ring<40),inside=bounded.length>0;
  const ordered=(inside?bounded:candidates).sort((a,b)=>a.distance-b.distance||(inside?(a.ring-b.ring||a.dz-b.dz||a.dx-b.dx):0)||a.k-b.k);
  const {p,k,distance}=ordered[0],dx=x-p.x,dz=z-p.z,along=dx*p.tx+dz*p.tz;
  return {s:p.stretch===1?p.s+along:p.s+along/p.stretch,n:dx*p.tz-dz*p.tx,k,d:Math.sqrt(distance)};
}

describe('unchanged course projection with indexed empty buckets',()=>{
  it('matches exhaustive admitted samples and the old tie order near, outside and far beyond the buckets',()=>{
    const courses=[defaultRiverCourse(),new RiverCourse([[0,400],[600,200],[1200,500],[1800,400]])];
    for(const c of courses)for(let j=0;j<16;j++)for(let i=0;i<24;i++){
      const x=-230+i*2430/23,z=-700+j*1600/15;
      expect(c.project(x,z)).toEqual(exhaustive(c,x,z));
    }
    for(const c of courses)for(let k=0;k<c.samples.length;k+=79){
      const p=c.samples[k];for(const n of [-12,0,12]){
        const x=p.x+p.tz*n,z=p.z-p.tx*n;
        expect(c.project(x,z)).toEqual(exhaustive(c,x,z));
      }
    }
  });
  it('preserves row and column priority when two samples straddle a bucket edge',()=>{
    const c=new RiverCourse([[40,0],[20,0],[0,0]]);
    let boundaries=0;
    for(let k=1;k<c.samples.length;k++){
      const a=c.samples[k-1],b=c.samples[k];
      if(Math.floor(a.x/8)===Math.floor(b.x/8))continue;
      const x=(a.x+b.x)/2,z=16;
      expect(c.project(x,z)).toEqual(exhaustive(c,x,z));boundaries++;
    }
    expect(boundaries).toBeGreaterThan(2);
  });
});
