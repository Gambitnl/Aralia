/** GG-537: the load step seats saved feet that lost their support at the
 * nearest place the measured body can stand, by the same standing rules as
 * the legacy placement inspection. It never guesses an unmounted chunk and
 * never lifts a body onto a deck overhead at the stored point. */
import {describe,expect,it,vi,beforeEach} from 'vitest';
import {metersToHeight} from '@/systems/world3d/config';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {GroundWalkSurfaces} from '../groundBuildingMotion';
import {findSeatForUnsupportedFeet,footingSeatNotice,SEAT_SEARCH_RADIUS_M} from '../groundFootingRecovery';
vi.mock('../groundWaterMovement',()=>({groundWaterMovementAt:vi.fn(()=>({mode:'dry',multiplier:1}))}));
import {groundWaterMovementAt} from '../groundWaterMovement';
const flat=(m=2)=>({cols:48,rows:48,heights:Array(48*48).fill(metersToHeight(m)),buildings:[],rivers:[],decks:[]} as unknown as GroundWorld);
const body={heightM:2.7,halfWidthM:.7,mouthHeightM:1.97};
// The Sinzheim probe: feet held at 8.45 m by a save made under the old water rule.
const feet={xM:30,zM:30,yM:8.45};
const surfaces=(over:Partial<GroundWalkSurfaces>={}):GroundWalkSurfaces=>({surfaceHeightsAt:()=>[],intersectsBody:()=>false,supportReadyAt:()=>true,...over});
const blockedWhere=(test:(p:{xM:number;zM:number;yM:number})=>boolean)=>vi.mocked(groundWaterMovementAt).mockImplementation((_g,p)=>
  test(p)?{mode:'blocked',multiplier:Infinity,reason:'deep-water'}:{mode:'dry',multiplier:1});
beforeEach(()=>{vi.mocked(groundWaterMovementAt).mockReset();blockedWhere(()=>false);});
describe('GG-537 seat for unsupported saved feet',()=>{
 it('settles hanging feet onto the ground directly below',()=>{
  const seat=findSeatForUnsupportedFeet(flat(),feet,body,surfaces())!;
  expect(seat).toMatchObject({xM:30,zM:30,kind:'terrain'});
  expect(seat.yM).toBeCloseTo(2,5);expect(seat.movedM).toBeCloseTo(6.45,5);
 });
 it('passes over a riverbed under deep water and takes the nearest bank',()=>{
  // The channel: every point west of x = 31 is too deep to wade.
  blockedWhere(p=>p.xM<31);
  const seat=findSeatForUnsupportedFeet(flat(),feet,body,surfaces())!;
  expect(seat.xM).toBeGreaterThanOrEqual(31);expect(seat.kind).toBe('terrain');
  expect(Math.hypot(seat.xM-feet.xM,seat.zM-feet.zM)).toBeLessThanOrEqual(1+1e-9);
 });
 it('never lifts the body onto a deck overhead at the stored point',()=>{
  // The ground under the feet is deep water; a deck spans everything at 11.7 m.
  blockedWhere(p=>p.yM<5&&Math.hypot(p.xM-30,p.zM-30)<1.2);
  const s=surfaces({surfaceHeightsAt:()=>[11.7]});
  const seat=findSeatForUnsupportedFeet(flat(),feet,body,s)!;
  expect(Math.hypot(seat.xM-feet.xM,seat.zM-feet.zM)).toBeGreaterThan(.4);
  expect(seat.kind).toBe('deck');
 });
 it('rejects a seat the body cannot occupy, as the legacy inspection does',()=>{
  const s=surfaces({intersectsBody:(p)=>Math.hypot(p.xM-30,p.zM-30)<2});
  const seat=findSeatForUnsupportedFeet(flat(),feet,body,s)!;
  expect(Math.hypot(seat.xM-feet.xM,seat.zM-feet.zM)).toBeGreaterThanOrEqual(2);
 });
 it('waits for the full-detail chunk instead of judging an unmounted one',()=>{
  expect(findSeatForUnsupportedFeet(flat(),feet,body,surfaces({supportReadyAt:()=>false}))).toBeNull();
  const legacy:GroundWalkSurfaces={surfaceHeightsAt:()=>[],intersectsBody:()=>false};
  expect(findSeatForUnsupportedFeet(flat(),feet,body,legacy)).toBeNull();
 });
 it('keeps the honest refusal when no seat exists within the search radius',()=>{
  blockedWhere(p=>Math.hypot(p.xM-30,p.zM-30)<=SEAT_SEARCH_RADIUS_M+1);
  expect(findSeatForUnsupportedFeet(flat(),feet,body,surfaces())).toBeNull();
 });
 it('names who moved, how far and onto what',()=>{
  expect(footingSeatNotice({xM:31,zM:30,yM:2,kind:'terrain',movedM:6.53},null))
   .toBe('The ground or water here changed since this save. You were moved 6.5 m to the nearest ground to stand.');
  expect(footingSeatNotice({xM:31,zM:30,yM:11.7,kind:'deck',movedM:3.4},'Elara'))
   .toBe('The ground or water here changed since this save. Elara was moved 3.4 m to the nearest deck to stand.');
 });
});
