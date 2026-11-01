import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { WaterfallAirProjection, type AirLiquidPoint, type AirVec3 } from '../waterfallAirProjection';

const grid=()=>new WaterfallAirProjection({origin:[0,0,0],cells:[4,4,4],cellSize:1,tolerance:1e-10,maxIterations:400});
const point=(velocity:AirVec3=[1,2,3]):AirLiquidPoint=>({id:1,position:[2,2,2],normal:[1,0,0],mass:3,velocity});
const proofSamples:unknown[]=[];
const proofPaths=['src/systems/world3d/river/waterfallAirProjection.ts','src/systems/world3d/river/__tests__/waterfallAirProjection.test.ts'];
const hashes=()=>Object.fromEntries(proofPaths.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const before=process.env.WATER_AIR_PROOF?hashes():null;
afterAll(()=>{if(before) {const after=hashes();writeFileSync('.agent/scratch/waterfall-gauntlet/round53-air/weak-receipt.json',JSON.stringify({before,after,sourceStable:JSON.stringify(before)===JSON.stringify(after),samples:proofSamples,limit:'Material P0 response control only. No full-height switch or physical pressure-jump validation.'},null,2));}});

/** Independent dense open-boundary Poisson reference. Does not call the class's
 * divergence, transpose, projection, or interpolation helpers. */
function addedAirMassReference(points:AirLiquidPoint[],n:number,dx:number,density:number) {
  const nc=n**3, faceCounts=[(n+1)*n*n,n*(n+1)*n,n*n*(n+1)], offsets=[0,faceCounts[0],faceCounts[0]+faceCounts[1]], nf=faceCounts.reduce((a,b)=>a+b,0);
  const dims=[[n+1,n,n],[n,n+1,n],[n,n,n+1]], index=(c:number,i:number,j:number,k:number)=>offsets[c]+i+dims[c][0]*(j+dims[c][1]*k);
  const inverse=Array(nf).fill(0), jbar=Array(nf).fill(0), D=Array.from({length:nc},()=>Array(nf).fill(0));
  for(let c=0;c<3;c++) for(let k=0;k<dims[c][2];k++) for(let j=0;j<dims[c][1];j++) for(let i=0;i<dims[c][0];i++) inverse[index(c,i,j,k)]=1/(density*dx**3*([i,j,k][c]===0||[i,j,k][c]===n?.5:1));
  let row=0;
  for(let k=0;k<n;k++) for(let j=0;j<n;j++) for(let i=0;i<n;i++,row++) for(let c=0;c<3;c++) {const ijk=[i,j,k];D[row][index(c,i,j,k)]-=dx**2;ijk[c]++;D[row][index(c,ijk[0],ijk[1],ijk[2])]+=dx**2;}
  const area=points.reduce((s,p)=>s+p.area!,0);
  for(const p of points) {
    const entries:{f:number;weight:number}[]=[];let total=0;
    for(let k=0;k<=n;k++) for(let j=0;j<n;j++) for(let i=0;i<n;i++) {
      const weight=Math.max(0,1-Math.abs((i+.5)*dx-p.position[0])/dx)*Math.max(0,1-Math.abs((j+.5)*dx-p.position[1])/dx)*Math.max(0,1-Math.abs(k*dx-p.position[2])/dx);
      if(weight) {entries.push({f:index(2,i,j,k),weight});total+=weight;}
    }
    for(const e of entries) jbar[e.f]+=p.area!/area*e.weight/total;
  }
  const matrix=Array.from({length:nc},(_,i)=>Array.from({length:nc},(_,j)=>D[i].reduce((s,value,f)=>s+value*inverse[f]*D[j][f],0)));
  const rhs=D.map(row=>row.reduce((s,value,f)=>s+value*inverse[f]*jbar[f],0));
  // Dense pivoted elimination is deliberately separate from matrix-free PCG.
  for(let k=0;k<nc;k++) {
    let pivot=k;for(let i=k+1;i<nc;i++) if(Math.abs(matrix[i][k])>Math.abs(matrix[pivot][k])) pivot=i;
    [matrix[k],matrix[pivot]]=[matrix[pivot],matrix[k]];[rhs[k],rhs[pivot]]=[rhs[pivot],rhs[k]];
    for(let i=k+1;i<nc;i++) {const factor=matrix[i][k]/matrix[k][k];for(let j=k;j<nc;j++) matrix[i][j]-=factor*matrix[k][j];rhs[i]-=factor*rhs[k];}
  }
  const pressure=Array(nc).fill(0);for(let i=nc-1;i>=0;i--) {let value=rhs[i];for(let j=i+1;j<nc;j++) value-=matrix[i][j]*pressure[j];pressure[i]=value/matrix[i][i];}
  let mobility=0;
  for(let f=0;f<nf;f++) {let gradient=0;for(let i=0;i<nc;i++) gradient+=D[i][f]*pressure[i];mobility+=jbar[f]*inverse[f]*(jbar[f]-gradient);}
  return 1/mobility;
}
const airMomentum=(a:WaterfallAirProjection):AirVec3=>{
  const result:AirVec3=[0,0,0];
  [a.u,a.v,a.w].forEach((field,c)=>{
    const dims=[...a.cells]; dims[c]++;
    for(let k=0;k<dims[2];k++) for(let j=0;j<dims[1];j++) for(let i=0;i<dims[0];i++) {
      const boundary=[i,j,k][c]===0||[i,j,k][c]===a.cells[c];
      result[c]+=field[i+dims[0]*(j+dims[1]*k)]*1.2*a.cellSize**3*(boundary?.5:1);
    }
  }); return result;
};
describe('joint MAC air/liquid projection',()=>{
  const weakGrid=()=>new WaterfallAirProjection({origin:[0,0,0],cells:[4,4,4],cellSize:1,coupling:'material-regions',tolerance:1e-10,maxIterations:400});
  const weakPoints=(velocities=[1,-2,1]):AirLiquidPoint[]=>velocities.map((speed,i)=>({id:i,position:[1.1+i*.1,1.5,1.5],normal:[0,0,1],velocity:[0,0,speed],mass:1,area:1,region:'same-material'}));
  it('preserves unresolved material normal modes instead of annihilating water energy',()=>{
    const a=weakGrid(), points=weakPoints(), result=a.project(points,.01);
    expect(result.receipt.converged).toBe(true); expect(result.velocities).toEqual(points.map(p=>p.velocity));
    expect(result.receipt.energyBefore).toBe(3);expect(result.receipt.energyAfter).toBe(3);
    expect(result.receipt.maximumWeakResidual).toBe(0);expect(result.receipt.maximumInterfaceError).toBe(2);
    expect(result.receipt.groupCount).toBe(1);expect(result.receipt.regions[0].diameterBound).toBeCloseTo(.2,12);
    proofSamples.push({control:'unresolved-null-mode',result});
  });
  it('retains response under equal area/mass subdivision at the same physical samples',()=>{
    const points=weakPoints([.5,.5,.5]), base=weakGrid(), split=weakGrid();
    const children=points.flatMap(p=>[0,1].map(i=>({...p,id:p.id*2+i,mass:p.mass/2,area:p.area!/2})));
    const first=base.project(points,.01), second=split.project(children,.01);
    expect(first.receipt.converged&&second.receipt.converged).toBe(true);
    children.forEach((_,i)=>second.velocities[i].forEach((v,c)=>expect(v).toBeCloseTo(first.velocities[Math.floor(i/2)][c],11)));
    [...base.u,...base.v,...base.w].forEach((v,i)=>expect([...split.u,...split.v,...split.w][i]).toBeCloseTo(v,11));
    expect(first.receipt.energyAfter).toBeCloseTo(second.receipt.energyAfter,11);
    proofSamples.push({control:'coincident-subdivision',first,second});
  });
  it('matches an independent dense Poisson added-air-mass response and density/thickness scaling',()=>{
    for(const density of [.6,1.2,2.4]) for(const mass of [.3,3]) {
      const points=weakPoints([1,1,1]).map(p=>({...p,mass:mass/3}));
      const air=new WaterfallAirProjection({origin:[0,0,0],cells:[4,4,4],cellSize:1,airDensity:density,coupling:'material-regions',tolerance:1e-11,maxIterations:500});
      const reference=addedAirMassReference(points,4,1,density), result=air.project(points,.01), speed=result.velocities[0][2];
      expect(result.receipt.converged).toBe(true);expect(speed).toBeCloseTo(mass/(mass+reference),10);
      expect(mass*(1/speed-1)).toBeCloseTo(reference,9);
      expect(result.receipt.projectionLoss).toBeCloseTo(.5*mass*reference/(mass+reference),10);
      expect(Math.abs(result.receipt.energyIdentityError)).toBeLessThan(1e-10);
      proofSamples.push({control:'added-air-mass',density,mass,reference,inferred:mass*(1/speed-1),result});
    }
  });
  it('records fixed-grid translation sensitivity without treating it as physical convergence',()=>{
    const samples=[];
    for(const shift of [0,.2,.4,.6,.8]) {
      const points=weakPoints([1,1,1]).map(p=>({...p,position:[p.position[0]+shift,p.position[1],p.position[2]] as AirVec3}));
      const result=weakGrid().project(points,.01);expect(result.receipt.converged).toBe(true);
      expect(result.receipt.maximumWeakMeanSlip).toBeLessThan(1e-8);
      samples.push({shift,normalVelocity:result.velocities[0][2],receipt:result.receipt});
    }
    const speeds=samples.map(s=>s.normalVelocity);
    proofSamples.push({control:'grid-translation-sensitivity',range:Math.max(...speeds)-Math.min(...speeds),samples});
  });
  it('requires explicit region area and keeps caller-selected disconnected groups separate',()=>{
    const a=weakGrid(), input=weakPoints([1,1,1]);
    expect(a.project(input.map(p=>({...p,area:undefined})),.01).receipt.converged).toBe(false);
    expect(a.project(input.map(p=>({...p,region:undefined})),.01).receipt.converged).toBe(false);
    const result=a.project(input.map(p=>({...p,region:p.id})),.01);
    expect(result.receipt.converged).toBe(true);expect(result.receipt.groupCount).toBe(3);
  });
  it('balances region exchange and boundary momentum while retaining unresolved slip',()=>{
    const air=weakGrid();air.u[4]=1.7;const points=weakPoints([1,-1,.4]);
    points[0].normal=[1,2,3];points[1].normal=[-1,1,2];points[2].region='other-sheet';
    const before=airMomentum(air),result=air.project(points,.01),after=airMomentum(air),q=result.receipt;
    expect(q.converged).toBe(true);expect(q.maximumWeakMeanSlip).toBeLessThan(1e-8);
    expect(q.energyAfter).toBeLessThanOrEqual(q.energyBefore+1e-10);expect(Math.abs(q.energyIdentityError)).toBeLessThan(1e-10);
    for(let c=0;c<3;c++) {
      const liquidChange=points.reduce((s,p,i)=>s+p.mass*(result.velocities[i][c]-p.velocity[c]),0);
      expect(q.exchangeAirImpulse[c]+q.exchangeLiquidImpulse[c]).toBeCloseTo(0,11);
      expect(after[c]-before[c]+liquidChange+q.pressureBoundaryReaction[c]).toBeCloseTo(0,10);
    }
    proofSamples.push({control:'multiple-region-momentum-energy',result});
  });
  it('reports positive physical pressure for a compressed central cell',()=>{
    const a=new WaterfallAirProjection({origin:[0,0,0],cells:[3,1,1],cellSize:1,tolerance:1e-12});
    a.u.set([0,1,-1,0]); const result=a.project([],.1);
    expect(result.receipt.converged).toBe(true); expect(a.pressure[1]).toBeGreaterThan(0);
    expect(a.pressure[1]).toBeGreaterThan(a.pressure[0]);
    // The central positive pressure reduces both incoming face velocities.
    expect(a.u[1]).toBeLessThan(1); expect(a.u[2]).toBeGreaterThan(-1);
  });
  it('preserves uniform translation, including separately advected ambient inflow',()=>{
    const a=new WaterfallAirProjection({origin:[0,0,0],cells:[4,4,4],cellSize:1,ambient:[1,2,3]});
    a.advect(.1); const r=a.project([point()],.02);
    expect(r.receipt.converged).toBe(true);
    r.velocities[0].forEach((value,c)=>expect(value).toBeCloseTo(c+1,13));
    expect(r.receipt.energyAfter).toBeCloseTo(r.receipt.energyBefore,10);
    a.sample([1.3,2.1,.4]).forEach((value,c)=>expect(value).toBeCloseTo(c+1,13));
  });
  it('projects near-uniform decimal ambient roundoff without an incompatible absolute PCG stop',()=>{
    const a=new WaterfallAirProjection({origin:[-6,-4,-6],cells:[12,39,6],cellSize:2,ambient:[.6,0,.25]});
    a.advect(.005); const result=a.project([],.005);
    expect(result.receipt.converged).toBe(true); expect(result.receipt.maximumDivergence).toBeLessThan(1e-12);
  });
  it('rejects overflow from huge finite predicted speeds atomically',()=>{
    const a=grid(); a.u[0]=1e200; const before=a.u.slice();
    const result=a.project([point()],.02);
    expect(result.receipt.converged).toBe(false); expect(result.receipt.failure).toBe('Nonfinite constraint residual'); expect(a.u).toEqual(before);
  });
  it('uses component partition of unity and the same weights for adjoint spreading',()=>{
    const a=grid(), p=point(); p.position=[0,.13,3.99]; p.normal=[2,-3,4];
    const stencil=a.couplingStencil(p.position,p.normal), field=Float64Array.from({length:a.u.length+a.v.length+a.w.length},(_,i)=>Math.sin(i*.3));
    const impulse=.71, spread=new Float64Array(field.length); let sampled=0;
    for(const e of stencil) {sampled+=field[e.index]*e.weight; spread[e.index]+=impulse*e.weight;}
    let transposeDot=0; for(let i=0;i<field.length;i++) transposeDot+=field[i]*spread[i];
    expect(transposeDot).toBeCloseTo(sampled*impulse,13);
    const offsets=[0,a.u.length,a.u.length+a.v.length,field.length], length=Math.hypot(...p.normal);
    for(let c=0;c<3;c++) expect(stencil.filter(e=>e.index>=offsets[c]&&e.index<offsets[c+1]).reduce((s,e)=>s+e.weight,0)).toBeCloseTo(p.normal[c]/length,13);
  });
  it('solves divergence and normal coupling together without tangential locking',()=>{
    const a=grid(); a.u[43]=2; a.v[31]=-.4;
    const r=a.project([point()],.02);
    expect(r.receipt.converged).toBe(true); expect(r.receipt.maximumDivergence).toBeLessThan(1e-8);
    expect(r.receipt.maximumInterfaceError).toBeLessThan(1e-8);
    expect(r.velocities[0][1]).toBe(2); expect(r.velocities[0][2]).toBe(3);
    expect(r.velocities[0][0]).not.toBe(1);
  });
  it('accounts interface and open boundary impulses and satisfies the energy identity',()=>{
    const a=grid(); a.u[4]=1.7; a.w[70]=-.3; const before=airMomentum(a), p=point(); p.normal=[1,2,3];
    const r=a.project([p],.02), after=airMomentum(a), q=r.receipt;
    expect(q.converged).toBe(true); expect(q.energyAfter).toBeLessThanOrEqual(q.energyBefore+1e-10);
    expect(Math.abs(q.energyIdentityError)).toBeLessThan(1e-9);
    for(let c=0;c<3;c++) {
      expect(q.exchangeAirImpulse[c]+q.exchangeLiquidImpulse[c]).toBeCloseTo(0,11);
      expect(after[c]-before[c]+p.mass*(r.velocities[0][c]-p.velocity[c])+q.pressureBoundaryReaction[c]).toBeCloseTo(0,10);
    }
  });
  it('rejects invalid, zero-mass, duplicate and outside vertices without mutating air',()=>{
    const a=grid(); a.u[0]=3; const before=a.u.slice();
    for(const points of [[{...point(),mass:0}],[point(),point()],[{...point(),position:[-1,2,2] as AirVec3}]]) {
      expect(a.project(points,.02).receipt.converged).toBe(false); expect(a.u).toEqual(before);
    }
  });
  it('fails bounded iteration capacity atomically and deterministically',()=>{
    const a=new WaterfallAirProjection({origin:[0,0,0],cells:[4,4,4],cellSize:1,maxIterations:1,tolerance:1e-12});
    a.u[34]=5; const before=a.u.slice(), first=a.project([point()],.02), second=a.project([point()],.02);
    expect(first.receipt.failure).toBe('Constraint iteration capacity exceeded'); expect(a.u).toEqual(before);
    expect(first.receipt.relativeResidual).toBe(second.receipt.relativeResidual); expect(first.velocities).toEqual([point().velocity]);
  });
  it('refines a smooth resolved patch with fixed physical interpolation support',()=>{
    const values:number[]=[];
    for(const n of [6,12,24]) {
      const a=new WaterfallAirProjection({origin:[-1.5,-1.5,-1.5],cells:[n,n,n],cellSize:3/n,couplingRadius:.5,maxIterations:500,tolerance:1e-9});
      const points:AirLiquidPoint[]=[];
      for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++) points.push({id:points.length,position:[i*.35,j*.35,0],normal:[0,0,1],mass:.12,velocity:[0,0,.2*Math.cos(i*.35)*Math.cos(j*.35)]});
      const r=a.project(points,.01); expect(r.receipt.converged).toBe(true);
      expect(r.receipt.maximumDivergence).toBeLessThan(1e-7); expect(r.receipt.maximumInterfaceError).toBeLessThan(1e-7);
      values.push(r.velocities.reduce((s,v)=>s+v[2],0)/points.length);
    }
    expect(Math.abs(values[2]-values[1])).toBeLessThan(Math.abs(values[1]-values[0]));
  });
});
