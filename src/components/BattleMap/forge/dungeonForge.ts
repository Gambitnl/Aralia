// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:18:10
 * Dependents: components/BattleMap/forge/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file dungeonForge.ts
 * The dungeon asset set for the procedural asset forge: flagstone slabs,
 * stone pillars, wooden crates, banded doors, lit braziers, and treasure
 * chests. Same owned stylized language as the cave set — light from the
 * upper-left, a bold ink outline on every silhouette, all seeded so a given
 * seed always draws the same props.
 *
 * These are pure canvas drawers (ctx + position + size + seed). The design
 * preview showcases them; the same functions can later feed the battle-map
 * painter as the dungeon biome's real props.
 */
import { TAU, mulberry32, poly, type Pt } from './forgePrimitives';

// ------------------------------------------------------------ palettes ---
interface Shade {
  hi: string;
  light: string;
  mid: string;
  dark: string;
  darker: string;
  ink: string;
}
const STONE: Shade = { hi: '#c2c6d0', light: '#9aa0ab', mid: '#6d727d', dark: '#474b55', darker: '#2f333b', ink: '#14161c' };
const WOOD: Shade = { hi: '#c79a5e', light: '#9c6f3c', mid: '#7a5327', dark: '#593a18', darker: '#3a2510', ink: '#1c1206' };
const IRON: Shade = { hi: '#aab0bb', light: '#767b85', mid: '#494d55', dark: '#2b2e34', darker: '#1a1c21', ink: '#0c0e12' };

// The brazier row uses the sheet's remaining lower margin deliberately. Its
// label sits between the preceding props and the highest possible seeded ember,
// while the feet and shadows remain inside the 1120-pixel authored canvas.
const BRAZIER_LABEL_Y = 850;
const BRAZIER_BASE_Y = 1080;

/** Soft ground shadow shared by every standing dungeon prop. */
function groundShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.14, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
}

/** Speckle a clipped region with pale/dark stone flecks for surface grain. */
function speckle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, rnd: () => number): void {
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w, py = y + rnd() * h, s = Math.max(1, (w + h) * 0.006 * (0.6 + rnd()));
    ctx.fillStyle = rnd() > 0.5 ? `rgba(210,214,224,${0.05 + rnd() * 0.09})` : `rgba(16,18,24,${0.07 + rnd() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(px, py, s, s * 0.72, rnd() * TAU, 0, TAU);
    ctx.fill();
  }
}

// ------------------------------------------------------------ flagstone ---
/**
 * A chunky isometric flagstone slab with a lit top face, dark side faces for
 * thickness, mortar cracks that split it into pieces, and a beveled upper-left
 * edge. Reads as a floor tile lifted just off the ground.
 */
export function drawFlagstone(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number): void {
  const rnd = mulberry32(seed);
  const hw = R * 1.16, hh = R * 0.62, th = R * 0.32;
  const T: Pt = { x: cx, y: cy - hh }, Rr: Pt = { x: cx + hw, y: cy }, B: Pt = { x: cx, y: cy + hh }, L: Pt = { x: cx - hw, y: cy };
  const Bd: Pt = { x: B.x, y: B.y + th }, Rd: Pt = { x: Rr.x, y: Rr.y + th }, Ld: Pt = { x: L.x, y: L.y + th };

  groundShadow(ctx, cx, cy + th + hh * 0.45, hw * 1.02, hh * 0.72);

  // Side faces give the slab thickness; the right face reads darker.
  poly(ctx, [L, B, Bd, Ld], STONE.darker);
  poly(ctx, [B, Rr, Rd, Bd], STONE.dark);

  // Lit top face.
  const traceTop = (): void => {
    ctx.beginPath();
    ctx.moveTo(T.x, T.y); ctx.lineTo(Rr.x, Rr.y); ctx.lineTo(B.x, B.y); ctx.lineTo(L.x, L.y); ctx.closePath();
  };
  ctx.save();
  traceTop(); ctx.clip();
  const g = ctx.createLinearGradient(L.x, T.y, Rr.x, B.y);
  g.addColorStop(0, STONE.light); g.addColorStop(1, STONE.mid);
  ctx.fillStyle = g; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2 + th);
  speckle(ctx, cx - hw, cy - hh, hw * 2, hh * 2, 44, rnd);
  // Mortar cracks split the tile into a few flagstones.
  ctx.strokeStyle = 'rgba(18,20,26,0.5)'; ctx.lineWidth = Math.max(1, R * 0.05); ctx.lineCap = 'round';
  const cracks = 2 + Math.floor(rnd() * 2);
  for (let c = 0; c < cracks; c++) {
    let px = cx + (rnd() - 0.5) * hw * 1.4, py = cy - hh + rnd() * 4;
    ctx.beginPath(); ctx.moveTo(px, py);
    const segs = 3 + Math.floor(rnd() * 2);
    for (let s = 0; s < segs; s++) { px += (rnd() - 0.5) * hw * 0.5; py += hh * (0.5 + rnd() * 0.4); ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();

  // Bevel highlight along the upper-left top edges.
  ctx.strokeStyle = 'rgba(214,218,228,0.5)'; ctx.lineWidth = Math.max(1, R * 0.06); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(T.x, T.y); ctx.lineTo(Rr.x, Rr.y); ctx.stroke();

  // Single ink outline around the whole slab silhouette.
  ctx.beginPath();
  ctx.moveTo(T.x, T.y); ctx.lineTo(Rr.x, Rr.y); ctx.lineTo(Rd.x, Rd.y); ctx.lineTo(Bd.x, Bd.y); ctx.lineTo(Ld.x, Ld.y); ctx.lineTo(L.x, L.y); ctx.closePath();
  ctx.strokeStyle = STONE.ink; ctx.lineWidth = Math.max(1.6, R * 0.06); ctx.lineJoin = 'round'; ctx.stroke();
}

// --------------------------------------------------------------- block ---
/**
 * A frontal stone/wood block: horizontal light-left gradient, a darker right
 * plane for volume, a thin lit cap, and an ink outline. The reusable base for
 * pillars, crates, and chests.
 */
function frontBlock(ctx: CanvasRenderingContext2D, cx: number, topY: number, hw: number, h: number, pal: Shade, rnd: () => number): void {
  const left = cx - hw;
  const g = ctx.createLinearGradient(left, 0, cx + hw, 0);
  g.addColorStop(0, pal.light); g.addColorStop(0.55, pal.mid); g.addColorStop(1, pal.dark);
  ctx.fillStyle = g; ctx.fillRect(left, topY, hw * 2, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(left, topY, hw * 2, h); ctx.clip();
  speckle(ctx, left, topY, hw * 2, h, Math.round(hw * 0.9), rnd);
  ctx.restore();
  // Right shadow plane.
  ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fillRect(cx + hw * 0.42, topY, hw * 0.58, h);
  // Lit top cap.
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(left, topY, hw * 2, h * 0.07);
  ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1.5, hw * 0.09); ctx.lineJoin = 'round';
  ctx.strokeRect(left, topY, hw * 2, h);
}

// ------------------------------------------------------------- pillar ---
/**
 * A fluted stone column: stacked base plinth, tapered shaft with vertical
 * flutes and cracks, and a flared capital. Stands on baseY, rises H.
 */
export function drawPillar(ctx: CanvasRenderingContext2D, cx: number, baseY: number, H: number, seed: number): void {
  const rnd = mulberry32(seed);
  const w = H * 0.16;
  groundShadow(ctx, cx, baseY + w * 0.28, w * 1.7, w * 0.5);

  const capH = H * 0.11, baseH = H * 0.12;
  const shaftTop = baseY - H + capH, shaftBot = baseY - baseH;
  const shaftH = shaftBot - shaftTop;

  // Fluted shaft with slight entasis (mid-bulge).
  const sw = w * 0.82;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - sw, shaftBot);
  ctx.quadraticCurveTo(cx - sw * 1.08, shaftTop + shaftH * 0.5, cx - sw * 0.9, shaftTop);
  ctx.lineTo(cx + sw * 0.9, shaftTop);
  ctx.quadraticCurveTo(cx + sw * 1.08, shaftTop + shaftH * 0.5, cx + sw, shaftBot);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(cx - sw, 0, cx + sw, 0);
  g.addColorStop(0, STONE.light); g.addColorStop(0.5, STONE.mid); g.addColorStop(1, STONE.dark);
  ctx.fillStyle = g; ctx.fillRect(cx - sw * 1.2, shaftTop, sw * 2.4, shaftH);
  speckle(ctx, cx - sw, shaftTop, sw * 2, shaftH, 40, rnd);
  // Vertical flutes: a pale left rim and a dark cut per groove.
  const flutes = 4;
  for (let i = 0; i <= flutes; i++) {
    const fx = cx - sw * 0.78 + (i / flutes) * sw * 1.56;
    ctx.strokeStyle = 'rgba(20,22,28,0.42)'; ctx.lineWidth = Math.max(1, w * 0.05);
    ctx.beginPath(); ctx.moveTo(fx, shaftTop); ctx.lineTo(fx, shaftBot); ctx.stroke();
    ctx.strokeStyle = 'rgba(214,218,228,0.22)'; ctx.lineWidth = Math.max(0.8, w * 0.03);
    ctx.beginPath(); ctx.moveTo(fx - w * 0.09, shaftTop); ctx.lineTo(fx - w * 0.09, shaftBot); ctx.stroke();
  }
  // A couple of weathering cracks.
  ctx.strokeStyle = 'rgba(16,18,24,0.4)'; ctx.lineWidth = Math.max(1, w * 0.04); ctx.lineCap = 'round';
  for (let c = 0; c < 2; c++) {
    let px = cx + (rnd() - 0.5) * sw, py = shaftTop + rnd() * shaftH * 0.4;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let s = 0; s < 3; s++) { px += (rnd() - 0.5) * w * 0.4; py += shaftH * (0.14 + rnd() * 0.12); ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();
  // Shaft ink edges.
  ctx.strokeStyle = STONE.ink; ctx.lineWidth = Math.max(1.5, w * 0.1); ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - sw, shaftBot);
  ctx.quadraticCurveTo(cx - sw * 1.08, shaftTop + shaftH * 0.5, cx - sw * 0.9, shaftTop);
  ctx.moveTo(cx + sw * 0.9, shaftTop);
  ctx.quadraticCurveTo(cx + sw * 1.08, shaftTop + shaftH * 0.5, cx + sw, shaftBot);
  ctx.stroke();

  // Capital (top) and base plinth (bottom) as flared blocks.
  frontBlock(ctx, cx, baseY - H, w * 1.12, capH, STONE, rnd);
  frontBlock(ctx, cx, shaftBot, w * 1.2, baseH, STONE, rnd);
}

// -------------------------------------------------------------- crate ---
/** A wooden crate: planked front, iron corner brackets, and rivets. */
export function drawCrate(ctx: CanvasRenderingContext2D, cx: number, baseY: number, S: number, seed: number): void {
  const rnd = mulberry32(seed);
  const hw = S * 0.5, h = S * (0.92 + rnd() * 0.1), topY = baseY - h;
  groundShadow(ctx, cx, baseY, hw * 1.5, hw * 0.34);
  frontBlock(ctx, cx, topY, hw, h, WOOD, rnd);

  ctx.save();
  ctx.beginPath(); ctx.rect(cx - hw, topY, hw * 2, h); ctx.clip();
  // Vertical planks.
  const planks = 3 + Math.floor(rnd() * 2);
  ctx.strokeStyle = 'rgba(28,18,6,0.5)'; ctx.lineWidth = Math.max(1, S * 0.02);
  for (let i = 1; i < planks; i++) {
    const px = cx - hw + (i / planks) * hw * 2;
    ctx.beginPath(); ctx.moveTo(px, topY); ctx.lineTo(px, baseY); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,190,140,0.14)'; ctx.beginPath(); ctx.moveTo(px + S * 0.015, topY); ctx.lineTo(px + S * 0.015, baseY); ctx.stroke();
    ctx.strokeStyle = 'rgba(28,18,6,0.5)';
  }
  // Diagonal brace across the front.
  ctx.strokeStyle = 'rgba(28,18,6,0.42)'; ctx.lineWidth = Math.max(1.4, S * 0.05);
  ctx.beginPath(); ctx.moveTo(cx - hw, baseY); ctx.lineTo(cx + hw, topY); ctx.stroke();
  ctx.restore();

  // Iron corner brackets with rivets.
  const bw = S * 0.16;
  ctx.strokeStyle = IRON.mid; ctx.lineWidth = Math.max(1.4, S * 0.03);
  const corners: Array<[number, number, number, number]> = [
    [cx - hw, topY, 1, 1], [cx + hw, topY, -1, 1], [cx - hw, baseY, 1, -1], [cx + hw, baseY, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.fillStyle = IRON.dark; ctx.fillRect(Math.min(x, x + sx * bw), Math.min(y, y + sy * bw), bw, bw);
    ctx.strokeRect(Math.min(x, x + sx * bw), Math.min(y, y + sy * bw), bw, bw);
    ctx.fillStyle = IRON.hi; ctx.beginPath(); ctx.arc(x + sx * bw * 0.5, y + sy * bw * 0.5, S * 0.02, 0, TAU); ctx.fill();
  }
}

// -------------------------------------------------------------- chest ---
/** A treasure chest: planked body, domed iron-strapped lid, and a lock plate. */
export function drawChest(ctx: CanvasRenderingContext2D, cx: number, baseY: number, S: number, seed: number): void {
  const rnd = mulberry32(seed);
  const hw = S * 0.6, bodyH = S * 0.5, lidH = S * 0.4, topY = baseY - bodyH;
  groundShadow(ctx, cx, baseY, hw * 1.4, hw * 0.28);

  // Body.
  frontBlock(ctx, cx, topY, hw, bodyH, WOOD, rnd);

  // Domed lid.
  const lidBase = topY, lidTop = topY - lidH;
  const traceLid = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - hw, lidBase);
    ctx.quadraticCurveTo(cx - hw, lidTop, cx, lidTop);
    ctx.quadraticCurveTo(cx + hw, lidTop, cx + hw, lidBase);
    ctx.closePath();
  };
  ctx.save();
  traceLid(); ctx.clip();
  const lg = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
  lg.addColorStop(0, WOOD.hi); lg.addColorStop(0.55, WOOD.light); lg.addColorStop(1, WOOD.dark);
  ctx.fillStyle = lg; ctx.fillRect(cx - hw, lidTop, hw * 2, lidH + 2);
  ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.fillRect(cx + hw * 0.42, lidTop, hw * 0.58, lidH + 2);
  ctx.restore();

  // Iron straps: two verticals over lid + body, plus a rim under the lid.
  ctx.strokeStyle = IRON.dark; ctx.lineWidth = Math.max(2, S * 0.06);
  for (const dx of [-hw * 0.55, hw * 0.55]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, baseY);
    ctx.lineTo(cx + dx, lidBase);
    ctx.quadraticCurveTo(cx + dx * 0.9, lidTop + lidH * 0.2, cx + dx * 0.5, lidTop + lidH * 0.05);
    ctx.stroke();
    ctx.strokeStyle = IRON.hi; ctx.lineWidth = Math.max(0.8, S * 0.014);
    ctx.beginPath(); ctx.moveTo(cx + dx - S * 0.03, baseY); ctx.lineTo(cx + dx - S * 0.03, lidBase); ctx.stroke();
    ctx.strokeStyle = IRON.dark; ctx.lineWidth = Math.max(2, S * 0.06);
  }
  ctx.strokeStyle = IRON.mid; ctx.lineWidth = Math.max(1.6, S * 0.04);
  ctx.beginPath(); ctx.moveTo(cx - hw, lidBase); ctx.lineTo(cx + hw, lidBase); ctx.stroke();

  // Lid ink outline.
  traceLid(); ctx.strokeStyle = WOOD.ink; ctx.lineWidth = Math.max(1.6, S * 0.05); ctx.lineJoin = 'round'; ctx.stroke();

  // Lock plate.
  const lockY = lidBase + bodyH * 0.02;
  ctx.fillStyle = IRON.light; ctx.strokeStyle = IRON.ink; ctx.lineWidth = Math.max(1, S * 0.02);
  ctx.beginPath(); ctx.rect(cx - S * 0.09, lockY - S * 0.02, S * 0.18, S * 0.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = IRON.darker; ctx.beginPath(); ctx.arc(cx, lockY + S * 0.09, S * 0.03, 0, TAU); ctx.fill();
}

// --------------------------------------------------------------- door ---
/** An arched dungeon door: stone frame, planked leaf, iron bands, ring pull. */
export function drawDoor(ctx: CanvasRenderingContext2D, cx: number, baseY: number, H: number, seed: number): void {
  const rnd = mulberry32(seed);
  const hw = H * 0.34, springY = baseY - H * 0.72, topY = baseY - H;
  groundShadow(ctx, cx, baseY, hw * 1.5, hw * 0.28);

  const fw = hw * 0.24; // frame thickness
  // Stone frame: outer arch minus inner arch.
  const archOuter = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - hw, baseY);
    ctx.lineTo(cx - hw, springY);
    ctx.quadraticCurveTo(cx - hw, topY, cx, topY);
    ctx.quadraticCurveTo(cx + hw, topY, cx + hw, springY);
    ctx.lineTo(cx + hw, baseY);
    ctx.closePath();
  };
  const ihw = hw - fw, iSpringY = springY + fw * 0.5, iTopY = topY + fw;
  const archInner = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - ihw, baseY);
    ctx.lineTo(cx - ihw, iSpringY);
    ctx.quadraticCurveTo(cx - ihw, iTopY, cx, iTopY);
    ctx.quadraticCurveTo(cx + ihw, iTopY, cx + ihw, iSpringY);
    ctx.lineTo(cx + ihw, baseY);
    ctx.closePath();
  };
  // Frame fill.
  ctx.save();
  archOuter();
  const fg = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
  fg.addColorStop(0, STONE.light); fg.addColorStop(1, STONE.dark);
  ctx.fillStyle = fg; ctx.fill();
  ctx.clip();
  speckle(ctx, cx - hw, topY, hw * 2, H, 40, rnd);
  // Voussoir joints around the arch.
  ctx.strokeStyle = 'rgba(16,18,24,0.4)'; ctx.lineWidth = Math.max(1, H * 0.008);
  for (let i = 1; i < 7; i++) {
    const a = Math.PI + (i / 7) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * ihw, springY + Math.sin(a) * (H * 0.28));
    ctx.lineTo(cx + Math.cos(a) * (hw + fw * 0.4), springY + Math.sin(a) * (H * 0.28 + fw));
    ctx.stroke();
  }
  ctx.restore();

  // Door leaf (inner opening) — planked wood.
  ctx.save();
  archInner(); ctx.clip();
  const dg = ctx.createLinearGradient(cx - ihw, 0, cx + ihw, 0);
  dg.addColorStop(0, WOOD.light); dg.addColorStop(0.55, WOOD.mid); dg.addColorStop(1, WOOD.darker);
  ctx.fillStyle = dg; ctx.fillRect(cx - ihw, iTopY, ihw * 2, baseY - iTopY);
  speckle(ctx, cx - ihw, iTopY, ihw * 2, baseY - iTopY, 26, rnd);
  // Vertical planks.
  ctx.strokeStyle = 'rgba(24,14,4,0.55)'; ctx.lineWidth = Math.max(1.2, H * 0.01);
  const planks = 4;
  for (let i = 1; i < planks; i++) {
    const px = cx - ihw + (i / planks) * ihw * 2;
    ctx.beginPath(); ctx.moveTo(px, iTopY); ctx.lineTo(px, baseY); ctx.stroke();
  }
  // Horizontal iron bands with rivets.
  ctx.strokeStyle = IRON.dark; ctx.lineWidth = Math.max(2.4, H * 0.024);
  for (const fy of [springY + H * 0.06, baseY - H * 0.2]) {
    ctx.beginPath(); ctx.moveTo(cx - ihw, fy); ctx.lineTo(cx + ihw, fy); ctx.stroke();
    ctx.fillStyle = IRON.hi;
    for (let r = 0; r < planks + 1; r++) {
      const rx = cx - ihw + (r / planks) * ihw * 2;
      ctx.beginPath(); ctx.arc(rx, fy, H * 0.012, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();

  // Ring pull.
  ctx.strokeStyle = IRON.mid; ctx.lineWidth = Math.max(2, H * 0.02);
  ctx.beginPath(); ctx.arc(cx + ihw * 0.55, baseY - H * 0.42, H * 0.05, 0, TAU); ctx.stroke();
  ctx.strokeStyle = IRON.hi; ctx.lineWidth = Math.max(1, H * 0.01);
  ctx.beginPath(); ctx.arc(cx + ihw * 0.55, baseY - H * 0.42, H * 0.05, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();

  // Frame ink outline (outer + inner).
  archOuter(); ctx.strokeStyle = STONE.ink; ctx.lineWidth = Math.max(1.8, H * 0.016); ctx.lineJoin = 'round'; ctx.stroke();
  archInner(); ctx.strokeStyle = WOOD.ink; ctx.lineWidth = Math.max(1.6, H * 0.014); ctx.stroke();
}

// ------------------------------------------------------------ brazier ---
/**
 * A lit iron brazier: three splayed legs, a riveted bowl, glowing coals, a
 * seeded flame, a warm halo, and a few rising embers.
 */
export function drawBrazier(ctx: CanvasRenderingContext2D, cx: number, baseY: number, R: number, seed: number): void {
  const rnd = mulberry32(seed);
  const bowlY = baseY - R * 1.15, bw = R * 0.95;
  groundShadow(ctx, cx, baseY, R * 1.15, R * 0.3);

  // Warm halo behind everything.
  const halo = ctx.createRadialGradient(cx, bowlY - R * 0.4, 0, cx, bowlY - R * 0.4, R * 2.4);
  halo.addColorStop(0, 'rgba(255,150,60,0.4)'); halo.addColorStop(0.55, 'rgba(255,120,40,0.14)'); halo.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = halo; ctx.fillRect(cx - R * 2.6, bowlY - R * 3, R * 5.2, R * 5);

  // Three legs meeting under the bowl.
  ctx.strokeStyle = IRON.dark; ctx.lineWidth = Math.max(2.4, R * 0.11); ctx.lineCap = 'round';
  const knot: Pt = { x: cx, y: bowlY + R * 0.5 };
  for (const dx of [-bw * 0.72, 0, bw * 0.72]) {
    ctx.beginPath(); ctx.moveTo(cx + dx, baseY); ctx.quadraticCurveTo(cx + dx * 0.4, bowlY + R * 0.8, knot.x, knot.y); ctx.stroke();
  }
  ctx.fillStyle = IRON.mid; ctx.beginPath(); ctx.arc(knot.x, knot.y, R * 0.14, 0, TAU); ctx.fill();

  // Iron bowl (shallow cup).
  const traceBowl = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - bw, bowlY);
    ctx.quadraticCurveTo(cx, bowlY + R * 0.7, cx + bw, bowlY);
    ctx.lineTo(cx + bw * 0.86, bowlY - R * 0.12);
    ctx.lineTo(cx - bw * 0.86, bowlY - R * 0.12);
    ctx.closePath();
  };
  ctx.save();
  traceBowl(); ctx.clip();
  const bg = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
  bg.addColorStop(0, IRON.light); bg.addColorStop(0.5, IRON.mid); bg.addColorStop(1, IRON.dark);
  ctx.fillStyle = bg; ctx.fillRect(cx - bw, bowlY - R * 0.3, bw * 2, R);
  ctx.restore();
  // Bowl rim rivets.
  ctx.fillStyle = IRON.hi;
  for (let i = 0; i < 5; i++) { const rx = cx - bw * 0.8 + (i / 4) * bw * 1.6; ctx.beginPath(); ctx.arc(rx, bowlY - R * 0.09, R * 0.045, 0, TAU); ctx.fill(); }
  traceBowl(); ctx.strokeStyle = IRON.ink; ctx.lineWidth = Math.max(1.6, R * 0.06); ctx.lineJoin = 'round'; ctx.stroke();

  // Glowing coals inside the bowl.
  for (let i = 0; i < 8; i++) {
    const rx = cx + (rnd() - 0.5) * bw * 1.3, ry = bowlY - R * 0.08 + (rnd() - 0.5) * R * 0.12, s = R * (0.06 + rnd() * 0.07);
    ctx.fillStyle = rnd() > 0.4 ? '#ff7a2a' : '#ffcf4a';
    ctx.beginPath(); ctx.ellipse(rx, ry, s, s * 0.7, 0, 0, TAU); ctx.fill();
  }

  // Seeded flame: layered tongues with a bulged base, concave flanks, and a
  // curling tip — organic rather than a rigid cone. Hot core sits innermost.
  const flameH = R * (1.2 + rnd() * 0.4), flameW = bw * 0.7, fx = cx + (rnd() - 0.5) * R * 0.12;
  const flame = (scale: number, color: string, lean: number): void => {
    const w = flameW * scale, base = bowlY - R * 0.05, fh = flameH * scale;
    const tipX = fx + lean, tipY = base - fh;
    ctx.beginPath();
    ctx.moveTo(fx - w, base);
    // Left flank bulges out low, then curves inward to the leaning tip.
    ctx.bezierCurveTo(fx - w * 1.18, base - fh * 0.34, fx - w * 0.42 + lean * 0.6, base - fh * 0.66, tipX, tipY);
    // Right flank mirrors back down to the base.
    ctx.bezierCurveTo(fx + w * 0.42 + lean * 0.6, base - fh * 0.66, fx + w * 1.18, base - fh * 0.34, fx + w, base);
    ctx.quadraticCurveTo(fx, base + R * 0.07, fx - w, base);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  flame(1, 'rgba(255,120,32,0.92)', (rnd() - 0.5) * R * 0.24);
  flame(0.6, 'rgba(255,196,64,0.95)', (rnd() - 0.5) * R * 0.18);
  flame(0.28, 'rgba(255,244,196,0.95)', (rnd() - 0.5) * R * 0.12);

  // Rising embers.
  ctx.fillStyle = 'rgba(255,196,96,0.85)';
  for (let i = 0; i < 5; i++) {
    const ex = fx + (rnd() - 0.5) * bw, ey = bowlY - flameH * (0.5 + rnd() * 0.7);
    ctx.beginPath(); ctx.arc(ex, ey, R * (0.02 + rnd() * 0.02), 0, TAU); ctx.fill();
  }
}

// ---------------------------------------------------------------- sheet ---
/** Draw the full dungeon showcase sheet at logical size W×H, seeded. */
export function drawDungeonSheet(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number): void {
  const bgg = ctx.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H * 0.5, W * 0.75);
  bgg.addColorStop(0, '#33323a'); bgg.addColorStop(1, '#1c1b20');
  ctx.fillStyle = bgg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 74) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 74) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0.1)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#e8e2f0'; ctx.font = '600 30px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('Dungeon asset set', W / 2, 44);
  ctx.font = 'italic 16px Georgia, serif'; ctx.fillStyle = '#b9b2c8';
  ctx.fillText('one owned style · drawn from code, seeded · light upper-left, ink outlines throughout', W / 2, 70);
  ctx.textAlign = 'left'; ctx.font = '600 14px Georgia, serif'; ctx.fillStyle = '#cfc8de';
  ctx.fillText('FLAGSTONE SLABS', 60, 118);
  ctx.fillText('PILLARS · DOORS', 60, 330);
  ctx.fillText('CRATES · CHESTS', 60, 660);
  ctx.fillText('BRAZIERS (lit)', 60, BRAZIER_LABEL_Y);

  const xs = [150, 340, 530, 720, 910, 1100, 1290];
  let sd = seed;

  // Row 1 — flagstone slabs.
  for (let i = 0; i < xs.length; i++) drawFlagstone(ctx, xs[i], 195, 52 + ((sd * 7) % 4) * 8, sd++);

  // Row 2 — pillars (cols 0–3) and doors (cols 4–6), standing on baseY 590.
  for (let i = 0; i < 4; i++) drawPillar(ctx, xs[i], 590, 240 + ((sd * 5) % 4) * 14, sd++);
  for (let i = 4; i < xs.length; i++) drawDoor(ctx, xs[i], 590, 226 + ((sd * 3) % 3) * 12, sd++);

  // Row 3 — crates (cols 0–3) and chests (cols 4–6), standing on baseY 800.
  for (let i = 0; i < 4; i++) drawCrate(ctx, xs[i], 800, 120 + ((sd * 11) % 4) * 12, sd++);
  for (let i = 4; i < xs.length; i++) drawChest(ctx, xs[i], 800, 110 + ((sd * 7) % 3) * 12, sd++);

  // Row 4 — lit braziers.
  // The lower baseline creates a clear label gutter even for the tallest
  // seeded flame and ember combination.
  for (let i = 0; i < xs.length; i++) drawBrazier(ctx, xs[i], BRAZIER_BASE_Y, 58 + ((sd * 5) % 3) * 6, sd++);
}
