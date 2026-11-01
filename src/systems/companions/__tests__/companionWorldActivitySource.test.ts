import {describe,it,expect,vi} from 'vitest';
import {companionActivitiesForNewWorld,companionStartingLeadsForNewWorld} from '../companionWorldActivitySource';

vi.mock('@/systems/worldforge/bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>({pack:{
 burgs:[{i:0},{i:1,cell:10,name:'Morningford',population:20},{i:2,cell:20,name:'Crossing',population:30}],
 cells:{h:Object.assign([],{10:30,20:40})},
}})}));
vi.mock('@/systems/worldforge/dungeon/world/dungeonSites',()=>({enumerateDungeonSites:(worldSeed:number)=>[{
 sitePath:'goal:morning',authoredGoal:{worldSeed,companionId:'elara_vance',goalId:'restore_temple',nearbyBurgId:1},
}]}));

describe('public companion plans in the new-game town chooser',()=>{
 it('previews exactly the normal initializer locations and public purposes without changing those plans',()=>{
  const activities=companionActivitiesForNewWorld(123),before=JSON.stringify(activities);
  const leads=companionStartingLeadsForNewWorld(123);
  expect(leads).toHaveLength(2);
  for(const lead of leads){
   const actual=activities.find(a=>a.companionId===lead.companionId)!;
   expect(lead).toMatchObject({burgId:actual.burgId,cellId:actual.cellId,summary:actual.summary});
   expect(lead.name).not.toBe('');
   expect(lead).not.toHaveProperty('goals');expect(lead).not.toHaveProperty('whereabouts');
  }
  expect(leads.find(l=>l.companionId==='elara_vance')).toMatchObject({name:'Elara Vance',burgId:1,cellId:10});
  expect(JSON.stringify(activities)).toBe(before);
  expect(companionStartingLeadsForNewWorld(123)).toEqual(leads);
 });
});
