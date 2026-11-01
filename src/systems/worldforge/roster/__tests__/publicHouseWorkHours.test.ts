/** Evening customers need the real proprietor, with the same home and family
 * identity before and after the shift. Children and retired owners stay home. */
import {describe,expect,it} from 'vitest';
import {occupantDayRoutine,occupantLocationAt} from '../occupantSchedule';
import type {Occupant} from '../types';

type PublicHouseOccupant=Occupant & {publicHouseWorkRole?:'innkeeper'|'taverner'};
const keeper=(over:Partial<PublicHouseOccupant>={}):PublicHouseOccupant=>({
 id:29,name:'Bryn Hartbourne',ageBand:'adult',homePlotId:9,workPlotId:8,
 householdMemberId:'b9:head',occupation:'shopkeeper',publicHouseWorkRole:'innkeeper',...over,
});

describe('source-linked public-house proprietor hours',()=>{
 it.each(['innkeeper','taverner'] as const)('keeps the %s on duty throughout the existing evening patron band',role=>{
  const person=keeper({publicHouseWorkRole:role});
  for(const hour of [12,17,18,19,22])expect(occupantLocationAt(person,hour)).toMatchObject({activity:'working',plotId:8});
 });
 it('gives the active proprietor morning home time and a later bedtime',()=>{
  const person=keeper();
  for(const hour of [7,8,11])expect(occupantLocationAt(person,hour)).toMatchObject({activity:'home',plotId:9});
  for(const hour of [0,3,6,23])expect(occupantLocationAt(person,hour)).toMatchObject({activity:'sleeping',plotId:9});
 });
 it.each([{ageBand:'child' as const},{retired:true},{workPlotId:undefined}])('never creates a shift for an ineligible keeper: %j',over=>{
  const person=keeper(over);
  expect(occupantDayRoutine(person).every(block=>block.activity!=='working'&&block.plotId===9)).toBe(true);
 });
 it('preserves ordinary household workers and qualified civic duties',()=>{
  const ordinary=keeper({publicHouseWorkRole:undefined});
  expect(occupantLocationAt(ordinary,8)).toMatchObject({activity:'working',plotId:8});
  expect(occupantLocationAt(ordinary,19)).toMatchObject({activity:'home',plotId:9});
  const priest=keeper({publicHouseWorkRole:undefined,occupation:'resident',workPlotId:undefined,civicWorkplace:{role:'priest',plotId:66}});
  expect(occupantLocationAt(priest,8)).toMatchObject({activity:'working',plotId:66});
  expect(occupantLocationAt(priest,19)).toMatchObject({activity:'home',plotId:9});
 });
 it('does not rewrite names, family identity, home, workplace or retirement data',()=>{
  const person=keeper(),before=structuredClone(person);
  occupantDayRoutine(person);expect(person).toEqual(before);
  expect(occupantLocationAt(person,43)).toEqual(occupantLocationAt(person,19));
 });
});
