/** Personal replies must use the saved person's facts, never invented shared history. */
import {describe,it,expect} from 'vitest';
import {createMockGameState} from '../../utils/core/factories';
import {createEmptyMemory} from '../../utils/world/memoryUtils';
import {getAvailableTopics,processTopicSelection} from '../dialogueService';
import type {GameState,NPC,RichNPC} from '../../types';
const make=()=>{const npc={id:'sten',name:'Sten Ironwell',role:'merchant',occupation:'innkeeper',worldforgeHousehold:{memberId:'b93:head',burgId:675,signature:'source'},biography:{family:[{id:'fenna',name:'Fenna Ironwell',relation:'spouse',age:23,isAlive:true},{id:'fen',name:'Fen Ironwell',relation:'child',age:4,isAlive:true}]}} as unknown as RichNPC;const session={npcId:'sten',discussedTopicIds:[] as string[],contactStatus:'returning' as const};const state=createMockGameState({generatedNpcs:{sten:npc},activeDialogueSession:session,worldBusinesses:{shop:{id:'shop',ownerId:'sten',name:'The Shadowed Enchantments',businessType:'enchanter_shop',stock:[]}} as unknown as GameState['worldBusinesses'],npcMemory:{sten:{...createEmptyMemory(),knownFacts:[{id:'meeting',factKey:'player_met_npc',text:'Met Sana Ashford.',source:'direct',timestamp:12,strength:3,lifespan:999,isPublic:true}]}}});return{npc,session,state};};
describe('household personal facts',()=>{
 it('introduces the actual person and occupation, without inferring the legacy business type',()=>{const p=make();const r=processTopicSelection('global_who_are_you',p.state,p.session,0,p.npc);expect(r.directReply?.text).toContain('Sten Ironwell');expect(r.directReply?.text).toContain('innkeeper');expect(r.directReply?.text).toContain('The Shadowed Enchantments');expect(r.directReply?.text).not.toContain('enchanter');});
 it('offers family and contact questions alongside normal trade and open rumors',()=>{const p=make();const ids=getAvailableTopics(p.state,'sten',p.session,p.npc).map(t=>t.id);expect(ids).toEqual(expect.arrayContaining(['household_family','household_meeting','global_trade','global_rumors']));});
 it('names real relationships without inventing household history',()=>{const p=make();const r=processTopicSelection('household_family',p.state,p.session,0,p.npc);expect(r.directReply?.text).toContain('Fenna Ironwell');expect(r.directReply?.text).toContain('spouse');expect(r.directReply?.text).toContain('Fen Ironwell');expect(r.directReply?.text).toContain('child');expect(r.directReply?.text).not.toMatch(/childhood|hearth|works with me/);});
 it('remembers a direct meeting without claiming a song, date or place',()=>{const p=make();const text=processTopicSelection('household_meeting',p.state,p.session,0,p.npc).directReply?.text;expect(text).toBe("Yes, we've met before.");});
 it('keeps first contact first even after the met fact is recorded',()=>{const p=make();const firstSession={...p.session,contactStatus:'first-meeting' as const};expect(processTopicSelection('household_meeting',p.state,firstSession,0,p.npc).directReply?.text).toBe("We're meeting for the first time.");});
 it('does not make gossip into direct remembered contact',()=>{const p=make();p.state.npcMemory.sten.knownFacts![0].source='gossip';expect(processTopicSelection('household_meeting',p.state,p.session,0,p.npc).directReply?.text).toBe("I don't remember meeting you before.");});
 it('leaves authored or non-household identity on its existing reply path',()=>{const p=make();delete (p.npc as NPC & {worldforgeHousehold?:unknown}).worldforgeHousehold;expect(processTopicSelection('global_who_are_you',p.state,p.session,0,p.npc).directReply).toBeUndefined();expect(getAvailableTopics(p.state,'sten',p.session,p.npc).some(t=>t.id==='household_family')).toBe(false);});
 it('does not override an authored personal response or disclose guarded family',()=>{const p=make();p.npc.knowledgeProfile={baseOpenness:0,topicOverrides:{global_who_are_you:{known:true,customResponse:'An authored identity.'},household_family:{known:true,willingnessModifier:-10}}};expect(processTopicSelection('global_who_are_you',p.state,p.session,0,p.npc).directReply).toBeUndefined();expect(()=>processTopicSelection('household_family',p.state,p.session,0,p.npc)).toThrow();});
 it('rejects a stale different speaker before recording a topic',()=>{const p=make();p.session.npcId='other';expect(()=>processTopicSelection('household_family',p.state,p.session,0,p.npc)).toThrow();expect(p.session.discussedTopicIds).toEqual([]);});
 it('does not invent a family when the source is empty',()=>{const p=make();p.npc.biography.family=[];expect(getAvailableTopics(p.state,'sten',p.session,p.npc).some(t=>t.id==='household_family')).toBe(false);});
 it('distinguishes deceased relatives and does not invent circumstances',()=>{const p=make();p.npc.biography.family[0].isAlive=false;const text=processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text;expect(text).toContain('deceased');expect(text).not.toMatch(/battle|illness|killed/);});
 it('keeps unknown life status uncertain and omits a relative not born yet',()=>{const p=make();p.npc.biography.family[0].lifeStatus='unresolved';p.npc.biography.family[1].lifeStatus='not-born';const text=processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text;expect(text).toContain('unsure');expect(text).not.toContain('deceased');expect(text).not.toContain('Fen Ironwell');});
 it('does not borrow a remembered meeting from another person',()=>{const p=make();p.state.npcMemory={other:p.state.npcMemory.sten};expect(processTopicSelection('household_meeting',p.state,p.session,0,p.npc).directReply?.text).toBe("I don't remember meeting you before.");});
 it('changes no source, inventory, money or facts while resolving the answer',()=>{const p=make();const before=JSON.stringify(p.state);processTopicSelection('household_family',p.state,{...p.session,discussedTopicIds:[]},0,p.npc);expect(JSON.stringify(p.state)).toBe(before);});
});

/** Work talk follows the owner's actual trading day, never an occupation stereotype. */
import {getGameDay} from '../../utils/core';
const work=()=>{const p=make();p.state.worldBusinesses.shop.ownerType='npc';p.state.worldBusinesses.shop.businessType='tavern';p.state.worldBusinesses.shop.lastDailyReport={day:getGameDay(p.state.gameTime),revenue:11.56,costs:12,profit:-0.44,customersSatisfied:6,customersLost:0,supplyIssues:[],competitorActions:[],staffIssues:[]};return p;};
describe('resident work conversation',()=>{
 it('offers a work question only when an owned report supports it',()=>{const p=work();expect(getAvailableTopics(p.state,'sten',p.session,p.npc).some(t=>t.id==='household_work')).toBe(true);});
 it('describes the real shortfall without inventing a threat, debt or quest',()=>{const p=work();const r=processTopicSelection('household_work',p.state,p.session,0,p.npc);expect(r.directReply?.text).toContain('The Shadowed Enchantments');expect(r.directReply?.text).toContain("didn't cover costs");expect(r.directReply?.text).not.toMatch(/bandit|debt|starv|quest|enchanter|gold/);expect(r.unlocks).toEqual([]);expect(r.deductions).toBeUndefined();});
 it.each([[20,12,8,'covered costs'],[12,12,0,'just covered costs']])('reads a profit or break-even day from the figures', (revenue,costs,profit,phrase)=>{const p=work();Object.assign(p.state.worldBusinesses.shop.lastDailyReport,{revenue,costs,profit});expect(processTopicSelection('household_work',p.state,p.session,0,p.npc).directReply?.text).toContain(phrase);});
 it('mentions only concerns actually present in the report',()=>{const p=work();p.state.worldBusinesses.shop.lastDailyReport.supplyIssues=['Supply deliveries unreliable.'];const text=processTopicSelection('household_work',p.state,p.session,0,p.npc).directReply?.text;expect(text).toContain('deliveries');expect(text).not.toMatch(/staff|competitor/);});
 it('does not diagnose supply trouble from a low seeded metric alone',()=>{const p=work();p.state.worldBusinesses.shop.metrics={supplyChainHealth:0} as never;const text=processTopicSelection('household_work',p.state,p.session,0,p.npc).directReply?.text;expect(text).not.toContain('deliveries');});
 it.each(['stale','future','placeholder','inconsistent'])('keeps an unsupported %s report from becoming a current concern',(kind)=>{const p=work();const r=p.state.worldBusinesses.shop.lastDailyReport;if(kind==='stale')r.day-=4;if(kind==='future')r.day+=1;if(kind==='placeholder')Object.assign(r,{revenue:0,costs:0,profit:0});if(kind==='inconsistent')r.profit=100;expect(getAvailableTopics(p.state,'sten',p.session,p.npc).some(t=>t.id==='household_work')).toBe(false);expect(()=>processTopicSelection('household_work',p.state,p.session,0,p.npc)).toThrow();expect(p.session.discussedTopicIds).toEqual([]);});
 it('does not borrow a prior keeper or another business report',()=>{const p=work();p.state.worldBusinesses.shop.ownerId='other';expect(()=>processTopicSelection('household_work',p.state,p.session,0,p.npc)).toThrow();});
 it('refuses to choose between two unlinked businesses',()=>{const p=work();p.state.worldBusinesses.other={...p.state.worldBusinesses.shop,id:'other',name:'Other Shop'};expect(()=>processTopicSelection('household_work',p.state,p.session,0,p.npc)).toThrow();});
 it.each([['innkeeper','enchanter_shop'],['shopkeeper','tavern']])('does not turn a legacy %s trade mismatch into a work story',(occupation,businessType)=>{const p=work();p.npc.occupation=occupation;p.state.worldBusinesses.shop.businessType=businessType as never;expect(()=>processTopicSelection('household_work',p.state,p.session,0,p.npc)).toThrow();});
 it('does not disclose a guarded work subject',()=>{const p=work();p.npc.knowledgeProfile={baseOpenness:0,topicOverrides:{household_work:{known:true,willingnessModifier:-10}}};expect(()=>processTopicSelection('household_work',p.state,p.session,0,p.npc)).toThrow();});
 it('leaves reports, stock, money, quests and original facts untouched',()=>{const p=work();const before=JSON.stringify(p.state);processTopicSelection('household_work',p.state,{...p.session,discussedTopicIds:[]},0,p.npc);expect(JSON.stringify(p.state)).toBe(before);});
});


const liveFamily=()=>{
 const p=make(),day=getGameDay(p.state.gameTime);
 const person=(id:number,name:string)=>({occupantId:id,name,race:'Human',bornDay:day-40*365,parentIds:[] as number[],childIds:[] as number[],homePlotId:93,wealth:50,spouseId:undefined as number|undefined,diedDay:undefined as number|undefined});
 const self={...person(1,p.npc.name),spouseId:2,childIds:[3]};
 const spouse={...person(2,'Ysolde Ironwell'),spouseId:1 as number|undefined};
 const child={...person(3,'Lark Ironwell'),parentIds:[1,2],spouseId:4,homePlotId:14};
 const partner={...person(4,'Robin Marshdown'),spouseId:3 as number|undefined,homePlotId:14};
 p.state.townSim={675:{burgId:675,villagers:{1:self,2:spouse,3:child,4:partner},chronicle:{burgId:675,events:[],nextEventId:1},lastSimDay:day,nextVillagerId:5}};
 return {...p,self,spouse,child,partner,day};
};

describe('living family conversation',()=>{
 it('resolves the same current family from a serialized save without altering it',()=>{const p=liveFamily();const restored=JSON.parse(JSON.stringify(p.state));restored.gameTime=new Date(restored.gameTime);const before=JSON.stringify(restored);const text=processTopicSelection('household_family',restored,{...p.session,discussedTopicIds:[]},0,p.npc).directReply?.text;expect(text).toContain('married to Robin Marshdown');expect(JSON.stringify(restored)).toBe(before);});
 it('recognizes a reciprocal parent without inferring one from surname or home',()=>{const p=liveFamily();p.self.parentIds=[4];p.partner.childIds=[1];const text=processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text;expect(text).toContain('Robin Marshdown is my parent');});
 it('does not attach an ambiguous legacy name to the newer genealogy',()=>{const p=liveFamily();p.state.townSim[675].villagers[9]={...p.self,occupantId:9};expect(()=>processTopicSelection('household_family',p.state,p.session,0,p.npc)).toThrow();});
 it('withholds a relative whose numeric record identity conflicts',()=>{const p=liveFamily();p.child.occupantId=99;const text=processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text;expect(text).toContain('Ysolde Ironwell');expect(text).not.toMatch(/Lark|Robin/);});

 it('acknowledges recorded marriages and a child with a home elsewhere instead of repeating the founding family',()=>{
  const p=liveFamily(),before=JSON.stringify(p.state);
  const text=processTopicSelection('household_family',p.state,{...p.session,discussedTopicIds:[]},0,p.npc).directReply?.text;
  expect(text).toContain('Ysolde Ironwell is my spouse');
  expect(text).toContain('Lark Ironwell is my child');
  expect(text).toContain('married to Robin Marshdown');
  expect(text).toContain('home is elsewhere in town');
  expect(text).not.toContain('Fenna Ironwell');
  expect(JSON.stringify(p.state)).toBe(before);
 });
 it('keeps a deceased relative in remembered family without inventing how they died',()=>{const p=liveFamily();p.spouse.diedDay=p.day;const text=processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text;expect(text).toContain('Ysolde Ironwell is my spouse (deceased)');expect(text).not.toMatch(/illness|battle|murder/);});
 it('does not call a child married from a one-way stale spouse reference',()=>{const p=liveFamily();p.partner.spouseId=undefined;expect(processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text).not.toContain('Robin Marshdown');});
 it('does not infer relatives from a shared home',()=>{const p=liveFamily();p.child.parentIds=[];p.spouse.spouseId=undefined;const text=processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text;expect(text).not.toMatch(/Ysolde|Lark|Fenna|Fen Ironwell/);});
 it('withholds future relatives and keeps a missing partner unknown',()=>{const p=liveFamily();p.child.bornDay=p.day+1;delete p.state.townSim[675].villagers[4];expect(processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text).not.toMatch(/Lark|Robin/);});
 it('does not attach the saved family to a different projected person',()=>{const p=liveFamily();p.self.name='Someone Else';const text=processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text;expect(text).not.toMatch(/Ysolde|Lark|Robin/);});
 it('supports the exact stable household key after a recorded home move',()=>{const p=liveFamily();Object.assign(p.self,{householdMemberId:'b93:head',homePlotId:12});expect(processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text).toContain('Ysolde Ironwell');});
 it('never treats a relocated same-name legacy person as an exact match',()=>{const p=liveFamily();p.self.homePlotId=12;expect(processTopicSelection('household_family',p.state,p.session,0,p.npc).directReply?.text).not.toContain('Ysolde Ironwell');});
 it('retains explicit guarded family behavior even with a live genealogy',()=>{const p=liveFamily();p.npc.knowledgeProfile={baseOpenness:0,topicOverrides:{household_family:{known:true,willingnessModifier:-10}}};expect(()=>processTopicSelection('household_family',p.state,p.session,0,p.npc)).toThrow();});
});


describe('saved household institutional roles',()=>{
 it.each(['lord','priest','innkeeper','tavernkeeper','marketmaster','harbormaster'])('introduces the admitted current %s without replacing domestic work',role=>{
  const p=liveFamily(); Object.assign(p.self,{role}); const before=JSON.stringify(p.state);
  const text=processTopicSelection('global_who_are_you',p.state,{...p.session,discussedTopicIds:[]},0,p.npc).directReply?.text;
  expect(text).toContain("I serve as the town's "+role+'.'); expect(text).toContain('innkeeper');
  expect(text).not.toMatch(/blessing|spell|temple is|find me|reward|join/); expect(JSON.stringify(p.state)).toBe(before);
 });
 it('follows a saved office change and reload without borrowing the old chronicle title',()=>{
  const p=liveFamily(); Object.assign(p.self,{role:'priest'});
  expect(processTopicSelection('global_who_are_you',p.state,{...p.session,discussedTopicIds:[]},0,p.npc).directReply?.text).toContain("town's priest");
  Object.assign(p.self,{role:'marketmaster'}); const saved=JSON.parse(JSON.stringify(p.state)); saved.gameTime=new Date(saved.gameTime);
  const text=processTopicSelection('global_who_are_you',saved,p.session,0,p.npc).directReply?.text;
  expect(text).toContain("town's marketmaster"); expect(text).not.toContain("town's priest");
 });
 it.each(['wildcard','__proto__','made-up',undefined])('does not turn an internal or unknown role %s into a public office',role=>{
  const p=liveFamily(); Object.assign(p.self,{role});
  expect(processTopicSelection('global_who_are_you',p.state,{...p.session,discussedTopicIds:[]},0,p.npc).directReply?.text).not.toContain("I serve as");
 });
 it('does not attach an office to a different saved name or a same-ID person in another town',()=>{
  const p=liveFamily(); Object.assign(p.self,{role:'priest',name:'Someone Else'});
  expect(processTopicSelection('global_who_are_you',p.state,{...p.session,discussedTopicIds:[]},0,p.npc).directReply?.text).not.toContain("I serve as");
  p.self.name=p.npc.name; p.state.townSim[999]={...p.state.townSim[675],burgId:999}; delete p.state.townSim[675];
  expect(processTopicSelection('global_who_are_you',p.state,{...p.session,discussedTopicIds:[]},0,p.npc).directReply?.text).not.toContain("I serve as");
 });
});
