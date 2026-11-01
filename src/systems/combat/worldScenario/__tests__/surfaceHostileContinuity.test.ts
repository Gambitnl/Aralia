import {describe,it,expect} from 'vitest';
import {generateWorldBattleSetup} from '../../../../hooks/useBattleMapGeneration';
import {surfaceFixture} from './surfaceHostileFixtures';
import { prepareSurfaceHostileEncounter, selectSurfaceHostileParticipants } from '../surfaceHostileEncounter';
import {surfaceCombatWorldPoint,projectSurfaceHostileOutcomes,reconcileSurfaceHostileOutcome,surfaceHostileCombatantId} from '../surfaceHostileContinuity';
import {createMockSpellSlots} from '../../../../utils/core/factories';

describe('surface source identity and deployment',()=>{
  it('consumes the actual source squares instead of a generic formation',()=>{
    const f=surfaceFixture();
    const setup=generateWorldBattleSetup(f.state.extractedBattleMap!,123,[f.playerActor,f.actor]);
    expect(setup.positionedCharacters.map(c=>c.position)).toEqual([{x:5,y:5},{x:7,y:5}]);
    expect(setup.positionedCharacters[1].id).toBe(f.actor.id);
  });
  it('keeps original meters exactly on entry and retains their sub-cell offset during moves',()=>{
    const f=surfaceFixture(),map=f.state.extractedBattleMap!;
    expect(surfaceCombatWorldPoint(map,f.actor.id,{x:7,y:5})).toEqual({xM:104.1,zM:201.2});
    const moved=surfaceCombatWorldPoint(map,f.actor.id,{x:8,y:6})!;
    expect(moved.xM).toBe(104.1+1.524);expect(moved.zM).toBe(201.2+1.524);
  });
  it('never merges equal local IDs from different source scopes',()=>{
    expect(surfaceHostileCombatantId(42,7,'window-a','h')).not.toBe(surfaceHostileCombatantId(42,7,'window-b','h'));
  });
  it('refuses blocked or overlapping source positions rather than finding an easier square',()=>{
    const f=surfaceFixture();f.args.map.tiles.get('7-5')!.blocksMovement=true;
    expect(prepareSurfaceHostileEncounter(f.args)).toMatchObject({status:'source-gap'});
    f.args.map.tiles.get('7-5')!.blocksMovement=false;f.args.hostile.xM=100.3;f.args.hostile.zM=200.7;
    expect(prepareSurfaceHostileEncounter(f.args)).toMatchObject({status:'source-gap'});
  });
  it('refuses a mismatched source roster in tactical setup',()=>{
    const f=surfaceFixture();
    expect(()=>generateWorldBattleSetup(f.state.extractedBattleMap!,123,[f.playerActor,{...f.actor,id:'someone-else'}])).toThrow(/source|roster/i);
  });
});


describe('source group participation',()=>{
  function pack(){
    const f=surfaceFixture();
    const sourceGroup={kind:'marker' as const,key:'fixture-marker',memberIds:['source-h','source-second']};
    const hostile={...f.args.hostile,sourceGroup};
    const second={...hostile,id:'source-second',xM:106,zM:204};
    return {...f,args:{...f.args,hostile,hostiles:[hostile,second],profiles:[{entityId:second.id,monster:f.args.profile}]},second};
  }
  it('includes the complete contacted marker pack at exact source positions',()=>{
    const f=pack(),p=prepareSurfaceHostileEncounter(f.args);
    expect(p.status).toBe('ready');if(p.status!=='ready')throw Error(p.detail);
    expect(p.payload.combatants).toHaveLength(2);
    expect(p.receipt.entities.map(e=>e.source.entityId)).toEqual(['source-h','source-second']);
    expect(p.receipt.entities[1].source.worldGroundMeters).toEqual({x:106,z:204});
  });
  it('refuses an incomplete pack instead of turning it into an easier encounter',()=>{
    const f=pack();expect(prepareSurfaceHostileEncounter({...f.args,hostiles:[f.args.hostile]})).toMatchObject({status:'source-gap'});
  });
  it('refuses the entire encounter if a required member is outside the tactical crop',()=>{
    const f=pack();f.second.xM=1000;
    expect(prepareSurfaceHostileEncounter(f.args)).toMatchObject({status:'source-gap'});
  });
  it('does not silently omit a simultaneous nearby source group',()=>{
    const f=pack();const other={...f.args.hostile,id:'other',xM:98,zM:203,sourceGroup:{kind:'zone' as const,key:'zone-independent',memberIds:['other']}};
    const p=prepareSurfaceHostileEncounter({...f.args,hostiles:[...f.args.hostiles,other],profiles:[...f.args.profiles,{entityId:'other',monster:f.args.profile}]});
    expect(p.status).toBe('ready');if(p.status!=='ready')throw Error(p.detail);
    expect(p.payload.combatants).toHaveLength(3);
  });

  it('keeps distant independent zone bodies out of a contacted pack',()=>{
    const f=pack();const distant={...f.args.hostile,id:'distant',xM:110,zM:207,sourceGroup:{kind:'zone' as const,key:'other-zone-body',memberIds:['distant']}};
    const p=prepareSurfaceHostileEncounter({...f.args,hostiles:[...f.args.hostiles,distant]});
    expect(p.status).toBe('ready');if(p.status==='ready')expect(p.payload.combatants).toHaveLength(2);
  });
  it('retains a saved member death and survivor damage without treating absence as a weaker pack',()=>{
    const f=pack(),p=prepareSurfaceHostileEncounter(f.args);
    if(p.status!=='ready')throw Error(p.detail);
    f.state.extractedBattleMap=p.payload.extractedBattleMap!;f.state.worldforgeEncounterReceipts=[p.receipt];
    const snapshots=p.payload.combatants!.map((actor,i)=>({id:actor.id,currentHP:i===0?0:6,position:actor.position,worldSource:actor.worldSource}));
    const result=reconcileSurfaceHostileOutcome(f.state,snapshots,[{...f.partySnapshot,position:{x:5,y:5}}],'flee',false);
    expect(result.status).toBe('ready');if(result.status!=='ready')throw Error('missing outcome');
    const receipts=JSON.parse(JSON.stringify(result.patch.worldforgeEncounterReceipts));
    const remaining=projectSurfaceHostileOutcomes(f.args.hostiles,receipts,42,7,f.args.sourceScope);
    expect(remaining.map(h=>h.id)).toEqual(['source-second']);
    const selected=selectSurfaceHostileParticipants({hostile:remaining[0],hostiles:remaining,player:{xM:104,zM:204},worldSeed:42,cellId:7,sourceScope:f.args.sourceScope,receipts});
    expect(selected).toMatchObject({status:'ready',hostiles:[{id:'source-second'}]});
    expect(selectSurfaceHostileParticipants({hostile:remaining[0],hostiles:remaining,player:{xM:104,zM:204},worldSeed:42,cellId:7,sourceScope:f.args.sourceScope,receipts:[]})).toMatchObject({status:'source-gap'});
  });
  it('refuses missing group provenance instead of guessing a one-creature encounter',()=>{
    const f=surfaceFixture();expect(prepareSurfaceHostileEncounter({...f.args,hostile:{...f.args.hostile,sourceGroup:undefined}})).toMatchObject({status:'source-gap'});
  });
});

describe('surface attrition and regeneration',()=>{
  it('does not attach a saved outcome to a newly changed source cohort',()=>{
    const f=surfaceFixture();
    const result=reconcileSurfaceHostileOutcome(f.state,[f.enemySnapshot],[f.partySnapshot],'flee',false);
    if(result.status!=='ready')throw Error('missing outcome');
    const changed={...f.args.hostile,sourceGroup:{...f.args.hostile.sourceGroup,key:'different-source'}};
    expect(()=>projectSurfaceHostileOutcomes([changed],result.patch.worldforgeEncounterReceipts!,42,7,f.args.sourceScope)).toThrow(/source/);
    expect(prepareSurfaceHostileEncounter({...f.args,hostile:changed,receipts:result.patch.worldforgeEncounterReceipts!})).toMatchObject({status:'source-gap'});
  });

  it('leaves the original actor list untouched when no outcome applies',()=>{
    const f=surfaceFixture(),hostiles=[f.args.hostile];
    expect(projectSurfaceHostileOutcomes(hostiles,[],42,7,f.args.sourceScope)).toBe(hostiles);
  });
  it('retains spent source-enemy slots across a retreat and re-entry without aliasing the live actor',()=>{
    const f=surfaceFixture();
    const slots=createMockSpellSlots({level_1:{current:0,max:2}});
    const result=reconcileSurfaceHostileOutcome(f.state,[{...f.enemySnapshot,spellSlots:slots}],[f.partySnapshot],'flee',false);
    if(result.status!=='ready')throw new Error('missing outcome');
    slots.level_1.current=2;
    const projected=projectSurfaceHostileOutcomes([f.args.hostile],result.patch.worldforgeEncounterReceipts!,42,7,f.args.sourceScope);
    const replay=prepareSurfaceHostileEncounter({...f.args,hostile:projected[0],receipts:result.patch.worldforgeEncounterReceipts!});
    expect(replay.status).toBe('ready');
    if(replay.status==='ready')expect(replay.payload.combatants![0].spellSlots?.level_1.current).toBe(0);
  });
  it('retains enemy damage and moved feet on retreat without moving other source creatures',()=>{
    const f=surfaceFixture();
    const result=reconcileSurfaceHostileOutcome(f.state,[f.enemySnapshot],[f.partySnapshot],'flee',false);
    expect(result.status).toBe('ready');if(result.status!=='ready')throw new Error('missing outcome');
    const hostiles=[f.args.hostile,{...f.args.hostile,id:'untouched',xM:109,zM:209}];
    const projected=projectSurfaceHostileOutcomes(hostiles,result.patch.worldforgeEncounterReceipts!,42,7,f.args.sourceScope);
    expect(projected[0]).toMatchObject({id:'source-h',xM:104.1+1.524,zM:201.2+1.524});
    expect(projected[1]).toBe(hostiles[1]);
    const replay=prepareSurfaceHostileEncounter({...f.args,hostile:projected[0],receipts:result.patch.worldforgeEncounterReceipts!});
    expect(replay.status).toBe('ready');if(replay.status==='ready')expect(replay.payload.combatants![0].currentHP).toBe(7);
  });
  it('does not resurrect a defeated source creature after a JSON save round trip',()=>{
    const f=surfaceFixture();
    const result=reconcileSurfaceHostileOutcome(f.state,[{...f.enemySnapshot,currentHP:0}],[f.partySnapshot],'victory',true);
    expect(result.status).toBe('ready');if(result.status!=='ready')throw new Error('missing outcome');
    const saved=JSON.parse(JSON.stringify(result.patch.worldforgeEncounterReceipts));
    expect(projectSurfaceHostileOutcomes([f.args.hostile],saved,42,7,f.args.sourceScope)).toEqual([]);
    expect(projectSurfaceHostileOutcomes([f.args.hostile],saved,43,7,f.args.sourceScope)).toEqual([f.args.hostile]);
    expect(projectSurfaceHostileOutcomes([f.args.hostile],saved,42,7,'different-local')).toEqual([f.args.hostile]);
  });
  it('refuses victory rewards while a source enemy remains alive',()=>{
    const f=surfaceFixture();expect(reconcileSurfaceHostileOutcome(f.state,[f.enemySnapshot],[f.partySnapshot],'victory',true)).toMatchObject({status:'source-gap'});
  });
  it('does not declare defeat while an original party member is conscious',()=>{
    const f=surfaceFixture();expect(reconcileSurfaceHostileOutcome(f.state,[f.enemySnapshot],[f.partySnapshot],'defeat',false)).toMatchObject({status:'source-gap'});
  });
  it('accepts the original party snapshots without promoting additional allied tokens into the party',()=>{
    const f=surfaceFixture();
    const result=reconcileSurfaceHostileOutcome(f.state,[f.enemySnapshot],[f.partySnapshot,{id:'summoned-ally',currentHP:5,position:{x:9,y:9}}],'flee',false);
    expect(result.status).toBe('ready');
    if(result.status==='ready')expect(Object.keys(result.patch.companions!)).toEqual(Object.keys(f.state.companions));
  });
  it('does not attach an anonymous final enemy to a nearby source creature',()=>{
    const f=surfaceFixture();expect(reconcileSurfaceHostileOutcome(f.state,[{...f.enemySnapshot,worldSource:undefined}],[f.partySnapshot],'flee',false)).toMatchObject({status:'source-gap'});
  });
});
