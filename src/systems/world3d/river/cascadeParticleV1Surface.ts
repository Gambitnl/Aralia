/**
 * Builds a continuous water surface from the isolated particle experiment's live state.
 * The solver retains ownership of particles; this helper only reconstructs and draws
 * a fixed world-space density contour. It never changes water mass or native optics.
 * Its signed mesh volume is an independent measurement, pending calibration controls.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 13:29:11
 * Dependents: systems/world3d/river/cascadeParticleV1.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface CascadeParticleSurfaceOptions {
  device: GPUDevice;
  spacing: number;
  particleCapacity: number;
  sampleCapacity: number;
  vertexCapacity: number;
  positions: GPUBuffer;
  velocities: GPUBuffer;
  params: GPUBuffer;
}

export interface CascadeParticleSurfaceDiagnostics {
  signedVolume: number;
  samples: number;
  vertices: number;
  /** Bit 1: vertices; 2: hash probes; 4: integer density wrap; 8: lattice bounds. Freeze on any bit. */
  overflow: number;
  calibrationQualified: false;
}

// Density uses integer atomics because portable WGSL has no float atomic addition.
// Each contribution is rounded once at a fixed scale; the calibration control must
// measure this error along with lattice and contour error. There is no frame fitting.
const DENSITY_SCALE = 1048576;
const common = `
struct Params { a: vec4f, b: vec4f, c: vec4f, unused: vec4f }
struct Surface { dims: vec4u, caps: vec4u, values: vec4f }
@group(0) @binding(0) var<uniform> surface: Surface;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read_write> keys: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> density: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> stats: array<atomic<u32>>;
fn hash(k: u32) -> u32 { var x=k; x=(x^(x>>16u))*2246822519u; x=(x^(x>>13u))*3266489917u; return (x^(x>>16u))%surface.caps.x; }
fn key(p: vec3i) -> u32 {
 if(any(p<vec3i(0)) || any(p>=vec3i(surface.dims.xyz))) { return 0u; }
 return 1u+u32(p.x)+surface.dims.x*(u32(p.y)+surface.dims.y*u32(p.z));
}
fn point(k: u32) -> vec3i { let n=k-1u; return vec3i(i32(n%surface.dims.x),i32((n/surface.dims.x)%surface.dims.y),i32(n/(surface.dims.x*surface.dims.y))); }
fn lookup(k: u32) -> f32 {
 if(k==0u){return 0.0;} let start=hash(k);
 for(var j=0u;j<256u;j++){let slot=(start+j)%surface.caps.x;let found=atomicLoad(&keys[slot]);if(found==k){return f32(atomicLoad(&density[slot]))/${DENSITY_SCALE}.0;}if(found==0u){return 0.0;}}
 atomicOr(&stats[2],2u);return 0.0;
}
fn world(p:vec3i)->vec3f{return (vec3f(p)-vec3f(3.0))*surface.values.x;}
`;

const clearShader = `${common}
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) id:vec3u){
 if(id.x<surface.caps.x){atomicStore(&keys[id.x],0u);atomicStore(&density[id.x],0u);}
 if(id.x<16u){atomicStore(&stats[id.x],0u);}
}`;

const depositShader = `${common}
@group(0) @binding(5) var<storage,read> positions:array<vec4f>;
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) id:vec3u){
 if(id.x>=min(u32(params.a.w),surface.caps.z)){return;}let particle=positions[id.x];if(particle.w!=1.0){return;}
 let d=surface.values.x;let center=vec3i(floor(particle.xyz/d))+vec3i(3);
 // Include the lower-cell halo even where density is zero: otherwise a cell
 // whose upper corner is wet could disappear merely because its lower corner is dry.
 for(var z=-3;z<=2;z++){for(var y=-3;y<=2;y++){for(var x=-3;x<=2;x++){
 let p=center+vec3i(x,y,z);let q=distance(world(p),particle.xyz)/d;
 var w=0.0;if(q<1.0){w=1.0-1.5*q*q+0.75*q*q*q;}else if(q<2.0){w=0.25*pow(2.0-q,3.0);}w/=3.141592653589793;
 let k=key(p);if(k==0u){atomicOr(&stats[2],8u);continue;}let start=hash(k);var inserted=false;
 for(var j=0u;j<256u;j++){let slot=(start+j)%surface.caps.x;var claim=atomicCompareExchangeWeak(&keys[slot],0u,k);
 // Weak compare/exchange may fail spuriously. Retry that same empty slot so
 // concurrent particles cannot put a duplicate lattice key farther down the chain.
 loop {if(claim.exchanged || claim.old_value!=0u){break;}claim=atomicCompareExchangeWeak(&keys[slot],0u,k);}
 if(claim.exchanged || claim.old_value==k){if(claim.exchanged){atomicAdd(&stats[0],1u);}let delta=u32(round(w*${DENSITY_SCALE}.0));let prior=atomicAdd(&density[slot],delta);if(prior>4294967295u-delta){atomicOr(&stats[2],4u);}inserted=true;break;}}
 if(!inserted){atomicOr(&stats[2],2u);}
 }}}
}`;

const extractShader = `${common}
@group(0) @binding(5) var<storage,read_write> vertices:array<vec4f>;
@group(0) @binding(6) var<storage,read_write> normals:array<vec4f>;
@group(0) @binding(7) var<storage,read_write> partials:array<f32>;
var<workgroup> volumes:array<f32,128>;
fn interpolate(a:vec3f,b:vec3f,va:f32,vb:f32)->vec3f{return mix(a,b,clamp((surface.values.y-va)/(vb-va),0.0,1.0));}
fn triangle(a:vec3f,b:vec3f,c:vec3f,outward:vec3f)->f32{
 var bb=b;var cc=c;var n=cross(bb-a,cc-a);if(dot(n,outward)<0.0){bb=c;cc=b;n=-n;}
 if(dot(n,n)<1e-24){return 0.0;}let start=atomicAdd(&stats[1],3u);
 if(start>surface.caps.y-3u){atomicOr(&stats[2],1u);return 0.0;}
 vertices[start]=vec4f(a,1.0);vertices[start+1u]=vec4f(bb,1.0);vertices[start+2u]=vec4f(cc,1.0);
 let normal=vec4f(normalize(n),0.0);normals[start]=normal;normals[start+1u]=normal;normals[start+2u]=normal;
 // A fixed interior origin reduces cancellation without moving the surface.
 let origin=vec3f(4.0,1.5,3.0);return dot(a-origin,cross(bb-origin,cc-origin))/6.0;
}
fn tetra(p:array<vec3f,4>,v:array<f32,4>)->f32{
 var inside:array<u32,4>;var outside:array<u32,4>;var ni=0u;var no=0u;
 for(var j=0u;j<4u;j++){if(v[j]>=surface.values.y){inside[ni]=j;ni++;}else{outside[no]=j;no++;}}
 if(ni==0u || ni==4u){return 0.0;}var direction=vec3f(0.0);for(var j=0u;j<no;j++){direction+=p[outside[j]]/f32(no);}for(var j=0u;j<ni;j++){direction-=p[inside[j]]/f32(ni);}
 if(ni==1u){let a=inside[0];return triangle(interpolate(p[a],p[outside[0]],v[a],v[outside[0]]),interpolate(p[a],p[outside[1]],v[a],v[outside[1]]),interpolate(p[a],p[outside[2]],v[a],v[outside[2]]),direction);}
 if(ni==3u){let a=outside[0];return triangle(interpolate(p[a],p[inside[0]],v[a],v[inside[0]]),interpolate(p[a],p[inside[1]],v[a],v[inside[1]]),interpolate(p[a],p[inside[2]],v[a],v[inside[2]]),direction);}
 let a=inside[0];let b=inside[1];let c=outside[0];let e=outside[1];
 let ac=interpolate(p[a],p[c],v[a],v[c]);let ae=interpolate(p[a],p[e],v[a],v[e]);let bc=interpolate(p[b],p[c],v[b],v[c]);let be=interpolate(p[b],p[e],v[b],v[e]);
 return triangle(ac,bc,ae,direction)+triangle(ae,bc,be,direction);
}
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) id:vec3u,@builtin(local_invocation_index) local:u32,@builtin(workgroup_id) group:vec3u){
 var volume=0.0;
 if(id.x<surface.caps.x){let k=atomicLoad(&keys[id.x]);if(k!=0u){let base=point(k);
 let offsets=array<vec3i,8>(vec3i(0,0,0),vec3i(1,0,0),vec3i(0,1,0),vec3i(1,1,0),vec3i(0,0,1),vec3i(1,0,1),vec3i(0,1,1),vec3i(1,1,1));
 var p:array<vec3f,8>;var v:array<f32,8>;for(var j=0u;j<8u;j++){p[j]=world(base+offsets[j]);v[j]=lookup(key(base+offsets[j]));}
 // Shared cube faces use the same diagonal, so neighboring cells meet continuously.
 let tets=array<vec4u,6>(vec4u(0,1,3,7),vec4u(0,3,2,7),vec4u(0,2,6,7),vec4u(0,6,4,7),vec4u(0,4,5,7),vec4u(0,5,1,7));
 for(var j=0u;j<6u;j++){let t=tets[j];volume+=tetra(array<vec3f,4>(p[t.x],p[t.y],p[t.z],p[t.w]),array<f32,4>(v[t.x],v[t.y],v[t.z],v[t.w]));}
 }}volumes[local]=volume;workgroupBarrier();
 for(var stride=64u;stride>0u;stride/=2u){if(local<stride){volumes[local]+=volumes[local+stride];}workgroupBarrier();}
 if(local==0u){partials[group.x]=volumes[0];}
}`;

const finishShader = `${common}
@group(0) @binding(5) var<storage,read> partials:array<f32>;
@group(0) @binding(6) var<storage,read_write> indirect:array<u32>;
@compute @workgroup_size(1) fn main(){var volume=0.0;for(var j=0u;j<surface.caps.w;j++){volume+=partials[j];}atomicStore(&stats[3],bitcast<u32>(volume));
 indirect[0]=select(min(atomicLoad(&stats[1]),surface.caps.y),0u,atomicLoad(&stats[2])!=0u);indirect[1]=1u;indirect[2]=0u;indirect[3]=0u;
}`;

const drawShader = `
@group(0) @binding(0) var<uniform> camera:mat4x4f;
struct Out {@builtin(position) position:vec4f,@location(0) normal:vec3f}
@vertex fn vertex(@location(0) position:vec4f,@location(1) normal:vec4f)->Out{var o:Out;o.position=camera*position;o.normal=normal.xyz;return o;}
@fragment fn fragment(input:Out)->@location(0) vec4f {let light=0.35+0.65*abs(dot(normalize(input.normal),normalize(vec3f(0.4,1.0,0.3))));return vec4f(vec3f(0.06,0.36,0.48)*light,1.0);}
`;

export function createCascadeParticleSurface(options: CascadeParticleSurfaceOptions) {
  const { device, spacing, sampleCapacity, vertexCapacity, particleCapacity } = options;
  if (!Number.isFinite(spacing) || !(spacing > 0) || !Number.isInteger(particleCapacity) || particleCapacity < 1 || !Number.isInteger(sampleCapacity) || sampleCapacity < 128 || !Number.isInteger(vertexCapacity) || vertexCapacity < 3) {
    throw new Error('Surface spacing and capacities must be finite positive declared values.');
  }
  const groups = Math.ceil(sampleCapacity / 128);
  const dimensions = [Math.ceil(8 / spacing) + 7, Math.ceil(3 / spacing) + 7, Math.ceil(6 / spacing) + 7];
  if (dimensions.reduce((a, b) => a * b, 1) >= 4294967295 || groups > device.limits.maxComputeWorkgroupsPerDimension || Math.ceil(particleCapacity / 128) > device.limits.maxComputeWorkgroupsPerDimension || device.limits.maxStorageBuffersPerShaderStage < 6 || device.limits.maxComputeInvocationsPerWorkgroup < 128 || device.limits.maxComputeWorkgroupSizeX < 128) {
    throw new Error('Surface lattice keys or compute dispatch exceed the actual device limits.');
  }
  for (const size of [sampleCapacity * 4, vertexCapacity * 16, groups * 4, 64]) {
    if (size > device.limits.maxBufferSize || size > device.limits.maxStorageBufferBindingSize) throw new Error(`Surface allocation ${size} bytes exceeds actual device limits.`);
  }
  const allocated: GPUBuffer[] = [];
  const make = (label: string, size: number, usage: GPUBufferUsageFlags) => {
    if (size > device.limits.maxBufferSize || ((usage & GPUBufferUsage.STORAGE) !== 0 && size > device.limits.maxStorageBufferBindingSize)) {
      throw new Error(`${label}: ${size} bytes exceeds the actual device buffer limit.`);
    }
    const buffer = device.createBuffer({ label, size, usage }); allocated.push(buffer); return buffer;
  };
  const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
  const keys = make('cascade surface lattice keys', sampleCapacity * 4, storage);
  const density = make('cascade surface lattice density', sampleCapacity * 4, storage);
  const stats = make('cascade surface diagnostics', 64, storage);
  const vertices = make('cascade surface positions', vertexCapacity * 16, storage | GPUBufferUsage.VERTEX);
  const normals = make('cascade surface normals', vertexCapacity * 16, storage | GPUBufferUsage.VERTEX);
  const partials = make('cascade surface volume partials', groups * 4, storage);
  const indirect = make('cascade surface draw count', 16, storage | GPUBufferUsage.INDIRECT);
  const uniform = make('cascade surface fixed settings', 48, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  const camera = make('cascade surface camera', 64, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  const settings = new ArrayBuffer(48);
  new Uint32Array(settings).set([...dimensions, 0, sampleCapacity, vertexCapacity, particleCapacity, groups]);
  new Float32Array(settings).set([spacing, 0.5, 0, 0], 8);
  device.queue.writeBuffer(uniform, 0, settings);
  const base = [uniform, options.params, keys, density, stats];
  const modules: GPUShaderModule[] = [];
  const compute = (label: string, code: string, buffers: GPUBuffer[]) => {
    const module = device.createShaderModule({ label, code }); modules.push(module);
    const pipeline = device.createComputePipeline({ label, layout: 'auto', compute: { module, entryPoint: 'main' } });
    // Automatic layouts omit unused declarations in each entry point.
    const used = label === 'clear' ? [0, 2, 3, 4] : label === 'deposit' ? [0, 1, 2, 3, 4, 5] : label === 'extract' ? [0, 2, 3, 4, 5, 6, 7] : [0, 4, 5, 6];
    const bindings = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: used.map(binding => ({ binding, resource: { buffer: buffers[binding] } })) });
    return { pipeline, bindings };
  };
  const clear = compute('clear', clearShader, base);
  const deposit = compute('deposit', depositShader, [...base, options.positions]);
  const extract = compute('extract', extractShader, [...base, vertices, normals, partials]);
  const finish = compute('finish', finishShader, [...base, partials, indirect]);
  const drawModule = device.createShaderModule({ label: 'cascade diagnostic surface draw', code: drawShader });
  modules.push(drawModule);
  const renderPipelines = new Map<GPUTextureFormat, GPURenderPipeline>();
  let depth: GPUTexture | undefined;
  let depthWidth = 0;
  let depthHeight = 0;
  let disposed = false;
  return {
    peakBytes: allocated.reduce((sum, buffer) => sum + buffer.size, 0),
    calibrationQualified: false as const,
    buffers: { vertices, normals, indirect, stats },
    // The owning browser runner must call this before its first physical attempt;
    // a TypeScript pass cannot establish that the target GPU accepts these shaders.
    async validateShaders() {
      const reports = await Promise.all(modules.map(module => module.getCompilationInfo()));
      const errors = reports.flatMap(report => report.messages.filter(message => message.type === 'error').map(message => `${message.lineNum}:${message.linePos} ${message.message}`));
      if (errors.length) throw new Error(`Surface WGSL compilation failed: ${errors.join('; ')}`);
      return reports.flatMap(report => report.messages.map(message => ({ type: message.type, line: message.lineNum, message: message.message })));
    },
    encode(encoder: GPUCommandEncoder) {
      if (disposed) throw new Error('Surface helper is disposed.');
      // Dispatch boundaries make all deposits visible before contour extraction.
      for (const [stage, count] of [[clear, groups], [deposit, Math.ceil(particleCapacity / 128)], [extract, groups], [finish, 1]] as const) {
        const pass = encoder.beginComputePass({ label: `cascade surface ${stage.pipeline.label}` });
        pass.setPipeline(stage.pipeline); pass.setBindGroup(0, stage.bindings); pass.dispatchWorkgroups(count); pass.end();
      }
    },
    draw(encoder: GPUCommandEncoder, context: GPUCanvasContext, format: GPUTextureFormat, cameraMatrix: Float32Array) {
      if (disposed || cameraMatrix.length !== 16) throw new Error('Surface draw needs a live helper and a 4x4 camera matrix.');
      device.queue.writeBuffer(camera, 0, new Float32Array(cameraMatrix));
      let pipeline = renderPipelines.get(format);
      if (!pipeline) {
        pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: drawModule, entryPoint: 'vertex', buffers: [0, 1].map(shaderLocation => ({ arrayStride: 16, attributes: [{ shaderLocation, offset: 0, format: 'float32x4' as const }] })) }, fragment: { module: drawModule, entryPoint: 'fragment', targets: [{ format }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' } });
        renderPipelines.set(format, pipeline);
      }
      const texture = context.getCurrentTexture();
      if (!depth || texture.width !== depthWidth || texture.height !== depthHeight) {
        depth?.destroy(); depthWidth = texture.width; depthHeight = texture.height;
        depth = device.createTexture({ size: [depthWidth, depthHeight], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
      }
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: texture.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.025, g: 0.035, b: 0.05, a: 1 } }], depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 } });
      pass.setPipeline(pipeline); pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: camera } }] }));
      pass.setVertexBuffer(0, vertices); pass.setVertexBuffer(1, normals); pass.drawIndirect(indirect, 0); pass.end();
    },
    async diagnostics(): Promise<CascadeParticleSurfaceDiagnostics> {
      const read = device.createBuffer({ size: 64, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      try {
        const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(stats, 0, read, 0, 64); device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ); const data = read.getMappedRange(); const words = new Uint32Array(data);
        return { samples: words[0], vertices: words[1], overflow: words[2], signedVolume: new Float32Array(data)[3], calibrationQualified: false };
      } finally { read.destroy(); }
    },
    dispose() { if (!disposed) { disposed = true; depth?.destroy(); for (const buffer of allocated) buffer.destroy(); } },
  };
}
