/** Runs explicit equation checks on the river renderer's device. No scene
 * state is changed and no new renderer is constructed. Passing checks mean
 * float32 equation parity only, not waterfall appearance or live performance. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 23:30:49
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {createSphReceiverGpu,packSphReceiverParticles} from './waterfallSphReceiverCompute';
import {probeSphPrecision} from './waterfallSphPrecisionProbe';
import {evaluateSphReceiver,sphReceiverKernel,WaterfallSphReceiverPulse,type SphReceiverParticle,type SphReceiverPlane} from './waterfallSphReceiver';

export async function checkSphReceiverGpu(device:GPUDevice,mode:'equations'|'arithmetic'|'device-density'='equations') {
  const depth=.016173037246029705,speed=8.152586848149591,gn=6.598920109103825;
  const plane:SphReceiverPlane={normalGravity:gn,tangentGravity:Math.sqrt(9.81**2-gn**2),referenceDepth:depth,maximumSupportRadius:8};
  const started=performance.now(),checks:unknown[]=[],errors:string[]=[];
  const gpuError=(event:GPUUncapturedErrorEvent)=>errors.push(event.error.message);
  device.addEventListener('uncapturederror',gpuError);
  let gpu:Awaited<ReturnType<typeof createSphReceiverGpu>>|null=null;
  try{
    gpu=await createSphReceiverGpu(device);
    const quantize=(p:SphReceiverParticle[])=>{
      const a=packSphReceiverParticles(p);
      return p.map((v,i)=>({...v,x:a[i*8],y:a[i*8+1],vx:a[i*8+2],vy:a[i*8+3],mass:a[i*8+4],rho:a[i*8+5],h0:a[i*8+6]}));
    };
    // Compare against the actual uploaded values. The separate displacement
    // check below records input quantization rather than disguising it as GPU error.
    const qPlane={normalGravity:Math.fround(plane.normalGravity),tangentGravity:Math.fround(plane.tangentGravity),
      referenceDepth:Math.fround(1000*depth)/1000,maximumSupportRadius:8};
    const patch=(spacing:number,rows:number,cols:number)=>Array.from({length:rows*cols},(_,i)=>{
      const x=(Math.floor(i/cols)-1)*spacing,y=(i%cols+.5-cols/2)*spacing;
      return {x,y,vx:2-.3*x,vy:-.2*y,mass:1000*depth*spacing**2,rho:1000*depth,h0:1.2*spacing,resident:x>=0};
    });
    if(mode==='arithmetic'){
      const input=quantize(patch(.2,5,9)),index=19,a=input[index];
      const radii=[0.24044546484947205,0.24044547975063324,0.24044549465179443,0.24044550955295563];
      const samples=await gpu.probeSupport(input,qPlane,index,radii),sigma=10/(7*Math.PI),required=1000*qPlane.referenceDepth*a.h0*a.h0;
      const comparison=samples.map(sample=>{
        const terms=input.map((b,j)=>{
          const r=Math.hypot(a.x-b.x,a.y-b.y),q=r/sample.h;
          const exact=b.mass*sphReceiverKernel(r,sample.h)[0]*sample.h*sample.h;
          return {j,exact,gpu:sample.terms[j],distanceError:sample.terms[j][0]-r,quotientError:sample.terms[j][1]-q};
        });
        const trueSum=terms.reduce((s,t)=>s+t.exact,0),reportedTermSum=terms.reduce((s,t)=>s+t.gpu[3],0);
        return {...sample,terms,trueRequired:required,trueSum,reportedTermSum,
          targetRelativeError:sample.summary[0]/required-1,
          sigmaRelativeError:sample.summary[2]/sigma-1,
          termRelativeError:reportedTermSum/trueSum-1,
          accumulationRelativeError:sample.summary[1]/reportedTermSum-1,
          trueResidual:Math.abs(trueSum/required-1),shaderResidual:Math.abs(sample.summary[1]/sample.summary[0]-1)};
      });
      const precision=await probeSphPrecision(device);
      return {status:'ARITHMETIC_DIAGNOSIS_ONLY',index,comparison,precision,errors,wallMilliseconds:performance.now()-started};
    }
    if(mode==='device-density'){
      // Stop at the first accuracy failure. Timing is recorded for complete
      // device evaluations, separately from compilation and observer readback.
      for(const [name,particles] of [['compressing-45',patch(.2,5,9)],['capacity-640',patch(.125,8,80)]] as const){
        if(performance.now()-started>60000)throw Error('Device density study ceiling before next case');
        const input=quantize([...particles]);const cpu=evaluateSphReceiver(input,qPlane,1e-12);
        const actual=await gpu.evaluate(input,qPlane,'device-density');
        let residual=0,alphaError=0,forceError=0,rootError=0;
        input.forEach((a,i)=>{
          if(a.resident){
            let gathered=0,alpha=0;
            input.forEach(b=>{const r=Math.hypot(a.x-b.x,a.y-b.y);const [w,dw]=sphReceiverKernel(r,actual.h[i]);gathered+=b.mass*w;alpha-=b.mass*r*dw;});
            residual=Math.max(residual,Math.abs(gathered/actual.rho[i]-1),Math.abs(actual.h[i]/(a.h0*Math.sqrt(1000*qPlane.referenceDepth/actual.rho[i]))-1));
            alphaError=Math.max(alphaError,Math.abs(actual.alpha[i]/alpha-1));
            rootError=Math.max(rootError,Math.abs(actual.h[i]/cpu.h[i]-1));
          }
          forceError=Math.max(forceError,...actual.acceleration[i].map((v,axis)=>Math.abs(v-cpu.acceleration[i][axis])/(1+Math.abs(cpu.acceleration[i][axis]))));
        });
        const accepted=residual<=1e-7&&alphaError<=1e-7&&rootError<=1e-5&&forceError<=2e-5;
        checks.push({name,count:input.length,accepted,residual,alphaError,forceError,rootError,densityAudit:actual.densityAudit,
          gpuPassMilliseconds:actual.gpuPassMilliseconds,deviceCompilationMilliseconds:actual.deviceCompilationMilliseconds,
          wallMilliseconds:actual.wallMilliseconds});
        if(!accepted)throw Error('Complete device-density comparison failed: '+name);
        const deviceTimes=Object.values(actual.gpuPassMilliseconds);
        const deviceTotal=deviceTimes.every(t=>typeof t==='number')?deviceTimes.reduce((sum,t)=>sum+(t??0),0):null;
        // A small case already taking 25 ms is far outside the native sub-ms
        // step budget. Stop before a larger dispatch can stall the live device.
        // This is a rejection screen, never a relaxed performance acceptance.
        if(name==='compressing-45'&&deviceTotal!==null&&deviceTotal>25){
          return {status:'DEVICE_DENSITY_RUNTIME_REJECTED',checks,deviceTotalMilliseconds:deviceTotal,
            skipped:'640-particle case and remaining fixtures not executed after small-case cost failure',errors,
            qualification:'No live integration; native fine-step budget remains unchanged'};
        }
      }
      const rho0=Math.fround(20/(7*Math.PI));
      const badPair=[0,1/256].map(x=>({x,y:0,vx:0,vy:0,mass:1,rho:Math.fround(.0005960215930826962),h0:1,resident:true}));
      try{
        const actual=await gpu.evaluate(badPair,{...qPlane,referenceDepth:rho0/1000,maximumSupportRadius:100},'device-density');
        const root=19.219062737338998,rho=.0024621678750193937;
        const rootError=Math.max(...actual.h.map(h=>Math.abs(h/root-1)));
        const pressureError=Math.max(...actual.rho.map(r=>Math.abs(r/rho-1)));
        const accepted=rootError<=1e-5&&pressureError<=2e-5;
        checks.push({name:'ill-conditioned-pair',accepted,rootError,pressureError,actual});
        if(!accepted)throw Error('Ill-conditioned pair falsely accepted');
      }catch(error){
        // A conditioning rejection is honest; a numerical acceptance at the
        // old wrong root is a failure. Keep this distinction in the receipt.
        if(!/GPU failure 7|forward support accuracy/.test(String(error)))throw error;
        checks.push({name:'ill-conditioned-pair',accepted:true,rejectedAsUnresolved:String(error)});
      }
      let rejected=false;
      try{await gpu.evaluate(quantize(patch(.2,5,9)),{...qPlane,maximumSupportRadius:.1},'device-density');}
      catch(error){rejected=/failure 1|support capacity/.test(String(error));}
      checks.push({name:'support-capacity',accepted:rejected});
      if(!rejected)throw Error('Support capacity was not preserved');
      if(errors.length)throw Error(errors.join('\n'));
      return {status:'DEVICE_DENSITY_CHECK_COMPLETE',checks,errors,wallMilliseconds:performance.now()-started,
        qualification:'Equation/conditioning/timing experiment only; no live ownership, trajectory or visual acceptance'};
    }
    const pulse=new WaterfallSphReceiverPulse({...plane,port:{h:depth,s:speed,q:depth*speed,ve:0},width:10,pulseLength:1,spacing:.5});
    const cases=[{name:'dry-buffer',particles:pulse.snapshot().particles},
      {name:'compressing-buffer',particles:patch(.2,5,9)},
      {name:'capacity-640',particles:patch(.125,8,80)},
      // Reordering, translated coordinates, unequal masses and both dominant
      // axes exercise the neighborhood search against the independent dense
      // residual. The same support and force criteria apply to every case.
      {name:'translated-shuffled',particles:patch(.2,5,9).reverse().map((p,i)=>({...p,x:p.x+2048,y:p.y-4096,mass:p.mass*(1+.02*(i%3))}))},
      {name:'axis-swapped',particles:patch(.2,5,9).map(p=>({...p,x:p.y,y:p.x,vx:p.vy,vy:p.vx}))},
      {name:'post-shutoff-spread',particles:[] as SphReceiverParticle[]}];
    // The original failed trace is preserved in the prior receipt. This run
    // tests the independently audited density boundary, not that failed replay.
    for(const c of cases){
      if(performance.now()-started>60000)throw Error('60-second GPU equation check ceiling');
      if(c.name==='post-shutoff-spread'){
        // Do not spend time generating a trajectory if an earlier equation
        // check already failed. This reference replay never enters a frame loop.
        for(let i=0;i<pulse.totalSteps;i++)pulse.step();
        c.particles=pulse.snapshot().particles;
      }
      const input=quantize(c.particles),cpu=evaluateSphReceiver(input,qPlane),actual=await gpu.evaluate(input,qPlane,'mixed-precision');
      const differences:Record<string,number>={};let accepted=true;
      const compare=(label:string,a:number[],b:number[],absolute:number,relative:number)=>{
        differences[label]=Math.max(0,...a.map((v,i)=>Math.abs(v-b[i])));
        if(a.some((v,i)=>Math.abs(v-b[i])>absolute+relative*Math.abs(b[i])))accepted=false;
      };
      compare('density',actual.rho,cpu.rho,1e-5,2e-5);
      compare('support',actual.h,cpu.h,1e-6,2e-5);
      compare('acceleration',actual.acceleration.flat(),cpu.acceleration.flat(),2e-5,2e-5);
      compare('bufferForce',actual.bufferForce,cpu.bufferForce,2e-5,2e-5);
      compare('bufferWork',[actual.bufferForcePower,actual.bufferPressureStoragePower],[cpu.bufferForcePower,cpu.bufferPressureStoragePower],2e-5,2e-5);
      compare('internalLF',[...actual.internalLFForce,actual.internalLFPower],[...cpu.internalLFForce,cpu.internalLFPower],2e-5,2e-5);
      // Independent double-precision residual on the uploaded inputs exposes
      // arithmetic error that the shader's own residual cannot certify.
      const independentResidual=Math.max(0,...input.map((a,i)=>a.resident?Math.abs(input.reduce((s,b)=>s+b.mass*sphReceiverKernel(Math.hypot(a.x-b.x,a.y-b.y),actual.h[i])[0],0)/actual.rho[i]-1):0));
      const pressureRelativeError=Math.max(0,...actual.rho.map((r,i)=>Math.abs((r/cpu.rho[i])**2-1)));
      checks.push({name:c.name,count:input.length,accepted,differences,
        independentResidual,pressureRelativeError,densityAudit:actual.densityAudit,
        maximumPositionQuantization:Math.max(...input.map((p,i)=>Math.hypot(p.x-c.particles[i].x,p.y-c.particles[i].y))),
        densityIterations:actual.densityIterations,densityResidual:actual.densityResidual,interactingPairs:actual.pairCount,method:actual.method,
        submitToReadbackMilliseconds:actual.wallMilliseconds,gpuPassMilliseconds:actual.gpuPassMilliseconds});
      if(!accepted)throw Error(`Float32 equation parity failed: ${c.name}`);
    }
    // This is deliberately too small for the physical support. A shader that
    // clamps h or silently drops water would incorrectly accept this case.
    let rejected=false;
    try{await gpu.evaluate(patch(.2,5,9),{...plane,maximumSupportRadius:.1},'mixed-precision');}
    catch(e){rejected=/failure 1|support capacity/.test(String(e));}
    if(!rejected)throw Error('GPU support exhaustion was not rejected');
    checks.push({name:'support-capacity-rejection',accepted:true});
    if(errors.length)throw Error(errors.join('\n'));
    return {status:'GPU_EQUATIONS_PASS_NOT_LIVE_QUALIFIED',checks,errors,wallMilliseconds:performance.now()-started,
      renderer:'existing river WebGPU device',qualification:'Equation parity only; no timestep/ownership/reconstruction or performance acceptance'};
  }catch(e){return {status:'FAILED',reason:String(e),trace:(e as {densityTrace?:number[][]}).densityTrace,checks,errors,wallMilliseconds:performance.now()-started};}
  finally{gpu?.dispose();device.removeEventListener('uncapturederror',gpuError);}
}
