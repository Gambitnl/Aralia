/**
 * @file generateBuilding.ts — assemble a full multi-floor BlueprintPlan.
 *
 * Task 8 of the Building Blueprint Pipeline. Composes the Task 2–7 modules
 * (footprint → partition → program → doors → walls → furnish) per floor:
 *   - all floors share the SAME footprint
 *   - ground floor (level 0) partitions with keepMainWhole: true
 *   - upper floors are sleeping quarters (bedrooms / guest rooms)
 *   - the basement (level -1) is cellars / storage, keepMainWhole: false
 *   - the initial compact shaft anchors in the ground main room; household
 *     plans replace it with a measured return stair only after real furniture
 *     fitting preserves every sleeper. Unsupported plans retain the original.
 *   - basement floors get NO windows (underground)
 *
 * Deterministic: each floor seeds from childSeedPath(path, 'floor:<level>').
 * Memoized per (seedPath, type, storeys, basement) exactly as
 * generateInterior memoizes per plot key. Pure data — no three.js.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 07:06:39
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/interior/generateInterior.ts
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {
  BlueprintFloor,
  BlueprintPlan,
  BlueprintRoom,
  BlueprintStair,
  BlueprintWindow,
  BuildingBackstory,
  BuildingEvent,
  BuildingEventHistory,
  BuildingEnsemble,
  BuildingType,
  Cell,
  HouseholdBrief,
  StyleContext,
} from './blueprintTypes';
import { cellKey } from './blueprintTypes';
import {
  clampFootprint,
  footprintForLotProfile,
  genFootprint,
  type Footprint,
} from './footprint';
import { partition, roomCapFor } from './partition';
import { assignPurposes, assignUpperPurposes } from './program';
import { programForBrief, type BedroomAssignment } from './briefProgram';
import { wireDoors } from './doors';
import { buildWalls } from './walls';
import { furnishRooms } from './furnish';
import { furnishHouseholdBuilding,furnishHouseholdSeating } from './householdFurnish';
import { RURAL_FAMILY_LAYOUT_RECIPE,seatRuralSharedEntry,ruralFamilyMissingBeds,ruralFamilyMissingSeats,ruralFamilyPrivateAccessIssues,ruralFamilyCirculationDeficit,planRuralFamilyGround,wireRuralSharedBedrooms,ruralFamilyMixedSleepingRooms,ruralFamilyMissingLivingBasics,ruralFamilyStairDeficit,RURAL_FAMILY_FURNISHING,type RuralFamilyLayoutRecipe } from './ruralFamilyLayout';
import { planHouseholdReturnStair } from './stairHousehold';
import { returnStairPoint, stairDoorCells } from './stairLayout';
import {
  finishPaletteForTier,
  resolveStyle,
  styleFamilyForCultureType,
} from '../town/architectureStyle';
import { solveRoof } from './roofPlan';
import { childSeedPath, streamPath, type SeedPath } from '../seedPath';
import { metersFromFeet } from '../units';
import { resolveBuildingBackstory } from './buildingHistory';
import {
  applyHistory,
  buildingEventLogDigest,
  buildingHistoryEventCount,
} from './buildingEventHistory';
import { applyStructuralExtensions } from './buildingExtensions';

const CELL_FT = 5;

/** Storey height in feet — the canonical per-floor height for the whole
 *  building pipeline. MIRRORS BLUEPRINT_STOREY_FT in
 *  systems/world3d/buildingModels.ts. Duplicated (not imported) so worldforge
 *  never depends on the world3d/three.js layer; keep the two in lockstep. */
export const BLUEPRINT_STOREY_FT = 10;

/**
 * Shell height in meters for `storeys` above-grade floors. The single source
 * the 3D bridge sizes building shells to, so the rendered wall top matches the
 * feet-canon wall top the roof solver used (storeys × BLUEPRINT_STOREY_FT).
 */
export function buildingShellHeightM(storeys: number): number {
  return metersFromFeet(Math.max(1, storeys) * BLUEPRINT_STOREY_FT);
}

export interface GenerateBuildingInput {
  buildingId: number;
  type: BuildingType;
  seedPath: SeedPath;
  storeys?: number;
  basement?: boolean;
  /** Optional lot-fit caps (feet, 5 ft aligned expected). When the rolled
   *  footprint exceeds them it is clamped into the lot window (see
   *  clampFootprint) so the building never overhangs its plot (C3-T2). */
  maxWidthFt?: number;
  maxDepthFt?: number;
  /** Optional family the building is designed for. Drives ground-floor trade
   *  rooms + wealth extras and the bedroom distribution across floors. Omitted
   *  → the v1 (briefless) plan, byte-for-byte. */
  household?: HouseholdBrief;
  /** New farm prototype only; absent inputs retain the original recipe and memo key. */
  householdLayoutRecipe?: RuralFamilyLayoutRecipe;
  /** Town-authored row/courtyard/arcade instruction; geometry remains lot-bound. */
  ensemble?: BuildingEnsemble;
  /** Optional architectural style context (culture/climate/wealth/age). When
   *  present the plan gains a resolved dress (`styleResolved`) and a solved
   *  `roof`, then resolves permanent history from its age. Geometry below the
   *  wall-top remains untouched (style-identity invariant). */
  style?: StyleContext;
  /**
   * Optional replay/save override for an already-resolved permanent history.
   * Production normally omits it and receives a deterministic backstory from
   * the style age plus this building's canonical geometry.
   */
  backstory?: BuildingBackstory;
  /** Ordered save-side changes, either a legacy array or a compacted journal. */
  eventLog?: BuildingEventHistory | readonly BuildingEvent[];
}

// Bounded memo: identical inputs reproduce byte-for-byte, so regeneration is
// cheap; clearing on cap keeps long sessions from growing without bound.
const buildingMemo = new Map<string, BlueprintPlan>();
const BUILDING_MEMO_CAP = 50_000;
// Keyed by the canonical first trial, so repeated readers share the selected
// recipe result without repeating its bounded geometry search or retaining evicted plans.
const ruralFamilySelections=new WeakMap<BlueprintPlan,BlueprintPlan>();

/** Build one floor from its already-assigned room grid and rooms. Purpose
 *  assignment (including the household brief) happens in generateBuilding so
 *  the shared bedroom queue can be threaded floor by floor; buildFloor stays
 *  pure geometry → doors → walls → furnish. */
function buildFloor(
  floorPath: SeedPath,
  rg: number[][],
  rooms: BlueprintRoom[],
  level: number,
  blocked: Set<string>,
  ensemble?: BuildingEnsemble,
  ruralFamily=false,
): BlueprintFloor {
  // Only the ground floor opens onto the street; upper floors and basements
  // are reached by the stair shaft, never through an exterior door.
  const { doors } = wireDoors(floorPath, rg, rooms, { streetEntry: level === 0 });
  if(ruralFamily){
    if(level===0)wireRuralSharedBedrooms(rooms,doors);
    for(const door of doors)door.clearWidthFt=4;
  }
  const { walls, windows, wallRuns } = buildWalls(floorPath, rg, doors, rooms, {
    partyWallLeft: ensemble?.partyWallLeft ?? false,
    partyWallRight: ensemble?.partyWallRight ?? false,
  });
  const furnishings = furnishRooms(floorPath, rooms, doors, blocked);
  return {
    level,
    rooms,
    doors,
    // Basements are underground: no windows.
    windows: level < 0 ? [] : windows,
    furnishings,
    walls,
    wallRuns,
  };
}

/** Anchor cell of the ground floor's main room — reuses BlueprintRoom.anchor
 *  (the in-room cell closest to the centroid, computed in program.ts). */
function mainRoomCenterCell(rooms: BlueprintRoom[]): { cx: number; cy: number } {
  const main = rooms.find((r) => r.isMain) ?? rooms[0];
  return { cx: main.anchor.cx, cy: main.anchor.cy };
}

/** A workplace's retained compact flight must not fill a doorway. Prefer the
 * original shaft unless it blocks a door; then reserve one cell that leaves
 * every floor's room connected. This repairs entry circulation, not the
 * compact flight's still-unqualified climbing geometry. Residential plans and
 * admitted return stairs keep their existing placement. */
function workplaceFallbackStairCell(floors: BlueprintFloor[], original: {cx:number;cy:number}) {
  const doorCells = new Set(floors.flatMap(f => f.doors.flatMap(stairDoorCells)).map(c => cellKey(c.cx,c.cy)));
  if (!doorCells.has(cellKey(original.cx,original.cy))) return original;
  const ground = floors.find(f => f.level === 0)!;
  const candidates = ground.rooms.flatMap(r => r.cells.map(c => ({...c,main:r.isMain})))
    .sort((a,b) => Number(b.main)-Number(a.main)
      || Math.hypot(a.cx-original.cx,a.cy-original.cy)-Math.hypot(b.cx-original.cx,b.cy-original.cy)
      || a.cy-b.cy || a.cx-b.cx);
  for (const candidate of candidates) {
    const blockedKey = cellKey(candidate.cx,candidate.cy);
    if (doorCells.has(blockedKey)) continue;
    const fits = floors.every(f => {
      const room = f.rooms.find(r => r.cells.some(c => cellKey(c.cx,c.cy) === blockedKey));
      if (!room || room.cells.length < 2) return false;
      const free = new Set(room.cells.map(c => cellKey(c.cx,c.cy)));
      free.delete(blockedKey);
      const queue = [room.cells.find(c => free.has(cellKey(c.cx,c.cy)))!];
      free.delete(cellKey(queue[0].cx,queue[0].cy));
      for (let i=0;i<queue.length;i++) for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const next = {cx:queue[i].cx+dx,cy:queue[i].cy+dy};
        if (free.delete(cellKey(next.cx,next.cy))) queue.push(next);
      }
      return free.size === 0;
    });
    if (fits) return {cx:candidate.cx,cy:candidate.cy};
  }
  // Do not erase a floor, room or stair when no safe reservation exists.
  return original;
}

/** Stable digest of a household brief for the memo key: two briefs that would
 *  yield different plans MUST produce different digests. Empty string when
 *  there is no brief (so briefless memo keys are unchanged). Must cover every
 *  brief field (homeId, slots with tag/role/ageBand, trade, worksAtHome,
 *  wealth, residential) — homeId doesn't affect geometry but is echoed into
 *  the plan. Absent residential scope retains the original digest. */
export function briefDigest(brief: HouseholdBrief | undefined): string {
  if (!brief) return '';
  return JSON.stringify([
    brief.homeId,
    brief.slots.map((s) => [s.tag, s.role, s.ageBand]),
    brief.trade,
    brief.worksAtHome,
    brief.wealth,
    // Keep legacy keys exact, while separating explicitly scoped briefs.
    ...(brief.residential === undefined ? [] : [brief.residential]),
  ]);
}

/**
 * Stable digest of a style context for the memo key.
 *
 * Two contexts that resolve to different district or building dress must never
 * share a cached plan. The four original fields keep their historical JSON
 * shape when no architecture identity is present, so standalone preview memo
 * keys remain unchanged. Identified production buildings append all three
 * identity scopes because each can change the roof or facade answer.
 */
export function styleDigest(style: StyleContext | undefined): string {
  if (!style) return '';
  const originalFields = [style.cultureType, style.climate, style.wealth, style.ageBand];
  if (!style.architecture) return JSON.stringify(originalFields);
  return JSON.stringify([
    ...originalFields,
    [
      style.architecture.settlementKey,
      style.architecture.districtKey,
      style.architecture.buildingKey,
    ],
  ]);
}

/** Include every permanent history target in memo identity when one is replayed. */
export function backstoryDigest(backstory: BuildingBackstory | undefined): string {
  return backstory ? JSON.stringify(backstory) : '';
}

/** Include every ordered live event in memo identity without key-order drift. */
export function eventLogDigest(
  eventLog: BuildingEventHistory | readonly BuildingEvent[] | undefined,
): string {
  return buildingEventLogDigest(eventLog);
}

/** Include the town-authored block contract in memo identity. A party-wall
 * instruction changes legal openings even when the footprint itself is equal. */
export function ensembleDigest(ensemble: BuildingEnsemble | undefined): string {
  return ensemble ? JSON.stringify(ensemble) : '';
}

/** A room OWNS a window when the window's outer edge lies on the boundary of
 *  one of the room's cells. Windows carry an edge-midpoint (x,y) + axis; the
 *  interior cell flanking that edge is one of the room's cells. Used to find
 *  upper bedrooms that own NO window (dormer candidates for the roof solver). */
function roomOwnsWindow(room: BlueprintRoom, w: BlueprintWindow): boolean {
  const cells = room.cells;
  if (w.axis === 'y') {
    // Vertical wall on the x = w.x line; flanking cells share cy = floor(w.y/5).
    const cx = w.x / CELL_FT;
    const cy = Math.floor(w.y / CELL_FT);
    return cells.some((c) => c.cy === cy && (c.cx === cx || c.cx === cx - 1));
  }
  // axis 'x': horizontal wall on the y = w.y line; flanking cells share cx.
  const cy = w.y / CELL_FT;
  const cx = Math.floor(w.x / CELL_FT);
  return cells.some((c) => c.cx === cx && (c.cy === cy || c.cy === cy - 1));
}

export function generateBuilding(input: GenerateBuildingInput): BlueprintPlan {
  if(!input.householdLayoutRecipe)return generateBuildingCandidate(input);
  if(input.householdLayoutRecipe!==RURAL_FAMILY_LAYOUT_RECIPE||input.type!=='farmstead'||!input.household
    ||input.household.residential===false||input.maxWidthFt===undefined||input.maxDepthFt===undefined)
    throw new Error('Rural family layouts require explicit resident farm and lot sources.');
  // A bounded set of room proportions uses the same family and allocated land.
  // Prefer complete assigned sleeping capacity, then fewer private-through
  // routes. Any residual limitation remains measurable; this is not native admission.
  const first=generateBuildingCandidate(input,0),selected=ruralFamilySelections.get(first);
  if(selected)return selected;
  let best:BlueprintPlan|undefined,bestScore:number[]|undefined;
  for(let trial=0;trial<12;trial++){
    const candidate=trial===0?first:generateBuildingCandidate(input,trial);
    const score=[ruralFamilyMissingBeds(candidate),ruralFamilyPrivateAccessIssues(candidate).length,
      ruralFamilyMixedSleepingRooms(candidate),ruralFamilyStairDeficit(candidate),ruralFamilyMissingLivingBasics(candidate),
      ruralFamilyMissingSeats(candidate),ruralFamilyCirculationDeficit(candidate)];
    const difference=bestScore?score.findIndex((value,index)=>value!==bestScore![index]):-1;
    if(!bestScore||difference>=0&&score[difference]<bestScore[difference]){best=candidate;bestScore=score;}
    if(score.every(value=>value===0))break;
  }
  ruralFamilySelections.set(first,best!);
  return best!;
}

function generateBuildingCandidate(input: GenerateBuildingInput,trial=0): BlueprintPlan {
  const { buildingId, type, seedPath } = input;
  const storeys = Math.max(1, Math.floor(input.storeys ?? 1));
  const basement = input.basement === true;

  // A replayed backstory and its style must describe the same construction
  // age. Reject contradictory permanent data rather than silently choosing one.
  if (input.backstory && input.style
    && input.backstory.ageBand !== input.style.ageBand) {
    throw new Error(
      `generateBuilding: backstory age ${input.backstory.ageBand} conflicts ` +
      `with style age ${input.style.ageBand} for building ${buildingId}`,
    );
  }

  const ruralFamily=input.householdLayoutRecipe===RURAL_FAMILY_LAYOUT_RECIPE;
  // A modest small family shares a kitchen meal/work table. A second hall
  // table can consume its only seating bay beside the real stair. Larger
  // families retain both room tables; neither policy alters retained homes.
  const ruralFurnishing={...RURAL_FAMILY_FURNISHING,
    ...(input.household&&input.household.slots.length<=5?{sharedTableRoom:'kitchen' as const}:{})};
  const buildingPath = childSeedPath(seedPath, `building:${buildingId}`);
  const memoKey =
    `${buildingPath}|${type}|${storeys}|${basement}|${input.maxWidthFt ?? ''}|${input.maxDepthFt ?? ''}|${briefDigest(input.household)}|${ensembleDigest(input.ensemble)}|${styleDigest(input.style)}|${backstoryDigest(input.backstory)}|${eventLogDigest(input.eventLog)}${ruralFamily?'|rural-family-v1:'+trial:''}`;
  const cached = buildingMemo.get(memoKey);
  if (cached) return cached;

  // Brief program (RNG-free): extra ground slots, trade demands, bedroom list.
  const bp = input.household ? programForBrief(type, input.household) : undefined;

  // Current town receipts author directly against both snapped lot limits.
  // Legacy, preview, and undersized detached calls retain the original
  // roll-then-clamp path, including its frozen RNG draw order and golden output.
  const lotProfile = input.ensemble?.lotProfile;
  const hasCompleteLot = input.maxWidthFt !== undefined && input.maxDepthFt !== undefined;
  let fp = lotProfile && hasCompleteLot
    ? footprintForLotProfile(
        lotProfile,
        Math.floor(input.maxWidthFt! / CELL_FT),
        Math.floor(input.maxDepthFt! / CELL_FT),
      )
    : genFootprint(buildingPath, type);
  if (!lotProfile && (input.maxWidthFt !== undefined || input.maxDepthFt !== undefined)) {
    fp = clampFootprint(
      fp,
      input.maxWidthFt !== undefined ? Math.floor(input.maxWidthFt / CELL_FT) : fp.cols,
      input.maxDepthFt !== undefined ? Math.floor(input.maxDepthFt / CELL_FT) : fp.rows,
    );
  }
  // These new farms already have a complete rectangular envelope reserved.
  // Use that usable space before enlarging land or dropping family members.
  if(ruralFamily)fp=footprintForLotProfile('full-envelope',Math.floor(input.maxWidthFt!/CELL_FT),Math.floor(input.maxDepthFt!/CELL_FT));
  // Structural history changes the canonical footprint before any dependent
  // geometry is derived. Its stable origin preserves the old core's position
  // even when an extension enlarges only one side of the envelope.
  const structural = applyStructuralExtensions(fp, input.eventLog, {
    maxWidthFt: input.maxWidthFt,
    maxDepthFt: input.maxDepthFt,
  });
  fp = structural.footprint;

  // Ground floor first: the stair shaft anchors at its main room's center.
  // Every occupied footprint cell belongs to a room on every level (partition
  // covers the footprint), so the same shaft cell lands inside a room on the
  // basement and each upper floor too.
  const groundPath = childSeedPath(buildingPath, ruralFamily&&trial>0?'floor:0:rural-trial:'+trial:'floor:0');
  let groundRg = partition(groundPath, fp, {
    keepMainWhole: !ruralFamily,
    maxRooms: roomCapFor(type),
  });
  // Single-storey buildings house the whole family on the ground floor;
  // multi-storey buildings keep the ground for living/trade and queue the
  // bedrooms onto the upper floors. Mutated in place by assignPurposes.
  const groundQueue: BedroomAssignment[] =
    bp ? (storeys === 1 ? bp.bedrooms.map((b) => ({ ...b })) : []) : [];
  let groundRooms = assignPurposes(
    groundPath,
    type,
    groundRg,
    bp && {
      extraSlots: bp.groundExtra,
      tradeDemands: bp.tradeDemands,
      bedroomQueue: groundQueue,
    },
  );
  let customGroundApplied=false;
  if(ruralFamily){
    // Structural history can produce a nonrectangular envelope. Preserve that
    // source rather than replacing it with cells the lot never contained.
    const rectangular=fp.cells.length===fp.cols*fp.rows&&fp.cells.every(c=>c.cx>=0&&c.cx<fp.cols&&c.cy>=0&&c.cy<fp.rows);
    const custom=rectangular?planRuralFamilyGround(fp.cols,fp.rows,input.household!,trial>=3?4:3):undefined;
    if(custom){groundRg=custom.grid;groundRooms=custom.rooms;groundQueue.length=0;customGroundApplied=true;}
    else seatRuralSharedEntry(groundRooms);
  }
  const joins = storeys - 1 + (basement ? 1 : 0);
  let stairCell = joins > 0 ? mainRoomCenterCell(customGroundApplied
    ?groundRooms.map(room=>({...room,isMain:room.purpose==='hall'})):groundRooms) : null;
  const blocked = new Set<string>();
  if (stairCell) blocked.add(cellKey(stairCell.cx, stairCell.cy));

  const levels: number[] = [];
  if (basement) levels.push(-1);
  for (let level = 0; level < storeys; level++) levels.push(level);

  // Upper floors share ONE mutable bedroom queue, consumed floor by floor;
  // single-storey plans already emptied the family onto the ground floor, so
  // the shared queue only carries entries when storeys > 1.
  const upperQueue: BedroomAssignment[] =
    bp && storeys > 1 && !customGroundApplied ? bp.bedrooms.map((b) => ({ ...b })) : [];
  let floors: BlueprintFloor[] = levels.map((level) => {
    const floorPath = childSeedPath(buildingPath, `floor:${level}${ruralFamily&&trial>0?':rural-trial:'+trial:''}`);
    if (level === 0) {
      return buildFloor(floorPath, groundRg, groundRooms, level, blocked, input.ensemble,ruralFamily);
    }
    const rg = partition(floorPath, fp, {
      keepMainWhole: false,
      maxRooms: roomCapFor(type),
    });
    // Basements never hold bedrooms (empty queue → v1 cellar/storage rule);
    // upper floors draw from the shared family queue.
    const queue = level < 0 ? [] : upperQueue;
    const rooms = assignUpperPurposes(floorPath, type, rg, level, queue, input.household?.residential === false);
    return buildFloor(floorPath, rg, rooms, level, blocked, input.ensemble,ruralFamily);
  });

  // Misfit rule (families must be SEATED, never invented rooms): any bedrooms
  // the floor passes could not seat are stamped onto the ground floor — first
  // onto rooms already purposed as 'bedroom', and if none exist onto the MAIN
  // room (beds in the hall, the spec's crowded-claims answer). No room is
  // invented, no wall moves; every slot tag appears exactly once across the
  // building. Both queues can carry leftovers: the single-storey plan drains
  // groundQueue on the ground floor and may overflow it (a tiny footprint has
  // too few bedroom rooms); the multi-storey plan overflows upperQueue. Drain
  // both so single-storey buildings seat the whole family too.
  const leftover = [...groundQueue, ...upperQueue];
  if (leftover.length > 0) {
    const ground = floors.find((f) => f.level === 0)!;
    const bedroomRooms = ground.rooms.filter((r) => r.purpose === 'bedroom');
    const sinks = bedroomRooms.length > 0
      ? bedroomRooms
      : [ground.rooms.find((r) => r.isMain) ?? ground.rooms[0]];
    let sinkIdx = 0;
    for (const next of leftover) {
      const sink = sinks[Math.min(sinkIdx, sinks.length - 1)];
      // Append the tags — a crowded room can carry more than one family group.
      sink.forSlot = sink.forSlot
        ? `${sink.forSlot},${next.slotTags.join(',')}`
        : next.slotTags.join(',');
      sinkIdx++;
    }
  }

  // Furnish once the complete family assignment is known, including groups
  // sharing a ground-floor room. Bare previews retain the legacy layout.
  let returnLayout: BlueprintStair['layout'];
  if (input.household) {
    const servants = input.household.residential === false
      ? 0 : input.household.slots.filter(slot => slot.role === 'servant').length;
    // Keep town streaming bounded: admit the first qualified shaft and one
    // child-room repair. Unsupported homes retain their existing fitted plan;
    // a stair trial can never consume an assigned resident's sleeping place.
    const admitted = joins > 0
      ? planHouseholdReturnStair(fp.cells, floors, servants, { candidates: ruralFamily?3:1, merges: 1, ...(ruralFamily?{furnishing:ruralFurnishing,minimumDoorWidthFt:4}:{}) })
      : undefined;
    if (admitted) {
      returnLayout = admitted.layout;
      floors = admitted.floors;
      for (const floor of floors) {
        if(ruralFamily)for(const door of floor.doors)door.clearWidthFt=4;
        const grid = Array.from({ length: fp.rows }, () => Array<number>(fp.cols).fill(-1));
        for (const room of floor.rooms) for (const c of room.cells) grid[c.cy][c.cx] = room.id;
        const rebuilt = buildWalls(childSeedPath(buildingPath, `floor:${floor.level}`), grid, floor.doors, floor.rooms, {
          partyWallLeft: input.ensemble?.partyWallLeft ?? false,
          partyWallRight: input.ensemble?.partyWallRight ?? false,
        });
        floor.walls = rebuilt.walls;
        floor.wallRuns = rebuilt.wallRuns;
        floor.windows = floor.level < 0 ? [] : rebuilt.windows;
      }
    } else {
      if (stairCell && input.household.residential === false) {
        stairCell = workplaceFallbackStairCell(floors, stairCell);
        blocked.clear();
        blocked.add(cellKey(stairCell.cx,stairCell.cy));
      }
      furnishHouseholdBuilding(floors, blocked, servants, ruralFamily?ruralFurnishing:undefined);
    }
  }

  if(ruralFamily&&input.household){
    const seatedBlocks=returnLayout?new Set(returnLayout.shaftCells.map(c=>cellKey(c.cx,c.cy))):blocked;
    furnishHouseholdSeating(floors,seatedBlocks,input.household.slots.filter(s=>s.role==='servant').length,input.household.slots.length,ruralFurnishing);
  }

  const stairs: BlueprintStair[] = [];
  if (stairCell) {
    const { x, y } = returnLayout ? returnStairPoint(returnLayout, 2.5, 2.5)
      : { x: stairCell.cx * CELL_FT + CELL_FT / 2, y: stairCell.cy * CELL_FT + CELL_FT / 2 };
    for (const level of levels) {
      if (levels.includes(level + 1)) stairs.push({ fromLevel: level, x, y, ...(returnLayout ? { layout: returnLayout } : {}) });
    }
  }

  // Frontage (Task 9): record which plan side faces the street. The convention
  // is FIXED to min-y; the entry position is copied from the ground floor's
  // isEntry door (doors.ts biases that door onto the min-y street facade).
  const groundFloor = floors.find((f) => f.level === 0);
  const entryDoor = groundFloor?.doors.find((d) => d.isEntry);
  if (!entryDoor) {
    throw new Error(
      `generateBuilding: ground floor has no street entry for building ${buildingId}`,
    );
  }

  let result: BlueprintPlan = {
    buildingId,
    type,
    footprintCells: fp.cells,
    widthFt: fp.cols * CELL_FT,
    depthFt: fp.rows * CELL_FT,
    floors,
    stairs,
    frontage: { side: 'minY', entryX: entryDoor.x, entryY: entryDoor.y },
    // Echo the footprint's exact mass decomposition (main first) — the roof
    // solver keys off it (Phase 1B). Always set.
    masses: fp.masses,
  };
  if (structural.siteOriginFt) result.siteOriginFt = structural.siteOriginFt;
  // Echo the brief so consumers can read the family this plan was built for.
  if (input.household) result.household = input.household;
  // Preserve the town's block contract for map inspection and 3D ensemble trim.
  if (input.ensemble) result.ensemble = { ...input.ensemble };

  // ── Style dress + roof (Phase 1B Task 4) ────────────────────────────────────
  // Purely additive: resolveStyle/solveRoof never touch floors/footprint/stairs
  // (the style-identity invariant). resolveStyle draws off the SAME buildingPath
  // namespace's 'style' stream, independent of every geometry stream, so adding
  // a style leaves the bones byte-identical.
  if (input.style) {
    const styleResolved = resolveStyle(
      { ...input.style, buildingType: type, ensemble: input.ensemble },
      buildingPath,
    );
    result.styleResolved = styleResolved;
    result.style = input.style;

    // Every habitable hearth raises a stack through the roof; basements stay
    // excluded because the roof contract does not invent underground flues.
    // The solver merges vertically aligned or adjacent sources into one stack.
    const hearths = floors
      .filter((floor) => floor.level >= 0)
      .flatMap((floor) => floor.furnishings)
      .filter((fn) => fn.kind === 'hearth' || fn.kind === 'forge-hearth')
      .map((fn) => ({ x: fn.x, y: fn.y }));

    // Windowless upper bedrooms: on an UPPER floor (level >= 1), a bedroom /
    // guest-room that owns no window on its own floor. Anchor cell feeds the
    // dormer position. Ground-floor and single-storey plans have no upper
    // bedrooms, so this is empty for them.
    const windowlessUpperRooms: Cell[] = [];
    for (const floor of floors) {
      if (floor.level < 1) continue;
      for (const room of floor.rooms) {
        if (room.purpose !== 'bedroom' && room.purpose !== 'guest-room') continue;
        if (floor.windows.some((w) => roomOwnsWindow(room, w))) continue;
        windowlessUpperRooms.push(room.anchor);
      }
    }

    result.roof = solveRoof({
      masses: fp.masses,
      footprintCells: fp.cells,
      style: {
        roofForm: styleResolved.roofForm,
        pitchRiseFt: styleResolved.pitchRiseFt,
        eaveOverhangFt: styleResolved.eaveOverhangFt,
      },
      hearths,
      windowlessUpperRooms,
      // Ownerless receipts predate single-seam ownership and retain their old
      // eaves. Current row/arcade receipts clip attached roof sides to the lot
      // line so neighboring canonical meshes occupy disjoint plan areas.
      partyWallLeft: input.ensemble?.partyWallOwner
        ? input.ensemble.partyWallLeft
        : false,
      partyWallRight: input.ensemble?.partyWallOwner
        ? input.ensemble.partyWallRight
        : false,
      // Wall-top = number of built storeys × the storey height the 3D uses.
      wallTopFt: storeys * BLUEPRINT_STOREY_FT,
    });

    // Phase 3 history is permanent blueprint data, not living-household state.
    // Resolve only after walls, masses, and roof exist so every event points at
    // a real target. Repair materials reuse the exact wealth-restricted family
    // palettes that produced the district dress.
    const family = styleFamilyForCultureType(input.style.cultureType);
    result.backstory = input.backstory ?? resolveBuildingBackstory({
      ageBand: input.style.ageBand,
      buildingType: type,
      masses: fp.masses,
      floors,
      roof: result.roof,
      style: styleResolved,
      allowedWallColors: finishPaletteForTier(
        family.wallPalette,
        input.style.wealth,
      ),
      allowedRoofColors: finishPaletteForTier(
        family.roofPalette,
        input.style.wealth,
      ),
    }, streamPath(buildingPath, 'backstory'));
  }

  // Save replays may carry permanent history before a style renderer is
  // available. Preserve that data even though no history geometry can render
  // until a style context is supplied.
  if (!input.style && input.backstory) result.backstory = input.backstory;

  // Live history is a separate ordered layer over the immutable generated
  // plan. Empty/absent logs are a strict legacy no-op; non-empty logs return a
  // cloned plan whose renderer targets are derived by the pure replay fold.
  if (buildingHistoryEventCount(input.eventLog) > 0) {
    result = applyHistory(result, input.eventLog!);
  }

  if (buildingMemo.size >= BUILDING_MEMO_CAP) buildingMemo.clear();
  buildingMemo.set(memoKey, result);
  return result;
}
