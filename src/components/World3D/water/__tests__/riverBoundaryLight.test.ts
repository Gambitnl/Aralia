import { describe, expect, it } from 'vitest';
import { Box3, Color, DataUtils, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { BOUNDARY_DIRECTIONS, BOUNDARY_LIGHT, BoundaryOccluders, RiverBoundaryLightCache, boundaryIrradiance } from '../riverBoundaryLight';
import { buildWaterfallCliffGeometry, sampleWaterfallRockAlbedo } from '../riverWaterfallCliff';
import { defaultRiverCourse, RIVER_SHAPE_DEFAULT } from '@/systems/world3d/river/riverReach';
import { WATERFALL } from '@/systems/world3d/river/riverHeadwaters';
import { RiverBoundaryWorkerCache, setRiverBoundaryWorkerFactory, type BoundaryWorkerPort, type BoundaryWorkerRequest } from '../riverBoundaryWorkerCache';

async function finish(cache: RiverBoundaryLightCache) {
  await Promise.resolve(); await Promise.resolve();
  for (let i=0;i<10000&&!cache.receipt().ready&&!cache.receipt().error;i++) cache.step(2);
  expect(cache.receipt().error).toBeNull(); expect(cache.receipt().ready).toBe(true);
}
const bounds = new Box3(new Vector3(-1,-1,1),new Vector3(1,1,2));
function plane(albedo=.5) { return new Mesh(new PlaneGeometry(20,20),new MeshBasicMaterial({color:new Color(albedo,albedo,albedo),side:DoubleSide})); }
describe('cliff boundary radiance',()=>{
  it('preserves uniform full-sphere radiance for arbitrary surface normals',()=>{
    const colors=BOUNDARY_DIRECTIONS.map(()=>new Color(.27,.51,.83));
    for(const n of [new Vector3(0,1,0),new Vector3(1,0,0),new Vector3(.23,-.72,.81).normalize()]) {
      const actual=boundaryIrradiance(colors,n); expect(actual.r).toBeCloseTo(.27,12);expect(actual.g).toBeCloseTo(.51,12);expect(actual.b).toBeCloseTo(.83,12);
    }
    const upper=BOUNDARY_DIRECTIONS.map(d=>new Color().setRGB(d.y>0?1:d.y===0?.5:0,d.y>0?1:d.y===0?.5:0,d.y>0?1:d.y===0?.5:0));
    // Horizon nodes straddle the discontinuous sky/lower hemisphere equally.
    expect(boundaryIrradiance(upper,new Vector3(0,1,0)).r).toBeCloseTo(1,12);
    expect(boundaryIrradiance(upper,new Vector3(0,-1,0)).r).toBe(0);
    expect(boundaryIrradiance(upper,new Vector3(1,0,0)).r).toBeCloseTo(.5,12);
  });
  it('uses transformed actual triangles from either face without changing geometry', async()=>{
    const mesh=plane();mesh.rotation.y=.4;mesh.position.set(3,2,-1);const original=Array.from(mesh.geometry.attributes.position.array);
    const occluders=new BoundaryOccluders([mesh]); for(let i=0;i<1000&&!occluders.ready;i++)occluders.advance();
    const normal=new Vector3(0,0,1).applyEuler(mesh.rotation), center=mesh.position.clone();
    expect(occluders.hit(center.clone().addScaledVector(normal,3),normal.clone().negate())?.hit.point.distanceTo(center)).toBeLessThan(1e-8);
    expect(occluders.hit(center.clone().addScaledVector(normal,-3),normal)?.hit.point.distanceTo(center)).toBeLessThan(1e-8);
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(original);
  });
  it('retains open sky coefficients and direct sun without per-ready-frame rays',async()=>{
    const cache=new RiverBoundaryLightCache();cache.configure([],1,bounds,new Vector3(0,1,0));await finish(cache);
    for(let direction=0;direction<12;direction++) {
      const d=BOUNDARY_DIRECTIONS[direction],offset=direction*BOUNDARY_LIGHT.x*BOUNDARY_LIGHT.y*BOUNDARY_LIGHT.z*4;
      const h=DataUtils.fromHalfFloat(cache.horizon[offset]),z=DataUtils.fromHalfFloat(cache.zenith[offset]);
      expect(h+z).toBeCloseTo(d.y>0?1:d.y===0?.5:0,3);expect(DataUtils.fromHalfFloat(cache.sun[offset+3])).toBe(1);
    }
    const rays=cache.receipt().rays;cache.step();cache.step();expect(cache.receipt().rays).toBe(rays);expect(cache.receipt().textureBytes).toBe(165888);
  });
  it('replaces blocked incident light with positive bounded one-bounce reflectance',async()=>{
    const cache=new RiverBoundaryLightCache();cache.configure([plane(.4)],'plane',bounds,new Vector3(0,0,1));await finish(cache);
    let blocked=0,bounced=0;
    for(let i=0;i<cache.horizon.length;i+=4) {
      if(DataUtils.fromHalfFloat(cache.horizon[i+3])===0){blocked++;const sky=DataUtils.fromHalfFloat(cache.horizon[i])+DataUtils.fromHalfFloat(cache.zenith[i]);expect(sky).toBeGreaterThanOrEqual(0);expect(sky).toBeLessThanOrEqual(.4005);if(sky>0)bounced++;}
      expect(DataUtils.fromHalfFloat(cache.sun[i])).toBeLessThanOrEqual(.4/Math.PI+.0001);
    }
    expect(blocked).toBeGreaterThan(0);expect(bounced).toBeGreaterThan(0);
  });
  it('invalidates previous lighting, preserves unsupported geometry as open, then rebuilds',async()=>{
    const cache=new RiverBoundaryLightCache();cache.configure([plane()],1,bounds,new Vector3(0,1,0));await finish(cache);const version=cache.version;
    const unsupported=plane();(unsupported.material as MeshBasicMaterial).userData={};Object.assign(unsupported.material,{colorNode:{}});
    cache.configure([unsupported],2,bounds,new Vector3(0,0,1));expect(cache.receipt().ready).toBe(false);expect(cache.receipt().revision).toBe(2);
    await finish(cache);expect(cache.version).toBe(version+1);expect(cache.receipt().unsupportedMeshes).toBe(1);expect(cache.receipt().triangles).toBe(0);
  });
  it('shares scan color linearization, tint, tone and diagnostic blend',()=>{
    const pixels={width:1,height:1,data:new Uint8ClampedArray([128,64,32,255])};const linear=(x:number)=>Math.pow((x/255+.055)/1.055,2.4);
    const actual=sampleWaterfallRockAlbedo(pixels,new Vector3(15,7,-33),new Vector3(.3,.8,-.1).normalize(),.6);
    expect(actual.r).toBeCloseTo(linear(128)*.85*.6,12);expect(actual.g).toBeCloseTo(linear(64)*.88*.6,12);expect(actual.b).toBeCloseTo(linear(32)*.90*.6,12);
    const diagnostic=sampleWaterfallRockAlbedo(pixels,new Vector3(),new Vector3(0,1,0),.6,0);expect(diagnostic.r).toBeCloseTo(.42*.85*.6,12);
    // At p=0 the first phase is (0,.65) and the rotated phase is
    // (-.02663,1.15884). This independent four-color fixture catches repeat,
    // image vertical orientation, bilinear weights and oblique phase blending.
    const colored={width:2,height:2,data:new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255])};
    const warped=sampleWaterfallRockAlbedo(colored,new Vector3(),new Vector3(1,0,0));
    const rotatedR=.55326*.81768+.44674*.18232;
    expect(warped.r).toBeCloseTo((.5*.92+rotatedR*.08)*.85,10);
    expect(warped.g).toBeCloseTo((.5*.92+.55326*.08)*.88,10);
    expect(warped.b).toBeCloseTo((.2*.92+.81768*.08)*.90,10);
  });
  it('honors hidden ancestors, draw ranges and the unsupported multi-material contract',()=>{
    const hidden=plane();hidden.visible=false;const child=plane();hidden.add(child);
    const ranged=plane();ranged.geometry.setDrawRange(0,3);
    const multiple=new Mesh(new PlaneGeometry(20,20),[new MeshBasicMaterial(),new MeshBasicMaterial()]);
    const occluders=new BoundaryOccluders([hidden,ranged,multiple]);for(let i=0;i<1000&&!occluders.ready;i++)occluders.advance();
    expect(occluders.triangleCount).toBe(1);expect(occluders.unsupportedMeshes).toBe(1);
  });
  it('copies compact worker data without detaching geometry and discards obsolete replies',async()=>{
    const workers: {port:BoundaryWorkerPort;request?:BoundaryWorkerRequest;transfers?:Transferable[];terminated:boolean}[]=[];
    setRiverBoundaryWorkerFactory(()=>{
      const record={port:null as unknown as BoundaryWorkerPort,terminated:false,request:undefined as BoundaryWorkerRequest|undefined,transfers:undefined as Transferable[]|undefined};
      record.port={onmessage:null,onerror:null,terminate:()=>{record.terminated=true;},postMessage:((request:BoundaryWorkerRequest,transfers:Transferable[])=>{record.request=request;record.transfers=transfers;}) as Worker['postMessage']};workers.push(record);return record.port;
    });
    const mesh=plane(), original=Array.from(mesh.geometry.attributes.position.array),cache=new RiverBoundaryWorkerCache();
    cache.configure([mesh],1,bounds,new Vector3(0,1,0));await Promise.resolve();await Promise.resolve();for(let i=0;i<100&&!workers.length;i++)cache.step(2);
    expect(workers[0].request?.meshes[0].positions).toEqual(mesh.geometry.attributes.position.array);expect(workers[0].request?.meshes[0].positions.buffer).not.toBe(mesh.geometry.attributes.position.array.buffer);
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(original);
    const reply=()=>({horizon:new Uint16Array(27648),zenith:new Uint16Array(27648),sun:new Uint16Array(27648),receipt:{ready:true}});
    cache.configure([mesh],2,bounds,new Vector3(0,0,1));expect(workers[0].terminated).toBe(true);
    workers[0].port.onmessage?.({data:reply()} as MessageEvent);expect(cache.receipt().ready).toBe(false);
    await Promise.resolve();await Promise.resolve();for(let i=0;i<100&&workers.length<2;i++)cache.step(2);
    workers[1].port.onmessage?.({data:reply()} as MessageEvent);expect(cache.receipt().ready).toBe(true);expect(cache.receipt().revision).toBe(2);expect(cache.version).toBe(1);cache.dispose();
  });
  it('bakes the actual cliff geometry incrementally and reports bounded work',async()=>{
    const course=defaultRiverCourse(),crest=course.at(WATERFALL.crestS);
    const geometry=buildWaterfallCliffGeometry({seed:20260928,shape:RIVER_SHAPE_DEFAULT,course});
    const mesh=new Mesh(geometry,new MeshBasicMaterial({color:new Color(.4,.4,.4),side:DoubleSide}));
    const cache=new RiverBoundaryLightCache();
    const region=new Box3(new Vector3(crest.x-10,8,crest.z-10),new Vector3(crest.x+10,78,crest.z+10));
    cache.configure([mesh],'actual-cliff/constant-albedo-cost-fixture',region,new Vector3(.3,.8,.2).normalize());await finish(cache);
    console.info('BOUNDARY_COST_RECEIPT',JSON.stringify(cache.receipt()));
    const mainCache=new RiverBoundaryWorkerCache();mainCache.configure([mesh],'main-copy-cost',region,new Vector3(0,1,0));await Promise.resolve();await Promise.resolve();
    for(let i=0;i<1000&&mainCache.receipt().transferMs===0;i++)mainCache.step(2);
    console.info('BOUNDARY_MAIN_COPY_RECEIPT',JSON.stringify(mainCache.receipt()));mainCache.dispose();
    expect(cache.receipt().triangles).toBe(geometry.index!.count/3);expect(cache.receipt().rays).toBeGreaterThanOrEqual(576*13);
    geometry.dispose();
  });
});
