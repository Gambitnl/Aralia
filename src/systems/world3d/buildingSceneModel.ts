// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 19:01:15
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, components/DesignPreview/steps/PreviewBuilding3D.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

/**
 * ARCHITECTURAL COMMENTARY:
 * WHAT CHANGED: Added support for rendering resolved architectural identity dressing
 * (materials, facade trim, motifs, weathering, and permanent history) in the lab's 3D pane.
 * Overrode outer wall box colors with styleResolved.wallColor.
 * WHY: The Building Identity Lab must render the actual production 3D parts to honestly
 * prove the procedural generation layer instead of rendering a flat tan box mockup.
 * WHAT WAS PRESERVED: Legacy plans without styleResolved remain a strict no-op, preserving
 * the original v1 colors and layout. Structural geometry remains completely untouched, as pinned
 * by invariants tests. Floor peel, window lighting, and hearth glowing schedules remain fully intact.
 * WHAT REMAINS DEFERRED: The 2D vs 3D climate parity roof seam, town-map selection behavior,
 * and streamed production ground pipeline details remain deferred to separate repair/feature lanes.
 */

import type { BlueprintPlan } from '../worldforge/interior/blueprintTypes';
import type { BuildingOccupancy, OccupantStation } from '../worldforge/interior/occupancy';
import { HEARTH_KINDS } from '../worldforge/interior/occupancy';
import {
  buildBuildingMeshData,
  buildRoofMeshData,
  roofDeformationForPlan,
  type MeshBoxKind,
} from './buildingModels';
import {
  buildBlueprintParts,
  MATERIAL_PART_TAG,
  FACADE_PART_TAG,
  MOTIF_PART_TAG,
  WEATHERING_PART_TAG,
  HISTORY_PART_TAG,
} from '../worldforge/bridge/interiorParts';

/** 'all' = every floor closed; a level = show basement..level, open-topped. */
export type PeelLevel = number | 'all';

export type SceneBoxKind = MeshBoxKind
  | 'hearth'
  | 'history-scorch'
  | 'history-board'
  | 'history-phase'
  | 'history-roof-hole'
  | 'history-ruin-sag'
  | 'construction-material'
  | 'facade-trim'
  | 'motif'
  | 'weathering'
  | 'permanent-history';

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
  'history-scorch': '#2d1e19',
  'history-board': '#674a31',
  'history-phase': '#75613f',
  'history-roof-hole': '#171311',
  'history-ruin-sag': '#3b2922',
  'construction-material': '#8a7663',
  'facade-trim': '#7c6a58',
  motif: '#8a7663',
  weathering: '#8a7663',
  'permanent-history': '#8a7663',
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

  const buildingInUse = plan.liveHistory?.status === undefined
    || plan.liveHistory.status === 'occupied';
  const occupied = buildingInUse
    && occupancy !== undefined
    && !occupancy.flags.abandoned;
  const windowsLit = occupied && hour >= 17 && hour <= 23;
  const hearthLit = occupied && occupancy!.flags.hearthLitHours[hour] === true;

  const boxes: SceneBox[] = [];

  for (const floor of mesh.floors) {
    if (!visible(floor.level)) continue;
    for (const b of floor.boxes) {
      // Open the selected floor: drop its ceiling lid when peeling. (Higher
      // floors' slabs — the usual lids — are already gone with their floors.)
      if (peeled && b.kind === 'ceiling' && floor.level === topVisible) continue;
      const wallColor = plan.styleResolved?.wallColor ?? BOX_COLOR.wall;
      const box: SceneBox = {
        kind: b.kind, level: floor.level,
        x: b.x, y: b.y, w: b.w, d: b.d, z0: b.z0, h: b.h,
        color: b.kind === 'wall' ? wallColor : BOX_COLOR[b.kind],
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

  // Chronological history is already resolved to exact blueprint targets.
  // These additive boxes make the design preview read the same condition as
  // the production SitePart bridge without changing structural mesh data.
  for (const feature of plan.liveHistory?.features ?? []) {
    if (feature.kind === 'scorched-room') {
      if (!visible(feature.floorLevel)) continue;
      const floor = plan.floors.find((candidate) =>
        candidate.level === feature.floorLevel);
      const room = floor?.rooms.find((candidate) => candidate.id === feature.roomId);
      if (!room) throw new Error(`buildingSceneModel: missing scorched room ${feature.roomId}`);
      for (const cell of room.cells) {
        boxes.push({
          kind: 'history-scorch',
          level: feature.floorLevel,
          x: cell.cx * CELL_FT + CELL_FT / 2,
          y: cell.cy * CELL_FT + CELL_FT / 2,
          w: CELL_FT - 0.25,
          d: CELL_FT - 0.25,
          z0: feature.floorLevel * storeyFt + 0.04,
          h: 0.08 + feature.intensity * 0.03,
          color: BOX_COLOR['history-scorch'],
        });
      }
      continue;
    }
    if (feature.kind === 'boarded-window') {
      if (!visible(feature.floorLevel)) continue;
      const floor = plan.floors.find((candidate) =>
        candidate.level === feature.floorLevel);
      const window = floor?.windows[feature.windowIndex];
      if (!window) throw new Error(`buildingSceneModel: missing boarded window ${feature.windowIndex}`);
      const run = floor!.wallRuns.find((candidate) => {
        if (candidate.kind !== 'outer' || candidate.axis !== window.axis) return false;
        const fixed = candidate.axis === 'x' ? candidate.y1 : candidate.x1;
        const windowFixed = window.axis === 'x' ? window.y : window.x;
        const along = window.axis === 'x' ? window.x : window.y;
        const lo = candidate.axis === 'x'
          ? Math.min(candidate.x1, candidate.x2)
          : Math.min(candidate.y1, candidate.y2);
        const hi = candidate.axis === 'x'
          ? Math.max(candidate.x1, candidate.x2)
          : Math.max(candidate.y1, candidate.y2);
        return Math.abs(fixed - windowFixed) < 1e-6 && along >= lo && along <= hi;
      });
      if (!run) throw new Error(`buildingSceneModel: missing wall for boarded window ${feature.windowIndex}`);
      const outwardFt = run.thicknessFt / 2 + 0.18;
      for (let board = 0; board < 3; board++) {
        boxes.push({
          kind: 'history-board',
          level: feature.floorLevel,
          x: window.x + run.nx * outwardFt,
          y: window.y + run.ny * outwardFt,
          w: window.axis === 'x' ? 3.8 : 0.28,
          d: window.axis === 'y' ? 3.8 : 0.28,
          z0: feature.floorLevel * storeyFt + 2.9 + board * 1.25,
          h: 0.45,
          color: plan.styleResolved?.trimColor ?? BOX_COLOR['history-board'],
        });
      }
      continue;
    }
    if (feature.kind === 'extension-phase') {
      if (!visible(0)) continue;
      const mass = plan.masses[feature.massIndex];
      if (!mass) throw new Error(`buildingSceneModel: missing extension mass ${feature.massIndex}`);
      const x0 = mass.x * CELL_FT;
      const y0 = mass.y * CELL_FT;
      const width = mass.w * CELL_FT;
      const depth = mass.h * CELL_FT;
      const seam = 0.24;
      boxes.push(
        { kind: 'history-phase', level: 0, x: x0 + width / 2, y: y0, w: width, d: seam, z0: 0, h: 0.55, color: feature.colorHex },
        { kind: 'history-phase', level: 0, x: x0 + width / 2, y: y0 + depth, w: width, d: seam, z0: 0, h: 0.55, color: feature.colorHex },
        { kind: 'history-phase', level: 0, x: x0, y: y0 + depth / 2, w: seam, d: depth, z0: 0, h: 0.55, color: feature.colorHex },
        { kind: 'history-phase', level: 0, x: x0 + width, y: y0 + depth / 2, w: seam, d: depth, z0: 0, h: 0.55, color: feature.colorHex },
      );
    }
  }

  // Additive architectural dressing parts (BGv2 Phase 1B / Selected identity).
  // Sourced directly from the production site part bridge to ensure rendering parity.
  if (plan.styleResolved) {
    const FT = 0.3048;
    const storeyHeightM = storeyFt * FT;
    const perimeterColor = plan.styleResolved.wallColor;
    const blueprintParts = buildBlueprintParts(plan, storeyHeightM, perimeterColor, windowsLit);
    const basementLevel = Math.min(...plan.floors.map((f) => f.level));

    for (const part of blueprintParts.parts) {
      // Dressing parts carry a tag. Structural parts from buildBlueprintParts
      // do not, so we skip them to avoid duplicating wall/floor boxes.
      if (!part.tag) continue;

      let kind: SceneBoxKind | undefined;
      if (part.tag === MATERIAL_PART_TAG) {
        kind = 'construction-material';
      } else if (part.tag === FACADE_PART_TAG) {
        kind = 'facade-trim';
      } else if (part.tag === MOTIF_PART_TAG) {
        kind = 'motif';
      } else if (part.tag === WEATHERING_PART_TAG) {
        kind = 'weathering';
      } else if (part.tag === HISTORY_PART_TAG) {
        kind = 'permanent-history';
      }

      if (!kind) continue;

      // Extract the level of this part based on its vertical position.
      const partBaseYFt = part.baseY ? part.baseY / FT : 0;
      const partLevel = Math.max(
        basementLevel,
        Math.min(topVisible, Math.floor(partBaseYFt / storeyFt))
      );

      // Verify that this part is on a visible floor during floor-peel.
      if (!visible(partLevel)) continue;

      // Map meters back to plan feet, offset by the stable origin.
      const origin = plan.siteOriginFt ?? { x: plan.widthFt / 2, y: plan.depthFt / 2 };
      const x = part.x / FT + origin.x;
      const y = part.z / FT + origin.y;
      const w = part.w / FT;
      const d = part.d / FT;
      const z0 = partBaseYFt;
      const h = part.h / FT;

      const box: SceneBox = {
        kind,
        level: partLevel,
        x,
        y,
        w,
        d,
        z0,
        h,
        color: part.colorHex,
      };

      if (part.emissiveHex) {
        box.emissive = part.emissiveHex;
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
  if (occupancy && buildingInUse) {
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
    const rm = buildRoofMeshData(
      plan.roof,
      aboveGrade * storeyFt,
      roofDeformationForPlan(plan),
    );
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
