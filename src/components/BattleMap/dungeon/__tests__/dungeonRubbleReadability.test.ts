/** Rubble should read as broken stone while retaining its exact source cell,
 * dungeon layout and encounter identities. Rendered gameplay checks its appearance. */
import {describe,it,expect} from 'vitest';
import {generateDungeon} from '../../../../systems/worldforge/dungeon/generateDungeon';
import {buildDungeonSceneModel,decomposeProp,DUNGEON_3D_PALETTES} from '../dungeonSceneModel';

describe('source rubble readability',()=>{
 it.each(['crypt','sewer','cavern','frost'] as const)('uses angular fragments and broken block proportions in %s',theme=>{
  const parts=decomposeProp('rubble',0,0,0,1,false,DUNGEON_3D_PALETTES[theme],false);
  expect(parts.filter(p=>p.shape==='octahedron').length).toBeGreaterThanOrEqual(3);
  expect(parts.some(p=>p.shape==='box'&&Math.max(p.instance.sx/p.instance.sz,p.instance.sz/p.instance.sx)>=1.7)).toBe(true);
  expect(new Set(parts.map(p=>p.instance.color)).size).toBeGreaterThan(1);
 });
 it('keeps every fragment inside the source-scaled envelope under rotation',()=>{
  for(const scale of [.65,1,1.5]){
   const parts=decomposeProp('rubble',7,-3,Math.PI/3,scale,true,DUNGEON_3D_PALETTES.sewer,false);
   for(const {instance:p} of parts){
    const radius=Math.hypot(p.x-7,p.z+3)+Math.hypot(p.sx,p.sz)/2;
    expect(radius).toBeLessThanOrEqual(.5*scale*1.15);
    expect(p.y-p.sy/2).toBeGreaterThanOrEqual(-1e-10);
   }
  }
 });
 it('changes only prop presentation, leaving the source plan, floor, doors and encounters intact',()=>{
  const plan=generateDungeon({seed:42,params:{roomCount:12,theme:'sewer'}});
  const room=plan.rooms.find(r=>r.id===plan.entranceId)!;
  const source={...plan,props:[{kind:'rubble',x:room.x,y:room.y,rot:0 as const,scale:1,roomId:room.id}]};
  const before=structuredClone(source),options={showRoomTypes:false,showDifficulty:false,showCritical:false};
  const bare=buildDungeonSceneModel({...source,props:[]},options),model=buildDungeonSceneModel(source,options);
  expect(structuredClone(source)).toEqual(before);
  for(const key of ['floors','walls','wallCaps','doors','spawns','spawnHalos'] as const)expect(model[key]).toEqual(bare[key]);
  expect(model.evidence).toHaveLength(1);
 });
});
