/** Real storage/load boundary with the heavy preflight mocked. This proves
 * refusal never publishes or rewrites a slot and a qualified selection persists
 * only through ordinary saving. Native/rendered adoption remains separate. */
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {saveGame,loadGame} from '../saveLoadCore';
import {setIndexedDbAvailable} from '../saveLoadHelpers';
import {loadHistoricalTownSource} from '../loadHistoricalTownSource';
import {createMockGameState,createMockPlayerCharacter} from '../../../utils/core/factories';
import type {ObservedBuildingSource} from '../../../systems/worldforge/interior/buildingSource';
import {GamePhase} from '../../../types';

vi.mock('../loadHistoricalTownSource',()=>({loadHistoricalTownSource:vi.fn()}));
vi.mock('../saveStorageInit',()=>({waitForStorageInitialization:vi.fn().mockResolvedValue(undefined)}));
const key='aralia_rpg_default_save';
function fixture(){
 return createMockGameState({worldSeed:77,currentLocationId:'cell_9',party:[createMockPlayerCharacter({id:'hero'})],
  playerCell:{cellId:9,localeCoords:null},playerGroundPos:{tileX:9,tileY:0,xM:20,zM:30,yM:2},
  townSim:{8:{burgId:8,layoutRevision:undefined,villagers:{},chronicle:{burgId:8,events:[],nextEventId:1},
   lastSimDay:1,nextVillagerId:1,buildingSources:{1:{cellId:9} as ObservedBuildingSource}}}});
}
beforeEach(()=>{localStorage.clear();setIndexedDbAvailable(false);vi.mocked(loadHistoricalTownSource).mockReset();});
describe('saved-town preflight in ordinary loadGame',()=>{
 it('returns a useful refusal without publishing loaded data or changing the stored save',async()=>{
  expect((await saveGame(fixture())).success).toBe(true);const before=localStorage.getItem(key);
  vi.mocked(loadHistoricalTownSource).mockImplementation(async state=>({state,
   result:{status:'unresolved',message:'The original paid room cannot be qualified.'}}));
  const notify=vi.fn(),result=await loadGame(key,notify);
  expect(result).toMatchObject({success:false,message:'The original paid room cannot be qualified.'});
  expect(result).not.toHaveProperty('data');expect(localStorage.getItem(key)).toBe(before);
  expect(notify).toHaveBeenCalledWith({type:'warning',message:result.message});
 });
 it('selects the qualified revision in loaded data, then preserves it through an ordinary resave/reload',async()=>{
  await saveGame(fixture());const before=localStorage.getItem(key);
  vi.mocked(loadHistoricalTownSource).mockImplementation(async state=>({
   state:{...state,townSim:{...state.townSim,8:{...state.townSim[8],layoutRevision:1}}},
   result:{status:'qualified',burgId:8,revision:1,observations:1,founders:1,surfaceY:2}}));
  const result=await loadGame(key);expect(result.success).toBe(true);
  if(!result.success||!('data' in result)||!result.data)throw new Error('Expected loaded state');
  expect(result.data.townSim[8].layoutRevision).toBe(1);expect(result.data.playerGroundPos).toEqual(fixture().playerGroundPos);
  expect(localStorage.getItem(key)).toBe(before);
  await saveGame(result.data);const reloaded=await loadGame(key);
  expect(reloaded.success).toBe(true);if(!reloaded.success||!('data' in reloaded)||!reloaded.data)throw new Error('Expected reload');
  expect(reloaded.data.townSim[8].layoutRevision).toBe(1);
  expect(vi.mocked(loadHistoricalTownSource)).toHaveBeenCalledTimes(1);
 });
 it('reports a failed worker separately from corrupt save data and leaves storage intact',async()=>{
  await saveGame(fixture());const before=localStorage.getItem(key);
  vi.mocked(loadHistoricalTownSource).mockRejectedValue(new Error('worker unavailable'));
  const result=await loadGame(key);
  expect(result.success).toBe(false);expect(result.message).toContain('check could not finish');
  expect(result.message).not.toMatch(/corrupt/i);expect(localStorage.getItem(key)).toBe(before);
 });
 it('does not invoke a heavy source check for a known saved layout',async()=>{
  const state=fixture();state.townSim[8].layoutRevision=2;
  await saveGame(state);expect((await loadGame(key)).success).toBe(true);
  expect(vi.mocked(loadHistoricalTownSource)).not.toHaveBeenCalled();
 });
 it('preserves a finished campaign without requiring admission into a playable ground scene',async()=>{
  const state=fixture();state.phase=GamePhase.GAME_OVER;
  await saveGame(state);const result=await loadGame(key);
  expect(result.success).toBe(true);
  if(!result.success||!('data' in result)||!result.data)throw new Error('Expected terminal save');
  expect(result.data.phase).toBe(GamePhase.GAME_OVER);
  expect(vi.mocked(loadHistoricalTownSource)).not.toHaveBeenCalled();
 });
});
