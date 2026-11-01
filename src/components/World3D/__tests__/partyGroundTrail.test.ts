import {describe,it,expect} from 'vitest';
import {PartyGroundTrail,validPartyTrail,MAX_PARTY_TRAIL_POINTS} from '../partyGroundTrail';
const p=(xM:number,zM=0)=>({xM,yM:0,zM});
describe('accepted party footsteps',()=>{
 it('keeps a corner instead of cutting toward the latest leader point',()=>{
  const t=new PartyGroundTrail();t.observe(p(0));t.observe(p(5));t.observe(p(5,5));
  expect(t.target(p(0),2.25)).toEqual(p(5));expect(t.target(p(5),2.25)).toEqual(p(5,5));
 });
 it('stands at following distance without consuming the remaining route',()=>{
  const t=new PartyGroundTrail([p(2)]);expect(t.target(p(0),2.25)).toBeNull();expect(t.snapshot()).toEqual([p(2)]);
 });
 it('restores the same pending path without mutating the save',()=>{
  const saved=[p(3),p(3,5)],t=new PartyGroundTrail(saved);expect(t.target(p(0),2)).toEqual(p(3));
  t.observe(p(4,5));expect(saved).toEqual([p(3),p(3,5)]);expect(new PartyGroundTrail(t.snapshot()).snapshot()).toEqual(t.snapshot());
 });
 it('holds on overflow rather than deleting unresolved corners',()=>{
  const t=new PartyGroundTrail();for(let i=0;i<=MAX_PARTY_TRAIL_POINTS;i++)t.observe(p(i));
  expect(t.overflowed).toBe(true);expect(t.snapshot()).toHaveLength(MAX_PARTY_TRAIL_POINTS);expect(t.snapshot()[0]).toEqual(p(0));expect(t.target(p(0),2)).toBeNull();
  t.reunite(p(1));expect(t.overflowed).toBe(false);expect(t.snapshot()).toEqual([p(1)]);
 });
 it('rejects malformed stored trails and nonfinite observations',()=>{
  expect(validPartyTrail([{xM:NaN,yM:0,zM:0}])).toBe(false);const t=new PartyGroundTrail();t.observe(p(NaN));expect(t.snapshot()).toEqual([]);
 });
});
