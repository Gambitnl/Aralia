import {act,renderHook} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {useGameInitialization} from '../useGameInitialization';
import * as saves from '@/services/saveLoadService';
import {createMockGameState} from '@/utils/core/factories';

afterEach(()=>vi.restoreAllMocks());
describe('load refusal remains visible at the title screen',()=>{
 it('preserves the exact refusal in the existing persistent error banner without loading a substitute',async()=>{
  const message='This saved town could not be loaded safely. Your saved game has not been changed.';
  vi.spyOn(saves,'loadGame').mockResolvedValue({success:false,message});
  const dispatch=vi.fn(),addMessage=vi.fn();
  const {result}=renderHook(()=>useGameInitialization({dispatch,addMessage,worldSeed:77}));
  await act(()=>result.current.handleLoadGameFlow('aralia_rpg_default_save'));
  expect(dispatch).toHaveBeenCalledWith({type:'SET_ERROR',payload:message});
  const phase=dispatch.mock.calls.findIndex(([a])=>a.type==='SET_GAME_PHASE');
  const error=dispatch.mock.calls.findIndex(([a])=>a.type==='SET_ERROR'&&a.payload===message);
  expect(error).toBeGreaterThan(phase);
  expect(dispatch.mock.calls.some(([a])=>a.type==='LOAD_GAME_SUCCESS')).toBe(false);
  expect(saves.loadGame).toHaveBeenCalledExactlyOnceWith('aralia_rpg_default_save');
 });
 it('clears an earlier error when a new load starts and preserves the exact successful payload',async()=>{
  const state=createMockGameState();vi.spyOn(saves,'loadGame').mockResolvedValue({success:true,data:state,message:'Loaded'});
  const dispatch=vi.fn(),{result}=renderHook(()=>useGameInitialization({dispatch,addMessage:vi.fn(),worldSeed:77}));
  await act(()=>result.current.handleLoadGameFlow('current-slot'));
  expect(dispatch.mock.calls[0][0]).toEqual({type:'SET_ERROR',payload:null});
  expect(dispatch).toHaveBeenCalledWith({type:'LOAD_GAME_SUCCESS',payload:state});
 });
});
