/** Full-footprint regression: a clear center cannot qualify corners or rims.
 * Closed mesh volume is measured independently from its oriented triangles.
 * These are Float64 CPU geometry checks, not proof of a rendered GPU surface.
 */
import {describe,it,expect} from 'vitest';
import {buildTerrainBankGeometry,BANK_WET_WEDGE_TRIANGLES,type TerrainBankCellInput,type TerrainBankWetPacket} from '../riverTerrainBankGeometry';
import {createBankState} from '../riverSubcellBankExperiment';
type P=readonly [number,number,number];
const hash='b'.repeat(64);
function square(bed:(x:number,z:number)=>number):TerrainBankCellInput{
  const p=(x:number,z:number):P=>[x,z,bed(x,z)],a=p(0,0),b=p(1,0),c=p(1,1),d=p(0,1);
  return {bounds:[0,1,0,1],triangles:[[a,b,c],[a,c,d]]};
}
function closedVolume(p:TerrainBankWetPacket){
  let v=0;
  for(const w of p.wedges)for(let i=0;i<BANK_WET_WEDGE_TRIANGLES.length;i+=3){
    const a=BANK_WET_WEDGE_TRIANGLES[i]*3,b=BANK_WET_WEDGE_TRIANGLES[i+1]*3,c=BANK_WET_WEDGE_TRIANGLES[i+2]*3,q=w.localVertices;
    v+=(q[a]*(q[b+1]*q[c+2]-q[b+2]*q[c+1])+q[a+1]*(q[b+2]*q[c]-q[b]*q[c+2])+q[a+2]*(q[b]*q[c+1]-q[b+1]*q[c]))/6;
  }
  return v;
}
describe('finite water volume on actual one-sided terrain support',()=>{
  it('clips the whole shoreline instead of extending a wet center over an uphill corner',()=>{
    const b=buildTerrainBankGeometry('slope-volume',hash,[square(x=>2*x)]);
    // Level1.2 wets the center x=.5, but a full-cell rectangle would bury its
    // uphill corners in the bed at x=1. The actual liquid ends at x=.6.
    const V=b.measureLevel(0,1.2).volume,s=createBankState('slope',b.geometry.geometryId,[V],[0],[0]);
    const r=b.wetVolume(s);if(!r.ok)throw Error(r.reason);
    expect(r.packet.rawVolumeM3).toBe(V);expect(closedVolume(r.packet)).toBeCloseTo(V,13);
    for(const w of r.packet.wedges)for(let i=0;i<6;i++){
      const q=w.localVertices,x=w.originM[0]+q[3*i],y=w.originM[1]+q[3*i+1];
      expect(x).toBeLessThanOrEqual(.6+1e-14);expect(y-2*x).toBeGreaterThanOrEqual(-1e-14);
    }
    expect(1.2-2*.5).toBeGreaterThan(0);expect(1.2-2*1).toBeLessThan(0);
    expect(Object.isFrozen(r.packet.wedges[0].localVertices)).toBe(true);
  });
  it('builds no phantom volume for dry owners and retains positive thin water',()=>{
    const b=buildTerrainBankGeometry('thin',hash,[square(()=>0)]);
    const dry=b.wetVolume(createBankState('dry',b.geometry.geometryId,[0],[0],[0]));
    if(!dry.ok)throw Error(dry.reason);expect(dry.packet.wedges).toEqual([]);
    const tiny=b.wetVolume(createBankState('thin',b.geometry.geometryId,[1e-20],[0],[0]));
    if(!tiny.ok)throw Error(tiny.reason);expect(closedVolume(tiny.packet)).toBeGreaterThan(0);
    expect(Math.abs(closedVolume(tiny.packet)/1e-20-1)).toBeLessThan(1e-12);
  });
  it('measures all side rims and a two-axis partial wet footprint at a large world height',()=>{
    const b=buildTerrainBankGeometry('offset',hash,[square((x,z)=>164+2*x+z)]);
    const V=b.measureLevel(0,164.25).volume,r=b.wetVolume(createBankState('offset',b.geometry.geometryId,[V],[0],[0]));
    if(!r.ok)throw Error(r.reason);
    expect(closedVolume(r.packet)).toBeCloseTo(V,13);expect(r.packet.coordinateStorage).toBe('FLOAT64_CPU_ONLY');
    for(const w of r.packet.wedges){
      const edges=new Map<string,number>();
      for(let i=0;i<BANK_WET_WEDGE_TRIANGLES.length;i+=3)for(let j=0;j<3;j++){
        const a=BANK_WET_WEDGE_TRIANGLES[i+j],c=BANK_WET_WEDGE_TRIANGLES[i+(j+1)%3],key=[Math.min(a,c),Math.max(a,c)].join(',');
        edges.set(key,(edges.get(key)??0)+1);
      }
      expect([...edges.values()].every(n=>n===2)).toBe(true);
      expect(w.localVertices.every(Number.isFinite)).toBe(true);
    }
  });
  it('returns no partial packet for unresolved inventory or a stale geometry identity',()=>{
    const b=buildTerrainBankGeometry('bad',hash,[square(x=>164+x)]);
    const s=createBankState('bad',b.geometry.geometryId,[1e-100],[0],[0]);
    const r=b.wetVolume(s);expect(r.ok).toBe(false);if(!r.ok){expect(r.state).toBe(s);expect(r.reason).toContain('world-height precision');}
    const other=createBankState('other','different',[.01],[0],[0]);
    const mismatch=b.wetVolume(other);expect(mismatch.ok).toBe(false);if(!mismatch.ok)expect(mismatch.state).toBe(other);
    expect(s.volumeM3[0]).toBe(1e-100);
  });
});
