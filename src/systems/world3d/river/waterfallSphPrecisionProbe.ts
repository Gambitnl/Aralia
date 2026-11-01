/** Qualifies candidate software arithmetic on the existing river device.
 * This only returns measurements. It never repairs density, advances water,
 * creates another device or changes the independently audited receiver path. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 23:30:49
 * Dependents: systems/world3d/river/waterfallSphReceiverGpuCheck.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {sphSoftFloatWGSL} from './waterfallSphSoftFloat';

export async function probeSphPrecision(device:GPUDevice){
  const cases:{name:string;values:number[];expected:number|number[]}[]=[];
  const add=(name:string,values:number[],expected:number|number[])=>cases.push({name,values,expected});
  // Exact word boundaries catch helper faults independently of floating-point
  // tolerances. Near cancellation and uneven magnitudes stress normalization.
  add('word-zero-shift',[0,0,0,7],[1,2,4,8]);
  add('word-carry-chain',[0,0,0,8],[0,1,0,0]);
  add('word-full-mask',[0,0,0,9],[0,0,0,0xffffffff]);
  const pairs=[[1,1],[1,-1],[1,2**-30],[1+2**-23,1-2**-24],[.2,.24044547975063324],[2048.25,2048],[2**-30,2**30]];
  let seed=712367;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<96;i++)pairs.push([Math.fround((.5+random())*2**Math.floor(random()*60-30)),Math.fround((.5+random())*2**Math.floor(random()*60-30))]);
  pairs.forEach(([x,y],i)=>{
    const a=Math.fround(x),b=Math.fround(y);
    [a+b,a-b,a*b,a/b,Math.sqrt(Math.abs(a)),Math.hypot(a,b)].forEach((expected,op)=>add(`arithmetic-${i}-${op}`,[op===4?Math.abs(a):a,b,0,op===5?6:op],expected));
  });
  const sigma=10/(7*Math.PI),bits=new DataView(new ArrayBuffer(8));bits.setFloat64(0,sigma,false);
  const high=bits.getUint32(0,false),low=bits.getUint32(4,false);
  const sigmaLiteral=`Fp64(${(high&0xfffff)|0x100000}u,${low}u,${((high>>>20)&2047)-1023},0u)`;
  for(const h of [.24044546484947205,.24044547975063324,.24044549465179443,.24044550955295563]){
    for(let j=0;j<45;j++){
      const x=Math.fround((Math.floor(j/9)-1)*.2),y=Math.fround((j%9+.5-4.5)*.2);
      const r=Math.fround(Math.hypot(Math.fround(.2)-x,Math.fround(-.6)-y)),m=Math.fround(1000*.016173037246029705*.2**2);
      const q=r/h,s=q>=2?0:q<1?1-1.5*q*q+.75*q*q*q:.25*(2-q)**3;
      add(`kernel-${h}-${j}`,[r,h,m,5],m*sigma*s/(h*h));
    }
  }
  const shader=sphSoftFloatWGSL+`
@group(0) @binding(0) var<storage,read> inputValues:array<vec4<f32>>;
@group(0) @binding(1) var<storage,read_write> outputValues:array<vec4<u32>>;
fn kernelTerm(r:Fp64,h:Fp64,m:Fp64)->Fp64 {
 let q=fp64_div(r,h);let one=fp64_from_i32(1);let two=fp64_from_i32(2);
 if(fp64_ge(q,two)){return fp64_zero();}
 var shape=fp64_zero();
 if(fp64_lt(q,one)){
  let square=fp64_mul(q,q);
  shape=fp64_add(fp64_sub(one,fp64_mul(fp64_from_f32(1.5),square)),fp64_mul(fp64_from_f32(0.75),fp64_mul(square,q)));
 }else{
  let t=fp64_sub(two,q);shape=fp64_mul(fp64_from_f32(0.25),fp64_mul(fp64_mul(t,t),t));
 }
 return fp64_div(fp64_mul(fp64_mul(m,${sigmaLiteral}),shape),fp64_mul(h,h));
}
@compute @workgroup_size(32)
fn probe(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=arrayLength(&inputValues)){return;}
 let row=inputValues[i];let op=u32(row.w);
 if(op==7u){outputValues[i]=u128_shr(vec4<u32>(1u,2u,4u,8u),0u);return;}
 if(op==8u){outputValues[i]=u128_add(vec4<u32>(0u,0u,0u,0xffffffffu),vec4<u32>(0u,0u,0xffffffffu,1u));return;}
 if(op==9u){let low=u64_low_bits(vec2<u32>(0u,0xffffffffu),32u);outputValues[i]=vec4<u32>(0u,0u,low);return;}
 let a=fp64_from_f32(row.x);let b=fp64_from_f32(row.y);var result=fp64_zero();
 switch op{
  case 0u:{result=fp64_add(a,b);}case 1u:{result=fp64_sub(a,b);}
  case 2u:{result=fp64_mul(a,b);}case 3u:{result=fp64_div(a,b);}
  case 4u:{result=fp64_sqrt(a);}case 5u:{result=kernelTerm(a,b,fp64_from_f32(row.z));}
  case 6u:{result=fp64_sqrt(fp64_add(fp64_mul(a,a),fp64_mul(b,b)));}default:{}
 }
 outputValues[i]=vec4<u32>(result.mantissa_hi,result.mantissa_lo,bitcast<u32>(result.exponent),result.sign);
}`;
  const buffers:GPUBuffer[]=[];
  const make=(size:number,usage:GPUBufferUsageFlags)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};
  const size=cases.length*16,started=performance.now();
  try{
    const module=device.createShaderModule({code:shader,label:'water precision qualification only'});
    const info=await module.getCompilationInfo(),errors=info.messages.filter(m=>m.type==='error');
    if(errors.length)return {status:'COMPILE_FAILED',errors:errors.map(e=>`${e.lineNum}:${e.message}`)};
    const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'probe'}});
    const input=make(size,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),output=make(size,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),readback=make(size,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
    device.queue.writeBuffer(input,0,new Float32Array(cases.flatMap(c=>c.values)));
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}}]});
    const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(cases.length/32));pass.end();encoder.copyBufferToBuffer(output,0,readback,0,size);device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);const words=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();
    let maximumRelativeError=0;const failures:unknown[]=[];
    cases.forEach((c,i)=>{
      const w=Array.from(words.subarray(4*i,4*i+4));
      const expected=c.expected;
      if(Array.isArray(expected)){if(w.some((v,j)=>v!==expected[j]))failures.push({name:c.name,actual:w,expected});return;}
      const actual=(w[3]?-1:1)*(w[0]*2**32+w[1])*2**((w[2]|0)-52);
      const relative=expected===0?Math.abs(actual):Math.abs((actual-expected)/expected);
      maximumRelativeError=Math.max(maximumRelativeError,relative);
      // This is a bounded qualification against double-precision CPU results,
      // not a proof of correctly rounded binary64 over the entire number range.
      if(!Number.isFinite(actual)||relative>1e-12)failures.push({name:c.name,actual,expected:c.expected,relative,words:w});
    });
    return {status:failures.length?'PRECISION_CANDIDATE_REJECTED':'BOUNDED_PRECISION_PASS',cases:cases.length,maximumRelativeError,failures,wallMilliseconds:performance.now()-started,qualification:'Primitive and kernel-term checks only; no density integration or live runtime acceptance'};
  }finally{buffers.forEach(b=>b.destroy());}
}
