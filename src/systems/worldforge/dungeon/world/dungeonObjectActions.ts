/** Physical source-object interactions. Seeing furniture never awards a cache or a combat win. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 16:00:19
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, systems/worldforge/dungeon/world/dungeonLifecycle.ts, systems/worldforge/dungeon/world/dungeonObjectResolution.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {CellKind, OverlayKind, type Cell, type DungeonPlan, type DungeonProp} from '../types';
import type {DungeonIdentity} from './dungeonIdentity';
import {dungeonCaches,dungeonCacheBlocker,type DungeonCache} from './dungeonCaches';

export type DungeonObjectFinding = 'examined' | 'collected';
export interface DungeonObjectTarget {
  id:string;
  sourceIndex:number;
  cell:Cell;
  prop:DungeonProp;
  label:string;
  observation:string;
  collectible:boolean;
  cache?:DungeonCache;
  warning?:string;
  previouslySecured?:boolean;
  collectionSummary?:string;
}

export interface DungeonObjectAccess {
  claimedTreasureIds?:readonly string[];
  clearedEncounterIds?:readonly string[];
}

export function dungeonObjectId(identity:DungeonIdentity, sourceIndex:number):string {
  return `object.v1:${identity.dungeonId}:prop:${sourceIndex}`;
}

function observation(prop:DungeonProp):string {
  switch(prop.kind) {
    case 'pried-vault': return 'The vault has been pried open. Its forced entrance is evidence of an earlier intrusion.';
    case 'dropped-coins': return 'A loose gold coin lies among the scattered coins. Following the trail may reveal where they came from.';
    case 'snapped-bar': return 'A broken bar remains at the entrance. It no longer seals the way.';
    case 'pick-scar': return 'Tool marks scar the stone. Marks alone do not establish a traversable passage.';
    case 'torch': return 'A fixed torch lights the nearby stone. It remains part of this place.';
    // Visible material only: the hidden event log still owns age and cause.
    case 'rubble': return 'Loose fragments of broken stone lie on the floor.';
    case 'pool': return 'Standing water fills this basin. Its appearance does not establish that it is safe to drink.';
    case 'chest': return 'A chest stands here. Examination alone does not open it or establish what remains inside.';
    default: return `You examine the ${prop.kind.replace(/[-_]+/g,' ')}. It remains in place.`;
  }
}

/** Only known source objects within one accepted cardinal floor step are available.
 * A wall, unopened door or distant room cannot become an interaction shortcut. */
export function nearbyDungeonObjects(plan:DungeonPlan, identity:DungeonIdentity, player:Cell,
  explored:readonly string[], access:DungeonObjectAccess={}):DungeonObjectTarget[] {
  if(!Number.isInteger(player.x)||!Number.isInteger(player.y)||player.x<0||player.y<0||player.x>=plan.W||player.y>=plan.H||
    plan.grid[player.y*plan.W+player.x]!==CellKind.Floor||
    plan.doors.some(door=>door.cell.x===player.x&&door.cell.y===player.y&&door.state!=='open'))return [];
  const known=new Set(explored);
  const caches=dungeonCaches(plan,identity);
  const cachePropIndices=new Set(caches.flatMap(cache=>cache.existingPropIndex===undefined?[]:[cache.existingPropIndex]));
  const canObserve=(cell:Cell)=>{
    const distance=Math.abs(cell.x-player.x)+Math.abs(cell.y-player.y);
    if(distance>1 || !known.has(`${cell.x},${cell.y}`) || cell.x<0 || cell.y<0 || cell.x>=plan.W || cell.y>=plan.H ||
      plan.grid[cell.y*plan.W+cell.x]!==CellKind.Floor ||
      plan.doors.some(d=>d.cell.x===cell.x&&d.cell.y===cell.y&&d.state!=='open')) return false;
    return true;
  };
  const props=plan.props.flatMap((prop,sourceIndex)=>{
    const cell={x:Math.floor(prop.x/plan.cellFt),y:Math.floor(prop.y/plan.cellFt)};
    if(cachePropIndices.has(sourceIndex)||!canObserve(cell))return [];
    return [{id:dungeonObjectId(identity,sourceIndex),sourceIndex,cell,prop,
      label:prop.kind.replace(/[-_]+/g,' '),observation:observation(prop),collectible:prop.kind==='dropped-coins'}];
  });
  // Traps are a separate canonical array, not furniture. Keep their frozen source
  // indices separate from props/caches, and expose only observed cardinal reach.
  // Looking identifies the physical fixture; it grants neither safety nor loot.
  const traps:DungeonObjectTarget[]=plan.traps.flatMap((trap,index)=>{
    const cell={x:Math.floor(trap.x/plan.cellFt),y:Math.floor(trap.y/plan.cellFt)};
    if(!canObserve(cell))return [];
    const descriptions={
      pit:{label:'pit cover',text:"An outlined cover breaks the floor's regular pattern. You have not established whether it will bear weight."},
      darts:{label:'dart mechanism',text:'Small holes surround a floor mechanism. You have not tested whether it is armed.'},
      snare:{label:'snare',text:'A loop and a tether are set into the floor. You have not tested their tension.'},
    };
    const description=descriptions[trap.kind];
    return [{id:`object.v1:${identity.dungeonId}:trap:${index}`,sourceIndex:index,cell,
      prop:{...trap,rot:0,scale:1},label:description.label,observation:description.text,
      collectible:false,warning:'Unresolved floor hazard. Examining it does not disarm it.'}];
  });
  const cacheTargets=caches.flatMap((cache,index)=>{
    if(!canObserve(cache.cell))return [];
    const blocker=dungeonCacheBlocker(plan,identity,cache,access.clearedEncounterIds??[]);
    const warnings={buried:'The cache is buried behind collapsed stone.',occupant:'The chamber is occupied. You cannot safely secure the cache while its creature remains unresolved.',
      trap:'A mechanism in this chamber must be dealt with before the cache can be secured.',water:'Water covers the cache. Reaching it requires a safe way through the water.'};
    const previouslySecured=access.claimedTreasureIds?.includes(cache.id)??false;
    return [{id:cache.existingPropIndex===undefined?`object.v1:${identity.dungeonId}:cache:${cache.roomId}`:dungeonObjectId(identity,cache.existingPropIndex),
      sourceIndex:cache.existingPropIndex??plan.props.length+index,cell:cache.cell,prop:cache.prop,cache,
      label:cache.label,observation:cache.plundered?'The cache has already been forced open. Nothing remains inside.':'A closed cache stands here. Its contents are concealed.',
      collectible:cache.contents.length>0&&!blocker&&!previouslySecured,previouslySecured,
      warning:blocker?warnings[blocker]:undefined,
      collectionSummary:`Secured · ${cache.contents.reduce((sum,item)=>sum+item.quantity,0)} gold pieces recovered.`}];
  });
  // Growth is an existing source surface, not a newly placed prop or reward. One
  // connected patch keeps its identity when approached from another cell or a
  // door opens. Only the reachable, already observed part is offered to the player.
  const surfaces:DungeonObjectTarget[]=[];
  const visited=new Set<number>();
  const candidates=[player,{x:player.x,y:player.y-1},{x:player.x+1,y:player.y},
    {x:player.x,y:player.y+1},{x:player.x-1,y:player.y}];
  for(const cell of candidates){
    const index=cell.y*plan.W+cell.x;
    if(!canObserve(cell)||plan.overlay[index]!==OverlayKind.Bloom||visited.has(index))continue;
    let origin=index;
    const queue=[index];visited.add(index);
    for(let cursor=0;cursor<queue.length;cursor++){
      const current=queue[cursor],x=current%plan.W,y=Math.floor(current/plan.W);
      origin=Math.min(origin,current);
      for(const next of [{x,y:y-1},{x:x+1,y},{x,y:y+1},{x:x-1,y}]){
        if(next.x<0||next.y<0||next.x>=plan.W||next.y>=plan.H)continue;
        const key=next.y*plan.W+next.x;
        if(visited.has(key)||plan.grid[key]!==CellKind.Floor||plan.overlay[key]!==OverlayKind.Bloom)continue;
        visited.add(key);queue.push(key);
      }
    }
    surfaces.push({id:`object.v1:${identity.dungeonId}:surface:bloom:${origin}`,sourceIndex:-1-origin,cell,
      // Presentation adapter only: the canonical props array and floor remain untouched.
      prop:{kind:'fungal-growth',x:cell.x*plan.cellFt,y:cell.y*plan.cellFt,rot:0,scale:1,roomId:-1},
      label:'fungal growth',collectible:false,
      observation:'You inspect fungal growth on the masonry. Its species, age and cause remain undetermined. Handling safety is unknown.'});
  }
  return [...props,...cacheTargets,...surfaces,...traps];
}

/** Revalidate reach and remembered findings at the authoritative inventory boundary.
 * Loose coins are the first supported pickup; furniture and vault contents are not fabricated. */
export function interactWithDungeonObject(plan:DungeonPlan, identity:DungeonIdentity, player:Cell,
  explored:readonly string[], findings:Readonly<Record<string,DungeonObjectFinding>>, id:string,
  intent:'examine'|'collect',access:DungeonObjectAccess={}):{id:string;finding:DungeonObjectFinding;itemId?:'gold_piece';rewards?:readonly {itemId:string;quantity:number}[];claimedTreasureId?:string}|null {
  if(intent!=='examine' && intent!=='collect') return null;
  const target=nearbyDungeonObjects(plan,identity,player,explored,access).find(object=>object.id===id);
  if(!target || findings[id]==='collected') return null;
  if(intent==='examine') return findings[id] ? null : {id,finding:'examined'};
  if(!target.collectible || findings[id]!=='examined') return null;
  if(target.cache)return {id,finding:'collected',rewards:target.cache.contents,claimedTreasureId:target.cache.id};
  return {id,finding:'collected',itemId:'gold_piece'};
}
