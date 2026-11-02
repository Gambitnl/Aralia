// @vitest-environment node
/** Keep river coverage stable when the camera changes terrain detail. These
 * tests use the real sampler, builder, raycast and movement/rest consumers;
 * fixture terrain never enters a campaign or replaces an earned position. */
import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {sampleGroundChunk, groundSurfaceY, type GroundWorld} from '../groundChunkLoader';
import {buildWaterMesh} from '../../../world3d/waterGeometry';
import {metersToHeight, WORLD3D_CONFIG} from '../../../world3d/config';
import {GROUND_METERS_PER_CELL} from '../groundWorldAdapter';
import {ribbonBedHeightAt, validateRibbonBed} from '../groundRibbonBed';
import {inspectGroundWater} from '../groundWaterSurfaceQuery';
import {groundWaterMovementAt} from '../groundWaterMovement';
import {submergedRestError} from '../../../gameplay/lodging';

function source(center=64, half=1.6):GroundWorld {
  const cols=129,rows=129;
  return {cols,rows,heights:Array.from({length:cols*rows},(_,i)=>metersToHeight(Math.abs(Math.floor(i/cols)*GROUND_METERS_PER_CELL-center)<half?-2:6)),
    biomeIds:Array(cols*rows).fill('plains'),extentMetersX:cols*GROUND_METERS_PER_CELL,extentMetersZ:rows*GROUND_METERS_PER_CELL,
    features:[],props:[],hostiles:[],hiddenSites:[],dungeonEntrances:[],roads:[],walls:[],waterBodies:[],decks:[],gatehouses:[],towns:[],buildings:[],rosters:[],occupants:[],
    rivers:[{sourceKind:'river',points:[{x:12,z:center},{x:116,z:center}],widthM:8,surfaceWidthM:[8,8],waterlineY:[2,2]}]};
}
function ray(w:ReturnType<typeof buildWaterMesh>,x:number,z:number):number|undefined {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(w.positions,3));g.setIndex(new THREE.BufferAttribute(w.indices,1));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld(true);
  try{return new THREE.Raycaster(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0)).intersectObject(m)[0]?.point.y;}
  finally{g.dispose();m.material.dispose();}
}
describe('native ribbon source-bed contract',()=>{
  for(const center of [60.96,64,67.056])for(const half of [1.6,4,8])it(`retains the ${center}/${half} channel across supported and diagnostic LODs`,()=>{
    const g=source(center,half),before=JSON.stringify(g);
    const meshes=[2,5,9,17,33].map(r=>buildWaterMesh(sampleGroundChunk(g,0,0,r)));
    for(const mesh of meshes){expect(mesh.positions).toEqual(meshes[0].positions);expect(mesh.indices).toEqual(meshes[0].indices);expect(mesh.colors).toEqual(meshes[0].colors);expect(ray(mesh,64,center)).toBe(2);}
    expect(inspectGroundWater(g,64,center)).toEqual({status:'valid',surfaceY:2});expect(JSON.stringify(g)).toBe(before);
  });
  it('copies transferable Float64 samples without detaching source or display terrain',()=>{
    const g=source(),before=JSON.stringify(g),data=sampleGroundChunk(g,0,0,2),display=data.heights.buffer,bed=data.groundRibbonBed!.heights;
    const received=structuredClone(data,{transfer:[bed.buffer]});
    expect(bed.byteLength).toBe(0);expect(display.byteLength).toBeGreaterThan(0);validateRibbonBed(received);
    const m=WORLD3D_CONFIG.METERS_PER_CELL;
    expect(ribbonBedHeightAt(received,64/m,64/m,()=>NaN)).toBe(groundSurfaceY(g,64,64));
    expect(ray(buildWaterMesh(received),64,64)).toBe(2);expect(JSON.stringify(g)).toBe(before);
  });
  const invalid:[string,(d:ReturnType<typeof sampleGroundChunk>)=>void][]=[
    ['missing bed',d=>{delete d.groundRibbonBed;}],['missing mode',d=>{delete d.groundRibbonMode;}],
    ['wrong chunk',d=>{d.groundRibbonBed!.cx++;}],['wrong spacing',d=>{d.groundRibbonBed!.spacingM=2;}],
    ['nonfinite bed',d=>{d.groundRibbonBed!.heights[0]=NaN;}],['short buffer',d=>{d.groundRibbonBed!.heights=new Float64Array(1);}],
    ['wrong source',d=>{d.groundRibbonBed!.source.artifactSeedPath='wrong';}],['legacy with native bed',d=>{d.groundRibbonMode='legacy-continent';}],
    ['outside source',d=>{d.groundRibbonBed!.originCol=129;}],
  ];
  for(const [name,change] of invalid)it(`refuses ${name} before water construction`,()=>{const d=sampleGroundChunk(source(),0,0,2);change(d);expect(()=>buildWaterMesh(d)).toThrow();});
  it('keeps unknown native water unavailable through movement and ordinary rest',()=>{
    const g=source();delete g.rivers[0].waterlineY;
    expect(inspectGroundWater(g,64,64)).toMatchObject({status:'unavailable'});
    expect(groundWaterMovementAt(g,{xM:64,zM:64,yM:-2},{mouthHeightM:1.5})).toMatchObject({mode:'blocked',reason:'unknown-water'});
    expect(submergedRestError(g,{xM:64,zM:64,yM:-2})).toContain('could not be verified');
  });
  it('keeps malformed native bed unavailable rather than granting passage or rest',()=>{
    const g=source();g.heights.fill(NaN);
    expect(inspectGroundWater(g,64,64)).toMatchObject({status:'unavailable'});
    expect(groundWaterMovementAt(g,{xM:64,zM:64,yM:-2},{mouthHeightM:1.5})).toMatchObject({mode:'blocked',reason:'unknown-water'});
    expect(submergedRestError(g,{xM:64,zM:64,yM:-2})).toContain('could not be verified');
  });
});
