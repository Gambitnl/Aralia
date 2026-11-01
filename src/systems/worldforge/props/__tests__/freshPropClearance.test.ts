// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GroundWorld } from '../../bridge/groundChunkLoader';
import type { SitePart } from '../../bridge/interiorParts';
import { createFreshPropClearance, freshDoorSwingFootprint } from '../freshPropClearance';
import { convexFootprint, footprintDistance, footprintFitsLot, footprintRouteDistance, pointInsideFootprint } from '../propFootprint';
import * as THREE from 'three';
import { freshPropFootprint } from '../prospectivePropPlacement';
import { createPropGeometriesV1, disposePropGeometriesV1, propShapeV1 } from '../generators/propRenderRecipeV1';
import { RENDERABLE_DEF_IDS } from '../placementEngine';
import { renderedPropPose } from '@/components/World3D/groundPropGeometry';
import { propLandConstraint } from '../propLandUse';
import { exteriorPropSearchPoints } from '../exteriorPropRepair';

const rect=(x:number,z:number,hx:number,hz:number)=>[
  {x:x-hx,z:z-hz},{x:x+hx,z:z-hz},{x:x+hx,z:z+hz},{x:x-hx,z:z+hz},
];
const ground=()=>({extentMetersX:40,extentMetersZ:40,buildings:[],roads:[],decks:[]} as unknown as GroundWorld);
const floor=(x:number,z:number,w:number,d:number):SitePart=>({x,z,w,d,h:.1,colorHex:'#777',walkSurface:'floor'});
const building=(parts:SitePart[])=>({id:'home',xM:10,zM:10,cornersM:rect(10,10,5,5),parts} as GroundWorld['buildings'][number]);

describe('actual footprint geometry',()=>{
  it('keeps long narrow art in its lot without requiring its broad disc to fit',()=>{
    const lot=rect(10,10,5,1),hull=rect(10,10,4,.3),g=ground();
    g.buildings=[{...building([]),propParcelM:lot}];
    const land=propLandConstraint(g,{defId:'fence-run',xM:10,zM:10,rotationRad:0,variation:{scale:1,variant:0},affiliation:{kind:'building',id:'home'}});
    expect(land.contains(10,10,Math.hypot(4,.3))).toBe(false);
    expect(land.containsHull(hull)).toBe(true);
  });
  it('refuses a hull crossing a concave neighbor notch even if every vertex is inside',()=>{
    const lot=[{x:0,z:0},{x:6,z:0},{x:6,z:6},{x:4,z:6},{x:4,z:2},{x:2,z:2},{x:2,z:6},{x:0,z:6}];
    const hull=rect(3,3.5,2,.5);
    expect(hull.every(p=>pointInsideFootprint(p,lot))).toBe(true);
    expect(footprintFitsLot(hull,lot)).toBe(false);
  });
  it('catches edge-only crossings and containment as well as vertex collisions',()=>{
    expect(footprintDistance(rect(0,0,3,.2),rect(0,0,.2,3))).toBe(0);
    expect(footprintDistance(rect(0,0,3,3),rect(0,0,.2,.2))).toBe(0);
    expect(footprintDistance(rect(0,0,1,1),rect(4,0,1,1))).toBe(2);
    const points=[...rect(0,0,3,1),{x:0,z:0}],before=JSON.stringify(points);
    expect(convexFootprint(points)).toHaveLength(4);expect(JSON.stringify(points)).toBe(before);
  });
});

describe('fresh mounted structural clearance',()=>{
  it('reserves the actual L-shaped floor pieces while leaving their open corner usable',()=>{
    const g=ground();g.buildings=[building([floor(-2,0,2,6),floor(0,2,2,2)])];
    const before=JSON.stringify(g),clearance=createFreshPropClearance(g);
    expect(clearance.fallbackBuildings).toEqual([]);
    expect(clearance.issuesFor(rect(10,9,.3,.3))).toEqual([]);
    expect(clearance.isClear(rect(10,9,.3,.3))).toBe(true);
    expect(clearance.issuesFor(rect(8,10,.2,.2))).toContain('home');
    expect(clearance.isClear(rect(8,10,.2,.2))).toBe(false);
    expect(JSON.stringify(g)).toBe(before);
  });
  it('projects the same floor through a rotated and translated site frame',()=>{
    const g=ground(),b=building([floor(2,0,2,2)]);
    b.cornersM=[{x:15,z:5},{x:15,z:15},{x:5,z:15},{x:5,z:5}];g.buildings=[b];
    const clearance=createFreshPropClearance(g);
    expect(clearance.issuesFor(rect(10,12,.1,.1))).toContain('home');
    expect(clearance.issuesFor(rect(12,10,.1,.1))).toEqual([]);
  });
  it('keeps plot fallback explicit when mounted structure is unavailable',()=>{
    const g=ground();g.buildings=[building([])];
    const clearance=createFreshPropClearance(g);
    expect(clearance.fallbackBuildings).toEqual(['home']);
    expect(clearance.issuesFor(rect(10,10,.1,.1))).toContain('home');
  });
  it('refuses malformed structural parts instead of treating their ground as empty',()=>{
    const g=ground();g.buildings=[building([{...floor(0,0,2,2),w:NaN}])];
    expect(createFreshPropClearance(g).issuesFor(rect(30,30,.1,.1))).toContain('invalid-structural-part:home');
  });
  it('checks the full road width and its endpoint against the actual hull',()=>{
    const g=ground();g.roads=[{points:[{x:5,z:10},{x:20,z:10}],widthM:2} as GroundWorld['roads'][number]];
    const clearance=createFreshPropClearance(g);
    expect(clearance.issuesFor(rect(12,12,.2,.7))).toContain('road:0');
    expect(clearance.issuesFor(rect(21,10,.2,.2))).toContain('road:0');
    expect(clearance.issuesFor(rect(12,13,.2,.2))).toEqual([]);
  });
  it('updates or removes complete neighboring hulls without leaving ghost obstacles',()=>{
    const clearance=createFreshPropClearance(ground());
    clearance.setProp('rail',rect(10,10,3,.2));
    expect(clearance.issuesFor(rect(10,10,.2,3))).toContain('rail');
    expect(clearance.issuesFor(rect(10,10,.2,3),'rail')).toEqual([]);
    clearance.setProp('rail',rect(30,30,3,.2));
    expect(clearance.issuesFor(rect(10,10,.2,3))).toEqual([]);
    clearance.removeProp('rail');expect(clearance.issuesFor(rect(30,30,.2,3))).toEqual([]);
  });
  it('protects the middle of a door swing, not just its open and closed endpoints',()=>{
    const part={x:0,z:0,w:2,d:.1,h:2,colorHex:'#777',door:{id:'entry',level:0,axis:'x',swingX:1,swingZ:1}} as SitePart;
    const hull=freshDoorSwingFootprint(building([part]),part);
    expect(pointInsideFootprint({x:9+1.9/Math.sqrt(2),z:10+1.9/Math.sqrt(2)},hull)).toBe(true);
    expect(pointInsideFootprint({x:8,z:9},hull)).toBe(false);
  });
  it('retains the existing bounded candidate order and twelve-meter search limit',()=>{
    const points=[...exteriorPropSearchPoints({x:10,z:20})];
    expect(points).toHaveLength(48*64);expect(points[0]).toEqual({x:10.25,z:20});
    for(let i=0;i<points.length;i++)expect(Math.hypot(points[i].x-10,points[i].z-20)).toBeCloseTo((Math.floor(i/64)+1)*.25,10);
  });
});



describe('working frontage supports',()=>{
  it('keeps an arcade column clear without filling the open ground between columns',()=>{
    const g=ground();g.buildings=[building([floor(0,0,4,4),
      {x:0,z:-4,w:.3,d:.3,h:2.5,colorHex:'#777',tag:'building-ensemble',ensembleDetailKind:'arcade-column'}])];
    const clearance=createFreshPropClearance(g);
    expect(clearance.issuesFor(rect(10,6,.1,.1))).toContain('home');
    expect(clearance.issuesFor(rect(12,6,.1,.1))).toEqual([]);
  });
});




describe('cached footprint matches the full recipe',()=>{
  it('matches every supported emitted form under yaw and multiple lean angles',()=>{
    const library=createPropGeometriesV1();let forms=0;
    try{
      for(const defId of RENDERABLE_DEF_IDS){
        let supported=false;
        for(const tilt of [0,.2,.65]){
          const prop={defId,xM:17,zM:31,rotationRad:.7,variation:{scale:1.1,variant:3},
            renderRecipe:'props-v1' as const,renderScale:.83,
            surface:{groundYM:0,sinkM:0,tiltRad:tilt,tiltAxis:[.6,.8] as [number,number]}};
          const shape=propShapeV1(prop,{x:0,z:0},library);if(!shape)continue;supported=true;
          const pose=renderedPropPose(prop,0),v=new THREE.Vector3();
          const reference=convexFootprint(shape.triangles.flat().map(point=>{v.set(...point).applyMatrix4(pose);return {x:v.x,z:v.z};}));
          const cached=freshPropFootprint(prop,library);
          expect(cached.length,defId).toBeGreaterThanOrEqual(3);
          for(const point of reference)expect(footprintRouteDistance(cached,point,point),defId+' reference').toBeLessThan(1e-6);
          for(const point of cached)expect(footprintRouteDistance(reference,point,point),defId+' cached').toBeLessThan(1e-6);
        }
        if(supported)forms++;
      }
      expect(forms).toBeGreaterThanOrEqual(25);
    }finally{disposePropGeometriesV1(library);}
  });
});
