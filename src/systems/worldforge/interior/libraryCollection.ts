/** A public library's new regional collection derives from the world's own
 * chronicle and municipal infrastructure. It never opens dungeon logs, private
 * rooms, current creatures or entrance coordinates. Explicit reading owns the
 * journal account; generating or indexing the collection grants no knowledge. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 12:25:08
 * Dependents: components/Town/LibraryCollectionReader.tsx, components/World3D/libraryReadingAccess.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState,DiscoveryEntry} from '@/types/state';
import {DiscoveryType} from '@/types/state';
import type {TownBuildingVisit} from '@/systems/worldforge/town/townBuildingVisit';
import {townBuildingVisit} from '@/systems/worldforge/town/townBuildingVisit';
import {worldChronicleFor} from '../chronicle/worldChronicle';
import {getBridgeAtlas} from '../bridge/legacySubmapBridge';
import {enumerateDungeonSites} from '../dungeon/world/dungeonSites';
import {resolveTownForLocation} from '../townsim/chronicleForLocation';
import {attendanceForVisit} from '@/systems/economy/businessAttendance';
import {getGameDay} from '@/utils/core';
import {fnv1a} from '../seedPath';

export function isPublicLibraryDesk(visit:TownBuildingVisit,level:number,index:number):boolean {
 const floor=visit.plan.floors.find(f=>f.level===level),piece=floor?.furnishings[index];
 return visit.plot.role==='civic'&&visit.plot.pop?.buildingType==='library'&&piece?.kind==='desk'
  &&floor?.rooms.some(room=>room.id===piece.roomId&&room.purpose==='study')===true;
}
export interface LibraryAccount {
 key:string;title:string;text:string;kind:'regional-history'|'municipal-works';
 sourceRef:string;targetBurgId?:number;sitePath?:string;
}
export interface LibraryCollection {
 worldSeed:number;burgId:number;plotId:number;townName:string;stateId:number;regionName:string;
 records:LibraryAccount[];
}

/** New collection policy: volumes in a civic library cover its present realm.
 * Municipal entries name only existing public town waterworks in that realm.
 * They do not borrow the spoken-rumor radius or generate any dungeon interior. */
export function libraryCollectionForVisit(worldSeed:number,burgId:number,visit:TownBuildingVisit):LibraryCollection|null {
 if(visit.plot.role!=='civic'||visit.plot.pop?.buildingType!=='library'
  ||!visit.manifests.some(m=>m.entries.some(e=>e.itemId==='book'&&e.qty>0)))return null;
 const atlas=getBridgeAtlas(worldSeed),burg=atlas.pack.burgs?.[burgId];
 if(!burg||burg.removed||burg.cell==null)return null;
 const stateId=atlas.pack.cells.state?.[burg.cell],regionName=stateId?atlas.pack.states?.[stateId]?.name:undefined;
 if(!stateId||!regionName)return null;
 const records:LibraryAccount[]=worldChronicleFor(worldSeed).entries
  .filter(e=>e.actors.stateIds?.includes(stateId)||e.actors.burgIds?.includes(burgId)||e.cells.includes(burg.cell!))
  .slice(0,8).map(e=>({key:`history:${e.id}`,title:e.name,kind:'regional-history',sourceRef:`world-chronicle:${e.id}`,
   text:`The regional history records ${e.name}, about ${e.yearsAgo} years ago. The account notes that ${e.evidence}.`}));
 const works=enumerateDungeonSites(worldSeed).filter(site=>{
  const town=site.burgId==null?undefined:atlas.pack.burgs?.[site.burgId];
  return site.origin==='town'&&site.archetype==='waterworks'&&town&&!town.removed&&town.cell===site.cellId
   &&atlas.pack.cells.state?.[site.cellId]===stateId&&!!town.name;
 }).sort((a,b)=>a.sitePath.localeCompare(b.sitePath)).slice(0,3);
 for(const site of works){
  const town=atlas.pack.burgs![site.burgId!];
  records.push({key:`works:${site.sitePath}`,title:`${town.name}: municipal waterworks`,kind:'municipal-works',
   sourceRef:`municipal-register:${site.burgId}`,targetBurgId:site.burgId,sitePath:site.sitePath,
   text:`The ${regionName} municipal register lists waterworks beneath ${town.name}. This entry does not establish an open entrance or present conditions. Ask locally in ${town.name} before planning an approach.`});
 }
 return {worldSeed,burgId,plotId:visit.plot.id,townName:visit.townName??burg.name??'Town',stateId,regionName,records};
}

const cache=new Map<string,{visit:TownBuildingVisit;collection:LibraryCollection|null}>();
/** Only a current admitted reading session can consult this collection. Its
 * accepted feet, full world, source history and opening hours must still agree.
 * The physical producer already verified the actual librarian's arrival. */
export function currentLibraryCollection(state:GameState):LibraryCollection|null {
 const place=state.broadsheetReadingPlace,proof=place?.library,position=state.playerGroundPos;
 if(!state.isBroadsheetVisible||state.broadsheetSnapshot||!place||!proof?.position||!position
  ||proof.worldSeed!==state.worldSeed)return null;
 for(const k of ['tileX','tileY','xM','zM','yM'] as const)
  if(!Number.isFinite(position[k])||position[k]!==proof.position[k])return null;
 const town=resolveTownForLocation({ground:state,worldSeed:state.worldSeed,cellId:state.playerCell?.cellId,
  currentLocationId:state.currentLocationId,townSim:state.townSim,gameTime:state.gameTime});
 if(town?.burgId!==place.burgId)return null;
 const events=state.townSim?.[place.burgId]?.buildingEvents?.[proof.plotId];
 if(JSON.stringify(events??null)!==proof.historySignature)return null;
 const retained=state.townSim?.[place.burgId]?.buildingSources?.[proof.plotId];
 const layoutRevision=state.townSim?.[place.burgId]?.layoutRevision;
 const key=JSON.stringify([proof.worldSeed,place.burgId,proof.plotId,layoutRevision,proof.historySignature,retained?.planSignature,retained?.furnishingRepair?.recipe,retained?.circulationRepair?.planSignature,retained?.householdRevision?.planSignature]);
 let source=cache.get(key);
 if(!source){
  const visit=townBuildingVisit(proof.worldSeed,place.burgId,proof.plotId,events,retained, layoutRevision);
  source={visit,collection:libraryCollectionForVisit(proof.worldSeed,place.burgId,visit)};cache.set(key,source);
 }
 if(!isPublicLibraryDesk(source.visit,proof.level,proof.index))return null;
 const time=new Date(state.gameTime);
 if(!Number.isFinite(time.getTime())||!attendanceForVisit(source.visit,time.getUTCHours(),town,getGameDay(time)).open)return null;
 return source.collection;
}

/** Frozen words and source references live in the existing journal. No target
 * locationId/hiddenSiteId flag is emitted, so an account cannot prove arrival. */
export function libraryAccountDiscovery(collection:LibraryCollection,record:LibraryAccount,gameTime:Date):Partial<DiscoveryEntry> {
 if(!collection.records.includes(record))throw Error('This account is not in the current library collection.');
 const fingerprint=fnv1a(JSON.stringify(record)).toString(16);
 const id=`library-account:v1:${collection.worldSeed}:${collection.burgId}:${collection.plotId}:${record.key}:${fingerprint}`;
 return {id,type:DiscoveryType.LORE_DISCOVERY,gameTime:new Date(gameTime).toISOString(),
  title:`Library account: ${record.title}`,content:record.text,
  source:{type:'LOCATION',id:`world:${collection.worldSeed}:burg:${collection.burgId}:library:${collection.plotId}`,name:`${collection.townName} library`},
  flags:[{key:'knowledgeKind',value:'library-account'},{key:'sourceWorldSeed',value:collection.worldSeed},
   {key:'sourceLibraryBurgId',value:collection.burgId},{key:'sourceLibraryPlotId',value:collection.plotId},
   {key:'sourceStateId',value:collection.stateId},{key:'recordKey',value:record.key},{key:'sourceRef',value:record.sourceRef},
   ...(record.targetBurgId==null?[]:[{key:'accountTargetBurgId',value:record.targetBurgId}]),
   ...(record.sitePath?[{key:'accountSitePath',value:record.sitePath}]:[])],isQuestRelated:false};
}
