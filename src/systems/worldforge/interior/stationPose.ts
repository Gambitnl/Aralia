/**
 * @file stationPose.ts
 * NPC lives (GG-598, 2026-11-03): what a person at a station does with their body.
 *
 * Before this module every indoor body stood upright at every station: nobody
 * sat at the supper table, lay in a bed or bent over an anvil. A station
 * already names its activity (`occupancy.ts`) and, when there is one, the
 * furniture piece it belongs to (`furnishingIndex`). This module reads both and
 * names a pose, the piece the body uses, and where that piece is:
 *
 *   - sleeping: `sleep`, on the station's bed; a sleeper past the room's bed
 *     count (a couple in one bed, children together) shares the nearest bed in
 *     the room; on the floor only where the room has no bed;
 *   - meal: `sit`, on the nearest chair or bench by the table, facing the table;
 *   - hearthside and visiting: `sit` when a chair or bench is in reach, else `stand`;
 *   - work: `work-at` an anvil, forge hearth or workbench; `sit` at a desk or
 *     loom; `stand` behind a counter or at an altar;
 *   - chores: `work-at` a barrel, shelf, chest or table in reach, else `stand`.
 *
 * Pure data: no renderer, no random draws. The same plan and station always
 * give the same pose. The 3D near bodies (`InteriorOccupants`) read the pose
 * from the baked station; the clip names come from `POSE_CLIPS`.
 *
 * What is preserved: the standing position and every station field. A pose
 * only adds facts; a body with no pose renderer still stands where it stood.
 * Deferred: the clip playback and the body placement on the piece (3D side).
 */

import type { BlueprintFloor, BlueprintFurnishing, BlueprintPlan } from './blueprintTypes';
import type { OccupantStation } from './occupancy';

export type StationPose = 'stand' | 'sit' | 'sleep' | 'work-at';

/** The CC0 clip each pose plays (entity generator clip packs). `Sleeping` is in
 * the addon pack; the others are in the base human pack. */
export const POSE_CLIPS: Readonly<Record<StationPose, string>> = {
  stand: 'Idle',
  sit: 'Sitting_Idle',
  sleep: 'Sleeping',
  'work-at': 'Fixing_Kneeling',
};

export interface StationPoseInfo {
  pose: StationPose;
  /** The piece the body uses: lies on, sits on, or works at. */
  use?: { kind: string; xFt: number; yFt: number; rotation: BlueprintFurnishing['rotation'] };
  /** The point the body faces: the table at a meal, the hearth, the anvil. */
  faceFt?: { xFt: number; yFt: number };
}

const BED_KINDS = new Set(['bed']);
const SEAT_KINDS = new Set(['chair', 'bench']);
const SEAT_REACH_FT = 5;
const WORK_AT_KINDS = new Set(['anvil', 'forge-hearth', 'workbench']);
const SIT_WORK_KINDS = new Set(['desk', 'loom']);
const CHORE_KINDS = new Set(['barrel', 'shelf', 'chest', 'table']);
const CHORE_REACH_FT = 4;

const use = (f: BlueprintFurnishing): NonNullable<StationPoseInfo['use']> => ({ kind: f.kind, xFt: f.x, yFt: f.y, rotation: f.rotation });
const at = (f: BlueprintFurnishing) => ({ xFt: f.x, yFt: f.y });

/** The nearest piece of these kinds in the station's room within reach of the
 * point. Ties break on the lower furnishing index. */
function nearestPiece(floor: BlueprintFloor, roomId: number | undefined, point: { xFt: number; yFt: number }, kinds: ReadonlySet<string>, reachFt: number): BlueprintFurnishing | undefined {
  let best: BlueprintFurnishing | undefined, bestD = Infinity;
  for (const piece of floor.furnishings) {
    if (!kinds.has(piece.kind) || (roomId !== undefined && piece.roomId !== roomId)) continue;
    const d = Math.hypot(piece.x - point.xFt, piece.y - point.yFt);
    if (d <= reachFt && d < bestD) { best = piece; bestD = d; }
  }
  return best;
}

/** The station room's anchor cell center (5 ft cells), as `stationToFeet` uses. */
function roomCenter(floor: BlueprintFloor, roomId: number | undefined): { xFt: number; yFt: number } {
  const room = floor.rooms.find((r) => r.id === roomId);
  return room ? { xFt: (room.anchor.cx + 0.5) * 5, yFt: (room.anchor.cy + 0.5) * 5 } : { xFt: 0, yFt: 0 };
}

/** Name the pose for one station. An OUT station has no pose (undefined). */
export function stationPose(plan: BlueprintPlan, station: OccupantStation): StationPoseInfo | undefined {
  if (station.where !== 'home' || station.level === undefined) return undefined;
  const floor = plan.floors.find((f) => f.level === station.level);
  if (!floor) return undefined;
  const piece = station.furnishingIndex !== undefined ? floor.furnishings[station.furnishingIndex] : undefined;
  const standing = station.standingPosition ?? (piece ? at(piece) : undefined);
  const seatNear = (point: { xFt: number; yFt: number } | undefined) =>
    point ? nearestPiece(floor, station.roomId, point, SEAT_KINDS, SEAT_REACH_FT) : undefined;

  switch (station.activity) {
    case 'sleeping': {
      if (piece?.kind === 'bed') return { pose: 'sleep', use: use(piece) };
      // `occupancy.bedStationForMember` hands out a room's beds in member
      // order, so the second of a couple gets no bed index. They share one.
      const shared = nearestPiece(floor, station.roomId, standing ?? roomCenter(floor, station.roomId), BED_KINDS, Infinity);
      return shared ? { pose: 'sleep', use: use(shared) } : { pose: 'sleep' };
    }
    case 'meal': {
      const seat = seatNear(standing);
      return { pose: 'sit', ...(seat ? { use: use(seat) } : {}), ...(piece ? { faceFt: at(piece) } : {}) };
    }
    case 'hearthside':
    case 'visiting': {
      const seat = seatNear(standing);
      const face = piece ? { faceFt: at(piece) } : {};
      return seat ? { pose: 'sit', use: use(seat), ...face } : { pose: 'stand', ...face };
    }
    case 'work':
      if (piece && WORK_AT_KINDS.has(piece.kind)) return { pose: 'work-at', use: use(piece), faceFt: at(piece) };
      if (piece && SIT_WORK_KINDS.has(piece.kind)) return { pose: 'sit', use: use(piece), faceFt: at(piece) };
      return piece ? { pose: 'stand', faceFt: at(piece) } : { pose: 'stand' };
    case 'chores': {
      const chore = piece && CHORE_KINDS.has(piece.kind) ? piece
        : standing ? nearestPiece(floor, station.roomId, standing, CHORE_KINDS, CHORE_REACH_FT) : undefined;
      return chore ? { pose: 'work-at', use: use(chore), faceFt: at(chore) } : { pose: 'stand' };
    }
    default:
      return { pose: 'stand' };
  }
}
