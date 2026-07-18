// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 21:20:15
 * Dependents: systems/worldforge/bridge/interiorParts.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns a resolved construction kit into visible exterior 3D detail.
 *
 * The building generator already owns permanent walls, windows, and roof
 * geometry. This bridge adds shallow material evidence outside that structure:
 * foundations, masonry or board courses, open shutters, roof-edge profiles, and
 * ornament. Every part follows real wall runs and window targets, remains tagged
 * as presentation detail, and never changes the canonical interior plan.
 *
 * Called by: interiorParts.ts
 * Depends on: BlueprintPlan construction data and canonical outer-wall runs
 */

import type {
  BlueprintFloor,
  BlueprintPlan,
  BlueprintWindow,
  BuildingConstruction,
  GlazingType,
  WallRun,
} from '../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../interior/blueprintTypes';
import { isVisibleExteriorRun } from './buildingPartyWalls';

// ============================================================================
// Public Render Contract
// ============================================================================
// The broad SitePart interface lives in interiorParts. This local structural
// subset avoids a runtime cycle while preserving semantic inspection tags.
// ============================================================================

export const MATERIAL_PART_TAG = 'building-material';

export type MaterialDetailKind =
  | 'foundation'
  | 'wall-course'
  | 'shutter-panel'
  | 'shutter-slat'
  | 'roof-edge'
  | 'ornament';

export interface BuildingMaterialPart {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  colorHex: string;
  baseY?: number;
  tag: typeof MATERIAL_PART_TAG;
  materialDetailKind: MaterialDetailKind;
}

const FT = 0.3048;
// Streamed-town readability (town-look-slice1, 2026-07-18): raised from 0.065 m.
// At street distance the old 6.5 cm projection rendered courses as sub-pixel
// dotted noise (proof: .agent/scratch/town-look-slice1/before-street2.png).
// 9 cm keeps the dressing shallow — well inside the eave clearance and door
// reveals — while surviving one pixel at ~25 m.
const DETAIL_DEPTH_M = 0.09;
const WINDOW_HALF_FT = 1.5;
const WINDOW_MARGIN_FT = 0.2;
const WINDOW_SILL_FT = 3;
const WINDOW_HEAD_FT = 6.5;
// Six visible rows are enough to distinguish brick, stone, boards, and logs at
// town scale while keeping a tall, window-rich building below the dressing cap.
const MAX_COURSES_PER_STOREY = 6;

// ============================================================================
// Dressing Contrast Tone
// ============================================================================
// Every family's `trimColor` is its rampart tint (`fam.wallTint`), which sits
// within a few luma points of the same family's wall palette — highland stone
// walls are #8d8a83 while its trim is #8a877f. Painted with that raw tone, the
// courses/shutters/foundations this module builds were invisible against the
// wall they dress (streamed-town critique 2026-07-17, finding 2). The helpers
// below derive a RENDER tone for wall-mounted dressing: the family trim hue,
// pushed away from the actual resolved wall color until a bounded minimum
// lightness separation holds. Pure hex→hex derivation — no RNG, no change to
// StyleResolved receipts, signatures, or which kit/motif was chosen.
// ============================================================================

/** sRGB luma (0..1) — the perceptual-lightness proxy the contrast rule uses. */
function hexLuma01(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (
    (0.2126 * ((v >> 16) & 255)) / 255
    + (0.7152 * ((v >> 8) & 255)) / 255
    + (0.0722 * (v & 255)) / 255
  );
}

/**
 * Minimum luma separation between wall-mounted dressing and its wall. 0.22 is
 * enough to read a 10 cm course at street distance under the warm sun key
 * without turning trim into black-on-white graphics.
 */
const TRIM_MIN_LUMA_DELTA = 0.22;
/** Trim already leaning at least this far keeps its own direction. */
const TRIM_LEAN_RESPECT = 0.1;

/**
 * Derive the render tone for wall-mounted dressing from the resolved palette.
 *
 * - A trim already separated by >= TRIM_MIN_LUMA_DELTA is returned unchanged.
 * - A trim with a clear lean (>= TRIM_LEAN_RESPECT toward light or dark) is
 *   pushed FURTHER in its own direction to exactly the minimum separation, so
 *   a family that chose "lighter than walls" stays lighter.
 * - Near-tied trims pick the direction with headroom: dark walls (luma < 0.45)
 *   take lighter dressing (log chinking, limewash bands); light walls take
 *   darker dressing (half-timber beams, dressed-stone courses).
 *
 * Hue is preserved: darkening scales toward black, lightening lerps toward
 * white, so each family's trim stays recognizably its own material.
 */
export function dressingContrastTone(trimHex: string, wallHex: string): string {
  const trimLuma = hexLuma01(trimHex);
  const wallLuma = hexLuma01(wallHex);
  const delta = trimLuma - wallLuma;
  if (Math.abs(delta) >= TRIM_MIN_LUMA_DELTA) return trimHex;

  const lighten = Math.abs(delta) >= TRIM_LEAN_RESPECT ? delta > 0 : wallLuma < 0.45;
  const target = Math.min(
    0.92,
    Math.max(0.08, wallLuma + (lighten ? TRIM_MIN_LUMA_DELTA : -TRIM_MIN_LUMA_DELTA)),
  );

  const v = parseInt(trimHex.slice(1), 16);
  let r = ((v >> 16) & 255) / 255;
  let g = ((v >> 8) & 255) / 255;
  let b = (v & 255) / 255;
  if (target <= trimLuma) {
    // Darken: scale toward black, which preserves hue and saturation ratio.
    const k = trimLuma > 0 ? target / trimLuma : 0;
    r *= k; g *= k; b *= k;
  } else {
    // Lighten: lerp toward white by the fraction that lands luma on target.
    const k = trimLuma < 1 ? (target - trimLuma) / (1 - trimLuma) : 0;
    r += (1 - r) * k; g += (1 - g) * k; b += (1 - b) * k;
  }
  const to255 = (x: number): number => Math.round(Math.min(1, Math.max(0, x)) * 255);
  return `#${(((1 << 24) | (to255(r) << 16) | (to255(g) << 8) | to255(b)) >>> 0).toString(16).slice(1)}`;
}

// ============================================================================
// Geometry Helpers
// ============================================================================
// Outer walls use one of two axes. These helpers keep every material part in
// the same centered, site-local meter frame as the structural bridge.
// ============================================================================

function runSpan(run: WallRun): [number, number] {
  return run.axis === 'x'
    ? [Math.min(run.x1, run.x2), Math.max(run.x1, run.x2)]
    : [Math.min(run.y1, run.y2), Math.max(run.y1, run.y2)];
}

function materialPartOnRun(
  kind: MaterialDetailKind,
  run: WallRun,
  planWidthFt: number,
  planDepthFt: number,
  alongCenterFt: number,
  alongLengthFt: number,
  baseYFt: number,
  heightFt: number,
  colorHex: string,
  projectionFt = DETAIL_DEPTH_M / FT,
): BuildingMaterialPart {
  const outwardFt = run.thicknessFt / 2 + projectionFt / 2;
  const shared = {
    h: heightFt * FT,
    baseY: baseYFt * FT,
    colorHex,
    tag: MATERIAL_PART_TAG,
    materialDetailKind: kind,
  } as const;

  if (run.axis === 'x') {
    return {
      ...shared,
      x: (alongCenterFt - planWidthFt / 2) * FT,
      z: (run.y1 - planDepthFt / 2 + run.ny * outwardFt) * FT,
      w: alongLengthFt * FT,
      d: projectionFt * FT,
    };
  }

  return {
    ...shared,
    x: (run.x1 - planWidthFt / 2 + run.nx * outwardFt) * FT,
    z: (alongCenterFt - planDepthFt / 2) * FT,
    w: projectionFt * FT,
    d: alongLengthFt * FT,
  };
}

/** Remove real window openings from one horizontal material course. */
function visibleCourseSpans(
  run: WallRun,
  windows: readonly BlueprintWindow[],
  courseBaseFt: number,
  courseHeightFt: number,
): Array<[number, number]> {
  const [runLo, runHi] = runSpan(run);
  // A course entirely below the sill or above the head can continue across the
  // wall. Only rows crossing the actual glazed height need horizontal gaps.
  if (courseBaseFt + courseHeightFt <= WINDOW_SILL_FT
    || courseBaseFt >= WINDOW_HEAD_FT) {
    return [[runLo, runHi]];
  }
  let spans: Array<[number, number]> = [[runLo, runHi]];
  const wallLineFt = run.axis === 'x' ? run.y1 : run.x1;

  for (const window of windows) {
    if (window.axis !== run.axis) continue;
    const fixedFt = run.axis === 'x' ? window.y : window.x;
    if (Math.abs(fixedFt - wallLineFt) > 1e-6) continue;
    const centerFt = run.axis === 'x' ? window.x : window.y;
    const openingLo = centerFt - WINDOW_HALF_FT - WINDOW_MARGIN_FT;
    const openingHi = centerFt + WINDOW_HALF_FT + WINDOW_MARGIN_FT;
    const next: Array<[number, number]> = [];

    for (const [spanLo, spanHi] of spans) {
      if (openingHi <= spanLo || openingLo >= spanHi) {
        next.push([spanLo, spanHi]);
        continue;
      }
      if (openingLo > spanLo) next.push([spanLo, Math.min(openingLo, spanHi)]);
      if (openingHi < spanHi) next.push([Math.max(openingHi, spanLo), spanHi]);
    }
    spans = next;
  }

  return spans.filter(([lo, hi]) => hi - lo >= 0.35);
}

/** Find the exact outer run that owns one stored window midpoint. */
function outerRunForWindow(
  floor: BlueprintFloor,
  window: BlueprintWindow,
): WallRun {
  const fixedFt = window.axis === 'x' ? window.y : window.x;
  const alongFt = window.axis === 'x' ? window.x : window.y;
  const run = floor.wallRuns.find((candidate) => {
    if (candidate.kind !== 'outer' || candidate.axis !== window.axis) return false;
    const candidateFixedFt = candidate.axis === 'x' ? candidate.y1 : candidate.x1;
    const [lo, hi] = runSpan(candidate);
    return Math.abs(candidateFixedFt - fixedFt) <= 1e-6
      && alongFt >= lo - 1e-6
      && alongFt <= hi + 1e-6;
  });

  if (!run) {
    throw new Error(
      `buildBuildingMaterialParts: window at ${window.x},${window.y} has no outer wall run`,
    );
  }
  return run;
}

// ============================================================================
// Foundation And Wall Material
// ============================================================================
// Foundations follow the ground-floor shell. Wall courses repeat on each
// above-grade floor, with a hard row cap so brickwork stays legible at town
// scale without producing unbounded geometry on tall buildings.
// ============================================================================

function foundationParts(
  blueprint: BlueprintPlan,
  construction: BuildingConstruction,
  colorHex: string,
): BuildingMaterialPart[] {
  const ground = blueprint.floors.find((floor) => floor.level === 0);
  if (!ground) return [];
  const parts: BuildingMaterialPart[] = [];
  const isPier = construction.foundation === 'stone-piers'
    || construction.foundation === 'timber-piles';
  const heightFt = construction.foundation === 'battered-stone'
    ? 2
    : construction.foundation === 'timber-piles'
      ? 1.7
      : 1.3;

  for (const run of ground.wallRuns) {
    if (!isVisibleExteriorRun(blueprint, run)) continue;
    const [lo, hi] = runSpan(run);

    if (!isPier) {
      parts.push(materialPartOnRun(
        'foundation',
        run,
        blueprint.widthFt,
        blueprint.depthFt,
        (lo + hi) / 2,
        hi - lo,
        0,
        heightFt,
        colorHex,
        // Slab foundations project 0.5 ft (was 0.38) so the plinth line still
        // reads at street distance; battered stone keeps its stronger 0.55.
        construction.foundation === 'battered-stone' ? 0.55 : 0.5,
      ));
      continue;
    }

    // Piers repeat at a bounded six-foot rhythm and include both run ends.
    // Adjacent walls may overlap at a corner; that reads as one stronger post.
    const spacingFt = 6;
    const count = Math.max(2, Math.ceil((hi - lo) / spacingFt) + 1);
    for (let index = 0; index < count; index++) {
      const centerFt = lo + ((hi - lo) * index) / (count - 1);
      parts.push(materialPartOnRun(
        'foundation',
        run,
        blueprint.widthFt,
        blueprint.depthFt,
        centerFt,
        construction.foundation === 'timber-piles' ? 0.7 : 1,
        0,
        heightFt,
        colorHex,
        construction.foundation === 'timber-piles' ? 0.7 : 0.9,
      ));
    }
  }

  return parts;
}

/** Materials whose assembly is readable as repeated horizontal courses. */
function hasVisibleCourses(construction: BuildingConstruction): boolean {
  return construction.wallMaterial !== 'timber-plaster'
    && construction.wallMaterial !== 'wattle-daub';
}

function wallCourseParts(
  blueprint: BlueprintPlan,
  construction: BuildingConstruction,
  storeyHeightFt: number,
  colorHex: string,
): BuildingMaterialPart[] {
  if (!hasVisibleCourses(construction)) return [];
  const parts: BuildingMaterialPart[] = [];
  const usableHeightFt = Math.max(0, storeyHeightFt - 1);
  const desiredRows = Math.floor(usableHeightFt / construction.wallCourseFt);
  const rowCount = Math.max(1, Math.min(MAX_COURSES_PER_STOREY, desiredRows));
  const spacingFt = usableHeightFt / (rowCount + 1);
  // Streamed-town readability (town-look-slice1): course strips roughly doubled
  // from 0.28/0.16/0.13 ft — the old 4-8.5 cm rows vanished below one pixel at
  // play distance. New rows (13/9/8 cm) stay far below the ~1.3 ft row spacing,
  // so courses never merge, and the material ranking (logs > boards > masonry)
  // is preserved.
  const courseHeightFt = construction.wallMaterial === 'round-log'
    || construction.wallMaterial === 'hewn-log'
    ? 0.42
    : construction.wallMaterial === 'weatherboard'
      || construction.wallMaterial === 'tarred-board'
      ? 0.3
      : 0.26;

  for (const floor of blueprint.floors) {
    if (floor.level < 0) continue;
    const floorBaseFt = floor.level * storeyHeightFt;
    for (const run of floor.wallRuns) {
      if (!isVisibleExteriorRun(blueprint, run)) continue;
      for (let row = 1; row <= rowCount; row++) {
        const courseOffsetFt = row * spacingFt;
        const baseYFt = floorBaseFt + courseOffsetFt;
        const spans = visibleCourseSpans(
          run,
          floor.windows,
          courseOffsetFt,
          courseHeightFt,
        );
        for (const [lo, hi] of spans) {
          parts.push(materialPartOnRun(
            'wall-course',
            run,
            blueprint.widthFt,
            blueprint.depthFt,
            (lo + hi) / 2,
            hi - lo,
            baseYFt,
            courseHeightFt,
            colorHex,
          ));
        }
      }
    }
  }

  return parts;
}

// ============================================================================
// Window Materials
// ============================================================================
// Shutters sit open beside actual window openings. Glazing itself remains part
// of the canonical structure; glazingPaneColor lets interiorParts tint those
// existing panes without adding a second pane at the same location.
// ============================================================================

export function glazingPaneColor(glazing: GlazingType): string {
  switch (glazing) {
    case 'open-lattice': return '#554f43';
    case 'oiled-lattice': return '#aa9568';
    case 'leaded-casement': return '#8eabb2';
    case 'clear-casement': return '#b7d9df';
  }
}

function shutterParts(
  blueprint: BlueprintPlan,
  construction: BuildingConstruction,
  storeyHeightFt: number,
  colorHex: string,
): BuildingMaterialPart[] {
  if (construction.shutters === 'none') return [];
  const parts: BuildingMaterialPart[] = [];
  const panelWidthFt = Math.max(0.75, Math.min(1.25, construction.timberWidthFt * 1.6));
  const panelHeightFt = 3.6;
  const panelBaseOffsetFt = 2.95;

  for (const floor of blueprint.floors) {
    if (floor.level < 0) continue;
    const floorBaseFt = floor.level * storeyHeightFt;
    for (const window of floor.windows) {
      const run = outerRunForWindow(floor, window);
      const windowAlongFt = run.axis === 'x' ? window.x : window.y;
      const sideOffsetFt = WINDOW_HALF_FT + 0.2 + panelWidthFt / 2;

      for (const side of [-1, 1] as const) {
        const panelCenterFt = windowAlongFt + side * sideOffsetFt;
        parts.push(materialPartOnRun(
          'shutter-panel',
          run,
          blueprint.widthFt,
          blueprint.depthFt,
          panelCenterFt,
          panelWidthFt,
          floorBaseFt + panelBaseOffsetFt,
          panelHeightFt,
          colorHex,
          0.18,
        ));

        // Louvered shutters gain two shallow cross-slats. Paneled shutters
        // gain one smaller raised panel. Board shutters keep the solid plank.
        const slatCount = construction.shutters === 'louvered' ? 2 : 0;
        for (let slat = 1; slat <= slatCount; slat++) {
          parts.push(materialPartOnRun(
            'shutter-slat',
            run,
            blueprint.widthFt,
            blueprint.depthFt,
            panelCenterFt,
            panelWidthFt * 0.9,
            floorBaseFt + panelBaseOffsetFt + (panelHeightFt * slat) / 4,
            0.09,
            colorHex,
            0.24,
          ));
        }
        if (construction.shutters === 'paneled') {
          parts.push(materialPartOnRun(
            'shutter-slat',
            run,
            blueprint.widthFt,
            blueprint.depthFt,
            panelCenterFt,
            panelWidthFt * 0.72,
            floorBaseFt + panelBaseOffsetFt + 0.65,
            panelHeightFt - 1.3,
            colorHex,
            0.24,
          ));
        }
      }
    }
  }

  return parts;
}

// ============================================================================
// Roof Covering And Ornament
// ============================================================================
// The canonical roof remains one solved triangle group. Covering-specific eave
// profiles add a readable edge without pretending axis-aligned boxes follow a
// whole slope; true surface textures can later consume the same covering id.
// ============================================================================

function roofEdgeProfile(construction: BuildingConstruction): {
  heightFt: number;
  projectionFt: number;
  segmentFt?: number;
} {
  switch (construction.roofCovering) {
    case 'reed-thatch': return { heightFt: 0.9, projectionFt: 1.25 };
    case 'sod': return { heightFt: 0.75, projectionFt: 0.9 };
    case 'stone-slab': return { heightFt: 0.42, projectionFt: 0.65, segmentFt: 5 };
    case 'clay-tile': return { heightFt: 0.34, projectionFt: 0.75, segmentFt: 3.2 };
    case 'wood-shingle': return { heightFt: 0.26, projectionFt: 0.8, segmentFt: 4 };
    case 'slate': return { heightFt: 0.2, projectionFt: 0.65, segmentFt: 3.5 };
  }
}

function roofEdgeParts(
  blueprint: BlueprintPlan,
  construction: BuildingConstruction,
  storeyHeightFt: number,
  roofColorHex: string,
): BuildingMaterialPart[] {
  const top = blueprint.floors
    .filter((floor) => floor.level >= 0)
    .sort((a, b) => b.level - a.level)[0];
  if (!top || !blueprint.roof) return [];
  const parts: BuildingMaterialPart[] = [];
  const profile = roofEdgeProfile(construction);
  const wallTopFt = (top.level + 1) * storeyHeightFt;
  const baseYFt = wallTopFt - profile.heightFt * 0.35;

  for (const run of top.wallRuns) {
    if (!isVisibleExteriorRun(blueprint, run)) continue;
    const [lo, hi] = runSpan(run);
    const lengthFt = hi - lo;
    const segmentFt = profile.segmentFt;

    if (!segmentFt) {
      parts.push(materialPartOnRun(
        'roof-edge',
        run,
        blueprint.widthFt,
        blueprint.depthFt,
        (lo + hi) / 2,
        lengthFt,
        baseYFt,
        profile.heightFt,
        roofColorHex,
        profile.projectionFt,
      ));
      continue;
    }

    const count = Math.max(1, Math.ceil(lengthFt / segmentFt));
    const actualFt = lengthFt / count;
    for (let index = 0; index < count; index++) {
      parts.push(materialPartOnRun(
        'roof-edge',
        run,
        blueprint.widthFt,
        blueprint.depthFt,
        lo + actualFt * (index + 0.5),
        Math.max(0.25, actualFt - 0.08),
        baseYFt,
        profile.heightFt,
        roofColorHex,
        profile.projectionFt,
      ));
    }
  }

  return parts;
}

function ornamentParts(
  blueprint: BlueprintPlan,
  construction: BuildingConstruction,
  storeyHeightFt: number,
  colorHex: string,
): BuildingMaterialPart[] {
  if (construction.ornamentKit === 'none') return [];
  const parts: BuildingMaterialPart[] = [];
  const topLevel = Math.max(...blueprint.floors.map((floor) => floor.level));

  for (const floor of blueprint.floors) {
    if (floor.level < 0) continue;
    const floorBaseFt = floor.level * storeyHeightFt;
    for (const run of floor.wallRuns) {
      if (!isVisibleExteriorRun(blueprint, run)) continue;
      const [lo, hi] = runSpan(run);
      const runLengthFt = hi - lo;

      if (construction.ornamentKit === 'stone-quoins'
        || construction.ornamentKit === 'notched-log') {
        const widthFt = Math.min(construction.timberWidthFt, runLengthFt / 2);
        for (const centerFt of [lo + widthFt / 2, hi - widthFt / 2]) {
          parts.push(materialPartOnRun(
            'ornament',
            run,
            blueprint.widthFt,
            blueprint.depthFt,
            centerFt,
            widthFt,
            floorBaseFt + 0.35,
            storeyHeightFt - 0.7,
            colorHex,
            0.28,
          ));
        }
      } else {
        // Painted timber, rope carving, and carved bargeboards read as one
        // strong trim line. Roof-oriented kits only place it under the top eave.
        const roofOnly = construction.ornamentKit === 'carved-bargeboards'
          || construction.ornamentKit === 'rope-carving';
        if (roofOnly && floor.level !== topLevel) continue;
        parts.push(materialPartOnRun(
          'ornament',
          run,
          blueprint.widthFt,
          blueprint.depthFt,
          (lo + hi) / 2,
          runLengthFt,
          floorBaseFt + storeyHeightFt - 0.8,
          construction.ornamentKit === 'rope-carving' ? 0.18 : 0.32,
          colorHex,
          0.25,
        ));
      }
    }
  }

  return parts;
}

// ============================================================================
// Public Projection
// ============================================================================
// Unstyled legacy blueprints remain byte-identical because they have no
// construction receipt and produce no material dressing.
// ============================================================================

export function buildBuildingMaterialParts(
  blueprint: BlueprintPlan,
  storeyHeightM: number,
): BuildingMaterialPart[] {
  const style = blueprint.styleResolved;
  if (!style) return [];
  const storeyHeightFt = storeyHeightM / FT;
  const construction = style.construction;
  // Wall-mounted dressing renders in the contrast-derived trim tone rather than
  // the raw family tint, which sat within a few luma points of the wall color
  // and made every course/shutter/foundation invisible (town-look-slice1).
  // Roof-edge dressing keeps style.roofColor — it must read as the covering.
  const wallDressingTone = dressingContrastTone(style.trimColor, style.wallColor);

  const centeredParts = [
    ...foundationParts(blueprint, construction, wallDressingTone),
    ...wallCourseParts(
      blueprint,
      construction,
      storeyHeightFt,
      wallDressingTone,
    ),
    ...shutterParts(
      blueprint,
      construction,
      storeyHeightFt,
      wallDressingTone,
    ),
    ...roofEdgeParts(
      blueprint,
      construction,
      storeyHeightFt,
      style.roofColor,
    ),
    ...ornamentParts(
      blueprint,
      construction,
      storeyHeightFt,
      wallDressingTone,
    ),
  ];
  // Material recipes predate asymmetric envelopes and are expressed around
  // the envelope center. One shared translation retains those exact recipes
  // while anchoring them to the blueprint's stable plot origin.
  const origin = blueprintSiteOrigin(blueprint);
  const offsetX = (blueprint.widthFt / 2 - origin.x) * FT;
  const offsetZ = (blueprint.depthFt / 2 - origin.y) * FT;
  return centeredParts.map((part) => ({
    ...part,
    x: part.x + offsetX,
    z: part.z + offsetZ,
  }));
}
