/**
 * @file renderBlueprintSvg.ts
 * @description Pure 2D module-map blueprint renderer over an InteriorPlan.
 *
 * Part of the building-blueprint pipeline (design the 2D blueprint first, build
 * 3D from the same data). This is the shared, THREE-free view: it takes the
 * OWNED interior generator's `InteriorPlan` (rooms/doorways/furnishings/stairs,
 * feet-canon 5 ft grid) and returns an SVG string. No DOM, no React — so it
 * runs headless for golden rendering and in the browser alike.
 *
 * WALL MODEL (decided 2026-07-05): walls are drawn on the line between tiles as
 * a real-thickness band that straddles the boundary — thick outer (1.6 ft),
 * thin inner (0.6 ft). A wall never fills a tile, so rooms keep full size and
 * the band centering also closes the corner gaps that thin strokes left open.
 *
 * When the richer BlueprintPlan lands (plan Task 1), this renderer switches to
 * consume it; for now it reads InteriorPlan so we can converge + eyeball today.
 */

import type {
  InteriorPlan,
  InteriorRoom,
  InteriorDoorway,
  InteriorFurnishing,
  RoomRole,
} from './types';
import { EXTERIOR } from './types';

const CELL = 25; // px per 5 ft cell
const PXPF = CELL / 5; // px per foot
const M = 26; // sheet margin px

const SHEET = '#efe6d2';
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
const MED = '#b98a3d';

const OUTER_FT = 1.6; // outer wall thickness, feet
const INNER_FT = 0.6; // interior partition thickness, feet
const DOOR_FT = 3; // door opening / leaf, feet (not a full 5 ft cell)

const ROLE_LABEL: Record<RoomRole, string> = {
  hall: 'hall',
  bedroom: 'bedroom',
  kitchen: 'kitchen',
  storage: 'storage',
  workshop: 'workshop',
  shopfloor: 'shop floor',
};

interface FloorData {
  rooms: InteriorRoom[];
  doorways: InteriorDoorway[];
  furnishings: InteriorFurnishing[];
}

function floorAt(plan: InteriorPlan, level: number): FloorData {
  if (level <= 0) return { rooms: plan.rooms, doorways: plan.doorways, furnishings: plan.furnishings };
  const f = plan.upperFloors[level - 1];
  return { rooms: f.rooms, doorways: f.doorways, furnishings: f.furnishings };
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Render one floor of an InteriorPlan as a module-style blueprint SVG string. */
export function renderBlueprintSvg(plan: InteriorPlan, level = 0): string {
  const cols = Math.round(plan.widthFt / 5);
  const rows = Math.round(plan.depthFt / 5);
  const floor = floorAt(plan, level);

  const W = M * 2 + cols * CELL;
  const H = M * 2 + rows * CELL;
  const X = (c: number): number => r2(M + c * CELL);
  const Y = (c: number): number => r2(M + c * CELL);
  const fX = (ft: number): number => r2(M + ft * PXPF);
  const fY = (ft: number): number => r2(M + ft * PXPF);

  // occupancy grid from room rects (rooms tile the rectangular envelope)
  const rg: number[][] = [];
  for (let y = 0; y < rows; y++) rg.push(new Array<number>(cols).fill(-1));
  for (const rm of floor.rooms) {
    const cx0 = Math.round(rm.x / 5);
    const cy0 = Math.round(rm.y / 5);
    const cw = Math.round(rm.w / 5);
    const cd = Math.round(rm.d / 5);
    for (let y = cy0; y < cy0 + cd; y++)
      for (let x = cx0; x < cx0 + cw; x++)
        if (y >= 0 && y < rows && x >= 0 && x < cols) rg[y][x] = rm.id;
  }
  const occ = (x: number, y: number): number | null =>
    x < 0 || y < 0 || x >= cols || y >= rows || rg[y][x] < 0 ? null : rg[y][x];

  // door + entry edge keys (matching InteriorDoorway axis convention)
  const doors: Record<string, boolean> = {};
  let entryKey: string | null = null;
  for (const dw of floor.doorways) {
    const key =
      dw.axis === 'y'
        ? `v:${Math.round(dw.x / 5)}:${Math.floor(dw.y / 5)}`
        : `h:${Math.floor(dw.x / 5)}:${Math.round(dw.y / 5)}`;
    if (dw.a === EXTERIOR || dw.b === EXTERIOR) entryKey = key;
    else doors[key] = true;
  }

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`;
  s += `<title>Blueprint floor ${level}</title>`;
  const mcx = M + (cols * CELL) / 2;
  const mcy = M + (rows * CELL) / 2;
  // radius generous + a warm (not near-black) outer stop, so corners stay lit
  const rad = Math.hypot(cols, rows) * CELL * 0.62;
  s += `<defs><radialGradient id="bpf" gradientUnits="userSpaceOnUse" cx="${r2(mcx)}" cy="${r2(mcy)}" r="${r2(rad)}"><stop offset="0" stop-color="#d3a570"/><stop offset="0.7" stop-color="#bd8f5c"/><stop offset="1" stop-color="#a3773f"/></radialGradient></defs>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="${SHEET}"/>`;

  // floor + grid + plank
  let floorSvg = '';
  let grid = '';
  let plank = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (occ(x, y) == null) continue;
      floorSvg += `<rect x="${X(x)}" y="${Y(y)}" width="${CELL}" height="${CELL}" fill="url(#bpf)"/>`;
      grid += `<line x1="${X(x)}" y1="${Y(y)}" x2="${X(x + 1)}" y2="${Y(y)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
      grid += `<line x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(y + 1)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
      plank += `<line x1="${X(x + 0.5)}" y1="${Y(y)}" x2="${X(x + 0.5)}" y2="${Y(y + 1)}" stroke="${PLANK}" stroke-width="1"/>`;
    }
  }
  for (let y = 0; y < rows; y++) if (occ(cols - 1, y) != null) grid += `<line x1="${X(cols)}" y1="${Y(y)}" x2="${X(cols)}" y2="${Y(y + 1)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
  for (let x = 0; x < cols; x++) if (occ(x, rows - 1) != null) grid += `<line x1="${X(x)}" y1="${Y(rows)}" x2="${X(x + 1)}" y2="${Y(rows)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="2 3"/>`;
  s += floorSvg + plank + grid;

  // hall medallion
  const hall = floor.rooms.find((rm) => rm.role === 'hall');
  if (hall && (hall.w / 5) * (hall.d / 5) >= 9) {
    const cxx = fX(hall.x + hall.w / 2);
    const cyy = fY(hall.y + hall.d / 2);
    const mr = Math.min(hall.w, hall.d) * PXPF * 0.3;
    s += `<circle cx="${r2(cxx)}" cy="${r2(cyy)}" r="${r2(mr)}" fill="none" stroke="${MED}" stroke-width="1.4" opacity="0.5"/>`;
    s += `<circle cx="${r2(cxx)}" cy="${r2(cyy)}" r="${r2(mr * 0.6)}" fill="none" stroke="${MED}" stroke-width="1" opacity="0.4"/>`;
  }

  // furniture
  const box = (fx: number, fy: number, wFt: number, dFt: number, rot: number, solid: boolean): string => {
    const w = wFt * PXPF;
    const d = dFt * PXPF;
    const cx = fX(fx);
    const cy = fY(fy);
    const t = rot ? ` transform="rotate(${rot} ${r2(cx)} ${r2(cy)})"` : '';
    return `<rect x="${r2(cx - w / 2)}" y="${r2(cy - d / 2)}" width="${r2(w)}" height="${r2(d)}" rx="2" fill="${FUR}" fill-opacity="${solid ? 0.85 : 1}" stroke="${FUR_S}" stroke-width="1"${t}/>`;
  };
  const circ = (fx: number, fy: number, rFt: number): string =>
    `<circle cx="${fX(fx)}" cy="${fY(fy)}" r="${r2(rFt * PXPF)}" fill="none" stroke="${FUR_S}" stroke-width="1.1"/>`;
  let furSvg = '';
  for (const f of floor.furnishings) {
    switch (f.kind) {
      case 'table': furSvg += box(f.x, f.y, 7, 4.5, f.rotation, false); break;
      case 'hearth': furSvg += box(f.x, f.y, 5.5, 2, f.rotation, true); break;
      case 'counter': furSvg += box(f.x, f.y, 8, 2, f.rotation, false); break;
      case 'shelf': furSvg += box(f.x, f.y, 6, 1.5, f.rotation, true); break;
      case 'barrel': furSvg += circ(f.x, f.y, 1.6); break;
      case 'crate': furSvg += box(f.x, f.y, 2.6, 2.6, f.rotation, true); break;
      case 'chest': furSvg += box(f.x, f.y, 3.2, 2, f.rotation, true); break;
      case 'workbench': furSvg += box(f.x, f.y, 7, 2, f.rotation, false); break;
      case 'bed': furSvg += box(f.x, f.y, 6, 3.4, f.rotation, false) + box(f.x, f.y - 1.3, 6, 0.9, f.rotation, true); break;
      default: furSvg += box(f.x, f.y, 2.5, 2.5, f.rotation, true);
    }
  }
  s += furSvg;

  // ---- WALLS as real-thickness bands on the line (thick outer, thin inner) ----
  // A band is a filled rect centered on the grid line. Perpendicular bands
  // overlap at shared corners, so corners fill solid (no gaps).
  const outerT = OUTER_FT * PXPF;
  const innerT = INNER_FT * PXPF;
  const doorGap = DOOR_FT * PXPF;
  const jambFt = (5 - DOOR_FT) / 2; // 1 ft each side of a door opening
  let bands = '';

  const vBand = (gx: number, gy: number, t: number, fill: string): string => {
    const px = X(gx) - t / 2;
    return `<rect x="${r2(px)}" y="${Y(gy)}" width="${r2(t)}" height="${CELL}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>`;
  };
  const hBand = (gx: number, gy: number, t: number, fill: string): string => {
    const py = Y(gy) - t / 2;
    return `<rect x="${X(gx)}" y="${r2(py)}" width="${CELL}" height="${r2(t)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>`;
  };
  // vertical door band = two jambs (leaves the middle DOOR_FT open)
  const vDoorBand = (gx: number, gy: number, t: number, fill: string): string => {
    const px = X(gx) - t / 2;
    const j = jambFt * PXPF;
    return (
      `<rect x="${r2(px)}" y="${Y(gy)}" width="${r2(t)}" height="${r2(j)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>` +
      `<rect x="${r2(px)}" y="${r2(Y(gy + 1) - j)}" width="${r2(t)}" height="${r2(j)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>`
    );
  };
  const hDoorBand = (gx: number, gy: number, t: number, fill: string): string => {
    const py = Y(gy) - t / 2;
    const j = jambFt * PXPF;
    return (
      `<rect x="${X(gx)}" y="${r2(py)}" width="${r2(j)}" height="${r2(t)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>` +
      `<rect x="${r2(X(gx + 1) - j)}" y="${r2(py)}" width="${r2(j)}" height="${r2(t)}" fill="${fill}" stroke="${WALL_EDGE}" stroke-width="0.4"/>`
    );
  };

  // door leaf + swing, sized to DOOR_FT
  const vDoorLeaf = (gx: number, gy: number): string => {
    const dir = occ(gx, gy) != null ? 1 : -1;
    const sw = dir > 0 ? 1 : 0;
    const g = doorGap;
    const hy = Y(gy) + (CELL - g) / 2; // hinge at top of the opening
    return (
      `<line x1="${X(gx)}" y1="${r2(hy)}" x2="${r2(X(gx) + dir * g)}" y2="${r2(hy)}" stroke="${DOOR}" stroke-width="1.4"/>` +
      `<path d="M ${r2(X(gx) + dir * g)} ${r2(hy)} A ${r2(g)} ${r2(g)} 0 0 ${sw} ${X(gx)} ${r2(hy + g)}" fill="none" stroke="${DOOR}" stroke-width="1" opacity="0.5"/>`
    );
  };
  const hDoorLeaf = (gx: number, gy: number): string => {
    const dir = occ(gx, gy) != null ? 1 : -1;
    const sw = dir > 0 ? 0 : 1;
    const g = doorGap;
    const hx = X(gx) + (CELL - g) / 2;
    return (
      `<line x1="${r2(hx)}" y1="${Y(gy)}" x2="${r2(hx)}" y2="${r2(Y(gy) + dir * g)}" stroke="${DOOR}" stroke-width="1.4"/>` +
      `<path d="M ${r2(hx)} ${r2(Y(gy) + dir * g)} A ${r2(g)} ${r2(g)} 0 0 ${sw} ${r2(hx + g)} ${Y(gy)}" fill="none" stroke="${DOOR}" stroke-width="1" opacity="0.5"/>`
    );
  };

  let doorLeaves = '';
  let windows = '';
  const outerEdges: Array<['v' | 'h', number, number]> = [];

  for (let vx = 0; vx <= cols; vx++) {
    for (let vy = 0; vy < rows; vy++) {
      const a = occ(vx - 1, vy);
      const b = occ(vx, vy);
      if (a == null && b == null) continue;
      if (a === b) continue;
      const outer = a == null || b == null;
      const t = outer ? outerT : innerT;
      const fill = outer ? WALL_O : WALL_I;
      const k = `v:${vx}:${vy}`;
      if (k === entryKey || doors[k]) {
        bands += vDoorBand(vx, vy, t, fill);
        doorLeaves += vDoorLeaf(vx, vy);
        continue;
      }
      if (outer) outerEdges.push(['v', vx, vy]);
      bands += vBand(vx, vy, t, fill);
    }
  }
  for (let hy = 0; hy <= rows; hy++) {
    for (let hx = 0; hx < cols; hx++) {
      const a = occ(hx, hy - 1);
      const b = occ(hx, hy);
      if (a == null && b == null) continue;
      if (a === b) continue;
      const outer = a == null || b == null;
      const t = outer ? outerT : innerT;
      const fill = outer ? WALL_O : WALL_I;
      const k = `h:${hx}:${hy}`;
      if (k === entryKey || doors[k]) {
        bands += hDoorBand(hx, hy, t, fill);
        doorLeaves += hDoorLeaf(hx, hy);
        continue;
      }
      if (outer) outerEdges.push(['h', hx, hy]);
      bands += hBand(hx, hy, t, fill);
    }
  }

  // windows: light band segment across the middle of some outer edges
  let wseed = (cols * 73856093) ^ (rows * 19349663) ^ (level * 83492791);
  const wrand = (): number => {
    wseed = (wseed + 0x6d2b79f5) | 0;
    let x = Math.imul(wseed ^ (wseed >>> 15), 1 | wseed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (const e of outerEdges) {
    if (wrand() > 0.18) continue;
    if (e[0] === 'v') windows += `<rect x="${r2(X(e[1]) - outerT / 2)}" y="${r2(Y(e[2] + 0.28))}" width="${r2(outerT)}" height="${r2(CELL * 0.44)}" fill="${WIN}"/>`;
    else windows += `<rect x="${r2(X(e[1] + 0.28))}" y="${r2(Y(e[2]) - outerT / 2)}" width="${r2(CELL * 0.44)}" height="${r2(outerT)}" fill="${WIN}"/>`;
  }

  s += bands + windows + doorLeaves;

  // entrance arrow (ground floor only)
  if (entryKey) {
    const [et, egxs, egys] = entryKey.split(':');
    const egx = +egxs;
    const egy = +egys;
    const arrow = (x1: number, y1: number, x2: number, y2: number): string => {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const a1 = ang + 2.6;
      const a2 = ang - 2.6;
      const l = 6;
      return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${DOOR}" stroke-width="1.5"/><path d="M ${r2(x2 + Math.cos(a1) * l)} ${r2(y2 + Math.sin(a1) * l)} L ${r2(x2)} ${r2(y2)} L ${r2(x2 + Math.cos(a2) * l)} ${r2(y2 + Math.sin(a2) * l)}" fill="none" stroke="${DOOR}" stroke-width="1.5"/>`;
    };
    if (et === 'h') {
      const below = occ(egx, egy) != null;
      const d = below ? 1 : -1;
      s += arrow(X(egx + 0.5), Y(egy) - d * 22, X(egx + 0.5), Y(egy) - d * 8);
    } else {
      const right = occ(egx, egy) != null;
      const d = right ? 1 : -1;
      s += arrow(X(egx) - d * 22, Y(egy + 0.5), X(egx) - d * 8, Y(egy + 0.5));
    }
  }

  // room labels (centered, size-independent baseline)
  let labels = '';
  for (const rm of floor.rooms) {
    const cw = rm.w / 5;
    const cd = rm.d / 5;
    if (cw < 2 || cd < 1.5) continue;
    const fs = Math.min(15, Math.max(11, cw * 3));
    labels += `<text x="${fX(rm.x + rm.w / 2)}" y="${r2(fY(rm.y + rm.d / 2))}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif" font-weight="500" font-size="${r2(fs)}" fill="${LBL}" stroke="${LBL_S}" stroke-width="${r2(fs * 0.16)}" paint-order="stroke" style="letter-spacing:0.5px">${ROLE_LABEL[rm.role] ?? rm.role}</text>`;
  }
  s += labels;

  // stairs
  for (const st of plan.stairs) {
    if (st.fromFloor !== level && st.fromFloor + 1 !== level) continue;
    const scx = fX(st.x);
    const scy = fY(st.y);
    const sw = 3.6 * PXPF;
    const sd = 5.5 * PXPF;
    let stg = `<rect x="${r2(scx - sw / 2)}" y="${r2(scy - sd / 2)}" width="${r2(sw)}" height="${r2(sd)}" fill="#c79a68" fill-opacity="0.5" stroke="${FUR_S}" stroke-width="1"/>`;
    for (let i = 0; i <= 5; i++) {
      const yy = scy - sd / 2 + (i * sd) / 5;
      stg += `<line x1="${r2(scx - sw / 2)}" y1="${r2(yy)}" x2="${r2(scx + sw / 2)}" y2="${r2(yy)}" stroke="${FUR_S}" stroke-width="1"/>`;
    }
    s += stg;
  }

  // graphic scale bar (10 ft) bottom-left of the sheet margin
  const barFt = 10;
  const barPx = barFt * PXPF;
  const bx = M;
  const by = H - 12;
  s += `<g data-scale-bar="1">`;
  s += `<rect x="${bx}" y="${r2(by)}" width="${r2(barPx)}" height="4" fill="${WALL_O}"/>`;
  s += `<rect x="${bx}" y="${r2(by)}" width="${r2(barPx / 2)}" height="4" fill="${SHEET}" stroke="${WALL_O}" stroke-width="0.5"/>`;
  s += `<text x="${r2(bx + barPx + 5)}" y="${r2(by + 4)}" font-family="Georgia, serif" font-size="9" fill="${WALL_O}">10 ft</text>`;
  s += `</g>`;

  s += '</svg>';
  return s;
}
