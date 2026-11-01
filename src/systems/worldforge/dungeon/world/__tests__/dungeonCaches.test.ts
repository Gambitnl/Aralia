import {describe,expect,it} from 'vitest';
import {generateDungeon} from '../../generateDungeon';
import {CellKind,OverlayKind} from '../../types';
import {canonicalDungeonId} from '../dungeonIdentity';
import {dungeonCaches,dungeonCacheBlocker} from '../dungeonCaches';
import {dungeonEncounterEventId,dungeonSpawnCell} from '../dungeonGameplay';

const seedPath='wf:42/cell:751/dungeon:m28';
const identity={seedPath,dungeonId:canonicalDungeonId(seedPath)};
const plan=generateDungeon({seed:42,seedPath,params:{theme:'crypt'}});

describe('source treasure caches',()=>{
  it('pins the v1 cache stream independently of geometry and other loot draws',()=>{
    const fixture={...plan,history:[],props:[],rooms:plan.rooms.map(room=>({...room,type:room.id===17?'treasure' as const:'combat' as const}))};
    expect(dungeonCaches(fixture,identity)[0].contents).toEqual([{itemId:'gold_piece',quantity:6}]);
  });
  it('anchors each existing treasure room on real floor with stable contents and no source mutation',()=>{
    const before=structuredClone(plan);
    const caches=dungeonCaches(plan,identity);
    expect(caches.length).toBeGreaterThan(0);
    expect(caches).toHaveLength(plan.rooms.filter(room=>room.type==='treasure').length);
    for(const cache of caches){
      if(cache.existingPropIndex===undefined) expect(plan.grid[cache.cell.y*plan.W+cache.cell.x]).toBe(CellKind.Floor);
      else expect(cache.prop).toBe(plan.props[cache.existingPropIndex]);
      const room=plan.rooms.find(room=>room.id===cache.roomId)!;
      expect(cache.cell.x*plan.cellFt).toBeGreaterThanOrEqual(room.x);
      expect(cache.cell.x*plan.cellFt).toBeLessThan(room.x+room.w);
      expect(cache.cell.y*plan.cellFt).toBeGreaterThanOrEqual(room.y);
      expect(cache.cell.y*plan.cellFt).toBeLessThan(room.y+room.h);
      expect(cache.contents.every(item=>item.itemId==='gold_piece'&&item.quantity>=2&&item.quantity<=8)).toBe(true);
    }
    expect(dungeonCaches({...plan,rooms:[...plan.rooms].reverse()},identity)).toEqual(caches);
    expect(structuredClone(plan)).toEqual(before);
  });
  it('keeps a historically plundered room empty without rerolling its neighbors',()=>{
    const clean={...plan,history:plan.history.filter(event=>event.kind!=='plunder'),props:plan.props.filter(prop=>prop.kind!=='pried-vault')};
    const caches=dungeonCaches(clean,identity);
    const chosen=caches[0];
    expect(chosen.contents.length).toBeGreaterThan(0);
    const changed={...clean,history:[...clean.history,{id:999,kind:'plunder' as const,yearsAgo:100,roomIds:[chosen.roomId],summary:'Explicit test event'}]};
    const after=dungeonCaches(changed,identity);
    expect(after[0].contents).toEqual([]);
    expect(after[0].plundered).toBe(true);
    expect(after[0].cell).toEqual(chosen.cell);
    expect(after.slice(1)).toEqual(caches.slice(1));
  });
  it('requires the actual room occupant to be resolved and refuses unresolved traps or water',()=>{
    const cache=dungeonCaches(plan,identity)[0];
    // Explicit authored fixtures isolate admission; no live inhabitant, hazard, or outcome is added.
    const spawn={roomId:cache.roomId,x:cache.cell.x*5,y:cache.cell.y*5,cr:'1/4',xp:50,monsterKey:'goblin'};
    const clean={...plan,spawns:[spawn],traps:[],overlay:new Uint8Array(plan.overlay.length)};
    expect(dungeonCacheBlocker(clean,identity,cache,[])).toBe('occupant');
    const id=dungeonEncounterEventId(identity,spawn.roomId,dungeonSpawnCell(clean,spawn));
    expect(dungeonCacheBlocker(clean,identity,cache,[id])).toBeNull();
    expect(dungeonCacheBlocker({...clean,traps:[{roomId:cache.roomId,x:spawn.x,y:spawn.y,kind:'pit'}]},identity,cache,[id])).toBe('trap');
    const wet=new Uint8Array(clean.overlay);wet[cache.cell.y*plan.W+cache.cell.x]=OverlayKind.Water;
    expect(dungeonCacheBlocker({...clean,overlay:wet},identity,cache,[id])).toBe('water');
  });

  it('does not move a buried existing chest or crash on a wholly collapsed treasure room',()=>{
    const cache=dungeonCaches(plan,identity)[0];
    const room=plan.rooms.find(room=>room.id===cache.roomId)!;
    const grid=new Uint8Array(plan.grid);
    for(let y=0;y<plan.H;y++)for(let x=0;x<plan.W;x++)if(x*5>=room.x&&x*5<room.x+room.w&&y*5>=room.y&&y*5<room.y+room.h)grid[y*plan.W+x]=CellKind.Wall;
    const collapsed={...plan,grid};
    const buried=dungeonCaches(collapsed,identity).find(candidate=>candidate.id===cache.id)!;
    expect(dungeonCacheBlocker(collapsed,identity,buried,[])).toBe('buried');
    if(cache.existingPropIndex!==undefined)expect(buried.cell).toEqual(cache.cell);
    expect(plan.grid).not.toBe(grid);
  });
});
