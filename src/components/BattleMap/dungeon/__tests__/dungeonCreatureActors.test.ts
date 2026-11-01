import {afterEach,describe,expect,it} from 'vitest';
import {generateDungeon} from '../../../../systems/worldforge/dungeon/generateDungeon';
import {canonicalDungeonId} from '../../../../systems/worldforge/dungeon/world/dungeonIdentity';
import {dungeonEncounterEventId} from '../../../../systems/worldforge/dungeon/world/dungeonGameplay';
import {INGESTED_MONSTERS} from '../../../../data/monsters.generated';
import {recipeFromCombatant} from '../../../../systems/entities3d/recipeFromCombatant';
import {usesProceduralWater} from '../../../../systems/entities3d/creatureAppearance';
import type {CombatCharacter} from '../../../../types/combat';
import {generateEntityBlueprint} from '../../../../systems/entities3d/generateEntityBlueprint';
import {validateCreaturePlan} from '../../../../systems/entities3d/textPlan/planSchema';
import {registerAllParts} from '../../../../systems/entities3d/parts';
import {__setEntriesForTests,recipeForAccepted} from '../../../../systems/entities3d/library/acceptedEntities';
import {dungeonCreatureRecipe,usesProceduralDungeonWater,visibleDungeonCreatures} from '../dungeonCreatureActors';

const seedPath='wf:42/cell:751/dungeon:m28';
const identity={seedPath,dungeonId:canonicalDungeonId(seedPath)};
const source=generateDungeon({seed:42,seedPath,params:{theme:'sewer'}});
// Authored visibility fixture only. No creature is added to the actual campaign.
const plan={...source,spawns:[{x:10,y:15,roomId:1,monsterKey:'water_weird',cr:'3',xp:700}]};
registerAllParts();
afterEach(()=>__setEntriesForTests(null));

describe('source-bound creature presentation',()=>{
  it('does not reveal a creature from remembered or absent visibility',()=>{
    expect(visibleDungeonCreatures(plan,identity,[],[])).toEqual([]);
    expect(visibleDungeonCreatures(plan,identity,['1,3'],[])).toEqual([]);
  });
  it('keeps source identity and exact source cell, without mutating the plan',()=>{
    const before=structuredClone(plan);
    const actors=visibleDungeonCreatures(plan,identity,['2,3'],[]);
    expect(actors).toEqual([{eventId:dungeonEncounterEventId(identity,1,{x:2,y:3}),monsterKey:'water_weird',
      position:{x:2-plan.W/2+0.5,z:3-plan.H/2+0.5}}]);
    // Compare the same clone representation: jsdom's structuredClone owns
    // typed arrays in another realm, while the source plan stays untouched.
    expect(structuredClone(plan)).toEqual(before);
    expect(visibleDungeonCreatures(plan,identity,['2,3'],[actors[0].eventId])).toEqual([]);
  });
  it('builds an aquatic body rather than replacing the default earth elemental',()=>{
    const monster=INGESTED_MONSTERS.water_weird,before=structuredClone(monster);
    const recipe=dungeonCreatureRecipe(monster,'same-source-event');
    expect(recipe?.kind).toBe('planned');
    if(!recipe||recipe.kind!=='planned')throw Error('Expected explicit aquatic plan');
    expect(validateCreaturePlan(recipe.plan,new Set())).toEqual([]);
    expect(recipe.plan.surface).toBeUndefined();
    expect(recipe.plan.palette.opacity).toBeLessThan(1);
    expect(recipe.plan.appendages.some(part=>part.kind==='leg')).toBe(false);
    const water=generateEntityBlueprint(recipe);
    expect(water.planSpec?.surface).not.toBe('rock');
    expect(generateEntityBlueprint(recipe)).toEqual(water);
    expect(monster).toEqual(before);
    const earth=generateEntityBlueprint({kind:'creature',creatureType:'Elemental',size:'Large',seed:'same-source-event'});
    expect(earth.planSpec?.surface).toBe('rock');
  });
  it('does not invent a creature family when source metadata is absent',()=>{
    const source=INGESTED_MONSTERS.water_weird;
    expect(dungeonCreatureRecipe({...source,baseStats:{...source.baseStats,creatureTypes:[]}},'missing-family')).toBeNull();
  });
  it('preserves approved-library priority instead of imposing a procedural body',()=>{
    const monster=INGESTED_MONSTERS.water_weird;
    const procedural=dungeonCreatureRecipe(monster,'source-event');
    if(!procedural||procedural.kind!=='planned')throw Error('Expected water fixture');
    // Unit-only library fixture. No runtime entry is promoted or approved here.
    const approved={id:'approved-test-fixture',name:monster.name,
      plan:{...procedural.plan,name:'Approved test appearance'}};
    __setEntriesForTests([approved]);
    expect(dungeonCreatureRecipe(monster,'source-event')).toEqual(recipeForAccepted(approved));
    expect(usesProceduralDungeonWater(monster)).toBe(false);
  });
});

describe('exploration and combat appearance continuity',()=>{
  it('keeps the Water Weird body plan identical across the encounter boundary',()=>{
    const monster=INGESTED_MONSTERS.water_weird;
    const combat={id:'actual-source-event',name:monster.name,creatureTypes:monster.baseStats.creatureTypes,
      stats:{size:monster.baseStats.size}} as CombatCharacter;
    const before=structuredClone(combat);
    const battle=recipeFromCombatant(combat);
    const exploration=dungeonCreatureRecipe(monster,'combat:actual-source-event');
    expect(battle).toEqual(exploration);
    expect(generateEntityBlueprint(battle)).toEqual(generateEntityBlueprint(exploration!));
    expect(combat).toEqual(before);
    expect(usesProceduralWater(monster.name,'Elemental')).toBe(true);
  });
  it('does not impose an aquatic body on a named humanoid or another elemental',()=>{
    expect(usesProceduralWater('Water Weird','Humanoid')).toBe(false);
    expect(usesProceduralWater('Earth Elemental','Elemental')).toBe(false);
    const human=recipeFromCombatant({id:'person',name:'Water Weird',creatureTypes:['Humanoid'],
      class:{id:'wizard'},stats:{size:'Medium'}} as CombatCharacter);
    expect(human.kind).toBe('humanoid');
    const earth=recipeFromCombatant({id:'earth',name:'Earth Elemental',creatureTypes:['Elemental'],
      stats:{size:'Large'}} as CombatCharacter);
    expect(earth.kind).toBe('creature');
    expect(generateEntityBlueprint(earth).planSpec?.surface).toBe('rock');
  });
});
