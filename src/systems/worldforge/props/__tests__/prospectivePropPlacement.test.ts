// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GroundWorld } from '../../bridge/groundChunkLoader';
import { makeFieldSurfaceProbe } from '../../terrain/surfaceProbe';
import type { PropInstance } from '../propSchema';
import { placeFreshProps, seatFreshProp, freshPropFootprint } from '../prospectivePropPlacement';
import { createFreshPropClearance } from '../freshPropClearance';
import { createPropGeometriesV1, disposePropGeometriesV1, propShapeV1, propRenderScaleV1 } from '../generators/propRenderRecipeV1';
import { renderedPropPose } from '@/components/World3D/groundPropGeometry';
import { propLandConstraint } from '../propLandUse';
import * as THREE from 'three';

export const freshGround=()=>({cols:41,rows:41,heights:new Float32Array(41*41),boundsFeet:{x:0,y:0},extentMetersX:40,extentMetersZ:40,
  buildings:[{id:'wf-plot-1-0',xM:20,zM:20,cornersM:[{x:13,z:17},{x:27,z:17},{x:27,z:23},{x:13,z:23}],frontDoorOffsetX:0,frontDoorOffsetZ:-3}],
  roads:[],props:[]} as unknown as GroundWorld);
export const freshProp=(defId='woodpile',xM=20,zM=20):PropInstance=>({defId,xM,zM,rotationRad:0,variation:{scale:1,variant:0}});
const flat=makeFieldSurfaceProbe(()=>0);

describe('first-generation actual-model exterior placement',()=>{
  it('moves an indoor pile fully outside a large footprint and keeps the actual entrance clear',()=>{
    const ground=freshGround(),original=freshProp(),before=JSON.stringify({ground,original});
    const a=placeFreshProps(ground,[original],flat),b=placeFreshProps(ground,[original],flat);
    expect(a).toEqual(b);expect(a.report).toMatchObject({considered:1,kept:1,moved:1,declined:[]});
    const p=a.props[0];
    expect(createFreshPropClearance(ground).issuesFor(freshPropFootprint(p))).toEqual([]);
    expect(p.retainedSourceId).toBeUndefined();
    expect(p.variation).toEqual(original.variation);expect(p.rotationRad).toBe(original.rotationRad);
    expect(JSON.stringify({ground,original})).toBe(before);
  });

  it('keeps a rail outside even when its center alone is outside the wall',()=>{
    const ground=freshGround(),result=placeFreshProps(ground,[freshProp('fence-run',12,20)],flat);
    expect(result.report.kept).toBe(1);expect(result.report.moved).toBe(1);
    const p=result.props[0],shape=propShapeV1(p,{x:500,z:500})!,pose=renderedPropPose(p,p.surface!.groundYM);
    for(const vertex of shape.triangles.flat()){
      const v=new THREE.Vector3(...vertex).applyMatrix4(pose);
      expect(v.x>13&&v.x<27&&v.z>17&&v.z<23).toBe(false);
    }
  });

  it('seats actual stall posts and keeps purposeful under-stall stocking',()=>{
    const result=placeFreshProps(freshGround(),[freshProp('market-stall',7,7),freshProp('crate',7.4,7.2)],flat);
    expect(result.report).toMatchObject({kept:2,moved:0,declined:[]});
    expect(result.props.map(p=>[p.xM,p.zM])).toEqual([[7,7],[7.4,7.2]]);
    expect(result.props[0].surface!.groundYM).toBeCloseTo(0,6);
  });

  it('reports impossible first candidates without mutating or pretending to seat them',()=>{
    const original=freshProp('crate',7,7),before=JSON.stringify(original);
    const result=placeFreshProps(freshGround(),[original],makeFieldSurfaceProbe(()=>NaN));
    expect(result.props).toEqual([]);expect(result.report.declined).toHaveLength(1);
    expect(result.report.declined[0].reason).toBe('no-clear-supported-site');
    expect(JSON.stringify(original)).toBe(before);
  });

  it('pins art scale across different camera origins before the object is established',()=>{
    const result=placeFreshProps(freshGround(),[freshProp('boulder',7,7)],flat);
    expect(result.report.kept).toBe(1);const p=result.props[0];
    expect(propRenderScaleV1(p,{x:0,z:0})).toBe(propRenderScaleV1(p,{x:7,z:7}));
    expect(propShapeV1(p,{x:0,z:0})).toEqual(propShapeV1(p,{x:7,z:7}));
  });

  it('reuses local art while reading each candidate ground height and preserving scale differences',()=>{
    const library=createPropGeometriesV1();
    try{
      const prop={...freshProp('crate',7,7),renderRecipe:'props-v1' as const,renderScale:1};
      const a=seatFreshProp(prop,makeFieldSurfaceProbe(()=>0),library)!;
      const b=seatFreshProp({...prop,xM:9},makeFieldSurfaceProbe(()=>10),library)!;
      expect(b.xM).toBe(9);expect(b.surface!.groundYM-a.surface!.groundYM).toBeCloseTo(3.048,6);
      const large=seatFreshProp({...prop,renderScale:2},flat,library)!;
      const smallShape=propShapeV1(a,{x:0,z:0},library)!;
      const largeShape=propShapeV1(large,{x:0,z:0},library)!;
      const width=(shape:typeof smallShape)=>Math.max(...shape.triangles.flat().map(p=>p[0]))-Math.min(...shape.triangles.flat().map(p=>p[0]));
      expect(width(largeShape)).toBeCloseTo(width(smallShape)*2,6);
    }finally{disposePropGeometriesV1(library);}
  });

  it('refuses an unsupported rigid footprint rather than shaping the terrain',()=>{
    const library=createPropGeometriesV1();try{
      const p=freshProp('market-stall',7,7);
      const uneven=makeFieldSurfaceProbe((x,z)=>x>24&&z>24?8:0);
      expect(seatFreshProp(p,uneven,library)).toBeUndefined();
    }finally{disposePropGeometriesV1(library);}
  });
});



describe('source-affiliated fresh land use',()=>{
  const parcel=[{x:10,z:12},{x:30,z:12},{x:30,z:28},{x:10,z:28}];
  it('moves home supplies into their original lot and preserves the serving identity',()=>{
    const ground=freshGround();ground.buildings[0].propParcelM=parcel;
    const original={...freshProp(),affiliation:{kind:'building' as const,id:ground.buildings[0].id}};
    const before=JSON.stringify({ground,original}),result=placeFreshProps(ground,[original],flat);
    expect(result.report).toMatchObject({kept:1,moved:1,declined:[]});
    expect(result.props[0].affiliation).toEqual(original.affiliation);
    expect(propLandConstraint(ground,result.props[0]).containsHull(freshPropFootprint(result.props[0]))).toBe(true);
    expect(JSON.stringify({ground,original})).toBe(before);
  });
  it('does not borrow the neighboring lot when its serving lot has no yard',()=>{
    const ground=freshGround();ground.buildings[0].propParcelM=ground.buildings[0].cornersM;
    ground.buildings.push({...ground.buildings[0],id:'neighbor',xM:34,zM:20,
      cornersM:[{x:32,z:18},{x:36,z:18},{x:36,z:22},{x:32,z:22}],
      propParcelM:[{x:29,z:12},{x:40,z:12},{x:40,z:28},{x:29,z:28}]});
    const original={...freshProp(),affiliation:{kind:'building' as const,id:ground.buildings[0].id}};
    const result=placeFreshProps(ground,[original],flat);
    expect(result.props).toEqual([]);expect(result.report.declined[0].reason).toBe('no-clear-supported-affiliated-site');
    expect(result.report.declined[0].affiliation).toEqual(original.affiliation);
    expect(result.report.declined[0].affiliation).not.toBe(original.affiliation);
  });
  it('refuses a missing source lot or building instead of inferring one from proximity',()=>{
    const ground=freshGround(),original={...freshProp('crate',7,7),affiliation:{kind:'building' as const,id:ground.buildings[0].id}};
    expect(placeFreshProps(ground,[original],flat).report.declined[0].reason).toBe('missing-serving-parcel');
    expect(placeFreshProps(ground,[{...original,affiliation:{kind:'building',id:'missing'}}],flat).report.declined[0].reason).toBe('unknown-serving-building');
  });
  it('uses the actual dock top without changing the ground or moving its stock onto land',()=>{
    const ground=freshGround();ground.decks=[{kind:'dock',topY:3,cornersM:[{x:2,z:2},{x:12,z:2},{x:12,z:12},{x:2,z:12}]}];
    const before=JSON.stringify(ground.heights),original={...freshProp('crate',7,7),affiliation:{kind:'dock' as const,id:'deck:0'}};
    const result=placeFreshProps(ground,[original],makeFieldSurfaceProbe(()=>-10));
    expect(result.report).toMatchObject({kept:1,moved:0,declined:[]});
    expect(result.props[0].surface!.groundYM).toBeCloseTo(3,6);
    expect(JSON.stringify(ground.heights)).toBe(before);
    const missing=placeFreshProps(ground,[{...original,affiliation:{kind:'dock',id:'deck:99'}}],flat);
    expect(missing.report.declined[0].reason).toBe('unknown-serving-dock');
  });
  it('keeps communal props within their emitted court or market area',()=>{
    for(const kind of ['court','market'] as const){
      const original={...freshProp('crate',7,7),affiliation:{kind,id:'shared',xM:7,zM:7,radiusM:3}};
      const result=placeFreshProps(freshGround(),[original],flat);
      expect(result.props).toHaveLength(1);
      expect(propLandConstraint(freshGround(),result.props[0]).containsHull(freshPropFootprint(result.props[0]))).toBe(true);
      const tooSmall=placeFreshProps(freshGround(),[{...original,affiliation:{...original.affiliation,radiusM:.1}}],flat);
      expect(tooSmall.props).toEqual([]);
    }
  });
});



describe('actual mounted space rather than a filled plot',()=>{
  it('keeps a supported pile in its own unused yard without enlarging the lot or changing art',()=>{
    const ground=freshGround();
    ground.buildings[0].parts=[{x:0,z:0,w:4,d:4,h:.1,colorHex:'#777',walkSurface:'floor'}];
    ground.buildings[0].propParcelM=[{x:10,z:12},{x:30,z:12},{x:30,z:28},{x:10,z:28}];
    const original={...freshProp('woodpile',25,20),affiliation:{kind:'building' as const,id:ground.buildings[0].id}};
    const before=JSON.stringify(ground),result=placeFreshProps(ground,[original],flat);
    expect(result.report).toMatchObject({kept:1,moved:0,declined:[]});
    expect(result.props[0]).toMatchObject({xM:25,zM:20,rotationRad:original.rotationRad,variation:original.variation,affiliation:original.affiliation});
    expect(JSON.stringify(ground)).toBe(before);
  });
});




describe('fresh pose JSON continuity',()=>{
  it('normalizes signed zero before a slope-fitted prop is first established',()=>{
    const library=createPropGeometriesV1();
    try{
      const prop=seatFreshProp(freshProp('crate',7,7),makeFieldSurfaceProbe(x=>x*.001),library)!;
      expect(prop).toBeDefined();expect(Object.is(prop.surface!.tiltAxis[0],-0)).toBe(false);
      expect(JSON.parse(JSON.stringify(prop))).toEqual(prop);
    }finally{disposePropGeometriesV1(library);}
  });
});
