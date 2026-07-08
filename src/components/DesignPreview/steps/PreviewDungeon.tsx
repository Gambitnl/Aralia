/**
 * @file PreviewDungeon.tsx
 * @description Design-preview surface for the procedural dungeon generator
 * (`src/systems/worldforge/dungeon/generateDungeon.ts`). Draws the plan as a
 * hand-inked map sheet: the plan is rendered to an offscreen canvas and blitted
 * onto warm parchment at a small seed-derived rotation, with a title
 * cartouche, legend, and a double-rule frame. Theme (crypt / cavern / frost /
 * sewer / fungal) drives the palette, the wall treatment (coursed block /
 * ragged rock / rime), the surrounding rock, and the décor glyphs.
 *
 * History-first additions (Task 7, matching the approved layout mocks in
 * .agent/scratch/dungeon-layout-mocks.html):
 * - per-cell event overlays (water / rubble / ice / bloom / scorch) painted
 *   UNDER the ink pass,
 * - doors by state (open gap / leaf / BRICKED red-brick patch / secret dash),
 * - loop-edge tunnels get a rough hand-cut outline (dug, not built),
 * - only event-touched rooms are numbered (keyed-map convention) with the
 *   keyed notes listed under the sheet, plus a History event-log panel,
 * - `asOfYearsAgo` scrubber: the dungeon as it was N years ago (older = fewer
 *   scars — the bought-in-town outdated map).
 *
 * Rendering principles (from the 2026-07-06 aesthetics critique wave):
 * one ink hand everywhere (jittered vertices, consistent weights), strong
 * value hierarchy (near-black walls, light floors, whispered detail), warm
 * paper for every theme (cold is an accent, not a wash), no radial vignette.
 * Rendering-only jitter comes from coordinate hashes — no Math.random feeds
 * anything that looks like data.
 *
 * Linework (WS4, 2026-07-07 aesthetics wave): the wall stroke is redrawn as a
 * hand-inked line, not a raster trace. ORGANIC rooms (ellipse/octagon/diamond)
 * have their cell staircase replaced by a Chaikin-smoothed closed curve (traced
 * via {@link traceContours} + {@link chaikin}), so a "circular" cavern reads as
 * one continuous inked cave wall; the dark wall band is recut to follow that
 * curve too, so the OUTER silhouette is a curve, not a chunky octagon. RECT
 * rooms + corridors keep crisp orthogonal walls, but every stroke now carries
 * hand-ink PRESSURE — weight swells on the SE (shadow) side and tapers on the
 * NW (lit) side under the sheet's single upper-left light — plus corner blots.
 * Corridors gain CRAFT: a centre runner reads main arteries wider than spurs,
 * every corridor→room mouth gets a JAMB (dark reveals narrowing the opening +
 * a threshold tick), tees get junction blots, and dug tunnels stay rougher.
 * One pen draws the whole sheet; only the vocabulary (curve vs orthogonal)
 * changes with the room shape.
 *
 * Eyeball surface (Aralia visual-inspection rule) — bitmap is 5 ft cells;
 * entity coordinates arrive in plot-local feet. Pin seeds with `?dseed=<n>`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateDungeon } from '../../../systems/worldforge/dungeon/generateDungeon';
import {
  CellKind,
  OverlayKind,
  type DungeonPlan,
  type DungeonProp,
  type DungeonRoom,
  type DungeonTheme,
  type RoomShape,
  type RoomType,
} from '../../../systems/worldforge/dungeon/types';

// ── theme-keyed sheet styles ─────────────────────────────────────────────────

/**
 * A theme's OWNABLE color story. Every color the drawer paints is pulled from
 * the active theme's palette here — no warm constant is shared across themes,
 * so a thumbnail alone tells you crypt from frost from fungal (the 2026-07-07
 * WS3 repaint: crypt and fungal at one seed must read as two different SHEETS,
 * not one drawing recolored). The triad is (paper substrate · floor tone ·
 * wall-ink tone) + one signature accent; the frame, cartouche, grid, hatching,
 * per-room tone, carve-shadow, and masonry ticks ALL shift with it. The value
 * ladder from WS1 survives: `wallBody`/`ink` stay the darkest mass, `floor`
 * stays light-but-tinted, everything between is a whispered mid-tone.
 */
interface SheetStyle {
  /** Paper substrate — the sheet's temperature. Warm for warm biomes; frost
   * keeps a still-warm pale parchment (cold lives in the ACCENTS, never a gray
   * wash — the prior lesson). */
  paper: string;
  paperMottle: string;
  /** Room floor — light, but carrying the theme's tint (bone / ochre / rime /
   * brackish / mauve), never the same cream across themes. */
  floor: string;
  corridorShade: string;
  /** Near-black masonry — the value anchor, tinted toward the theme's ink hue. */
  wallBody: string;
  ink: string;
  gridDash: string;
  hatch: string;
  doorLeaf: string;
  torch: string;
  /** The theme's signature accent hue (oxblood / verdigris / ice-blue / bilious
   * green / spore-cyan). Drives keyed-room pooling, ice cracks, bloom caps,
   * torch pools — the one saturated note that names the biome. */
  accent: string;
  /** Cartographic WATER treatment (WS6). A flood must read as WATER, not a flat
   * cyan blob: the drawer paints a depth gradient (shallow shore → deep center),
   * a darker shoreline edge, concentric contours, and wavelet ticks — all in
   * these theme-tinted hues so a sewer reads brackish-green, frost pale ice-blue,
   * cavern black-still. `waterShallow` = the lapping edge; `waterDeep` = the deep
   * centre; `waterEdge` = the shoreline/contour/ripple ink (an rgba prefix, the
   * drawer appends alpha + ')'). */
  waterShallow: string;
  waterDeep: string;
  waterEdge: string;
  /** Inset carve-shadow just inside every wall (rooms read excavated). Tinted
   * to the ink hue so the shadow belongs to this sheet's stone. */
  floorShadow: string;
  /** Per-room tone jitter, drawn as two rgba prefixes: `roomShadeDark` (a faint
   * theme-tinted deepening) and `roomShadeLight` (a faint lift). The drawer
   * appends the alpha + ')'. */
  roomShadeDark: string;
  roomShadeLight: string;
  /** Masonry highlight tick along coursed walls (was a hardcoded warm cream). */
  courseTick: string;
  /** The four corner stains bleeding in from the deckle — theme-tinted. */
  cornerStain: string;
  /** Raw-earth wash on hand-dug tunnels (unpaved — reads different from stone). */
  dugWash: string;
  /** Rubble-pebble body fill (theme-tinted debris, was a hardcoded tan). */
  rubbleFill: string;
  /** 'course' = coursed block ticks, 'ragged' = irregular rock bumps, 'rime' = pale frost inner line. */
  wallTreatment: 'course' | 'ragged' | 'rime';
  /** Draws one exterior glyph centered near (px, py); r ~ cell size. */
  exterior(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, v: number): void;
}

const SHEETS: Record<DungeonTheme, SheetStyle> = {
  // CRYPT — warm bone parchment, cool-gray stone, faint sepia; accent oxblood.
  crypt: {
    paper: '#e8dcb6',
    paperMottle: 'rgba(126, 96, 48, 1)',
    floor: '#f5ecce',
    corridorShade: 'rgba(60, 45, 25, 0.06)',
    wallBody: '#2c2822',
    ink: '#231d15',
    gridDash: 'rgba(90, 75, 50, 0.1)',
    hatch: 'rgba(58, 50, 40, 0.42)',
    doorLeaf: '#4d3820',
    torch: 'rgba(190, 110, 30, 0.7)',
    accent: '#7c2f27',
    // crypt cisterns: cold slate-green still water on bone stone.
    waterShallow: '#9fb0a8',
    waterDeep: '#5f7168',
    waterEdge: 'rgba(40, 54, 48',
    floorShadow: 'rgba(38, 32, 24, 0.16)',
    roomShadeDark: 'rgba(70, 56, 34',
    roomShadeLight: 'rgba(255, 250, 236',
    courseTick: 'rgba(214, 202, 172, 0.24)',
    cornerStain: 'rgba(84, 60, 30',
    dugWash: 'rgba(140, 110, 60, 0.16)',
    rubbleFill: '#8a7a58',
    wallTreatment: 'course',
    exterior: (ctx, px, py, r, v) => {
      ctx.strokeStyle = 'rgba(60, 52, 42, 0.44)';
      ctx.lineWidth = Math.max(1, r * 0.1);
      if (v < 0.5) {
        // leaning gravestone
        ctx.beginPath();
        ctx.moveTo(px - r * 0.16, py + r * 0.3);
        ctx.lineTo(px - r * 0.08, py - r * 0.25);
        ctx.arc(px, py - r * 0.25, r * 0.14, Math.PI, 0, false);
        ctx.lineTo(px + r * 0.2, py + r * 0.3);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(px - r * 0.22, py - r * 0.18);
        ctx.lineTo(px + r * 0.22, py + r * 0.18);
        ctx.moveTo(px - r * 0.22, py + r * 0.18);
        ctx.lineTo(px + r * 0.22, py - r * 0.18);
        ctx.stroke();
      }
    },
  },
  // CAVERN — dim ochre-brown earth, darker umber walls, damp; accent verdigris.
  cavern: {
    paper: '#d7c59b',
    paperMottle: 'rgba(95, 74, 40, 1)',
    floor: '#efe0bd',
    corridorShade: 'rgba(45, 38, 22, 0.09)',
    wallBody: '#241a0d',
    ink: '#1a1207',
    gridDash: 'rgba(70, 60, 40, 0.08)',
    hatch: 'rgba(40, 30, 16, 0.46)',
    doorLeaf: '#443320',
    torch: 'rgba(205, 125, 32, 0.68)',
    accent: '#5c7350',
    // flooded mine galleries: near-black still water, a faint cold sheen.
    waterShallow: '#7c8a86',
    waterDeep: '#38423f',
    waterEdge: 'rgba(22, 28, 26',
    floorShadow: 'rgba(30, 22, 10, 0.18)',
    roomShadeDark: 'rgba(74, 54, 26',
    roomShadeLight: 'rgba(250, 240, 214',
    courseTick: 'rgba(206, 186, 146, 0.2)',
    cornerStain: 'rgba(74, 52, 22',
    dugWash: 'rgba(120, 96, 46, 0.18)',
    rubbleFill: '#7c6a44',
    wallTreatment: 'ragged',
    exterior: (ctx, px, py, r, v) => {
      ctx.fillStyle = 'rgba(42, 32, 18, 0.42)';
      if (v < 0.6) {
        // scree pebbles
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(px + (k - 1) * r * 0.18, py + ((k * 7) % 3 - 1) * r * 0.12, r * (0.08 + (k % 2) * 0.05), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // boulder
        ctx.beginPath();
        ctx.moveTo(px - r * 0.18, py + r * 0.25);
        ctx.lineTo(px, py - r * 0.3);
        ctx.lineTo(px + r * 0.18, py + r * 0.25);
        ctx.closePath();
        ctx.fill();
      }
    },
  },
  // FROST — STILL-WARM pale parchment, cold blue-slate ink, rime accents; the
  // cold lives in the accent + wall ink, NEVER a washed-out gray photo.
  frost: {
    paper: '#e9e4d3',
    paperMottle: 'rgba(96, 106, 112, 1)',
    floor: '#f1f3f0',
    corridorShade: 'rgba(45, 62, 78, 0.07)',
    wallBody: '#242c37',
    ink: '#1a2028',
    gridDash: 'rgba(78, 96, 114, 0.11)',
    hatch: 'rgba(52, 72, 92, 0.42)',
    doorLeaf: '#3e4d5c',
    torch: 'rgba(110, 180, 214, 0.72)',
    accent: '#5b8bb0',
    // frozen pools: pale ice-blue, brighter at the frozen skin, deeper meltwater
    // below; the drawer cracks the surface (see water pass).
    waterShallow: '#cfe0ea',
    waterDeep: '#7ea2be',
    waterEdge: 'rgba(58, 92, 120',
    floorShadow: 'rgba(30, 44, 60, 0.16)',
    roomShadeDark: 'rgba(70, 92, 116',
    roomShadeLight: 'rgba(246, 250, 252',
    courseTick: 'rgba(206, 224, 238, 0.42)',
    cornerStain: 'rgba(56, 78, 100',
    dugWash: 'rgba(96, 120, 140, 0.16)',
    rubbleFill: '#8f9aa0',
    wallTreatment: 'rime',
    exterior: (ctx, px, py, r, v) => {
      ctx.strokeStyle = 'rgba(62, 96, 124, 0.46)';
      ctx.lineWidth = Math.max(1, r * 0.1);
      if (v < 0.55) {
        // rime cracks / bare branch
        ctx.beginPath();
        ctx.moveTo(px - r * 0.2, py + r * 0.22);
        ctx.lineTo(px + r * 0.05, py - r * 0.28);
        ctx.moveTo(px + r * 0.02, py + r * 0.26);
        ctx.lineTo(px + r * 0.24, py - r * 0.18);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(88, 128, 158, 0.4)';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(px + (k - 1) * r * 0.2, py + ((k * 5) % 3 - 1) * r * 0.15, r * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  // SEWER — greenish-tan, algae-tinged stone, brackish; accent bilious green.
  sewer: {
    paper: '#d5cf9c',
    paperMottle: 'rgba(88, 94, 52, 1)',
    floor: '#ebeaca',
    corridorShade: 'rgba(50, 60, 32, 0.09)',
    wallBody: '#1c2112',
    ink: '#14180d',
    gridDash: 'rgba(78, 84, 48, 0.11)',
    hatch: 'rgba(52, 60, 28, 0.44)',
    doorLeaf: '#3a3f2a',
    torch: 'rgba(178, 162, 46, 0.66)',
    accent: '#7e8c22',
    // brackish sewer water: scummy olive-green, a mid-green deep; the murkiest,
    // most opaque water of the five (it is the waterworks theme).
    waterShallow: '#8f9a63',
    waterDeep: '#4a5535',
    waterEdge: 'rgba(30, 38, 18',
    floorShadow: 'rgba(24, 30, 12, 0.17)',
    roomShadeDark: 'rgba(70, 78, 34',
    roomShadeLight: 'rgba(244, 246, 214',
    courseTick: 'rgba(198, 200, 150, 0.22)',
    cornerStain: 'rgba(64, 70, 30',
    dugWash: 'rgba(108, 112, 52, 0.18)',
    rubbleFill: '#79794c',
    wallTreatment: 'course',
    exterior: (ctx, px, py, r, v) => {
      ctx.strokeStyle = 'rgba(62, 70, 34, 0.48)';
      ctx.lineWidth = Math.max(1, r * 0.1);
      if (v < 0.5) {
        // reeds / drips
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(px + (k - 1) * r * 0.18, py - r * 0.2 + (k % 2) * r * 0.1);
          ctx.lineTo(px + (k - 1) * r * 0.18, py + r * 0.05 + (k % 2) * r * 0.1);
          ctx.stroke();
        }
      } else {
        // broken pipe arc
        ctx.beginPath();
        ctx.arc(px, py, r * 0.24, Math.PI * 0.15, Math.PI * 1.1);
        ctx.stroke();
      }
    },
  },
  // FUNGAL — mauve/dusty-rose parchment, violet-gray walls; accent luminous
  // spore. The whole sheet reads BRUISED — a clear violet cast, not neutral
  // cream, so crypt vs fungal at one seed are two different documents.
  fungal: {
    paper: '#dccdcd',
    paperMottle: 'rgba(118, 84, 118, 1)',
    floor: '#eee4ec',
    corridorShade: 'rgba(74, 54, 76, 0.09)',
    wallBody: '#26202c',
    ink: '#1c1622',
    gridDash: 'rgba(104, 82, 108, 0.11)',
    hatch: 'rgba(78, 58, 82, 0.44)',
    doorLeaf: '#4a3f52',
    torch: 'rgba(150, 210, 190, 0.72)',
    accent: '#963f94',
    // spore-clouded water: a bruised violet-gray, tannic and dark.
    waterShallow: '#9a8a9c',
    waterDeep: '#544658',
    waterEdge: 'rgba(34, 24, 38',
    floorShadow: 'rgba(42, 28, 46, 0.17)',
    roomShadeDark: 'rgba(108, 74, 112',
    roomShadeLight: 'rgba(250, 242, 250',
    courseTick: 'rgba(216, 198, 220, 0.24)',
    cornerStain: 'rgba(88, 58, 92',
    dugWash: 'rgba(122, 92, 124, 0.17)',
    rubbleFill: '#806a82',
    wallTreatment: 'ragged',
    exterior: (ctx, px, py, r, v) => {
      if (v < 0.6) {
        // mushroom cluster (mauve caps)
        ctx.strokeStyle = 'rgba(88, 70, 92, 0.52)';
        ctx.fillStyle = 'rgba(128, 92, 128, 0.46)';
        ctx.lineWidth = Math.max(1, r * 0.08);
        for (let k = 0; k < 2; k++) {
          const mx = px + (k - 0.5) * r * 0.3;
          ctx.beginPath();
          ctx.moveTo(mx, py + r * 0.2);
          ctx.lineTo(mx, py - r * 0.02);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(mx, py - r * 0.05, r * 0.13, Math.PI, 0, false);
          ctx.fill();
        }
      } else {
        // spore dots (spore-cyan)
        ctx.fillStyle = 'rgba(120, 176, 168, 0.5)';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(px + (k - 1.5) * r * 0.14, py + ((k * 5) % 3 - 1) * r * 0.12, r * 0.045, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
};

const TYPE_COLOR: Record<RoomType, string> = {
  entrance: '#3fb96b',
  combat: '#8a7a5c',
  elite: '#c9772e',
  treasure: '#d8b33a',
  shrine: '#4aa6d8',
  boss: '#c33b3b',
};

/** Muted floor tint for keyed rooms — stained stone, not paint. */
const TYPE_TINT: Partial<Record<RoomType, { fill: string; pool: string }>> = {
  entrance: { fill: 'rgba(85, 130, 100, 0.1)', pool: 'rgba(85, 130, 100, 0.14)' },
  elite: { fill: 'rgba(160, 105, 55, 0.11)', pool: 'rgba(160, 105, 55, 0.15)' },
  treasure: { fill: 'rgba(165, 140, 60, 0.13)', pool: 'rgba(165, 140, 60, 0.17)' },
  shrine: { fill: 'rgba(80, 125, 155, 0.11)', pool: 'rgba(80, 125, 155, 0.15)' },
  boss: { fill: 'rgba(150, 70, 60, 0.12)', pool: 'rgba(150, 70, 60, 0.16)' },
};

/** Overlay GROUND tint — the flat base wash under each scar kind, over which the
 * WS6 pass draws the kind's real language (water depth+shore+ripple, an angular
 * rubble pile, a spore field, a radiating scorch). Water is NOT in this table —
 * it is painted entirely by the cartographic water pass (theme-tinted depth
 * gradient), never a flat cyan fill. The remaining kinds keep a faint desaturated
 * ground so the mark reads as sitting IN the parchment. */
const OVERLAY_FILL: Record<number, string> = {
  [OverlayKind.Rubble]: '#c7b591',
  [OverlayKind.Ice]: '#d5dee0',
  [OverlayKind.Bloom]: '#b9a7b4',
  [OverlayKind.Scorch]: '#9c8f79',
};

interface Overlays {
  graph: boolean;
  loops: boolean;
  critical: boolean;
  heatmap: boolean;
  rooms: boolean;
  props: boolean;
  spawns: boolean;
  /** Secret doors are hidden until searched — DM toggle reveals them. */
  secrets: boolean;
}

const DEFAULT_OVERLAYS: Overlays = {
  graph: false,
  loops: false,
  critical: false,
  heatmap: false,
  rooms: false,
  props: true,
  spawns: false, // presentation sheet stays quiet; toggle on to see encounters
  secrets: true, // DM sheet default: show the hidden back ways
};

function heat(d: number): string {
  const r = Math.round(255 * Math.min(1, d * 1.4));
  const g = Math.round(200 * (1 - Math.abs(d - 0.5) * 1.6));
  const b = Math.round(255 * Math.max(0, 1 - d * 1.6));
  return `rgb(${r},${Math.max(0, g)},${b})`;
}

/** Deterministic hash in [0, 1) for rendering-only variation. */
function hash2(x: number, y: number, k: number): number {
  let h = (x * 374761393 + y * 668265263 + k * 1274126177) | 0;
  h = ((h ^ (h >>> 13)) * 1103515245) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Reconstructs which corridor cells were DUG (hand-cut robber tunnels) rather
 * than built. Keys on `edge.dug`, NOT `isLoop`: a BUILT cross-cut (a mason's
 * loop door) is a cycle edge too but must render as a CLEAN built door, so only
 * `dug` edges get the rough hand-cut treatment. For each dug edge, BFS through
 * corridor cells that touch no third room — corridors each join exactly two
 * rooms, so the only corridor route between the pair is the tunnel itself.
 */
function computeTunnelCells(plan: DungeonPlan): Set<number> {
  const { W, H, grid, corridor, rooms, edges, cellFt } = plan;
  const result = new Set<number>();
  const loopEdges = edges.filter((e) => e.dug);
  if (loopEdges.length === 0) return result;

  // roomId per room-floor cell (corridor cells stay -1).
  const roomIdOf = new Int16Array(W * H).fill(-1);
  for (const r of rooms) {
    const x0 = Math.round(r.x / cellFt);
    const y0 = Math.round(r.y / cellFt);
    const x1 = x0 + Math.round(r.w / cellFt);
    const y1 = y0 + Math.round(r.h / cellFt);
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const i = y * W + x;
        if (grid[i] === CellKind.Floor && corridor[i] === 0) roomIdOf[i] = r.id;
      }
    }
  }

  const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  const touching = (i: number): Set<number> => {
    const x = i % W;
    const y = (i / W) | 0;
    const s = new Set<number>();
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const id = roomIdOf[ny * W + nx];
      if (id >= 0) s.add(id);
    }
    return s;
  };

  for (const e of loopEdges) {
    const passable = (i: number): boolean => {
      if (grid[i] !== CellKind.Floor || corridor[i] !== 1) return false;
      for (const id of touching(i)) if (id !== e.a && id !== e.b) return false;
      return true;
    };
    // starts: corridor cells hugging room a; goal test: hugging room b.
    const prev = new Int32Array(W * H).fill(-2);
    const queue: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (!passable(i)) continue;
      if (touching(i).has(e.a)) {
        prev[i] = -1;
        queue.push(i);
      }
    }
    let hit = -1;
    for (let q = 0; q < queue.length && hit === -1; q++) {
      const i = queue[q];
      if (touching(i).has(e.b)) {
        hit = i;
        break;
      }
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (prev[n] !== -2 || !passable(n)) continue;
        prev[n] = i;
        queue.push(n);
      }
    }
    for (let c = hit; c >= 0; c = prev[c]) result.add(c);
  }
  return result;
}

/**
 * Corridor HIERARCHY tier per corridor cell (WS8) — so a sprawling network reads
 * with a legible spine instead of tangled same-weight spaghetti. Tier meaning:
 *   2 = ARTERIAL: the cell carries the entrance→boss critical spine (an edge on
 *       the critical path, OR a corridor run whose two rooms are consecutive on
 *       {@link DungeonPlan.criticalRoomIds}). Drawn heaviest — the eye's path.
 *   1 = THROUGH: a secondary passage joining two rooms both of which have graph
 *       degree > 1 (real circulation, not a stub). Medium weight.
 *   0 = SPUR: a dead-end run into a leaf room (degree-1). Lightest.
 * Attribution mirrors {@link computeTunnelCells}: flood each corridor component
 * (corridor cells touching no third room) between its two rooms and tag every
 * cell on that route. Pure/deterministic — no rng. Cells not on any two-room run
 * (rare junction cells touching 3+ rooms) default to THROUGH.
 */
function computeCorridorTiers(plan: DungeonPlan): Uint8Array {
  const { W, H, grid, corridor, rooms, edges, cellFt } = plan;
  const tier = new Uint8Array(W * H); // default 0 (spur) for non-corridor cells

  // roomId per room-floor cell; degree per room; critical-path adjacency set.
  const roomIdOf = new Int16Array(W * H).fill(-1);
  const degreeOf = new Map<number, number>();
  for (const r of rooms) degreeOf.set(r.id, r.degree);
  for (const r of rooms) {
    const x0 = Math.round(r.x / cellFt);
    const y0 = Math.round(r.y / cellFt);
    const x1 = x0 + Math.round(r.w / cellFt);
    const y1 = y0 + Math.round(r.h / cellFt);
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const i = y * W + x;
        if (grid[i] === CellKind.Floor && corridor[i] === 0) roomIdOf[i] = r.id;
      }
    }
  }
  const critPair = new Set<number>();
  const crit = plan.criticalRoomIds;
  for (let i = 0; i + 1 < crit.length; i++) {
    critPair.add(crit[i] * 100000 + crit[i + 1]);
    critPair.add(crit[i + 1] * 100000 + crit[i]);
  }
  // an edge is arterial when flagged critical OR its endpoints are consecutive
  // on the critical room path.
  const isArterialEdge = (a: number, b: number, edgeCritical: boolean): boolean =>
    edgeCritical || critPair.has(a * 100000 + b);

  const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  const touching = (i: number): Set<number> => {
    const x = i % W;
    const y = (i / W) | 0;
    const s = new Set<number>();
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const id = roomIdOf[ny * W + nx];
      if (id >= 0) s.add(id);
    }
    return s;
  };
  const isCorr = (i: number): boolean =>
    grid[i] === CellKind.Floor && corridor[i] === 1;

  // Default every corridor cell to THROUGH (1) so any cell we don't attribute to
  // a specific two-room run still reads as real circulation, not a spur.
  for (let i = 0; i < W * H; i++) if (isCorr(i)) tier[i] = 1;

  for (const e of edges) {
    const arterial = isArterialEdge(e.a, e.b, e.isCritical);
    const degA = degreeOf.get(e.a) ?? 2;
    const degB = degreeOf.get(e.b) ?? 2;
    // spur = a run into a leaf room (degree 1) that is NOT on the spine.
    const spur = !arterial && (degA <= 1 || degB <= 1);
    const t: number = arterial ? 2 : spur ? 0 : 1;
    // flood the corridor cells that connect ONLY e.a and e.b (its own run).
    const passable = (i: number): boolean => {
      if (!isCorr(i)) return false;
      for (const id of touching(i)) if (id !== e.a && id !== e.b) return false;
      return true;
    };
    const prev = new Int32Array(W * H).fill(-2);
    const queue: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (passable(i) && touching(i).has(e.a)) { prev[i] = -1; queue.push(i); }
    }
    let hit = -1;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      if (touching(i).has(e.b)) { hit = i; if (hit >= 0) break; }
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (prev[n] !== -2 || !passable(n)) continue;
        prev[n] = i;
        queue.push(n);
      }
    }
    // Promote every cell on the found route to this edge's tier (max wins, so a
    // shared cell keeps the strongest role — arterial beats through beats spur).
    for (let c = hit; c >= 0; c = prev[c]) if (t > tier[c]) tier[c] = t;
  }
  return tier;
}

/** A cell-corner lattice point (integer grid vertex). */
interface Vtx { x: number; y: number }
/** An ordered boundary polyline in cell-corner space; `closed` = returns to start. */
interface Contour { pts: Vtx[]; closed: boolean }

/**
 * Traces the wall-facing outline of a set of cells into ordered contours by
 * stitching directed cell-face edges head-to-tail. A face is emitted only where
 * the neighbor is NOT part of `member` AND not `skip` (corridor mouths break the
 * loop, leaving an open arc at the opening — exactly where a cave wall should
 * stop). Interior-on-the-right clockwise winding chains adjacent faces into
 * loops; open chains fall out where the ring was broken. Coordinates are in
 * CELLS (multiply by the cell size to draw). This is what lets an "organic" room
 * read as one continuous inked wall instead of a raster staircase.
 */
function traceContours(
  W: number,
  H: number,
  member: (x: number, y: number) => boolean,
  skip: (x: number, y: number) => boolean,
): Contour[] {
  // Directed edges keyed by their START vertex for O(1) head-to-tail stitching.
  const key = (x: number, y: number): number => y * (W + 1) + x;
  const byStart = new Map<number, { ex: number; ey: number }[]>();
  const push = (sx: number, sy: number, ex: number, ey: number): void => {
    const k = key(sx, sy);
    const arr = byStart.get(k);
    if (arr) arr.push({ ex, ey });
    else byStart.set(k, [{ ex, ey }]);
  };
  const wall = (x: number, y: number): boolean => !member(x, y) && !skip(x, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!member(x, y)) continue;
      // clockwise per cell: top, right, bottom, left — emit wall-facing faces.
      if (wall(x, y - 1)) push(x, y, x + 1, y);
      if (wall(x + 1, y)) push(x + 1, y, x + 1, y + 1);
      if (wall(x, y + 1)) push(x + 1, y + 1, x, y + 1);
      if (wall(x - 1, y)) push(x, y + 1, x, y);
    }
  }
  const contours: Contour[] = [];
  const takeFrom = (kx: number, ky: number): { ex: number; ey: number } | null => {
    const arr = byStart.get(key(kx, ky));
    if (!arr || arr.length === 0) return null;
    return arr.pop() ?? null;
  };
  // Prefer starting chains at a vertex that is a genuine loose END (a mouth),
  // so open arcs come out whole; leftovers are closed loops.
  const starts: number[] = [];
  for (const k of byStart.keys()) starts.push(k);
  for (const startK of starts) {
    let arr = byStart.get(startK);
    while (arr && arr.length > 0) {
      const pts: Vtx[] = [];
      let cx = (startK % (W + 1));
      let cy = (startK / (W + 1)) | 0;
      pts.push({ x: cx, y: cy });
      let closed = false;
      for (let guard = 0; guard < W * H * 4 + 16; guard++) {
        const nxt = takeFrom(cx, cy);
        if (!nxt) break;
        cx = nxt.ex;
        cy = nxt.ey;
        if (cx === (startK % (W + 1)) && cy === ((startK / (W + 1)) | 0)) { closed = true; break; }
        pts.push({ x: cx, y: cy });
      }
      if (pts.length >= 2) contours.push({ pts, closed });
      arr = byStart.get(startK);
    }
  }
  return contours;
}

/**
 * Collapses a cell-staircase contour into a hand-drawn curve. Two Chaikin
 * corner-cut passes round the 90° jogs; the result is fed to the caller as
 * control points for a quadratic-through-midpoints stroke. Keeps endpoints of
 * OPEN arcs pinned (a mouth shouldn't drift) while smoothing everything between.
 */
function chaikin(pts: Vtx[], closed: boolean, passes: number): Vtx[] {
  let out = pts;
  for (let p = 0; p < passes; p++) {
    const n = out.length;
    if (n < 3) break;
    const next: Vtx[] = [];
    if (!closed) next.push(out[0]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = out[i];
      const b = out[(i + 1) % n];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    if (!closed) next.push(out[n - 1]);
    out = next;
  }
  return out;
}

// ── WS6 overlay intensity fields ─────────────────────────────────────────────
// A scar (water/rubble/scorch/bloom) must read with DEPTH and ORIGIN, not as a
// flat tint. These pure helpers turn the per-cell `overlay` mask into distance
// fields the drawer paints gradients + contours from — all deterministic (a BFS
// over the seed-fixed grid), never Math.random. Cell index = y*W + x.

/**
 * For every cell whose overlay === `kind` (and which is floor), the chebyshev
 * distance (in cells) OUT to the nearest cell that is NOT this scar — i.e. how
 * deep into the body a cell sits. Shore cells = 1, the deep centre = the max.
 * `maxDepth` is the largest value seen. Returns a Float32 field over W*H (0 off
 * the body) plus that max, so the drawer can normalize shallow→deep.
 */
function scarDepthField(
  W: number,
  H: number,
  isKind: (x: number, y: number) => boolean,
): { depth: Float32Array; maxDepth: number } {
  const depth = new Float32Array(W * H);
  const q: number[] = [];
  // Seed the BFS at shore cells (a scar cell with a non-scar 4-neighbor).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isKind(x, y)) continue;
      const shore =
        !isKind(x, y - 1) || !isKind(x, y + 1) || !isKind(x - 1, y) || !isKind(x + 1, y);
      if (shore) { depth[y * W + x] = 1; q.push(y * W + x); }
    }
  }
  let maxDepth = q.length > 0 ? 1 : 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % W;
    const y = (i / W) | 0;
    const d = depth[i];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!isKind(nx, ny)) continue;
      const ni = ny * W + nx;
      if (depth[ni] !== 0) continue;
      depth[ni] = d + 1;
      if (d + 1 > maxDepth) maxDepth = d + 1;
      q.push(ni);
    }
  }
  return { depth, maxDepth };
}

/**
 * Multi-source BFS proximity field: for every scar cell, the cell distance to the
 * NEAREST seed cell in `sources` (0 at a seed, growing outward, staying inside the
 * scar). Used to intensify scorch/bloom toward their epicentre (the fire's near-
 * hall source cell, the bloom's deep seed room). Cells not reached stay -1.
 */
function scarProximityField(
  W: number,
  H: number,
  isKind: (x: number, y: number) => boolean,
  sources: number[],
): Float32Array {
  const prox = new Float32Array(W * H).fill(-1);
  const q: number[] = [];
  for (const s of sources) {
    if (s >= 0 && s < W * H && prox[s] === -1) { prox[s] = 0; q.push(s); }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % W;
    const y = (i / W) | 0;
    const d = prox[i];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!isKind(nx, ny)) continue;
      const ni = ny * W + nx;
      if (prox[ni] !== -1) continue;
      prox[ni] = d + 1;
      q.push(ni);
    }
  }
  return prox;
}

/** Blend two `#rrggbb` hexes by t∈[0,1] → `#rrggbb`. Used to ramp water depth. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/**
 * Renders the MAP ONLY (transparent background) into an offscreen canvas at
 * device resolution. The sheet compositor rotates and frames it.
 */
function drawMap(off: HTMLCanvasElement, plan: DungeonPlan, ov: Overlays, cell: number, dpr: number): void {
  const { W, H, grid, corridor, overlay } = plan;
  const sheet = SHEETS[plan.params.theme] ?? SHEETS.crypt;
  off.width = W * cell * dpr;
  off.height = H * cell * dpr;
  const ctx = off.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ft = plan.cellFt;
  const rx0 = (r: { x: number }): number => r.x / ft;
  const ry0 = (r: { y: number }): number => r.y / ft;

  const at = (x: number, y: number): number =>
    x >= 0 && y >= 0 && x < W && y < H ? grid[y * W + x] : CellKind.Void;
  const isFloor = (x: number, y: number): boolean => at(x, y) === CellKind.Floor;
  const isWall = (x: number, y: number): boolean => at(x, y) === CellKind.Wall;
  const ovAt = (x: number, y: number): number =>
    x >= 0 && y >= 0 && x < W && y < H ? overlay[y * W + x] : OverlayKind.None;

  // Ink-hand vertex jitter: every lattice vertex gets one stable sub-pixel
  // offset, shared by every stroke that touches it — one pen, one wobble. WS4:
  // amplitude raised from a faint tremble (0.16) to a hand-drawn wobble (0.26)
  // and floored in pixels so it still reads when a cell is only ~5 px; ONE jitter
  // funcion feeds rect walls, organic-room control points, corridors and jambs
  // alike, so the whole sheet looks drawn by a single pen.
  const jAmp = Math.max(cell * 0.26, 2.2);
  const jx = (x: number, y: number): number => x * cell + (hash2(x, y, 31) - 0.5) * jAmp;
  const jy = (x: number, y: number): number => y * cell + (hash2(x, y, 37) - 0.5) * jAmp;

  const tunnelCells = computeTunnelCells(plan);
  // WS8 corridor hierarchy: per-cell tier (2 arterial spine / 1 through / 0 spur)
  // so the drawing gives a sprawling network a legible backbone — arteries drawn
  // heavier + confident, spurs lightest. Drawing weight only; layout unchanged.
  const corridorTier = computeCorridorTiers(plan);
  const tierAt = (x: number, y: number): number =>
    x >= 0 && y >= 0 && x < W && y < H ? corridorTier[y * W + x] : 1;

  // Room-floor membership per cell (corridor cells excluded). `roomIdAt` powers
  // organic-outline tracing and corridor-mouth (jamb) detection below.
  const roomIdAt = new Int16Array(W * H).fill(-1);
  const roomShapeById = new Map<number, RoomShape>();
  for (const r of plan.rooms) {
    roomShapeById.set(r.id, r.shape);
    const x0 = Math.round(r.x / ft);
    const y0 = Math.round(r.y / ft);
    const x1 = x0 + Math.round(r.w / ft);
    const y1 = y0 + Math.round(r.h / ft);
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const i = y * W + x;
        if (grid[i] === CellKind.Floor && corridor[i] === 0) roomIdAt[i] = r.id;
      }
    }
  }
  const roomAt = (x: number, y: number): number =>
    x >= 0 && y >= 0 && x < W && y < H ? roomIdAt[y * W + x] : -1;
  /** A room whose walls should read as a hand-inked curve (not orthogonal). */
  const ORGANIC: Record<RoomShape, boolean> = {
    rect: false, ellipse: true, octagon: true, diamond: true, compound: false,
  };
  const isOrganicId = (id: number): boolean => id >= 0 && (ORGANIC[roomShapeById.get(id) ?? 'rect'] ?? false);
  const isCorridorCell = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] === CellKind.Floor && corridor[y * W + x] === 1;

  // Trace each organic room's wall outline ONCE (Chaikin-smoothed, in PIXELS),
  // shared by the wall-band repaint, the carve gutter, and the ink line so all
  // three follow the SAME hand-inked curve. Corridor mouths break the ring.
  interface SmoothContour { pts: { x: number; y: number }[]; closed: boolean; cx: number; cy: number }
  const organicContours = new Map<number, SmoothContour[]>();
  for (const r of plan.rooms) {
    if (!isOrganicId(r.id)) continue;
    const raw = traceContours(W, H, (x, y) => roomAt(x, y) === r.id, (x, y) => isCorridorCell(x, y));
    const smoothed: SmoothContour[] = [];
    for (const ct of raw) {
      if (ct.pts.length < 2) continue;
      // Jitter the RAW corner lattice points first (a gentle hand wobble on the
      // staircase corners), THEN Chaikin-smooth 3× — smoothing turns the wobble
      // into a flowing inked cave wall instead of high-frequency per-point noise.
      const jittered = ct.pts.map((v) => ({
        x: v.x * cell + (hash2(v.x, v.y, 31) - 0.5) * cell * 0.24,
        y: v.y * cell + (hash2(v.x, v.y, 37) - 0.5) * cell * 0.24,
      }));
      const pts = chaikin(jittered, ct.closed, 3);
      if (pts.length < 2) continue;
      let cx = 0;
      let cy = 0;
      for (const p of pts) { cx += p.x; cy += p.y; }
      smoothed.push({ pts, closed: ct.closed, cx: cx / pts.length, cy: cy / pts.length });
    }
    if (smoothed.length > 0) organicContours.set(r.id, smoothed);
  }
  /** Pushes every point of a closed contour inward (toward the centroid) by
   * `d` pixels along its local inward normal — a cheap curve inset used to
   * reclaim the floor the wide wall-band stroke painted over. */
  const makeInsetContour = (sc: SmoothContour, d: number): SmoothContour => {
    const p = sc.pts;
    const n = p.length;
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n];
      const b = p[(i + 1) % n];
      let tx = b.x - a.x;
      let ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      // inward normal candidates (±perp); pick the one pointing at the centroid
      let nx = -ty;
      let ny = tx;
      if ((sc.cx - p[i].x) * nx + (sc.cy - p[i].y) * ny < 0) { nx = -nx; ny = -ny; }
      out.push({ x: p[i].x + nx * d, y: p[i].y + ny * d });
    }
    return { pts: out, closed: true, cx: sc.cx, cy: sc.cy };
  };
  /** Traces a cached smooth contour as a quadratic-through-midpoints path (no
   * stroke/fill — the caller sets style then strokes or fills). */
  const pathContour = (sc: SmoothContour): void => {
    const p = sc.pts;
    const n = p.length;
    ctx.beginPath();
    if (sc.closed) {
      const m0x = (p[n - 1].x + p[0].x) / 2;
      const m0y = (p[n - 1].y + p[0].y) / 2;
      ctx.moveTo(m0x, m0y);
      for (let i = 0; i < n; i++) {
        const a = p[i];
        const b = p[(i + 1) % n];
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < n - 1; i++) {
        ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
      }
      ctx.lineTo(p[n - 1].x, p[n - 1].y);
    }
  };

  // ── House signature: soft OUTER drop-shadow lifting the complex off the
  // parchment (one global light, upper-left). Silhouette = every non-void
  // cell, blurred and offset SE, painted FIRST so everything sits on top —
  // floors read as carved into stone, walls stand above the page.
  {
    const sil = document.createElement('canvas');
    sil.width = off.width;
    sil.height = off.height;
    const sc = sil.getContext('2d');
    if (sc) {
      sc.setTransform(dpr, 0, 0, dpr, 0, 0);
      sc.fillStyle = sheet.wallBody;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (at(x, y) !== CellKind.Void) sc.fillRect(x * cell - 0.5, y * cell - 0.5, cell + 1, cell + 1);
        }
      }
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.filter = `blur(${Math.max(2, cell * 0.9)}px)`;
      ctx.drawImage(sil, 0, 0, sil.width, sil.height, cell * 0.5, cell * 0.65, W * cell, H * cell);
      ctx.restore();
    }
  }

  // ── Marginalia with a cartographer's hand (WS8) ─ the environs are NOT a
  // uniform dot-screen: theme glyphs (gravestones / scree / rime / reeds / caps)
  // cluster into occasional TUFTS with real negative space between, thin toward
  // zero far from the structure, and thicken where the wall FAILED — a rubble or
  // scorch scar inside pushes debris/scree OUT past the breach. Sparse and varied,
  // the hand of someone who noted what sits around the ruin, not confetti.
  {
    // Which floor overlays sit just inside each perimeter wall — so exterior
    // debris keys to a real interior failure (collapse-adjacent scree).
    const nearScar = (x: number, y: number): number => {
      // OverlayKind at any floor cell within 2 of this void cell.
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const k = ovAt(x + ox, y + oy);
          if (k === OverlayKind.Rubble || k === OverlayKind.Scorch) return k;
        }
      }
      return OverlayKind.None;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (at(x, y) !== CellKind.Void) continue;
        let dNear = 99;
        outer: for (let oy = -5; oy <= 5; oy++) {
          for (let ox = -5; ox <= 5; ox++) {
            if (isWall(x + ox, y + oy)) {
              const d = Math.max(Math.abs(ox), Math.abs(oy));
              if (d < dNear) dNear = d;
              if (dNear <= 2) break outer;
            }
          }
        }
        if (dNear > 5 || dNear <= 1) continue;
        // CLUMP FIELD: a coarse 3-cell block hash gates whole tufts on/off, so
        // glyphs group with negative space instead of an even sprinkle. Only ~⅓
        // of blocks are "live"; within a live block, density still falls with
        // distance from the wall (near = a few, far = at most one).
        const bx = Math.floor(x / 3);
        const by = Math.floor(y / 3);
        const live = hash2(bx, by, 900);
        const scar = nearScar(x, y);
        // A failed wall pushes a scree/soot tuft out past the breach regardless
        // of the clump field (debris marks the collapse, a deliberate note).
        const forced = scar !== OverlayKind.None && dNear <= 3 && hash2(x, y, 903) < 0.42;
        if (!forced) {
          if (live > 0.34) continue;            // dead block — negative space
          // distance falloff: dense at the wall skirt, near-zero by 5 cells out.
          const keep = [0, 0, 0.5, 0.32, 0.16, 0.07][dNear] ?? 0;
          if (hash2(x, y, 99) > keep) continue;
        }
        if (scar === OverlayKind.Rubble || (forced && scar === OverlayKind.None)) {
          // scree cone: a little heap of angular pebbles spilled from the breach.
          ctx.fillStyle = sheet.rubbleFill;
          ctx.strokeStyle = sheet.ink;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = Math.max(0.7, cell * 0.04);
          for (let k = 0; k < 3; k++) {
            const sxp = (x + 0.3 + hash2(x, y, 905 + k) * 0.4) * cell;
            const syp = (y + 0.35 + hash2(x, y, 909 + k) * 0.35) * cell;
            const rr = cell * (0.09 + hash2(x, y, 913 + k) * 0.08);
            ctx.beginPath();
            ctx.arc(sxp, syp, rr, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (scar === OverlayKind.Scorch) {
          // a smear of soot flecks blown out of a gutted wing.
          ctx.fillStyle = 'rgba(28, 22, 16, 0.4)';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc((x + 0.25 + hash2(x, y, 917 + k) * 0.5) * cell,
              (y + 0.25 + hash2(x, y, 921 + k) * 0.5) * cell,
              cell * (0.05 + hash2(x, y, 925 + k) * 0.06), 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // the theme's own environs glyph (gravestone / boulder / rime / reed /
          // cap), scaled down a touch and softened so a tuft whispers.
          sheet.exterior(ctx, (x + 0.5) * cell, (y + 0.5) * cell, cell * 1.5, hash2(x, y, 7));
        }
      }
    }
  }

  // Rock hatching: a directional, wall-hugging band with falloff — NOT a
  // uniform fuzz ring. Same global light as the drop-shadow (upper-left):
  // the SE shadow side hatches denser and longer, strokes radiate outward
  // from the wall, and the band dissolves into the paper instead of stopping
  // at a hard cutoff. Whisper tier — the wall ink stays boss.
  const LX = -Math.SQRT1_2;
  const LY = -Math.SQRT1_2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(x, y) !== CellKind.Void) continue;
      let dNear = 99;
      let wox = 0;
      let woy = 0;
      for (let oy = -4; oy <= 4; oy++) {
        for (let ox = -4; ox <= 4; ox++) {
          if (isWall(x + ox, y + oy)) {
            const d = Math.max(Math.abs(ox), Math.abs(oy));
            if (d < dNear) { dNear = d; wox = ox; woy = oy; }
          }
        }
      }
      if (dNear > 4) continue;
      const nl = Math.hypot(wox, woy) || 1;
      const nx2 = -wox / nl; // outward normal: nearest wall → this cell
      const ny2 = -woy / nl;
      const shade = 0.5 - 0.5 * (nx2 * LX + ny2 * LY); // 1 = SE shadow side
      const keep = [0, 1, 0.72, 0.38, 0.15][dNear] * (0.45 + 0.55 * shade);
      if (hash2(x, y, 3) > keep) continue;
      const strokes = dNear === 1 ? (shade > 0.45 ? 3 : 2) : dNear === 2 ? 2 : 1;
      ctx.strokeStyle = sheet.hatch;
      ctx.lineWidth = Math.max(1, cell * 0.08);
      ctx.globalAlpha =
        (dNear === 1 ? 0.8 : dNear === 2 ? 0.5 : dNear === 3 ? 0.28 : 0.15) * (0.5 + 0.5 * shade);
      const base = Math.atan2(ny2, nx2);
      for (let k = 0; k < strokes; k++) {
        const hx = (x + hash2(x, y, k * 3)) * cell;
        const hy = (y + hash2(x, y, k * 3 + 1)) * cell;
        const ang = base + (hash2(x, y, k * 7) - 0.5) * 0.8;
        const len = cell * (0.3 + hash2(x, y, k * 11) * 0.45) * (0.7 + 0.5 * shade);
        ctx.beginPath();
        ctx.moveTo(hx - Math.cos(ang) * len / 2, hy - Math.sin(ang) * len / 2);
        ctx.lineTo(hx + Math.cos(ang) * len / 2, hy + Math.sin(ang) * len / 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Wall body: near-black masonry band — the sheet's value anchor.
  ctx.fillStyle = sheet.wallBody;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isWall(x, y)) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  // Theme wall treatment: ragged rock adds irregular bumps outside the band.
  if (sheet.wallTreatment === 'ragged') {
    ctx.fillStyle = sheet.wallBody;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isWall(x, y)) continue;
        for (let k = 0; k < 2; k++) {
          if (hash2(x, y, k + 41) < 0.55) {
            const bx = (x + hash2(x, y, k + 43)) * cell;
            const by = (y + hash2(x, y, k + 47)) * cell;
            ctx.beginPath();
            ctx.arc(bx, by, cell * (0.18 + hash2(x, y, k + 53) * 0.22), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  // Floor.
  ctx.fillStyle = sheet.floor;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isFloor(x, y)) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  // Per-room tone variation + corridor shade. Tinted to the theme (was a
  // hardcoded warm deepen/lift) so the floor field itself carries the biome.
  for (const r of plan.rooms) {
    const v = hash2(r.id * 13 + 1, r.id * 7 + 3, 5);
    const shade = v < 0.5 ? `${sheet.roomShadeDark}, ${(0.015 + v * 0.05).toFixed(3)})` : `${sheet.roomShadeLight}, ${((v - 0.5) * 0.1).toFixed(3)})`;
    ctx.fillStyle = shade;
    const x0 = rx0(r);
    const y0 = ry0(r);
    for (let y = y0; y < y0 + r.h / ft; y++) {
      for (let x = x0; x < x0 + r.w / ft; x++) {
        if (isFloor(x, y) && corridor[y * W + x] === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }
  ctx.fillStyle = sheet.corridorShade;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isFloor(x, y) && corridor[y * W + x] === 1) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  // ── Organic-room wall recut (WS4) ─ replace the raster step ring with a
  // curved dark wall so the OUTER silhouette is a cave wall too, not a chunky
  // octagon. (1) Repaint pure-perimeter wall cells (all floor-neighbors are the
  // SAME organic room) back to paper, erasing the raster staircase; walls shared
  // with a corridor/rect room stay put (those edges are straight anyway). (2)
  // Fill the smooth curve interior with floor to clean any interior steps. The
  // wide dark band + carve gutter + ink line are stroked in later passes along
  // the same cached curve.
  if (organicContours.size > 0) {
    // (1) erase perimeter raster steps to paper
    ctx.fillStyle = sheet.paper;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isWall(x, y)) continue;
        // gather distinct floor-room ids among 8 neighbors
        let organicId = -1;
        let pureOrganic = true;
        let touchesOrganic = false;
        for (let oy = -1; oy <= 1 && pureOrganic; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const nx = x + ox;
            const ny = y + oy;
            if (!isFloor(nx, ny)) continue;
            const rid = roomAt(nx, ny);
            if (isOrganicId(rid)) {
              touchesOrganic = true;
              if (organicId === -1) organicId = rid;
              else if (organicId !== rid) { pureOrganic = false; break; }
            } else {
              // touches a corridor or a rect room → shared wall, keep it
              pureOrganic = false;
              break;
            }
          }
        }
        if (touchesOrganic && pureOrganic) ctx.fillRect(x * cell - 0.5, y * cell - 0.5, cell + 1, cell + 1);
      }
    }
    // (2) DARK WALL RING as two solid fills (no dashed stroke): fill an OUTWARD-
    // offset copy of the curve with wallBody (the wall's outer edge), then fill
    // the curve itself back to floor. The difference is a clean curved masonry
    // band of even thickness following the hand-inked wall — the raster band's
    // curved replacement, drawn UNDER the carve gutter + ink line.
    const bandOut = Math.max(2, cell * 0.55);
    for (const [rid, contours] of organicContours) {
      const v = hash2(rid * 13 + 1, rid * 7 + 3, 5);
      const tone = v < 0.5
        ? `${sheet.roomShadeDark}, ${(0.015 + v * 0.05).toFixed(3)})`
        : `${sheet.roomShadeLight}, ${((v - 0.5) * 0.1).toFixed(3)})`;
      for (const sc of contours) {
        if (sc.closed) {
          // outer wall edge
          pathContour(makeInsetContour(sc, -bandOut));
          ctx.fillStyle = sheet.wallBody;
          ctx.fill();
          // floor interior + room tone
          pathContour(sc);
          ctx.fillStyle = sheet.floor;
          ctx.fill();
          ctx.fillStyle = tone;
          ctx.fill();
        } else {
          // open arc (mouth-broken): a thick dark stroke reads as the wall here
          ctx.strokeStyle = sheet.wallBody;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = bandOut * 2;
          pathContour(sc);
          ctx.stroke();
        }
      }
    }
  }

  // Muted tint over keyed rooms, with edge pooling so the stain sits in the
  // stone instead of reading as a flat gel.
  for (const r of plan.rooms) {
    const tint = TYPE_TINT[r.type];
    if (!tint) continue;
    const x0 = rx0(r);
    const y0 = ry0(r);
    const wC = r.w / ft;
    const hC = r.h / ft;
    ctx.fillStyle = tint.fill;
    for (let y = y0; y < y0 + hC; y++) {
      for (let x = x0; x < x0 + wC; x++) {
        if (isFloor(x, y) && corridor[y * W + x] === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.fillStyle = tint.pool;
    for (let y = y0; y < y0 + hC; y++) {
      for (let x = x0; x < x0 + wC; x++) {
        if (!isFloor(x, y) || corridor[y * W + x] !== 0) continue;
        // pool where the cell touches a non-floor (wall) neighbor
        if (!isFloor(x - 1, y) || !isFloor(x + 1, y) || !isFloor(x, y - 1) || !isFloor(x, y + 1)) {
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }

  // ══ WS6 event overlays — the scars history left, UNDER the ink pass ═══════
  // Each kind speaks its OWN cartographic language (water depth+shore+ripple, a
  // real rubble pile, a spore field, a radiating scorch, cracked rime) instead of
  // one flat cyan-vs-tan fill. Intensity fields (scarDepthField / proximity) give
  // every scar DEPTH and ORIGIN — the flood deepens to its centre, the fire chars
  // toward its source. All variation is coord-hash / BFS — deterministic.
  const isWaterC = (x: number, y: number): boolean => isFloor(x, y) && ovAt(x, y) === OverlayKind.Water;
  const isBloomC = (x: number, y: number): boolean => isFloor(x, y) && ovAt(x, y) === OverlayKind.Bloom;
  const isScorchC = (x: number, y: number): boolean => isFloor(x, y) && ovAt(x, y) === OverlayKind.Scorch;
  const isRubbleC = (x: number, y: number): boolean => isFloor(x, y) && ovAt(x, y) === OverlayKind.Rubble;
  const isIceC = (x: number, y: number): boolean => isFloor(x, y) && ovAt(x, y) === OverlayKind.Ice;

  // ── WATER ─ a proper cartographic body, per connected pool. Depth gradient
  // (shallow lapping shore → dark deep centre) tinted to the theme; a heavier
  // shoreline ink where it meets the wall; 2–3 concentric shoreline contours
  // following the pool inward; and faint wavelet ticks in the shallows. Reads as
  // WATER, not a flat cyan blob. (Grid is already suppressed on water cells.)
  {
    const { depth, maxDepth } = scarDepthField(W, H, isWaterC);
    if (maxDepth > 0) {
      // 1) depth-ramped fill per cell (shallow at shore → deep at centre).
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = depth[y * W + x];
          if (d === 0) continue;
          // normalize 0(shore)..1(deepest); ease so the deep pools read dark fast.
          const t = maxDepth > 1 ? (d - 1) / (maxDepth - 1) : 1;
          ctx.fillStyle = mixHex(sheet.waterShallow, sheet.waterDeep, Math.pow(t, 0.7));
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      // 2) shoreline edge — a darker ink line hugging the waterline (every water
      // cell face onto NON-water). Reads as the lapping edge against the stone.
      ctx.strokeStyle = `${sheet.waterEdge}, 0.6)`;
      ctx.lineWidth = Math.max(1.1, cell * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isWaterC(x, y)) continue;
          const o = cell * 0.06;
          if (!isWaterC(x, y - 1)) { ctx.moveTo(x * cell, y * cell + o); ctx.lineTo((x + 1) * cell, y * cell + o); }
          if (!isWaterC(x, y + 1)) { ctx.moveTo(x * cell, (y + 1) * cell - o); ctx.lineTo((x + 1) * cell, (y + 1) * cell - o); }
          if (!isWaterC(x - 1, y)) { ctx.moveTo(x * cell + o, y * cell); ctx.lineTo(x * cell + o, (y + 1) * cell); }
          if (!isWaterC(x + 1, y)) { ctx.moveTo((x + 1) * cell - o, y * cell); ctx.lineTo((x + 1) * cell - o, (y + 1) * cell); }
        }
      }
      ctx.stroke();
      // 3) concentric shoreline contours — trace the waterline at depths 2 and 3
      // (a cell face where THIS depth borders a shallower one), the universal
      // "水" contour convention. Wobbled off the grid so it reads hand-drawn.
      ctx.strokeStyle = `${sheet.waterEdge}, 0.34)`;
      ctx.lineWidth = Math.max(0.8, cell * 0.05);
      ctx.beginPath();
      for (const ring of [2, 3]) {
        if (maxDepth < ring) break;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (depth[y * W + x] !== ring) continue;
            const wob = (k: number): number => (hash2(x, y, k) - 0.5) * cell * 0.18;
            // draw a face wherever a shallower (or shore) cell is 4-adjacent
            if (depth[(y - 1) * W + x] === ring - 1) { ctx.moveTo(x * cell, y * cell + wob(1)); ctx.lineTo((x + 1) * cell, y * cell + wob(2)); }
            if (y + 1 < H && depth[(y + 1) * W + x] === ring - 1) { ctx.moveTo(x * cell, (y + 1) * cell + wob(3)); ctx.lineTo((x + 1) * cell, (y + 1) * cell + wob(4)); }
            if (depth[y * W + (x - 1)] === ring - 1) { ctx.moveTo(x * cell + wob(5), y * cell); ctx.lineTo(x * cell + wob(6), (y + 1) * cell); }
            if (x + 1 < W && depth[y * W + (x + 1)] === ring - 1) { ctx.moveTo((x + 1) * cell + wob(7), y * cell); ctx.lineTo((x + 1) * cell + wob(8), (y + 1) * cell); }
          }
        }
      }
      ctx.stroke();
      // 4) wavelet ticks in the shallows — a few short horizontal ripples, only
      // on shallow cells (depth 1–2) so the deep centre stays a still dark plane.
      ctx.strokeStyle = `${sheet.waterEdge}, 0.3)`;
      ctx.lineWidth = Math.max(0.8, cell * 0.045);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = depth[y * W + x];
          if (d === 0 || d > 2) continue;
          if (hash2(x, y, 201) > 0.4) continue;
          const yy = (y + 0.3 + hash2(x, y, 203) * 0.4) * cell;
          const wx0 = (x + 0.16) * cell;
          const wx1 = (x + 0.84) * cell;
          ctx.beginPath();
          ctx.moveTo(wx0, yy);
          ctx.quadraticCurveTo((x + 0.4) * cell, yy - cell * 0.1, (x + 0.62) * cell, yy);
          ctx.quadraticCurveTo((x + 0.78) * cell, yy + cell * 0.08, wx1, yy);
          ctx.stroke();
        }
      }
      // 5) frost water = a frozen SKIN: white crack lines forking across the
      // surface so a frost pool reads as ice, not open water.
      if (plan.params.theme === 'frost') {
        ctx.strokeStyle = 'rgba(238, 246, 250, 0.7)';
        ctx.lineWidth = Math.max(0.8, cell * 0.05);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (depth[y * W + x] < 2) continue;
            if (hash2(x, y, 205) > 0.3) continue;
            const cxp = (x + 0.5) * cell;
            const cyp = (y + 0.5) * cell;
            const a0 = hash2(x, y, 207) * Math.PI * 2;
            ctx.beginPath();
            for (const da of [0, 2.3, 4.1]) {
              let xx = cxp;
              let yy = cyp;
              ctx.moveTo(xx, yy);
              const aa = a0 + da;
              for (let s = 0; s < 2; s++) {
                xx += Math.cos(aa + (hash2(x, y, 209 + s) - 0.5) * 0.7) * cell * 0.4;
                yy += Math.sin(aa + (hash2(x, y, 211 + s) - 0.5) * 0.7) * cell * 0.4;
                ctx.lineTo(xx, yy);
              }
            }
            ctx.stroke();
          }
        }
      }
    }
  }

  // ── RUBBLE ─ a real pile of fallen stone at the collapse seal, not a beige
  // patch. Angular ink-outlined chunks (not soft pebbles), and DENSER where the
  // rubble body is thickest (the choke). The overlay ground tint underlays it.
  {
    const { depth, maxDepth } = scarDepthField(W, H, isRubbleC);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isRubbleC(x, y)) continue;
        ctx.fillStyle = OVERLAY_FILL[OverlayKind.Rubble];
        ctx.fillRect(x * cell, y * cell, cell, cell);
        // more stones toward the thick of the pile (higher depth).
        const t = maxDepth > 0 ? depth[y * W + x] / maxDepth : 0.5;
        const n = 4 + Math.floor((0.4 + t * 0.6) * 4 + hash2(x, y, 71) * 2);
        for (let k = 0; k < n; k++) {
          const px = (x + 0.16 + hash2(x, y, 73 + k) * 0.68) * cell;
          const py = (y + 0.16 + hash2(x, y, 79 + k) * 0.68) * cell;
          const r = cell * (0.09 + hash2(x, y, 83 + k) * 0.11) * (0.85 + t * 0.4);
          // an angular chunk: a jittered 4–5-gon, dark stone + ink edge + a lit facet.
          const sides = 4 + (hash2(x, y, 87 + k) < 0.5 ? 0 : 1);
          const a0 = hash2(x, y, 89 + k) * Math.PI * 2;
          ctx.beginPath();
          for (let s = 0; s <= sides; s++) {
            const a = a0 + (s / sides) * Math.PI * 2;
            const rr = r * (0.72 + hash2(x, y, 91 + s + k) * 0.5);
            const xx = px + Math.cos(a) * rr;
            const yy = py + Math.sin(a) * rr;
            if (s === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
          }
          ctx.closePath();
          ctx.fillStyle = sheet.rubbleFill;
          ctx.fill();
          ctx.strokeStyle = sheet.ink;
          ctx.lineWidth = Math.max(0.8, cell * 0.045);
          ctx.stroke();
          // a small SE shadow ghost under each chunk so the pile reads heaped.
          ctx.fillStyle = sheet.floorShadow;
          ctx.beginPath();
          ctx.ellipse(px + cell * 0.06, py + r * 0.55, r * 0.7, r * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ── ICE ─ a pale rime SHEET with fork cracks + a cold sheen edge, not a lone
  // hairline. The ground tint frosts the floor; cracks lace across it.
  {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isIceC(x, y)) continue;
        ctx.fillStyle = OVERLAY_FILL[OverlayKind.Ice];
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    // cold sheen: a pale lift hugging the rime's NW (lit) edge.
    ctx.strokeStyle = 'rgba(244, 250, 253, 0.75)';
    ctx.lineWidth = Math.max(0.9, cell * 0.07);
    ctx.beginPath();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isIceC(x, y)) continue;
        const o = cell * 0.16;
        if (!isIceC(x, y - 1)) { ctx.moveTo(x * cell, y * cell + o); ctx.lineTo((x + 1) * cell, y * cell + o); }
        if (!isIceC(x - 1, y)) { ctx.moveTo(x * cell + o, y * cell); ctx.lineTo(x * cell + o, (y + 1) * cell); }
      }
    }
    ctx.stroke();
    // fork cracks across the sheet.
    ctx.strokeStyle = 'rgba(96, 138, 168, 0.5)';
    ctx.lineWidth = Math.max(0.8, cell * 0.05);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isIceC(x, y) || hash2(x, y, 91) > 0.4) continue;
        const cxp = (x + 0.3 + hash2(x, y, 93) * 0.4) * cell;
        const cyp = (y + 0.3 + hash2(x, y, 95) * 0.4) * cell;
        const a0 = hash2(x, y, 97) * Math.PI * 2;
        ctx.beginPath();
        for (const da of [0, 2.6]) {
          let xx = cxp;
          let yy = cyp;
          ctx.moveTo(xx, yy);
          const aa = a0 + da;
          for (let s = 0; s < 2; s++) {
            xx += Math.cos(aa + (hash2(x, y, 99 + s) - 0.5) * 0.8) * cell * 0.36;
            yy += Math.sin(aa + (hash2(x, y, 101 + s) - 0.5) * 0.8) * cell * 0.36;
            ctx.lineTo(xx, yy);
          }
        }
        ctx.stroke();
      }
    }
  }

  // ── BLOOM ─ a spreading fungal FIELD, not a flat mauve tint: mycelium veins
  // threading between cells + spore-cap clusters, DENSER toward the bloom's
  // source (the deepest bloomed cell from the entrance — where it started) and
  // thinning at the spread edge, so the sheet shows where the rot began.
  {
    // Epicentre = the bloom cell with the greatest BFS distance from the entrance
    // (the deep seed room the applier bloomed from). Directional intensity field.
    let srcCell = -1;
    let srcBfs = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isBloomC(x, y)) continue;
        const b = plan.bfs[y * W + x];
        if (b > srcBfs) { srcBfs = b; srcCell = y * W + x; }
      }
    }
    if (srcCell >= 0) {
      const prox = scarProximityField(W, H, isBloomC, [srcCell]);
      let maxProx = 1;
      for (let i = 0; i < prox.length; i++) if (prox[i] > maxProx) maxProx = prox[i];
      // ground wash (fungal accent, faint) so the whole field carries the bruise.
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isBloomC(x, y)) continue;
          ctx.fillStyle = OVERLAY_FILL[OverlayKind.Bloom];
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      // mycelium veins: from each cell, a faint accent thread toward its lower-
      // proximity (closer-to-source) neighbour — the web reads as spreading OUT.
      ctx.strokeStyle = sheet.accent;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isBloomC(x, y)) continue;
          const p = prox[y * W + x];
          const intens = 1 - p / maxProx; // 1 at source → 0 at edge
          ctx.globalAlpha = 0.18 + intens * 0.32;
          ctx.lineWidth = Math.max(0.7, cell * (0.03 + intens * 0.04));
          const cxp = (x + 0.5) * cell;
          const cyp = (y + 0.5) * cell;
          // thread toward whichever 4-neighbour is closer to the source.
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
            const nx = x + dx;
            const ny = y + dy;
            if (!isBloomC(nx, ny)) continue;
            if (prox[ny * W + nx] >= p) continue; // only draw toward the source
            const mx = cxp + dx * cell * 0.5;
            const my = cyp + dy * cell * 0.5;
            const bend = (hash2(x, y, 111) - 0.5) * cell * 0.3;
            ctx.beginPath();
            ctx.moveTo(cxp, cyp);
            ctx.quadraticCurveTo(cxp + (mx - cxp) * 0.5 - dy * bend, cyp + (my - cyp) * 0.5 + dx * bend, mx, my);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      // spore caps: clusters of accent domes, more where the field is intense.
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isBloomC(x, y)) continue;
          const intens = 1 - prox[y * W + x] / maxProx;
          const thresh = 0.35 + intens * 0.4; // denser caps near the source
          if (hash2(x, y, 113) > thresh) continue;
          const n = 1 + (hash2(x, y, 115) < 0.4 + intens * 0.4 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const px = (x + 0.24 + hash2(x, y, 117 + k) * 0.52) * cell;
            const py = (y + 0.24 + hash2(x, y, 121 + k) * 0.52) * cell;
            const rr = cell * (0.1 + hash2(x, y, 125 + k) * 0.1) * (0.85 + intens * 0.4);
            // stem
            ctx.strokeStyle = sheet.ink;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = Math.max(0.7, cell * 0.04);
            ctx.beginPath();
            ctx.moveTo(px, py + rr * 0.9);
            ctx.lineTo(px, py);
            ctx.stroke();
            // cap (accent dome)
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = sheet.accent;
            ctx.beginPath();
            ctx.arc(px, py, rr, Math.PI, 0, false);
            ctx.fill();
            ctx.strokeStyle = sheet.ink;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── SCORCH ─ char radiating from the fire's source, not flat soot. The source
  // is the scorched cell NEAREST the entrance (fire started in the near halls);
  // char DEEPENS toward it (ash-black at the seat, ash-gray fading at the edge)
  // with soot flecks and charred edges, so a reader can point at the burn's seat.
  {
    let srcCell = -1;
    let srcBfs = Infinity;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isScorchC(x, y)) continue;
        const b = plan.bfs[y * W + x];
        if (b >= 0 && b < srcBfs) { srcBfs = b; srcCell = y * W + x; }
      }
    }
    if (srcCell >= 0) {
      const prox = scarProximityField(W, H, isScorchC, [srcCell]);
      let maxProx = 1;
      for (let i = 0; i < prox.length; i++) if (prox[i] > maxProx) maxProx = prox[i];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isScorchC(x, y)) continue;
          // ease the ramp so the burn stays clearly charred across the whole
          // gutted region and reads DARKEST at the seat (a light-tan smudge fails
          // the "fire gutted it" test the critique flags).
          const intens = Math.pow(1 - prox[y * W + x] / maxProx, 0.6); // 1 seat → 0 edge
          // char wash: deep ash everywhere, near-black at the seat.
          ctx.fillStyle = OVERLAY_FILL[OverlayKind.Scorch];
          ctx.fillRect(x * cell, y * cell, cell, cell);
          ctx.fillStyle = `rgba(26, 20, 15, ${(0.34 + intens * 0.46).toFixed(3)})`;
          ctx.fillRect(x * cell, y * cell, cell, cell);
          // soot flecks (denser + darker at the seat).
          const n = 3 + Math.floor(intens * 4 + hash2(x, y, 117) * 2);
          ctx.fillStyle = `rgba(12, 9, 6, ${(0.5 + intens * 0.4).toFixed(3)})`;
          for (let k = 0; k < n; k++) {
            ctx.beginPath();
            ctx.arc(
              (x + 0.15 + hash2(x, y, 119 + k) * 0.7) * cell,
              (y + 0.15 + hash2(x, y, 123 + k) * 0.7) * cell,
              cell * (0.06 + hash2(x, y, 127 + k) * 0.1) * (0.7 + intens * 0.6),
              0, Math.PI * 2,
            );
            ctx.fill();
          }
        }
      }
      // charred wall stubs: soot-darken EVERY wall cell bordering the burn (the
      // fire licked the walls), heaviest near the seat — so a scorched room reads
      // as gutted, its masonry blackened, not merely floor-stained.
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isScorchC(x, y)) continue;
          const intens = Math.pow(1 - prox[y * W + x] / maxProx, 0.6);
          ctx.fillStyle = `rgba(8, 6, 5, ${(0.35 + intens * 0.4).toFixed(3)})`;
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
            if (isWall(x + dx, y + dy)) {
              ctx.fillRect((x + dx) * cell, (y + dy) * cell, cell, cell);
            }
          }
        }
      }
    }
  }

  // Dug tunnels: raw-earth wash — hand-cut passages are not paved stone.
  ctx.fillStyle = sheet.dugWash;
  for (const i of tunnelCells) {
    ctx.fillRect((i % W) * cell, ((i / W) | 0) * cell, cell, cell);
  }

  // Survey grid: near-invisible SOLID hairlines, and only where a mason
  // would have surveyed — ORGANIC (curved) chambers and dug tunnels carry no
  // lattice (a curved cave wall wearing a square grid is a category error, and
  // it would fight the WS4 spline). Value ladder: walls ≫ floors ≫ grid (the
  // grid must never read as texture at arm's length).
  const noGrid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // WS6: an event scar owns its cell's surface (water, rubble pile, scorched
      // char, rime sheet, spore field) — a surveyor's square grid over any of them
      // is a category error and fights the scar's own language, so gate it off.
      if (isFloor(x, y) && (isOrganicId(roomAt(x, y)) || ovAt(x, y) !== OverlayKind.None)) {
        noGrid[y * W + x] = 1;
      }
    }
  }
  for (const i of tunnelCells) noGrid[i] = 1;
  const gridded = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && isFloor(x, y) && noGrid[y * W + x] === 0;
  // A natural cave system was never surveyed: the cavern theme draws NO grid
  // anywhere (its rect chambers are hewn galleries, not masonry).
  if (plan.params.theme !== 'cavern') {
    ctx.strokeStyle = sheet.gridDash;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!gridded(x, y)) continue;
        if (gridded(x + 1, y)) {
          ctx.moveTo((x + 1) * cell, y * cell);
          ctx.lineTo((x + 1) * cell, (y + 1) * cell);
        }
        if (gridded(x, y + 1)) {
          ctx.moveTo(x * cell, (y + 1) * cell);
          ctx.lineTo((x + 1) * cell, (y + 1) * cell);
        }
      }
    }
    ctx.stroke();
  }

  // ── Floor differentiation (WS5) ─ thresholds, daises, and empty-room
  // identity, so a room's floor tells you what it is before a single glyph.
  // All MID/whisper tier — under the ink walls and under the furniture, never
  // out-shouting either. Keyed to room.purpose/type; every mark is theme-tinted.
  {
    // Per-room floor-cell inventory + how much furniture landed inside it, so
    // an EMPTY keyed/large room can be given its own incidental feature.
    interface RoomFloor { cells: number[]; cx: number; cy: number; area: number }
    const roomFloor = new Map<number, RoomFloor>();
    for (const r of plan.rooms) roomFloor.set(r.id, { cells: [], cx: 0, cy: 0, area: 0 });
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const rid = roomAt(x, y);
        if (rid < 0) continue;
        const rf = roomFloor.get(rid);
        if (!rf) continue;
        rf.cells.push(y * W + x);
        rf.cx += x + 0.5;
        rf.cy += y + 0.5;
        rf.area++;
      }
    }
    for (const rf of roomFloor.values()) if (rf.area > 0) { rf.cx /= rf.area; rf.cy /= rf.area; }
    const propCountByRoom = new Map<number, number>();
    for (const p of plan.props) propCountByRoom.set(p.roomId, (propCountByRoom.get(p.roomId) ?? 0) + 1);

    // (a) DAIS / STEP PLATFORM in focal rooms (shrine + boss + chapel + throne-
    // like halls). A raised platform reads as a concentric inset floor block with
    // a soft SE step-shadow and a thin lit top rule — the altar/throne sits ON
    // it. Only when the room has enough clear floor to carry one.
    const daisRoom = (r: DungeonRoom): boolean =>
      r.type === 'shrine' || r.type === 'boss' ||
      r.purpose === 'chapel' || r.purpose === 'chapel-wing' || r.purpose === 'great-hall';
    for (const r of plan.rooms) {
      if (!daisRoom(r)) continue;
      const rf = roomFloor.get(r.id);
      if (!rf || rf.area < 12) continue;
      const wC = r.w / ft;
      const hC = r.h / ft;
      // platform half-extent: a generous centre pad, inset from the walls.
      const halfW = Math.max(cell * 1.1, wC * cell * 0.3);
      const halfH = Math.max(cell * 1.1, hC * cell * 0.3);
      const pcx = rf.cx * cell;
      const pcy = rf.cy * cell;
      const rr = Math.min(halfW, halfH) * 0.5;
      const plat = (ex: number, ey: number): void => {
        ctx.beginPath();
        ctx.moveTo(pcx - halfW + rr + ex, pcy - halfH + ey);
        ctx.arcTo(pcx + halfW + ex, pcy - halfH + ey, pcx + halfW + ex, pcy - halfH + rr + ey, rr);
        ctx.arcTo(pcx + halfW + ex, pcy + halfH + ey, pcx + halfW - rr + ex, pcy + halfH + ey, rr);
        ctx.arcTo(pcx - halfW + ex, pcy + halfH + ey, pcx - halfW + ex, pcy + halfH - rr + ey, rr);
        ctx.arcTo(pcx - halfW + ex, pcy - halfH + ey, pcx - halfW + rr + ex, pcy - halfH + ey, rr);
        ctx.closePath();
      };
      // step-shadow offset SE (matches the sheet's upper-left light)
      ctx.fillStyle = sheet.floorShadow;
      plat(cell * 0.16, cell * 0.2);
      ctx.fill();
      // platform top — a faint lift so it reads raised, then a thin ink rule
      ctx.fillStyle = `${sheet.roomShadeLight}, 0.16)`;
      plat(0, 0);
      ctx.fill();
      ctx.strokeStyle = sheet.ink;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = Math.max(1, cell * 0.06);
      plat(0, 0);
      ctx.stroke();
      // a second inner rule = the stepped riser
      const step = Math.max(cell * 0.28, 3);
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      const iw = halfW - step;
      const ih = halfH - step;
      const ir = Math.min(iw, ih) * 0.5;
      ctx.moveTo(pcx - iw + ir, pcy - ih);
      ctx.arcTo(pcx + iw, pcy - ih, pcx + iw, pcy - ih + ir, ir);
      ctx.arcTo(pcx + iw, pcy + ih, pcx + iw - ir, pcy + ih, ir);
      ctx.arcTo(pcx - iw, pcy + ih, pcx - iw, pcy + ih - ir, ir);
      ctx.arcTo(pcx - iw, pcy - ih, pcx - iw + ir, pcy - ih, ir);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // (b) THRESHOLD SILLS across doorways: a short doorstep bar drawn ON the
    // floor where a passage crosses into a room, so entries read as cut, not as
    // an incidental gap. Whisper tier (faint ink), floored in pixels.
    ctx.strokeStyle = sheet.ink;
    ctx.lineCap = 'round';
    for (const d of plan.doors) {
      if (d.state === 'bricked') continue; // no threshold through a sealed wall
      const dx = d.cell.x;
      const dy = d.cell.y;
      const vert = isFloor(dx, dy - 1) && isFloor(dx, dy + 1);
      const horz = isFloor(dx - 1, dy) && isFloor(dx + 1, dy);
      const vertical = vert && !horz ? true : horz && !vert ? false : isFloor(dx, dy - 1) || isFloor(dx, dy + 1);
      const px = (dx + 0.5) * cell;
      const py = (dy + 0.5) * cell;
      const half = cell * 0.3;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = Math.max(1, cell * 0.09);
      ctx.beginPath();
      if (vertical) { ctx.moveTo(px - half, py); ctx.lineTo(px + half, py); }
      else { ctx.moveTo(px, py - half); ctx.lineTo(px, py + half); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // (c) EMPTY-ROOM IDENTITY: a keyed/sizeable room the generator left bare
    // gets ONE low-density incidental keyed to purpose/theme (a drain, a floor
    // crack, a flag seam) so no room is a blank stipple bag. Skipped for rooms
    // that already carry furniture, tiny rooms, and organic caves (their floor
    // texture comes from the cave itself). Deterministic per room id.
    const incidental = (r: DungeonRoom, rf: RoomFloor): void => {
      const cxp = rf.cx * cell;
      const cyp = rf.cy * cell;
      const rid = r.id;
      const h = hash2(rid * 17 + 5, rid * 11 + 2, 200);
      const wet = plan.params.theme === 'sewer' || r.purpose === 'cistern' ||
        r.purpose === 'sump' || r.purpose === 'outfall' || r.purpose === 'junction';
      const cold = plan.params.theme === 'frost';
      if (wet && h < 0.7) {
        // a drain grate — small square with 3 bars, over a faint damp ring
        ctx.fillStyle = 'rgba(70, 90, 80, 0.1)';
        ctx.beginPath();
        ctx.arc(cxp, cyp, cell * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = sheet.ink;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = Math.max(1, cell * 0.07);
        const gs = cell * 0.42;
        ctx.strokeRect(cxp - gs, cyp - gs, gs * 2, gs * 2);
        ctx.lineWidth = Math.max(0.8, cell * 0.05);
        ctx.beginPath();
        for (const f of [-0.4, 0, 0.4]) {
          ctx.moveTo(cxp + gs * f, cyp - gs);
          ctx.lineTo(cxp + gs * f, cyp + gs);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (cold && h < 0.6) {
        // a rimed floor pool — pale ellipse with a frost hairline
        ctx.fillStyle = 'rgba(200, 220, 232, 0.28)';
        ctx.strokeStyle = 'rgba(120, 160, 190, 0.5)';
        ctx.lineWidth = Math.max(1, cell * 0.06);
        ctx.beginPath();
        ctx.ellipse(cxp, cyp, cell * 0.7, cell * 0.48, h * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (h < 0.55) {
        // a floor crack — a forked hairline meandering off the centre
        ctx.strokeStyle = sheet.ink;
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = Math.max(0.8, cell * 0.06);
        const a0 = h * Math.PI * 2;
        const seg = (a: number, len: number): void => {
          let x = cxp;
          let y = cyp;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            const aa = a + (hash2(rid, k, 201) - 0.5) * 1.0;
            x += Math.cos(aa) * len;
            y += Math.sin(aa) * len;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        };
        seg(a0, cell * 0.5);
        seg(a0 + Math.PI + (h - 0.5), cell * 0.42);
        ctx.globalAlpha = 1;
      } else {
        // a flag seam — two faint parallel coursing lines, a hint of finished floor
        ctx.strokeStyle = sheet.gridDash;
        ctx.lineWidth = Math.max(0.8, cell * 0.06);
        ctx.beginPath();
        for (const f of [-0.5, 0.5]) {
          ctx.moveTo(cxp - cell * 1.1, cyp + cell * f);
          ctx.lineTo(cxp + cell * 1.1, cyp + cell * f);
        }
        ctx.stroke();
      }
    };
    for (const r of plan.rooms) {
      if ((propCountByRoom.get(r.id) ?? 0) > 0) continue; // has furniture already
      if (r.type === 'entrance') continue; // entrance staging is its own glyph
      const rf = roomFloor.get(r.id);
      if (!rf || rf.area < 6) continue; // too small to carry a feature
      if (isOrganicId(r.id) && rf.area < 20) continue; // small caves stay bare
      incidental(r, rf);
    }
  }

  // ── Theme ornament + directional language (WS8) ─ each biome carries a small
  // identifying mark WS3's palette + WS6's scars didn't cover, and where the
  // fiction has a DIRECTION the sheet shows it. All whisper tier (under the ink
  // walls + furniture + keys), theme-tinted, coord-hash only. One theme at a time.
  {
    const theme = plan.params.theme;
    if (theme === 'frost') {
      // FROST-CRACK FILIGREE: a few hairline rime cracks radiating from room
      // INSIDE-CORNERS (where two walls meet), the cold creeping in at the joints.
      ctx.strokeStyle = 'rgba(150, 186, 214, 0.5)';
      ctx.lineCap = 'round';
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const rid = roomAt(x, y);
          if (rid < 0) continue;
          // an inside corner: this floor cell has a wall on two orthogonal sides.
          const wN = isWall(x, y - 1);
          const wS = isWall(x, y + 1);
          const wE = isWall(x + 1, y);
          const wW = isWall(x - 1, y);
          const corner = (wN && wW) || (wN && wE) || (wS && wW) || (wS && wE);
          if (!corner) continue;
          if (hash2(x, y, 930) > 0.5) continue; // only some corners rime up
          // origin = the corner vertex; fork two cracks INTO the room.
          const ox = wW ? x : x + 1;
          const oy = wN ? y : y + 1;
          const dirX = wW ? 1 : -1; // into the room, away from the walls
          const dirY = wN ? 1 : -1;
          const a0 = Math.atan2(dirY, dirX);
          ctx.lineWidth = Math.max(0.7, cell * 0.045);
          for (const da of [-0.5, 0.15, 0.7]) {
            let xx = ox * cell;
            let yy = oy * cell;
            ctx.beginPath();
            ctx.moveTo(xx, yy);
            const aa = a0 + da;
            for (let s = 0; s < 3; s++) {
              const len = cell * (0.28 + hash2(x, y, 932 + s) * 0.28);
              xx += Math.cos(aa + (hash2(x, y, 934 + s) - 0.5) * 0.6) * len;
              yy += Math.sin(aa + (hash2(x, y, 936 + s) - 0.5) * 0.6) * len;
              ctx.lineTo(xx, yy);
            }
            ctx.stroke();
          }
        }
      }
    } else if (theme === 'cavern') {
      // STALACTITE STIPPLE: short dripstone ticks hanging from the wall at chamber
      // EDGES — a natural cave signature. On floor cells hugging a wall, a couple
      // of tapered ticks point INTO the room from the wall face.
      ctx.strokeStyle = 'rgba(40, 30, 16, 0.4)';
      ctx.fillStyle = 'rgba(40, 30, 16, 0.32)';
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (roomAt(x, y) < 0) continue;
          if (hash2(x, y, 940) > 0.22) continue; // sparse
          // nearest wall face (a stalactite hangs from the ceiling at the edge).
          let wx = 0; let wy = 0;
          if (isWall(x, y - 1)) { wx = 0; wy = -1; }
          else if (isWall(x + 1, y)) { wx = 1; wy = 0; }
          else if (isWall(x, y + 1)) { wx = 0; wy = 1; }
          else if (isWall(x - 1, y)) { wx = -1; wy = 0; }
          else continue;
          // base ON the wall face, tip INTO the room.
          const bxp = (x + 0.5 + wx * 0.44) * cell;
          const byp = (y + 0.5 + wy * 0.44) * cell;
          const tipX = bxp - wx * cell * (0.28 + hash2(x, y, 942) * 0.2);
          const tipY = byp - wy * cell * (0.28 + hash2(x, y, 942) * 0.2);
          const tx = -wy; const tyv = wx; // tangent along the wall
          const halfW = cell * 0.1;
          ctx.beginPath();
          ctx.moveTo(bxp - tx * halfW, byp - tyv * halfW);
          ctx.lineTo(bxp + tx * halfW, byp + tyv * halfW);
          ctx.lineTo(tipX, tipY);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else if (theme === 'fungal') {
      // SPORE DRIFT: faint spore motes floating in the AIR of bloomed wings — the
      // rooms whose floor carries the bloom overlay (or are adjacent to it), so
      // the "spreading in the dark" reads even off the bloom's own field.
      const nearBloom = (x: number, y: number): boolean => {
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ovAt(x + ox, y + oy) === OverlayKind.Bloom) return true;
          }
        }
        return false;
      };
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (roomAt(x, y) < 0) continue;
          if (ovAt(x, y) === OverlayKind.Bloom) continue; // the field owns its cell
          if (!nearBloom(x, y)) continue;
          if (hash2(x, y, 950) > 0.5) continue;
          // a drift of tiny spore-cyan motes rising off the bloom.
          ctx.fillStyle = 'rgba(120, 176, 168, 0.42)';
          const n = 2 + (hash2(x, y, 951) < 0.5 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            ctx.beginPath();
            ctx.arc((x + 0.2 + hash2(x, y, 952 + k) * 0.6) * cell,
              (y + 0.2 + hash2(x, y, 956 + k) * 0.6) * cell,
              cell * (0.03 + hash2(x, y, 960 + k) * 0.03), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else if (theme === 'sewer') {
      // FLOW DIRECTION: current chevrons down the channels — water RUNS, so show
      // which way. Downstream = away from the entrance (increasing BFS), toward
      // the sump/outfall. Drawn on corridor + water cells that have a clear
      // downhill neighbour, a whisper of moving water following the passage.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const bfsAt = (x: number, y: number): number =>
        x >= 0 && y >= 0 && x < W && y < H && isFloor(x, y) ? plan.bfs[y * W + x] : -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const onWater = ovAt(x, y) === OverlayKind.Water;
          const inChannel = isCorridorCell(x, y) || onWater;
          if (!inChannel) continue;
          // in a corridor, space chevrons out (~every 2nd cell); in open water,
          // thin them more so the pool stays a plane with a couple of drift marks.
          if (hash2(x, y, 970) > (onWater ? 0.28 : 0.55)) continue;
          const here = bfsAt(x, y);
          if (here < 0) continue;
          // downstream neighbour = the 4-neighbour with the GREATEST bfs (deeper
          // into the works, where the water drains).
          let ddx = 0; let ddy = 0; let best = here;
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
            const b = bfsAt(x + dx, y + dy);
            if (b > best) { best = b; ddx = dx; ddy = dy; }
          }
          if (ddx === 0 && ddy === 0) continue; // local sink, no clear flow
          // a chevron pointing downstream; a hair stronger over open water (dark
          // ink on the pool) than in a corridor (a whisper on the light floor).
          ctx.strokeStyle = onWater ? `${sheet.waterEdge}, 0.78)` : `${sheet.waterEdge}, 0.6)`;
          const cxp = (x + 0.5) * cell;
          const cyp = (y + 0.5) * cell;
          const tx = -ddy; const tyv = ddx; // across-flow
          const ahead = cell * 0.26;
          const wing = cell * 0.24;
          ctx.lineWidth = Math.max(0.9, cell * 0.08);
          ctx.beginPath();
          ctx.moveTo(cxp - ddx * ahead + tx * wing, cyp - ddy * ahead + tyv * wing);
          ctx.lineTo(cxp + ddx * ahead, cyp + ddy * ahead);
          ctx.lineTo(cxp - ddx * ahead - tx * wing, cyp - ddy * ahead - tyv * wing);
          ctx.stroke();
        }
      }
    }
  }

  // Inset floor shadow (WS1 Dyson carve-gutter): a soft dark stroke just inside
  // every boundary, under the ink line — rooms read as carved down into the
  // stone. Tinted to the theme's ink hue so the gutter belongs to this sheet's
  // stone. ORGANIC rooms take a curved inset gutter (below) instead of the
  // raster ticks, so the carve follows the same hand-inked wall.
  ctx.strokeStyle = sheet.floorShadow;
  ctx.lineWidth = Math.max(2, cell * 0.36);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isFloor(x, y) || isOrganicId(roomAt(x, y))) continue;
      if (!isFloor(x, y - 1)) { ctx.moveTo(x * cell, y * cell + cell * 0.12); ctx.lineTo((x + 1) * cell, y * cell + cell * 0.12); }
      if (!isFloor(x - 1, y)) { ctx.moveTo(x * cell + cell * 0.12, y * cell); ctx.lineTo(x * cell + cell * 0.12, (y + 1) * cell); }
    }
  }
  ctx.stroke();
  // Curved carve gutter for organic rooms: a soft dark stroke on a slightly
  // inset copy of the wall curve.
  if (organicContours.size > 0) {
    ctx.strokeStyle = sheet.floorShadow;
    ctx.lineWidth = Math.max(2, cell * 0.36);
    for (const contours of organicContours.values()) {
      for (const sc of contours) {
        if (!sc.closed) continue;
        pathContour(makeInsetContour(sc, Math.max(1.5, cell * 0.28)));
        ctx.stroke();
      }
    }
  }

  // ── Ink boundary lines ─ WS4 redraws the wall stroke as a hand-inked line ──
  // The pen swells on the SHADOW (SE) side and tapers on the LIT (NW) side per
  // the sheet's single upper-left light, and every stroke carries the raised
  // jitter. TWO languages share one hand: ORGANIC rooms (ellipse/octagon/
  // diamond) get a smoothed spline wall (no raster staircase); RECT rooms +
  // corridors keep crisp orthogonal walls but now with pressure + corner blots.
  const isTunnel = (x: number, y: number): boolean => tunnelCells.has(y * W + x);
  const outerFace = (x: number, y: number, dx: number, dy: number): boolean =>
    at(x + dx * 2, y + dy * 2) === CellKind.Void;
  // SE = shadow (heavier), NW = lit (lighter). `press` maps an edge's outward
  // normal to a 0.62‥1.28 weight multiplier.
  const press = (nx: number, ny: number): number => {
    const s = (nx + ny) / 2; // +1 at SE, −1 at NW
    return 0.95 + 0.33 * s;
  };
  const baseHeavy = Math.max(1.6, cell * 0.24);
  const baseLight = Math.max(1.4, cell * 0.14);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = sheet.ink;
  ctx.fillStyle = sheet.ink;

  // (a) ORGANIC ROOM WALLS — stroke the cached smooth curve as the definitive
  // inked cave wall. Pressure is per-span: each quadratic segment gets a weight
  // scaled by its outward normal (SE spans swell, NW spans taper), so the pen
  // reads hand-held. Corridor mouths are open arcs, so the opening stays a gap.
  for (const contours of organicContours.values()) {
    for (const sc of contours) {
      const p = sc.pts;
      const n = p.length;
      if (n < 2) continue;
      const spans = sc.closed ? n : n - 1;
      for (let i = 0; i < spans; i++) {
        const a = p[i];
        const b = p[(i + 1) % n];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        let nx = mx - sc.cx;
        let ny = my - sc.cy;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        ctx.lineWidth = (sc.closed ? baseHeavy : baseLight) * press(nx, ny);
        const prev = p[(i - 1 + n) % n];
        const start = sc.closed || i > 0 ? { x: (prev.x + a.x) / 2, y: (prev.y + a.y) / 2 } : a;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(a.x, a.y, mx, my);
        ctx.stroke();
      }
    }
  }

  // (b) RECT-ROOM + CORRIDOR ORTHOGONAL WALLS — per-edge jittered strokes, but
  // now each edge's weight is modulated by its outward normal (SE heavier), and
  // convex corners get a small ink blot where strokes cross (a real pen pools).
  // Organic-room cells are skipped (their curve is already drawn); tunnels get
  // the rough hand-cut pass below.
  // WS8 corridor-hierarchy weight: the wall bounding an ARTERIAL corridor cell is
  // drawn heavier (a confident spine), a SPUR lighter, so a sprawling network has
  // a legible backbone. `1` (through) is neutral; room walls always pass 1.
  const TIER_MUL = [0.74, 1, 1.34];
  const drawEdge = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, heavy: boolean, tierMul = 1): void => {
    ctx.lineWidth = (heavy ? baseHeavy : baseLight) * press(nx, ny) * tierMul;
    ctx.beginPath();
    ctx.moveTo(jx(ax, ay), jy(ax, ay));
    ctx.lineTo(jx(bx, by), jy(bx, by));
    ctx.stroke();
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isFloor(x, y) || isTunnel(x, y) || isOrganicId(roomAt(x, y))) continue;
      // corridor cells carry their hierarchy tier into the wall weight; room
      // cells stay neutral (their structure is read by shape, not corridor role).
      const tm = isCorridorCell(x, y) ? TIER_MUL[tierAt(x, y)] : 1;
      if (!isFloor(x, y - 1)) drawEdge(x, y, x + 1, y, 0, -1, outerFace(x, y, 0, -1), tm);
      if (!isFloor(x, y + 1)) drawEdge(x, y + 1, x + 1, y + 1, 0, 1, outerFace(x, y, 0, 1), tm);
      if (!isFloor(x - 1, y)) drawEdge(x, y, x, y + 1, -1, 0, outerFace(x, y, -1, 0), tm);
      if (!isFloor(x + 1, y)) drawEdge(x + 1, y, x + 1, y + 1, 1, 0, outerFace(x, y, 1, 0), tm);
      // Corner blot at a convex outside corner (two orthogonal walls meet).
      const wN = !isFloor(x, y - 1);
      const wS = !isFloor(x, y + 1);
      const wE = !isFloor(x + 1, y);
      const wW = !isFloor(x - 1, y);
      const blot = (vx: number, vy: number): void => {
        ctx.beginPath();
        ctx.arc(jx(vx, vy), jy(vx, vy), Math.max(0.9, cell * 0.075), 0, Math.PI * 2);
        ctx.fill();
      };
      if (wN && wW) blot(x, y);
      if (wN && wE) blot(x + 1, y);
      if (wS && wW) blot(x, y + 1);
      if (wS && wE) blot(x + 1, y + 1);
    }
  }

  // Rough hand-cut outline for dug tunnels: every boundary edge is TWO
  // segments through a wobbled midpoint (coord hash) — pick-work, not masonry.
  if (tunnelCells.size > 0) {
    ctx.strokeStyle = sheet.ink;
    ctx.lineWidth = Math.max(1.5, cell * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const rough = (x0: number, y0: number, x1: number, y1: number, horiz: boolean): void => {
      const ax = jx(x0, y0);
      const ay = jy(x0, y0);
      const bx = jx(x1, y1);
      const by = jy(x1, y1);
      // Wobble with a floor in PIXELS so hand-cut still reads on huge maps
      // where a cell is only ~5 px. WS4 widens the dug wobble (0.55 → 0.7) so a
      // pick-cut robber tunnel reads unmistakably rougher than a built wall.
      const amp = Math.max(cell * 0.7, 5);
      const w = (hash2(x0 + x1, y0 + y1, 131) - 0.5) * amp;
      const mx = (ax + bx) / 2 + (horiz ? 0 : w);
      const my = (ay + by) / 2 + (horiz ? w : 0);
      ctx.moveTo(ax, ay);
      ctx.lineTo(mx, my);
      ctx.lineTo(bx, by);
    };
    for (const i of tunnelCells) {
      const x = i % W;
      const y = (i / W) | 0;
      if (!isFloor(x, y)) continue;
      if (!isFloor(x, y - 1)) rough(x, y, x + 1, y, true);
      if (!isFloor(x, y + 1)) rough(x, y + 1, x + 1, y + 1, true);
      if (!isFloor(x - 1, y)) rough(x, y, x, y + 1, false);
      if (!isFloor(x + 1, y)) rough(x + 1, y, x + 1, y + 1, false);
    }
    ctx.stroke();
  }

  // ── Corridor craft (WS4) ─ jambs, junctions, and artery width read ─────────
  // Corridors stop reading as one uniform pipe: main runs get a faint centre
  // runner (a wider-hall cue), every mouth where a passage meets a room gets a
  // JAMB (short thick wall returns flanking the opening + a threshold tick), and
  // junction cells get a small ink blot so tees read as built joinery, not a
  // raster union. Dug tunnels are left to their rough hand-cut pass above.
  {
    const corrNbrs = (x: number, y: number): number =>
      (isCorridorCell(x, y - 1) ? 1 : 0) + (isCorridorCell(x, y + 1) ? 1 : 0) +
      (isCorridorCell(x - 1, y) ? 1 : 0) + (isCorridorCell(x + 1, y) ? 1 : 0);

    // (a) ARTERY CENTRE RUNNER — corridor cells that are mid-run (≥2 corridor
    // neighbours, i.e. a through route, not a one-cell stub) carry a short
    // hairline down the direction of travel. Built corridors only (skip dug).
    // WS8: the runner is TIER-GRADED so the spine reads — an arterial (spine)
    // cell gets a darker, wider runner (a confident drawn backbone the eye can
    // follow across a sprawl); a through cell keeps the old whisper; a spur gets
    // none (a dead-end shouldn't advertise itself as circulation).
    ctx.strokeStyle = sheet.ink;
    ctx.lineCap = 'round';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isCorridorCell(x, y) || isTunnel(x, y)) continue;
        if (corrNbrs(x, y) < 2) continue;
        const t = tierAt(x, y);
        if (t === 0) continue; // spur: no runner
        ctx.globalAlpha = t === 2 ? 0.4 : 0.2;
        ctx.lineWidth = t === 2 ? Math.max(1.1, cell * 0.11) : Math.max(0.8, cell * 0.055);
        const px = (x + 0.5) * cell;
        const py = (y + 0.5) * cell;
        const horiz = isCorridorCell(x - 1, y) || isCorridorCell(x + 1, y);
        const vert = isCorridorCell(x, y - 1) || isCorridorCell(x, y + 1);
        // arterial runner reaches cell-edge to cell-edge so consecutive spine
        // cells fuse into ONE continuous line; through/spur stay short ticks.
        const reach = t === 2 ? 0.5 : 0.34;
        ctx.beginPath();
        if (horiz) { ctx.moveTo(px - cell * reach, py); ctx.lineTo(px + cell * reach, py); }
        if (vert) { ctx.moveTo(px, py - cell * reach); ctx.lineTo(px, py + cell * reach); }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // (b) JAMBS at corridor→room mouths. A mouth is a corridor-cell face onto a
    // ROOM cell. The reveal must READ against the light floor, so instead of a
    // dark-on-dark stub it draws two small dark jamb blocks that PROTRUDE from
    // the frame walls into the opening (narrowing it, the "someone cut this
    // doorway" reveal), each ink-outlined, with a threshold doorstep tick across
    // the middle. Only real frame walls carry a jamb (open tee sides are left).
    const jambProtrude = Math.max(cell * 0.2, 1.4);
    const jambDepth = Math.max(cell * 0.34, 2.2);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isCorridorCell(x, y)) continue;
        const faces: [number, number][] = [];
        if (roomAt(x, y - 1) >= 0) faces.push([0, -1]);
        if (roomAt(x, y + 1) >= 0) faces.push([0, 1]);
        if (roomAt(x - 1, y) >= 0) faces.push([-1, 0]);
        if (roomAt(x + 1, y) >= 0) faces.push([1, 0]);
        for (const [dx, dy] of faces) {
          // Opening face midpoint (between corridor cell and the room cell).
          const fx = (x + 0.5 + dx * 0.5) * cell;
          const fy = (y + 0.5 + dy * 0.5) * cell;
          const tx = -dy; // tangent along the wall face
          const tyv = dx;
          let drewJamb = false;
          for (const s of [-1, 1]) {
            // frame wall sits one cell along the tangent, on the corridor side
            if (isFloor(x + tx * s, y + tyv * s)) continue;
            drewJamb = true;
            // jamb block: a small dark rect at the opening corner, protruding
            // `jambProtrude` across the mouth and `jambDepth` along the passage.
            const cxj = fx + tx * s * (cell * 0.5); // opening corner (frame side)
            const cyj = fy + tyv * s * (cell * 0.5);
            // corners of the reveal quad
            const a1x = cxj;
            const a1y = cyj;
            const a2x = cxj - tx * s * jambProtrude;
            const a2y = cyj - tyv * s * jambProtrude;
            const a3x = a2x - dx * jambDepth;
            const a3y = a2y - dy * jambDepth;
            const a4x = a1x - dx * jambDepth;
            const a4y = a1y - dy * jambDepth;
            ctx.beginPath();
            ctx.moveTo(a1x, a1y);
            ctx.lineTo(a2x, a2y);
            ctx.lineTo(a3x, a3y);
            ctx.lineTo(a4x, a4y);
            ctx.closePath();
            ctx.fillStyle = sheet.wallBody;
            ctx.fill();
            ctx.strokeStyle = sheet.ink;
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(1, cell * 0.08);
            ctx.stroke();
          }
          if (drewJamb) {
            // threshold doorstep tick across the narrowed opening
            ctx.strokeStyle = sheet.ink;
            ctx.globalAlpha = 0.55;
            ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(1, cell * 0.08);
            ctx.beginPath();
            ctx.moveTo(fx - tx * (cell * 0.28) - dx * cell * 0.16, fy - tyv * (cell * 0.28) - dy * cell * 0.16);
            ctx.lineTo(fx + tx * (cell * 0.28) - dx * cell * 0.16, fy + tyv * (cell * 0.28) - dy * cell * 0.16);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // (c) JUNCTION BLOTS — a tee/cross corridor cell (≥3 corridor neighbours)
    // gets a small ink pool at its meeting corners so the joinery reads as
    // deliberate, matching the corner blots on rect rooms.
    ctx.fillStyle = sheet.ink;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isCorridorCell(x, y) || isTunnel(x, y)) continue;
        if (corrNbrs(x, y) < 3) continue;
        // blot the convex outside corners of this junction cell
        const wN = !isFloor(x, y - 1);
        const wS = !isFloor(x, y + 1);
        const wE = !isFloor(x + 1, y);
        const wW = !isFloor(x - 1, y);
        const r = Math.max(0.9, cell * 0.085);
        const blot = (vx: number, vy: number): void => {
          ctx.beginPath();
          ctx.arc(jx(vx, vy), jy(vx, vy), r, 0, Math.PI * 2);
          ctx.fill();
        };
        if (wN && wW) blot(x, y);
        if (wN && wE) blot(x + 1, y);
        if (wS && wW) blot(x, y + 1);
        if (wS && wE) blot(x + 1, y + 1);
      }
    }
  }

  // Theme wall treatments over the band.
  if (sheet.wallTreatment === 'course') {
    // coursed-block ticks: short perpendicular marks along the wall band,
    // in the theme's masonry-highlight tone (was a hardcoded warm cream).
    ctx.strokeStyle = sheet.courseTick;
    ctx.lineWidth = Math.max(1, cell * 0.08);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isWall(x, y)) continue;
        if (hash2(x, y, 61) < 0.5) continue;
        const horiz = isFloor(x, y - 1) || isFloor(x, y + 1);
        const px = (x + 0.5) * cell;
        const py = (y + 0.5) * cell;
        ctx.beginPath();
        if (horiz) { ctx.moveTo(px, py - cell * 0.3); ctx.lineTo(px, py + cell * 0.3); }
        else { ctx.moveTo(px - cell * 0.3, py); ctx.lineTo(px + cell * 0.3, py); }
        ctx.stroke();
      }
    }
  } else if (sheet.wallTreatment === 'rime') {
    // pale frost line hugging the floor side of the wall
    ctx.strokeStyle = 'rgba(185, 215, 235, 0.5)';
    ctx.lineWidth = Math.max(1, cell * 0.07);
    ctx.beginPath();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isFloor(x, y)) continue;
        const o = cell * 0.22;
        if (!isFloor(x, y - 1)) { ctx.moveTo(x * cell, y * cell + o); ctx.lineTo((x + 1) * cell, y * cell + o); }
        if (!isFloor(x - 1, y)) { ctx.moveTo(x * cell + o, y * cell); ctx.lineTo(x * cell + o, (y + 1) * cell); }
      }
    }
    ctx.stroke();
  }

  // ── Doors, by state ────────────────────────────────────────────────────────
  for (const d of plan.doors) {
    const { x: dx, y: dy } = d.cell;
    const vertPassage = isFloor(dx, dy - 1) && isFloor(dx, dy + 1);
    const horzPassage = isFloor(dx - 1, dy) && isFloor(dx + 1, dy);
    const vertical = vertPassage && !horzPassage ? true : horzPassage && !vertPassage ? false : isFloor(dx, dy - 1) || isFloor(dx, dy + 1);
    const px = (dx + 0.5) * cell;
    const py = (dy + 0.5) * cell;

    if (d.state === 'open') continue; // plain gap — the absence IS the glyph

    if (d.state === 'secret') {
      if (!ov.secrets) continue; // hidden until searched
      // Glyph size floored in PIXELS so it stays legible on huge maps.
      const half = Math.max(cell * 0.42, 6);
      ctx.fillStyle = sheet.floor;
      ctx.fillRect(px - half, py - half, half * 2, half * 2);
      ctx.strokeStyle = sheet.ink;
      ctx.lineWidth = Math.max(1.5, cell * 0.1);
      ctx.setLineDash([Math.max(2.5, cell * 0.18), Math.max(2.5, cell * 0.18)]);
      ctx.strokeRect(px - half, py - half, half * 2, half * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = sheet.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.max(9, cell * 0.6)}px Georgia, serif`;
      ctx.fillText('S', px, py);
      continue;
    }

    if (d.state === 'bricked') {
      // WS6 story beat: an UNMISTAKABLE red-brick infill plugging the opening, in
      // the loudest register on the sheet — the reader scanning for "walled-off
      // there" must catch it. The patch spans the passage width (courses run
      // ACROSS the opening) with individually-drawn staggered bricks + a dark
      // knockout frame, so it reads as masonry someone laid to seal the way, not a
      // stray red pixel. Sized in PIXELS so it survives when a cell is ~5px.
      const along = vertical ? cell * 0.62 : cell * 1.02; // across the wall face
      const thru = vertical ? cell * 1.02 : cell * 0.62; // depth into the passage
      const bw = Math.max(along, vertical ? 9 : 15);
      const bh = Math.max(thru, vertical ? 15 : 9);
      const bx = px - bw / 2;
      const by = py - bh / 2;
      // dark knockout so the plug reads seated in the wall band.
      ctx.fillStyle = sheet.wallBody;
      ctx.fillRect(bx - cell * 0.06, by - cell * 0.06, bw + cell * 0.12, bh + cell * 0.12);
      // brick body.
      ctx.fillStyle = '#b0563f';
      ctx.fillRect(bx, by, bw, bh);
      // Courses run across the wall face; bricks stagger row to row. Choose the
      // course axis so rows stack THROUGH the passage (like real infill).
      ctx.strokeStyle = sheet.ink;
      ctx.lineWidth = Math.max(1, cell * 0.055);
      const rows = 4;
      const brickPerRow = 3;
      const acrossV = !vertical; // when passage is horizontal, courses stack vertically
      for (let r = 0; r < rows; r++) {
        const t0 = r / rows;
        const t1 = (r + 1) / rows;
        const stagger = (r % 2) * (0.5 / brickPerRow);
        // course line
        ctx.beginPath();
        if (acrossV) { const yy = by + bh * t0; ctx.moveTo(bx, yy); ctx.lineTo(bx + bw, yy); }
        else { const xx = bx + bw * t0; ctx.moveTo(xx, by); ctx.lineTo(xx, by + bh); }
        ctx.stroke();
        // head joints within the course (staggered)
        for (let k = 0; k <= brickPerRow; k++) {
          const f = k / brickPerRow + stagger;
          if (f <= 0 || f >= 1) continue;
          ctx.beginPath();
          if (acrossV) { ctx.moveTo(bx + bw * f, by + bh * t0); ctx.lineTo(bx + bw * f, by + bh * t1); }
          else { ctx.moveTo(bx + bw * t0, by + bh * f); ctx.lineTo(bx + bw * t1, by + bh * f); }
          ctx.stroke();
        }
      }
      ctx.lineWidth = Math.max(1.5, cell * 0.11);
      ctx.strokeRect(bx, by, bw, bh);
      continue;
    }

    // state 'door': built leaf — dark bar ACROSS the passage between jambs.
    ctx.fillStyle = sheet.wallBody;
    const jw = cell * 0.3;
    const jl = cell * 0.34;
    if (vertical) {
      // passage runs vertically → wall runs horizontally → jambs left/right
      ctx.fillRect(px - cell * 0.5, py - jl / 2, jw, jl);
      ctx.fillRect(px + cell * 0.5 - jw, py - jl / 2, jw, jl);
    } else {
      ctx.fillRect(px - jl / 2, py - cell * 0.5, jl, jw);
      ctx.fillRect(px - jl / 2, py + cell * 0.5 - jw, jl, jw);
    }
    ctx.fillStyle = sheet.doorLeaf;
    ctx.strokeStyle = sheet.ink;
    ctx.lineWidth = Math.max(1, cell * 0.08);
    ctx.beginPath();
    if (vertical) ctx.rect(px - cell * 0.38, py - cell * 0.14, cell * 0.76, cell * 0.28);
    else ctx.rect(px - cell * 0.14, py - cell * 0.38, cell * 0.28, cell * 0.76);
    ctx.fill();
    ctx.stroke();
  }

  // difficulty heatmap (debug overlay)
  if (ov.heatmap) {
    for (const r of plan.rooms) {
      ctx.fillStyle = heat(r.difficulty);
      ctx.globalAlpha = 0.3;
      ctx.fillRect(rx0(r) * cell, ry0(r) * cell, (r.w / ft) * cell, (r.h / ft) * cell);
      ctx.globalAlpha = 1;
    }
  }

  // ── props — Watabou-style open-outline glyph vocabulary ───────────────────
  // Loudness ladder (must survive a squint): structure > evidence > furniture
  // > debris. Furniture = open ink outlines sized to the cell (a burial
  // gallery READS as rows of sarcophagi); evidence = heavier ink + accent
  // fills; debris = small, translucent, background texture. All variation is
  // coord-hash — deterministic, no Math.random.
  if (ov.props) {
    // ── Placement composition (WS5) ─ turn the mechanical wall-to-wall lattice
    // into hand-placed groups with negative space. The generator lays row
    // furniture (sarcophagi, pews, long-tables) on a coarse interior grid with
    // no aisle; here we read each room's props, find the row block's dominant
    // axis, and (1) carve a central PROCESSIONAL AISLE by suppressing the middle
    // file of items, (2) face the flanking rows across that aisle. A centred
    // solo piece (altar/hoist/chest) is left alone with clear floor around it.
    // All deterministic from cell positions + room geometry — no Math.random.
    const ROW_KINDS = new Set(['sarcophagus', 'pew', 'long-table', 'disturbed-lid']);
    const propRoomMeta = new Map<number, { aisleAxis: 'h' | 'v' | null }>();
    const propsByRoom = new Map<number, DungeonProp[]>();
    for (const p of plan.props) {
      const arr = propsByRoom.get(p.roomId);
      if (arr) arr.push(p); else propsByRoom.set(p.roomId, [p]);
    }
    // Suppressed props (fall in the carved aisle) — skipped in the draw loop.
    const suppressed = new Set<DungeonProp>();
    for (const [rid, list] of propsByRoom) {
      const rows = list.filter((p) => ROW_KINDS.has(p.kind));
      if (rows.length < 4) { propRoomMeta.set(rid, { aisleAxis: null }); continue; }
      // bounding span of the row block in cells
      let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
      for (const p of rows) {
        const cx = p.x / ft; const cy = p.y / ft;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      }
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      // Aisle runs ALONG the longer span; the file(s) crossing its centre are
      // culled to open a processional walkway.
      const axis: 'h' | 'v' = spanX >= spanY ? 'h' : 'v';
      const shortOf = (p: DungeonProp): number => (axis === 'h' ? p.y / ft : p.x / ft);
      // Distinct row lines on the short axis. Selecting the aisle by RANK (the
      // middle line, or the middle two when the count is even) is robust to the
      // irregular row spacing an octagon/ellipse mask produces — a coordinate
      // band could otherwise land between rows and cull nothing, leaving no
      // aisle. Carve only with ≥3 rows (a 2-row block has no middle to remove
      // without gutting it).
      const lines = [...new Set(rows.map(shortOf))].sort((a, b) => a - b);
      const carve = lines.length >= 3;
      if (carve) {
        const mid = (lines.length - 1) / 2;
        const aisleLines = new Set<number>([lines[Math.floor(mid)]]);
        if (lines.length % 2 === 0) aisleLines.add(lines[Math.ceil(mid)]); // even → clear the central pair
        for (const p of rows) if (aisleLines.has(shortOf(p))) suppressed.add(p);
      }
      propRoomMeta.set(rid, { aisleAxis: carve ? axis : null });
    }

    for (const p of plan.props) {
      if (suppressed.has(p)) continue; // culled to open the processional aisle
      const cxp = p.x / ft;
      const cyp = p.y / ft;
      // Per-item hand-placed jitter: a small deterministic offset + rotation
      // wobble so a row of coffins reads laid-by-hand, not stamped on a lattice.
      // Debris/structure keep zero jitter (they are already irregular / precise).
      const jOff = (k: number): number => (hash2(cxp, cyp, k) - 0.5);
      const px = (cxp + 0.5) * cell + jOff(211) * cell * 0.14;
      const py = (cyp + 0.5) * cell + jOff(213) * cell * 0.14;
      // Row furniture sits long-side ALONG the processional aisle, so a gallery
      // reads as ranked files rather than a scatter: an h-aisle wants rot 0, a
      // v-aisle rot 90. Plus a ±5° hand wobble so the rank looks laid by hand.
      const meta = propRoomMeta.get(p.roomId);
      const wobble = jOff(217) * 10; // deg
      const rowRot = meta && meta.aisleAxis && ROW_KINDS.has(p.kind)
        ? (meta.aisleAxis === 'h' ? 0 : 90)
        : p.rot;
      const u = cell * (p.scale || 1);
      const wFurn = Math.max(1, cell * 0.09);
      const wEvid = Math.max(1.4, cell * 0.13);
      /** Nearest wall direction (unit cell step) for wall-anchored glyphs. */
      const wallDir = (): [number, number] => {
        if (isWall(cxp, cyp - 1)) return [0, -1];
        if (isWall(cxp, cyp + 1)) return [0, 1];
        if (isWall(cxp - 1, cyp)) return [-1, 0];
        if (isWall(cxp + 1, cyp)) return [1, 0];
        return [0, -1];
      };
      /** Rotation (deg) that points local -y at the nearest wall. */
      const wallAngle = (): number => {
        const [wx2, wy2] = wallDir();
        return wy2 === -1 ? 0 : wy2 === 1 ? 180 : wx2 === -1 ? 270 : 90;
      };
      /** Runs fn in a frame rotated `deg` about the cell center. */
      const withRot = (deg: number, fn: () => void): void => {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((deg * Math.PI) / 180);
        fn();
        ctx.restore();
      };
      /** Furniture voice: open ink outline, floor-colored interior. */
      const furnInk = (): void => {
        ctx.strokeStyle = sheet.ink;
        ctx.fillStyle = sheet.floor;
        ctx.lineWidth = wFurn;
        ctx.globalAlpha = 0.88;
      };
      /** Evidence voice: full ink, heavier line — slightly louder. */
      const evidInk = (): void => {
        ctx.strokeStyle = sheet.ink;
        ctx.fillStyle = sheet.floor;
        ctx.lineWidth = wEvid;
        ctx.globalAlpha = 1;
      };
      /** Floor-filled outlined box (fill hides overlay scars under the glyph). */
      const box = (x: number, y: number, w: number, h: number): void => {
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      };
      // Debris whispers: translucent so the meaningful vocabulary dominates.
      const isDebris =
        p.kind === 'bones' || p.kind === 'rubble' || p.kind === 'mushroom' ||
        p.kind === 'iceshard' || p.kind === 'pool' || p.kind === 'stalagmite';
      ctx.globalAlpha = isDebris ? 0.4 : 1;

      // ── WS6 story-mark promotion ─ the props that ARE the dungeon's narrative
      // (a dug tunnel-mouth, a pried-open vault + its coin trail, a monster nest,
      // a sprung sarcophagus lid) must read as the SECOND thing the eye finds
      // after the walls — the sheet's "flooded here, robbed there, denned there"
      // beats. They ride the same fill/scar as everything else, so first knock out
      // a soft floor-colored halo beneath the mark: it survives over a water pool
      // or a spore field and lifts the beat to a mid value tier ABOVE furniture.
      const STORY_MARK = new Set([
        'tunnel-mouth', 'pried-vault', 'dropped-coins', 'nest', 'disturbed-lid',
        'spore-shelf', 'snapped-bar', 'pick-scars', 'crates',
      ]);
      if (STORY_MARK.has(p.kind) && p.kind !== 'pick-scars') {
        // pick-scars live ON the wall band (their own knockout), skip the pad.
        const hr = cell * (p.kind === 'dropped-coins' ? 0.7 : 0.62);
        const g = ctx.createRadialGradient(px, py, hr * 0.25, px, py, hr);
        g.addColorStop(0, `${sheet.roomShadeLight}, 0.85)`);
        g.addColorStop(0.7, `${sheet.roomShadeLight}, 0.5)`);
        g.addColorStop(1, `${sheet.roomShadeLight}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, hr, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── WS5 furniture silhouettes: each kind is a nameable object at a
      // squint, not an aspect-ratio variation of one box. Row furniture faces
      // across the carved aisle via `rowRot + wobble`; a short cast-shadow tick
      // (theme carve-tone, SE) lifts each piece so it reads as a solid, not an
      // outline. Floored in pixels so seams survive at ~5px cells.
      /** Fill+stroke the current path with a soft SE drop-shadow ghost first. */
      const solid = (draw: () => void): void => {
        ctx.save();
        ctx.translate(cell * 0.09, cell * 0.11);
        ctx.fillStyle = sheet.floorShadow;
        ctx.globalAlpha = (ctx.globalAlpha) * 0.7;
        draw();
        ctx.fill();
        ctx.restore();
        draw();
        ctx.fill();
        ctx.stroke();
      };
      if (p.kind === 'pillar') {
        // hollow ring with a hint of cast shadow — unmistakably structure
        // (shadow in the theme's carve-tone so it belongs to this sheet's stone)
        ctx.fillStyle = sheet.floorShadow;
        ctx.beginPath();
        ctx.arc(px + cell * 0.08, py + cell * 0.1, cell * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = sheet.ink;
        ctx.lineWidth = Math.max(1.5, cell * 0.14);
        ctx.fillStyle = sheet.floor;
        ctx.beginPath();
        ctx.arc(px, py, cell * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'chest') {
        // Lidded box with a hasp plate — a strongbox, not a plain rectangle.
        furnInk();
        withRot(p.rot + wobble, () => {
          const w = u * 0.66; const h = u * 0.46;
          solid(() => { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); });
          ctx.beginPath(); // lid seam
          ctx.moveTo(-w / 2, -h * 0.16); ctx.lineTo(w / 2, -h * 0.16);
          ctx.stroke();
          ctx.fillStyle = sheet.ink; // hasp
          ctx.fillRect(-u * 0.05, -h * 0.16, u * 0.1, h * 0.34);
        });
      } else if (p.kind === 'sarcophagus' || p.kind === 'disturbed-lid') {
        // Tapered mummy-case ogee: head end wider & rounded, foot narrower —
        // a coffin you can name at a squint. Lid seam runs the length. Rows of
        // these READ as a burial gallery. `disturbed-lid` slews the lid ajar.
        const disturbed = p.kind === 'disturbed-lid';
        if (disturbed) evidInk(); else furnInk();
        withRot(rowRot + wobble, () => {
          const L = u * 0.82; const wHead = u * 0.44; const wFoot = u * 0.3;
          const caseP = (): void => {
            ctx.beginPath();
            ctx.moveTo(-L, -wHead * 0.62);
            // rounded head (left)
            ctx.quadraticCurveTo(-L - wHead * 0.34, 0, -L, wHead * 0.62);
            ctx.quadraticCurveTo(-L * 0.35, wHead, 0, wFoot * 0.92); // shoulder→body
            ctx.lineTo(L, wFoot * 0.72);
            ctx.quadraticCurveTo(L + wFoot * 0.3, 0, L, -wFoot * 0.72); // foot
            ctx.lineTo(0, -wFoot * 0.92);
            ctx.quadraticCurveTo(-L * 0.35, -wHead, -L, -wHead * 0.62);
            ctx.closePath();
          };
          solid(caseP);
          if (disturbed) {
            // lid shoved off-axis, exposing the case rim
            ctx.save();
            ctx.rotate(-0.16);
            ctx.translate(u * 0.16, -u * 0.1);
            ctx.beginPath();
            ctx.moveTo(-L * 0.9, -wHead * 0.5);
            ctx.quadraticCurveTo(-L * 0.32, -wHead * 0.8, 0, -wFoot * 0.8);
            ctx.lineTo(L * 0.9, -wFoot * 0.6);
            ctx.lineTo(L * 0.9, wFoot * 0.5);
            ctx.quadraticCurveTo(0, wFoot * 0.7, -L * 0.9, wHead * 0.5);
            ctx.closePath();
            ctx.fillStyle = sheet.floor;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } else {
            // lid seam (inner ogee) — the offset that survives at 10px
            ctx.beginPath();
            ctx.moveTo(-L * 0.82, 0);
            ctx.quadraticCurveTo(-L * 0.3, wHead * 0.5, L * 0.82, wFoot * 0.28);
            ctx.moveTo(-L * 0.82, 0);
            ctx.quadraticCurveTo(-L * 0.3, -wHead * 0.5, L * 0.82, -wFoot * 0.28);
            ctx.stroke();
          }
        });
      } else if (p.kind === 'bone-niche') {
        // Stacked burial slots recessed INTO the wall — a loculi grid, ink-
        // divided, hugging the wall (local -y faces the wall).
        furnInk();
        withRot(wallAngle(), () => {
          const gw = u * 0.86; const gh = u * 0.34;
          solid(() => { ctx.beginPath(); ctx.rect(-gw / 2, -u * 0.5, gw, gh); });
          ctx.beginPath(); // vertical dividers → separate slots
          for (const f of [-0.25, 0.08]) { ctx.moveTo(gw * f, -u * 0.5); ctx.lineTo(gw * f, -u * 0.5 + gh); }
          ctx.moveTo(-gw / 2, -u * 0.5 + gh / 2); ctx.lineTo(gw / 2, -u * 0.5 + gh / 2); // shelf
          ctx.stroke();
        });
      } else if (p.kind === 'pew') {
        // A bench with a back-rail: a long seat plank + a thin rail tick behind,
        // facing across the aisle (the rail sits on the aisle-facing edge).
        furnInk();
        withRot(rowRot + wobble, () => {
          const w = u * 1.3;
          solid(() => { ctx.beginPath(); ctx.rect(-w / 2, -u * 0.1, w, u * 0.2); });
          ctx.beginPath(); // back-rail
          ctx.moveTo(-w / 2, -u * 0.2); ctx.lineTo(w / 2, -u * 0.2);
          ctx.stroke();
          ctx.beginPath(); // legs tick down
          for (const f of [-0.42, 0.42]) { ctx.moveTo(w * f, u * 0.1); ctx.lineTo(w * f, u * 0.22); }
          ctx.stroke();
        });
      } else if (p.kind === 'table' || p.kind === 'long-table') {
        // A trestle table: a plank top with two end trestle legs.
        furnInk();
        const long = p.kind === 'long-table';
        withRot((long ? rowRot : p.rot) + wobble, () => {
          const w = long ? u * 1.2 : u * 0.9; const h = u * 0.5;
          solid(() => { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); });
          ctx.beginPath(); // trestle legs (inset verticals)
          for (const f of [-0.4, 0.4]) { ctx.moveTo(w * f, -h / 2); ctx.lineTo(w * f, h / 2); }
          ctx.stroke();
        });
      } else if (p.kind === 'bunk') {
        // A cot: a mattress rectangle with a rounded pillow lump at the head.
        furnInk();
        withRot(p.rot + wobble, () => {
          const w = u * 1.2; const h = u * 0.54;
          solid(() => { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); });
          ctx.beginPath(); // pillow — rounded lump at the head (left)
          ctx.moveTo(-w / 2, -h / 2);
          ctx.lineTo(-w * 0.28, -h / 2);
          ctx.quadraticCurveTo(-w * 0.2, 0, -w * 0.28, h / 2);
          ctx.lineTo(-w / 2, h / 2);
          ctx.stroke();
        });
      } else if (p.kind === 'rack' || p.kind === 'tool-rack' || p.kind === 'weapon-rack') {
        // Wall rack: two uprights spanned by shelf rails with hanging ticks —
        // reads as a rack of gear against the wall, not a filled box.
        furnInk();
        const wallMounted = p.kind !== 'rack';
        withRot((wallMounted ? wallAngle() : p.rot) + wobble * 0.4, () => {
          const w = u * 1.2; const h = u * 0.4;
          const yTop = wallMounted ? -u * 0.5 : -h / 2; // wall racks hug the wall
          ctx.strokeStyle = sheet.ink;
          ctx.beginPath(); // frame
          ctx.rect(-w / 2, yTop, w, h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-w / 2, yTop + h * 0.5); ctx.lineTo(w / 2, yTop + h * 0.5); // mid rail
          for (const f of [-0.32, -0.08, 0.18, 0.42]) { // hanging items
            ctx.moveTo(w * f, yTop + h * 0.1); ctx.lineTo(w * f, yTop + h * 0.9);
          }
          ctx.stroke();
        });
      } else if (p.kind === 'altar' || p.kind === 'stone-slab') {
        // A stepped dais block with a distinct top: two concentric stone steps
        // and a raised altar/slab table on top — a focal ceremonial object,
        // unmistakable from a plain pillar ring. `stone-slab` = flatter bier.
        const slab = p.kind === 'stone-slab';
        furnInk();
        ctx.lineWidth = wEvid;
        const rBase = u * 0.5; const rTop = u * 0.32;
        // base step (cast shadow then fill)
        ctx.fillStyle = sheet.floorShadow;
        ctx.beginPath(); ctx.arc(px + cell * 0.1, py + cell * 0.12, rBase, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sheet.floor;
        ctx.beginPath(); ctx.arc(px, py, rBase, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, rBase * 0.74, 0, Math.PI * 2); ctx.stroke(); // riser rule
        // altar table on top (a rounded block), or a flat slab
        if (slab) {
          ctx.fillStyle = sheet.floor;
          ctx.beginPath(); ctx.ellipse(px, py, rTop, rTop * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px - rTop * 0.7, py); ctx.lineTo(px + rTop * 0.7, py); ctx.stroke();
        } else {
          const bw = u * 0.5; const bh = u * 0.34;
          ctx.fillStyle = sheet.floorShadow;
          ctx.fillRect(px - bw / 2 + cell * 0.06, py - bh / 2 + cell * 0.07, bw, bh);
          ctx.fillStyle = sheet.floor;
          ctx.fillRect(px - bw / 2, py - bh / 2, bw, bh);
          ctx.strokeRect(px - bw / 2, py - bh / 2, bw, bh);
          ctx.beginPath(); // top-slab overhang line
          ctx.moveTo(px - bw / 2, py - bh * 0.2); ctx.lineTo(px + bw / 2, py - bh * 0.2); ctx.stroke();
        }
      } else if (p.kind === 'hearth') {
        // A fire opening set in the wall: an arched hearth mouth with a mantel
        // lintel and ember dots — reads as a fireplace, not a half-box.
        furnInk();
        withRot(wallAngle(), () => {
          const w = u * 0.86;
          ctx.fillStyle = sheet.floorShadow; // the sooted recess
          ctx.beginPath();
          ctx.moveTo(-w / 2, u * 0.16);
          ctx.lineTo(-w / 2, -u * 0.28);
          ctx.quadraticCurveTo(0, -u * 0.62, w / 2, -u * 0.28);
          ctx.lineTo(w / 2, u * 0.16);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = sheet.ink;
          ctx.stroke();
          ctx.beginPath(); // mantel lintel above the arch
          ctx.moveTo(-w * 0.62, -u * 0.32); ctx.lineTo(w * 0.62, -u * 0.32);
          ctx.stroke();
          ctx.fillStyle = sheet.torch; // embers
          for (const f of [-0.18, 0.02, 0.2]) {
            ctx.beginPath(); ctx.arc(w * f * 0.6, u * 0.02, Math.max(1, u * 0.055), 0, Math.PI * 2); ctx.fill();
          }
        });
      } else if (p.kind === 'jar' || p.kind === 'grain-jar') {
        // A cluster of storage pots: each a pot SILHOUETTE — a round belly with
        // a pinched neck and a rim — not a plain circle.
        furnInk();
        const n = 3;
        for (let k = 0; k < n; k++) {
          const jxp = px + (hash2(cxp, cyp, 141 + k) - 0.5) * u * 0.6;
          const jyp = py + (hash2(cxp, cyp, 145 + k) - 0.5) * u * 0.5;
          const rr = u * (0.16 + hash2(cxp, cyp, 149 + k) * 0.05);
          const potP = (ox: number, oy: number): void => {
            ctx.beginPath();
            ctx.moveTo(jxp - rr * 0.42 + ox, jyp - rr + oy); // neck top-left
            ctx.lineTo(jxp + rr * 0.42 + ox, jyp - rr + oy); // rim
            ctx.lineTo(jxp + rr * 0.32 + ox, jyp - rr * 0.5 + oy); // neck
            ctx.quadraticCurveTo(jxp + rr + ox, jyp - rr * 0.2 + oy, jxp + rr * 0.85 + ox, jyp + rr * 0.4 + oy);
            ctx.quadraticCurveTo(jxp + rr * 0.5 + ox, jyp + rr + oy, jxp + ox, jyp + rr + oy);
            ctx.quadraticCurveTo(jxp - rr * 0.5 + ox, jyp + rr + oy, jxp - rr * 0.85 + ox, jyp + rr * 0.4 + oy);
            ctx.quadraticCurveTo(jxp - rr + ox, jyp - rr * 0.2 + oy, jxp - rr * 0.32 + ox, jyp - rr * 0.5 + oy);
            ctx.closePath();
          };
          ctx.fillStyle = sheet.floorShadow;
          potP(cell * 0.06, cell * 0.07); ctx.fill();
          ctx.fillStyle = sheet.floor;
          potP(0, 0); ctx.fill(); ctx.stroke();
        }
      } else if (p.kind === 'hoist-wheel') {
        // Spoked winding wheel over the shaft — a wheel with a hub and 6 spokes.
        furnInk();
        solid(() => { ctx.beginPath(); ctx.arc(px, py, u * 0.44, 0, Math.PI * 2); });
        ctx.beginPath(); // inner rim
        ctx.arc(px, py, u * 0.44, 0, Math.PI * 2);
        ctx.moveTo(px + u * 0.32, py); ctx.arc(px, py, u * 0.32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (p.rot * Math.PI) / 180 + (k * Math.PI) / 6;
          ctx.moveTo(px - Math.cos(a) * u * 0.44, py - Math.sin(a) * u * 0.44);
          ctx.lineTo(px + Math.cos(a) * u * 0.44, py + Math.sin(a) * u * 0.44);
        }
        ctx.stroke();
        ctx.fillStyle = sheet.ink; // hub
        ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, u * 0.08), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'pried-vault') {
        // A sprung strongbox — the lid levered up, the vault gaping. A story
        // beat: heavier ink than furniture + a shadowed open maw so the reader
        // reads "robbed here" at sheet scale.
        evidInk();
        ctx.lineWidth = Math.max(1.8, cell * 0.16);
        withRot(p.rot, () => {
          // the dark open interior (the emptied vault).
          ctx.fillStyle = sheet.wallBody;
          ctx.fillRect(-u * 0.32, -u * 0.22, u * 0.64, u * 0.44);
          ctx.fillStyle = sheet.floor;
          box(-u * 0.36, -u * 0.26, u * 0.72, u * 0.52);
          // re-punch the dark maw over the box floor-fill.
          ctx.fillStyle = sheet.wallBody;
          ctx.fillRect(-u * 0.26, -u * 0.16, u * 0.52, u * 0.34);
          ctx.strokeStyle = sheet.ink;
          ctx.strokeRect(-u * 0.26, -u * 0.16, u * 0.52, u * 0.34);
          ctx.save(); // lid hinged at the top-left corner, levered up
          ctx.translate(-u * 0.36, -u * 0.26);
          ctx.rotate(-0.6);
          ctx.fillStyle = sheet.floor;
          box(0, -u * 0.3, u * 0.74, u * 0.3);
          ctx.restore();
        });
      } else if (p.kind === 'dropped-coins') {
        // A trail of coin discs spilling from the vault — larger + ink-ringed so
        // the scatter reads as the thief's spill at sheet scale.
        evidInk();
        const n = 5 + Math.floor(hash2(cxp, cyp, 151) * 3);
        const a0 = hash2(cxp, cyp, 153) * Math.PI * 2;
        ctx.lineWidth = Math.max(1, cell * 0.06);
        for (let k = 0; k < n; k++) {
          const t = k / (n - 1);
          const a = a0 + t * 1.8;
          const rr = u * (0.12 + t * 0.5);
          ctx.fillStyle = '#c9a63c';
          ctx.strokeStyle = sheet.ink;
          ctx.beginPath();
          ctx.arc(px + Math.cos(a) * rr, py + Math.sin(a) * rr, Math.max(1.5, u * 0.1), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (p.kind === 'nest') {
        // A denned mound — a bold ragged scribble ring with a shadowed hollow, so
        // "something lairs here" reads as a narrative beat, not a faint doodle.
        // Soft shadow bed first, then a heavy dark scribble ring.
        ctx.fillStyle = sheet.floorShadow;
        ctx.beginPath();
        ctx.ellipse(px + cell * 0.08, py + cell * 0.1, u * 0.42, u * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = sheet.ink;
        ctx.globalAlpha = 1;
        ctx.lineWidth = Math.max(1.6, cell * 0.13);
        // two overlapping ragged rings for a matted-bedding read.
        for (const ringR of [0.42, 0.3]) {
          ctx.beginPath();
          const nPts = 13;
          for (let k = 0; k <= nPts; k++) {
            const a = (k / nPts) * Math.PI * 2;
            const rr = u * (ringR - 0.06 + hash2(cxp, cyp, 160 + (k % nPts) + (ringR > 0.35 ? 0 : 20)) * 0.16);
            const xx = px + Math.cos(a) * rr;
            const yy = py + Math.sin(a) * rr;
            if (k === 0) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
          }
          ctx.stroke();
        }
      } else if (p.kind === 'candles') {
        // Wax dots with flame ticks — a vigil, not a lighting fixture.
        evidInk();
        for (let k = 0; k < 3; k++) {
          const cxx = px + (hash2(cxp, cyp, 170 + k) - 0.5) * u * 0.6;
          const cyy = py + (hash2(cxp, cyp, 174 + k) - 0.5) * u * 0.6;
          ctx.fillStyle = sheet.ink;
          ctx.beginPath();
          ctx.arc(cxx, cyy, Math.max(1, u * 0.06), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = sheet.torch;
          ctx.lineWidth = Math.max(1, cell * 0.07);
          ctx.beginPath();
          ctx.moveTo(cxx, cyy - u * 0.08);
          ctx.lineTo(cxx, cyy - u * 0.22);
          ctx.stroke();
          ctx.strokeStyle = sheet.ink;
        }
      } else if (p.kind === 'snapped-bar') {
        // Broken bar across the threshold: one half intact, one snapped askew.
        evidInk();
        const vertPassage = isFloor(cxp, cyp - 1) && isFloor(cxp, cyp + 1);
        withRot(vertPassage ? 0 : 90, () => {
          ctx.lineWidth = Math.max(1.6, cell * 0.16);
          ctx.beginPath();
          ctx.moveTo(-u * 0.5, 0);
          ctx.lineTo(-u * 0.06, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(u * 0.06, u * 0.05);
          ctx.lineTo(u * 0.48, u * 0.3);
          ctx.stroke();
        });
      } else if (p.kind === 'tunnel-mouth') {
        // A rough BREACH hacked through the rock — a jagged dark hole, plainly
        // NOT a clean built door: a bold ragged ring around a shadowed maw with
        // radiating pick-strokes. A story beat ("dug in here") that reads at
        // sheet scale.
        evidInk();
        const ringPath = (rMul: number): void => {
          ctx.beginPath();
          const segs = 11;
          for (let k = 0; k <= segs; k++) {
            const a = (k / segs) * Math.PI * 2;
            const rr = u * rMul * (0.72 + hash2(cxp, cyp, 180 + (k % segs)) * 0.55);
            const xx = px + Math.cos(a) * rr;
            const yy = py + Math.sin(a) * rr;
            if (k === 0) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
          }
          ctx.closePath();
        };
        // dark maw
        ctx.fillStyle = sheet.wallBody;
        ringPath(0.46);
        ctx.fill();
        // bold ragged rim
        ctx.strokeStyle = sheet.ink;
        ctx.lineWidth = Math.max(2, cell * 0.18);
        ctx.lineJoin = 'round';
        ringPath(0.46);
        ctx.stroke();
        // a couple of pick-strokes radiating from the breach
        ctx.lineWidth = Math.max(1, cell * 0.07);
        for (let k = 0; k < 4; k++) {
          const a = hash2(cxp, cyp, 190 + k) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(a) * u * 0.46, py + Math.sin(a) * u * 0.46);
          ctx.lineTo(px + Math.cos(a) * u * 0.66, py + Math.sin(a) * u * 0.66);
          ctx.stroke();
        }
      } else if (p.kind === 'pick-scars') {
        // 3 short parallel ticks cut INTO the wall band — pale against the ink.
        withRot(wallAngle(), () => {
          ctx.strokeStyle = 'rgba(225, 210, 175, 0.9)';
          ctx.lineWidth = Math.max(1.2, cell * 0.1);
          ctx.beginPath();
          for (const f of [-0.24, 0, 0.24]) {
            ctx.moveTo(u * f - u * 0.08, -u * 0.5);
            ctx.lineTo(u * f + u * 0.08, -u * 0.92);
          }
          ctx.stroke();
        });
      } else if (p.kind === 'crates') {
        // Smuggler stack: two squares abreast, one on top, plank diagonal.
        evidInk();
        ctx.lineWidth = Math.max(1, cell * 0.09);
        withRot(p.rot, () => {
          box(-u * 0.46, -u * 0.04, u * 0.44, u * 0.44);
          box(0.02 * u, 0, u * 0.4, u * 0.4);
          box(-u * 0.2, -u * 0.44, u * 0.4, u * 0.4);
          ctx.beginPath();
          ctx.moveTo(-u * 0.2, -u * 0.44);
          ctx.lineTo(u * 0.2, -u * 0.04);
          ctx.stroke();
        });
      } else if (p.kind === 'crystal') {
        ctx.fillStyle = '#4a7fa3';
        ctx.strokeStyle = sheet.ink;
        ctx.lineWidth = Math.max(1, cell * 0.08);
        ctx.beginPath();
        ctx.moveTo(px, py - cell * 0.38);
        ctx.lineTo(px + cell * 0.28, py);
        ctx.lineTo(px, py + cell * 0.38);
        ctx.lineTo(px - cell * 0.28, py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'stairs' || p.kind === 'portal') {
        // prominent entrance stairs: ink ring + shortening treads
        ctx.strokeStyle = sheet.ink;
        ctx.lineWidth = Math.max(1, cell * 0.1);
        ctx.beginPath();
        ctx.arc(px, py, cell * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        for (let t = 0; t < 4; t++) {
          const half = cell * (0.6 - t * 0.13);
          const ty = py - cell * 0.42 + t * cell * 0.28;
          ctx.beginPath();
          ctx.moveTo(px - half, ty);
          ctx.lineTo(px + half, ty);
          ctx.stroke();
        }
      } else if (p.kind === 'torch') {
        // Filled sconce triangle seated ON the wall line, apex into the room,
        // with a faint warm pool so lit stretches still read at a glance.
        const [wx, wy] = wallDir();
        const g = ctx.createRadialGradient(px, py, 0, px, py, cell * 1.2);
        g.addColorStop(0, 'rgba(235, 165, 60, 0.08)');
        g.addColorStop(1, 'rgba(235, 165, 60, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - cell * 1.2, py - cell * 1.2, cell * 2.4, cell * 2.4);
        const bx = px + wx * cell * 0.5;
        const by = py + wy * cell * 0.5;
        const tx = -wy; // tangent along the wall face
        const tyv = wx;
        const half = Math.max(2.2, cell * 0.24);
        const apex = Math.max(3, cell * 0.34);
        ctx.fillStyle = sheet.torch;
        ctx.strokeStyle = sheet.ink;
        ctx.lineWidth = Math.max(0.8, cell * 0.05);
        ctx.beginPath();
        ctx.moveTo(bx - tx * half, by - tyv * half);
        ctx.lineTo(bx + tx * half, by + tyv * half);
        ctx.lineTo(bx - wx * apex, by - wy * apex);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'bones') {
        ctx.strokeStyle = 'rgba(70, 55, 35, 0.55)';
        ctx.lineWidth = Math.max(1, cell * 0.1);
        ctx.beginPath();
        ctx.moveTo(px - cell * 0.22, py - cell * 0.16);
        ctx.lineTo(px + cell * 0.22, py + cell * 0.16);
        ctx.moveTo(px - cell * 0.2, py + cell * 0.18);
        ctx.lineTo(px + cell * 0.2, py - cell * 0.14);
        ctx.stroke();
      } else if (p.kind === 'rubble') {
        ctx.fillStyle = 'rgba(55, 45, 28, 0.42)';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(px + (k - 1) * cell * 0.18, py + ((k * 7) % 3 - 1) * cell * 0.14, cell * (0.07 + (k % 2) * 0.04), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.kind === 'stalagmite') {
        ctx.fillStyle = 'rgba(50, 42, 26, 0.5)';
        ctx.beginPath();
        ctx.moveTo(px - cell * 0.2, py + cell * 0.24);
        ctx.lineTo(px, py - cell * 0.28);
        ctx.lineTo(px + cell * 0.2, py + cell * 0.24);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'mushroom') {
        ctx.strokeStyle = 'rgba(60, 50, 30, 0.55)';
        ctx.lineWidth = Math.max(1, cell * 0.08);
        ctx.beginPath();
        ctx.moveTo(px, py + cell * 0.2);
        ctx.lineTo(px, py - cell * 0.05);
        ctx.stroke();
        ctx.fillStyle = 'rgba(140, 100, 60, 0.55)';
        ctx.beginPath();
        ctx.arc(px, py - cell * 0.1, cell * 0.16, Math.PI, 0, false);
        ctx.fill();
      } else if (p.kind === 'pool') {
        // stagnant puddle
        ctx.fillStyle = 'rgba(70, 85, 55, 0.35)';
        ctx.strokeStyle = 'rgba(50, 62, 38, 0.5)';
        ctx.lineWidth = Math.max(1, cell * 0.07);
        ctx.beginPath();
        ctx.ellipse(px, py, cell * 0.34, cell * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'iceshard') {
        ctx.strokeStyle = 'rgba(70, 130, 170, 0.6)';
        ctx.lineWidth = Math.max(1, cell * 0.1);
        ctx.beginPath();
        ctx.moveTo(px - cell * 0.16, py + cell * 0.2);
        ctx.lineTo(px + cell * 0.02, py - cell * 0.26);
        ctx.moveTo(px + 0.04 * cell, py + cell * 0.24);
        ctx.lineTo(px + cell * 0.2, py - cell * 0.14);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(40, 32, 20, 0.4)';
        ctx.beginPath();
        ctx.arc(px + (hash2(cxp, cyp, 1) - 0.5) * cell * 0.4, py + (hash2(cxp, cyp, 2) - 0.5) * cell * 0.4, Math.max(1, cell * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // traps: open ink triangle (legend explains it)
  for (const t of plan.traps) {
    const px = (t.x / ft + 0.5) * cell;
    const py = (t.y / ft + 0.5) * cell;
    ctx.strokeStyle = sheet.ink;
    ctx.lineWidth = Math.max(1, cell * 0.1);
    ctx.beginPath();
    ctx.moveTo(px, py - cell * 0.3);
    ctx.lineTo(px + cell * 0.28, py + cell * 0.22);
    ctx.lineTo(px - cell * 0.28, py + cell * 0.22);
    ctx.closePath();
    ctx.stroke();
  }

  // spawns (debug overlay, quiet ink ticks)
  if (ov.spawns) {
    for (const s of plan.spawns) {
      ctx.fillStyle = 'rgba(105, 35, 28, 0.75)';
      ctx.beginPath();
      ctx.arc((s.x / ft + 0.5) * cell, (s.y / ft + 0.5) * cell, Math.max(1.5, cell * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── WS7 orientation furniture ON the map: entrance staging + boss climax ────
  // These are drawn in MAP space (they rotate with the plan, as room annotations
  // must), UNDER the keyed number plates so a plate always sits on top. The
  // page-space furniture (compass rose, scale bar, numbered key panel) is drawn
  // by the sheet compositor `draw()` in the reserved right margin.

  /** Every floor cell of a room, its centroid, and its overall grid centroid —
   * shared by the staging + climax passes. */
  const roomCells = (rid: number): { cells: number[]; cx: number; cy: number } => {
    const cells: number[] = [];
    let cx = 0;
    let cy = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (roomAt(x, y) === rid) { cells.push(y * W + x); cx += x + 0.5; cy += y + 0.5; }
      }
    }
    if (cells.length > 0) { cx /= cells.length; cy /= cells.length; }
    return { cells, cx, cy };
  };
  // grid-wide floor centroid — the "outward" reference for the entrance approach.
  let gCx = 0;
  let gCy = 0;
  let gN = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isFloor(x, y)) { gCx += x + 0.5; gCy += y + 0.5; gN++; }
    }
  }
  if (gN > 0) { gCx /= gN; gCy /= gN; }

  const entranceRoom = plan.rooms.find((r) => r.id === plan.entranceId)
    ?? plan.rooms.find((r) => r.type === 'entrance');
  const bossRoom = plan.rooms.find((r) => r.id === plan.bossId)
    ?? plan.rooms.find((r) => r.type === 'boss');

  // The entrance porch's outward direction, set by the staging pass below and
  // read by the keyed-plate pass so the entrance DISC is nudged toward the room
  // interior (away from the stair-down glyph seated at the porch), never on it.
  let entrancePorchDir: [number, number] | null = null;

  // ── BOSS CLIMAX ─ the objective room is the sheet's visual destination. A soft
  // accent halo radiates behind the room (drawn UNDER nothing structural since we
  // knock it into the floor value), then an ornamented double border hugs the
  // inner wall with corner pips — the room carries more weight than any other, so
  // "this is the end" reads at a glance. The WS5 dais + the ★ plate finish it.
  if (bossRoom) {
    const { cells, cx, cy } = roomCells(bossRoom.id);
    if (cells.length > 0) {
      const pcx = cx * cell;
      const pcy = cy * cell;
      // radiating emphasis: a faint accent bloom seated in the floor (multiply-ish
      // low alpha so it warms the room without repainting furniture).
      let rMax = 0;
      for (const i of cells) {
        const dx = (i % W) + 0.5 - cx;
        const dy = ((i / W) | 0) + 0.5 - cy;
        rMax = Math.max(rMax, Math.hypot(dx, dy));
      }
      const glowR = (rMax + 1.4) * cell;
      ctx.save();
      // clip the glow to the room's floor so it never bleeds onto the wall/paper.
      ctx.beginPath();
      for (const i of cells) ctx.rect((i % W) * cell, ((i / W) | 0) * cell, cell, cell);
      ctx.clip();
      const g = ctx.createRadialGradient(pcx, pcy, glowR * 0.12, pcx, pcy, glowR);
      const acc = sheet.accent;
      const ar = parseInt(acc.slice(1, 3), 16);
      const ag = parseInt(acc.slice(3, 5), 16);
      const ab = parseInt(acc.slice(5, 7), 16);
      g.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.22)`);
      g.addColorStop(0.55, `rgba(${ar}, ${ag}, ${ab}, 0.1)`);
      g.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(pcx - glowR, pcy - glowR, glowR * 2, glowR * 2);
      ctx.restore();

      // ornamented inner border: trace the room's floor→wall boundary as a bold
      // accent-ink double rule, inset a touch off the wall, with corner pips.
      const boundaryFaces: [number, number, number, number][] = []; // ax,ay,bx,by (cell units)
      for (const i of cells) {
        const x = i % W;
        const y = (i / W) | 0;
        const inRoom = (nx: number, ny: number): boolean => roomAt(nx, ny) === bossRoom.id;
        const inset = 0.16;
        if (!inRoom(x, y - 1)) boundaryFaces.push([x + 0.04, y + inset, x + 0.96, y + inset]);
        if (!inRoom(x, y + 1)) boundaryFaces.push([x + 0.04, y + 1 - inset, x + 0.96, y + 1 - inset]);
        if (!inRoom(x - 1, y)) boundaryFaces.push([x + inset, y + 0.04, x + inset, y + 0.96]);
        if (!inRoom(x + 1, y)) boundaryFaces.push([x + 1 - inset, y + 0.04, x + 1 - inset, y + 0.96]);
      }
      const accInk = sheet.accent;
      ctx.strokeStyle = accInk;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(1.6, cell * 0.14);
      ctx.beginPath();
      for (const [ax, ay, bx, by] of boundaryFaces) { ctx.moveTo(ax * cell, ay * cell); ctx.lineTo(bx * cell, by * cell); }
      ctx.stroke();
      // a thinner outer companion rule for a "framed" double line
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = Math.max(0.9, cell * 0.06);
      ctx.beginPath();
      for (const [ax, ay, bx, by] of boundaryFaces) {
        const ex = ax === bx ? (ax < 0.5 + (ax | 0) ? -0.12 : 0.12) : 0;
        const ey = ay === by ? (ay < 0.5 + (ay | 0) ? -0.12 : 0.12) : 0;
        ctx.moveTo((ax + ex) * cell, (ay + ey) * cell);
        ctx.lineTo((bx + ex) * cell, (by + ey) * cell);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ── ENTRANCE STAGING ─ a reader must find where the party walks in. Find the
  // outward wall of the entrance room (the perimeter wall cell whose outward
  // side is exterior VOID, furthest in the away-from-centre direction), break a
  // porch threshold across it, draw an approach arrow from OUTSIDE pointing in,
  // and seat a stair-down glyph on the floor just inside. Unmistakable arrival.
  if (entranceRoom) {
    const { cells, cx, cy } = roomCells(entranceRoom.id);
    if (cells.length > 0) {
      // outward direction = from grid centroid toward the entrance room.
      let ox = cx - gCx;
      let oy = cy - gCy;
      const ol = Math.hypot(ox, oy) || 1;
      ox /= ol; oy /= ol;
      // Candidate porch cells: a room floor cell with a VOID neighbour (an outer
      // wall we can break through). Score by alignment with the outward dir so
      // the porch faces away from the complex (a real approach).
      interface Porch { fx: number; fy: number; dx: number; dy: number; score: number }
      let best: Porch | null = null;
      for (const i of cells) {
        const x = i % W;
        const y = (i / W) | 0;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
          // wall cell just outside the room, then void beyond it → an outer edge.
          if (!isWall(x + dx, y + dy)) continue;
          if (at(x + dx * 2, y + dy * 2) !== CellKind.Void) continue;
          const score = dx * ox + dy * oy; // 1 = perfectly outward
          if (!best || score > best.score) best = { fx: x, fy: y, dx, dy, score };
        }
      }
      // Fallback: any room edge onto void, else the outward-most floor cell.
      if (!best) {
        for (const i of cells) {
          const x = i % W;
          const y = (i / W) | 0;
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
            if (at(x + dx, y + dy) !== CellKind.Void && !isWall(x + dx, y + dy)) continue;
            const score = dx * ox + dy * oy;
            if (!best || score > best.score) best = { fx: x, fy: y, dx, dy, score };
          }
        }
      }
      if (best) {
        const { fx, fy, dx, dy } = best;
        const tx = -dy; // unit tangent along the wall face
        const tyv = dx;
        // Staging UNIT floored in pixels so the whole apparatus stays legible on
        // a large (small-cell) map where a cell can be ~5px — the entrance may be
        // unkeyed (no disc), so this staging is the ONLY way-in mark and must read.
        const su = Math.max(cell, 9);

        // (1) PORCH threshold — punch a paper-coloured gap across the outer wall
        // cell (the doorway opening) with two ink jamb ticks, so the wall reads
        // as "opened here", not solid.
        const wallCx = (fx + dx + 0.5) * cell;
        const wallCy = (fy + dy + 0.5) * cell;
        const halfGap = cell * 0.42;
        ctx.save();
        ctx.fillStyle = sheet.floor;
        ctx.fillRect(wallCx - cell * 0.5, wallCy - cell * 0.5, cell, cell);
        ctx.strokeStyle = sheet.ink;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.6, cell * 0.16);
        for (const s of [-1, 1]) {
          const jx0 = wallCx + tx * s * halfGap - dx * cell * 0.5;
          const jy0 = wallCy + tyv * s * halfGap - dy * cell * 0.5;
          const jx1 = wallCx + tx * s * halfGap + dx * cell * 0.5;
          const jy1 = wallCy + tyv * s * halfGap + dy * cell * 0.5;
          ctx.beginPath();
          ctx.moveTo(jx0, jy0);
          ctx.lineTo(jx1, jy1);
          ctx.stroke();
        }
        ctx.restore();

        // Record the porch direction so the keyed pass pushes the entrance disc
        // toward the room interior — the stair-down hero owns the threshold.
        entrancePorchDir = [dx, dy];

        // (2) APPROACH ARROW — a bold ink arrow OUTSIDE the porch pointing IN,
        // with a soft knockout halo so it survives over the rock hatching +
        // exterior tufts. Dimensions floored in px → unmistakable at sheet scale.
        const tailX = wallCx + dx * (cell * 0.5 + su * 2.4);
        const tailY = wallCy + dy * (cell * 0.5 + su * 2.4);
        const headX = wallCx + dx * (cell * 0.5 + su * 0.35);
        const headY = wallCy + dy * (cell * 0.5 + su * 0.35);
        ctx.strokeStyle = `${sheet.roomShadeLight}, 0.95)`;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(7, su * 0.72);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        ctx.strokeStyle = sheet.ink;
        ctx.lineWidth = Math.max(2.4, su * 0.26);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        const ahl = Math.max(6, su * 0.62);
        ctx.fillStyle = sheet.ink;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX - dx * ahl + tx * ahl * 0.66, headY - dy * ahl + tyv * ahl * 0.66);
        ctx.lineTo(headX - dx * ahl - tx * ahl * 0.66, headY - dy * ahl - tyv * ahl * 0.66);
        ctx.closePath();
        ctx.fill();

        // (3) STAIR-DOWN glyph seated ON the threshold, a run of narrowing treads
        // descending inward between two rails — reads as "stairs down / enter".
        // Centred on the opening so it leaves the room INTERIOR (disc) clear.
        const sInX = wallCx - dx * su * 0.4; // just inside the opening
        const sInY = wallCy - dy * su * 0.4;
        const nTread = 4;
        const treadStep = su * 0.34;
        const railHalf = su * 0.5;
        const run = treadStep * nTread;
        // knockout pad (oriented along the descent) so treads read over the wall.
        ctx.fillStyle = `${sheet.roomShadeLight}, 0.88)`;
        ctx.beginPath();
        ctx.ellipse(
          sInX - dx * run * 0.5,
          sInY - dy * run * 0.5,
          Math.abs(dx) > 0 ? run * 0.62 : railHalf * 1.5,
          Math.abs(dy) > 0 ? run * 0.62 : railHalf * 1.5,
          0, 0, Math.PI * 2,
        );
        ctx.fill();
        ctx.strokeStyle = sheet.ink;
        ctx.lineCap = 'butt';
        ctx.lineWidth = Math.max(1.4, su * 0.12);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sInX + tx * s * railHalf, sInY + tyv * s * railHalf);
          ctx.lineTo(sInX - dx * run + tx * s * railHalf * 0.5, sInY - dy * run + tyv * s * railHalf * 0.5);
          ctx.stroke();
        }
        for (let t = 0; t <= nTread; t++) {
          const f = t / nTread;
          const hw = railHalf * (1 - f * 0.5);
          const bx = sInX - dx * treadStep * t;
          const by = sInY - dy * treadStep * t;
          ctx.beginPath();
          ctx.moveTo(bx + tx * hw, by + tyv * hw);
          ctx.lineTo(bx - tx * hw, by - tyv * hw);
          ctx.stroke();
        }
      }
    }
  }

  // ── Keyed number plates (WS7) ─ a proper cartographic key marker, not a bare
  // digit. Each keyed room gets a filled ink DISC with a knockout numeral at a
  // consistent anchor (the room's top-left-most interior floor corner) plus a
  // paper halo so it never collides with furniture, walls, or overlays. Boss/
  // entrance keys are elevated: larger disc, accent ring, so the destination and
  // the way-in read as a tier above ordinary keys. The numbers match the boxed
  // key panel the sheet compositor draws in the margin.
  const keyed = keyedRooms(plan);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  keyed.forEach((r, i) => {
    const isBoss = r.type === 'boss';
    const isEntrance = r.type === 'entrance';
    const isMajor = isBoss || isEntrance;
    // Anchor: the room's top-left-most FLOOR cell (masked rooms have void
    // corners in their bounding box — never seat a label on the wall band).
    let ax = rx0(r) + 1;
    let ay = ry0(r) + 1;
    scan: for (let y = ry0(r); y < ry0(r) + r.h / ft; y++) {
      for (let x = rx0(r); x < rx0(r) + r.w / ft; x++) {
        if (isFloor(x, y) && isFloor(x + 1, y) && isFloor(x, y + 1)) { ax = x; ay = y; break scan; }
      }
    }
    // The ENTRANCE disc is pushed to the floor corner FURTHEST from the porch
    // (opposite the outward direction) so it clears the stair-down hero seated on
    // the threshold. Scored so it still lands on a real interior floor cell.
    if (isEntrance && entrancePorchDir) {
      const [pdx, pdy] = entrancePorchDir;
      let bestScore = -Infinity;
      for (let y = ry0(r); y < ry0(r) + r.h / ft; y++) {
        for (let x = rx0(r); x < rx0(r) + r.w / ft; x++) {
          if (!isFloor(x, y)) continue;
          const s = -(x * pdx + y * pdy);
          if (s > bestScore) { bestScore = s; ax = x; ay = y; }
        }
      }
    }
    // disc radius (floored in px so it survives at ~5px cells); majors bigger.
    const rad = Math.max(isMajor ? 11 : 8.5, cell * (isMajor ? 0.72 : 0.56));
    // seat the disc a touch inside the anchor corner so it clears the wall.
    const dcx = (ax + 0.5) * cell + rad * 0.15;
    const dcy = (ay + 0.5) * cell + rad * 0.15;
    // (1) soft paper halo so the disc never fuses with adjacent ink.
    ctx.fillStyle = `${sheet.roomShadeLight}, 0.92)`;
    ctx.beginPath();
    ctx.arc(dcx, dcy, rad * 1.32, 0, Math.PI * 2);
    ctx.fill();
    // (2) filled ink disc (the key marker body).
    ctx.fillStyle = sheet.ink;
    ctx.beginPath();
    ctx.arc(dcx, dcy, rad, 0, Math.PI * 2);
    ctx.fill();
    // (3) accent ring on the majors (boss = accent, entrance = a lit ring).
    if (isMajor) {
      ctx.strokeStyle = isBoss ? sheet.accent : `${sheet.roomShadeLight}, 0.95)`;
      ctx.lineWidth = Math.max(1.4, rad * 0.22);
      ctx.beginPath();
      ctx.arc(dcx, dcy, rad * 1.24, 0, Math.PI * 2);
      ctx.stroke();
      // a thin bright inner rule so the ring reads engraved
      ctx.strokeStyle = `${sheet.roomShadeLight}, 0.55)`;
      ctx.lineWidth = Math.max(0.8, rad * 0.09);
      ctx.beginPath();
      ctx.arc(dcx, dcy, rad * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }
    // (4) knockout numeral (paper-coloured on the ink disc). A leading ★ / ▾
    // glyph for boss/entrance is carried by the KEY PANEL, not crammed in the
    // disc — the disc stays a clean readable numeral at any size.
    const num = String(i + 1);
    const fsize = Math.max(9, rad * (num.length > 1 ? 1.02 : 1.28));
    ctx.font = `700 ${fsize}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = sheet.floor;
    ctx.fillText(num, dcx, dcy + fsize * 0.04);
  });

  // graph overlays
  const gx = (id: number): number => ((plan.rooms[id].x + plan.rooms[id].w / 2) / ft) * cell;
  const gy = (id: number): number => ((plan.rooms[id].y + plan.rooms[id].h / 2) / ft) * cell;
  const line = (a: number, b: number, stroke: string, width: number, dash: number[] = []): void => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(gx(a), gy(a));
    ctx.lineTo(gx(b), gy(b));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (ov.graph) for (const e of plan.edges) if (!e.isLoop) line(e.a, e.b, 'rgba(30,60,150,0.55)', 1.5);
  if (ov.loops) for (const e of plan.edges) if (e.isLoop) line(e.a, e.b, e.isSecret ? '#7b2fa3' : '#0e93a3', 2, [5, 3]);
  if (ov.critical) {
    for (let i = 0; i + 1 < plan.criticalRoomIds.length; i++) {
      line(plan.criticalRoomIds[i], plan.criticalRoomIds[i + 1], '#c22222', 2.5);
    }
  }
  if (ov.rooms) {
    for (const r of plan.rooms) {
      ctx.fillStyle = TYPE_COLOR[r.type];
      ctx.beginPath();
      ctx.arc(gx(r.id), gy(r.id) - cell * 0.7, Math.max(2.5, cell * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The numbered rooms: exactly those an event touched (they carry a note),
 * in map-key order (shallow → deep). Shared by the drawer and the notes list. */
function keyedRooms(plan: DungeonPlan): DungeonRoom[] {
  return plan.rooms
    .filter((r) => r.note !== undefined)
    .sort((a, b) => a.depth - b.depth || a.id - b.id);
}

/** The finished sheet's canonical CSS footprint (ISO A portrait, 1:√2). The
 * sheet is always COMPOSED at this size; the interactive viewport ({@link
 * blitViewport}) samples a supersampled buffer of it, so zoom/pan never changes
 * how the sheet is drawn — only which part of it fills the visible canvas. */
const SHEET_CSS_W = 800;
const SHEET_CSS_H = Math.round(SHEET_CSS_W * Math.SQRT2);

/** Supersample factor for the offscreen sheet buffer. The whole sheet is drawn
 * ONCE at (device × this) resolution, then a zoom/pan window of it is blitted to
 * the screen. This is the entire crispness story: detail stays sharp when the
 * viewport magnifies, up to this factor, because we downsample real pixels
 * rather than upscaling screen pixels. ~2.75 keeps a burial gallery's coffins
 * and linework crisp to ~4× while bounding the buffer to a sane size (an 800×
 * 1131 sheet at dpr 2 becomes ~4400×6200 — a few hundred MB is avoided by the
 * ≤3 dpr clamp the caller already applies). */
const SHEET_SUPERSAMPLE = 2.75;

/**
 * Composites the sheet: one CANONICAL ISO-portrait page (1:√2) for every
 * dungeon — the frame is the constant, the art is the variable. The rotated
 * art bounding box is fit-and-centered between a boxed title cartouche and a
 * legend footer, with a guaranteed safe gap (≥6% of the short side) from both
 * the frame and the cartouche so the art never kisses either.
 *
 * Renders into (and RETURNS) a fresh offscreen buffer sized in DEVICE pixels ×
 * {@link SHEET_SUPERSAMPLE}, so it is sharp on HiDPI and holds enough real
 * pixels for the viewport to magnify without blur. Every drawing call below is
 * unchanged: the buffer's base transform bakes in the density, so all the WS1–8
 * work keeps composing in the same 800×1131 CSS coordinate space it always did.
 */
function renderSheet(plan: DungeonPlan, ov: Overlays): HTMLCanvasElement {
  const sheet = SHEETS[plan.params.theme] ?? SHEETS.crypt;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  // Density the sheet is rasterized at = screen density × supersample headroom.
  const ss = dpr * SHEET_SUPERSAMPLE;

  const cssW = SHEET_CSS_W;
  const cssH = SHEET_CSS_H; // ISO A portrait
  const safe = Math.round(cssW * 0.06); // guaranteed art gap, both frame + cartouche

  // Seed cant: kept (hand-surveyed look) but clamped to ±4–9° so the rotated
  // bounding box wastes little corner space and never clips.
  const mag = 4 + (((plan.seed >>> 3) % 50) / 10);
  const angle = ((plan.seed & 1) === 0 ? 1 : -1) * (mag * Math.PI / 180);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  // Page furniture bands (deliberate, not floating chrome).
  const cartTop = 28;
  const cartH = 82;
  const legendBandH = 46;
  const artY0 = cartTop + cartH + safe;
  const artY1 = cssH - legendBandH - safe;
  // WS7: reserve a right MARGIN RAIL for the surveyor's furniture — the numbered
  // key panel, the compass rose, and the scale bar. The map fits to the left of
  // it, so the orientation furniture never collides with the art no matter the
  // plan's shape (the classic module-map map-left / key-right layout).
  const railW = 156;
  const railGap = Math.round(safe * 0.6);
  const railX = cssW - safe - railW;

  // WS8 composition rebalance: the rail furniture (compass + scale + key panel)
  // only fills the TOP of the right column; on a short key list it left a big
  // empty lower-right margin while the art stayed cramped map-left. So fit the
  // art into an L-shaped area — the better of two boxes — instead of always the
  // left-of-rail column:
  //   A) LEFT-OF-RAIL, full art height (the classic map-left / key-right).
  //   B) FULL PAGE WIDTH, but only BELOW where the rail furniture ends.
  // Whichever admits the larger cell wins, so a compact plan spreads wide into
  // the reclaimed width and drops to fill the lower margin, while a tall plan
  // keeps the side-by-side layout. `railBottom` estimates the furniture extent.
  const keyedCount = keyedRooms(plan).length;
  const compassBlockH = 6 + 34 * 2 + 4 + 16;                 // rose + gap
  const scaleBlockH = 12 + 6 + 20;                            // heading + bar + labels
  const keyPanelH = keyedCount > 0 ? 16 + 7 + keyedCount * 15 + 7 : 0;
  const railBottom = Math.min(artY1, artY0 + 6 + compassBlockH + scaleBlockH + keyPanelH);

  const denomW = plan.W * cos + plan.H * sin;
  const denomH = plan.W * sin + plan.H * cos;
  const cellFor = (aw: number, ah: number): number =>
    Math.min(13, Math.max(3, Math.floor(Math.min(aw / denomW, ah / denomH))));
  // Box A — left of the rail, full height.
  const aW = railX - railGap - safe;
  const aH = artY1 - artY0;
  const cellA = cellFor(aW, aH);
  // Box B — full width, below the rail furniture (only worth it if there is real
  // room under the furniture).
  const bY0 = railBottom + railGap;
  const bW = cssW - safe * 2;
  const bH = artY1 - bY0;
  const cellB = bH > 120 ? cellFor(bW, bH) : 0;

  const useB = cellB > cellA;
  const availW = useB ? bW : aW;
  const availH = useB ? bH : aH;
  const artX0 = safe; // both boxes start at the left safe margin
  const artTop = useB ? bY0 : artY0;

  // Fit: pick the cell size whose ROTATED bounding box fills the chosen art
  // area, then center; a fractional blit scale is the floor-guard so huge
  // plans can never overflow the page.
  const cell = useB ? cellB : cellA;
  const mapW = plan.W * cell;
  const mapH = plan.H * cell;
  const rotW = mapW * cos + mapH * sin;
  const rotH = mapW * sin + mapH * cos;
  const fit = Math.min(1, availW / rotW, availH / rotH);

  // The buffer we compose into (device pixels × supersample). Nothing about the
  // drawing below knows it is supersampled — the base transform hides it.
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cssW * ss);
  canvas.height = Math.round(cssH * ss);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.setTransform(ss, 0, 0, ss, 0, 0);

  // ── Aged-vellum substrate (WS8) ─ the one texture that sells "a real map on
  // real stock". Layered, procedural (coord-hash — no Math.random), theme-WARM
  // (frost keeps warm paper, the cold lives in its ink), and a WHISPER under the
  // linework so the value ladder (walls ≫ floors ≫ this) survives. Build order:
  // warm base → low-frequency tonal mottle → fibre/tooth → a few foxing blotches
  // → a darkened deckle vignette creeping in from the border → corner stains.
  ctx.fillStyle = sheet.paper;
  ctx.fillRect(0, 0, cssW, cssH);
  // (1) low-frequency tonal variation — broad soft patches of warmer/cooler stock.
  for (let k = 0; k < 150; k++) {
    const bx = hash2(k, 11, plan.seed % 1000) * cssW;
    const by = hash2(k, 23, plan.seed % 1000) * cssH;
    const br = 14 + hash2(k, 31, 5) * 60;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const a = 0.012 + hash2(k, 41, 7) * 0.02;
    g.addColorStop(0, sheet.paperMottle.replace('1)', `${a})`));
    g.addColorStop(1, sheet.paperMottle.replace('1)', '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  // (2) FIBRE / TOOTH — a dense scatter of hair-fine short strokes, half a touch
  // darker (fibre shadow) and half a touch lighter (raised tooth catching light),
  // so the stock reads laid, not printed. Alpha floored very low = felt, not seen.
  {
    const fibreDark = sheet.paperMottle.replace('1)', '0.05)');
    const fibreLite = `${sheet.roomShadeLight}, 0.06)`;
    ctx.lineCap = 'round';
    for (let k = 0; k < 1400; k++) {
      const fx = hash2(k, 3, plan.seed % 997) * cssW;
      const fy = hash2(k, 5, plan.seed % 997) * cssH;
      const ang = hash2(k, 7, 13) * Math.PI; // laid roughly along the sheet
      const len = 3 + hash2(k, 9, 17) * 7;
      ctx.strokeStyle = hash2(k, 2, 19) < 0.5 ? fibreDark : fibreLite;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(ang) * len * 0.5, fy - Math.sin(ang) * len * 0.5);
      ctx.lineTo(fx + Math.cos(ang) * len * 0.5, fy + Math.sin(ang) * len * 0.5);
      ctx.stroke();
    }
  }
  // (3) FOXING — a few soft irregular age-blotches (the brown speckle old paper
  // grows), each a lobed low-alpha stain, placed off the art's busy centre band.
  for (let k = 0; k < 7; k++) {
    const sx = (0.08 + hash2(k, 51, plan.seed % 900) * 0.84) * cssW;
    const sy = (0.08 + hash2(k, 57, plan.seed % 900) * 0.84) * cssH;
    const sr = 10 + hash2(k, 61, 3) * 26;
    const lobes = 7;
    ctx.fillStyle = `${sheet.cornerStain}, ${(0.03 + hash2(k, 63, 5) * 0.04).toFixed(3)})`;
    ctx.beginPath();
    for (let s = 0; s <= lobes; s++) {
      const a = (s / lobes) * Math.PI * 2;
      const rr = sr * (0.6 + hash2(k, 65 + s, 7) * 0.6);
      const xx = sx + Math.cos(a) * rr;
      const yy = sy + Math.sin(a) * rr * 0.8;
      if (s === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.closePath();
    ctx.fill();
  }
  // (4) DECKLE VIGNETTE — age darkening creeping IN from the border, inside the
  // frame: four edge gradients that fade to nothing ~9% in, so the sheet looks
  // worn at its deckle without a round photo-vignette (which the header forbids).
  {
    const inset = 15; // just inside the double-rule frame
    const band = Math.round(cssW * 0.11);
    const deckle = (x0: number, y0: number, x1: number, y1: number): void => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `${sheet.cornerStain}, 0.14)`);
      g.addColorStop(0.5, `${sheet.cornerStain}, 0.03)`);
      g.addColorStop(1, `${sheet.cornerStain}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    };
    deckle(inset, 0, inset + band, 0);                 // left
    deckle(cssW - inset, 0, cssW - inset - band, 0);   // right
    deckle(0, inset, 0, inset + band);                 // top
    deckle(0, cssH - inset, 0, cssH - inset - band);   // bottom
  }
  // (5) corner stains — the darkest age pooling at the four dog-eared corners.
  const stain = (gx0: number, gy0: number, gx1: number, gy1: number): void => {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, `${sheet.cornerStain}, 0.12)`);
    g.addColorStop(1, `${sheet.cornerStain}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  };
  stain(0, 0, 52, 52);
  stain(cssW, 0, cssW - 52, 52);
  stain(0, cssH, 52, cssH - 52);
  stain(cssW, cssH, cssW - 52, cssH - 52);

  // Title cartouche: a FRAMED panel — derived name + blurb inside deliberate
  // rule-work, sized to its content and centered on the page. The header spans
  // the FULL page width (it sits above the art + rail band, so the rail does not
  // constrain it).
  const headW = cssW - safe * 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let titleSize = 26;
  ctx.font = `700 ${titleSize}px Georgia, 'Times New Roman', serif`;
  while (titleSize > 15 && ctx.measureText(plan.name).width > headW - 96) {
    titleSize -= 1;
    ctx.font = `700 ${titleSize}px Georgia, 'Times New Roman', serif`;
  }
  const titleW = ctx.measureText(plan.name).width;
  let blurbSize = Math.max(10, Math.round(titleSize * 0.46));
  ctx.font = `italic 400 ${blurbSize}px Georgia, serif`;
  while (blurbSize > 9 && ctx.measureText(plan.blurb).width > headW - 60) {
    blurbSize -= 1;
    ctx.font = `italic 400 ${blurbSize}px Georgia, serif`;
  }
  const blurbW = ctx.measureText(plan.blurb).width;
  const cartW = Math.min(headW, Math.max(titleW, blurbW) + 64);
  const cartX = (cssW - cartW) / 2;
  ctx.strokeStyle = sheet.ink;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(cartX + 0.5, cartTop + 0.5, cartW, cartH);
  ctx.lineWidth = 0.7;
  ctx.strokeRect(cartX + 4.5, cartTop + 4.5, cartW - 8, cartH - 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = sheet.ink;
  ctx.font = `700 ${titleSize}px Georgia, 'Times New Roman', serif`;
  ctx.fillText(plan.name, cssW / 2, cartTop + cartH * 0.38);
  ctx.strokeStyle = sheet.ink;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(cssW / 2 - titleW * 0.32, cartTop + cartH * 0.585);
  ctx.lineTo(cssW / 2 + titleW * 0.32, cartTop + cartH * 0.585);
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.font = `italic 400 ${blurbSize}px Georgia, serif`;
  ctx.fillText(plan.blurb, cssW / 2, cartTop + cartH * 0.76);
  ctx.globalAlpha = 1;

  // Rotated map blit — fit-and-centered in the chosen art area (left-of-rail, or
  // full-width-below-furniture when that reclaims the empty lower margin).
  const artCx = artX0 + availW / 2;
  const artCy = artTop + availH / 2;
  const off = document.createElement('canvas');
  drawMap(off, plan, ov, cell, ss);
  ctx.save();
  ctx.translate(artCx, artCy);
  ctx.rotate(angle);
  ctx.drawImage(off, 0, 0, off.width, off.height, -(mapW * fit) / 2, -(mapH * fit) / 2, mapW * fit, mapH * fit);
  ctx.restore();

  // ── WS7 surveyor's furniture in the right margin rail ──────────────────────
  // A coherent type system across the whole rail (small-caps serif labels, a
  // tabular numeral column) shared with the cartouche + legend, so the compass,
  // scale bar, and numbered key read as one cartographer's hand. Top→bottom:
  // compass rose, scale bar, then the numbered key panel filling what remains.
  const railCx = railX + railW / 2;
  let railCursor = artY0 + 6;
  const inkA = (a: number): void => { ctx.strokeStyle = sheet.ink; ctx.globalAlpha = a; };

  // (A) COMPASS ROSE — north is HONEST: the map is blitted at `angle`, so map-
  // north (up in map space) points on the page at screen-angle `angle` from
  // vertical. The needle is rotated to match, so it tracks the plan's cant.
  {
    const cr = 34;
    const ccx = railCx;
    const ccy = railCursor + cr + 4;
    // face
    ctx.fillStyle = `${sheet.roomShadeLight}, 0.5)`;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.fill();
    inkA(0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // tick marks every 45°, canted with the map
    ctx.save();
    ctx.translate(ccx, ccy);
    ctx.rotate(angle);
    inkA(0.5);
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const inner = k % 2 === 0 ? cr * 0.78 : cr * 0.86;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * inner, -Math.cos(a) * inner);
      ctx.lineTo(Math.sin(a) * cr * 0.96, -Math.cos(a) * cr * 0.96);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the four-point star needle: N half filled ink, S half hollow.
    const needle = (len: number, wide: number): void => {
      ctx.beginPath();
      ctx.moveTo(0, -len);
      ctx.lineTo(wide, 0);
      ctx.lineTo(0, len);
      ctx.lineTo(-wide, 0);
      ctx.closePath();
    };
    // E-W arm (hollow, thin)
    ctx.save();
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = `${sheet.roomShadeLight}, 0.85)`;
    needle(cr * 0.62, cr * 0.12);
    ctx.fill();
    inkA(0.6); ctx.lineWidth = 0.8; needle(cr * 0.62, cr * 0.12); ctx.stroke();
    ctx.restore();
    // N-S arm: N solid accent-tipped ink, S hollow.
    ctx.globalAlpha = 1;
    // south half (hollow)
    ctx.fillStyle = `${sheet.roomShadeLight}, 0.9)`;
    ctx.beginPath();
    ctx.moveTo(0, cr * 0.72);
    ctx.lineTo(cr * 0.15, 0);
    ctx.lineTo(-cr * 0.15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = sheet.ink; ctx.lineWidth = 1; ctx.stroke();
    // north half (solid ink, accent tip)
    ctx.fillStyle = sheet.ink;
    ctx.beginPath();
    ctx.moveTo(0, -cr * 0.82);
    ctx.lineTo(cr * 0.15, 0);
    ctx.lineTo(-cr * 0.15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = sheet.accent;
    ctx.beginPath();
    ctx.moveTo(0, -cr * 0.82);
    ctx.lineTo(cr * 0.09, -cr * 0.5);
    ctx.lineTo(-cr * 0.09, -cr * 0.5);
    ctx.closePath();
    ctx.fill();
    // N letter riding just outside the ring, canted with the rose
    ctx.fillStyle = sheet.ink;
    ctx.font = `700 12px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -cr - 8);
    ctx.restore();
    railCursor = ccy + cr + 16;
  }

  // (B) SCALE BAR — an honest graphic scale on the 5 ft cell basis at the map's
  // fitted cell size. A "nice" round division (10/20/25/50 ft) is chosen so each
  // span is wide enough to label without collision; only 0, the first division,
  // and the end carry a number (interior ticks stay unlabelled) so the ruler
  // reads clean. Alternating filled/empty spans, ticked, "… ft" on the end.
  {
    const pxPerFt = (cell * fit) / plan.cellFt; // page px per foot at the blit scale
    // pick the division whose pixel width is a comfortable ≥30px for a label.
    const nice = [10, 20, 25, 50, 100];
    let spanFt = nice[0];
    for (const n of nice) { spanFt = n; if (n * pxPerFt >= 30) break; }
    const spanPx = spanFt * pxPerFt;
    const maxSpans = Math.max(1, Math.min(4, Math.floor((railW - 20) / spanPx)));
    const barW = spanPx * maxSpans;
    const barH = 6;
    const bx = railCx - barW / 2;
    const by = railCursor + 12;
    // heading (shared italic voice with the cartouche blurb)
    ctx.fillStyle = sheet.ink;
    ctx.font = `italic 400 9px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 0.7;
    ctx.fillText('scale', railCx, by - 5);
    ctx.globalAlpha = 1;
    // bar body: alternating fill
    for (let s = 0; s < maxSpans; s++) {
      ctx.fillStyle = s % 2 === 0 ? sheet.ink : `${sheet.roomShadeLight}, 0.9)`;
      ctx.fillRect(bx + s * spanPx, by, spanPx, barH);
    }
    inkA(0.8);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW, barH);
    ctx.globalAlpha = 1;
    // ticks on every division; labels only where they will not collide.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `600 8.5px Georgia, serif`;
    for (let s = 0; s <= maxSpans; s++) {
      const lx = bx + s * spanPx;
      inkA(0.6);
      ctx.beginPath();
      ctx.moveTo(lx, by - 2);
      ctx.lineTo(lx, by + barH + 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // label 0, the first division, and the end (skip crowded interior ticks).
      const labelled = s === 0 || s === 1 || s === maxSpans;
      if (!labelled) continue;
      ctx.fillStyle = sheet.ink;
      ctx.globalAlpha = 0.85;
      const lbl = s === maxSpans ? `${s * spanFt} ft` : String(s * spanFt);
      ctx.fillText(lbl, lx, by + barH + 3);
      ctx.globalAlpha = 1;
    }
    railCursor = by + barH + 20;
  }

  // (C) NUMBERED KEY PANEL — the map's discs, indexed. A boxed legend seated in
  // the rar margin: each keyed room's number beside a terse label (the way-in
  // and the objective flagged with ▾/★), so the reader learns the disc language
  // here. Full DM notes stay in the DOM list below the sheet; this is the map's
  // own key. The disc numbers on the map match these rows exactly.
  {
    const keyed = keyedRooms(plan);
    if (keyed.length > 0) {
      const panelX = railX;
      const panelY = railCursor;
      const panelW = railW;
      const rowH = 15;
      const headH = 16;
      const pad = 7;
      const panelH = Math.min(artY1 - panelY, headH + pad + keyed.length * rowH + pad);
      const maxRows = Math.max(1, Math.floor((panelH - headH - pad * 2) / rowH));
      // panel ground + frame
      ctx.fillStyle = `${sheet.roomShadeLight}, 0.42)`;
      ctx.fillRect(panelX, panelY, panelW, panelH);
      inkA(0.7);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW, panelH);
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.4;
      ctx.strokeRect(panelX + 3.5, panelY + 3.5, panelW - 6, panelH - 6);
      ctx.globalAlpha = 1;
      // header
      ctx.fillStyle = sheet.ink;
      ctx.font = `700 9px Georgia, serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.85;
      // letter-spaced small-caps feel via manual spacing
      ctx.fillText('K E Y', panelX + pad, panelY + headH * 0.62);
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(panelX + pad, panelY + headH + 1.5);
      ctx.lineTo(panelX + panelW - pad, panelY + headH + 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // rows
      const label = (r: DungeonRoom): string => {
        if (r.type === 'boss') return 'objective';
        if (r.type === 'entrance') return 'entrance';
        return r.purpose.replace(/-/g, ' ');
      };
      const numColX = panelX + pad + 8;
      const txtColX = panelX + pad + 20;
      const shown = Math.min(keyed.length, maxRows);
      for (let i = 0; i < shown; i++) {
        const r = keyed[i];
        const ry = panelY + headH + pad + i * rowH + rowH * 0.5;
        const isBoss = r.type === 'boss';
        const isEnt = r.type === 'entrance';
        // number disc (mirrors the map marker style, small)
        const dr = 6;
        ctx.fillStyle = sheet.ink;
        ctx.beginPath();
        ctx.arc(numColX, ry, dr, 0, Math.PI * 2);
        ctx.fill();
        if (isBoss || isEnt) {
          ctx.strokeStyle = isBoss ? sheet.accent : sheet.ink;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(numColX, ry, dr + 1.6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = sheet.floor;
        ctx.font = `700 8.5px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), numColX, ry + 0.5);
        // glyph + label
        ctx.textAlign = 'left';
        ctx.fillStyle = sheet.ink;
        ctx.globalAlpha = 0.9;
        const glyph = isBoss ? '★ ' : isEnt ? '▾ ' : '';
        ctx.font = `${isBoss || isEnt ? '700' : '400'} 9px Georgia, serif`;
        let lbl = glyph + label(r);
        // truncate to fit
        while (lbl.length > 3 && ctx.measureText(lbl).width > panelW - (txtColX - panelX) - pad) {
          lbl = lbl.slice(0, -2) + '…';
        }
        ctx.fillText(lbl, txtColX, ry + 0.5);
        ctx.globalAlpha = 1;
      }
      if (keyed.length > shown) {
        ctx.fillStyle = sheet.ink;
        ctx.globalAlpha = 0.6;
        ctx.font = `italic 400 8px Georgia, serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`+${keyed.length - shown} more below`, panelX + pad, panelY + panelH - 6);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Legend footer: page furniture seated on the base of the sheet. The SYMBOL
  // glossary only — the compass owns orientation, the scale bar owns the 5 ft
  // basis, and the boxed key panel owns entrance/objective, so the footer no
  // longer repeats them (one voice, no duplication). Same serif hand as the rail.
  const legend = '▾ entrance   ★ objective   S secret door   △ trap   ▦ red brick = walled up';
  const legendY = cssH - legendBandH * 0.75;
  ctx.fillStyle = sheet.ink;
  ctx.font = '400 11px Georgia, serif';
  ctx.globalAlpha = 0.75;
  ctx.fillText(legend, cssW / 2, legendY + 7);
  const legW = ctx.measureText(legend).width;
  ctx.strokeStyle = sheet.ink;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cssW / 2 - legW / 2 - 14, legendY - 7);
  ctx.lineTo(cssW / 2 + legW / 2 + 14, legendY - 7);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Double-rule cartographic frame.
  ctx.strokeStyle = sheet.ink;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(8.5, 8.5, cssW - 17, cssH - 17);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(13.5, 13.5, cssW - 27, cssH - 27);
  ctx.globalAlpha = 1;

  return canvas;
}

// ── interactive zoom + pan viewport ─────────────────────────────────────────
// The sheet is composed ONCE ({@link renderSheet}) to a supersampled buffer;
// this is the cheap part that runs on every wheel tick / drag frame. It samples
// a zoom/pan window of that buffer onto the visible canvas with a single
// drawImage — no re-composition, no CSS upscale of rasterized pixels (which
// would blur the fine linework and defeat the whole point). Crispness comes from
// the buffer carrying real detail past 1×; smoothness comes from this being a
// lone blit.

/** The pan/zoom state. `zoom` ≥ 1 (1 = Fit, the exact full-sheet look). `cx`,
 * `cy` ∈ [0,1] are the sheet-normalized coordinates parked at the centre of the
 * visible canvas. */
interface View { zoom: number; cx: number; cy: number }

const FIT_VIEW: View = { zoom: 1, cx: 0.5, cy: 0.5 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/** Clamp the view so the sampled window can never fall off the buffer: at zoom z
 * the half-window is `0.5/z` wide in normalized space, so the centre is penned
 * into `[0.5/z, 1 − 0.5/z]`. At z = 1 that pins the centre to 0.5 (whole sheet). */
function clampView(v: View): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom));
  const half = 0.5 / zoom;
  const lo = half;
  const hi = 1 - half;
  const clamp = (t: number): number => (lo > hi ? 0.5 : Math.min(hi, Math.max(lo, t)));
  return { zoom, cx: clamp(v.cx), cy: clamp(v.cy) };
}

/**
 * Blits the current viewport of the supersampled sheet `buffer` onto the visible
 * `canvas`. The canvas keeps its canonical 800×1131 CSS footprint (backing store
 * in device pixels for HiDPI sharpness); the source rectangle is the buffer
 * window `[cx±0.5/z, cy±0.5/z]`. High-quality smoothing keeps the downsample
 * clean at Fit and the magnified read crisp when zoomed.
 */
function blitViewport(canvas: HTMLCanvasElement, buffer: HTMLCanvasElement, view: View): void {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const cssW = SHEET_CSS_W;
  const cssH = SHEET_CSS_H;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const v = clampView(view);
  const bw = buffer.width;
  const bh = buffer.height;
  const sw = bw / v.zoom;
  const sh = bh / v.zoom;
  const sx = v.cx * bw - sw / 2;
  const sy = v.cy * bh - sh / 2;
  ctx.drawImage(buffer, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

const Toggle: React.FC<{ label: string; on: boolean; onClick: () => void; color?: string }> = ({ label, on, onClick, color }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-7 rounded px-2 text-xs font-semibold transition-colors ${on ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
  >
    {color && <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />}
    {label}
  </button>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }> = ({ label, value, min, max, step, onChange, fmt }) => (
  <label className="flex items-center gap-2 text-xs text-gray-300">
    <span className="w-24 flex-shrink-0">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-32" />
    <span className="w-10 text-right tabular-nums text-gray-400">{fmt ? fmt(value) : value}</span>
  </label>
);

/** Initial seed: `?dseed=<n>` pins a reproducible render; otherwise random. */
function initialSeed(): number {
  const raw = new URLSearchParams(window.location.search).get('dseed');
  if (raw !== null) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  return (Math.random() * 1e9) | 0;
}

const THEME_OPTIONS: DungeonTheme[] = ['crypt', 'cavern', 'frost', 'sewer', 'fungal'];

export const PreviewDungeon: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The supersampled sheet buffer: composed once per plan/overlay change, then
  // sampled by the viewport blit on every zoom/pan without re-drawing the sheet.
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  // Live pan-drag bookkeeping (a ref, not state, so a drag frame never re-renders
  // React — only the imperative blit runs). `px/py` = pointer at grab; `cx/cy` =
  // the view centre at grab; `next` = the latest dragged view, committed on release.
  const dragRef = useRef<{ px: number; py: number; cx: number; cy: number; next?: View } | null>(null);
  const [view, setView] = useState<View>(FIT_VIEW);
  // Cursor feedback only (grab ↔ grabbing). Flips twice per drag, never per move.
  const [dragging, setDragging] = useState(false);
  const [seed, setSeed] = useState<number>(initialSeed);
  const [theme, setTheme] = useState<DungeonTheme>('crypt');
  const [roomCount, setRoomCount] = useState(42);
  const [loopChance, setLoopChance] = useState(0.25);
  const [decorDensity, setDecorDensity] = useState(0.6);
  // null = use the archetype's seeded default; a number pins the layout dial.
  const [sprawl, setSprawl] = useState<number | null>(null);
  const [asOfYearsAgo, setAsOfYearsAgo] = useState(0);
  const [overlays, setOverlays] = useState<Overlays>(DEFAULT_OVERLAYS);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(() => {
    try {
      setError(null);
      return generateDungeon({
        seed,
        params: {
          roomCount, loopChance, decorDensity, theme, asOfYearsAgo,
          ...(sprawl !== null ? { sprawl } : {}),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [seed, theme, roomCount, loopChance, decorDensity, asOfYearsAgo, sprawl]);

  // Compose the sheet buffer ONCE whenever the plan or overlays change, reset the
  // viewport to Fit (a fresh plan is a fresh sheet — the eye should start whole),
  // and blit. Heavy work stays here, off the zoom/pan hot path.
  useEffect(() => {
    if (!plan) { bufferRef.current = null; return; }
    bufferRef.current = renderSheet(plan, overlays);
    setView(FIT_VIEW);
    if (canvasRef.current) blitViewport(canvasRef.current, bufferRef.current, FIT_VIEW);
  }, [plan, overlays]);

  // Re-blit whenever the viewport moves (wheel zoom, +/−, Fit, or the end of a
  // pan). Cheap: one drawImage of the already-composed buffer.
  useEffect(() => {
    if (canvasRef.current && bufferRef.current) blitViewport(canvasRef.current, bufferRef.current, view);
  }, [view]);

  // Scroll-wheel zoom TOWARD the cursor: the sheet point under the pointer stays
  // pinned while the zoom changes (zoom-to-point), so inspecting a gallery means
  // pointing at it and scrolling. Smooth multiplicative steps; range clamped.
  //
  // Attached as a NON-PASSIVE native listener, NOT React's `onWheel`. React marks
  // wheel handlers passive, so `preventDefault()` is a silent no-op there — and
  // because the canvas lives inside an `overflow-auto` pane, the scroll would then
  // pan the PANE instead of (or on top of) zooming the map, which reads as "the
  // zoom doesn't work." A native `{ passive: false }` listener lets us cancel the
  // scroll so the wheel only ever zooms. Re-binds when the canvas mounts (`error`
  // toggles the canvas subtree in/out).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      if (!bufferRef.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      // pointer in [0,1] of the DISPLAYED sheet.
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      setView((prev) => {
        const cur = clampView(prev);
        const factor = Math.exp(-e.deltaY * 0.0015); // wheel-up = zoom in
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cur.zoom * factor));
        // sheet-space point currently under the cursor (before the zoom change).
        const half = 0.5 / cur.zoom;
        const sheetX = cur.cx + (px - 0.5) * 2 * half;
        const sheetY = cur.cy + (py - 0.5) * 2 * half;
        // choose a new centre so that same sheet point stays under the cursor.
        const nHalf = 0.5 / zoom;
        const cx = sheetX - (px - 0.5) * 2 * nHalf;
        const cy = sheetY - (py - 0.5) * 2 * nHalf;
        return clampView({ zoom, cx, cy });
      });
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [error]);

  // Click-drag pan (only meaningful when zoomed in). Uses pointer capture + a ref
  // for live tracking, blitting imperatively per move so the drag is smooth; the
  // final position is committed to state on release so the viewport effect + the
  // zoom readout stay in sync.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bufferRef.current || view.zoom <= MIN_ZOOM) return;
    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, cx: view.cx, cy: view.cy };
    setDragging(true);
  }, [view.zoom, view.cx, view.cy]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    const buffer = bufferRef.current;
    if (!drag || !canvas || !buffer) return;
    const rect = canvas.getBoundingClientRect();
    // a pixel dragged on screen moves the sheet-centre by that fraction of the
    // VISIBLE window (which is 1/zoom of the sheet), opposite the drag direction.
    const cur = clampView(view);
    const dxN = ((e.clientX - drag.px) / rect.width) / cur.zoom;
    const dyN = ((e.clientY - drag.py) / rect.height) / cur.zoom;
    const next = clampView({ zoom: cur.zoom, cx: drag.cx - dxN, cy: drag.cy - dyN });
    blitViewport(canvas, buffer, next); // imperative: smooth, no re-render mid-drag
    dragRef.current = { ...drag, next };
  }, [view]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    if (drag && drag.next) setView(drag.next); // commit the final pan to state
  }, []);

  // Zoom buttons keep the sheet CENTRE fixed (a neutral in/out); Fit resets.
  const zoomBy = useCallback((factor: number) => {
    setView((prev) => clampView({ ...prev, zoom: prev.zoom * factor }));
  }, []);
  const fitView = useCallback(() => setView(FIT_VIEW), []);

  const reroll = useCallback(() => setSeed((Math.random() * 1e9) | 0), []);
  const toggle = useCallback((k: keyof Overlays) => setOverlays((o) => ({ ...o, [k]: !o[k] })), []);

  const keyed = useMemo(() => (plan ? keyedRooms(plan) : []), [plan]);

  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-200">
      {/* header controls */}
      <div className="flex-shrink-0 space-y-2 border-b border-gray-700 bg-gray-800 px-6 py-3 shadow-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider text-white">Dungeon</h2>
            <p className="text-xs text-gray-400">
              {plan ? <span className="italic text-amber-300">{plan.name}</span> : 'procedural dungeon generator'} &middot; each cell = 5&nbsp;ft &middot; deterministic by seed (pin with ?dseed=)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as DungeonTheme)}
              className="h-9 rounded-md border border-gray-600 bg-gray-700 px-2 text-sm capitalize text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {THEME_OPTIONS.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
              className="h-9 w-32 rounded-md border border-gray-600 bg-gray-700 px-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button type="button" onClick={reroll} className="h-9 rounded-md bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-500">
              Reroll 🎲
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Slider label="Rooms" value={roomCount} min={8} max={80} step={1} onChange={setRoomCount} />
          <Slider label="Loop chance" value={loopChance} min={0} max={0.6} step={0.01} onChange={setLoopChance} fmt={(v) => v.toFixed(2)} />
          <Slider label="Decor" value={decorDensity} min={0} max={1.5} step={0.05} onChange={setDecorDensity} fmt={(v) => v.toFixed(2)} />
          <label
            className="flex items-center gap-2 text-xs text-gray-300"
            title="Layout dial: 0 = tight room-through-room suites, 1 = sprawling rooms far apart with long corridors. Blank = the archetype's seeded default."
          >
            <span className="w-16 flex-shrink-0">Sprawl</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={sprawl ?? (plan ? plan.stats.sprawl : 0.3)}
              onChange={(e) => setSprawl(parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="w-16 text-right tabular-nums text-gray-400">
              {sprawl !== null ? sprawl.toFixed(2) : plan ? `${plan.stats.sprawl.toFixed(2)}*` : '—'}
            </span>
            <button
              type="button"
              onClick={() => setSprawl(null)}
              disabled={sprawl === null}
              className="h-6 rounded px-1.5 text-[10px] font-semibold text-gray-400 enabled:hover:bg-gray-700 disabled:opacity-40"
            >
              default
            </button>
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300" title="Replay cutoff: the dungeon as it was N years ago — only events at least this old have happened yet (older map = fewer scars)">
            <span className="flex-shrink-0">As of years ago</span>
            <input
              type="number"
              min={0}
              step={10}
              value={asOfYearsAgo}
              onChange={(e) => setAsOfYearsAgo(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="h-7 w-20 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {asOfYearsAgo > 0 && <span className="text-amber-400">outdated map</span>}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs uppercase tracking-wide text-gray-500">Overlays</span>
          <Toggle label="Graph" on={overlays.graph} onClick={() => toggle('graph')} color="rgba(30,60,150,0.8)" />
          <Toggle label="Loops" on={overlays.loops} onClick={() => toggle('loops')} color="#0e93a3" />
          <Toggle label="Critical path" on={overlays.critical} onClick={() => toggle('critical')} color="#c22222" />
          <Toggle label="Difficulty heat" on={overlays.heatmap} onClick={() => toggle('heatmap')} />
          <span className="mx-1 text-gray-600">|</span>
          <Toggle label="Room types" on={overlays.rooms} onClick={() => toggle('rooms')} />
          <Toggle label="Props" on={overlays.props} onClick={() => toggle('props')} />
          <Toggle label="Spawns" on={overlays.spawns} onClick={() => toggle('spawns')} />
          <Toggle label="Secrets" on={overlays.secrets} onClick={() => toggle('secrets')} color="#7b2fa3" />
          <span className="mx-1 text-gray-600">|</span>
          <Toggle label="History" on={showHistory} onClick={() => setShowHistory((v) => !v)} color="#d8b33a" />
        </div>
      </div>

      {/* canvas + keyed notes + history */}
      <div className="flex-grow overflow-auto bg-gray-950 p-4">
        {error ? (
          <div className="mx-auto max-w-md rounded-md border border-red-700 bg-red-950/60 p-4 text-sm text-red-300">
            <strong className="block font-bold text-red-200">Generation failed (honest, no fallback)</strong>
            {error}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="touch-none select-none rounded border border-gray-800 shadow-2xl"
                style={{ cursor: view.zoom > MIN_ZOOM ? (dragging ? 'grabbing' : 'grab') : 'default' }}
              />
              {/* Zoom control cluster — unobtrusive, top-right, matches panel chrome. */}
              <div className="absolute right-2 top-2 flex select-none items-center gap-1 rounded-md border border-gray-700 bg-gray-800/85 px-1.5 py-1 shadow-lg backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => zoomBy(1 / 1.4)}
                  disabled={view.zoom <= MIN_ZOOM + 1e-3}
                  title="Zoom out"
                  className="flex h-6 w-6 items-center justify-center rounded text-base font-bold leading-none text-gray-200 enabled:hover:bg-gray-700 disabled:opacity-40"
                >
                  &minus;
                </button>
                <span className="w-11 text-center text-xs font-semibold tabular-nums text-gray-300">
                  {Math.round(view.zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => zoomBy(1.4)}
                  disabled={view.zoom >= MAX_ZOOM - 1e-3}
                  title="Zoom in"
                  className="flex h-6 w-6 items-center justify-center rounded text-base font-bold leading-none text-gray-200 enabled:hover:bg-gray-700 disabled:opacity-40"
                >
                  +
                </button>
                <span className="mx-0.5 h-4 w-px bg-gray-600" />
                <button
                  type="button"
                  onClick={fitView}
                  disabled={view.zoom <= MIN_ZOOM + 1e-3 && Math.abs(view.cx - 0.5) < 1e-3 && Math.abs(view.cy - 0.5) < 1e-3}
                  title="Reset to fit"
                  className="h-6 rounded px-2 text-xs font-semibold text-gray-200 enabled:hover:bg-gray-700 disabled:opacity-40"
                >
                  Fit
                </button>
              </div>
            </div>

            {plan && keyed.length > 0 && (
              <div className="w-full max-w-3xl rounded-md border border-gray-800 bg-gray-900/80 p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Keyed notes</h3>
                <ol className="space-y-1.5 text-sm">
                  {keyed.map((r, i) => (
                    <li key={r.id} className="flex gap-2">
                      <span className="w-8 flex-shrink-0 text-right font-bold tabular-nums text-amber-300">
                        {r.type === 'boss' ? `★${i + 1}` : r.type === 'entrance' ? `▾${i + 1}` : i + 1}
                      </span>
                      <span className="text-gray-300">{r.note}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {plan && showHistory && (
              <div className="w-full max-w-3xl rounded-md border border-amber-900/50 bg-gray-900/80 p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  History — {plan.builderName}&apos;s {plan.archetype}
                  {plan.params.asOfYearsAgo ? ` · as of ${plan.params.asOfYearsAgo} years ago` : ''}
                </h3>
                {plan.history.length === 0 ? (
                  <p className="text-sm italic text-gray-500">No recorded events — the structure stands as built.</p>
                ) : (
                  <ol className="space-y-1.5 text-sm">
                    {plan.history.map((e) => (
                      <li key={e.id} className="flex gap-2">
                        <span className="w-32 flex-shrink-0 text-right tabular-nums text-gray-500">
                          {e.yearsAgo} years ago
                        </span>
                        <span className="text-gray-300">
                          {e.summary}
                          {e.failed && <span className="ml-1 italic text-gray-500">(failed)</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* footer stats + legend */}
      {plan && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-700 bg-gray-800 px-6 py-2 text-xs text-gray-400">
          <span>seed {plan.seed}</span>
          <span className="capitalize">{plan.params.theme}</span>
          <span className={plan.stats.rooms < plan.stats.roomsRequested ? 'text-amber-400' : ''}>
            {plan.stats.rooms}/{plan.stats.roomsRequested} rooms
          </span>
          <span>{plan.stats.edges} edges</span>
          <span>{plan.stats.loops} loops (cyclomatic {plan.stats.cyclomatic})</span>
          <span>crit path {plan.stats.criticalLength}</span>
          <span>{plan.stats.events} events</span>
          <span>{plan.doors.filter((d) => d.state === 'bricked').length} bricked</span>
          <span>{plan.secretDoorCells.length} secret</span>
          <span>{plan.traps.length} traps</span>
          <span>{plan.stats.props} props</span>
          <span>{plan.stats.spawns} spawns · {plan.stats.encounterXp} XP</span>
          <span className={plan.stats.genMs < 50 ? 'text-green-400' : 'text-amber-400'}>{plan.stats.genMs.toFixed(1)} ms</span>
          <span>{plan.stats.attempts > 1 ? `${plan.stats.attempts} attempts` : '1st try'}</span>
          <span className="ml-auto flex items-center gap-3">
            {(['entrance', 'combat', 'elite', 'treasure', 'shrine', 'boss'] as RoomType[]).map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                {t}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
};
