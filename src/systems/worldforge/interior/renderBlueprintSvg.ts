/**
 * @file renderBlueprintSvg.ts
 * @description Pure 2D module-map blueprint renderer over a BlueprintPlan.
 *
 * Task 11 of the Building Blueprint Pipeline. Takes the canonical
 * `BlueprintPlan` (Tasks 1-8: irregular footprints, cells-based rooms, wall
 * RUNS with real thickness, spatial door swings, per-room windows) and returns
 * an SVG string. No DOM, no React, no three.js, no RNG — deterministic pure
 * string building, so it runs headless for golden rendering and in the
 * browser alike.
 *
 * Sheet furniture (round-1 critique fixes folded in):
 *  - walls drawn from `wallRuns` at true `thicknessFt`, straddling the line
 *  - doors: 3 ft leaves (data-door-ft, never a full 5 ft cell) with a swing
 *    arc driven by `openDir`/`swingInto`, plus jambs in the 5 ft opening
 *  - windows as glazing ticks (data-window) across the outer wall band
 *  - floor lighting clamped: the radial gradient's radius covers the far
 *    corner and its darkest stop stays warm — corner cells never go near-black
 *  - room purpose labels at `room.anchor` (dominant-baseline centered),
 *    abbreviated/wrapped to fit, DROPPED entirely when the room is too small
 *  - room numbers (data-room-num) + a keyed legend beside the sheet
 *  - graphic scale bar (data-scale-bar), north arrow, title block with
 *    building type / floor name / seed (options arg)
 *  - exterior apron tint around the footprint, doorstep + entry arrow
 */

import type {
  BlueprintDoor,
  BlueprintFloor,
  BlueprintFurnishing,
  BlueprintPlan,
  BlueprintRoom,
  RoofPlan,
  RoomPurpose,
} from './blueprintTypes';
import { EXTERIOR, cellKey } from './blueprintTypes';
import { type BuildingOccupancy, HEARTH_KINDS } from './occupancy';
import type { ContainerManifest } from './manifests';

// --- sheet metrics (px) ------------------------------------------------------
const CELL = 25; // px per 5 ft cell
const PXPF = CELL / 5; // px per foot
const ML = 34; // left/top sheet margin
const LEGEND_W = 128; // keyed room legend column
const TITLE_H = 40; // title-block strip

// --- physical sheet palette (do not theme-invert) ----------------------------
const SHEET = '#efe6d2';
const APRON = '#ddd0b4';
const APRON_S = 'rgba(110,90,50,0.25)';
const GRID = 'rgba(92,62,30,0.22)';
const PLANK = 'rgba(70,45,20,0.10)';
const WALL_O = '#433f39';
const WALL_I = '#5a544b';
const WALL_EDGE = '#2c2925';
const DOOR = '#332e28';
const WIN = '#cdbe97';
const FUR = '#9c6b3d';
const FUR_S = '#4a3320';
const LBL = '#f4e8ca';
const LBL_S = '#463019';
const INK = '#4b3a22';

const DOOR_FT = 3; // door leaf, feet — never a full 5 ft cell

/** Warm per-purpose floor tint, blended at low opacity over the plank floor. */
const PURPOSE_TINT: Partial<Record<RoomPurpose, string>> = {
  hall: '#e8d8b0', 'common-room': '#e8d8b0', 'great-hall': '#e8d8b0', nave: '#e8e0c8',
  kitchen: '#e3a060', bedroom: '#a8c0e3', 'guest-room': '#b8cce8', 'private-room': '#a0b8dd',
  solar: '#cfd9ee', shopfront: '#d9b2e8', workshop: '#d4c488', storage: '#b9b9b9',
  pantry: '#d8cf98', cellar: '#a5a095', armory: '#c5a5a5', sanctuary: '#e8e0c8',
  vestry: '#ddd5bd', study: '#b8d8b8', 'guard-room': '#ccb090', corridor: '#f0ead8',
};

/** Abbreviations tried when the full purpose label does not fit its room. */
const ABBREV: Partial<Record<string, string>> = {
  'common room': 'common', 'great hall': 'hall', 'guest room': 'guest',
  'private room': 'private', 'guard room': 'guard', shopfront: 'shop',
  sanctuary: 'shrine', workshop: 'works', bedroom: 'bed', kitchen: 'kit.',
  storage: 'store', corridor: 'corr.', armory: 'arms', pantry: 'pantry',
};

/** Estimated glyph advance as a fraction of font-size (serif, ~worst case). */
export const LABEL_CHAR_W = 0.62;

const estPx = (text: string, fs: number): number => text.length * LABEL_CHAR_W * fs;

/**
 * Fit a label into `maxPx` at font-size `fs`: full text, else a 2-line wrap
 * (when `maxLines` allows), else an abbreviation, else null (DROP the label —
 * a too-small room gets no label rather than ink across its walls).
 */
export function fitLabel(
  label: string,
  maxPx: number,
  fs: number,
  maxLines = 2,
): string[] | null {
  if (maxPx <= 0) return null;
  if (estPx(label, fs) <= maxPx) return [label];
  const words = label.split(' ');
  if (maxLines >= 2 && words.length > 1) {
    const a = words[0];
    const b = words.slice(1).join(' ');
    if (estPx(a, fs) <= maxPx && estPx(b, fs) <= maxPx) return [a, b];
  }
  const short = ABBREV[label];
  if (short !== undefined && estPx(short, fs) <= maxPx) return [short];
  return null;
}

const escapeXml = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const r2 = (v: number): number => Math.round(v * 100) / 100;

const floorName = (level: number): string =>
  level < 0 ? 'Basement' : level === 0 ? 'Ground floor' : `Floor ${level}`;

export interface RenderBlueprintOptions {
  /** Shown in the title block when provided (the plan itself carries no seed). */
  seed?: number | string;
  /**
   * Living-overlay extras (Task 13 — ALL optional and additive; existing
   * callers unchanged). When `occupancy` is present a `<g data-occupancy>`
   * group is appended: room claim labels (data-claim), one dot per member at
   * their station for `hour` (data-station), a warm halo on lit hearths
   * (data-hearth-halo), and container markers with `<title>` tooltips listing
   * the manifest entries (data-container). The overlay reads ONLY from these
   * passed objects — never from the generator.
   */
  occupancy?: BuildingOccupancy;
  manifests?: ContainerManifest[];
  /** Hour of day 0–23 for the station dots + hearth state. Default 12. */
  hour?: number;
  /** Household members, indexed like OccupantStation.memberIndex; a dot is
   *  labeled with the member's GIVEN name (first token of `name`). */
  members?: ReadonlyArray<{ name: string }>;
  /**
   * Solved roof overlay (BGv2 Task 6 — optional and additive like the
   * occupancy extras). When present a `<g data-roof>` group is drawn OVER the
   * floor plan in the sheet's drafting ink: plane outlines faintly tinted
   * (data-roof-plane), ridges solid (data-roof-ridge), valleys dashed
   * (data-roof-valley), chimneys as small filled squares (data-roof-chimney),
   * dormers as carets (data-roof-dormer), tower caps hatched (data-roof-cap).
   * Roof coordinates are plan feet — the same frame as the rooms; the eave
   * overhang extends past the walls onto the apron.
   */
  roof?: RoofPlan;
}

/** Render one floor of a BlueprintPlan as a module-style blueprint SVG string. */
export function renderBlueprintSvg(
  plan: BlueprintPlan,
  level: number,
  options?: RenderBlueprintOptions,
): string {
  const floor: BlueprintFloor | undefined = plan.floors.find((f) => f.level === level);
  if (!floor) {
    throw new Error(`renderBlueprintSvg: plan has no floor at level ${level} (has ${plan.floors.map((f) => f.level).join(', ')})`);
  }
  const cols = Math.round(plan.widthFt / 5);
  const rows = Math.round(plan.depthFt / 5);

  // ---- occupancy from room cells (irregular footprints supported) -----------
  const rg: number[][] = [];
  for (let y = 0; y < rows; y++) rg.push(new Array<number>(cols).fill(EXTERIOR));
  const roomById = new Map<number, BlueprintRoom>();
  for (const rm of floor.rooms) {
    roomById.set(rm.id, rm);
    for (const c of rm.cells) if (c.cy >= 0 && c.cy < rows && c.cx >= 0 && c.cx < cols) rg[c.cy][c.cx] = rm.id;
  }
  const occ = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= cols || y >= rows ? EXTERIOR : rg[y][x];
  const occupied = new Set<string>();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (rg[y][x] !== EXTERIOR) occupied.add(cellKey(x, y));

  // wall thickness by kind (runs carry the truth; jambs at doors reuse it)
  const outerFt = floor.wallRuns.find((r) => r.kind === 'outer')?.thicknessFt;
  if (outerFt === undefined) throw new Error('renderBlueprintSvg: floor has no outer wall runs');
  const innerFt = floor.wallRuns.find((r) => r.kind === 'inner')?.thicknessFt ?? 0.6;

  // ---- sheet layout ----------------------------------------------------------
  // The plan's drawn CONTENT is the grid PLUS a one-cell exterior apron ring, so
  // the apron protrudes CELL px past the grid on every side. The legend column
  // and the bottom title cartouche must clear that apron — never straddle it.
  const gridW = cols * CELL;
  const gridH = rows * CELL;
  const numbered = floor.rooms.filter((rm) => !rm.isCorridor);
  const legendH = 16 + numbered.length * 13;
  // right edge / bottom edge of the grid+apron content bbox
  const apronRight = ML + gridW + CELL;
  const apronBottom = ML + gridH + CELL;
  const LEGEND_GAP = 12; // gap between apron and legend column
  const TITLE_GAP = 10; // gap between apron and title strip
  // legend column sits to the RIGHT of the apron
  const lx = apronRight + LEGEND_GAP;
  const legendBottom = ML + legendH; // legend starts at y=ML (top-aligned)
  const W = lx + LEGEND_W;
  // title strip sits BELOW both the apron and the legend column, whichever is lower
  const stripY = Math.max(apronBottom, legendBottom) + TITLE_GAP;
  const H = stripY + TITLE_H + 6;
  const X = (c: number): number => r2(ML + c * CELL);
  const Y = (c: number): number => r2(ML + c * CELL);
  const fX = (ft: number): number => r2(ML + ft * PXPF);
  const fY = (ft: number): number => r2(ML + ft * PXPF);

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`;
  s += `<title>${escapeXml(plan.type)} blueprint — ${floorName(level)}</title>`;

  // Floor lighting: radius reaches PAST the far corner and the darkest stop is
  // a warm mid-brown, so corner cells never go near-black (round-1 fix).
  const mcx = ML + gridW / 2;
  const mcy = ML + gridH / 2;
  const rad = Math.hypot(gridW, gridH) * 0.62;
  s += `<defs><radialGradient id="bpf" gradientUnits="userSpaceOnUse" cx="${r2(mcx)}" cy="${r2(mcy)}" r="${r2(rad)}">` +
    `<stop offset="0" stop-color="#d3a570"/><stop offset="0.7" stop-color="#bd8f5c"/><stop offset="1" stop-color="#a3773f"/>` +
    `</radialGradient></defs>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="${SHEET}"/>`;

  // ---- exterior apron: tinted ground ring around the footprint ---------------
  let apron = '';
  for (let y = -1; y <= rows; y++) {
    for (let x = -1; x <= cols; x++) {
      if (occ(x, y) !== EXTERIOR) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++)
        for (let dx = -1; dx <= 1 && !touches; dx++)
          if (occ(x + dx, y + dy) !== EXTERIOR) touches = true;
      if (touches) apron += `<rect x="${X(x)}" y="${Y(y)}" width="${CELL}" height="${CELL}" fill="${APRON}" stroke="${APRON_S}" stroke-width="0.5" data-apron="1"/>`;
    }
  }
  s += apron;

  // ---- floor cells + purpose tint + plank + grid ------------------------------
  let floorSvg = '';
  let tint = '';
  let plank = '';
  let grid = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const id = rg[y][x];
      if (id === EXTERIOR) continue;
      floorSvg += `<rect x="${X(x)}" y="${Y(y)}" width="${CELL}" height="${CELL}" fill="url(#bpf)"/>`;
      const room = roomById.get(id);
      const tc = room ? PURPOSE_TINT[room.purpose] : undefined;
      if (tc) tint += `<rect x="${X(x)}" y="${Y(y)}" width="${CELL}" height="${CELL}" fill="${tc}" fill-opacity="0.18"/>`;
      plank += `<line x1="${X(x + 0.5)}" y1="${Y(y)}" x2="${X(x + 0.5)}" y2="${Y(y + 1)}" stroke="${PLANK}" stroke-width="1"/>`;
      grid += `<line x1="${X(x)}" y1="${Y(y)}" x2="${X(x + 1)}" y2="${Y(y)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
      grid += `<line x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(y + 1)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
      if (occ(x + 1, y) === EXTERIOR) grid += `<line x1="${X(x + 1)}" y1="${Y(y)}" x2="${X(x + 1)}" y2="${Y(y + 1)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
      if (occ(x, y + 1) === EXTERIOR) grid += `<line x1="${X(x)}" y1="${Y(y + 1)}" x2="${X(x + 1)}" y2="${Y(y + 1)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
    }
  }
  s += floorSvg + tint + plank + grid;

  // ---- furnishings (glyphs, feet-canon centers) --------------------------------
  // Every furnishing is wrapped in a <g data-kind="…"> carrying a <title> naming
  // its kind (hover tooltip), so the sheet is legible AND testable. Common kinds
  // get a distinct hand-drawn silhouette; the rest fall back to a generic box.
  const box = (f: BlueprintFurnishing, wFt: number, dFt: number, solid: boolean): string => {
    const w = wFt * PXPF;
    const d = dFt * PXPF;
    const cx = fX(f.x);
    const cy = fY(f.y);
    const t = f.rotation ? ` transform="rotate(${f.rotation} ${cx} ${cy})"` : '';
    return `<rect x="${r2(cx - w / 2)}" y="${r2(cy - d / 2)}" width="${r2(w)}" height="${r2(d)}" rx="1.5" fill="${FUR}" fill-opacity="${solid ? 0.85 : 1}" stroke="${FUR_S}" stroke-width="1"${t}/>`;
  };
  const circ = (f: BlueprintFurnishing, rFt: number): string =>
    `<circle cx="${fX(f.x)}" cy="${fY(f.y)}" r="${r2(rFt * PXPF)}" fill="none" stroke="${FUR_S}" stroke-width="1.1"/>`;
  // rotate transform shared by silhouette overlays (about the furnishing center)
  const rot = (f: BlueprintFurnishing): string =>
    f.rotation ? ` transform="rotate(${f.rotation} ${fX(f.x)} ${fY(f.y)})"` : '';
  /** Build one furnishing's glyph body (silhouette). */
  const glyphBody = (f: BlueprintFurnishing): string => {
    const cx = fX(f.x);
    const cy = fY(f.y);
    switch (f.kind) {
      case 'table': return box(f, 4.5, 3.5, false);
      case 'hearth':
      case 'forge-hearth': {
        // rect with 2–3 diagonal hatch lines (the fire bed)
        let g = box(f, 4.5, 2, true);
        const hw = 4.5 * PXPF;
        const hh = 2 * PXPF;
        const t = rot(f);
        for (let i = 1; i <= 3; i++) {
          const fx = -hw / 2 + (i * hw) / 4;
          g += `<line x1="${r2(cx + fx)}" y1="${r2(cy + hh / 2)}" x2="${r2(cx + fx + hh)}" y2="${r2(cy - hh / 2)}" stroke="${FUR_S}" stroke-width="0.8"${t} data-glyph="hearth-hatch"/>`;
        }
        return g;
      }
      case 'counter':
      case 'shelf': {
        // thin rect with a long-edge tick (the working face)
        const wFt = f.kind === 'counter' ? 4.5 : 4.5;
        const dFt = f.kind === 'counter' ? 2 : 1.4;
        let g = box(f, wFt, dFt, true);
        const hw = wFt * PXPF;
        const hd = dFt * PXPF;
        const t = rot(f);
        g += `<line x1="${r2(cx - hw / 2 + 1.5)}" y1="${r2(cy - hd / 2 + 1.2)}" x2="${r2(cx + hw / 2 - 1.5)}" y2="${r2(cy - hd / 2 + 1.2)}" stroke="${FUR_S}" stroke-width="0.9"${t} data-glyph="shelf-edge"/>`;
        return g;
      }
      case 'barrel': {
        // circle with an inner ring (the hoop)
        let g = circ(f, 1.4);
        g += `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(0.8 * 1.4 * PXPF)}" fill="none" stroke="${FUR_S}" stroke-width="0.8" data-glyph="barrel-ring"/>`;
        return g;
      }
      case 'crate': return box(f, 2.4, 2.4, true);
      case 'chest': {
        // rect with a lid line across the front
        let g = box(f, 3, 1.8, true);
        const hw = 3 * PXPF;
        const t = rot(f);
        g += `<line x1="${r2(cx - hw / 2)}" y1="${r2(cy)}" x2="${r2(cx + hw / 2)}" y2="${r2(cy)}" stroke="${FUR_S}" stroke-width="1"${t} data-glyph="chest-lid"/>`;
        return g;
      }
      case 'workbench': {
        // rect with a corner dot
        let g = box(f, 4.5, 2, false);
        const hw = 4.5 * PXPF;
        const hd = 2 * PXPF;
        const t = rot(f);
        g += `<circle cx="${r2(cx - hw / 2 + 2.5)}" cy="${r2(cy - hd / 2 + 2.5)}" r="1.4" fill="${FUR_S}"${t} data-glyph="workbench-dot"/>`;
        return g;
      }
      case 'bed': {
        // rect with a pillow band line at one end
        let g = box(f, 4.5, 3, false);
        const t = rot(f);
        g += `<rect x="${r2(cx - 2.25 * PXPF)}" y="${r2(cy - 1.5 * PXPF)}" width="${r2(4.5 * PXPF)}" height="${r2(0.9 * PXPF)}" rx="1" fill="${FUR}" fill-opacity="0.85" stroke="${FUR_S}" stroke-width="1"${t}/>`;
        g += `<line x1="${r2(cx - 2.25 * PXPF)}" y1="${r2(cy - 0.6 * PXPF)}" x2="${r2(cx + 2.25 * PXPF)}" y2="${r2(cy - 0.6 * PXPF)}" stroke="${FUR_S}" stroke-width="0.9"${t} data-glyph="bed-pillow"/>`;
        return g;
      }
      case 'bench': return box(f, 4, 1.1, true);
      case 'chair': return box(f, 1.5, 1.5, false);
      case 'desk': return box(f, 4, 2, false);
      case 'altar': return box(f, 4, 2.4, false) + `<line x1="${r2(cx)}" y1="${r2(cy - 0.8 * PXPF)}" x2="${r2(cx)}" y2="${r2(cy + 0.8 * PXPF)}" stroke="${FUR_S}" stroke-width="1"/>`;
      case 'weapon-rack': return box(f, 4, 1, true);
      case 'loom': return box(f, 4, 3, false);
      case 'anvil': return box(f, 2, 1.5, true);
      default: return box(f, 2.4, 2.4, true);
    }
  };
  let fur = '';
  for (const f of floor.furnishings) {
    fur += `<g data-kind="${escapeXml(f.kind)}"><title>${escapeXml(f.kind)}</title>${glyphBody(f)}</g>`;
  }
  s += fur;

  // ---- walls from RUNS at true thickness, straddling the line -----------------
  let walls = '';
  for (const run of floor.wallRuns) {
    const t = run.thicknessFt * PXPF;
    const fill = run.kind === 'outer' ? WALL_O : WALL_I;
    // extend each end by t/2 so perpendicular runs close the corner solidly
    if (run.x1 === run.x2) {
      const y0 = Math.min(run.y1, run.y2);
      const y1 = Math.max(run.y1, run.y2);
      walls += `<rect x="${r2(fX(run.x1) - t / 2)}" y="${r2(fY(y0) - t / 2)}" width="${r2(t)}" height="${r2((y1 - y0) * PXPF + t)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4" data-wall-run="${run.kind}"/>`;
    } else {
      const x0 = Math.min(run.x1, run.x2);
      const x1 = Math.max(run.x1, run.x2);
      walls += `<rect x="${r2(fX(x0) - t / 2)}" y="${r2(fY(run.y1) - t / 2)}" width="${r2((x1 - x0) * PXPF + t)}" height="${r2(t)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4" data-wall-run="${run.kind}"/>`;
    }
  }
  s += walls;

  // ---- doors: jambs in the 5 ft opening + 3 ft leaf with a spatial swing ------
  const jambFt = (5 - DOOR_FT) / 2;
  let doorsSvg = '';
  for (const d of floor.doors) {
    const t = (d.a === EXTERIOR || d.b === EXTERIOR ? outerFt : innerFt) * PXPF;
    const fill = d.a === EXTERIOR || d.b === EXTERIOR ? WALL_O : WALL_I;
    const j = jambFt * PXPF;
    const px = fX(d.x);
    const py = fY(d.y);
    if (d.axis === 'y') {
      // vertical wall: opening spans y-2.5..y+2.5 ft; jambs top+bottom
      doorsSvg += `<rect x="${r2(px - t / 2)}" y="${r2(py - 2.5 * PXPF)}" width="${r2(t)}" height="${r2(j)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>`;
      doorsSvg += `<rect x="${r2(px - t / 2)}" y="${r2(py + 2.5 * PXPF - j)}" width="${r2(t)}" height="${r2(j)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>`;
      // hinge at top of the 3 ft leaf; swings into openDir (A2 contract)
      const hy = py - (DOOR_FT / 2) * PXPF;
      const cy = py + (DOOR_FT / 2) * PXPF;
      const tipX = px + d.openDir.nx * DOOR_FT * PXPF;
      const sweep = d.openDir.nx > 0 ? 1 : 0;
      doorsSvg += `<line x1="${px}" y1="${r2(hy)}" x2="${r2(tipX)}" y2="${r2(hy)}" stroke="${DOOR}" stroke-width="1.4" data-door-ft="${DOOR_FT}"${d.isEntry ? ' data-entry="1"' : ''}/>`;
      doorsSvg += `<path d="M ${r2(tipX)} ${r2(hy)} A ${r2(DOOR_FT * PXPF)} ${r2(DOOR_FT * PXPF)} 0 0 ${sweep} ${px} ${r2(cy)}" fill="none" stroke="${DOOR}" stroke-width="1" opacity="0.5"/>`;
    } else {
      // horizontal wall: opening spans x-2.5..x+2.5 ft; jambs left+right
      doorsSvg += `<rect x="${r2(px - 2.5 * PXPF)}" y="${r2(py - t / 2)}" width="${r2(j)}" height="${r2(t)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>`;
      doorsSvg += `<rect x="${r2(px + 2.5 * PXPF - j)}" y="${r2(py - t / 2)}" width="${r2(j)}" height="${r2(t)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>`;
      const hx = px - (DOOR_FT / 2) * PXPF;
      const cx = px + (DOOR_FT / 2) * PXPF;
      const tipY = py + d.openDir.ny * DOOR_FT * PXPF;
      const sweep = d.openDir.ny < 0 ? 1 : 0;
      doorsSvg += `<line x1="${r2(hx)}" y1="${py}" x2="${r2(hx)}" y2="${r2(tipY)}" stroke="${DOOR}" stroke-width="1.4" data-door-ft="${DOOR_FT}"${d.isEntry ? ' data-entry="1"' : ''}/>`;
      doorsSvg += `<path d="M ${r2(hx)} ${r2(tipY)} A ${r2(DOOR_FT * PXPF)} ${r2(DOOR_FT * PXPF)} 0 0 ${sweep} ${r2(cx)} ${py}" fill="none" stroke="${DOOR}" stroke-width="1" opacity="0.5"/>`;
    }
  }
  s += doorsSvg;

  // ---- windows: glazing ticks across the outer wall band ----------------------
  let winSvg = '';
  const winT = outerFt * PXPF + 1.6;
  for (const w of floor.windows) {
    const px = fX(w.x);
    const py = fY(w.y);
    if (w.axis === 'y') winSvg += `<rect x="${r2(px - winT / 2)}" y="${r2(py - 1.5 * PXPF)}" width="${r2(winT)}" height="${r2(3 * PXPF)}" fill="${WIN}" stroke="${WALL_EDGE}" stroke-width="0.4" data-window="1"/>`;
    else winSvg += `<rect x="${r2(px - 1.5 * PXPF)}" y="${r2(py - winT / 2)}" width="${r2(3 * PXPF)}" height="${r2(winT)}" fill="${WIN}" stroke="${WALL_EDGE}" stroke-width="0.4" data-window="1"/>`;
  }
  s += winSvg;

  // ---- entry doorstep + approach arrow (opens INTO the primary room, A2) ------
  const entry: BlueprintDoor | undefined = floor.doors.find((d) => d.isEntry);
  if (entry) {
    const ox = -entry.openDir.nx; // outward = opposite of the inward swing
    const oy = -entry.openDir.ny;
    const px = fX(entry.x);
    const py = fY(entry.y);
    // doorstep slab just outside the opening
    const stepAlong = 4 * PXPF;
    const stepOut = 1.6 * PXPF;
    const sx = px + ox * (outerFt / 2) * PXPF;
    const sy = py + oy * (outerFt / 2) * PXPF;
    if (entry.axis === 'y') {
      s += `<rect x="${r2(sx + (ox > 0 ? 0 : -stepOut))}" y="${r2(sy - stepAlong / 2)}" width="${r2(stepOut)}" height="${r2(stepAlong)}" rx="1" fill="#c9b98e" stroke="${APRON_S}" stroke-width="0.8" data-doorstep="1"/>`;
    } else {
      s += `<rect x="${r2(sx - stepAlong / 2)}" y="${r2(sy + (oy > 0 ? 0 : -stepOut))}" width="${r2(stepAlong)}" height="${r2(stepOut)}" rx="1" fill="#c9b98e" stroke="${APRON_S}" stroke-width="0.8" data-doorstep="1"/>`;
    }
    // approach arrow pointing at the door from outside
    const ax1 = px + ox * 22;
    const ay1 = py + oy * 22;
    const ax2 = px + ox * 8;
    const ay2 = py + oy * 8;
    const ang = Math.atan2(ay2 - ay1, ax2 - ax1);
    const hl = 6;
    s += `<line x1="${r2(ax1)}" y1="${r2(ay1)}" x2="${r2(ax2)}" y2="${r2(ay2)}" stroke="${DOOR}" stroke-width="1.5"/>`;
    s += `<path d="M ${r2(ax2 + Math.cos(ang + 2.6) * hl)} ${r2(ay2 + Math.sin(ang + 2.6) * hl)} L ${r2(ax2)} ${r2(ay2)} L ${r2(ax2 + Math.cos(ang - 2.6) * hl)} ${r2(ay2 + Math.sin(ang - 2.6) * hl)}" fill="none" stroke="${DOOR}" stroke-width="1.5"/>`;
  }

  // ---- stairs (shown on the level they rise from and the one they reach) ------
  for (const st of plan.stairs) {
    if (st.fromLevel !== level && st.fromLevel + 1 !== level) continue;
    const scx = fX(st.x);
    const scy = fY(st.y);
    const sw = 3.6 * PXPF;
    const sd = 4.6 * PXPF;
    s += `<rect x="${r2(scx - sw / 2)}" y="${r2(scy - sd / 2)}" width="${r2(sw)}" height="${r2(sd)}" fill="#c79a68" fill-opacity="0.55" stroke="${FUR_S}" stroke-width="1" data-stair="1"/>`;
    for (let i = 1; i < 5; i++) {
      const yy = scy - sd / 2 + (i * sd) / 5;
      s += `<line x1="${r2(scx - sw / 2)}" y1="${r2(yy)}" x2="${r2(scx + sw / 2)}" y2="${r2(yy)}" stroke="${FUR_S}" stroke-width="1"/>`;
    }
  }

  // ---- room numbers + purpose labels at the anchor (in-room guaranteed) -------
  const roomNumber = new Map<number, number>();
  numbered.forEach((rm, i) => roomNumber.set(rm.id, i + 1));

  let labels = '';
  for (const rm of floor.rooms) {
    if (rm.isCorridor) continue;
    const num = roomNumber.get(rm.id);
    const inRoom = (x: number, y: number): boolean => occ(x, y) === rm.id;
    // contiguous run through the anchor: the width the label may actually use
    let x0 = rm.anchor.cx;
    let x1 = rm.anchor.cx;
    while (inRoom(x0 - 1, rm.anchor.cy)) x0--;
    while (inRoom(x1 + 1, rm.anchor.cy)) x1++;
    let y0 = rm.anchor.cy;
    let y1 = rm.anchor.cy;
    while (inRoom(rm.anchor.cx, y0 - 1)) y0--;
    while (inRoom(rm.anchor.cx, y1 + 1)) y1++;
    const runW = (x1 - x0 + 1) * CELL - 6;
    const runH = (y1 - y0 + 1) * CELL;
    const cx = X(x0) + ((x1 - x0 + 1) * CELL) / 2;
    const cy = Y(rm.anchor.cy) + CELL / 2;
    const fs = 10.5;
    const maxLines = runH >= 2 * fs + 8 ? 2 : 1;
    const lines = fitLabel(rm.purpose.replace(/-/g, ' '), runW, fs, maxLines);
    if (num !== undefined) {
      // room number in the anchor cell's top-left corner
      labels += `<text x="${r2(X(rm.anchor.cx) + 4)}" y="${r2(Y(rm.anchor.cy) + 4)}" text-anchor="start" dominant-baseline="hanging" font-family="Georgia, serif" font-weight="700" font-size="8" fill="${LBL}" stroke="${LBL_S}" stroke-width="1.4" paint-order="stroke" data-room-num="${num}">${num}</text>`;
    }
    if (!lines) continue; // room too small: number-only, no overflowing label
    const lineH = fs + 1.5;
    const startY = cy - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => {
      labels += `<text x="${r2(cx)}" y="${r2(startY + i * lineH)}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif" font-weight="500" font-size="${fs}" fill="${LBL}" stroke="${LBL_S}" stroke-width="${r2(fs * 0.16)}" paint-order="stroke" style="letter-spacing:0.4px" data-room-label="${rm.id}">${escapeXml(line)}</text>`;
    });
  }
  s += labels;

  // ---- living overlay (Task 13): claims, station dots, hearth halo, containers
  // Drawn ONLY from the passed occupancy/manifests/members data — the drawer
  // never reaches into the generator. Absent extras → no group at all.
  const occupancy = options?.occupancy;
  if (occupancy) {
    const hour = Math.min(23, Math.max(0, Math.floor(options?.hour ?? 12)));
    let ov = `<g data-occupancy="1" data-occupancy-hour="${hour}">`;

    // warm halo on every hearth of this floor when the hearth is lit this hour
    if (occupancy.flags.hearthLitHours[hour]) {
      for (const f of floor.furnishings) {
        if (!HEARTH_KINDS.has(f.kind)) continue;
        ov += `<circle cx="${fX(f.x)}" cy="${fY(f.y)}" r="${r2(4.2 * PXPF)}" fill="#ffb347" fill-opacity="0.3" stroke="#e8842e" stroke-opacity="0.5" stroke-width="1" data-hearth-halo="1"/>`;
        ov += `<circle cx="${fX(f.x)}" cy="${fY(f.y)}" r="${r2(2.2 * PXPF)}" fill="#ffd98a" fill-opacity="0.45"/>`;
      }
    }

    // room claim labels: the forSlot tags stacked under the room number
    const claimsByRoom = new Map<number, string[]>();
    for (const c of occupancy.claims) {
      if (c.level !== level) continue;
      const list = claimsByRoom.get(c.roomId) ?? [];
      list.push(c.slotTag);
      claimsByRoom.set(c.roomId, list);
    }
    for (const [roomId, tags] of claimsByRoom) {
      const rm = roomById.get(roomId);
      if (!rm) continue;
      tags.forEach((tag, i) => {
        ov += `<text x="${r2(X(rm.anchor.cx) + 4)}" y="${r2(Y(rm.anchor.cy) + 13 + i * 7.5)}" text-anchor="start" dominant-baseline="hanging" font-family="Georgia, serif" font-style="italic" font-size="6" fill="${LBL}" stroke="${LBL_S}" stroke-width="1" paint-order="stroke" data-claim="${escapeXml(tag)}">${escapeXml(tag)}</text>`;
      });
    }

    // container markers with <title> tooltips listing the manifest entries
    for (const m of options?.manifests ?? []) {
      if (m.level !== level) continue;
      const f = floor.furnishings[m.furnishingIndex];
      if (!f) continue;
      const tip = m.entries.map((e) => `${e.qty}× ${e.itemId}`).join(', ');
      ov += `<g data-container="${escapeXml(m.kind)}"><title>${escapeXml(`${m.kind} (${m.ownerHomeId}): ${tip}`)}</title>` +
        `<text x="${fX(f.x)}" y="${fY(f.y)}" text-anchor="middle" dominant-baseline="central" font-size="8" fill="${LBL}" stroke="${LBL_S}" stroke-width="1.1" paint-order="stroke">⌸</text></g>`;
    }

    // one dot per member at their station this hour (out members have no dot)
    const stationRow = occupancy.stationsByHour[hour] ?? [];
    const colocated = new Map<string, number>();
    for (const st of stationRow) {
      if (st.where !== 'home' || st.level !== level) continue;
      const f = st.furnishingIndex !== undefined ? floor.furnishings[st.furnishingIndex] : undefined;
      let px: number;
      let py: number;
      if (f) {
        px = fX(f.x);
        py = fY(f.y);
      } else {
        // No-fallback: a HOME station must resolve to a real room. A missing
        // room is a schedule/plan mismatch, not a silent (0,0) placement at the
        // sheet corner — mirrors the 3D bridge's stationToFeet.
        const rm = st.roomId !== undefined ? roomById.get(st.roomId) : undefined;
        if (!rm) {
          throw new Error(
            `renderBlueprintSvg: home station for member ${st.memberIndex} at hour ${hour} ` +
              `has no resolvable room (roomId=${st.roomId ?? 'none'}, level=${level})`,
          );
        }
        px = X(rm.anchor.cx) + CELL / 2;
        py = Y(rm.anchor.cy) + CELL / 2;
      }
      const key = `${px},${py}`;
      const n = colocated.get(key) ?? 0;
      colocated.set(key, n + 1);
      if (n > 0) {
        // deterministic fan so co-located dots (shared table/hearth) stay readable
        const ang = n * 2.4;
        px += Math.cos(ang) * 7;
        py += Math.sin(ang) * 7;
      }
      const given = options?.members?.[st.memberIndex]?.name.split(' ')[0] ?? `#${st.memberIndex}`;
      ov += `<circle cx="${r2(px)}" cy="${r2(py)}" r="3.2" fill="#d9542b" stroke="#3a1408" stroke-width="1" data-station="${st.activity}"/>`;
      ov += `<text x="${r2(px)}" y="${r2(py + 4.5)}" text-anchor="middle" dominant-baseline="hanging" font-family="Georgia, serif" font-weight="700" font-size="6.5" fill="${LBL}" stroke="${LBL_S}" stroke-width="1" paint-order="stroke">${escapeXml(given)}</text>`;
    }

    ov += `</g>`;
    s += ov;
  }

  // ---- roof overlay (BGv2 Task 6): drafting-ink roof plan over the sheet ------
  // Drawn ONLY from the passed RoofPlan (feet, same frame as the rooms). Absent
  // extra → no group at all; existing callers unchanged.
  const roof = options?.roof;
  if (roof) {
    let rf = `<defs><pattern id="bproofhatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<line x1="0" y1="0" x2="0" y2="5" stroke="${INK}" stroke-width="1" opacity="0.55"/></pattern></defs>`;
    rf += `<g data-roof="1">`;
    // plane outlines, faintly tinted (z is dropped — this is the plan view)
    roof.planes.forEach((p, i) => {
      const pts = p.pts.map(([px, py]) => `${fX(px)},${fY(py)}`).join(' ');
      rf += `<polygon points="${pts}" fill="${INK}" fill-opacity="0.06" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.55" stroke-linejoin="round" data-roof-plane="${i}"/>`;
    });
    // valleys dashed UNDER the solid ridges
    roof.valleys.forEach((v, i) => {
      rf += `<line x1="${fX(v.x1)}" y1="${fY(v.y1)}" x2="${fX(v.x2)}" y2="${fY(v.y2)}" stroke="${INK}" stroke-width="1.1" stroke-dasharray="4 3" stroke-linecap="round" data-roof-valley="${i}"/>`;
    });
    roof.ridges.forEach((rg2, i) => {
      rf += `<line x1="${fX(rg2.x1)}" y1="${fY(rg2.y1)}" x2="${fX(rg2.x2)}" y2="${fY(rg2.y2)}" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" data-roof-ridge="${i}"/>`;
    });
    // chimneys: small filled square with a sheet-colored flue
    const chFt = 2.4;
    for (let i = 0; i < roof.chimneys.length; i++) {
      const c = roof.chimneys[i];
      const half = (chFt / 2) * PXPF;
      rf += `<g data-roof-chimney="${i}"><rect x="${r2(fX(c.x) - half)}" y="${r2(fY(c.y) - half)}" width="${r2(half * 2)}" height="${r2(half * 2)}" fill="${INK}" stroke="${WALL_EDGE}" stroke-width="0.5"/>` +
        `<rect x="${r2(fX(c.x) - half * 0.45)}" y="${r2(fY(c.y) - half * 0.45)}" width="${r2(half * 0.9)}" height="${r2(half * 0.9)}" fill="${SHEET}"/></g>`;
    }
    // dormers: carets pointing along the outward normal of the pierced side
    for (let i = 0; i < roof.dormers.length; i++) {
      const dm = roof.dormers[i];
      const px = fX(dm.x);
      const py = fY(dm.y);
      const out = 2.6 * PXPF; // caret length, feet → px
      const side = 1.8 * PXPF; // half base width
      // perpendicular of the outward normal spans the caret base
      const b1x = px - dm.ny * side - dm.nx * out * 0.5;
      const b1y = py + dm.nx * side - dm.ny * out * 0.5;
      const b2x = px + dm.ny * side - dm.nx * out * 0.5;
      const b2y = py - dm.nx * side - dm.ny * out * 0.5;
      const ax = px + dm.nx * out * 0.5;
      const ay = py + dm.ny * out * 0.5;
      rf += `<path d="M ${r2(b1x)} ${r2(b1y)} L ${r2(ax)} ${r2(ay)} L ${r2(b2x)} ${r2(b2y)}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" data-roof-dormer="${i}"/>`;
    }
    // tower caps: hatched footprint (circle for cones, square for pyramids)
    for (let i = 0; i < roof.towerCaps.length; i++) {
      const tc = roof.towerCaps[i];
      if (tc.form === 'cone') {
        rf += `<circle cx="${fX(tc.x)}" cy="${fY(tc.y)}" r="${r2((Math.min(tc.w, tc.d) / 2) * PXPF)}" fill="url(#bproofhatch)" stroke="${INK}" stroke-width="1" data-roof-cap="${i}"/>`;
      } else {
        rf += `<rect x="${r2(fX(tc.x) - (tc.w / 2) * PXPF)}" y="${r2(fY(tc.y) - (tc.d / 2) * PXPF)}" width="${r2(tc.w * PXPF)}" height="${r2(tc.d * PXPF)}" fill="url(#bproofhatch)" stroke="${INK}" stroke-width="1" data-roof-cap="${i}"/>`;
      }
    }
    rf += `</g>`;
    s += rf;
  }

  // ---- keyed legend column -----------------------------------------------------
  // lx computed in the sheet-layout block (clears the exterior apron on the right)
  let legend = `<g data-legend="1">`;
  legend += `<text x="${lx}" y="${ML}" font-family="Georgia, serif" font-weight="700" font-size="10" fill="${INK}" dominant-baseline="hanging">Key — ${escapeXml(floorName(level))}</text>`;
  numbered.forEach((rm, i) => {
    legend += `<text x="${lx}" y="${ML + 16 + i * 13}" font-family="Georgia, serif" font-size="9.5" fill="${INK}" dominant-baseline="hanging">${i + 1} · ${escapeXml(rm.purpose.replace(/-/g, ' '))}</text>`;
  });
  legend += `</g>`;
  s += legend;

  // ---- north arrow (top-right of the sheet grid) --------------------------------
  const nx0 = ML + gridW - 2;
  const ny0 = 8;
  s += `<g data-north="1"><line x1="${r2(nx0)}" y1="${r2(ny0 + 16)}" x2="${r2(nx0)}" y2="${r2(ny0 + 3)}" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M ${r2(nx0 - 3)} ${r2(ny0 + 7)} L ${r2(nx0)} ${r2(ny0 + 1)} L ${r2(nx0 + 3)} ${r2(ny0 + 7)} Z" fill="${INK}"/>` +
    `<text x="${r2(nx0 + 6)}" y="${r2(ny0 + 12)}" font-family="Georgia, serif" font-weight="700" font-size="9" fill="${INK}">N</text></g>`;

  // ---- scale bar + title block ---------------------------------------------------
  // stripY computed in the sheet-layout block (clears the apron + legend column)
  const barPx = 10 * PXPF;
  s += `<g data-scale-bar="1">` +
    `<rect x="${ML}" y="${r2(stripY + 12)}" width="${r2(barPx)}" height="4" fill="${WALL_O}"/>` +
    `<rect x="${ML}" y="${r2(stripY + 12)}" width="${r2(barPx / 2)}" height="4" fill="${SHEET}" stroke="${WALL_O}" stroke-width="0.6"/>` +
    `<text x="${r2(ML + barPx + 5)}" y="${r2(stripY + 16)}" font-family="Georgia, serif" font-size="9" fill="${WALL_O}">10 ft</text>` +
    `</g>`;
  const typeName = plan.type.charAt(0).toUpperCase() + plan.type.slice(1);
  const seedText = options?.seed !== undefined ? ` · seed ${escapeXml(String(options.seed))}` : '';
  const tbX = ML + barPx + 60;
  s += `<g data-title-block="1">` +
    `<rect x="${r2(tbX)}" y="${r2(stripY + 2)}" width="${r2(W - tbX - 8)}" height="${TITLE_H - 8}" fill="none" stroke="${INK}" stroke-width="1"/>` +
    `<text x="${r2(tbX + 8)}" y="${r2(stripY + 14)}" font-family="Georgia, serif" font-weight="700" font-size="11" fill="${INK}">${escapeXml(typeName)}</text>` +
    `<text x="${r2(tbX + 8)}" y="${r2(stripY + 26)}" font-family="Georgia, serif" font-size="9" fill="${INK}">${escapeXml(floorName(level))}${seedText} · ${plan.widthFt}×${plan.depthFt} ft · 1 square = 5 ft</text>` +
    `</g>`;

  s += '</svg>';
  return s;
}
