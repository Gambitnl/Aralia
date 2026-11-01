/** A read municipal account can locate its named town on the existing map.
 * This projects retained knowledge; it never returns a dungeon entrance,
 * changes discoveries, rewrites an account or commits a journey. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 13:07:48
 * Dependents: components/MapPane.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {DiscoveryEntry,GameState} from '@/types/state';
import {DiscoveryType} from '@/types/state';
import {getBridgeAtlas} from '@/systems/worldforge/bridge/legacySubmapBridge';
import {enumerateDungeonSites} from '@/systems/worldforge/dungeon/world/dungeonSites';

function flag(entry:DiscoveryEntry,key:string){
 const values=Array.isArray(entry.flags)?entry.flags.filter(f=>f.key===key):[];
 return values.length===1?values[0].value:undefined;
}
const positiveId=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;

export interface LearnedLibraryTown {key:string;burgId:number;cellId:number;name:string;sourceName:string}

export function learnedLibraryDestinations(state:GameState|undefined):LearnedLibraryTown[]{
 const seed=state?.worldSeed;
 if(!state||typeof seed!=='number'||!Number.isSafeInteger(seed)||seed<0)return [];
 // Journal unread means the player has not reopened the saved account. The
 // account itself was earned by explicit library reading, so both states count.
 const accounts=(state.discoveryLog??[]).filter(e=>e.type===DiscoveryType.LORE_DISCOVERY
  &&flag(e,'knowledgeKind')==='library-account'&&flag(e,'sourceWorldSeed')===seed);
 if(!accounts.length)return [];
 const atlas=getBridgeAtlas(seed),sites=enumerateDungeonSites(seed),seen=new Set<number>();
 return accounts.flatMap(entry=>{
  const burgId=flag(entry,'accountTargetBurgId'),libraryId=flag(entry,'sourceLibraryBurgId'),plotId=flag(entry,'sourceLibraryPlotId'),stateId=flag(entry,'sourceStateId');
  const sitePath=flag(entry,'accountSitePath');
  if(!positiveId(burgId)||!positiveId(libraryId)||!(typeof plotId==='number'&&Number.isSafeInteger(plotId)&&plotId>=0)||!positiveId(stateId)||typeof sitePath!=='string'
   ||seen.has(burgId)||entry.source?.type!=='LOCATION'
   ||entry.source.id!==`world:${seed}:burg:${libraryId}:library:${plotId}`
   ||flag(entry,'sourceRef')!==`municipal-register:${burgId}`||flag(entry,'recordKey')!==`works:${sitePath}`)return [];
  const prefix=`library-account:v1:${seed}:${libraryId}:${plotId}:works:${sitePath}:`;
  if(!entry.id.startsWith(prefix)||!/^[a-f0-9]{1,8}$/.test(entry.id.slice(prefix.length))||!entry.content?.trim())return [];
  const town=atlas.pack.burgs?.[burgId],libraryTown=atlas.pack.burgs?.[libraryId];
  if(!town?.name||town.removed||town.cell==null||!libraryTown?.name||libraryTown.removed||libraryTown.cell==null
   ||atlas.pack.cells.state?.[town.cell]!==stateId||atlas.pack.cells.state?.[libraryTown.cell]!==stateId
   ||entry.title!==`Library account: ${town.name}: municipal waterworks`
   ||entry.source.name!==`${libraryTown.name} library`)return [];
  if(!sites.some(site=>site.sitePath===sitePath&&site.origin==='town'&&site.archetype==='waterworks'
   &&site.burgId===burgId&&site.cellId===town.cell))return [];
  // Catalog drift hides a stale cue, preserving the original written memory.
  // Only the public town cell reaches areaFocus; hidden site coordinates stay out.
  const point=atlas.pack.cells.p?.[town.cell];
  if(!point||!point.every(Number.isFinite))return [];
  seen.add(burgId);
  return [{key:entry.id,burgId,cellId:town.cell,name:town.name,sourceName:entry.source.name}];
 });
}
