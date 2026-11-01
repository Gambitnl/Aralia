import { describe, expect, it } from 'vitest';
import { FrozenWaterfallRte, createRtePhase, createRteSolarProjection, rteBoundaryWithSolarBounce, rteHenyeyGreenstein, rteCellKernel, rteUniformBoundary, validateRteRun, validateRteVector, type RteGrid, type RteVector, type RteSolarInput } from '../waterfallRadiativeTransport';
function grid(size:RteGrid['size'],sigmaS=0,sigmaA=0,radiance:RteVector=[1,1,1],directions:12|24=12):RteGrid{
  const cells=size[0]*size[1]*size[2];return{size,spacing:[1/size[0],1/size[1],1/size[2]],scattering:new Float64Array(cells).fill(sigmaS),absorption:new Float64Array(cells*3).fill(sigmaA),boundary:rteUniformBoundary(size,directions,radiance)};
}
function slab(slices:number,sigmaS:number,sigmaA:number,g=.75,count:12|24=12){
  const field=grid([1,1,slices],sigmaS,sigmaA,[0,0,0],count);field.spacing=[1000,1000,1/slices];
  const phase=createRtePhase(g,count);for(let d=0;d<count;d++)if(phase.directions[d][2]>0)for(let c=0;c<3;c++)field.boundary[4][d*3+c]=1;
  return new FrozenWaterfallRte(field,phase);
}
describe('frozen waterfall angular transport',()=>{
  it('rejects malformed caps, geometry and camera directions instead of scheduling forever or choosing an arbitrary bin',()=>{
    for(const cap of [0,-1,.5,NaN,Infinity])expect(()=>validateRteRun(cap,1e-6)).toThrow();
    for(const tolerance of [0,-1,1,NaN,Infinity])expect(()=>validateRteRun(8,tolerance)).toThrow();
    expect(()=>validateRteVector([0,NaN,1],'Camera')).toThrow();
    const malformed=grid([1,1,1]);malformed.size=[1,.5,1];expect(()=>new FrozenWaterfallRte(malformed,createRtePhase(.75))).toThrow();
    const incomplete=grid([1,1,1]);incomplete.spacing=[1,1] as unknown as RteVector;expect(()=>new FrozenWaterfallRte(incomplete,createRtePhase(.75))).toThrow();
    const solver=new FrozenWaterfallRte(grid([1,1,1]),createRtePhase(.75));
    expect(()=>solver.cameraSource(()=>[0,0,0])).toThrow();expect(()=>solver.cameraSource(()=>[NaN,0,1])).toThrow();
    expect(()=>solver.sweep(.5)).toThrow();
  });
  it('reports transverse angular errors instead of equating scalar moment fitting with the full HG tensor',()=>{
    const fine=createRtePhase(.75,24),coarse=createRtePhase(.75,12);
    expect(coarse.maximumVectorMomentError).toBeLessThan(1e-10);expect(coarse.maximumTensorMomentError).toBeLessThan(1e-10);
    expect(fine.maximumVectorMomentError).toBeGreaterThan(.001);expect(fine.maximumTensorMomentError).toBeGreaterThan(.001);
    console.info('RTE_ANGULAR_TENSOR_ERRORS',JSON.stringify({vector:fine.maximumVectorMomentError,tensor:fine.maximumTensorMomentError}));
  });
  it('preserves nonnegative reciprocal phase energy and two moments at both angular resolutions',()=>{
    for(const count of [12,24] as const)for(const g of [0,.5,.75,.85,.99,1]){
      const phase=createRtePhase(g,count);expect(phase.maximumMomentError).toBeLessThan(1e-9);
      for(let i=0;i<count;i++)for(let j=0;j<count;j++){expect(phase.matrix[i*count+j]).toBeGreaterThanOrEqual(0);expect(phase.matrix[i*count+j]).toBeCloseTo(phase.matrix[j*count+i],12);}
    }
  });
  it('has finite cell averages from vacuum through very thick optical depth',()=>{
    for(const tau of [0,1e-12,1e-6,.1,10,1000,1e20]){
      const result=rteCellKernel(tau);expect(Number.isFinite(result.average)).toBe(true);expect(result.average).toBeGreaterThanOrEqual(0);expect(result.decay).toBeGreaterThanOrEqual(0);
      expect(result.average+result.redirected).toBeCloseTo(1,12);
      if(tau>0)expect(tau*result.average).toBeCloseTo(-Math.expm1(-tau),10);
    }
  });
  it('transports vacuum without creating scattering or losing power',()=>{
    const solver=new FrozenWaterfallRte(grid([3,2,4],0,0,[.2,.5,1]),createRtePhase(.75));const receipt=solver.solve(4);
    expect(receipt.ready).toBe(true);expect(receipt.relativePowerError).toBeLessThan(1e-12);expect(Math.max(...solver.scatteredMean)).toBe(0);
    for(let i=0;i<solver.ballisticMean.length;i++)expect(solver.ballisticMean[i]).toBeCloseTo([.2,.5,1][i%3],12);
  });
  it('absorption-only follows exact mixed-cell Beer attenuation with no scattered light',()=>{
    const solver=slab(24,0,3),receipt=solver.solve(4);expect(receipt.ready).toBe(true);expect(Math.max(...solver.scatteredMean)).toBe(0);
    for(let d=0;d<12;d++)if(solver.phase.directions[d][2]>0){
      // The enormous lateral cell dimensions approximate an infinite slab;
      // the remaining lateral leakage is bounded by their finite face rates.
      const actual=solver.ballisticOut[((23*12)+d)*3],expected=Math.exp(-3/solver.phase.directions[d][2]);expect(Math.abs(actual-expected)).toBeLessThan(.0001);
    }
    expect(receipt.incoming[0]).toBeCloseTo(receipt.outgoing[0]+receipt.absorbed[0],7);
  });
  it('maintains uniform illumination in a thick conservative heterogeneous medium',()=>{
    const field=grid([3,3,3],20,0,[.2,.5,.9]);for(let i=0;i<field.scattering.length;i++)field.scattering[i]=i%4===0?0:20+(i%7)*10;
    const solver=new FrozenWaterfallRte(field,createRtePhase(.75)),receipt=solver.solve(2000,1e-7);
    expect(receipt.ready).toBe(true);expect(receipt.minimumRadiance).toBeGreaterThanOrEqual(0);expect(receipt.relativePowerError).toBeLessThan(1e-7);
    for(let i=0;i<solver.ballisticMean.length;i++)expect(solver.ballisticMean[i]+solver.scatteredMean[i]).toBeCloseTo([.2,.5,.9][i%3],5);
  });
  it('reports an iteration cap as unconverged, then converges a thick one-sided slab',()=>{
    const solver=slab(16,35,0),early=solver.solve(1,1e-7);expect(early.ready).toBe(false);expect(early.capped).toBe(true);
    const final=solver.solve(4000,1e-7);expect(final.ready).toBe(true);expect(final.capped).toBe(false);expect(final.relativePowerError).toBeLessThan(1e-7);
    // The infinite-slab proxy has million-square-meter faces. Compare a
    // fraction of its incident power, not an absolute watt tolerance that
    // changes when that deliberate lateral-size proxy is enlarged.
    expect(Math.abs((final.outgoing[0]+final.absorbed[0])/final.incoming[0]-1)).toBeLessThan(1e-7);
    console.info('RTE_THICK_RECEIPT',JSON.stringify(final));
  });
  it('retains a forward-only limit without replacing full ballistic extinction',()=>{
    const solver=slab(8,1e5,0,1),receipt=solver.solve(4,1e-7);expect(receipt.ready).toBe(true);expect(receipt.relativePowerError).toBeLessThan(1e-7);
    expect(Math.max(...solver.ballisticOut)).toBeLessThan(1e-100);
    for(let d=0;d<12;d++)if(solver.phase.directions[d][2]>0)expect(solver.ballisticMean[d*3]+solver.scatteredMean[d*3]).toBeGreaterThan(.999);
  });
  it('keeps a narrow vacuum path brighter than adjacent absorbing material',()=>{
    const field=grid([7,1,12],0,4,[0,0,0]),phase=createRtePhase(.75);field.spacing=[.1,1000,.1];
    for(let z=0;z<12;z++)for(let x=0;x<7;x++){const cell=x+7*z;for(let c=0;c<3;c++)field.absorption[cell*3+c]=x===3?0:4;}
    for(let i=0;i<field.boundary[4].length;i++)field.boundary[4][i]=1;
    const solver=new FrozenWaterfallRte(field,phase),receipt=solver.solve(1);expect(receipt.ready).toBe(true);
    // Icosahedral z-propagating directions with x=0 travel along the gap.
    const d=phase.directions.findIndex(v=>v[0]===0&&v[2]>0),at=(x:number)=>solver.ballisticOut[((x+7*11)*12+d)*3];
    expect(at(3)).toBeGreaterThan(.999);expect(at(0)).toBeLessThan(.05);
  });
  it('exposes spatial and 12-to24 refinement differences rather than forcing agreement',()=>{
    const receipts=[];
    for(const count of [12,24] as const)for(const slices of [8,16,32]){
      const solver=slab(slices,6,.2,.75,count),receipt=solver.solve(2000,1e-7);expect(receipt.ready).toBe(true);receipts.push({count,slices,sweeps:receipt.sweeps,cpuMs:receipt.cpuMs,bytes:receipt.bytes,outgoing:receipt.outgoing[0]/receipt.incoming[0],absorbed:receipt.absorbed[0]/receipt.incoming[0],powerError:receipt.relativePowerError});
      expect(receipt.relativePowerError).toBeLessThan(1e-7);
    }
    console.info('RTE_REFINEMENT_RECEIPTS',JSON.stringify(receipts));
  });
});
function solar(field:RteGrid,direction:RteVector=[0,0,1],irradiance:RteVector=[2,3,4],visibility=1):RteSolarInput {
  const [x,y,z]=field.size;return{propagationDirection:direction,irradiance,visibility:[y*z,y*z,x*z,x*z,x*y,x*y].map(n=>new Float64Array(n).fill(visibility)),signature:'native-sun-A',visibilitySignature:'opaque-A',bounceSignature:'cliff-bounce-A'};
}
describe('optional directional solar transport',()=>{
  it('adds measured cliff transfer once without folding direct visibility into radiance',()=>{
    const sky=rteUniformBoundary([1,1,1],12,[.1,.2,.3]),bounce=rteUniformBoundary([1,1,1],12,[.4/Math.PI,.5/Math.PI,.6/Math.PI]);const combined=rteBoundaryWithSolarBounce(sky,bounce,[2,3,4]);
    for(let c=0;c<3;c++)expect(combined[0][c]).toBeCloseTo([.1,.2,.3][c]+[.4,.5,.6][c]*[2,3,4][c]/Math.PI,12);
    expect(rteBoundaryWithSolarBounce(sky,bounce,[0,0,0])).toEqual(sky);expect(sky[0][0]).toBe(.1);expect(()=>rteBoundaryWithSolarBounce(sky,bounce,[-1,0,0])).toThrow();
  });
  it('projects positive normalized HG mass while reporting unresolved angular moments',()=>{
    for(const count of [12,24] as const){const projection=createRteSolarProjection(createRtePhase(.75,count),[.2,-.4,1]);expect(projection.weights.reduce((a,b)=>a+b,0)).toBe(1);expect(Math.min(...projection.weights)).toBeGreaterThanOrEqual(0);expect(projection.vectorError).toBeGreaterThan(.001);expect(projection.vectorError).toBeLessThan(.2);expect(projection.tensorError).toBeLessThan(.2);}
    expect(()=>createRteSolarProjection(createRtePhase(1),[0,0,1])).toThrow(/delta/);
  });
  it('preserves the old path exactly with zero irradiance and rejects invalid solar inputs',()=>{
    const old=grid([2,2,3],2,.1,[.2,.3,.4]),zero={...old,solar:solar(old,[0,0,1],[0,0,0])};
    const a=new FrozenWaterfallRte(old,createRtePhase(.75)),b=new FrozenWaterfallRte(zero,createRtePhase(.75));a.sweep(12);b.sweep(12);
    expect(b.ballisticMean).toEqual(a.ballisticMean);expect(b.scatteredMean).toEqual(a.scatteredMean);expect(b.scatteredOut).toEqual(a.scatteredOut);expect(b.cameraSource(()=>[1,0,0])).toEqual(a.cameraSource(()=>[1,0,0]));
    const ar=a.diagnose(),br=b.diagnose();expect(br.incoming).toEqual(ar.incoming);expect(br.outgoing).toEqual(ar.outgoing);expect(br.absorbed).toEqual(ar.absorbed);
    for(const change of [{propagationDirection:[0,0,0] as const},{propagationDirection:[0,0,2] as const},{irradiance:[-1,0,0] as const},{irradiance:[Infinity,0,0] as const},{visibilitySignature:''},{visibility:[new Float64Array([2])]}])expect(()=>new FrozenWaterfallRte({...old,solar:{...solar(old),...change}},createRtePhase(.75))).toThrow();
  });
  it('conserves a clear and an absorbing continuous beam with exact axis Beer attenuation',()=>{
    for(const absorption of [0,3]){
      const field=grid([2,2,8],0,absorption,[0,0,0]);field.solar=solar(field);const solver=new FrozenWaterfallRte(field,createRtePhase(.75)),receipt=solver.solve(1);
      expect(receipt.ready).toBe(true);expect(receipt.solar!.relativePowerError).toBeLessThan(1e-12);expect(receipt.relativePowerError).toBeLessThan(1e-12);expect(Math.max(...solver.scatteredMean)).toBe(0);
      for(let c=0;c<3;c++)expect(solver.solarOut![(4*7)*3+c]).toBeCloseTo([2,3,4][c]*Math.exp(-absorption),12);
      expect(receipt.solar!.scattered).toEqual([0,0,0]);
    }
  });
  it('uses actual opaque entry visibility and reverses beam direction through asymmetric material',()=>{
    const field=grid([1,1,5],0,0,[0,0,0]);for(let z=0;z<5;z++)for(let c=0;c<3;c++)field.absorption[z*3+c]=z+.2;
    const forward=new FrozenWaterfallRte({...field,solar:solar(field)},createRtePhase(.75)),reverse=new FrozenWaterfallRte({...field,absorption:Float64Array.from(field.absorption,(_,i)=>field.absorption[(4-Math.floor(i/3))*3+i%3]),solar:solar(field,[0,0,-1])},createRtePhase(.75));
    for(let z=0;z<5;z++)for(let c=0;c<3;c++)expect(forward.solarMean![z*3+c]).toBeCloseTo(reverse.solarMean![(4-z)*3+c],12);
    const blocked=new FrozenWaterfallRte({...field,solar:solar(field,[0,0,1],[2,3,4],0)},createRtePhase(.75));expect(Math.max(...blocked.solarMean!)).toBe(0);expect(blocked.solve(1).incoming).toEqual([0,0,0]);
  });
  it('balances conservative and absorbing solar plus diffuse power without a second sigma or solid angle factor',()=>{
    for(const absorption of [0,.3])for(const count of [12,24] as const){
      const field=grid([2,2,3],2,absorption,[.1,.2,.3],count);field.solar=solar(field,[.6,0,.8]);const solver=new FrozenWaterfallRte(field,createRtePhase(.75,count)),receipt=solver.solve(500,1e-7);
      expect(receipt.ready).toBe(true);expect(receipt.minimumRadiance).toBeGreaterThanOrEqual(0);expect(receipt.solar!.relativePowerError).toBeLessThan(1e-12);expect(receipt.solar!.diffuseRelativePowerError).toBeLessThan(1e-7);expect(receipt.relativePowerError).toBeLessThan(1e-7);
      if(absorption===0)expect(receipt.absorbed).toEqual([0,0,0]);
    }
  });
  it('evaluates camera first solar scattering analytically while leaving collision weights to the caller',()=>{
    const field=grid([1,1,1],2,.5,[0,0,0]);field.solar=solar(field);const solver=new FrozenWaterfallRte(field,createRtePhase(.75));
    for(const view of [[0,0,1],[0,0,-1],[1,0,0]] as const){const source=solver.cameraSource(()=>view);for(let c=0;c<3;c++)expect(source[c]).toBeCloseTo(solver.solarMean![c]*rteHenyeyGreenstein(.75,view[2]),6);}
    expect(Math.max(...solver.ballisticMean)).toBe(0);expect(Math.max(...solver.scatteredMean)).toBe(0);
  });
});
