/** A new town address must become a clear, dry public standing place for the
 * entire existing cast. These fixtures never authorize changing a saved pose. */
import {describe,it,expect} from 'vitest';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {metersToHeight} from '@/systems/world3d/config';
import {publicEntryBodyFits,selectInitialPublicTownEntry,type EntryActor} from '../initialTownEntry';
const body={heightM:2,halfWidthM:.5,mouthHeightM:1.6};
const actor:EntryActor={id:'player',offset:{x:0,z:0},body};
const square=(x:number,z:number,r:number)=>[{x:x-r,z:z-r},{x:x+r,z:z-r},{x:x+r,z:z+r},{x:x-r,z:z+r}];
const ground=()=>({cols:65,rows:65,extentMetersX:97.536,extentMetersZ:97.536,heights:Array(65*65).fill(metersToHeight(5)),biomeIds:Array(65*65).fill('plains'),features:[],props:[],hostiles:[],hiddenSites:[],dungeonEntrances:[],gatehouses:[],towns:[],rosters:[],occupants:[],roads:[{sourceKind:'town-street',points:[{x:10,z:40},{x:80,z:40}],widthM:6}],plazas:[],buildings:[],decks:[],walls:[],rivers:[],waterBodies:[]} as GroundWorld);
describe('initial public town entry',()=>{
 it('rejects a visible porch post outside the plot instead of placing a body through it',()=>{
  const g=ground();g.buildings=[{id:'porch',xM:45,zM:45,cornersM:square(45,45,3),heightM:6,wallWidthM:6,wallDepthM:6,
   parts:[{x:0,z:-5,w:.2,d:.2,h:3,colorHex:'#6b5a43',tag:'building-ensemble'}],role:'residential'}];
  const before=structuredClone(g);
  expect(publicEntryBodyFits(g,{x:45,z:40},body)).toBe(false);
  const entry=selectInitialPublicTownEntry(g,{x:45,z:40},[actor])!;
  expect(Math.abs(entry.x-45)).toBeGreaterThan(.75);expect(g).toEqual(before);
 });
 it('does not turn invisible tactical walls or overhead trim into a standing obstruction',()=>{
  const g=ground();g.buildings=[{id:'porch',xM:45,zM:45,cornersM:square(45,45,3),heightM:6,wallWidthM:6,wallDepthM:6,
   parts:[{x:0,z:-5,w:2,d:2,h:3,colorHex:'#333',renderRole:'tactical-only'},
    {x:0,z:-5,w:2,d:2,h:.2,baseY:4,colorHex:'#333',tag:'roof'}],role:'residential'}];
  expect(publicEntryBodyFits(g,{x:45,z:40},body)).toBe(true);
 });
 it('uses the rendered yaw and street-face flip for a protruding part',()=>{
  for(const reversed of [false,true]){
   const g=ground(),angle=Math.PI/4,quad=square(45,45,3).map(p=>({x:45+(p.x-45)*Math.cos(angle)+(p.z-45)*Math.sin(angle),z:45-(p.x-45)*Math.sin(angle)+(p.z-45)*Math.cos(angle)}));
   const cornersM=reversed?[quad[0],quad[3],quad[2],quad[1]]:quad;
   // Swapping frontage/depth changes the canonical frame, so this fixture
   // chooses the equivalent authored post for that actual rendered frame.
   const part=reversed?{x:-6,z:2}:{x:2,z:-6};
   g.buildings=[{id:'rotated-porch',xM:45,zM:45,cornersM,heightM:6,wallWidthM:6,wallDepthM:6,
    parts:[{...part,w:.2,d:.2,h:3,colorHex:'#6b5a43',tag:'motif'}],role:'residential'}];
   expect(publicEntryBodyFits(g,{x:45+2*Math.cos(angle)-6*Math.sin(angle),z:45-2*Math.sin(angle)-6*Math.cos(angle)},body)).toBe(false);
  }
 });
 it('uses an existing street, fits every body and leaves source geometry untouched',()=>{
  const g=ground(),before=structuredClone(g),actors=[actor,{id:'companion',offset:{x:.7,z:-1.125},body}];
  const entry=selectInitialPublicTownEntry(g,{x:45,z:42},actors)!;
  expect(entry).toMatchObject({x:45,z:40,source:{kind:'street',index:0}});
  expect(entry.actors.map(a=>a.id)).toEqual(['player','companion']);
  for(const a of entry.actors)expect(publicEntryBodyFits(g,{x:a.xM,z:a.zM},body)).toBe(true);
  expect(g).toEqual(before);
 });
 it('rejects a building footprint and finds a different point on the same source street',()=>{
  const g=ground();g.buildings=[{id:'house',xM:45,zM:40,cornersM:square(45,40,3),heightM:6,wallWidthM:6,wallDepthM:6,parts:[],role:'residential'}];
  expect(publicEntryBodyFits(g,{x:45,z:40},body)).toBe(false);
  const entry=selectInitialPublicTownEntry(g,{x:45,z:40},[actor])!;
  expect(Math.abs(entry.x-45)).toBeGreaterThan(3.65);expect(entry.z).toBe(40);
 });
 it('requires room for the companion too, rather than admitting only the player',()=>{
  const g=ground();g.roads[0].widthM=2;
  expect(selectInitialPublicTownEntry(g,{x:45,z:40},[actor])).not.toBeNull();
  expect(selectInitialPublicTownEntry(g,{x:45,z:40},[actor,{id:'wide-cast',offset:{x:0,z:1},body}])).toBeNull();
 });
 it('will use an authored plaza but never invent a public place on an empty field',()=>{
  const g=ground();g.roads=[];expect(selectInitialPublicTownEntry(g,{x:45,z:40},[actor])).toBeNull();
  g.plazas=[{pointsM:square(45,40,5)}];
  expect(selectInitialPublicTownEntry(g,{x:45,z:40},[actor])).toMatchObject({x:45,z:40,source:{kind:'plaza'}});
 });
 it('does not treat regional roads as proof of a public town street',()=>{
  const g=ground();g.roads[0].sourceKind='region-road';expect(selectInitialPublicTownEntry(g,{x:45,z:40},[actor])).toBeNull();
 });
 it('does not place a new body beneath or on an unqualified deck',()=>{
  const g=ground();g.decks=[{kind:'bridge',topY:8,cornersM:square(45,40,5)}];
  expect(publicEntryBodyFits(g,{x:45,z:40},body)).toBe(false);
 });
 it('checks source wall width as well as building plots',()=>{
  const g=ground();g.walls=[{points:[{x:45,z:35},{x:45,z:45}],widthM:1}];
  expect(publicEntryBodyFits(g,{x:45,z:40},body)).toBe(false);
  expect(publicEntryBodyFits(g,{x:47,z:40},body)).toBe(true);
 });
 it('refuses unknown water even on a street',()=>{
  const g=ground();g.rivers=[{points:[{x:10,z:40},{x:80,z:40}],widthM:2}];
  expect(publicEntryBodyFits(g,{x:45,z:40},body)).toBe(false);
 });
 it('checks the standing footprint grade rather than a finite center height alone',()=>{
  const g=ground();g.heights=g.heights.map((_,i)=>metersToHeight((i%65)*3));
  expect(publicEntryBodyFits(g,{x:45,z:40},body)).toBe(false);
 });
 it('rejects unknown body dimensions and never searches outside the bounded source area',()=>{
  const g=ground();expect(publicEntryBodyFits(g,{x:45,z:40},{...body,halfWidthM:NaN})).toBe(false);
  expect(selectInitialPublicTownEntry(g,{x:500,z:500},[actor])).toBeNull();
  expect(selectInitialPublicTownEntry(g,{x:45,z:40},[])).toBeNull();
 });
});
