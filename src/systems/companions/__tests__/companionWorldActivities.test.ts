/** Public presence is world-authored, never a player-following encounter. These
 * fixtures prove contracts; an actual walk and reload remain separate evidence. */
import {describe,it,expect} from 'vitest';
import {createMockGameState,createMockPlayerCharacter} from '@/utils/core/factories';
import {COMPANIONS} from '@/data/companions';
import {authoredCompanionToRichNpc} from '@/systems/party/authoredCompanionToRichNpc';
import {planCompanionWorldActivities,companionActivityRumors,companionActivityContactError,companionActivityMeetingLine} from '../companionWorldActivities';
import {placeCompanionCast,retainCompanionWhereabouts} from '../companionWhereabouts';
import {TavernGossipSystem} from '@/systems/intrigue/TavernGossipSystem';
import {ItemType} from '@/types';
import {resolveCompanionActivityPlacements,selectInitialPublicTownEntry} from '@/components/World3D/initialTownEntry';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {metersToHeight} from '@/systems/world3d/config';
const ground=()=>({cols:65,rows:65,extentMetersX:97.536,extentMetersZ:97.536,heights:Array(65*65).fill(metersToHeight(5)),biomeIds:Array(65*65).fill('plains'),features:[],props:[],hostiles:[],hiddenSites:[],dungeonEntrances:[],gatehouses:[],
 towns:[{burgId:93,xM:45,zM:40,halfM:25}],rosters:[],occupants:[],roads:[{sourceKind:'town-street',points:[{x:10,z:40},{x:80,z:40}],widthM:8}],plazas:[],buildings:[],decks:[],walls:[],rivers:[],waterBodies:[]} as unknown as GroundWorld);
const towns=[{i:4,cell:2603,name:'Phu',population:12},{i:93,cell:4413,name:'Kytion',population:20}];
const source={worldSeed:77,companionId:'elara_vance',goalId:'restore_temple',nearbyBurgId:93,sitePath:'world:77/temple'};
const plans=()=>planCompanionWorldActivities(77,towns,source);
function local(){
 const companion=structuredClone(COMPANIONS.elara_vance),activity=plans()[0];
 companion.publicActivity=activity;
 companion.whereabouts={worldSeed:77,locationId:activity.locationId,source:'world-activity',observedAt:0,position:{xM:40,yM:5,zM:50}};
 return createMockGameState({worldSeed:77,currentLocationId:activity.locationId,party:[createMockPlayerCharacter({id:'traveler'})],metNpcIds:[],
  gameTime:new Date(10000),companions:{elara_vance:companion},generatedNpcs:{elara_vance:authoredCompanionToRichNpc(companion)},
  currentLocationActiveDynamicNpcIds:['elara_vance'],playerGroundPos:{tileX:4413,tileY:0,xM:10,yM:5,zM:50},factions:{}});
}
describe('independent public companion activities',()=>{
 it('changes the work account after a real handover or accepted journey without changing the source person',()=>{
  const s=local(),c=s.companions.elara_vance;
  c.questline={id:'preparations',title:'Road Preparations',currentStageId:'supplied',stages:{},origin:{worldSeed:77,locationId:s.currentLocationId}};
  expect(companionActivityMeetingLine(c,77)).toContain('provisions you brought');
  expect(companionActivityMeetingLine(c,77)).not.toContain('getting my provisions');
  c.travelAgreement={worldSeed:77,sourceId:'temple',goalId:'restore_temple',sitePath:'world:77/temple',destinationName:'Temple of the Morning',offeredAt:1,response:'accepted',terms:[]};
  const before=structuredClone(c);expect(companionActivityMeetingLine(c,77)).toContain('decide deeper risks together');expect(c).toEqual(before);
 });
 it('uses real separate source towns and stable full-seed plans without mutating geography',()=>{
  const before=structuredClone(towns),first=plans();
  expect(first).toEqual(planCompanionWorldActivities(77,[...towns].reverse(),source));
  expect(first.map(p=>[p.companionId,p.burgId,p.locationId])).toEqual([['elara_vance',93,'cell_4413'],['kaelen_thorne',4,'cell_2603']]);
  expect(towns).toEqual(before);
  expect(planCompanionWorldActivities(77+2**32,towns,{...source,worldSeed:77+2**32})[0].sourceId).not.toBe(first[0].sourceId);
 });
 it('does not invent an Elara destination when the public site or town is unavailable',()=>{
  expect(planCompanionWorldActivities(77,towns,undefined).map(p=>p.companionId)).toEqual(['kaelen_thorne']);
  expect(planCompanionWorldActivities(77,[],source)).toEqual([]);
  expect(JSON.stringify(plans())).not.toMatch(/sister|debt|employer|contract|secret/i);
 });
 it('requires real nearby feet before contact, while preserving legacy and party routes',()=>{
  const s=local();expect(companionActivityContactError(s,'elara_vance')).toContain('Approach');
  expect(companionActivityContactError(s,'elara_vance',{xM:42,yM:5,zM:50})).toBeNull();
  expect(companionActivityContactError({...s,currentLocationId:'elsewhere'},'elara_vance',{xM:40,yM:5,zM:50})).toContain('Approach');
  s.companions.elara_vance.inParty=true;expect(companionActivityContactError(s,'elara_vance')).toBeNull();
  delete s.companions.elara_vance.publicActivity;expect(companionActivityContactError(s,'elara_vance')).toBeNull();
 });
 it('offers only local unvisited physically placed work through an existing durable receipt',()=>{
  const s=local(),rumor=companionActivityRumors(s,1)[0];expect(rumor.text).toContain('Kytion');
  const offer=TavernGossipSystem.getAvailableRumors(s).find(r=>r.title==='Ask about a local adventurer')!;
  expect(offer).toMatchObject({cost:2,type:'rumor',payload:{id:rumor.id}});
  s.inventory.push({id:'receipt',name:'Heard local work',type:ItemType.Service,sourceId:offer.id} as typeof s.inventory[number]);
  expect(TavernGossipSystem.getAvailableRumors(s).some(r=>r.id===offer.id)).toBe(false);
  expect(companionActivityRumors({...s,currentLocationId:'remote'},1)).toEqual([]);
  expect(companionActivityRumors({...s,metNpcIds:['elara_vance']},1)).toEqual([]);
  delete s.companions.elara_vance.whereabouts!.position;expect(companionActivityRumors(s,1)).toEqual([]);
 });
 it('never substitutes the player cluster when independent physical placement fails',()=>{
  const s=local();delete s.companions.elara_vance.whereabouts!.position;
  const cast=[{id:'elara_vance',name:'Elara'}];
  expect(placeCompanionCast(s,cast,[100,0,200],5)).toEqual({cast:[],checkpoints:[]});
  const placed=placeCompanionCast(s,cast,[100,0,200],5,{elara_vance:{xM:40,yM:5,zM:50}});
  expect(placed.cast[0].position).toEqual([-60,5,-150]);
  expect(placed.checkpoints[0].position).toEqual({xM:40,yM:5,zM:50});
 });
 it('an obsolete encounter list cannot relocate an anchored person',()=>{
  const s=local();expect(retainCompanionWhereabouts({...s,currentLocationId:'remote'})).toBe(s.companions);
 });
 it('chooses from the source town independently of player feet and keeps that occupied space clear',()=>{
  const s=local(),g=ground();delete s.companions.elara_vance.whereabouts!.position;
  const first=resolveCompanionActivityPlacements(g,s);
  expect(first.unavailable).toEqual([]);expect(first.positions.elara_vance).toMatchObject({xM:45,zM:40});
  s.playerGroundPos={tileX:4413,tileY:0,xM:70,yM:5,zM:70};
  expect(resolveCompanionActivityPlacements(g,s)).toEqual(first);
  const entry=selectInitialPublicTownEntry(g,{x:45,z:40},[{id:'traveler',offset:{x:0,z:0},body:{heightM:2,halfWidthM:.5,mouthHeightM:1.6}}],first.occupied)!;
  expect(Math.hypot(entry.x-45,entry.z-40)).toBeGreaterThan(first.occupied[0].radius+.5);
 });
 it('keeps old feet exact and refuses a new activity without its actual source town',()=>{
  const s=local(),g=ground();expect(resolveCompanionActivityPlacements(g,s).positions.elara_vance).toEqual({xM:40,yM:5,zM:50});
  delete s.companions.elara_vance.whereabouts!.position;g.towns=[];
  expect(resolveCompanionActivityPlacements(g,s)).toEqual({positions:{},occupied:[],unavailable:['elara_vance']});
 });
});
