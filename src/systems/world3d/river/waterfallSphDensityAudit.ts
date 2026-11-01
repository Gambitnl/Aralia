/**
 * Independent CPU check for the values a GPU water-density solve will store.
 * It checks every resident, including shader-reported successes. Rounding
 * exhaustion can be repaired in double precision without changing mass,
 * ownership, the density equations or their 1e-7 residual requirement.
 *
 * This is a bounded experimental boundary, not a live frame-loop fallback.
 * Readback cost, force/energy error and visual behavior need separate proof.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 22:22:18
 * Dependents: systems/world3d/river/waterfallSphReceiverCompute.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {sphReceiverKernel, type SphReceiverParticle, type SphReceiverPlane} from './waterfallSphReceiver';

const TOLERANCE=1e-7, SIGMA=10/(7*Math.PI);
const neighbors=(value:number)=>{
  const f=new Float32Array([value]),bits=new Uint32Array(f.buffer),center=bits[0];
  return [-1,0,1].map(offset=>{bits[0]=center+offset;return f[0];});
};

export interface SphDensityProposal {rho:number;h:number;alpha:number;code:number}

// Like the native receiver's compact-support buckets, this index only skips
// pairs whose kernel is exactly zero. Sort on the longer axis so a narrow,
// long runoff does not spend its audit visiting the whole river for each drop.
// Candidates return in original particle order, preserving dense sums.
function supportIndex(particles:readonly SphReceiverParticle[]){
  const extent=(axis:'x'|'y')=>Math.max(...particles.map(p=>p[axis]))-Math.min(...particles.map(p=>p[axis]));
  const axis=extent('x')>extent('y')?'x':'y';
  const order=particles.map((_,i)=>i).sort((a,b)=>particles[a][axis]-particles[b][axis]);
  const lowerBound=(value:number)=>{
    let lo=0,hi=order.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(particles[order[mid]][axis]<value)lo=mid+1;else hi=mid;}
    return lo;
  };
  return (a:SphReceiverParticle,radius:number)=>{
    // Round the search box outwards. The exact distance check below still
    // determines support; this padding can only add work, never water.
    const pad=8*Number.EPSILON*(Math.abs(a[axis])+radius+1);
    const start=lowerBound(a[axis]-radius-pad),end=lowerBound(a[axis]+radius+pad);
    const candidates=order.slice(start,end).sort((a,b)=>a-b);
    const pairs:{j:number;r:number}[]=[];
    for(const j of candidates){
      const b=particles[j];
      if(Math.abs(a.x-b.x)>radius||Math.abs(a.y-b.y)>radius)continue;
      const r=Math.hypot(a.x-b.x,a.y-b.y);if(r<=radius)pairs.push({j,r});
    }
    return pairs;
  };
}

/** Input must be the exact uploaded Float32 values, not pre-quantization data.
 * Codes 3/5 mean bounded iteration/precision exhaustion. All other failures
 * retain the original hard rejection. No source or scene state is mutated. */
export function auditSphDensity(particles:readonly SphReceiverParticle[],plane:SphReceiverPlane,proposals:readonly SphDensityProposal[]){
  const rho0=1000*plane.referenceDepth,n=particles.length;
  if(!n||n>640||proposals.length!==n||!(rho0>0)||Math.fround(rho0)!==rho0
    ||!(plane.maximumSupportRadius>0)||!Number.isFinite(plane.maximumSupportRadius))throw Error('Invalid density audit capacity/plane');
  for(const a of particles){
    if([a.x,a.y,a.vx,a.vy,a.mass,a.rho,a.h0].some(v=>!Number.isFinite(v)||Math.fround(v)!==v)
      ||a.mass<=0||a.rho<=0||a.h0<=0)throw Error('Density audit requires exact uploaded Float32 particles');
  }
  const querySupport=supportIndex(particles);
  const fields=new Float32Array(n*4);let repaired=0,falseSuccesses=0,alphaRepairs=0,maxResidual=0,maxCondition=0,rootSolves=0;
  for(let i=0;i<n;i++){
    const a=particles[i],proposal=proposals[i];
    if(![0,3,5].includes(proposal.code))throw Error(`Density audit preserves GPU failure ${proposal.code} at ${i}`);
    if(proposal.code===0&&(![proposal.rho,proposal.h,proposal.alpha].every(Number.isFinite)||proposal.rho<=0||proposal.h<=0||proposal.alpha<=0))throw Error('Density audit preserves invalid GPU state');
    if(2*a.h0>plane.maximumSupportRadius)throw Error('Density audit support capacity');
    if(!a.resident){fields.set([rho0,a.h0,2*rho0,0],i*4);continue;}
    let bound=0,pairs:{j:number;r:number}[]=[];
    const ensureSupport=(h:number)=>{
      if(2*h>bound){
        // A small overfetch lets neighboring Float32 support trials share
        // distances. Expanding roots always re-query before summation.
        bound=Math.min(2*h*1.125,plane.maximumSupportRadius);
        pairs=querySupport(a,bound);
      }
    };
    // Compact support is exactly zero outside 2h. Skip that known-zero
    // calculation without dropping a particle or truncating a neighborhood.
    const gather=(h:number)=>{
      ensureSupport(h);let sum=0;
      for(const {j,r} of pairs)if(r<2*h)sum+=particles[j].mass*sphReceiverKernel(r,h)[0];
      return sum;
    };
    const gathered=new Map<number,number>();
    const cachedGather=(h:number)=>{if(!gathered.has(h))gathered.set(h,gather(h));return gathered.get(h)!;};
    const score=(h:number,rho:number)=>{
      if(!(h>0&&rho>0)||!Number.isFinite(h+rho)||2*h>plane.maximumSupportRadius
        ||Math.fround(h)!==h||Math.fround(rho)!==rho)return Infinity;
      return Math.max(Math.abs(cachedGather(h)/rho-1),Math.abs(h/(a.h0*Math.sqrt(rho0/rho))-1));
    };
    let {h,rho}=proposal,residual=score(h,rho);
    if(proposal.code!==0||residual>TOLERANCE){
      if(proposal.code===0)falseSuccesses++;
      const required=rho0*a.h0*a.h0;
      const selectPair=(centerH:number,centerRho:number)=>{
        for(const candidateH of neighbors(centerH))for(const candidateRho of neighbors(centerRho)){
          const candidateScore=score(candidateH,candidateRho);
          if(candidateScore<residual){residual=candidateScore;h=candidateH;rho=candidateRho;}
        }
      };
      // A shader can reach the right support but misjudge its residual. Try
      // neighboring stored values first, with exactly the same independent
      // checks. Only an unqualified neighborhood needs a full root search.
      if(residual>TOLERANCE&&proposal.h>0&&Number.isFinite(proposal.h)){
        selectPair(proposal.h,required/(proposal.h*proposal.h));
      }
      if(residual>TOLERANCE){
      rootSolves++;
      const coincident=particles.reduce((s,b)=>s+(a.x===b.x&&a.y===b.y?b.mass*SIGMA:0),0);
      const total=particles.reduce((s,b)=>s+b.mass*SIGMA,0);
      if(!(required>coincident&&required<total))throw Error('Density audit has no unique finite support root');
      let lo=0,hi=plane.maximumSupportRadius/2;
      if(gather(hi)*hi*hi<required)throw Error('Density audit support capacity');
      for(let iteration=0;iteration<64;iteration++){
        const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;
        if(gather(mid)*mid*mid<required)lo=mid;else hi=mid;
      }
      const root=(lo+hi)/2;residual=Infinity;
      // Check stored pairs, not just the unrounded double-precision root.
      selectPair(root,required/(root*root));
      }
      if(residual>TOLERANCE)throw Error(`Density audit has no qualified stored pair at ${i}`);
      repaired++;
    }
    // A small residual can hide a distant solution when density changes very
    // little with support size. Require a separate numerical bracket around
    // every accepted stored h, including shader-reported successes. The 1e-5
    // forward-support budget is additional to, never a replacement for, both
    // original 1e-7 residual checks. This empirical roundoff allowance is not
    // an interval proof; uncertain signs reject and retain the caller's state.
    const requiredSupportMass=rho0*a.h0*a.h0;
    const lowerH=h*(1-1e-5),upperH=Math.min(h*(1+1e-5),plane.maximumSupportRadius/2);
    const lowerMass=gather(lowerH)*lowerH*lowerH,upperMass=gather(upperH)*upperH*upperH;
    const roundoff=32*Number.EPSILON*n*Math.max(requiredSupportMass,Math.abs(lowerMass),Math.abs(upperMass));
    if(!Number.isFinite(lowerMass+upperMass+requiredSupportMass)
      ||!(lowerMass+roundoff<requiredSupportMass&&upperMass-roundoff>requiredSupportMass)){
      throw Error('Density audit unresolved forward support accuracy');
    }
    ensureSupport(h);let derivativeSum=0;
    for(const {j,r} of pairs)if(r<2*h)derivativeSum+=particles[j].mass*r*sphReceiverKernel(r,h)[1];
    const exactAlpha=-derivativeSum;
    const alpha=Math.fround(exactAlpha);
    if(!(alpha>0)||!Number.isFinite(alpha)||Math.abs(alpha/exactAlpha-1)>TOLERANCE)throw Error('Density audit invalid pressure coefficient');
    if(!Number.isFinite(proposal.alpha)||Math.abs(proposal.alpha/exactAlpha-1)>TOLERANCE)alphaRepairs++;
    maxCondition=Math.max(maxCondition,2*rho/exactAlpha);maxResidual=Math.max(maxResidual,residual);
    fields.set([rho,h,alpha,residual],i*4);
  }
  return {fields,repaired,falseSuccesses,alphaRepairs,maxResidual,maxCondition,rootSolves};
}
