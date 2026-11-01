/** A downstream frame must move/query the same finite native faces. Passing
 * these controls does not qualify ground joins, water or reference likeness. */
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {RiverCliffFrame,poseNativeCliff,inspectNativeCliffPerimeter,type CliffFrameDescription} from '../riverCliffFrame';
import {buildWaterfallCliffGeometry} from '../riverWaterfallCliff';
import {nativeBoundaryEpochCurrent} from '../riverNativeBoundaryAtlas';
import {defaultRiverCourse,RIVER_SHAPE_DEFAULT} from '@/systems/world3d/river/riverReach';
import {WATERFALL,headwaterKey,MAIN_CHANNEL_S,setRiverHeadwaters} from '@/systems/world3d/river/riverHeadwaters';
import {RECONSTRUCTION_FALLS,reconstructedRapidsAt} from '@/systems/world3d/river/riverRapidsReconstruction';

describe('native finite cliff downstream placement',()=>{
  let source:THREE.BufferGeometry,posed:ReturnType<typeof poseNativeCliff>,d:CliffFrameDescription;
  beforeAll(()=>{
    setRiverHeadwaters(true,true);const f=RECONSTRUCTION_FALLS[1],crest=reconstructedRapidsAt(f.startM),course=defaultRiverCourse();
    d={owner:'rapids:seven-sisters',source:course.at(WATERFALL.crestS),target:crest,
      sourceFloorY:-4,sourceCrestY:WATERFALL.crestBed,targetFloorY:headwaterKey(MAIN_CHANNEL_S+f.endM)!.thalweg,
      targetCrestY:headwaterKey(MAIN_CHANNEL_S+f.startM)!.thalweg,lateralScale:f.halfWidthM/144,forwardScale:1,runM:f.runM};
    source=buildWaterfallCliffGeometry({seed:20260928,shape:RIVER_SHAPE_DEFAULT,course});
    posed=poseNativeCliff(source,new RiverCliffFrame(d));
  },60000);
  afterAll(()=>{source?.dispose();posed?.geometry.dispose();setRiverHeadwaters(false);});
  it('places the original crest and foot at the actual downstream reference addresses',()=>{
    const top=posed.frame.toWorld(new THREE.Vector3(d.source.x,d.sourceCrestY,d.source.z));
    const foot=posed.frame.toWorld(new THREE.Vector3(d.source.x,d.sourceFloorY,d.source.z));
    expect(top.x).toBeCloseTo(d.target.x,12);expect(top.z).toBeCloseTo(d.target.z,12);expect(top.y).toBeCloseTo(d.targetCrestY,12);
    expect((foot.x-top.x)*d.target.tx+(foot.z-top.z)*d.target.tz).toBeCloseTo(d.runM,10);
    expect(top.y-foot.y).toBeCloseTo(250+.035*45,10);
    expect(posed.frame.volumeScale).toBeGreaterThan(0);
    for(const p of [top,foot,new THREE.Vector3(250,-170,-40)])expect(posed.frame.toWorld(posed.frame.toSource(p)).distanceTo(p)).toBeLessThan(1e-10);
  });
  it('preserves every native face and uses exactly the transformed stored coordinates',()=>{
    const a=source.getAttribute('position'),b=posed.geometry.getAttribute('position');
    expect([...posed.geometry.index!.array]).toEqual([...source.index!.array]);
    for(let i=0;i<a.count;i++){
      const p=posed.frame.toWorld(new THREE.Vector3().fromBufferAttribute(a,i));
      expect([b.getX(i),b.getY(i),b.getZ(i)]).toEqual([Math.fround(p.x),Math.fround(p.y),Math.fround(p.z)]);
    }
    let visited=0;
    posed.sample.nativeBoundary.forEachFace((element,ids,points)=>{
      if(element%3000===0)for(let k=0;k<3;k++)expect(points[k]).toEqual([b.getX(ids[k]),b.getY(ids[k]),b.getZ(ids[k])]);
      visited++;
    });
    expect(visited).toBe(source.index!.count/3);expect(nativeBoundaryEpochCurrent(posed.geometry)).toBe(true);
    expect(posed.geometry.userData.nativeBoundary).toMatchObject({owner:d.owner,closedSolid:false,waterAdmission:false});
  });
  it('samples the actual finite front at negative world elevation and retains exact constructed rails',()=>{
    expect(posed.sample.nativeBoundary.constructedRails).toEqual(source.userData.constructedRails);
    for(const n of [-70,-30,0,35,70])for(const fraction of [.2,.5,.8]){
      const y=d.targetFloorY+(d.targetCrestY-d.targetFloorY)*fraction,p=posed.sample(n,y);
      expect(p.y).toBeCloseTo(y,10);expect([p.x,p.y,p.z].every(Number.isFinite)).toBe(true);
      expect((p.x-d.target.x)*d.target.tz-(p.z-d.target.z)*d.target.tx).toBeCloseTo(n,5);
    }
  });
  it('traces a finite downstream join across actual ledge faces rather than joining endpoints by a chord',()=>{
    const y=d.targetFloorY+(d.targetCrestY-d.targetFloorY)*.5;
    const knots=posed.sample.traceEdge(-70,y,-15,y);
    expect(knots.length).toBeGreaterThan(2);expect(knots[0].t).toBe(0);expect(knots.at(-1)!.t).toBe(1);
    // Independently measure distance to the retained actual mesh. This is a
    // numerical query control, not a tolerance for welding or solid admission.
    const minima=knots.map(()=>Infinity),triangle=new THREE.Triangle(),closest=new THREE.Vector3();
    posed.sample.nativeBoundary.forEachFace((_element,_ids,points)=>{
      triangle.a.fromArray(points[0]);triangle.b.fromArray(points[1]);triangle.c.fromArray(points[2]);
      knots.forEach((k,i)=>{triangle.closestPointToPoint(k.point,closest);minima[i]=Math.min(minima[i],closest.distanceTo(k.point));});
    });
    expect(Math.max(...minima)).toBeLessThan(1e-8);
  });
  it('rejects invalid placements and a stale posed-buffer query',()=>{
    expect(()=>new RiverCliffFrame({...d,forwardScale:0})).toThrow();
    expect(()=>new RiverCliffFrame({...d,target:{...d.target,tx:3}})).toThrow();
    const clone=poseNativeCliff(source,new RiverCliffFrame(d));
    clone.geometry.getAttribute('position').needsUpdate=true;
    expect(nativeBoundaryEpochCurrent(clone.geometry)).toBe(false);
    expect(()=>clone.sample(0,d.targetFloorY+20)).toThrow('geometry changed');clone.geometry.dispose();
  });
  it('retains the native open boundary as explicit join loops without changing connectivity',()=>{
    const a=inspectNativeCliffPerimeter(source),b=inspectNativeCliffPerimeter(posed.geometry);
    expect(b).toEqual(a);expect(b.orientationConflicts).toBe(0);expect(b.nonManifoldEdges).toBe(0);
    expect(b.branched).toBe(false);expect(b.loops).toHaveLength(1);
    expect(b.loops[0].length).toBe(b.boundaryEdges);expect(b.boundaryEdges).toBeGreaterThan(4);
    expect(b.allEdgesPaired).toBe(false);
    expect(()=>inspectNativeCliffPerimeter(source,10)).toThrow('bounded');
  });
  it('detects a missing interior face as an additional open loop',()=>{
    const intact=inspectNativeCliffPerimeter(source),outer=new Set(intact.loops[0]),index=source.index!;
    let element=0;
    while(element<index.count&&[0,1,2].some(k=>outer.has(index.getX(element+k))))element+=3;
    expect(element).toBeLessThan(index.count);
    const broken=source.clone(),remaining=new Uint32Array(index.count-3);
    remaining.set(index.array.subarray(0,element));remaining.set(index.array.subarray(element+3),element);
    broken.setIndex(new THREE.BufferAttribute(remaining,1));
    const result=inspectNativeCliffPerimeter(broken);
    expect(result.branched).toBe(false);expect(result.loops).toHaveLength(2);
    expect(result.boundaryEdges).toBe(intact.boundaryEdges+3);expect(result.allEdgesPaired).toBe(false);
    broken.dispose();
  });
});
