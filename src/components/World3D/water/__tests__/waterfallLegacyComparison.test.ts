/** Omitting obsolete storage comparisons must preserve every active geometry
 * check, visible attribute and owned-water record. Missing data is explicit. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {WaterfallContactView,type ContactSurfacePacket} from '../waterfallContactView';
import {WaterfallTerrainInspection} from '@/systems/world3d/river/waterfallTerrainInspection';
vi.mock('../riverWaterfallCliff',()=>({createWaterfallRockMaterial:()=>new THREE.MeshBasicMaterial()}));
const views:WaterfallContactView[]=[];
function view(legacy:boolean){const v=new WaterfallContactView({x:0,z:0,tx:1,tz:0},{} as never,true);v.setRepresentation('local');v.setUnresolvedThicknessPolicy('report');v.setLegacyGeometryComparison(legacy);views.push(v);return v;}
function active(packet:ContactSurfacePacket){
  const {legacyComparison,worldVolume,maximumWorldRelativeVolumeError,binary64WorldVolume,invalidBinary64WorldPrisms,maximumBinary64WorldRelativeVolumeError,maximumBinary64WorldCentroidError,...metrics}=packet.metrics;
  return {...packet,constructionMs:0,metrics};
}
afterEach(()=>views.splice(0).forEach(v=>v.dispose()));
describe('optional historical waterfall geometry comparison',()=>{
  it('preserves active data across clock changes, pause and same-clock diagnostic restoration',()=>{
    const run=new WaterfallTerrainInspection();run.execute({type:'select',id:'seven-sisters'});run.execute({type:'running',running:true});
    const full=view(true),fast=view(false);
    for(let i=0;i<4;i++){
      const snapshot=run.execute({type:'step',ticks:4}).snapshots[0].snapshot;
      const expected=full.prepareSurfacePacket(snapshot),actual=fast.prepareSurfacePacket(snapshot);
      expect(active(actual)).toEqual(active(expected));expect(actual.metrics.legacyComparison).toBe('not-collected');
      expect(Number.isNaN(actual.metrics.worldVolume)).toBe(true);
      expect(JSON.parse(JSON.stringify(actual.metrics)).worldVolume).toBeNull();
      expect(fast.prepareSurfacePacket(snapshot).arrays).toEqual(actual.arrays);
      fast.setLegacyGeometryComparison(true);
      expect({...fast.prepareSurfacePacket(snapshot),constructionMs:0}).toEqual({...expected,constructionMs:0});
      fast.setLegacyGeometryComparison(false);
    }
  });
  it('carries unavailable diagnostics through an actual prepared-packet receiver',()=>{
    const run=new WaterfallTerrainInspection();run.execute({type:'select',id:'seven-sisters'});run.execute({type:'running',running:true});
    const snapshot=run.execute({type:'step',ticks:4}).snapshots[0].snapshot;
    const builder=view(false),receiver=view(true),packet=builder.prepareSurfacePacket(snapshot);
    receiver.update(snapshot,structuredClone(packet));
    expect(receiver.receipt().prismRepresentation.legacyComparison).toBe('not-collected');
    expect(Number.isNaN(receiver.receipt().prismRepresentation.worldVolume)).toBe(true);
    expect(receiver.receipt().surfaceVertices).toBe(packet.vertexCount);
  });
  it('keeps invalid geometry, unresolved water and volume checks active in both modes',()=>{
    type Primitive={beginPrimitive:(p:THREE.Vector3[],h:number,v:number,u:boolean,c:THREE.Vector3[],id:string,kind:'sheet')=>boolean};
    for(const legacy of [true,false]){
      const v=view(legacy),b=v as unknown as Primitive;
      const square=()=>[[0,60,0],[1,60,0],[1,60,1],[0,60,1]].map(p=>new THREE.Vector3(...p));
      const invoke=(h:number,volume=h,p=square())=>b.beginPrimitive(p,h,volume,true,[...p,...p],'regression','sheet');
      expect(invoke(1e-50)).toBe(false);expect(v.receipt().unresolvedSurfaceVolume).toBe(1e-50);
      expect(()=>invoke(1e-50,1)).toThrow('Invalid unresolved contact volume');
      const folded=square();[folded[1],folded[2]]=[folded[2],folded[1]];expect(()=>invoke(.01,.01,folded)).toThrow();
      expect(()=>invoke(NaN)).toThrow();expect(invoke(.01)).toBe(true);
    }
  });
});
