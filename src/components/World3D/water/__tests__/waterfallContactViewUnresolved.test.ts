/** Undrawable numerical tails must not hide the rest of the waterfall or lose mass. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { WaterfallContactView } from '../waterfallContactView';
import type { RiverWaterUniforms } from '../riverWaterMaterial';
import { WaterfallTerrainInspection } from '@/systems/world3d/river/waterfallTerrainInspection';

// Rendering-buffer checks do not need decorative cliff textures or a GPU.
vi.mock('../riverWaterfallCliff', () => ({ createWaterfallRockMaterial: () => new THREE.MeshBasicMaterial() }));
type PrimitiveView = { beginPrimitive(points: THREE.Vector3[], thickness: number, volume: number, unresolved: boolean, corners: THREE.Vector3[], id: string, kind: 'sheet'): boolean };
const views: WaterfallContactView[] = [];
const square = () => [[0,60,0],[1,60,0],[1,60,1],[0,60,1]].map(p=>new THREE.Vector3(...p));
function view() {
  const v=new WaterfallContactView({x:0,z:0,tx:1,tz:0},{} as RiverWaterUniforms);
  v.setRepresentation('local');v.setUnresolvedThicknessPolicy('report');views.push(v);return v;
}
function begin(v: WaterfallContactView,h: number,points=square(),volume=h) {
  return (v as unknown as PrimitiveView).beginPrimitive(points,h,volume,true,[...points,...points],'test-sheet','sheet');
}
afterEach(()=>{views.splice(0).forEach(v=>v.dispose());});
describe('contact liquid unresolved storage',()=>{
  it('installs a worker-prepared snapshot with the exact original geometry and ledger',()=>{
    const run=new WaterfallTerrainInspection();run.execute({type:'select',id:'seven-sisters'});run.execute({type:'running',running:true});
    const snapshot=run.execute({type:'step',ticks:4}).snapshots[0].snapshot;
    const direct=view(),builder=new WaterfallContactView({x:0,z:0,tx:1,tz:0},{} as RiverWaterUniforms,true),receiver=view();
    views.push(builder);builder.setRepresentation('local');builder.setUnresolvedThicknessPolicy('report');
    direct.update(snapshot);const packet=structuredClone(builder.prepareSurfacePacket(snapshot));receiver.update(snapshot,packet);
    const geometry=(v:WaterfallContactView)=>(v as unknown as {surface:THREE.Mesh}).surface.geometry;
    for(const [name,a] of Object.entries(geometry(direct).attributes)){
      if(name==='prismOriginView')continue;
      const count=direct.receipt().surfaceVertices*a.itemSize;
      expect(Array.from(geometry(receiver).getAttribute(name).array.slice(0,count))).toEqual(Array.from(a.array.slice(0,count)));
    }
    const clean=(v:WaterfallContactView)=>{const r=v.receipt();return {...r,prismRepresentation:{...r.prismRepresentation,constructionMs:0}}};
    expect(clean(receiver)).toEqual(clean(direct));
    receiver.present();expect(receiver.receipt().surfaceVertices).toBe(packet.vertexCount);
  });
  it('refuses a surface packet from another physical clock',()=>{
    const run=new WaterfallTerrainInspection();run.execute({type:'select',id:'seven-sisters'});
    const snapshot=run.snapshot().snapshots[0].snapshot,builder=view(),receiver=view();
    const packet=builder.prepareSurfacePacket(snapshot);packet.time+=1;
    expect(()=>receiver.update(snapshot,packet)).toThrow('does not match');
    expect(receiver.receipt().surfaceVertices).toBe(0);
  });
  it('retains and reports subnormal water without blocking a subsequent ordinary primitive',()=>{
    const v=view();
    expect(begin(v,1e-50)).toBe(false);
    expect(begin(v,1e-40)).toBe(false);
    const r=v.receipt();
    expect(r.unresolvedSurfaceVolume).toBe(1e-50+1e-40);
    expect(r.unresolvedLocalStorage.count).toBe(2);
    expect(r.unresolvedLocalStorage.records[0]).toMatchObject({thickness:1e-50,volume:1e-50,reason:'UNRESOLVED_RENDER_THICKNESS'});
    expect(r.surfaceVertices).toBe(0);
    expect(begin(v,.01)).toBe(true);
    expect(v.receipt().unresolvedSurfaceVolume).toBe(r.unresolvedSurfaceVolume);
  });
  it('uses uploaded half-thickness and keeps the smallest normal value representable',()=>{
    const v=view();
    expect(begin(v,2 ** -126)).toBe(false);
    expect(begin(v,2 ** -125)).toBe(true);
    expect(v.receipt().unresolvedLocalStorage.count).toBe(1);
  });
  it('retains the real drain witness when one binary64 quantum exceeds a relative check',()=>{
    const v=view(), points=[
      [0.09162063718206023,66.03778254934336,-13.000301729695233],
      [1.0916206371820603,62.03778254934336,-13.000301729695233],
      [0.9083793628179397,63.962217450656645,-12.999698270304766],
      [-0.09162063718206027,67.96221745065664,-12.999698270304766],
    ].map(p=>new THREE.Vector3(...p));
    // This actual sheet holds three minimum binary64 quanta; reconstructing
    // its rounded thickness produces four. Keep all three owned quanta undrawn.
    expect(begin(v,3*Number.MIN_VALUE,points,3*Number.MIN_VALUE)).toBe(false);
    expect(v.receipt().unresolvedSurfaceVolume).toBe(3*Number.MIN_VALUE);
    // A different volume outside that rounding interval is still invalid.
    expect(()=>begin(v,3*Number.MIN_VALUE,points,10*Number.MIN_VALUE)).toThrow('Invalid unresolved contact volume');
    expect(v.receipt().unresolvedSurfaceVolume).toBe(3*Number.MIN_VALUE);
    expect(begin(v,.01)).toBe(true);
  });
  it('still rejects invalid geometry and volume instead of classifying them as tails',()=>{
    const v=view();
    const folded=square(); [folded[1],folded[2]]=[folded[2],folded[1]];
    expect(()=>begin(v,1e-50,folded)).toThrow();
    expect(()=>begin(v,1e-50,square(),1)).toThrow('Invalid unresolved contact volume');
    expect(()=>begin(v,NaN)).toThrow();
    expect(v.receipt().unresolvedLocalStorage.count).toBe(0);
  });
  it('clears the presentation ledger on explicit reset',()=>{
    const v=view();begin(v,1e-50);v.clearSnapshot();
    expect(v.receipt().unresolvedLocalStorage).toEqual({count:0,volume:0,records:[]});
    expect(v.receipt().unresolvedSurfaceVolume).toBe(0);
  });
  it('preserves strict rejection for callers outside the inspection policy',()=>{
    const v=view();v.setUnresolvedThicknessPolicy('strict');
    expect(()=>begin(v,1e-50)).toThrow('underflow');
  });
});
