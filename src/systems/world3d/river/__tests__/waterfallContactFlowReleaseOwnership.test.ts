/** Short manufactured source/terrain executions exercise actual Film.advance.
 * These are ownership controls, not native waterfall realism or GPU proof. */
import {describe,it,expect} from 'vitest';
import {WaterfallContactFlow,type ContactOriginalFilmRelease,type ContactSource,type ContactSurface,type ContactOriginalReleaseRouting} from '../waterfallContactFlow';
import {waterfallContactGeometryIdentity} from '../waterfallContactGeometry';
const surface:ContactSurface={id:'ownership-ledge',vertices:[[-.5,2,-1],[.5,2,-1],[.5,2,1],[-.5,2,1]],normal:[0,1,0]};
const source:ContactSource={q:.02,width:.4,depth:.1,speed:.5,top:3,pool:0},off={...source,q:0};
function flow(routing?:ContactOriginalReleaseRouting){return new WaterfallContactFlow({startTime:0,dt:.01,parcelsPerStep:1,maxStepsPerAdvance:150,surfaces:[surface],originalReleaseRouting:routing});}
function execute(f:WaterfallContactFlow){f.advanceTo(1.2,t=>t<.025?source:off);return f.snapshot();}
function zeroReceiver(){return {checkpoint:()=>null,admit:()=>{},restore:()=>{}};}
function normalize(f:WaterfallContactFlow){const s=f.saveState();s.snapshot.receipt.lastAdvanceMilliseconds=0;return s;}
describe('original Film release ownership inside ContactFlow',()=>{
  it('keeps the disabled and unclaimed legacy route identical',()=>{
    const legacy=flow(),unclaimed=flow({ownerId:'legacy-control',capacity:10000,select:()=>[]});execute(legacy);execute(unclaimed);
    const l=normalize(legacy),u=normalize(unclaimed);delete u.originalReleaseOwnership;delete u.snapshot.receipt.originalReleaseOwnership;
    delete u.snapshot.receipt.energy.pendingReleaseKinetic;delete u.snapshot.receipt.energy.pendingReleasePotential;delete u.snapshot.receipt.energy.exportedReleaseKinetic;delete u.snapshot.receipt.energy.exportedReleasePotential;
    // Only midpoint samples .005 and .015 precede the .025 source-off event.
    expect(u).toEqual(l);expect(l.snapshot.receipt.emittedVolume).toBeCloseTo(.0004,14);expect(l.filmState!.releasedVolume).toBeGreaterThan(0);
  });
  it('claims exact substeps before aggregation and includes pending water in total accounting',()=>{
    let observed:ContactOriginalFilmRelease[]=[];
    const f=flow({ownerId:'all-control',capacity:10000,select:r=>{observed.push(...structuredClone(r));return r.map(r=>r.id);}}),s=execute(f),pending=f.pendingOriginalFilmReleases;
    expect(pending.length).toBeGreaterThan(0);expect(pending).toEqual(observed);expect(s.parcels).toHaveLength(0);
    expect(s.receipt.originalReleaseOwnership!.pendingVolume).toBeGreaterThan(0);expect(s.receipt.totalOwnedVolume).toBeCloseTo(f.totalOwnedVolume,14);expect(s.receipt.budgetError).toBeCloseTo(0,14);
    const owned=s.receipt.totalOwnedMomentum,other=s.receipt.filmMomentum,p=s.receipt.originalReleaseOwnership!.pendingMomentum;
    owned.forEach((v,i)=>expect(v).toBeCloseTo(other[i]+p[i],12));
    expect(new Set(pending.map(r=>r.id)).size).toBe(pending.length);expect(pending.every(r=>r.outflow.origin!.surfaceId===r.support.id)).toBe(true);
    const before=structuredClone(pending);pending[0].outflow.volume=999;f.advanceTo(1.21,()=>off);expect(f.pendingOriginalFilmReleases.slice(0,before.length)).toEqual(before);
  });
  it('partially claims releases while unhandled water follows default only once',()=>{
    const f=flow({ownerId:'partial-control',capacity:10000,select:r=>r.filter(r=>r.outflow.origin?.edge==='downstream').map(r=>r.id)}),s=execute(f);
    expect(f.pendingOriginalFilmReleases.length).toBeGreaterThan(0);expect(s.parcels.length+s.receipt.landedVolume).toBeGreaterThan(0);
    const pending=s.receipt.originalReleaseOwnership!.pendingVolume;
    expect(pending+s.receipt.airborneVolume+s.receipt.landedVolume).toBeCloseTo(s.film!.receipt.releasedVolume,12);expect(s.receipt.budgetError).toBeCloseTo(0,12);
  });
  it('acknowledges exact pending originals atomically after receiver admission',()=>{
    const f=flow({ownerId:'receiver-control',capacity:10000,select:r=>r.map(r=>r.id)});execute(f);const batch=f.pendingOriginalFilmReleases.slice(0,2),before=f.snapshot().receipt;
    expect(()=>f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>{f.acknowledgeOriginalFilmReleases(batch,zeroReceiver());return null;},admit:()=>{},restore:()=>{}})).toThrow('reentrant');
    let restored=false;expect(()=>f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>{throw Error('checkpoint rejected');},admit:()=>{},restore:()=>{restored=true;}})).toThrow('checkpoint rejected');
    expect(restored).toBe(false);expect(f.snapshot().receipt).toEqual(before);
    // A mathematically extreme but finite stored ledger must fail BEFORE
    // an external owner changes. It does not stand for a physical run.
    const good=f.saveState(),overflow=structuredClone(good);overflow.originalReleaseOwnership!.acknowledgedCount=Number.MAX_SAFE_INTEGER;f.restoreState(overflow);let admitted=false;
    expect(()=>f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>null,admit:()=>{admitted=true;},restore:()=>{}})).toThrow('finite capacity');expect(admitted).toBe(false);f.restoreState(good);
    const energyOverflow=structuredClone(good);energyOverflow.originalReleaseOwnership!.pending[0].outflow.velocity=[Number.MAX_VALUE,0,0];f.restoreState(energyOverflow);
    expect(()=>f.acknowledgeOriginalFilmReleases(f.pendingOriginalFilmReleases.slice(0,1),{checkpoint:()=>null,admit:()=>{admitted=true;},restore:()=>{}})).toThrow('finite capacity');expect(admitted).toBe(false);f.restoreState(good);
    let credits=0;expect(()=>f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>credits,admit:r=>{credits=99;(r[0].outflow.volume)=999;throw Error('receiver rejected');},restore:c=>{credits=c as number;}})).toThrow('receiver rejected');
    expect(credits).toBe(0);expect(f.pendingOriginalFilmReleases.slice(0,2)).toEqual(batch);expect(f.snapshot().receipt).toEqual(before);
    f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>credits,admit:r=>{credits=r.reduce((s,r)=>s+r.outflow.volume,0);},restore:c=>{credits=c as number;}});
    expect(f.snapshot().receipt.originalReleaseOwnership!.exportedVolume).toBeCloseTo(credits,14);expect(f.snapshot().receipt.budgetError).toBeCloseTo(0,12);
    expect(f.snapshot().receipt.energy.unexplainedResidual).toBeCloseTo(before.energy.unexplainedResidual,12);
    expect(()=>f.acknowledgeOriginalFilmReleases(batch,zeroReceiver())).toThrow('Missing or altered');
    const altered=f.pendingOriginalFilmReleases.slice(0,1);altered[0].outflow.momentum[0]+=1;expect(()=>f.acknowledgeOriginalFilmReleases(altered,zeroReceiver())).toThrow('altered');
    const duplicate=f.pendingOriginalFilmReleases.slice(0,1);expect(()=>f.acknowledgeOriginalFilmReleases([...duplicate,...duplicate],zeroReceiver())).toThrow('Invalid');
    const exported=f.snapshot().receipt.originalReleaseOwnership!.exportedVolume,pendingIds=f.pendingOriginalFilmReleases.map(r=>r.id);f.advanceTo(1.23,()=>source);
    expect(f.snapshot().receipt.originalReleaseOwnership!.exportedVolume).toBe(exported);expect(f.pendingOriginalFilmReleases.slice(0,pendingIds.length).map(r=>r.id)).toEqual(pendingIds);expect(f.snapshot().receipt.budgetError).toBeCloseTo(0,12);
  });
  it('rolls back capacity rejection and retry preserves exact originals and default adoption',()=>{
    let claim=true;const attempts:ContactOriginalFilmRelease[][]=[];
    const f=flow({ownerId:'capacity-control',capacity:1,select:r=>{attempts.push(structuredClone([...r]));return claim?r.map(r=>r.id):[];}});execute(f);
    // The first claimed packet survives rejection of the next tick's packet.
    expect(f.failureReason).toBe('original-film-release-capacity');expect(f.pendingOriginalFilmReleases).toHaveLength(1);
    const checkpoint=normalize(f),retained=f.pendingOriginalFilmReleases,failed=attempts.at(-1)!;claim=false;const prior=f.time;f.advanceTo(prior+.01,()=>off);
    expect(f.failureReason).toBeNull();expect(attempts.at(-1)).toEqual(failed);expect(f.time).toBeCloseTo(prior+.01,12);
    const legacy=flow({ownerId:'capacity-control',capacity:1,select:()=>[]});legacy.restoreState(checkpoint);legacy.advanceTo(prior+.01,()=>off);
    expect(f.snapshot().parcels).toEqual(legacy.snapshot().parcels);expect(f.pendingOriginalFilmReleases).toEqual(retained);expect(f.snapshot().receipt.budgetError).toBeCloseTo(0,12);
  });
  it('selector rejection restores numerical source inventory and cannot mutate owned originals',()=>{
    let reject=true;const attempts:ContactOriginalFilmRelease[][]=[];
    const f=flow({ownerId:'selector-control',capacity:10000,select:r=>{attempts.push(structuredClone([...r]));r[0].outflow.volume=999;if(reject)throw Error('selection-rejected');return r.map(r=>r.id);}});execute(f);
    expect(f.failureReason).toBe('selection-rejected');const prior=f.time;reject=false;f.advanceTo(prior+.01,()=>off);
    expect(attempts.at(-1)).toEqual(attempts[0]);expect(f.pendingOriginalFilmReleases[0].outflow.volume).not.toBe(999);expect(f.snapshot().receipt.budgetError).toBeCloseTo(0,12);
  });
  it('retains Film normal-clearance potential even when world endpoint heights cancel it',()=>{
    // A manufactured retained source chart isolates endpoint precision loss.
    // No evolution is run on this extreme geometry. Its exact edge midpoint
    // is zero while the positive normal-clearance energy remains representable.
    const f=flow({ownerId:'clearance-control',capacity:2,select:r=>r.map(r=>r.id)});f.advanceTo(.01,()=>off);const s=f.saveState();
    const norm=Math.hypot(1,1e16),support:ContactSurface={id:'tiny-clearance',vertices:[[-.5,-1e16,-1],[.5,-1e16,-1],[.5,1e16,1],[-.5,1e16,1]],normal:[0,1/norm,-1e16/norm]};
    const record:ContactOriginalFilmRelease={id:'tiny-clearance-source',support,outflow:{face:1,edge:'tiny-clearance:downstream',intervalStart:0,intervalEnd:.01,time:.01,volume:1e-7,height:1e-18,start:[.5,-1e16,-1],end:[.5,1e16,1],velocity:[1,0,0],momentum:[1e-4,0,0],origin:{surfaceId:support.id,geometryIdentity:waterfallContactGeometryIdentity(support),normal:[...support.normal],anchor:[1,.5],face:1,edge:'downstream'}}};
    s.originalReleaseOwnership!.pending=[record];f.restoreState(s);
    const expectedFilmPotential=1000*record.outflow.volume*9.81*0+1000*record.outflow.volume*9.81*support.normal[1]*record.outflow.height*.5;
    expect(expectedFilmPotential).toBeGreaterThan(0);expect((record.outflow.start[1]+record.outflow.end[1])*.5).toBe(0);
    expect(f.snapshot().receipt.energy.pendingReleasePotential).toBe(expectedFilmPotential);
    f.acknowledgeOriginalFilmReleases(f.pendingOriginalFilmReleases,zeroReceiver());expect(f.snapshot().receipt.energy.exportedReleasePotential).toBe(expectedFilmPotential);
  });
});
