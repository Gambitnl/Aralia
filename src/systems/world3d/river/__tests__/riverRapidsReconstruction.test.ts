/** Checks full-course geometry and coverage, not waterfall likeness or flow. */
import { afterEach,describe,expect,it } from 'vitest';
import { RiverCourse,defaultRiverCourse,makeTerrainHeight,courseKeyAt,riverChannelProjection } from '../riverReach';
import { MAIN_CHANNEL_S,mainRapidsAt,setRiverHeadwaters,HEADWATERS_GRID,headwaterKey,carveMainRapids,configureHeadwatersGrid,riverReconstructionEnabled,mainReconstructionOwnership,WATERFALL } from '../riverHeadwaters';
import { RECONSTRUCTION_FALLS,RECONSTRUCTION_END_M,reconstructionCourseLength,reconstructedRapidsAt,
  projectReconstructedRapids,reconstructionDomain,reconstructionSection,reconstructionLandscapeDomain,reconstructionLandscapeLowering,reconstructionCrossHeight } from '../riverRapidsReconstruction';

afterEach(()=>setRiverHeadwaters(false));
describe('complete reference-fall physical course',()=>{
  it('carves distant source upland through the same descending valley as its neighboring terrain',()=>{
    setRiverHeadwaters(true,true);
    const terrain=makeTerrainHeight(defaultRiverCourse(),20260928);
    // Actual rendered wall triangle: one corner inherited the original
    // source's distant upland and bypassed the entire rapids carve. Its
    // neighbor was299meters lower, only half a meter away. Check the local
    // patch across that source-address boundary, beyond all protected land.
    for(let z=-388;z<=-382;z+=.5)for(let x=64;x<=70;x+=.5){
      const y=terrain(x,z);
      expect(Math.abs(terrain(x+.5,z)-y)).toBeLessThan(3);
      expect(Math.abs(terrain(x,z+.5)-y)).toBeLessThan(3);
    }
  });
  it('continues the Sisters rock plane across both finite component edges without a tall side wall',()=>{
    const f=RECONSTRUCTION_FALLS[1];
    // The rendered failure stood outside the native component: a twelve-meter
    // fade restored over130meters of elevation beside its edge. Sample both
    // shoulders beyond the component instead of checking only its interior.
    for(const t of [.08,.18,.34,.59])for(const sign of [-1,1]){
      let previous:number|undefined;
      for(let n=86;n<=130;n+=2){
        const section=reconstructionSection(f.startM+t*f.runM,sign*n);
        const height=-section.lowering+section.relief;
        if(previous!==undefined)expect(Math.abs(height-previous)).toBeLessThan(2);
        previous=height;
      }
    }
  });
  it('assigns exposed valley rock to the carve while protecting the quiet channel and fork',()=>{
    // This broad Sisters shoulder is lowered even though the quiet branch is
    // nearer. A nearest-only material rule incorrectly left its old surface.
    expect(mainReconstructionOwnership(220,90,41,12)).toBe(1);
    for(const u of [120,220,1000]){
      expect(mainReconstructionOwnership(u,90,16,12)).toBe(0);
      expect(mainReconstructionOwnership(u,90,22,12)).toBe(.5);
      expect(mainReconstructionOwnership(u,90,28,12)).toBe(1);
    }
    expect(mainReconstructionOwnership(90,90,41,12)).toBe(0);
    expect(mainReconstructionOwnership(90,10,41,12)).toBe(1);
  });
  it('keeps every full-size fall and its shoulders clear of the protected quiet valley',()=>{
    const quiet=defaultRiverCourse();
    for(const f of RECONSTRUCTION_FALLS)for(let d=f.startM;d<=f.endM;d+=5){
      const p=reconstructedRapidsAt(d);
      for(const n of [-f.halfWidthM-40,-f.halfWidthM,0,f.halfWidthM,f.halfWidthM+40]){
        const x=p.x+p.tz*n,z=p.z-p.tx*n,old=quiet.project(x,z);
        expect(old.d-courseKeyAt(old.s).halfW-4).toBeGreaterThan(100);
        expect(x).toBeGreaterThan(-25);
      }
    }
  });
  it('gives Latefossen unequal high chutes around a long divide with a common head and collector',()=>{
    const f=RECONSTRUCTION_FALLS[3],at=(t:number,n:number)=>reconstructionSection(f.startM+t*f.runM,n);
    const a=at(.4,-40),b=at(.4,40),middle=at(.4,0);
    expect(Math.abs(a.relief-b.relief)).toBeGreaterThan(25);
    expect(middle.relief-Math.max(a.relief,b.relief)).toBeGreaterThan(20);
    // A substantial broad top must stand above both chutes, with an inclined
    // plate across its center rather than a pinched Gaussian peak.
    expect(at(.7,0).relief-Math.max(at(.7,-40).relief,at(.7,40).relief)).toBeGreaterThan(20);
    expect(at(.5,0).relief-Math.max(at(.5,-40).relief,at(.5,40).relief)).toBeGreaterThan(10);
    expect(Math.abs(at(.5,-10).relief+at(.5,10).relief-2*at(.5,0).relief)).toBeLessThan(1);
    expect(at(.5,0).soilTop).toBe(true);
    expect(at(.5,-40).soilTop||at(.5,40).soilTop||at(.98,0).soilTop).toBe(false);
    for(const t of [0,1])expect(at(t,-14).relief).toBeCloseTo(at(t,14).relief,7);
    expect(reconstructionCrossHeight(f.startM-20,0,8.5)).toBeLessThan(0);
    expect(reconstructionCrossHeight(f.endM+20,0,8.5)).toBeLessThan(0);
  });
  it('preserves actual source, pool and quiet-channel ground while opening the broad face',()=>{
    const course=defaultRiverCourse();setRiverHeadwaters(true);
    const baseline=makeTerrainHeight(course,20260928),samples=[];
    for(const s of [-200,-171,-155,-120,-90,70,100,150,220,272,300])for(const side of [-.8,0,.8]){
      const p=course.atCurve(s),n=side*courseKeyAt(s).halfW,x=p.x+p.tz*n,z=p.z-p.tx*n;
      samples.push({x,z,y:baseline(x,z)});
    }
    // Include the original finite source's broad dry shoulders, beyond its
    // narrow wet opening. The distant-upland repair must not excavate them.
    const crest=course.at(WATERFALL.crestS);
    for(const forward of [-30,-5,0])for(const lateral of [-140,-70,0,70,140]){
      const x=crest.x+crest.tx*forward+crest.tz*lateral,z=crest.z+crest.tz*forward-crest.tx*lateral;
      samples.push({x,z,y:baseline(x,z)});
    }
    setRiverHeadwaters(true,true);const full=makeTerrainHeight(course,20260928);
    for(const p of samples)expect(full(p.x,p.z)).toBeCloseTo(p.y,9);
    const sisters=RECONSTRUCTION_FALLS[1],p=reconstructedRapidsAt(sisters.startM),x=p.x+p.tz*(-90),z=p.z-p.tx*(-90),original=course.project(x,z);
    // The relocated broad face has room beside the untouched quiet valley.
    expect(original.d).toBeGreaterThan(sisters.halfWidthM+40);
    const main=riverChannelProjection(course,x,z);
    expect(mainReconstructionOwnership(main.s-MAIN_CHANNEL_S,Math.abs(main.n),original.d,courseKeyAt(original.s).halfW)).toBe(1);
    expect(carveMainRapids(x,z,20,0,original.d,true,courseKeyAt(original.s).halfW)).toBeLessThan(0);
    expect(riverChannelProjection(course,x,z).s).toBeGreaterThanOrEqual(MAIN_CHANNEL_S);
  });
  it('connects seven unequal bent rock channels through a staggered continuous cliff',()=>{
    const f=RECONSTRUCTION_FALLS[1],middle=f.startM+f.runM/2;
    const bands:Array<{start:number;end:number}>=[];
    let active=false;
    for(let n=-90;n<=90;n+=.25){
      const inside=reconstructionCrossHeight(middle,n,90)<-.3;
      if(inside&&!active)bands.push({start:n,end:n});
      if(inside)bands[bands.length-1].end=n;
      active=inside;
    }
    expect(bands).toHaveLength(7);
    expect(Math.max(...bands.map(b=>b.end-b.start))-Math.min(...bands.map(b=>b.end-b.start))).toBeGreaterThan(2);
    const actual=(t:number,n:number)=>{
      const d=f.startM+t*f.runM,section=reconstructionSection(d,n);
      return -section.lowering+section.relief;
    };
    const lipHeights=bands.map(b=>actual(.18,(b.start+b.end)/2));
    expect(Math.max(...lipHeights)-Math.min(...lipHeights)).toBeGreaterThan(2);
    // The broad rock planes remain continuous between unequal channels;
    // there must be no isolated thin vertical fin at a panel boundary.
    for(const t of [.15,.35,.5,.7,.9])for(let n=-90;n<90;n+=.5)
      expect(Math.abs(actual(t,n+.5)-actual(t,n))).toBeLessThan(5);
    for(const n of [-85,-50,0,50,85]){
      expect(actual(0,n)).toBeCloseTo(-f.crestLoweringM,8);
      expect(actual(1,n)).toBeCloseTo(-f.toeLoweringM,8);
    }
    // The first render exposed peaks where local cliff offsets leaked into
    // coarse outer land. Far land keeps the unfractured landscape; the
    // nearer shoulders now continue the cliff plane without a tall side wall.
    for(const t of [.15,.35,.5,.7,.9])for(const n of [-300,300])
      expect(Math.abs(reconstructionSection(f.startM+t*f.runM,n).relief)).toBe(0);
    expect(reconstructionCrossHeight(f.startM-35,0,8.5)).toBeLessThan(0);
    expect(reconstructionCrossHeight(f.endM+25,0,reconstructionSection(f.endM+25).halfWidth)).toBeLessThan(0);
  });
  it('surrounds the complete unchanged fine water grid with a bounded native outer lattice',()=>{
    const {grid:g}=reconstructionDomain(),o=reconstructionLandscapeDomain();
    expect(g.dx).toBe(.5);expect(o.step).toBe(8);
    expect(o.x0).toBeLessThan(g.x0-500);expect(o.x1).toBeGreaterThan(g.x0+g.nx*g.dx+500);
    expect(o.z0).toBeLessThan(g.z0-1900);expect(o.z1).toBeGreaterThan(g.z0+g.nz*g.dx+1900);
    // The roomier northern course retains both sampling resolutions and
    // all mountain margins. Its250808outer-land vertices use a bounded
    //251000reservation,0.4percent above the former compact-route bound.
    expect(((o.x1-o.x0)/o.step+1)*((o.z1-o.z0)/o.step+1)).toBeLessThan(251000);
    expect(reconstructionLandscapeLowering(RECONSTRUCTION_END_M)).toBe(1543);
  });
  it('keeps every Sisters groove downhill across the unequal cliff lips',()=>{
    const f=RECONSTRUCTION_FALLS[1],previous=Array<number>(7).fill(Infinity);
    // Detect connected low grooves from the actual cross-section rather than
    // copying the authored center/bend parameters into the control.
    for(let step=0;step<=45;step++){
      const distance=f.startM+step*f.runM/45,bands:Array<{start:number;end:number}>=[];
      let active=false;
      for(let n=-90;n<=90;n+=.25){
        const inside=reconstructionCrossHeight(distance,n,90)<-.3;
        if(inside&&!active)bands.push({start:n,end:n});
        if(inside)bands[bands.length-1].end=n;
        active=inside;
      }
      expect(bands).toHaveLength(7);
      bands.forEach((band,index)=>{
        const n=(band.start+band.end)/2,section=reconstructionSection(distance,n);
        const height=-.035*distance-section.lowering+section.relief+reconstructionCrossHeight(distance,n,90);
        expect(height).toBeLessThanOrEqual(previous[index]+1e-8);
        previous[index]=height;
      });
    }
  });
  it('installs the same full course and physical descent from its actual complete grid',()=>{
    configureHeadwatersGrid(reconstructionDomain().grid);
    expect(riverReconstructionEnabled()).toBe(true);
    for(const f of RECONSTRUCTION_FALLS){
      const a=mainRapidsAt(MAIN_CHANNEL_S+f.startM),b=reconstructedRapidsAt(f.startM);
      expect(a).toEqual(b);
      const crest=headwaterKey(MAIN_CHANNEL_S+f.startM)!,toe=headwaterKey(MAIN_CHANNEL_S+f.endM)!;
      expect(crest.thalweg-toe.thalweg).toBeCloseTo(f.dropM+.035*f.runM,7);
      expect(reconstructionSection(f.endM).halfWidth).toBeCloseTo(f.halfWidthM,7);
      for(let d=f.startM;d<=f.endM;d+=1){const p=mainRapidsAt(MAIN_CHANNEL_S+d);expect(Number.isFinite(carveMainRapids(p.x,p.z,20,0,10000))).toBe(true);}
    }
    // The original river owns its land even beside the new branch.
    expect(carveMainRapids(70,10,6.25,0,0)).toBe(6.25);
    configureHeadwatersGrid(HEADWATERS_GRID);expect(riverReconstructionEnabled()).toBe(false);
  });
  it('keeps far-land projection identical to a complete nearest-sample search',()=>{
    const courses=[defaultRiverCourse(),new RiverCourse([[0,400],[600,200],[1200,500],[1800,400]])];
    for(const course of courses)for(const [x,z] of [[-900,-700],[900,-700],[2100,140],[2700,800],[-500,1600]]){
      let k=0,d2=Infinity;
      for(let q=0;q<course.samples.length;q++){
        const p=course.samples[q],v=(p.x-x)**2+(p.z-z)**2;if(v<d2){d2=v;k=q;}
      }
      const actual=course.project(x,z),p=course.samples[k],along=(x-p.x)*p.tx+(z-p.z)*p.tz;
      expect(actual.k).toBe(k);expect(actual.d).toBe(Math.sqrt(d2));
      expect(actual.s).toBe(p.s+along/p.stretch);
      expect(actual.n).toBe((x-p.x)*p.tz-(z-p.z)*p.tx);
    }
  });
  it('samples its actual curve beyond1000m while preserving original branch routing',()=>{
    setRiverHeadwaters(true);
    const independent=new RiverCourse([[0,400],[600,400],[1200,400],[1800,400]]);
    expect(independent.atCurve(1200).z).toBeCloseTo(400,8);
    expect(independent.at(1200)).toEqual(mainRapidsAt(1200));
    expect(defaultRiverCourse().at(1200)).toEqual(mainRapidsAt(1200));
    // Check the actual separated branch, not the former corridor's latitude.
    const point=reconstructedRapidsAt(1200),projected=projectReconstructedRapids(point.x,point.z);
    expect(projected.s-MAIN_CHANNEL_S).toBeCloseTo(1200,3);
    expect(projected.d).toBeLessThan(.01);
  });
  it('keeps all seven at distinct full-scale reservations separated by rapids',()=>{
    expect(RECONSTRUCTION_FALLS.map(f=>f.id)).toEqual(['storfossen','seven-sisters','steinsdalsfossen','latefossen','tvindefossen','stigfossen','langfossen']);
    expect(RECONSTRUCTION_FALLS.at(-1)!.toeLoweringM).toBe(1543);
    for(let i=1;i<7;i++){
      const a=RECONSTRUCTION_FALLS[i-1],b=RECONSTRUCTION_FALLS[i];
      expect(b.startM-a.endM).toBe(a.rapidsAfterM);
      expect(b.crestLoweringM).toBe(a.toeLoweringM);
    }
    expect(RECONSTRUCTION_END_M).toBeLessThan(reconstructionCourseLength());
  });
  it('uses physical distance and projects it consistently across the entire route',()=>{
    for(const d of [0,120,250,500,1000,1500,RECONSTRUCTION_END_M]){
      const p=reconstructedRapidsAt(d),q=reconstructedRapidsAt(d+10),r=projectReconstructedRapids(p.x,p.z);
      // Physical distance follows the river's arc. A ten-meter chord through
      // a bend is shorter, so measure the actual quarter-meter curve pieces.
      let arc=0,previous=p;
      for(let step=1;step<=40;step++){
        const next=reconstructedRapidsAt(d+step*.25);arc+=Math.hypot(next.x-previous.x,next.z-previous.z);previous=next;
      }
      expect(arc).toBeGreaterThan(9.99);expect(arc).toBeLessThan(10.01);
      expect(Math.hypot(q.x-p.x,q.z-p.z)).toBeLessThan(10.01);
      expect(r.s-MAIN_CHANNEL_S).toBeCloseTo(d,3);
    }
  });
  it('covers reference shoulders, original source and quiet branch at unchanged resolution',()=>{
    const {grid:g,cells}=reconstructionDomain(),inside=(x:number,z:number)=>x>=g.x0&&x<=g.x0+g.nx*g.dx&&z>=g.z0&&z<=g.z0+g.nz*g.dx;
    expect(g.dx).toBe(HEADWATERS_GRID.dx);
    expect(cells).toBeGreaterThan(HEADWATERS_GRID.nx*HEADWATERS_GRID.nz);
    for(const f of RECONSTRUCTION_FALLS)for(let d=f.startM;d<=f.endM;d+=1)for(const n of [-f.halfWidthM-20,f.halfWidthM+20]){
      const p=reconstructedRapidsAt(d);expect(inside(p.x+p.tz*n,p.z-p.tx*n)).toBe(true);
    }
    for(const x of [HEADWATERS_GRID.x0,HEADWATERS_GRID.x0+HEADWATERS_GRID.nx*HEADWATERS_GRID.dx])for(const z of [HEADWATERS_GRID.z0,HEADWATERS_GRID.z0+HEADWATERS_GRID.nz*HEADWATERS_GRID.dx])expect(inside(x,z)).toBe(true);
  });
  it('refuses unavailable course positions rather than silently claiming downstream coverage',()=>{
    for(const d of [-1,NaN,Infinity,reconstructionCourseLength()+1])expect(()=>reconstructedRapidsAt(d)).toThrow(RangeError);
  });
});
