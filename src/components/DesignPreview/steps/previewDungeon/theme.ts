/**
 * @file previewDungeon/theme.ts
 * @description Theme-keyed sheet styles and palette tables for the dungeon
 * design-preview sheet (extracted verbatim from PreviewDungeon.tsx). Holds the
 * per-theme SheetStyle palette map (SHEETS), the room-type color/tint tables,
 * the overlay ground-fill table, and the Overlays toggle shape with its
 * DEFAULT_OVERLAYS. Pure data — no drawing, no plan logic.
 */
import { OverlayKind, type DungeonTheme, type RoomType } from '../../../../systems/worldforge/dungeon/types';

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

export const SHEETS: Record<DungeonTheme, SheetStyle> = {
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

export const TYPE_COLOR: Record<RoomType, string> = {
  entrance: '#3fb96b',
  combat: '#8a7a5c',
  elite: '#c9772e',
  treasure: '#d8b33a',
  shrine: '#4aa6d8',
  boss: '#c33b3b',
};

/** Muted floor tint for keyed rooms — stained stone, not paint. */
export const TYPE_TINT: Partial<Record<RoomType, { fill: string; pool: string }>> = {
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
export const OVERLAY_FILL: Record<number, string> = {
  [OverlayKind.Rubble]: '#c7b591',
  [OverlayKind.Ice]: '#d5dee0',
  [OverlayKind.Bloom]: '#b9a7b4',
  [OverlayKind.Scorch]: '#9c8f79',
};

export interface Overlays {
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

export const DEFAULT_OVERLAYS: Overlays = {
  graph: false,
  loops: false,
  critical: false,
  heatmap: false,
  rooms: false,
  props: true,
  spawns: false, // presentation sheet stays quiet; toggle on to see encounters
  secrets: true, // DM sheet default: show the hidden back ways
};
