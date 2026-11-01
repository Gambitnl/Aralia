/** Algebra and force controls for the corrected curved collar. These checks do
 * not run a nonlinear physical interval, native source packet or GPU kernel.
 * They distinguish consistent inertia, geometry-derived velocities and actual
 * area/viscous derivatives from a curved rendering of the old flat model.
 */
import {describe,it,expect} from 'vitest';
import {collarBasis,collarCoordinateDerivative,collarLocalMass,collarMultiply,assembleMaterialCollar,prepareMaterialCollar,type CollarPanel,type CollarLaw} from '../waterfallMaterialCollar';
import {MaterialCollarOwner,COLLAR_FIXED_POLICY} from '../waterfallMaterialCollarSolve';
import {reachAdd as add,reachScale as scale,reachDot as dot,reachSub as sub,type ReachVec3} from '../waterfallMaterialReach';
import type {MaterialPortInput} from '../waterfallMaterialReachPort';
import type {ContactSurface} from '../waterfallContactFlow';
import {waterfallContactGeometryIdentity} from '../waterfallContactGeometry';
const law:CollarLaw={density:1000,gravity:[0,-9.81,0],surfaceTension:.072,dynamicViscosity:.001};
const cut:[ReachVec3,ReachVec3]=[[0,0,0],[0,0,1]],u:ReachVec3=[2,0,0];
function reference(age:number){return cut.flatMap(c=>[add(add(c,scale(u,age)),scale(law.gravity,.5*age*age)),add(add(c,scale(u,2*age/3)),scale(law.gravity,age*age/6)),add(c,scale(u,age/3)),[...c] as ReachVec3]);}
function velocity(age:number){return cut.flatMap(()=>[0,1,2,3].map(j=>add(u,scale(law.gravity,age*(1-j/3)))));}
function panel(age=1,frozen=false):CollarPanel{return {ids:[0,1,2,3,4,5,6,7],beta:[.02,.02],duration:age,start:0,frozen,releaseId:'analytic',cut,velocity:[u,u],frozenMass:frozen?collarLocalMass([.02,.02],age,1000).M:undefined};}
const sum=(N:number[],q:ReachVec3[])=>N.reduce((p,n,k)=>add(p,scale(q[k],n)),[0,0,0] as ReachVec3);
describe('curved material collar operator',()=>{
  it('represents partition, coordinate derivative and continuous-birth gravity exactly',()=>{
    const age=.5,q=reference(age),v=velocity(age),kq=collarCoordinateDerivative(q,age),qd=v.map((p,k)=>sub(p,kq[k]));
    for(const s of [.1,.5,.9])for(const r of [.13,.51,.88]){const b=collarBasis(s,r),X=sum(b.N,q),U=sum(b.N,v),W=sum(b.N,qd),relative=scale(sum(b.Nr,q),-r/age);
      expect(b.N.reduce((a,x)=>a+x,0)).toBeCloseTo(1,14);expect(b.Ns.reduce((a,x)=>a+x,0)).toBeCloseTo(0,14);expect(b.Nr.reduce((a,x)=>a+x,0)).toBeCloseTo(0,14);
      expect(X[0]).toBeCloseTo(2*age*(1-r),13);expect(X[1]).toBeCloseTo(-9.81*.5*age*age*(1-r)**2,13);expect(U[1]).toBeCloseTo(-9.81*age*(1-r),13);sub(U,W).forEach((x,k)=>expect(x).toBeCloseTo(relative[k],13));}
    expect(()=>collarCoordinateDerivative(q,0)).toThrow('positive age');
  });
  it('checks consistent mass, C=MK, local GCL and the kinetic metric',()=>{
    const age=.25,{M,C,Mdot,Bin}=collarLocalMass([.01,.03],age,1000),q=reference(age),v=velocity(age),Kq=collarCoordinateDerivative(q,age),MKq=collarMultiply(M,Kq),Cq=collarMultiply(C,q);
    for(let a=0;a<8;a++){MKq[a].forEach((x,k)=>expect(x).toBeCloseTo(Cq[a][k],12));for(let b=0;b<8;b++){expect(M[a][b]).toBeGreaterThan(0);expect(Mdot[a][b]).toBeCloseTo(C[a][b]+C[b][a]+Bin[a][b],12);}}
    expect(M.flat().reduce((s,x)=>s+x,0)).toBeCloseTo(5,12);
    const p=collarMultiply(M,v),consistent=.5*p.reduce((s,p,k)=>s+dot(p,v[k]),0),lumped=.5*M.reduce((s,row,k)=>s+row.reduce((s,x)=>s+x,0)*dot(v[k],v[k]),0);expect(lumped).toBeGreaterThan(consistent);
    const a=assembleMaterialCollar([panel(age)],q,v,age,{...law,surfaceTension:0,dynamicViscosity:0});
    expect(a.kinetic).toBeCloseTo(.5*collarMultiply(a.M,v).reduce((s,p,k)=>s+dot(p,v[k]),0),11);expect(a.cutFluxError).toBeLessThan(1e-15);expect(a.gclError).toBeLessThan(1e-13);expect(a.volume).toBeCloseTo(.005,14);expect(a.volumeMoment[1]/a.volume).toBeCloseTo(-9.81*age*age/6,12);expect(a.momentum[1]/5).toBeCloseTo(-9.81*age/2,12);
  });
  it('differentiates the actual curved area quadrature and plane-stress Rayleigh functional',()=>{
    const q=reference(.5),v=velocity(.5),p=panel(.5,true),a=assembleMaterialCollar([p],q,v,.5,law),epsilon=1e-6;
    for(let node=0;node<8;node++)for(let axis=0;axis<3;axis++){
      const plus=structuredClone(q),minus=structuredClone(q);plus[node][axis]+=epsilon;minus[node][axis]-=epsilon;
      const derivative=(assembleMaterialCollar([p],plus,v,.5,law).surface-assembleMaterialCollar([p],minus,v,.5,law).surface)/(2*epsilon);expect(a.capillary[node][axis]).toBeCloseTo(-derivative,8);
      const vp=structuredClone(v),vm=structuredClone(v);vp[node][axis]+=epsilon;vm[node][axis]-=epsilon;
      const viscousDerivative=(assembleMaterialCollar([p],q,vp,.5,law).rayleigh-assembleMaterialCollar([p],q,vm,.5,law).rayleigh)/(2*epsilon);expect(a.viscous[node][axis]).toBeCloseTo(-viscousDerivative,9);
    }
    expect(a.rayleigh).toBeGreaterThan(0);expect(a.viscous.reduce((s,f,k)=>s+dot(f,v[k]),0)).toBeCloseTo(-2*a.rayleigh,11);
  });
  it('retains originals and rejects source-off, capacity and invalid staging without changing the owner',()=>{
    const support:ContactSurface={id:'collar-source',vertices:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],normal:[0,1,0]};
    const input:MaterialPortInput={releaseId:'original',support,externalBoundaryOwner:'collar-test',outwardConormal:[-1,0,0],cut:{kind:'stationary',velocity:[0,0,0]},outflow:{edge:'collar-source:downstream',face:1,start:[1,.05,0],end:[1,.05,1],height:.1,velocity:[2,0,0],momentum:[40,0,0],volume:.02,time:1,intervalStart:0,intervalEnd:1,origin:{surfaceId:support.id,geometryIdentity:waterfallContactGeometryIdentity(support),edge:'downstream',face:1,normal:[0,1,0],anchor:[1,.5]}}};
    const owner=new MaterialCollarOwner(0,law,{records:4,nodes:20,panels:4}),before=owner.checkpoint(),original=structuredClone(input),prepared=prepareMaterialCollar(before,[input],owner.limits);
    expect(prepared.initial.q.every(p=>p[0]===1&&p[1]===.05)).toBe(true);expect(prepared.originals).toEqual([input]);prepared.originals[0].outflow.volume=999;expect(input).toEqual(original);expect(owner.state).toEqual(before);
    expect(()=>owner.stage([],performance.now()+100)).toThrow('source-off');expect(()=>prepareMaterialCollar(before,[input],{records:4,nodes:7,panels:4})).toThrow('capacity');expect(owner.state).toEqual(before);
    const copy=owner.state;copy.time=99;expect(owner.state).toEqual(before);expect(COLLAR_FIXED_POLICY.maximumNewtonIterations).toBe(20);expect(COLLAR_FIXED_POLICY.maximumBacktrackingHalvings).toBe(8);
  });
});
