/** Check material routing against finite terrain, gaps and real comparison
 * source records. These checks do not qualify turning pressure or live flow. */
import {describe,it,expect} from 'vitest';
import {WaterfallSourceContact} from '../waterfallSourceContact';
import {WaterfallTerrainComparisonRun,TERRAIN_COMPARISON_CASES} from '../waterfallTerrainComparisons';
import {emptySourceSupportMoments,addSourceSupportMoments} from '../waterfallSourceSupport';
import type {ContactSurface,ContactVec3,SheetRelease} from '../waterfallContactFlow';
const g=9.81,rho=1000;
function top(id:string,y:number,sx=0,sz=0,x0=0,x1=8,z0=-5,z1=5):ContactSurface {
  const p=(x:number,z:number):ContactVec3=>[x,y+sx*x+sz*z,z],norm=Math.hypot(sx,1,sz);
  return {id,vertices:[p(x0,z0),p(x1,z0),p(x1,z1),p(x0,z1)],normal:[-sx/norm,1/norm,-sz/norm]};
}
const release:SheetRelease={edge:'source:0',start:[0,10,-2],end:[0,10,2],intervalStart:0,intervalEnd:1,birthTime:.5,velocity:[1,0,0]};
describe('finite terrain source contact',()=>{
  it('chooses first actual surface independently of input order and leaves contact a line',()=>{
    for(const surfaces of [[top('high',6),top('low',2)],[top('low',2),top('high',6)]]){
      const source=new WaterfallSourceContact(release,4,surfaces),rows=source.snapshot();
      expect(rows).toHaveLength(1);expect(rows[0].surfaceId).toBe('high');
      expect(rows[0].contactEnds![0][1]).toBeCloseTo(6,12);
      expect(rows[0].contactEnds![0][0]).toBeCloseTo(Math.sqrt(8/g),12);
      const before=source.arrivals(0,Math.sqrt(8/g));expect(before.moments.volume).toBe(0);
      expect(source.arrivals(0,4).moments.volume).toBeCloseTo(4,12);
    }
  });
  it('partitions overlapping planes where first contact changes within a source strip',()=>{
    const source=new WaterfallSourceContact(release,4,[top('left',5,0,-1),top('right',5,0,1)]);
    const rows=source.snapshot();expect(rows.map(r=>r.surfaceId)).toEqual(['left','right']);
    expect(rows[0].z1).toBe(0);expect(rows[1].z0).toBe(0);
    for(const row of source.arrivals(0,4).arrivals)expect(row.moments.volume).toBeCloseTo(2,12);
  });
  it('handles a first-contact switch between planes with the same cross slope',()=>{
    const source=new WaterfallSourceContact(release,4,[top('a',4,0,1),top('b',3,1,1)]);
    const cut=10-.5*g-4;
    const rows=source.snapshot();expect(rows).toHaveLength(2);expect(rows[0].z1).toBeCloseTo(cut,12);
    expect(new Set(rows.map(r=>r.surfaceId)).size).toBe(2);
  });
  it('cuts at finite upstream/downstream edges and retains every missed span in flight',()=>{
    const wide={...release,start:[0,10,-5] as ContactVec3,end:[0,10,5] as ContactVec3};
    const source=new WaterfallSourceContact(wide,10,[top('finite',5,0,1,.5,1)]);
    const lo=5-.5*g,hi=5-.5*g*.25,rows=source.snapshot();
    const hit=rows.find(r=>r.surfaceId==='finite')!;
    expect(hit.z0).toBeCloseTo(lo,12);expect(hit.z1).toBeCloseTo(hi,12);expect(hit.volume).toBeCloseTo(hi-lo,12);
    const air=source.remaining(4),contact=source.arrivals(0,4).moments;
    expect(air.volume+contact.volume).toBeCloseTo(10,12);
    expect(air.volume).toBeCloseTo(10-(hi-lo),12);
    expect(air.kinetic+air.potential+contact.kinetic+contact.potential).toBeCloseTo(10000*(.5+g*10),8);
  });
  it('splits the contact curve at real cell faces without smearing onto dry cells',()=>{
    const source=new WaterfallSourceContact(release,4,[top('slope',5,0,1,0,2)]);
    const whole=source.arrivals(0,4).moments,split=source.arrivals(0,4,{nx:12,nz:16});
    expect(split.arrivals.length).toBeGreaterThan(6);
    for(const row of split.arrivals){
      expect(row.volumeFluxPerSourceWidth).toBe(1);
      row.normal.forEach((v,k)=>expect(v).toBeCloseTo([0,1/Math.sqrt(2),-1/Math.sqrt(2)][k],14));
      const ix=row.cell!%12,iz=Math.floor(row.cell!/12);
      for(const point of row.points){
        expect(point.position[0]).toBeGreaterThanOrEqual(ix*2/12-1e-12);
        expect(point.position[0]).toBeLessThanOrEqual((ix+1)*2/12+1e-12);
        expect(point.z).toBeGreaterThanOrEqual(-5+iz*10/16-1e-12);
        expect(point.z).toBeLessThanOrEqual(-5+(iz+1)*10/16+1e-12);
      }
    }
    for(const key of ['volume','kinetic','potential','arrivalTimeMoment'] as const)expect(split.moments[key]).toBeCloseTo(whole[key],8);
    expect(new Set(split.arrivals.map(r=>r.cell)).size).toBeLessThan(192);
  });
  it('retains source-off arrival tails, interval partition and airborne energy variance',()=>{
    const source=new WaterfallSourceContact(release,4,[top('cross',5,0,1)]);
    const at=1.2,air=source.remaining(at),hit=source.arrivals(0,at).moments;
    expect(hit.volume).toBeGreaterThan(0);expect(air.volume).toBeGreaterThan(0);
    expect(air.volume+hit.volume).toBeCloseTo(4,12);
    expect(air.kinetic+air.potential+hit.kinetic+hit.potential).toBeCloseTo(4000*(.5+g*10),8);
    const sum=emptySourceSupportMoments();for(let k=0;k<120;k++)addSourceSupportMoments(sum,source.arrivals(k/40,(k+1)/40).moments);
    const all=source.arrivals(0,3).moments;
    for(const key of ['volume','kinetic','potential','arrivalTimeMoment'] as const)expect(sum[key]).toBeCloseTo(all[key],8);
    expect(source.arrivals(1,3).moments.volume).toBeGreaterThan(0);
    const view=source.snapshot();view[0].contactEnds![0][0]=999;
    expect(source.snapshot()[0].contactEnds![0][0]).not.toBe(999);
    expect(source.arrivals(0,3).moments).toEqual(all);
  });
  it('does not invent a shelf under a free plunge',()=>{
    const source=new WaterfallSourceContact(release,4,[top('behind',6,0,0,-8,-1)]);
    expect(source.snapshot()[0].surfaceId).toBeNull();expect(source.arrivals(0,4).moments.volume).toBe(0);
    expect(source.remaining(4).volume).toBe(4);
  });
  it('routes free plunge to the existing terminal pool before any rock below it',()=>{
    const source=new WaterfallSourceContact(release,4,[top('below-pool',0)],2);
    const age=Math.sqrt(16/g),rows=source.snapshot();expect(rows[0].target).toBe('terminal-pool');
    expect(rows[0].firstArrival).toBeCloseTo(age,13);
    const at=source.arrivals(0,age+.5,{nx:12,nz:16});expect(at.moments.volume).toBeCloseTo(2,12);
    expect(at.arrivals[0].cell).toBeNull();expect(at.arrivals[0].target).toBe('terminal-pool');
    expect(source.remaining(age+.5).volume).toBeCloseTo(2,12);
    expect(source.remaining(4).volume).toBe(0);expect(source.arrivals(0,4).moments.volume).toBeCloseTo(4,12);
  });
  it('uses all seven running comparisons actual source records without crossing inlet gaps',()=>{
    for(const terrain of TERRAIN_COMPARISON_CASES){
      const run=new WaterfallTerrainComparisonRun([terrain]);run.setRunning(true);
      const before=run.step(),snapshot=before.snapshots[0].snapshot;
      let routed=0;
      for(const parcel of snapshot.parcels){
        const contact=run.sourceContact(terrain.id,parcel.id);
        const hit=contact.arrivals(0,10,{nx:12,nz:16}).moments,air=contact.remaining(10);
        expect(hit.volume+air.volume).toBeCloseTo(parcel.volume,13);
        expect(hit.kinetic+hit.potential+air.kinetic+air.potential).toBeCloseTo(rho*parcel.volume*(.5*parcel.sourceRelease!.velocity[0]**2+g*parcel.sourceRelease!.start[1]),8);
        routed+=hit.volume;
        const allowed=new Set([...terrain.buildSurfaces(),...(terrain.buildBanks?.()??[])].map(s=>s.id));allowed.add('source-terminal-pool');
        for(const row of contact.snapshot())if(row.surfaceId)expect(allowed.has(row.surfaceId)).toBe(true);
      }
      expect(routed).toBeCloseTo(snapshot.receipt.emittedVolume,12);
      expect(()=>run.sourceContact(terrain.id,-1)).toThrow('not-unlanded-source');
      expect(run.snapshot()).toEqual(before);
    }
  });
  it('rejects malformed geometry and unsupported later hits rather than silently choosing a point',()=>{
    expect(()=>new WaterfallSourceContact(release,4,[top('a',5),top('a',3)])).toThrow('capacity');
    expect(()=>new WaterfallSourceContact({...release,velocity:[1,0,1]},4,[])).toThrow('release');
    expect(()=>new WaterfallSourceContact({...release,start:[0,1,-2],end:[0,1,2]},4,[top('ramp',2,-5,0,.5,3)])).toThrow('below-extended-plane');
  });
  it('reads the running terrain snapshot instead of rebuilding a possibly changed factory',()=>{
    let height=60;
    const run=new WaterfallTerrainComparisonRun([{id:'sloped',label:'factory check',description:'test',clipAt:'',buildSurfaces:()=>[top('held',height,0,0,-.5,8,-12,12)]}]);
    run.setRunning(true);const state=run.step();height=30;
    const contact=run.sourceContact('sloped',state.snapshots[0].snapshot.parcels[0].id);
    expect(contact.snapshot()[0].contactEnds![0][1]).toBeCloseTo(60,12);
    expect(run.snapshot()).toEqual(state);
  });
});
