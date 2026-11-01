import {describe,it,expect,vi} from 'vitest';
import type {GameState} from '@/types/state';
import {learnedCompanionDestinations} from '../companionGoalDestinations';

vi.mock('@/systems/worldforge/dungeon/world/dungeonSites',()=>({enumerateDungeonSites:()=>[
  {sitePath:'wf:7/cell:3/dungeon:temple',cellId:3,posFt:{x:999,y:888},authoredGoal:{worldSeed:7,sourceId:'temple-v1',companionId:'elara',goalId:'restore'}}
]}));
function fixture(){return {worldSeed:7,metNpcIds:['elara'],companions:{elara:{id:'elara',identity:{name:'Elara'},goals:[{id:'restore',isSecret:false,status:'active',disclosedDestination:{worldSeed:7,sourceId:'temple-v1',sitePath:'wf:7/cell:3/dungeon:temple',cellId:3,name:'Morning Temple',nearbyBurgName:'Sedanes'}}]}}} as unknown as GameState;}
describe('retained companion directions',()=>{
 it('works away from conversation and returns only the learned general area',()=>{
  const state=fixture(),before=structuredClone(state);
  expect(learnedCompanionDestinations(state)).toEqual([{companionId:'elara',companionName:'Elara',goalId:'restore',cellId:3,name:'Morning Temple',nearbyBurgName:'Sedanes'}]);
  expect(state).toEqual(before);
 });
 it('retains useful knowledge after completing the goal',()=>{
  const state=fixture();state.companions.elara.goals[0].status='completed';
  expect(learnedCompanionDestinations(state)).toHaveLength(1);
 });
 it('does not expose secrets or people never met',()=>{
  const state=fixture();state.companions.elara.goals[0].isSecret=true;
  expect(learnedCompanionDestinations(state)).toEqual([]);
  state.companions.elara.goals[0].isSecret=false;state.metNpcIds=[];
  expect(learnedCompanionDestinations(state)).toEqual([]);
 });
 it.each(['worldSeed','sourceId','sitePath','cellId'] as const)('hides stale %s without rewriting saved directions',key=>{
  const state=fixture(),direction=state.companions.elara.goals[0].disclosedDestination!;
  Object.assign(direction,{[key]:typeof direction[key]==='number'?999:'changed'});
  const before=structuredClone(state);
  expect(learnedCompanionDestinations(state)).toEqual([]);expect(state).toEqual(before);
 });
 it('handles no active world',()=>expect(learnedCompanionDestinations(undefined)).toEqual([]));
});
