/**
 * @file buildingSceneModel.ts
 * @description Pure blueprint → render-ready 3D scene model for the design
 * preview's blueprint viewer (PreviewBuilding3D).
 *
 * Takes the SAME BlueprintPlan the 2D drawer renders and resolves everything
 * the R3F component needs into plain data: the MeshBox list from
 * `buildBuildingMeshData` filtered by FLOOR PEEL (show basement..selected,
 * open-topped), colors + emissive resolved per box kind and hour (window
 * panes glow 17–23h when the building is occupied; hearth furnishings glow
 * when `occupancy.flags.hearthLitHours[hour]`), plus one occupant dot per
 * at-home household member at the given hour (furnishing position when the
 * station stands at a piece, else the room's anchor cell).
 *
 * Pure + deterministic — no three.js, unit-tested in
 * __tests__/buildingSceneModel.test.ts. The R3F consumer maps plan feet
 * (x, y, z0/h) onto three space as (x, z, y) and renders in feet.
 */

import type { BlueprintPlan } from '../worldforge/interior/blueprintTypes';
import type { BuildingOccupancy, OccupantStation } from '../worldforge/interior/occupancy';
import { HEARTH_KINDS } from '../worldforge/interior/occupancy';
import { buildBuildingMeshData, buildRoofMeshData, type MeshBoxKind } from './buildingModels';

/** 'all' = every floor closed; a level = show basement..level, open-topped. */
export type PeelLevel = number | 'all';

export type SceneBoxKind = MeshBoxKind | 'hearth';

/** The solved roof as a triangle group, PLAN FEET (x/y footprint, Y up = z0).
 *  Present only when plan.roof exists and the model is NOT peeled (roof shows in
 *  the viewer's "All" mode; floor-peel hides it). BGv2 Task 5. The R3F consumer
 *  maps positions [x, Y, z] straight into three space (Y already includes the
 *  wall top). */
export interface SceneRoof {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  color: string;
}

/** One renderable box, PLAN FEET (x/y footprint center, z0/h vertical). */
export interface SceneBox {
  kind: SceneBoxKind;
  /** Plan level the box belongs to (-1 basement, 0 ground, 1+ upper). */
  level: number;
  x: number; y: number;
  w: number; d: number;
  z0: number; h: number;
  color: string;
  /** Set only when the box should glow (lit window pane / lit hearth). */
  emissive?: string;
  emissiveIntensity?: number;
}

/** One at-home household member at the model's hour. */
export interface OccupantDot {
  memberIndex: number;
  level: number;
  activity: OccupantStation['activity'];
  /** Plan feet. */
  x: number; y: number;
  /** Dot CENTER elevation, feet ( = level * storey + 2.5). */
  zFt: number;
  color: string;
}

export interface BuildingSceneModel {
  widthFt: number;
  depthFt: number;
  storeyHeightFt: number;
  /** True when window panes glow at this hour ( = occupied ∧ hour ∈ 17–23). */
  windowsLit: boolean;
  boxes: SceneBox[];
  dots: OccupantDot[];
  /** Solved roof (planes + tower caps), shown in "All" mode; hidden when peeled
   *  so the interior is visible. Undefined when the plan carries no roof. */
  roof?: SceneRoof;
}

export interface BuildingSceneOptions {
  upToLevel: PeelLevel;
  /** 0–23. */
  hour: number;
  /** The page's matched occupancy for the plan; omit for a bare building. */
  occupancy?: BuildingOccupancy;
}

/** Occupant dot radius, feet (shared with the R3F consumer). */
export const DOT_RADIUS_FT = 0.9;
/** Dot CENTER height above the floor slab, feet — above furniture masses
 *  (hearth boxes are 3 ft tall) so a dot at a furnishing stays visible. */
export const DOT_LIFT_FT = 3.6;
/** Ring radius for spreading dots that share one station, feet. */
const DOT_RING_FT = 1.6;
const CELL_FT = 5;

/** Structure palette — warm gray-brown masonry, dark slabs, distinct stairs. */
const BOX_COLOR: Record<SceneBoxKind, string> = {
  wall: '#8a7663',
  jamb: '#7c6a58',
  'door-lintel': '#7c6a58',
  sill: '#8a7663',
  'window-head': '#8a7663',
  'window-pane': '#cfdde6',
  floor: '#41392f',
  ceiling: '#5c5347',
  stair: '#a5713f',
  hearth: '#5a4636',
  // Roof dressing (Task 5) — colors are normally overridden per box from the
  // resolved trim/roof tint; these are the bare-plan fallbacks.
  chimney: '#7c6a58',
  dormer: '#8a7663',
};

const WINDOW_GLOW = '#ffc46b';
const HEARTH_GLOW = '#ff8c3b';

/** Activity → dot color (matches the 2D overlay's reading: cool sleep, warm
 *  hearth, amber meals, red work, green chores). */
const ACTIVITY_COLOR: Record<OccupantStation['activity'], string> = {
  sleeping: '#7aa5ff',
  meal: '#ffd166',
  work: '#ff6b6b',
  hearthside: '#ff9d5c',
  chores: '#9ef07a',
  out: '#9aa0a6',
};

/** Build the render-ready scene model. Pure + deterministic. */
export function buildingSceneModel(
  plan: BlueprintPlan,
  opts: BuildingSceneOptions,
): BuildingSceneModel {
  const { upToLevel, hour, occupancy } = opts;
  const mesh = buildBuildingMeshData(plan);
  const storeyFt = mesh.storeyHeightFt;

  const visible = (level: number): boolean =>
    upToLevel === 'all' || level <= upToLevel;
  const topVisible = upToLevel === 'all'
    ? Math.max(...plan.floors.map((f) => f.level))
    : Math.max(...plan.floors.map((f) => f.level).filter((lv) => visible(lv)));
  const peeled = upToLevel !== 'all';

  const occupied = occupancy !== undefined && !occupancy.flags.abandoned;
  const windowsLit = occupied && hour >= 17 && hour <= 23;
  const hearthLit = occupied && occupancy!.flags.hearthLitHours[hour] === true;

  const boxes: SceneBox[] = [];

  for (const floor of mesh.floors) {
    if (!visible(floor.level)) continue;
    for (const b of floor.boxes) {
      // Open the selected floor: drop its ceiling lid when peeling. (Higher
      // floors' slabs — the usual lids — are already gone with their floors.)
      if (peeled && b.kind === 'ceiling' && floor.level === topVisible) continue;
      const box: SceneBox = {
        kind: b.kind, level: floor.level,
        x: b.x, y: b.y, w: b.w, d: b.d, z0: b.z0, h: b.h,
        color: BOX_COLOR[b.kind],
      };
      if (b.kind === 'window-pane' && windowsLit) {
        box.emissive = WINDOW_GLOW;
        box.emissiveIntensity = 0.9;
      }
      boxes.push(box);
    }
  }

  // Hearth furnishings as glowable masses (mesh data carries structure only).
  for (const floor of plan.floors) {
    if (!visible(floor.level)) continue;
    for (const f of floor.furnishings) {
      if (!HEARTH_KINDS.has(f.kind)) continue;
      const box: SceneBox = {
        kind: 'hearth', level: floor.level,
        x: f.x, y: f.y, w: 2.5, d: 2.5,
        z0: floor.level * storeyFt, h: 3,
        color: BOX_COLOR.hearth,
      };
      if (hearthLit) {
        box.emissive = HEARTH_GLOW;
        box.emissiveIntensity = 1.2;
      }
      boxes.push(box);
    }
  }

  // Occupant dots — one per at-home member on a visible floor. Members that
  // share one station (a family ringed around the hearth) are spread on a
  // small deterministic circle so five people don't collapse into one sphere
  // buried inside the furnishing's box.
  const dots: OccupantDot[] = [];
  if (occupancy) {
    const staged: { st: OccupantStation; level: number; x: number; y: number }[] = [];
    for (const st of occupancy.stationsByHour[hour] ?? []) {
      if (st.where !== 'home') continue;
      const level = st.level ?? 0;
      if (!visible(level)) continue;
      const floor = plan.floors.find((f) => f.level === level);
      if (!floor) continue;
      let x: number | undefined;
      let y: number | undefined;
      if (st.furnishingIndex !== undefined && floor.furnishings[st.furnishingIndex]) {
        const piece = floor.furnishings[st.furnishingIndex];
        x = piece.x; y = piece.y;
      } else if (st.roomId !== undefined) {
        const room = floor.rooms.find((r) => r.id === st.roomId);
        if (room) {
          x = room.anchor.cx * CELL_FT + CELL_FT / 2;
          y = room.anchor.cy * CELL_FT + CELL_FT / 2;
        }
      }
      if (x === undefined || y === undefined) continue;
      staged.push({ st, level, x, y });
    }
    const clampX = (v: number) => Math.min(Math.max(v, 0.5), plan.widthFt - 0.5);
    const clampY = (v: number) => Math.min(Math.max(v, 0.5), plan.depthFt - 0.5);
    const byStation = new Map<string, typeof staged>();
    for (const s of staged) {
      const key = `${s.level}:${s.x}:${s.y}`;
      const group = byStation.get(key) ?? [];
      group.push(s);
      byStation.set(key, group);
    }
    for (const group of byStation.values()) {
      group.forEach((s, i) => {
        const spread = group.length > 1;
        const angle = (2 * Math.PI * i) / group.length;
        dots.push({
          memberIndex: s.st.memberIndex, level: s.level, activity: s.st.activity,
          x: clampX(s.x + (spread ? Math.cos(angle) * DOT_RING_FT : 0)),
          y: clampY(s.y + (spread ? Math.sin(angle) * DOT_RING_FT : 0)),
          zFt: s.level * storeyFt + DOT_LIFT_FT,
          color: ACTIVITY_COLOR[s.st.activity],
        });
      });
    }
  }

  // ── Solved roof (BGv2 Task 5): only in "All" mode — peeling hides the roof
  // so the open-topped interior stays visible. Chimney/dormer masses ride as
  // boxes; the planes + tower caps are the SceneRoof triangle group. ──
  let roof: SceneRoof | undefined;
  if (plan.roof && !peeled) {
    const aboveGrade = plan.floors.filter((f) => f.level >= 0).length;
    const rm = buildRoofMeshData(plan.roof, aboveGrade * storeyFt);
    roof = {
      positions: rm.tris.positions,
      indices: rm.tris.indices,
      normals: rm.tris.normals,
      color: plan.styleResolved?.roofColor ?? BOX_COLOR.wall,
    };
    const roofTint = plan.styleResolved?.roofColor ?? BOX_COLOR.wall;
    const trimTint = plan.styleResolved?.trimColor ?? BOX_COLOR.wall;
    for (const c of rm.chimneyBoxes) {
      boxes.push({
        kind: 'chimney', level: topVisible,
        x: c.x, y: c.y, w: c.w, d: c.d, z0: c.z0, h: c.h, color: trimTint,
      });
    }
    for (const dm of rm.dormerBoxes) {
      boxes.push({
        kind: 'dormer', level: topVisible,
        x: dm.x, y: dm.y, w: dm.w, d: dm.d, z0: dm.z0, h: dm.h, color: roofTint,
      });
    }
  }

  return {
    widthFt: plan.widthFt,
    depthFt: plan.depthFt,
    storeyHeightFt: storeyFt,
    windowsLit,
    boxes,
    dots,
    ...(roof ? { roof } : {}),
  };
}
