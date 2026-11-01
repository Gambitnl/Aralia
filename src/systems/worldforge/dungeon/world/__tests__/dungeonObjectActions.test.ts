import {describe,expect,it} from 'vitest';
import {generateDungeon} from '../../generateDungeon';
import {CellKind, OverlayKind, type DungeonPlan} from '../../types';
import {canonicalDungeonId} from '../dungeonIdentity';
import {dungeonEntrancePlayerCell,moveDungeonPlayer} from '../dungeonGameplay';
import {dungeonObjectId,nearbyDungeonObjects,interactWithDungeonObject} from '../dungeonObjectActions';

const seedPath='wf:42/cell:751/dungeon:m28';
const identity={seedPath,dungeonId:canonicalDungeonId(seedPath)};
const original=generateDungeon({seed:42,seedPath,params:{theme:'crypt'}});
const player=dungeonEntrancePlayerCell(original);
const adjacent=moveDungeonPlayer(original,player,'east');
// Explicit authored test objects exercise the boundary; none are inserted in the live source dungeon.
const plan={...original,props:[{kind:'dropped-coins',x:adjacent.x*5,y:adjacent.y*5,rot:0 as const,scale:1,roomId:original.entranceId},
  {kind:'chest',x:player.x*5,y:player.y*5,rot:0 as const,scale:1,roomId:original.entranceId}]};
const known=[`${player.x},${player.y}`,`${adjacent.x},${adjacent.y}`];
const id=dungeonObjectId(identity,0);

describe('physical source objects',()=>{
  it('offers only a reached observed canonical floor hazard and never a collectible substitute',()=>{
    const source=growthPlan();source.overlay.fill(0);
    source.traps=[{kind:'darts',x:15,y:10,roomId:1,eventRef:4}];
    const before=structuredClone(source),key=`object.v1:${identity.dungeonId}:trap:0`;
    const targets=nearbyDungeonObjects(source,identity,{x:2,y:2},['3,2']);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({id:key,cell:{x:3,y:2},label:'dart mechanism',collectible:false});
    expect(targets[0].warning).toMatch(/does not disarm/);
    expect(targets[0].observation).not.toMatch(/years|centur|event|builder/);
    expect(interactWithDungeonObject(source,identity,{x:2,y:2},['3,2'],{},key,'examine')).toEqual({id:key,finding:'examined'});
    expect(interactWithDungeonObject(source,identity,{x:2,y:2},['3,2'],{[key]:'examined'},key,'collect')).toBeNull();
    expect(nearbyDungeonObjects(source,identity,{x:2,y:2},[])).toEqual([]);
    expect(nearbyDungeonObjects(source,identity,{x:2,y:1},['3,2'])).toEqual([]);
    source.doors=[{...original.doors[0],cell:{x:3,y:2},state:'door'}];
    expect(nearbyDungeonObjects(source,identity,{x:2,y:2},['3,2'])).toEqual([]);
    source.doors=[];expect(structuredClone(source)).toEqual(before);
  });
  function growthPlan():DungeonPlan{
    const surface={...original,W:7,H:5,cellFt:5,grid:new Uint8Array(35).fill(CellKind.Floor),
      overlay:new Uint8Array(35),rooms:[],props:[],doors:[],traps:[],spawns:[]};
    for(const index of [16,17,18])surface.overlay[index]=OverlayKind.Bloom;
    return surface;
  }
  it('offers one reachable source patch with stable identity from either side and no hidden history',()=>{
    const source=growthPlan(),before=structuredClone(source);
    const left=nearbyDungeonObjects(source,identity,{x:2,y:2},['2,2']);
    const right=nearbyDungeonObjects(source,identity,{x:4,y:2},['4,2']);
    expect(left).toHaveLength(1);expect(right).toHaveLength(1);
    expect(left[0].id).toBe(`object.v1:${identity.dungeonId}:surface:bloom:16`);
    expect(right[0].id).toBe(left[0].id);
    expect(left[0].cell).toEqual({x:2,y:2});expect(right[0].cell).toEqual({x:4,y:2});
    expect(left[0].observation).toContain('remain undetermined');
    expect(left[0].collectible).toBe(false);
    expect(structuredClone(source)).toEqual(before);
  });
  it('requires observed cardinal floor reach and cannot inspect a closed leaf or diagonal surface',()=>{
    const source=growthPlan();
    expect(nearbyDungeonObjects(source,identity,{x:2,y:2},[])).toEqual([]);
    expect(nearbyDungeonObjects(source,identity,{x:0,y:0},['2,2'])).toEqual([]);
    source.overlay.fill(0);source.overlay[17]=OverlayKind.Bloom;
    source.doors=[{...original.doors[0],cell:{x:3,y:2},state:'door'}];
    expect(nearbyDungeonObjects(source,identity,{x:2,y:2},['3,2'])).toEqual([]);
    source.doors=[];
    expect(nearbyDungeonObjects(source,identity,{x:2,y:1},['3,2'])).toEqual([]);
    source.grid[17]=CellKind.Wall;
    expect(nearbyDungeonObjects(source,identity,{x:2,y:2},['3,2'])).toEqual([]);
  });
  it('persists observation only; growth is neither an item nor a cache claim',()=>{
    const source=growthPlan(),key=`object.v1:${identity.dungeonId}:surface:bloom:16`;
    const result=interactWithDungeonObject(source,identity,{x:2,y:2},['2,2'],{},key,'examine');
    expect(result).toEqual({id:key,finding:'examined'});
    expect(interactWithDungeonObject(source,identity,{x:2,y:2},['2,2'],{[key]:'examined'},key,'collect')).toBeNull();
    expect(interactWithDungeonObject(source,identity,{x:2,y:2},['2,2'],{[key]:'examined'},key,'examine')).toBeNull();
    expect(interactWithDungeonObject(source,identity,{x:0,y:0},['2,2'],{},key,'examine')).toBeNull();
    expect(interactWithDungeonObject(source,identity,{x:2,y:2},['2,2'],{},key+'foreign','examine')).toBeNull();
  });
  it('requires observation before collecting an actual loose coin once',()=>{
    expect(interactWithDungeonObject(plan,identity,player,known,{},id,'collect')).toBeNull();
    expect(interactWithDungeonObject(plan,identity,player,known,{},id,'examine')).toEqual({id,finding:'examined'});
    expect(interactWithDungeonObject(plan,identity,player,known,{[id]:'examined'},id,'collect')).toEqual({id,finding:'collected',itemId:'gold_piece'});
    expect(interactWithDungeonObject(plan,identity,player,known,{[id]:'collected'},id,'collect')).toBeNull();
  });
  it('refuses unknown, distant, foreign and furniture reward requests',()=>{
    expect(nearbyDungeonObjects(plan,identity,player,[])).toEqual([]);
    expect(interactWithDungeonObject(plan,identity,{x:-100,y:-100},known,{[id]:'examined'},id,'collect')).toBeNull();
    expect(interactWithDungeonObject(plan,identity,player,known,{[id]:'examined'},id+'foreign','collect')).toBeNull();
    const chest=dungeonObjectId(identity,1);
    expect(interactWithDungeonObject(plan,identity,player,known,{[chest]:'examined'},chest,'collect')).toBeNull();
  });
  it('describes reached rubble as physical broken stone without disclosing its hidden cause or awarding an item',()=>{
    const source={...original,props:[{kind:'rubble',x:player.x*5,y:player.y*5,rot:0 as const,scale:1,roomId:original.entranceId,eventRef:0}]};
    const before=structuredClone(source),key=dungeonObjectId(identity,0);
    const target=nearbyDungeonObjects(source,identity,player,known).find(o=>o.id===key)!;
    expect(target.observation).toContain('broken stone');
    expect(target.observation).not.toMatch(/years|centur|caused|builder|collapse/i);
    expect(target.collectible).toBe(false);
    expect(interactWithDungeonObject(source,identity,player,known,{},key,'examine')).toEqual({id:key,finding:'examined'});
    expect(interactWithDungeonObject(source,identity,player,known,{[key]:'examined'},key,'collect')).toBeNull();
    expect(structuredClone(source)).toEqual(before);
  });
  it('keeps source props and floor unchanged and never exposes event summaries',()=>{
    const before=structuredClone(plan);
    const targets=nearbyDungeonObjects(plan,identity,player,known);
    expect(targets.map(o=>o.id)).toEqual([id,dungeonObjectId(identity,1)]);
    expect(targets[1].observation).toContain('does not open');
    expect(structuredClone(plan)).toEqual(before);
  });
});
