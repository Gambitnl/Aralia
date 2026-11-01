/** Main-temple lore comes from the actual regional faith and living office.
 * Generic catalogs, nearby people and a priest title cannot supply mechanics. */
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TownLifeState} from '../../worldforge/roster/agentLife';
import type {TownPlan} from '../../worldforge/artifacts';
import {resolveWorldforgeTempleIdentity, templeDedicationReading} from '../worldforgeTemple';

// DEBT: These boundary fixtures deliberately omit and corrupt atlas fields.
// Keep that looseness inside tests; production joins validate the real source.
const f=vi.hoisted(()=>({atlas:null as any,plan:null as unknown as TownPlan,revisions:[] as unknown[]}));
vi.mock('../../worldforge/bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>f.atlas}));
vi.mock('../../worldforge/town/canonicalTown',()=>({canonicalArtifactTownForSiteFromAtlas:(_atlas:unknown,_seed:number,_site:unknown,revision?:unknown)=>(f.revisions.push(revision),{plan:f.plan})}));
const person=(id=141,name='Faelan Ironsmith')=>({occupantId:id,name,role:'priest',bornDay:-30000,homePlotId:54});
// The mocked plan is an explicit current-layout fixture, not legacy admission.
const life=(people=[person()])=>({layoutRevision:2,villagers:Object.fromEntries(people.map(p=>[p.occupantId,p]))}) as unknown as TownLifeState;
const resolve=(people=life(),day=5,plot=168,seed=77)=>resolveWorldforgeTempleIdentity(seed,675,plot,day,people);
beforeEach(()=>{
  f.revisions=[];
  const religion=new Uint16Array(4338);religion[4337]=9;
  f.atlas={pack:{burgs:[],cells:{religion},religions:[]}};
  f.atlas.pack.burgs[675]={i:675,name:'Menaikon',cell:4337};
  f.atlas.pack.religions[9]={i:9,name:'Elladan Pantheon',type:'Folk',form:'Polytheism',deity:'Nauclea, The Blue Eagle'};
  const plot=(id:number,role:string,x:number)=>({id,role,footprint:[[x,0],[x+10,0],[x+10,10],[x,10]]});
  f.plan={plots:[plot(168,'temple',0),plot(169,'temple',1000),plot(1,'house',0),plot(2,'house',0),plot(3,'house',0)]} as unknown as TownPlan;
});

describe('worldforge main temple identity',()=>{
  it('joins the real burg cell faith and the one living office without modifying sources or drawing RNG',()=>{
    const town=life(),before=JSON.stringify([f.atlas,f.plan,town]),random=vi.spyOn(Math,'random');
    const result=resolve(town)!;
    expect(result).toMatchObject({sourceId:'world:77:cell:4337:building:wf-plot-675-168',
      faith:{id:9,name:'Elladan Pantheon',deity:'Nauclea, The Blue Eagle'},clergy:{occupantId:141,name:'Faelan Ironsmith'}});
    expect(JSON.stringify([f.atlas,f.plan,town])).toBe(before);
    expect(random).not.toHaveBeenCalled();random.mockRestore();
  });
  it('does not attach the dominant faith to a secondary shrine or another plot',()=>{
    expect(resolve(life(),5,169)).toBeUndefined();expect(resolve(life(),5,1)).toBeUndefined();
  });
  it('rejects removed, mismatched and unregistered settlements',()=>{
    const burg=f.atlas.pack.burgs[675];burg.removed=true;expect(resolve()).toBeUndefined();
    burg.removed=false;burg.i=2;expect(resolve()).toBeUndefined();
    f.atlas.pack.burgs=[];expect(resolve()).toBeUndefined();
  });
  it('does not invent a faith for an unaffiliated cell or use a removed/inconsistent religion',()=>{
    f.atlas.pack.cells.religion[4337]=0;expect(resolve()).toBeUndefined();
    f.atlas.pack.cells.religion[4337]=9;f.atlas.pack.religions[9].removed=true;expect(resolve()).toBeUndefined();
    f.atlas.pack.religions[9].removed=false;f.atlas.pack.religions[9].i=10;expect(resolve()).toBeUndefined();
  });
  it('keeps a non-theistic tradition without substituting a catalog god',()=>{
    f.atlas.pack.religions[9].deity=null;
    const identity=resolve()!,reading=templeDedicationReading(identity,'0351-01-05T23:56:00Z')!;
    expect(identity.faith.deity).toBeNull();expect(reading.entry.content).not.toContain('associated deity');
    expect(reading.entry.content).not.toMatch(/Pelor|Bahamut|Moradin|blessing|healing/i);
  });
  it('does not pick a dead, future or disputed office holder',()=>{
    const dead={...person(),diedDay:5};expect(resolve(life([dead]))?.clergy).toBeUndefined();
    const unborn={...person(),bornDay:6};expect(resolve(life([unborn]))?.clergy).toBeUndefined();
    expect(resolve(life([person(),person(142,'Nia')]))?.clergy).toBeUndefined();
  });
  it('uses the actual successor while retaining the old dead person in history',()=>{
    const old={...person(),diedDay:5},town=life([old,person(142,'Nia')]);
    expect(resolve(town)?.clergy).toEqual({occupantId:142,name:'Nia'});
    expect(town.villagers[141]).toBe(old);
  });
  it('does not publish an ambiguous plot identity or invalid clock',()=>{
    f.plan.plots.push({...f.plan.plots[0]});expect(resolve()).toBeUndefined();
    expect(resolve(life(),NaN)).toBeUndefined();
  });
  it('allows dedication facts when the clergy directory is missing',()=>{
    const identity=resolve({layoutRevision:2,villagers:{}})!;
    expect(identity.faith.name).toBe('Elladan Pantheon');expect(identity.clergy).toBeUndefined();
    expect(templeDedicationReading(identity,'0351-01-05T23:56:00Z')!.entry.content).not.toContain('priest');
  });
});

describe('dated temple reading',()=>{
  it('scopes a stable reading to world, temple, faith and clergy, excluding the later read time',()=>{
    const identity=resolve()!,a=templeDedicationReading(identity,'0351-01-05T23:56:00Z')!,b=templeDedicationReading(identity,'0351-01-06T08:00:00Z')!;
    expect(a.entry.id).toBe(b.entry.id);expect(a.entry.gameTime).not.toBe(b.entry.gameTime);
    expect(templeDedicationReading(resolve(life(),5,168,78)!,'0351-01-05T23:56:00Z')!.entry.id).not.toBe(a.entry.id);
    expect(templeDedicationReading({...identity,clergy:{occupantId:142,name:'Nia'}},'0351-01-06T08:00:00Z')!.entry.id).not.toBe(a.entry.id);
  });
  it('records only the read dedication and listed office, without meetings or mechanical promises',()=>{
    const reading=templeDedicationReading(resolve()!,'0351-01-05T23:56:00Z')!;
    expect(reading.entry).toMatchObject({type:'Lore Uncovered',isQuestRelated:false,associatedLocationId:'cell_4337',source:{type:'LOCATION'}});
    expect(reading.entry.content).toContain('Nauclea, The Blue Eagle');
    expect(reading.entry.content).toContain('lists Faelan Ironsmith as its priest');
    expect(reading.entry.content).not.toMatch(/met |present|on duty|spell|price|skill|join|quest|favors/i);
    expect(templeDedicationReading(resolve()!,'invalid')).toBeUndefined();
  });
});

describe('temple layout source selection',()=>{
 it('reads the selected earlier temple without changing life or faith records',()=>{
  const town={...life(),layoutRevision:1 as const},before=JSON.stringify([town,f.atlas,f.plan]);
  expect(resolve(town)?.faith.name).toBe('Elladan Pantheon');expect(f.revisions).toEqual([1]);
  expect(JSON.stringify([town,f.atlas,f.plan])).toBe(before);
 });
 it('does not identify a replacement temple for an existing unversioned town',()=>{
  const town=life();delete town.layoutRevision;const before=JSON.stringify(town);
  expect(resolve(town)).toBeUndefined();expect(f.revisions).toEqual([]);expect(JSON.stringify(town)).toBe(before);
 });
});
