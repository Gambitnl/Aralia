/** Residents use their assigned entry during commutes and their claimed private
 * leaf only for a room transition with actual feet at its source doorway. This
 * transient leaf state never changes saved player opens or grants home consent.
 * Indoor room/stair obstacle navigation remains a separate unfinished system. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 17:09:18
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {ActorBody} from './actorPersonalSpace';
import {doorBodyClearance,DOOR_BODY_REACH_M,type DoorBodies} from './doorBodyClearance';
import {chunkOriginWorld} from '@/systems/world3d/coords';
import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { LoadedChunk } from '@/systems/world3d/types';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { siteDoorKey, sitePartScenePosition, worldOffsetToSiteLocal, type SiteGroupTransform } from '@/systems/worldforge/bridge/sitePartTransform';
import { recentCommute } from '@/systems/worldforge/roster/townSnapshot';
import { collectInteriorOccupants, createResidentStreetSampler, isInteriorEntryTraversalAtClock, occupantMotionAtClock,
  residentLocationAtClock, residentRosterIndex } from './InteriorOccupants';

export type ResidentDoorUsers = ReadonlyMap<string, readonly string[]>;
const ENTRY_REACH_M = 1.4;
export type ResidentActualFootfall=ActorBody;
export interface ResidentDoorClearanceContext {readBodies:()=>DoorBodies|null;readOpenDoors:()=>ReadonlySet<string>|undefined}

export function mergeResidentDoorOpens(saved: ReadonlySet<string> | undefined, users: ResidentDoorUsers): ReadonlySet<string> | undefined {
  if (!users.size) return saved;
  return new Set([...(saved ?? []), ...users.keys()]);
}

export function createResidentDoorSampler(ground: GroundWorld | null | undefined, loaded: LoadedChunk[], origin: SceneOrigin, readActualFeet?:(residentKey:string)=>ResidentActualFootfall|null,clearanceContext?:ResidentDoorClearanceContext) {
  const figures = collectInteriorOccupants(loaded, origin);
  const street = createResidentStreetSampler(ground, loaded, origin);
  const identities = residentRosterIndex(ground?.rosters ?? []);
  const sources = new Map<string, NonNullable<GroundWorld['rosters']>[number]['occupants'][number]>((ground?.rosters ?? []).flatMap(roster => roster.occupants.map(person => [`${roster.burgId}:${person.id}`, person] as const)));
  const sites = new Map(loaded.flatMap(chunk => chunk.bundle.sites.map(site => [site.id, site] as const)));
  const privateLeaves=new Map<string,{part:SitePart;transform:SiteGroupTransform}>();
  for(const chunk of loaded){const offset=chunkOriginWorld(chunk.cx,chunk.cy);
    for(const site of chunk.bundle.sites)for(const part of site.parts??[])if(part.door?.privateRoomId!==undefined)
      privateLeaves.set(siteDoorKey(site.id,part),{part,transform:{groupX:offset.x+site.localX,groupZ:offset.y+site.localZ,
        surfaceY:site.surfaceY,rotationY:site.rotationY??0,doorZSign:site.doorZSign??-1}});
  }
  let previous: ResidentDoorUsers = new Map();
  let privateUses=new Set<string>(),previousPrivateOpens=new Set<string>();
  return (clock: number): ResidentDoorUsers => {
    const users = new Map<string, string[]>(),nextPrivateUses=new Set<string>(),requestedPrivateDoors=new Set<string>();
    const bodies=clearanceContext?.readBodies()??null,observedOpen=clearanceContext?.readOpenDoors();
    const bodyNames=new Map<string,string>();
    const hour = Math.floor(((clock % 24) + 24) % 24);
    for (const figure of figures) {
      const renderKey = `${figure.occ.burgId}:${figure.occ.id}`, source = sources.get(renderKey);
      if (!source || identities.get(renderKey) !== figure.key || source.name !== figure.occ.name
        ||source.householdMemberId!==figure.occ.householdMemberId) continue;
      bodyNames.set('resident:'+figure.key,source.name);
      const location = residentLocationAtClock(figure, clock);
      const motion = location ? occupantMotionAtClock(location.occ, clock, location.frame, location.placement, location.surfaceY, location.doorPosition) : street(figure.key, clock);
      if (!motion) continue;
      const leg = recentCommute(source, hour);
      for (const entry of figure.locations ?? [figure]) {
        const site = entry.siteId ? sites.get(entry.siteId) : undefined;
        if (!site) continue;
        // An indoor change of furniture is not an entry request. On the street,
        // only this commute's source/destination may operate a leaf.
        const enteringOrLeaving = location === entry && isInteriorEntryTraversalAtClock(
          entry.occ, clock, entry.frame, entry.placement, entry.surfaceY, entry.doorPosition);
        const streetLeg = !location && leg && [leg.from, leg.to].some(plot => site.id === `wf-plot-${figure.occ.burgId}-${plot}`);
        const permission=entry.occ.privateDoorAccess;
        const reported=location===entry?readActualFeet?.(figure.key):null,measured=bodies?.get('resident:'+figure.key);
        // Both readers must describe the same live body; an old click/scene
        // snapshot cannot supply clearance for a newly placed resident.
        const actual=reported&&measured&&Math.hypot(reported.xM-measured.xM,reported.yM-measured.yM,reported.zM-measured.zM)<.001?measured:null;
        if(permission?.profile==='private-room-leaves-v1'&&permission.memberId===source.householdMemberId
          &&entry.occ.householdMemberId===source.householdMemberId&&entry.occ.name===source.name
          &&entry.occ.id===source.id&&entry.occ.burgId===figure.occ.burgId
          &&site.id==='wf-plot-'+figure.occ.burgId+'-'+source.homePlotId
          &&actual&&[actual.xM,actual.yM,actual.zM,actual.radiusM,actual.heightM].every(Number.isFinite)&&actual.radiusM>0&&actual.heightM>0){
          const current=entry.occ.stationsByHour[hour],prior=entry.occ.stationsByHour[(hour+23)%24];
          const local=worldOffsetToSiteLocal(actual.xM-origin.x-entry.placement.gx,actual.zM-origin.z-entry.placement.gz,entry.placement.rotationY);
          const localZ=local.lz*-entry.placement.doorZSign;
          const xFt=local.lx/.3048+(entry.frame.originXFt??entry.frame.widthFt/2);
          const yFt=localZ/.3048+(entry.frame.originYFt??entry.frame.depthFt/2);
          for(const part of site.parts??[]){
            const leaf=part.door;
            const claim=leaf&&permission.doors.find(claim=>claim.id===leaf.id&&claim.level===leaf.level&&claim.roomId===leaf.privateRoomId);
            if(leaf?.privateRoomId===undefined||!claim)continue;
            const key=siteDoorKey(site.id,part),useKey=figure.key+'|'+key;
            const owns=(station:typeof current)=>!!station&&station.level===leaf.level&&station.roomId===leaf.privateRoomId;
            if(!privateUses.has(useKey)&&!(owns(current)!==owns(prior)||enteringOrLeaving&&owns(current)))continue;
            const reach=Math.hypot(Math.max(0,Math.abs(local.lx-part.x)-part.w/2),Math.max(0,Math.abs(localZ-part.z)-part.d/2));
            if(!claim.approachCells?.some(cell=>cell.cx===Math.floor(xFt/5)&&cell.cy===Math.floor(yFt/5))
              ||Math.abs(actual.yM-entry.surfaceY-(part.baseY??0))>.75||reach>DOOR_BODY_REACH_M)continue;
            const support=entry.frame.floorLevels?.get(leaf.level)?.some(floor=>
              Math.abs(local.lx-floor.x)<=floor.w/2+1e-7&&Math.abs(localZ-floor.z)<=floor.d/2+1e-7
              &&Math.abs(actual.yM-entry.surfaceY-(floor.baseY??0)-floor.h)<=.08);
            if(!support)continue;
            const transform={groupX:entry.placement.gx+origin.x,groupZ:entry.placement.gz+origin.z,surfaceY:entry.surfaceY,
              rotationY:entry.placement.rotationY,doorZSign:entry.placement.doorZSign};
            // A closed leaf needs its complete turning path clear of everyone.
            // Existing observed-open use does not perform a new rotation.
            if(!privateUses.has(useKey)&&!observedOpen?.has(key)){
              const clearance=doorBodyClearance(part,transform,bodies);
              if(!clearance.valid||clearance.blockers.length)continue;
            }
            nextPrivateUses.add(useKey);requestedPrivateDoors.add(key);
            const names=users.get(key)??[];if(!names.includes(source.name))names.push(source.name);users.set(key,names);
          }
        }
        // Preserve the exterior commute policy. Private operation above is a
        // body-backed request, not proof that the remaining indoor route works.
        if (!motion.moving || !enteringOrLeaving && !streetLeg) continue;
        for (const part of site.parts ?? []) {
          if (!part.door || part.door.privateRoomId!==undefined || part.door.level !== 0) continue;
          const door = sitePartScenePosition(part, {groupX: entry.placement.gx, groupZ: entry.placement.gz,
            surfaceY: entry.surfaceY, rotationY: entry.placement.rotationY, doorZSign: entry.placement.doorZSign});
          // Only the actual shared frontage endpoint, not another nearby room
          // door, participates in the exterior handoff.
          if (Math.hypot(door.x - entry.doorPosition.x, door.z - entry.doorPosition.z) > 0.05 ||
            Math.abs(motion.position.y - entry.surfaceY) > 0.75 ||
            Math.hypot(motion.position.x - door.x, motion.position.z - door.z) > ENTRY_REACH_M) continue;
          const key = siteDoorKey(site.id, part), names = users.get(key) ?? [];
          if (!names.includes(source.name)) names.push(source.name);
          users.set(key, names);
        }
      }
    }
    // The requesting resident may have gone. An already-open private leaf must
    // still wait for the player, companions or another resident to leave its
    // full turning path. This hold needs observed/prior open evidence; bodies
    // near a closed leaf never manufacture an opening or room permission.
    for(const [key,{part,transform}]of privateLeaves){
      if(!observedOpen?.has(key)&&!previousPrivateOpens.has(key)&&!requestedPrivateDoors.has(key))continue;
      const clearance=doorBodyClearance(part,transform,bodies);
      if(clearance.valid&&!clearance.blockers.length)continue;
      const names=users.get(key)??[];
      for(const bodyKey of clearance.valid?clearance.blockers:['unknown']){
        const label=bodyKey==='player'?'Your character':bodyKey.startsWith('companion:')?'A companion':bodyNames.get(bodyKey)??'Someone';
        if(!names.includes(label))names.push(label);
      }
      users.set(key,names);
    }
    privateUses=nextPrivateUses;
    previousPrivateOpens=new Set([...users.keys()].filter(key=>privateLeaves.has(key)));
    for (const names of users.values()) names.sort();
    if (users.size === previous.size && [...users].every(([key, names]) => names.join('\0') === previous.get(key)?.join('\0'))) return previous;
    previous = users;
    return users;
  };
}
