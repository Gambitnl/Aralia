/** A placement diagnosis cannot silently migrate a save, promote a supported
 * under-bridge person or certify a bank from its center point alone. */
import {describe,expect,it,vi} from 'vitest';
import {metersToHeight} from '@/systems/world3d/config';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {GroundWalkSurfaces} from '../groundBuildingMotion';
import {inspectLegacyScenePlacement, measurePlacementBody, type PlacementInspectionActor} from '../groundPlacementInspection';
import * as THREE from 'three';
vi.mock('../groundWaterMovement',()=>({groundWaterMovementAt:vi.fn(()=>({mode:'dry',multiplier:1}))}));
import {groundWaterMovementAt} from '../groundWaterMovement';
const ground=()=>({cols:4,rows:4,heights:Array(16).fill(metersToHeight(2)).map((h,i)=>i===10?metersToHeight(-8):h),buildings:[],rivers:[],decks:[]} as unknown as GroundWorld);
const body={heightM:2.7,halfWidthM:.7,mouthHeightM:1.97};
const actor=():PlacementInspectionActor=>({id:'mara',position:{xM:2.124,yM:2,zM:2.124},body});
const surfaces=(height=5):GroundWalkSurfaces=>({surfaceHeightsAt:()=>[height],intersectsBody:()=>false});
describe('read-only legacy placement inspection',()=>{
 it('measures the visible figure without mistaking its projected shadow for its body',()=>{
  const group=new THREE.Group();group.position.set(8,6,4);
  const bodyMesh=new THREE.Mesh(new THREE.BoxGeometry(2,3,1),new THREE.MeshBasicMaterial());bodyMesh.position.y=1.5;group.add(bodyMesh);
  const shadow=new THREE.Mesh(new THREE.BoxGeometry(20,.01,20),new THREE.MeshBasicMaterial());shadow.name='blobShadow';group.add(shadow);
  const hidden=new THREE.Mesh(new THREE.BoxGeometry(30,30,30),new THREE.MeshBasicMaterial({visible:false}));group.add(hidden);
  expect(measurePlacementBody(group)).toEqual({heightM:3,halfWidthM:1});
  expect(group.position.toArray()).toEqual([8,6,4]);
 });
 it('keeps an absent body or absent mouth unknown',()=>{
  expect(measurePlacementBody(new THREE.Group())).toBeUndefined();
  const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());mesh.position.y=1;group.add(mesh);
  expect(measurePlacementBody(group)).not.toHaveProperty('mouthHeightM');
 });
 it('recognizes the old nearest-height signature and inspects a real deck without applying it',()=>{
  const g=ground(),a=actor(),before=structuredClone({g,a});const result=inspectLegacyScenePlacement(g,[a],'mara',surfaces());
  expect(result.legacyPlayerSignature).toBe(true);expect(result.actors[0].supported).toBe(false);
  expect(result.actors[0].candidates.find(c=>c.kind==='deck')).toMatchObject({position:{xM:2.124,yM:5,zM:2.124},admissible:true});
  expect({g,a}).toEqual(before);
 });
 it('rejects a steep bank even when its center has a finite terrain height',()=>{
  const result=inspectLegacyScenePlacement(ground(),[actor()],'mara',surfaces());
  expect(result.actors[0].candidates.find(c=>c.kind==='terrain')!.reasons).toContain('steep-or-incomplete-support');
 });
 it('keeps supported below-bridge positions verbatim',()=>{
  const g=ground();g.heights.fill(metersToHeight(2));const a=actor();
  expect(inspectLegacyScenePlacement(g,[a],'mara',surfaces()).actors[0]).toMatchObject({supported:true,candidates:[],position:a.position});
 });
 it('does not infer legacy placement from an arbitrary floating save',()=>{
  const a=actor();a.position.yM=20;
  expect(inspectLegacyScenePlacement(ground(),[a],'mara',surfaces())).toMatchObject({legacyPlayerSignature:false,actors:[{candidates:[]}]});
 });
 it('requires an encounter provenance flag and the same legacy floor for another person',()=>{
  const companion={...actor(),id:'elara',position:{...actor().position,xM:2.224}};
  expect(inspectLegacyScenePlacement(ground(),[actor(),companion],'mara',surfaces()).actors[1].candidates).toEqual([]);
  companion.legacyEncounter=true;
  expect(inspectLegacyScenePlacement(ground(),[actor(),companion],'mara',surfaces()).actors[1].candidates.length).toBeGreaterThan(0);
  companion.position.yM=2.01;
  expect(inspectLegacyScenePlacement(ground(),[actor(),companion],'mara',surfaces()).actors[1].candidates).toEqual([]);
 });
 it('refuses unknown measured anatomy',()=>{
  const a=actor();delete a.body;
  expect(inspectLegacyScenePlacement(ground(),[a],'mara',surfaces()).actors[0].candidates.every(c=>c.reasons.includes('unknown-body'))).toBe(true);
 });
 it('rejects a rail top that cannot support the measured footprint',()=>{
  const s=surfaces();s.surfaceHeightsAt=(x,z)=>x===2.124&&z===2.124?[5]:[];
  expect(inspectLegacyScenePlacement(ground(),[actor()],'mara',s).actors[0].candidates.find(c=>c.kind==='deck')!.admissible).toBe(false);
 });
 it('uses the full measured body for deck underside clearance',()=>{
  const s=surfaces();s.intersectsBody=vi.fn((point,width,height)=>height>2.6);
  const candidate=inspectLegacyScenePlacement(ground(),[actor()],'mara',s).actors[0].candidates.find(c=>c.kind==='deck')!;
  expect(candidate.reasons).toContain('body-obstruction');expect(s.intersectsBody).toHaveBeenCalledWith(candidate.position,.7,2.7);
 });
 it('does not authorize a building from the smaller legacy collision proxy',()=>{
  const g=ground();g.buildings=[{id:'source-building',role:'workshop',xM:2,zM:2,parts:[],heightM:3,wallWidthM:4,wallDepthM:4,cornersM:[{x:0,z:0},{x:4,z:0},{x:4,z:4},{x:0,z:4}]}];
  expect(inspectLegacyScenePlacement(g,[actor()],'mara',surfaces()).actors[0].candidates.every(c=>c.reasons.includes('building-clearance-unverified'))).toBe(true);
 });
 it('retains a water refusal rather than treating a finite floor as passage',()=>{
  vi.mocked(groundWaterMovementAt).mockReturnValueOnce({mode:'blocked',multiplier:Infinity,reason:'deep-water'}).mockReturnValueOnce({mode:'blocked',multiplier:Infinity,reason:'unknown-water'});
  expect(inspectLegacyScenePlacement(ground(),[actor()],'mara',surfaces()).actors[0].candidates.every(c=>c.reasons.includes('water-blocked'))).toBe(true);
 });
});
