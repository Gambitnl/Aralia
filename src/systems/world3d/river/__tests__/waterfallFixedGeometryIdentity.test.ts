/** Reusing an owned rock identity must not weaken stale-geometry or release
 * guards. External geometry stays mutable and is checked afresh on every use. */
import {describe,expect,it} from 'vitest';
import {WaterfallContactFlow,getWaterfallContactSurfaces,sweepWaterfallReleaseLocal,type ContactSurface,type ContactReleaseLocal} from '../waterfallContactFlow';
import {waterfallContactGeometryIdentity} from '../waterfallContactGeometry';

const localFor=(s:ContactSurface):ContactReleaseLocal=>({surfaceId:s.id,geometryIdentity:waterfallContactGeometryIdentity(s),face:0,edge:'upstream',anchor:[0,.5],normal:[...s.normal],clearance:1e-15,displacement:[0,0,0],referenceTime:0});
// Inspect the actual private terrain only to exercise the cached path; public
// snapshots intentionally return separate mutable copies and cannot test it.
const owned=(f:WaterfallContactFlow)=>(f as unknown as {surfaces:ContactSurface[]}).surfaces[0];
describe('fixed rock identity reuse',()=>{
 it('preserves contact and every release guard on the owned frozen terrain',()=>{
  const flow=new WaterfallContactFlow({startTime:0,surfaces:getWaterfallContactSurfaces()});
  const rock=owned(flow),copy=structuredClone(rock),local=localFor(rock);
  expect(Object.isFrozen(rock)).toBe(true);expect(rock.vertices.every(Object.isFrozen)).toBe(true);
  for(const drift of [[0,-.1,0],[.1,.1,0],[0,0,0]] as [number,number,number][])
   expect(sweepWaterfallReleaseLocal(local,drift,rock)).toEqual(sweepWaterfallReleaseLocal(local,drift,copy));
  const invalids=[{...local,geometryIdentity:'stale'},{...local,clearance:-1},{...local,anchor:[.1,.5] as [number,number]},{...local,normal:[0,1,0] as [number,number,number]}];
  for(const invalid of invalids)expect(()=>sweepWaterfallReleaseLocal(invalid,[0,-.1,0],rock)).toThrow('release-local-stale-or-invalid');
 });
 it('rechecks caller geometry and does not accept a changed nested coordinate',()=>{
  const external=getWaterfallContactSurfaces()[0],local=localFor(external);
  expect(()=>sweepWaterfallReleaseLocal(local,[0,0,0],external)).not.toThrow();
  external.vertices[0][0]+=.01;
  expect(()=>sweepWaterfallReleaseLocal(local,[0,0,0],external)).toThrow('release-local-stale-or-invalid');
 });
 it('rebuilds owned identities on restore and rejects different saved terrain',()=>{
  const flow=new WaterfallContactFlow({startTime:0,surfaces:getWaterfallContactSurfaces()}),before=owned(flow),state=flow.saveState();
  flow.restoreState(state);const restored=owned(flow);
  expect(restored).not.toBe(before);
  expect(sweepWaterfallReleaseLocal(localFor(before),[0,-.1,0],restored)).toEqual(sweepWaterfallReleaseLocal(localFor(before),[0,-.1,0],before));
  state.snapshot.surfaces[0].vertices[0][0]+=.1;
  expect(()=>flow.restoreState(state)).toThrow('Contact rollback terrain mismatch');
 });
});
