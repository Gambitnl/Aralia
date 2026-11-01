/** A reached pool must read as inset water, rather than a solid floor plate.
 * These geometry guards support desktop inspection and preserve the source plan. */
import {describe,it,expect} from 'vitest';
import {generateDungeon} from '../../../../systems/worldforge/dungeon/generateDungeon';
import {buildDungeonSceneModel,decomposeProp,DUNGEON_3D_PALETTES} from '../dungeonSceneModel';

describe('source pool readability',()=>{
  it.each(['crypt','sewer','cavern','frost'] as const)('keeps cool inset water below a distinct basin rim in %s',theme=>{
    const parts=decomposeProp('pool',0,0,0,1,false,DUNGEON_3D_PALETTES[theme],false).map(p=>p.instance);
    const water=parts.find(p=>p.sx>=.5&&p.sz>=.5&&p.sy<.03&&p.y>0);
    expect(water,'a shallow water surface rather than a second solid slab').toBeDefined();
    if(!water) return;
    const color=water.color.replace('#',''),r=parseInt(color.slice(0,2),16),b=parseInt(color.slice(4,6),16);
    expect(b,'theme accent must not turn water into a green solid plate').toBeGreaterThan(r);
    const rim=parts.filter(p=>Math.abs(p.x)>.25||Math.abs(p.z)>.25);
    expect(rim.some(p=>p.sx>p.sz)).toBe(true);
    expect(rim.some(p=>p.sz>p.sx)).toBe(true);
    for(const p of rim) expect(p.y+p.sy/2).toBeGreaterThan(water.y+water.sy/2);
    for(const p of parts){
      expect(Math.abs(p.x)+p.sx/2).toBeLessThanOrEqual(.36+1e-10);
      expect(Math.abs(p.z)+p.sz/2).toBeLessThanOrEqual(.36+1e-10);
    }
  });
  it('preserves the source pool identity, authored transform and all gameplay geography',()=>{
    const plan=generateDungeon({seed:42,params:{roomCount:12,theme:'sewer'}});
    const room=plan.rooms.find(r=>r.id===plan.entranceId)!;
    const source={...plan,props:[{kind:'pool',x:room.x,y:room.y,rot:90 as const,scale:1.3,roomId:room.id}]};
    const before=structuredClone(source),options={showRoomTypes:false,showDifficulty:false,showCritical:false};
    const bare=buildDungeonSceneModel({...source,props:[]},options),model=buildDungeonSceneModel(source,options);
    expect(structuredClone(source)).toEqual(before);
    for(const key of ['floors','walls','wallCaps','doors','spawns','spawnHalos'] as const) expect(model[key]).toEqual(bare[key]);
    // A pool has no automatic history-evidence marker; presentation must not add one.
    expect(model.evidence).toEqual(bare.evidence);
  });
});
