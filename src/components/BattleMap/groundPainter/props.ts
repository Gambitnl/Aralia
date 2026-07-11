/**
 * @file groundPainter/props.ts
 * Deterministic hash + sprite-stamp helpers and the hand-drawn top-down prop
 * drawers (trees, bushes, tufts, logs, rocks, cacti, stalagmites, pillars,
 * pines, crystals, mangroves) with their per-biome palettes.
 *
 * Extracted verbatim from groundPainter.ts so both the DOM <canvas> renderer
 * and the PixiJS prototype share the exact same procedural art. The paint
 * pipeline composes these; nothing here reaches outside the 2D canvas context.
 */

// Tiny deterministic hash → [0,1) so texture jitter and foliage are stable.
// Integer avalanche hash, not the old sin() trick: sin-hashes correlate on
// integer lattices, which made patch centers line up into visible ray fans
// and scatter fall into dotted diagonals at whole-board zoom (the 3D world
// hit the same artifact — see the scatter de-gridding fix).
export const rand = (x: number, y: number, salt: number): number => {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Stamp a painted sprite centered at (cx, cy), scaled to a target width with
// aspect preserved. Props with baked shadows should keep |rot| small so the
// light direction stays coherent; flat decals rotate freely.
export const stamp = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  targetW: number,
  rot: number,
) => {
  const s = targetW / img.width;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
};

export const pick = (arr: HTMLImageElement[] | undefined, x: number, y: number, salt: number): HTMLImageElement | null =>
  arr && arr.length ? arr[Math.floor(rand(x, y, salt) * arr.length)] : null;

// Top-down foliage clump: a soft shadow, then a scalloped layered canopy with
// a sunlit side, like the painted trees in the reference map.
export const drawTree = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  // Shadow, offset toward the lower-right (sun from the upper-left).
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.30, cy + r * 0.34, r * 0.95, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  // Scalloped canopy silhouette: lobes around the rim instead of a flat circle.
  const lobes = 7;
  const scallop = (radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + rand(seed, i, 31) * 0.5;
      const lr = radius * (0.82 + rand(seed, i, 32) * 0.3);
      ctx.arc(cx + Math.cos(a) * lr * 0.55, cy + Math.sin(a) * lr * 0.55, lr * 0.55, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  ctx.fillStyle = '#2a4f2c';
  scallop(r);
  ctx.fillStyle = '#376339';
  scallop(r * 0.8);
  ctx.fillStyle = '#457a45';
  scallop(r * 0.58);
  // Sunlit crown on the upper-left.
  ctx.fillStyle = 'rgba(178,212,120,0.45)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.30, r * 0.32, 0, Math.PI * 2);
  ctx.arc(cx - r * 0.05, cy - r * 0.42, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // A hint of trunk visible through the canopy center.
  ctx.fillStyle = 'rgba(60,42,26,0.55)';
  ctx.beginPath();
  ctx.arc(cx + r * 0.05, cy + r * 0.05, r * 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Small understory bush: 2–3 dark leafy blobs with a sunlit tip. The palette
// is swappable so swamps get murk-green scrub and deserts get dry sage.
interface BushPalette { dark: string; mid: string; light: string }
export const BUSH_FOREST: BushPalette = { dark: '#2f5230', mid: '#3f6b38', light: 'rgba(170,205,110,0.4)' };
export const BUSH_SWAMP: BushPalette = { dark: '#26361f', mid: '#33482a', light: 'rgba(130,150,80,0.35)' };
export const BUSH_DESERT: BushPalette = { dark: '#5c5a34', mid: '#75704a', light: 'rgba(200,190,130,0.4)' };
export const drawBush = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, pal: BushPalette = BUSH_FOREST) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.2, cy + r * 0.25, r * 0.9, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const blobs = 2 + Math.floor(rand(seed, 0, 41) * 2);
  for (let i = 0; i < blobs; i++) {
    ctx.fillStyle = i === blobs - 1 ? pal.mid : pal.dark;
    ctx.beginPath();
    ctx.arc(cx + (rand(seed, i, 42) - 0.5) * r, cy + (rand(seed, i, 43) - 0.5) * r * 0.8, r * (0.55 - i * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pal.light;
  ctx.beginPath();
  ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Grass tuft: a few short blade strokes. Colors + density swap per biome
// (lush green, marsh reed, bleached dry grass).
export const drawTuft = (
  ctx: CanvasRenderingContext2D,
  tile: { coordinates: { x: number; y: number } },
  tileSize: number,
  seed: number,
  light: string,
  dark: string,
  chance: number,
) => {
  const tuft = rand(tile.coordinates.x, tile.coordinates.y, 66);
  if (tuft >= chance) return;
  const cx = tile.coordinates.x * tileSize + tileSize / 2;
  const cy = tile.coordinates.y * tileSize + tileSize / 2;
  const bx = cx + (rand(seed, 10, 71) - 0.5) * tileSize * 0.8;
  const by = cy + (rand(seed, 11, 72) - 0.5) * tileSize * 0.8;
  ctx.strokeStyle = tuft < chance / 2 ? light : dark;
  ctx.lineWidth = 1;
  for (let b = 0; b < 3; b++) {
    const a = -Math.PI / 2 + (rand(seed, b, 73) - 0.5) * 1.1;
    const len = tileSize * (0.12 + rand(seed, b, 74) * 0.1);
    ctx.beginPath();
    ctx.moveTo(bx + (b - 1) * 1.5, by);
    ctx.lineTo(bx + (b - 1) * 1.5 + Math.cos(a) * len, by + Math.sin(a) * len);
    ctx.stroke();
  }
};

// Fallen log: a rotated brown capsule with a lighter cut end.
export const drawLog = (ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, seed: number) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rand(seed, 0, 51) * Math.PI);
  const w = len * 0.28;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(len * 0.05, w * 0.5, len * 0.6, w * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4c3623';
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len / 2, 0);
  ctx.stroke();
  // Bark highlight along the top edge.
  ctx.strokeStyle = 'rgba(140,105,70,0.5)';
  ctx.lineWidth = w * 0.35;
  ctx.beginPath();
  ctx.moveTo(-len * 0.42, -w * 0.2);
  ctx.lineTo(len * 0.42, -w * 0.2);
  ctx.stroke();
  // Cut end.
  ctx.fillStyle = '#a8845c';
  ctx.beginPath();
  ctx.arc(len / 2, 0, w * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,64,40,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(len / 2, 0, w * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

// Top-down boulder: irregular polygon with a shadow and a highlight. Body
// color swaps per biome (cool gray in forest, sandstone in desert, dark
// basalt in caves).
interface RockPalette { body: string; light: string }
export const ROCK_GRAY: RockPalette = { body: '#6b7280', light: 'rgba(200,205,215,0.4)' };
export const ROCK_SAND: RockPalette = { body: '#8a7a5e', light: 'rgba(225,205,160,0.45)' };
export const ROCK_DARK: RockPalette = { body: '#565062', light: 'rgba(160,150,175,0.35)' };
export const drawRock = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, pal: RockPalette = ROCK_GRAY) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.2, cy + r * 0.28, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.body;
  ctx.beginPath();
  const pts = 7;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * (0.7 + rand(seed, i, 3) * 0.35);
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr * 0.85;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.2, cy - r * 0.22, r * 0.4, r * 0.28, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Top-down saguaro: a fat central disc with 2–3 arm lobes reaching outward,
// ribbed with radial lines — reads as a cactus, not a green tree.
export const drawCactus = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.22, cy + r * 0.26, r * 0.8, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const arms = 2 + Math.floor(rand(seed, 0, 131) * 2);
  for (let i = 0; i < arms; i++) {
    const a = rand(seed, i, 132) * Math.PI * 2;
    const d = r * (0.55 + rand(seed, i, 133) * 0.3);
    ctx.fillStyle = '#3d6636';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4a7a40';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Radial ribs.
  ctx.strokeStyle = 'rgba(24,48,22,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand(seed, i, 134);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15);
    ctx.lineTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(190,220,140,0.5)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.18, cy - r * 0.18, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Cave stalagmite: a tight cluster of sharp pale spikes rising from a dark
// base ring — from above, a spiky star rather than a round boulder.
export const drawStalagmite = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.12, cy + r * 0.15, r * 1.0, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  const spikes = 3 + Math.floor(rand(seed, 0, 141) * 3);
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + rand(seed, i, 142);
    const d = r * rand(seed, i, 143) * 0.5;
    const sx = cx + Math.cos(a) * d;
    const sy = cy + Math.sin(a) * d;
    const sr = r * (0.28 + rand(seed, i, 144) * 0.3);
    // Each spike: a small triangle fan pointing outward from the cluster.
    ctx.fillStyle = i % 2 === 0 ? '#6d6678' : '#7d7689';
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * sr, sy + Math.sin(a) * sr);
    ctx.lineTo(sx + Math.cos(a + 2.3) * sr * 0.6, sy + Math.sin(a + 2.3) * sr * 0.6);
    ctx.lineTo(sx + Math.cos(a - 2.3) * sr * 0.6, sy + Math.sin(a - 2.3) * sr * 0.6);
    ctx.closePath();
    ctx.fill();
    // Pale tip highlight.
    ctx.fillStyle = 'rgba(200,195,215,0.55)';
    ctx.beginPath();
    ctx.arc(sx + Math.cos(a) * sr * 0.6, sy + Math.sin(a) * sr * 0.6, sr * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

// Dungeon pillar: square plinth, round shaft, rim shading — worked stone,
// clearly man-made next to the flagstone floor.
export const drawPillar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.18, cy + r * 0.22, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4e4e58';
  ctx.fillRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
  ctx.fillStyle = '#66626f';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7d7889';
  ctx.beginPath();
  ctx.arc(cx - r * 0.08, cy - r * 0.1, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  // A chipped edge or two so pillars aren't identical.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const chips = Math.floor(rand(seed, 0, 151) * 3);
  for (let i = 0; i < chips; i++) {
    const a = rand(seed, i, 152) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

// Snowy pine: a pointed star-silhouette conifer (round scallops read as
// broadleaf), layered dark green with a snow-dusted crown.
export const drawPine = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(20,30,50,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.25, cy + r * 0.3, r * 0.9, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  const star = (radius: number, fill: string, rot: number) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    const points = 8;
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 + rot;
      const rr = i % 2 === 0 ? radius : radius * 0.45;
      const pxp = cx + Math.cos(a) * rr;
      const pyp = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(pxp, pyp); else ctx.lineTo(pxp, pyp);
    }
    ctx.closePath();
    ctx.fill();
  };
  const rot = rand(seed, 0, 241) * Math.PI;
  star(r, '#1c3823', rot);
  star(r * 0.72, '#26482c', rot + 0.35);
  star(r * 0.46, '#31582f', rot + 0.7);
  // Snow-dusted crown.
  star(r * 0.26, 'rgba(230,240,248,0.85)', rot + 1.0);
  ctx.restore();
};

// Cave crystal cluster: sharp translucent shards with a cold glow — the
// point of visual interest that keeps caverns from being undifferentiated
// dark rock.
export const drawCrystal = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  halo.addColorStop(0, 'rgba(90,225,205,0.22)');
  halo.addColorStop(1, 'rgba(90,225,205,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  const shards = 3 + Math.floor(rand(seed, 0, 251) * 2);
  for (let i = 0; i < shards; i++) {
    const a = rand(seed, i, 252) * Math.PI * 2;
    const len = r * (0.7 + rand(seed, i, 253) * 0.7);
    const wdt = r * 0.22;
    const tipX = cx + Math.cos(a) * len;
    const tipY = cy + Math.sin(a) * len;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(88,205,190,0.85)' : 'rgba(120,230,214,0.8)';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx + Math.cos(a + Math.PI / 2) * wdt, cy + Math.sin(a + Math.PI / 2) * wdt);
    ctx.lineTo(cx + Math.cos(a - Math.PI / 2) * wdt, cy + Math.sin(a - Math.PI / 2) * wdt);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(235,255,250,0.8)';
    ctx.beginPath();
    ctx.arc(tipX, tipY, wdt * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

// Swamp mangrove: a darker, meaner canopy with prop roots splaying out
// below it — the roots are what say "mangrove" from above.
export const drawMangrove = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  // Root spokes first, under the canopy.
  ctx.strokeStyle = '#33291c';
  ctx.lineCap = 'round';
  const roots = 5 + Math.floor(rand(seed, 0, 161) * 3);
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + rand(seed, i, 162) * 0.6;
    const len = r * (0.75 + rand(seed, i, 163) * 0.45);
    ctx.lineWidth = 2 + rand(seed, i, 164) * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + Math.cos(a + 0.3) * len * 0.5,
      cy + Math.sin(a + 0.3) * len * 0.5,
      cx + Math.cos(a) * len,
      cy + Math.sin(a) * len,
    );
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.2, cy + r * 0.25, r * 0.85, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  // Canopy: same scallop trick as the forest tree, murkier palette.
  const lobes = 7;
  const scallop = (radius: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + rand(seed, i, 165) * 0.5;
      const lr = radius * (0.82 + rand(seed, i, 166) * 0.3);
      ctx.arc(cx + Math.cos(a) * lr * 0.55, cy + Math.sin(a) * lr * 0.55, lr * 0.55, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  scallop(r * 0.9, '#233a24');
  scallop(r * 0.7, '#2d4a2c');
  scallop(r * 0.5, '#3a5a34');
  ctx.fillStyle = 'rgba(140,160,90,0.35)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.22, cy - r * 0.25, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
