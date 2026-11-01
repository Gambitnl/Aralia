/** Exercise physical unequal cell capacities with the actual native solver.
 * A closed mass ledger alone is insufficient: inspect release positions and
 * actual rock support while the source runs, stops and restarts.
 */
import {describe,expect,it} from 'vitest';
import {RiverFlowSolver,type RiverSolverGrid} from '../riverSolver';
import {RiverTerrainCourse} from '../riverTerrainCourse';
import {riverCellArea,riverCellX,riverIndexX,riverMinimumSpacing,fitRiverXEdges,riverInverseMapSegments,riverRectWetDistance} from '../riverRectGrid';
import {buildWaterSheetArrays} from '../riverWaterSheet';

const base={x0:0,z0:0,dx:.5,nx:12,nz:6};
const edges=[0,.5,1,1.5,2,2.6,3,3.5,4,4.5,5,5.5,6];
const rect={...base,xEdges:edges};
function solver(grid:RiverSolverGrid,outflowEdge:'east'|'west'|'north'|'south'='east',bed=new Float64Array(grid.nx*grid.nz)){
  return new RiverFlowSolver({grid,bed,manning:new Float32Array(bed.length).fill(.03),dischargeM3S:.1,inflow:[{c:14,share:.4},{c:26,share:.6}],inflowDir:[1,0],inflowSpeedMS:1,outflowEdge});
}
function quad(a:number,b:number,y:number):number[]{return [a,y,0,b,y,0,b,y,3,a,y,0,b,y,3,a,y,3];}
describe('native rectangular river cells',()=>{
  it('uses physical edge locations and rejects collapsed or mismatched geometry',()=>{
    expect(riverCellX(rect,4)).toBe(2.3);expect(riverIndexX(rect,2.55)).toBe(4);expect(riverIndexX(rect,2.6)).toBe(5);
    expect(riverIndexX(rect,-.1)).toBe(-1);expect(riverIndexX(rect,6)).toBe(12);
    expect(riverCellArea(rect,4)).toBeCloseTo(.3,14);expect(riverCellArea(rect,5)).toBeCloseTo(.2,14);
    expect(riverMinimumSpacing(rect)).toBeCloseTo(.4,14);
    expect(()=>solver({...base,xEdges:[0,1]})).toThrow('Invalid river X edges');
    expect(()=>solver({...base,xEdges:edges.map((x,i)=>i===5?2:x)})).toThrow('increase');
  });
  it('fits real boundaries without skipping distance or changing the footprint',()=>{
    const fitted=fitRiverXEdges(base,[2.6,4.1]);expect(fitted[5]).toBe(2.6);expect(fitted[8]).toBe(4.1);expect(fitted[0]).toBe(0);expect(fitted.at(-1)).toBe(6);expect(fitted).toHaveLength(13);
    expect(()=>fitRiverXEdges(base,[2.55,2.7])).toThrow('Competing');
    const parts=riverInverseMapSegments(rect);
    for(let k=0;k<=1200;k++){const x=k/200,i=Math.min(11,riverIndexX(rect,x)),expected=i+(x-edges[i])/(edges[i+1]-edges[i]);let actual=x/(edges[1]-edges[0]);for(const p of parts)actual+=Math.max(x-p.x,0)*p.delta;expect(actual).toBeCloseTo(expected,12);}
    const sheet=buildWaterSheetArrays(rect,new Float32Array(72).fill(1));expect(sheet.pos[4*3]).toBeCloseTo(2.3,6);expect(sheet.pos[5*3]).toBeCloseTo(2.8,6);
    const wet=new Uint8Array(72);wet[4]=1;const distance=riverRectWetDistance(rect,wet);expect(distance[5]).toBeCloseTo(.5,6);expect(distance[6]).toBeCloseTo(.95,6);expect(distance[16]).toBe(.5);
  });
  it('retains the exact uniform native trajectory when explicit edges are uniform',()=>{
    const a=solver(base),b=solver({...base,xEdges:Array.from({length:13},(_,i)=>i*.5)});
    for(let k=0;k<200;k++){expect(b.step()).toBe(a.step());}
    expect([...b.h]).toEqual([...a.h]);expect([...b.hu]).toEqual([...a.hu]);expect([...b.hv]).toEqual([...a.hv]);
    expect(b.inVolume).toBe(a.inVolume);expect(b.outVolume).toBe(a.outVolume);expect(b.volume()).toBe(a.volume());
  });
  it('preserves lake at rest over a nonuniform bed and cell widths',()=>{
    const bed=Float64Array.from({length:72},(_,c)=>.1*(c%12)+.03*Math.floor(c/12));
    const s=solver(rect,'east',bed);s.setInflow(0,[],[1,0],0);
    s.setState(Float64Array.from(bed,x=>2-x));const volume=s.volume();
    // Close the otherwise transmissive east face by placing zero momentum
    // there; its hydrostatic outflow pressure must still balance the bed.
    for(let k=0;k<300;k++)s.step();
    expect(s.volume()).toBeCloseTo(volume,11);expect(Math.max(...s.hu.map(Math.abs),...s.hv.map(Math.abs))).toBeLessThan(1e-11);
    s.h.forEach((h,c)=>expect(h+bed[c]).toBeCloseTo(2,11));
  });
  for(const out of ['east','west','north','south'] as const)it(`counts source, external deposits and ${out} outlet by actual area`,()=>{
    const s=solver(rect,out),h=new Float64Array(72).fill(.2),u=new Float64Array(72).fill(out==='west'?-.5:.5),v=new Float64Array(72).fill(out==='north'?-.4:.4);
    s.setState(h,u,v);const initial=s.volume();
    expect(s.depositWater(4,.03,[.06,0,-.03])).toBe(true);
    expect(s.depositWaterBatch([{c:5,volume:.02,momentum:[.01,0,.02]},{c:5,volume:.01,momentum:[.02,0,.01]}])).toBe(true);
    expect(s.wetMomentum()[0]).toBeCloseTo(initial*(out==='west'?-.5:.5)+.09,12);
    expect(s.wetMomentum()[2]).toBeCloseTo(initial*(out==='north'?-.4:.4),12);
    const admitted=s.inVolume;
    while(s.time<4)s.step();s.setInflow(0,[],[1,0],0);const sourceOff=s.inVolume;
    while(s.time<6)s.step();
    expect(s.inVolume).toBe(sourceOff);expect(admitted).toBeCloseTo(.06,14);expect(s.outVolume).toBeGreaterThan(0);
    expect(s.volume()+s.outVolume-s.inVolume).toBeCloseTo(initial,11);expect(s.health().ok).toBe(true);
  });
  it('carries slow water to the actual lip, then falls and lands without crossing the rock',()=>{
    const course=new RiverTerrainCourse([...quad(0,2.6,2),...quad(2.6,6,0)],rect,[14,26,38,50],[1,0],.03,.1,true);
    let air=false;let minRelease=Infinity,maxPenetration=-Infinity;
    while(course.solver.time<20){course.step();for(const p of course.spill.snapshot().packets){air=true;minRelease=Math.min(minRelease,p.releasePosition[0]);maxPenetration=Math.max(maxPenetration,course.raster.heightAt(p.position[0],p.position[2])!-p.position[1]);}}
    expect(air).toBe(true);expect(minRelease).toBeGreaterThan(2.6);expect(course.receipt().returnedVolume).toBeGreaterThan(0);expect(maxPenetration).toBeLessThan(1e-5);
    course.setSource(false);const admitted=course.solver.inVolume;
    while(course.solver.time<25)course.step();expect(course.solver.inVolume).toBe(admitted);
    expect(Math.abs(course.receipt().closure)).toBeLessThan(1e-10);expect(course.failure).toBeNull();
    course.setSource(true);while(course.solver.time<27)course.step();expect(course.solver.inVolume).toBeGreaterThan(admitted);
    const map=course.map();expect(map.t0.every(Number.isFinite)).toBe(true);expect(map.t1.every(Number.isFinite)).toBe(true);expect(map.t2.every(Number.isFinite)).toBe(true);
  });
  it('refuses unsupported GPU execution rather than silently using uniform geometry',async()=>{
    const s=solver(rect);let called=false;
    await expect(s.stepOnGpu(async()=>{called=true;throw Error('must not dispatch');})).rejects.toThrow('GPU geometry is unqualified');
    await expect(s.intervalOnGpu(async()=>{called=true;throw Error('must not dispatch');},.1)).rejects.toThrow('GPU geometry is unqualified');
    expect(called).toBe(false);expect(s.time).toBe(0);
  });
});
