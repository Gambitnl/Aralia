/** A rotated experiment must rotate real terrain and momentum together.
 * These controls compare against independently constructed world geometry,
 * then exercise the unchanged native source, flight, landing and stop ledger.
 */
import { describe,expect,it } from 'vitest';
import { createRiverTerrainFrame,terrainPointToLocal,terrainPointToWorld,terrainVectorToWorld } from '../riverTerrainFrame';
import { RiverTerrainCourse } from '../riverTerrainCourse';
import { rasterizeRiverTerrain } from '../riverTerrainRaster';

function quad(a:number,b:number,y:number):number[]{return [a,y,0,b,y,0,b,y,3,a,y,0,b,y,3,a,y,3];}
describe('course-aligned native water frame',()=>{
  const c=Math.cos(.63),s=Math.sin(.63),f=createRiverTerrainFrame([-120,-80],[c,s]);
  it('preserves height, distance, handedness and source momentum',()=>{
    const point:[number,number,number]=[2,163,-4],world=terrainPointToWorld(f,point);
    // Independent world transform rather than round-trip alone.
    // Equivalent rotation sums differ by about one Float64 ulp when the
    // translation is added first. Check world meters, not operation ordering.
    world.forEach((v,i)=>expect(v).toBeCloseTo([-120+c*2+s*4,163,-80+s*2-c*4][i],12));
    terrainPointToLocal(f,world).forEach((x,i)=>expect(x).toBeCloseTo(point[i],12));
    const velocity=terrainVectorToWorld(f,[3,-9,4]);
    expect(Math.hypot(...velocity)).toBeCloseTo(Math.sqrt(106),12);
    expect(velocity[1]).toBe(-9);
    expect(f.xAxis[0]*f.zAxis[1]-f.xAxis[1]*f.zAxis[0]).toBeCloseTo(1,12);
    const source=terrainVectorToWorld(f,[.3,0,0]);
    expect(source[0]).toBeCloseTo(.3*c,12);expect(source[2]).toBeCloseTo(.3*s,12);
    expect(()=>createRiverTerrainFrame([0,0],[2,0])).toThrow('unit');
    expect(()=>createRiverTerrainFrame([NaN,0],[1,0])).toThrow('finite');
  });
  const grid={x0:0,z0:0,dx:.5,nx:12,nz:6};
  const local=[...quad(0,2.4,2),...quad(2.4,6,0)];
  const world:number[]=[];
  for(let i=0;i<local.length;i+=3){const x=local[i],y=local[i+1],z=local[i+2];world.push(-120+c*x-s*z,y,-80+s*x+c*z);}
  const recovered:number[]=[];
  for(let i=0;i<world.length;i+=3)recovered.push(...terrainPointToLocal(f,[world[i],world[i+1],world[i+2]]));
  it('reads the same actual cliff and emits parallel rather than alternating faces',()=>{
    const a=rasterizeRiverTerrain(local,grid),b=rasterizeRiverTerrain(recovered,grid);
    expect(b.spillFaces).toEqual(a.spillFaces);
    expect(b.spillFaces).toHaveLength(6);expect(b.spillFaces.every(p=>p.axis==='x')).toBe(true);
    b.bed.forEach((v,i)=>expect(v).toBeCloseTo(a.bed[i],11));
    expect(b.heightAt(2.39,1.5)).toBeCloseTo(2,12);expect(b.heightAt(2.41,1.5)).toBeCloseTo(0,12);
  });
  it('retains native source, airborne return and source-off accounting after rotation',()=>{
    const source=[14,26,38,50];
    const a=new RiverTerrainCourse(local,grid,source,[1,0],.3,1),b=new RiverTerrainCourse(recovered,grid,source,[1,0],.3,1);
    let air=false;
    while(a.solver.time<5){a.step();b.step();air ||= b.receipt().airVolume>0;}
    expect(air).toBe(true);expect(b.receipt().returnedVolume).toBeGreaterThan(0);
    expect(b.receipt().inVolume).toBe(a.receipt().inVolume);
    expect(b.receipt().wetVolume).toBeCloseTo(a.receipt().wetVolume,10);
    const admitted=b.receipt().inVolume;b.setSource(false);a.setSource(false);
    while(a.solver.time<7){a.step();b.step();}
    expect(b.receipt().inVolume).toBe(admitted);expect(b.receipt().wetVolume).toBeCloseTo(a.receipt().wetVolume,10);
    expect(Math.abs(b.receipt().closure)).toBeLessThan(1e-10);expect(b.receipt().failure).toBeNull();
  });
  it('rejects and rolls back a release inside the actual cliff, despite closed accounting',()=>{
    // The actual lip is 10 cm beyond the axis face. Slow water falls before
    // clearing that rock; a cell-center receiver cannot certify this contact.
    const terrain=[...quad(0,2.6,2),...quad(2.6,6,0)];
    const run=new RiverTerrainCourse(terrain,grid,[14,26,38,50],[1,0],.03,.1,true);
    let lastTime=0,lastAdmission=0,failed=false;
    while(run.solver.time<20){
      lastTime=run.solver.time;lastAdmission=run.solver.inVolume;
      try{run.step();}catch{failed=true;break;}
    }
    expect(failed).toBe(true);expect(run.failure).toContain('Actual drawn-rock clearance failed');
    expect(run.solver.time).toBe(lastTime);expect(run.solver.inVolume).toBe(lastAdmission);
    expect(run.running).toBe(false);expect(Math.abs(run.receipt().closure)).toBeLessThan(1e-10);
  });
});
