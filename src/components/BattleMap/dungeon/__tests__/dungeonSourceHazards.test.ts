/** Source traps must reach the same renderer as furniture without moving the source
 * floor or exposing traps outside the player's observed geography. */
import {describe,it,expect} from 'vitest';
import {generateDungeon} from '../../../../systems/worldforge/dungeon/generateDungeon';
import {buildDungeonSceneModel} from '../dungeonSceneModel';
const source=generateDungeon({seed:42,params:{theme:'sewer',roomCount:12}});
const options={showRoomTypes:false,showDifficulty:false,showCritical:false};

describe('canonical floor hazards in the dungeon scene',()=>{
 it('renders the emitted trap records in feet without changing source geography or history',()=>{
  const plan={...source,traps:[{kind:'darts' as const,x:35,y:50,roomId:source.entranceId,eventRef:2}]};
  const before=structuredClone(plan),bare=buildDungeonSceneModel({...plan,traps:[]},options);
  const model=buildDungeonSceneModel(plan,options),hazards=model.lowProps.filter(p=>p.visualKind==='trap');
  expect(hazards).toHaveLength(1);
  expect(hazards[0]).toMatchObject({x:7+.5-plan.W/2,z:10+.5-plan.H/2,eventRef:2});
  expect(hazards[0].detail).toBeUndefined();
  for(const key of ['floors','walls','wallCaps','doors','spawns','spawnHalos','lines'] as const)expect(model[key]).toEqual(bare[key]);
  expect(structuredClone(plan)).toEqual(before);
 });
 it('allows gameplay to render only observed source trap indices and does not shift existing prop indices',()=>{
  const plan={...source,traps:[{kind:'pit' as const,x:35,y:50,roomId:source.entranceId},{kind:'snare' as const,x:40,y:50,roomId:source.entranceId}]};
  const hidden=buildDungeonSceneModel(plan,{...options,visibleTrapIndices:[]});
  const known=buildDungeonSceneModel(plan,{...options,visibleTrapIndices:[1]});
  expect(hidden.lowProps.filter(p=>p.visualKind==='trap')).toHaveLength(0);
  expect(known.lowProps.filter(p=>p.visualKind==='trap')).toHaveLength(1);
  expect(known.lowProps.filter(p=>p.visualKind!=='trap')).toEqual(hidden.lowProps);
  expect(known.tallProps).toEqual(hidden.tallProps);
 });
});
