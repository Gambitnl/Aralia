/** Source bounds can reject distant candidates but never substitute for exact land fit. */
import {describe,it,expect} from 'vitest';
import {propLandConstraint} from '../propLandUse';
import {placeFreshProps,freshPropFootprint} from '../prospectivePropPlacement';
import {makeFieldSurfaceProbe} from '../../terrain/surfaceProbe';
import type {GroundWorld} from '../../bridge/groundChunkLoader';
import type {PropInstance} from '../propSchema';
const polygon=[{x:-8,z:2},{x:3,z:2},{x:3,z:9},{x:-8,z:9}];
const ground={buildings:[{id:'home',propParcelM:polygon}],decks:[{kind:'dock',cornersM:polygon,topY:4}]} as unknown as GroundWorld;
const prop={defId:'crate',xM:0,zM:0,rotationRad:0,variation:{scale:1,variant:0}} as PropInstance;
describe('source-land conservative search bounds',()=>{
  it.each(['building','dock'] as const)('retains exact %s land and copies its bounds',kind=>{
    const land=propLandConstraint(ground,{...prop,affiliation:{kind,id:kind==='building'?'home':'deck:0'}});
    expect(land.bounds).toEqual({minX:-8,maxX:3,minZ:2,maxZ:9});
    expect(land.containsHull([{x:-1,z:3},{x:1,z:3},{x:1,z:4},{x:-1,z:4}])).toBe(true);
    expect(land.containsHull([{x:2,z:3},{x:4,z:3},{x:4,z:4},{x:2,z:4}])).toBe(false);
  });
  it('keeps the exact circle test inside market bounding corners',()=>{
    const land=propLandConstraint(ground,{...prop,affiliation:{kind:'market',id:'square',xM:10,zM:20,radiusM:5}});
    expect(land.bounds).toEqual({minX:5,maxX:15,minZ:15,maxZ:25});
    expect(land.containsHull([{x:14,z:24},{x:14.1,z:24},{x:14,z:24.1}])).toBe(false);
  });
  it('adds no arbitrary bounds for unassigned objects and still refuses missing source land',()=>{
    expect(propLandConstraint(ground,prop).bounds).toBeUndefined();
    const land=propLandConstraint(ground,{...prop,affiliation:{kind:'building',id:'missing'}});
    expect(land.issue).toBe('unknown-serving-building');
    expect(land.containsHull(polygon)).toBe(false);
  });
});

// Authored source geometry isolates the projection/reservation contract. Actual
// terrain, rendered tools and NPC passage still require native qualification.
describe('explicit rural prop reservations',()=>{
  const ft=.3048;
  const square=(x:number,y:number,w:number)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w]] as Array<[number,number]>;
  const hull=(x:number,y:number,w=1)=>square(x,y,w).map(([a,b])=>({x:(a+100)*ft,z:(b+200)*ft}));
  function farmGround():GroundWorld {
    const site={farmId:'f0',plotId:1000000,farmParcelIndex:0,occupants:4,crop:'grain' as const,
      yardSource:{kind:'field' as const,id:'field:0'},sourceCenter:[20,20] as [number,number],center:[20,20] as [number,number],
      house:square(10,10,20),yard:square(0,0,40),approach:{points:[[20,0],[20,-40]] as Array<[number,number]>,width:8,streetIndex:0}};
    return {boundsFeet:{x:-100,y:-200},buildings:[{id:'wf-plot-7-1000000',propParcelM:hull(0,0,40)},
      {id:'other',propParcelM:hull(-100,-100,300)}],decks:[],townPlans:[{burgId:7,plan:{
        ruralSources:{layoutRecipe:'rural-family-v1',homesteads:{version:1,sites:[site],declined:[]},
          fields:[{farmParcelIndex:0,polygon:square(-100,-100,300),crop:'grain'}]},plots:[]}}]} as unknown as GroundWorld;
  }
  it('projects the whole hull into source feet and refuses yards and track edges',()=>{
    const land=propLandConstraint(farmGround(),prop);
    expect(land.containsHull(hull(2,2))).toBe(false);
    expect(land.containsHull(hull(23.8,-20))).toBe(false);
    expect(land.containsHull(hull(25,-20))).toBe(true);
    expect(land.containsHull(hull(45,20))).toBe(true);
    expect(land.contains((24.1+100)*ft,(-20+200)*ft,.5*ft)).toBe(false);
  });
  it('allows the serving farm yard but keeps its approach and parcel edges clear',()=>{
    const ground=farmGround(),land=propLandConstraint(ground,{...prop,affiliation:{kind:'building',id:'wf-plot-7-1000000'}});
    expect(land.containsHull(hull(2,2))).toBe(true);
    expect(land.containsHull(hull(19,0))).toBe(false);
    expect(land.containsHull(hull(39.5,30))).toBe(false);
    const stranger=propLandConstraint(ground,{...prop,affiliation:{kind:'building',id:'other'}});
    expect(stranger.containsHull(hull(2,2))).toBe(false);
  });
  it('retains neighbor yard protection and rejects duplicate serving identities',()=>{
    const ground=farmGround(),sources=ground.townPlans![0].plan.ruralSources!;
    sources.homesteads.sites.push({...structuredClone(sources.homesteads.sites[0]),farmId:'f1',plotId:1000001,yard:square(30,30,40)});
    const own={...prop,affiliation:{kind:'building' as const,id:'wf-plot-7-1000000'}};
    expect(propLandConstraint(ground,own).containsHull(hull(31,31))).toBe(false);
    sources.homesteads.sites.push(structuredClone(sources.homesteads.sites[0]));
    expect(propLandConstraint(ground,own).containsHull(hull(2,2))).toBe(false);
  });
  it('applies reservations in actual first-placement search without changing its source',()=>{
    const ground=farmGround(),building=ground.buildings[0];
    ground.buildings=[{...building,xM:120*ft,zM:220*ft,cornersM:hull(10,10,20),frontDoorOffsetX:0,frontDoorOffsetZ:-10*ft}];
    ground.roads=[];ground.props=[];
    const original={...prop,defId:'woodpile',xM:120*ft,zM:200*ft,affiliation:{kind:'building' as const,id:building.id}},before=JSON.stringify({ground,original});
    const result=placeFreshProps(ground,[original],makeFieldSurfaceProbe(()=>0));
    expect(result.report).toMatchObject({kept:1,moved:1,declined:[]});
    expect(result.props[0].affiliation).toEqual(original.affiliation);
    expect(propLandConstraint(ground,result.props[0]).containsHull(freshPropFootprint(result.props[0]))).toBe(true);
    expect(JSON.stringify({ground,original})).toBe(before);
  });
  it('refuses missing projection rather than treating canonical feet as meters',()=>{
    const ground=farmGround();delete ground.boundsFeet;
    expect(propLandConstraint(ground,prop).issue).toBe('missing-rural-projection');
  });
  it('retains legacy decisions without rural sources and survives source JSON',()=>{
    const ground=farmGround(),restored=JSON.parse(JSON.stringify(ground)) as GroundWorld;
    expect(propLandConstraint(restored,prop).containsHull(hull(2,2))).toBe(false);
    delete ground.townPlans![0].plan.ruralSources;
    expect(propLandConstraint(ground,prop).containsHull(hull(2,2))).toBe(true);
    expect(propLandConstraint(ground,prop).containsHull(hull(19,-20))).toBe(true);
  });
});
