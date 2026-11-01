import{describe,it,expect}from'vitest';
import{buildWaterfallLiquidSurface,type LiquidSurfaceSample,type LiquidSurfaceResult}from'../waterfallLiquidSurface';
const options={cellSize:.025,support:.1,maxNodes:100000,maxTriangles:100000};
function block(lo:number[],hi:number[],spacing:number):LiquidSurfaceSample[]{const counts=lo.map((x,c)=>Math.round((hi[c]-x)/spacing)),volume=lo.reduce((v,x,c)=>v*(hi[c]-x),1)/counts.reduce((a,b)=>a*b,1),samples:LiquidSurfaceSample[]=[];for(let k=0;k<counts[2];k++)for(let j=0;j<counts[1];j++)for(let i=0;i<counts[0];i++)samples.push({position:[i,j,k].map((n,c)=>lo[c]+(n+.5)*(hi[c]-lo[c])/counts[c]) as [number,number,number],volume});return samples;}
function sphere(spacing:number){const samples:LiquidSurfaceSample[]=[];for(let z=-.25+spacing/2;z<.25;z+=spacing)for(let y=-.25+spacing/2;y<.25;y+=spacing)for(let x=-.25+spacing/2;x<.25;x+=spacing)if(x*x+y*y+z*z<.25**2)samples.push({position:[x,y,z],volume:1});const volume=4*Math.PI*.25**3/3;for(const p of samples)p.volume=volume/samples.length;return samples;}
const field=(r:LiquidSurfaceResult)=>new Map(Array.from(r.field.density,(v,i)=>[Array.from(r.field.coordinates.slice(i*3,i*3+3)).join(','),v]));
function bounds(r:LiquidSurfaceResult){return[0,1,2].map(c=>{const values=Array.from(r.positions).filter((_,i)=>i%3===c);return[Math.min(...values),Math.max(...values)];});}
const closed=(r:LiquidSurfaceResult)=>{expect(r.receipt.boundaryEdges).toBe(0);expect(r.receipt.nonManifoldEdges).toBe(0);expect(r.receipt.inconsistentEdges).toBe(0);expect(r.receipt.signedMeshVolume).toBeGreaterThan(0);};

describe('optional common liquid volume surface',()=>{
  it('retains the exact normal stencil on a coarse isotropic grid',()=>{
    const h=.06,H=.1;let sum=0;
    for(let k=-2;k<=2;k++)for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const q=Math.hypot(i,j,k)*h/(1.5*H);if(q<1)sum+=(1-q)**4*(1+4*q);}
    const r=buildWaterfallLiquidSurface([{position:[0,0,0],volume:.6*sum*h**3}],{...options,cellSize:h,support:H,anisotropic:false}),f=field(r);
    expect(f.get('0,0,0')).toBeCloseTo(.6,12);expect(f.get('2,0,0')).toBeCloseTo(.004032,12);expect(((f.get('2,0,0')??0)-(f.get('0,0,0')??0))/(2*h)).toBeCloseTo(-4.9664,10);closed(r);
  });
  it('keeps coincident sample subdivision invariant and does not mutate material',()=>{
    const samples=block([0,0,0],[.3,.3,.3],.05);samples.forEach(p=>{Object.freeze(p.position);Object.freeze(p);});const a=buildWaterfallLiquidSurface(samples,options),b=buildWaterfallLiquidSurface(samples.flatMap(p=>[{position:p.position,volume:p.volume/2},{position:p.position,volume:p.volume/2}]),options);
    const af=field(a),bf=field(b);expect(af.size).toBe(bf.size);for(const[k,v]of af)expect(bf.get(k)).toBeCloseTo(v,11);expect(a.receipt.meshVolume).toBeCloseTo(b.receipt.meshVolume,10);expect(a.receipt.depositError).toBeCloseTo(0,12);closed(a);closed(b);
  });
  it('keeps a true dry separation instead of turning all samples into one sheet',()=>{
    const r=buildWaterfallLiquidSurface([...block([0,0,0],[.2,.2,.2],.05),...block([.6,0,0],[.8,.2,.2],.05)],{...options,anisotropic:false});closed(r);expect(r.receipt.components).toBe(2);for(let i=0;i<r.positions.length;i+=3)expect(r.positions[i]<.3||r.positions[i]>.5).toBe(true);
  });
  it('reports dilute material without lowering the contour or inflating support',()=>{
    const r=buildWaterfallLiquidSurface([{position:[.013,.017,.011],volume:.000001}],options);expect(r.receipt.sampleVolume).toBe(.000001);expect(r.receipt.depositedVolume).toBeCloseTo(.000001,14);expect(r.receipt.diluteSampleVolume).toBe(.000001);expect(r.receipt.triangles).toBe(0);expect(r.receipt.iso).toBe(.5);expect(r.receipt.maximumKernelAxis).toBe(.1);
  });
  it('qualifies actual finer quadrature of the same block without changing mass or kernel',()=>{
    const a=buildWaterfallLiquidSurface(block([0,0,0],[.4,.4,.4],.05),options),b=buildWaterfallLiquidSurface(block([0,0,0],[.4,.4,.4],.025),options);closed(a);closed(b);expect(a.receipt.sampleVolume).toBeCloseTo(.064,12);expect(b.receipt.sampleVolume).toBeCloseTo(.064,12);expect(Math.abs(a.receipt.meshVolume-b.receipt.meshVolume)/.064).toBeLessThan(.05);const ba=bounds(a),bb=bounds(b);ba.forEach((v,c)=>v.forEach((x,j)=>expect(Math.abs(x-bb[c][j])).toBeLessThan(.02)));
  });
  it('qualifies curved resampling and outward field normals',()=>{
    const a=buildWaterfallLiquidSurface(sphere(.05),options),b=buildWaterfallLiquidSurface(sphere(.025),options);closed(a);closed(b);expect(Math.abs(a.receipt.meshVolume-b.receipt.meshVolume)/a.receipt.sampleVolume).toBeLessThan(.06);
    for(const id of new Set(b.indices)){const p=Array.from(b.positions.slice(id*3,id*3+3)),n=Array.from(b.normals.slice(id*3,id*3+3));expect(Math.hypot(...n)).toBeCloseTo(1,5);expect(p.reduce((v,x,c)=>v+x*n[c],0)).toBeGreaterThan(0);}
  });
  it('keeps deterministic closed geometry as grid resolution improves at fixed physical support',()=>{
    const samples=block([-.2,-.2,-.2],[.2,.2,.2],.05),a=buildWaterfallLiquidSurface(samples,{...options,anisotropic:false}),b=buildWaterfallLiquidSurface(samples,{...options,cellSize:.0125,maxNodes:300000,anisotropic:false});closed(a);closed(b);expect(Math.abs(a.receipt.meshVolume-b.receipt.meshVolume)/.064).toBeLessThan(.025);expect(a.receipt.depositedVolume).toBeCloseTo(b.receipt.depositedVolume,11);
  });
  it('rejects underresolved kernels, finite-overflow coordinates and bounded capacities',()=>{
    const samples=block([0,0,0],[.2,.2,.2],.05),before=JSON.stringify(samples);expect(()=>buildWaterfallLiquidSurface(samples,{...options,cellSize:.05})).toThrow(/unresolved/);expect(()=>buildWaterfallLiquidSurface([{position:[1e200,0,0],volume:1}],options)).toThrow(/material/);expect(()=>buildWaterfallLiquidSurface(samples,{...options,maxNodes:10})).toThrow(/node capacity/);expect(()=>buildWaterfallLiquidSurface(samples,{...options,maxTriangles:1})).toThrow(/triangle capacity/);expect(JSON.stringify(samples)).toBe(before);
  });
});
