/** Saved layout metadata controls hydration without turning life updates into
 * terrain rebuilds. Mocked receipts prove the hook boundary, not native terrain. */
import {act,renderHook} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {useAppAtlasRuntime} from '../useAppAtlasRuntime';
import {createMockGameState} from '../../../utils/core/factories';
import type {AtlasGroundDrilldown} from '../../../systems/worldforge/leaf3d/atlasGroundDrilldown';

const fixture=vi.hoisted(()=>({address:{worldSeed:7,atlasCellId:42},restored:{source:'restored'},
 restore:vi.fn()}));
vi.mock('../../../systems/worldforge/leaf3d/atlasGroundDrilldown',()=>({atlasGroundAddressFromDrilldown:()=>fixture.address}));
vi.mock('../../../systems/worldforge/leaf3d/atlasGroundRestore',()=>({restoreAtlasGroundDrilldown:fixture.restore}));
function state(revision:1|2){return createMockGameState({worldSeed:7,atlasGroundAddress:fixture.address as never,
 townSim:{675:{burgId:675,layoutRevision:revision,villagers:{},chronicle:{burgId:675,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:1}}});}
beforeEach(()=>{fixture.restore.mockReset();fixture.restore.mockImplementation(()=>({status:'ready',address:fixture.address,drilldown:fixture.restored}));});
describe('saved layout metadata at Atlas hydration',()=>{
 it('passes the saved selection without copying a second population',()=>{
  const value=state(1),dispatch=vi.fn();
  const {result}=renderHook(()=>useAppAtlasRuntime(value,dispatch));
  expect(fixture.restore).toHaveBeenCalledWith(fixture.address,7,{675:{layoutRevision:1}});
  expect(result.current.activeAtlasGroundDrilldown).toBe(fixture.restored);
  expect(dispatch).not.toHaveBeenCalled();
 });
 it('retains a matching current live receipt across unrelated town-life updates',()=>{
  const value=state(2),live={source:'live'} as unknown as AtlasGroundDrilldown;
  const {result,rerender}=renderHook(({value})=>useAppAtlasRuntime(value,vi.fn()),{initialProps:{value}});
  act(()=>result.current.setAtlasGroundDrilldown(live));
  expect(result.current.activeAtlasGroundDrilldown).toBe(live);
  const count=fixture.restore.mock.calls.length;
  rerender({value:{...value,townSim:{675:{...value.townSim[675],prosperity:75,lastSimDay:1}}}});
  expect(result.current.activeAtlasGroundDrilldown).toBe(live);
  expect(fixture.restore).toHaveBeenCalledTimes(count);
 });
 it('does not retain a current receipt as an older selected town merely because addresses match',()=>{
  const value=state(2),dispatch=vi.fn(),live={source:'current-live'} as unknown as AtlasGroundDrilldown;
  const {result,rerender}=renderHook(({value})=>useAppAtlasRuntime(value,dispatch),{initialProps:{value}});
  act(()=>result.current.setAtlasGroundDrilldown(live));
  rerender({value:state(1)});
  expect(result.current.activeAtlasGroundDrilldown).toBe(fixture.restored);
  expect(fixture.restore).toHaveBeenLastCalledWith(fixture.address,7,{675:{layoutRevision:1}});
  expect(dispatch).not.toHaveBeenCalled();
 });
});
