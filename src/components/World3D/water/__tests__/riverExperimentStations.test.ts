/** Checks that frozen captures are lazy, identity checked and truly stopped,
 * and that wooden signs can be selected by the scene's actual ray query.
 * Canvas text drawing is stubbed because these checks do not verify pixels.
 */
import {describe,it,expect,vi,afterEach} from 'vitest';
import * as THREE from 'three/webgpu';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {RiverExperimentStations} from '../riverExperimentStations';
import type {RiverWaterUniforms} from '../riverWaterMaterial';
const context={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){}};
function stations(){
  // The browser overload also covers GPU canvases. This stub answers only the
  // sign's 2D text context; it does not pretend to initialize a renderer.
  const getContext=((kind:string)=>kind==='2d'?context:null) as unknown as HTMLCanvasElement['getContext'];
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(getContext);
  return new RiverExperimentStations(()=>0,()=>{},new THREE.Scene(),{} as RiverWaterUniforms);
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('river study stations',()=>{
  it('clears overhanging plant footprints only at the study floor and camera corridor',()=>{
    const box=(lo:number[],hi:number[])=>new THREE.Box3(new THREE.Vector3().fromArray(lo),new THREE.Vector3().fromArray(hi));
    expect(RiverExperimentStations.clearsFootprint(box([-63,0,-118],[-58,30,-106]))).toBe(true);
    // A trunk beyond the clearing can still hang its crown into the view.
    expect(RiverExperimentStations.clearsFootprint(box([-85,0,-113],[-69,28,-100]))).toBe(true);
    expect(RiverExperimentStations.clearsFootprint(box([0,0,0],[15,30,20]))).toBe(false);
    expect(RiverExperimentStations.clearsFootprint(box([-100,0,-150],[-90,30,-130]))).toBe(false);
    const view=stations(),pose=view.pose(),area=RiverExperimentStations.clearing;
    expect(pose.pos[0]).toBeGreaterThan(area.minX);expect(pose.pos[0]).toBeLessThan(area.maxX);expect(pose.pos[2]).toBeGreaterThan(area.minZ);expect(pose.pos[2]).toBeLessThan(area.maxZ);view.dispose();
  });
  it('constructs only quiet signs and uploads only the selected stored capture',async()=>{
    const calls:string[]=[],manifest=readFileSync('public/assets/water-experiments/manifest.json','utf8'),bytes=readFileSync('public/assets/water-experiments/oblique-interface.json');
    vi.stubGlobal('crypto',webcrypto);
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);return url.endsWith('manifest.json')?{ok:true,json:async()=>JSON.parse(manifest)}:{ok:true,arrayBuffer:async()=>Uint8Array.from(bytes).buffer};}));
    const view=stations();expect(calls).toHaveLength(0);expect(view.reading.pool).toBeUndefined();
    await view.select('oblique-interface');expect(calls).toHaveLength(2);expect(calls.every(url=>!url.includes('connected-basin'))).toBe(true);
    expect(view.reading.capture?.time).toBe(0);expect(view.reading.capture?.states.map(s=>s.pieces.length)).toEqual([2,2]);expect(view.reading.state).toBe('before');
    const displayOrigin=view.group.children.at(-1)!.position.toArray();
    view.showState('rejected');expect(view.reading.state).toBe('rejected');expect(view.reading.pool).toBeUndefined();expect(view.group.children.at(-1)!.position.toArray()).toEqual(displayOrigin);
    await view.select(null);expect(view.reading.capture).toBeNull();expect(view.reading.id).toBeNull();view.dispose();
  });
  it('refuses geometry bytes which do not match their manifest',async()=>{
    vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({assets:{'oblique-interface':{file:'bad.json',sha256:'wrong'}}}),arrayBuffer:async()=>new TextEncoder().encode('{}').buffer})));
    const view=stations();await view.select('oblique-interface');expect(view.reading.error).toContain('identity mismatch');expect(view.reading.capture).toBeNull();view.dispose();
  });
  it('hits a wooden sign through actual camera projection and raycasting',()=>{
    const view=stations(),camera=new THREE.PerspectiveCamera(48,1,.1,1000),pose=view.pose('oblique-interface');camera.position.fromArray(pose.pos);camera.lookAt(new THREE.Vector3().fromArray(pose.look));camera.updateMatrixWorld();view.group.updateMatrixWorld(true);
    const base=view.base('oblique-interface'),sign=new THREE.Vector3(base.x,base.y+2,base.z+5).project(camera);
    expect(view.pick(camera,sign.x,sign.y)).toBe('oblique-interface');view.dispose();
  });
});
