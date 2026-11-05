/**
 * Connects a named household body to the game's existing NPC and meeting memory.
 * The household owns names, ages and family; picking a body never invents a
 * second family. Physical reach is checked again when the player chooses Talk.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 04/11/2026, 22:17:11
 * Dependents: components/World3D/GroundFurnishingContext.ts, components/World3D/InteriorOccupants.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownBuildingVisit } from '../Worldforge/townBuildingVisit';
import type { AvatarFootfall } from './groundFurnishingInteraction';
import type { SiteGroupTransform } from '../../systems/worldforge/bridge/sitePartTransform';
import { worldOffsetToSiteLocal } from '../../systems/worldforge/bridge/sitePartTransform';
import { blueprintSiteOrigin } from '../../systems/worldforge/interior/blueprintTypes';
import { BLUEPRINT_STOREY_FT } from '../../systems/world3d/buildingModels';
import { householdMemberIdentity } from '../../systems/worldforge/town/householdBrief';
import { generateNPC } from '../../services/npcGenerator';
import type { RichNPC } from '../../types/world';
import type { GroundWorld } from '../../systems/worldforge/bridge/groundChunkLoader';
import type { TownLifeState } from '../../systems/worldforge/roster/agentLife';
import { resolveGroundWalk } from './groundBuildingMotion';
import { reconcileHouseholdNpc } from '../../systems/worldforge/townsim/householdNpc';

export interface ResidentPick {
  siteId: string;
  memberId: string;
  pose: AvatarFootfall;
  transform: SiteGroupTransform;
  activity: string;
  /** Current street-body ownership, supplied only by its live route sampler. */
  streetOwned?: boolean;
}
/** Reads the current body, not its old position when the profile was opened. */
export type ReadResidentPick = () => ResidentPick | null;

export function residentMemberIndex(visit: TownBuildingVisit, memberId: string): number {
  return visit.household?.members.findIndex((_, index) => householdMemberIdentity(visit.household!, index) === memberId) ?? -1;
}


/** A public duty site is not a second household or a merchant identity.
 * Admit only one current projected worker whose real home matches their stable
 * member key. The caller loads that home's family and the actual site's room. */
export function civicResidentHomePlot(burgId: number, sitePlotId: number, memberId: string, rosters: GroundWorld['rosters']): number | undefined {
  const home = /^b([0-9]+):/.exec(memberId);
  if (!home) return undefined;
  const matches = rosters.filter(roster => roster.burgId === burgId)
    .flatMap(roster => roster.occupants.filter(person => person.householdMemberId === memberId));
  if (matches.length !== 1) return undefined;
  const person = matches[0];
  return person.civicWorkplace?.role === 'priest' && person.civicWorkplace.plotId === sitePlotId
    && person.homePlotId === Number(home[1]) && person.homePlotId !== sitePlotId
    && person.workPlotId === undefined && !person.retired && person.ageBand !== 'child'
    ? person.homePlotId : undefined;
}

export function residentNpcId(burgId: number, memberId: string, workPlotId?: number): string {
  // Workers retain the established merchant id, stock, disposition and memory.
  return workPlotId === undefined ? `npc_burg_${burgId}_member_${memberId}` : `npc_burg_${burgId}_plot_${workPlotId}`;
}

/** Resolve the blueprint room occupied by an accepted body at a qualified site.
 * Camera framing reuses this same site/floor/cell rule; missing or stale source
 * facts remain unknown and can never pull the view toward a guessed room. */
export function residentRoomAt(physicalPlan: TownBuildingVisit['plan'], transform: SiteGroupTransform,
  pose: Pick<AvatarFootfall, 'xM' | 'zM' | 'yM'>): {level: number; id: number} | null {
  if (![pose.xM, pose.zM, pose.yM, transform.groupX, transform.groupZ, transform.surfaceY,
    transform.rotationY, transform.doorZSign].every(Number.isFinite)) return null;
  const origin = blueprintSiteOrigin(physicalPlan), FT = .3048;
  const local = worldOffsetToSiteLocal(pose.xM - transform.groupX, pose.zM - transform.groupZ, transform.rotationY);
  const cx = Math.floor((local.lx / FT + origin.x) / 5);
  const cy = Math.floor((local.lz * -transform.doorZSign / FT + origin.y) / 5);
  const level = Math.round((pose.yM - transform.surfaceY) / (BLUEPRINT_STOREY_FT * FT));
  if (Math.abs(pose.yM - transform.surfaceY - level * BLUEPRINT_STOREY_FT * FT) > .75) return null;
  const room = physicalPlan.floors.find(f => f.level === level)?.rooms.find(r => r.cells.some(c => c.cx === cx && c.cy === cy));
  return room ? {level, id: room.id} : null;
}

/** Identify one exact generated plot containing accepted feet; overlaps and
 * boundary/outside positions stay unknown instead of choosing the nearest site. */
export function residentSiteAt(ground: GroundWorld, pose: Pick<AvatarFootfall, 'xM' | 'zM'>) {
  if (![pose.xM, pose.zM].every(Number.isFinite)) return null;
  const matches = ground.buildings.filter(building => {
    const points = building.cornersM;
    if (points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.z > pose.zM) !== (b.z > pose.zM)
        && pose.xM < ((b.x - a.x) * (pose.zM - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  });
  return matches.length === 1 ? matches[0] : null;
}

export function residentReachError(visit: TownBuildingVisit, pick: ResidentPick | null, player: AvatarFootfall | null, access?: {ground: GroundWorld; openDoors?: ReadonlySet<string>; spaceVisit?: TownBuildingVisit}): string | null {
  if (!pick || residentMemberIndex(visit, pick.memberId) < 0) return 'This resident is no longer here.';
  if (access?.spaceVisit && /^wf-plot-\d+-(\d+)$/.exec(pick.siteId)?.[1] !== String(access.spaceVisit.plot.id))
    return 'This resident has moved. Meet them where they are now.';
  if (!player || ![player.xM, player.zM, player.yM, pick.pose.xM, pick.pose.zM, pick.pose.yM].every(Number.isFinite)) return 'Wait until your character arrives.';
  if (pick.streetOwned) {
    // Speaking outside does not require entering somebody's home. Preserve the
    // same physical reach and require an unobstructed native walking path, so
    // a nearby name across a closed door or wall is not a remote Talk shortcut.
    if (Math.abs(player.yM - pick.pose.yM) > .75) return 'Move to the same level to meet this resident.';
    if (Math.hypot(player.xM - pick.pose.xM, player.zM - pick.pose.zM) > 2.5) return 'Move closer to meet this resident.';
    if (!access) return 'Wait until this resident’s route is available.';
    if (resolveGroundWalk(access.ground, player, pick.pose, access.openDoors).blocked) return 'Move into the same open space to meet this resident.';
    return null;
  }
  const physicalPlan = access?.spaceVisit?.plan ?? visit.plan;
  const bodyRoom = residentRoomAt(physicalPlan, pick.transform, pick.pose);
  const playerRoom = residentRoomAt(physicalPlan, pick.transform, player);
  if (!bodyRoom || !playerRoom || bodyRoom.level !== playerRoom.level || bodyRoom.id !== playerRoom.id) return 'Enter the same room and floor to meet this resident.';
  return Math.hypot(player.xM - pick.pose.xM, player.zM - pick.pose.zM) <= 2.5 ? null : 'Move closer to meet this resident.';
}

export function createHouseholdResidentNpc(visit: TownBuildingVisit, memberIndex: number, npcId: string, worldSeed: number, burgId: number, keeperIds?: ReadonlyMap<string, string>, life?: TownLifeState, day = 0) {
  const home = visit.household, member = home?.members[memberIndex];
  if (!home || !member) throw new Error('This household member is unavailable.');
  if (!visit.townName) throw new Error('This settlement has no canonical name.');
  const npc: RichNPC = generateNPC({id: npcId, name: member.name, role: 'civilian', occupation: member.occupation || 'resident', level: 1, worldSeed,
    town: {burgId, wealth: 50, raceWeights: {[member.race]: 1}}});
  // A household biography is not evidence of an adventuring class or kit.
  // Ordinary residents start with an unarmed civilian baseline; earned skills
  // and authored companion capabilities need their own source-backed producer.
  npc.biography.classId = 'commoner';
  npc.biography.backgroundId = 'commoner';
  npc.biography.abilityScores = {Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10};
  npc.stats = {hp: 4, maxHp: 4, armorClass: 10, speed: 30, initiativeBonus: 0, passivePerception: 10, proficiencyBonus: 0};
  npc.equippedItems = {};
  // First contact uses the same saved life facts and day as arrival/load.
  // A recorded death is already family history; reload must not repair a new
  // resident’s family status or change their signature after the meeting.
  return reconcileHouseholdNpc(npc, home, memberIndex, burgId, visit.townName, keeperIds, life, day);
}
