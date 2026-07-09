/**
 * @file caveForge.ts
 * The cave asset set for the procedural asset forge: ore rocks, crystal-ore
 * nodes, chunky faceted crystal clusters, stalagmites, and glowing mushrooms.
 * One owned stylized language — light from the upper-left, a bold ink outline
 * on every silhouette. All seeded, so a given seed always draws the same set.
 *
 * These are pure canvas drawers (ctx + position + size + seed). The design
 * preview showcases them; the same functions can later feed the battle-map
 * painter as the cave biome's real props.
 */
import { TAU, mulberry32, mid, poly, type Pt } from './forgePrimitives';

// ---------------------------------------------------------------- ore rock ---
function goldFacet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rnd: () => number): void {
  const rot = rnd() * TAU;
  const P = (a: number, d: number): Pt => ({ x: x + Math.cos(a + rot) * d, y: y + Math.sin(a + rot) * d });
  const a = P(0, r), b = P(1.9, r * 0.8), c = P(3.3, r), d = P(4.9, r * 0.85);
  poly(ctx, [a, b, c], '#b07d16');
  poly(ctx, [a, c, d], '#ffd44d');
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
  ctx.strokeStyle = 'rgba(50,32,0,0.75)'; ctx.lineWidth = Math.max(1, r * 0.14); ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,235,0.9)'; ctx.beginPath(); ctx.arc(d.x, d.y, r * 0.16, 0, TAU); ctx.fill();
}

export function drawRock(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, gold = true): number {
  const rnd = mulberry32(seed);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(cx + R * 0.16, cy + R * 0.34, R * 1.02, R * 0.6, 0, 0, TAU); ctx.fill();
  const N = 14, base = R * (0.76 + rnd() * 0.12), ph = rnd() * TAU, pts: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const r = base * (1 + 0.17 * Math.sin(3 * a + ph) + 0.09 * Math.sin(7 * a + ph * 1.7) + (rnd() - 0.5) * 0.13);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.9 });
  }
  const trace = (): void => {
    ctx.beginPath();
    const m0 = mid(pts[N - 1], pts[0]);
    ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < N; i++) { const cur = pts[i], nx = pts[(i + 1) % N], m = mid(cur, nx); ctx.quadraticCurveTo(cur.x, cur.y, m.x, m.y); }
    ctx.closePath();
  };
  ctx.save(); trace(); ctx.clip();
  const g = ctx.createLinearGradient(cx - R * 0.6, cy - R, cx + R * 0.5, cy + R);
  g.addColorStop(0, '#9195a0'); g.addColorStop(0.5, '#6a6f79'); g.addColorStop(1, '#3f434c');
  ctx.fillStyle = g; ctx.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * TAU, rr = rnd() * base * 0.92, px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.9, s = R * (0.05 + rnd() * 0.13);
    ctx.fillStyle = rnd() > 0.5 ? `rgba(185,190,200,${0.05 + rnd() * 0.1})` : `rgba(18,20,26,${0.07 + rnd() * 0.12})`;
    ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.7, rnd() * TAU, 0, TAU); ctx.fill();
  }
  const hg = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.4, 0, cx - R * 0.32, cy - R * 0.4, R * 0.85);
  hg.addColorStop(0, 'rgba(225,230,240,0.32)'); hg.addColorStop(1, 'rgba(225,230,240,0)');
  ctx.fillStyle = hg; ctx.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
  const bg = ctx.createLinearGradient(cx, cy + base * 0.2, cx, cy + base);
  bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = bg; ctx.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
  ctx.strokeStyle = 'rgba(14,15,19,0.5)'; ctx.lineWidth = Math.max(1, R * 0.022); ctx.lineCap = 'round';
  const cr = 1 + Math.floor(rnd() * 2);
  for (let c = 0; c < cr; c++) {
    let a = rnd() * TAU, px = cx + Math.cos(a) * base * 0.15, py = cy + Math.sin(a) * base * 0.15;
    ctx.beginPath(); ctx.moveTo(px, py);
    const sg = 2 + Math.floor(rnd() * 3);
    for (let s = 0; s < sg; s++) { a += (rnd() - 0.5) * 1.3; const l = base * (0.14 + rnd() * 0.2); px += Math.cos(a) * l; py += Math.sin(a) * l * 0.9; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  if (gold && rnd() > 0.4) {
    const v = 3 + Math.floor(rnd() * 5);
    for (let i = 0; i < v; i++) { const a = rnd() * TAU, rr = rnd() * base * 0.7; goldFacet(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, R * (0.05 + rnd() * 0.06), rnd); }
  }
  ctx.restore();
  trace(); ctx.lineJoin = 'round'; ctx.strokeStyle = '#15161d'; ctx.lineWidth = Math.max(1.5, R * 0.06); ctx.stroke();
  return base;
}

// -------------------------------------------------- chunky faceted crystal ---
export interface CrystalPalette { glow: string; hi: string; light: string; mid: string; dark: string; darker: string; ink: string; }
export const CRYSTAL_BLUE: CrystalPalette = { glow: '#3fb6e0', hi: '#c9f2fc', light: '#7fd6ef', mid: '#3f9fc8', dark: '#236f9e', darker: '#164f78', ink: '#0a2f4a' };
export const CRYSTAL_PURPLE: CrystalPalette = { glow: '#a45fd8', hi: '#ecccf7', light: '#c78fe8', mid: '#9a5fce', dark: '#6a37a0', darker: '#48217a', ink: '#280a48' };

function shard(ctx: CanvasRenderingContext2D, bx: number, by: number, ang: number, len: number, w: number, pal: CrystalPalette): void {
  const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca;
  const P = (t: number, s: number): Pt => ({ x: bx + ca * t + px * s, y: by + sa * t + py * s });
  const A = P(0, w), B = P(0, -w), sh = len * 0.66, E = P(sh, w * 0.9), C = P(sh, -w * 0.9), D = P(len, 0), rb = P(0, 0), rs = P(sh, 0);
  poly(ctx, [A, E, rs, rb], pal.light);
  poly(ctx, [B, C, rs, rb], pal.dark);
  poly(ctx, [E, D, rs], pal.mid);
  poly(ctx, [C, D, rs], pal.darker);
  ctx.strokeStyle = pal.mid; ctx.lineWidth = Math.max(1, w * 0.1);
  ctx.beginPath(); ctx.moveTo(rb.x, rb.y); ctx.lineTo(rs.x, rs.y); ctx.lineTo(D.x, D.y); ctx.stroke();
  ctx.strokeStyle = pal.hi; ctx.lineWidth = Math.max(1, w * 0.13); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(E.x, E.y); ctx.lineTo(D.x, D.y); ctx.stroke();
  ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1.4, w * 0.2); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(E.x, E.y); ctx.lineTo(D.x, D.y); ctx.lineTo(C.x, C.y); ctx.lineTo(B.x, B.y); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(D.x, D.y, Math.max(1.5, w * 0.16), 0, TAU); ctx.fill();
}

export function drawCrystal(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, pal: CrystalPalette): void {
  const rnd = mulberry32(seed);
  const halo = ctx.createRadialGradient(cx, cy - R * 0.3, 0, cx, cy - R * 0.3, R * 1.8);
  halo.addColorStop(0, pal.glow + '70'); halo.addColorStop(0.6, pal.glow + '22'); halo.addColorStop(1, pal.glow + '00');
  ctx.fillStyle = halo; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
  ctx.fillStyle = '#241f2e'; ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.32, R * 0.68, R * 0.24, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#120f1a'; ctx.lineWidth = Math.max(1.2, R * 0.03); ctx.stroke();
  const n = 3 + Math.floor(rnd() * 3), arr: { s: number; len: number; w: number; bx: number; by: number }[] = [];
  for (let i = 0; i < n; i++) arr.push({ s: (-0.5 + i / Math.max(1, n - 1)) * 1.3 + (rnd() - 0.5) * 0.3, len: R * (0.8 + rnd() * 0.6), w: R * (0.2 + rnd() * 0.1), bx: cx + (rnd() - 0.5) * R * 0.5, by: cy + R * 0.18 + (rnd() - 0.5) * R * 0.08 });
  arr.sort((a, b) => a.len - b.len);
  for (const s of arr) shard(ctx, s.bx, s.by, -Math.PI / 2 + s.s, s.len, s.w, pal);
  for (let i = 0; i < 2; i++) shard(ctx, cx + (rnd() - 0.5) * R * 1.1, cy + R * 0.25, -Math.PI / 2 + (rnd() - 0.5) * 0.8, R * (0.3 + rnd() * 0.2), R * 0.11, pal);
}

// ------------------------------------------------------------- stalagmite ---
export function drawStalagmite(ctx: CanvasRenderingContext2D, cx: number, cy: number, Hh: number, seed: number): void {
  const rnd = mulberry32(seed), w = Hh * (0.3 + rnd() * 0.08), lean = (rnd() - 0.5) * Hh * 0.14;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx + w * 0.3, cy + w * 0.16, w * 1.3, w * 0.5, 0, 0, TAU); ctx.fill();
  // Irregular per-side silhouette (a few kinked control points) so it reads as
  // a rough stone spire, not a smooth traffic cone.
  const jitterR = (): number => (rnd() - 0.5);
  const apex = { x: cx + lean, y: cy - Hh };
  const bl = { x: cx - w, y: cy }, br = { x: cx + w, y: cy };
  const lc1 = { x: cx - w * (0.85 + jitterR() * 0.25), y: cy - Hh * 0.35 };
  const lc2 = { x: cx - w * (0.42 + jitterR() * 0.22), y: cy - Hh * 0.68 };
  const rc1 = { x: cx + w * (0.85 + jitterR() * 0.25), y: cy - Hh * 0.32 };
  const rc2 = { x: cx + w * (0.44 + jitterR() * 0.22), y: cy - Hh * 0.66 };
  const trace = (): void => {
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y);
    ctx.lineTo(lc1.x, lc1.y); ctx.lineTo(lc2.x, lc2.y); ctx.lineTo(apex.x - w * 0.05, apex.y);
    ctx.lineTo(apex.x + w * 0.05, apex.y);
    ctx.lineTo(rc2.x, rc2.y); ctx.lineTo(rc1.x, rc1.y);
    ctx.closePath();
  };
  ctx.save(); trace(); ctx.clip();
  const g = ctx.createLinearGradient(cx - w, cy - Hh, cx + w, cy);
  g.addColorStop(0, '#8a7f74'); g.addColorStop(0.5, '#5f564f'); g.addColorStop(1, '#332e2b');
  ctx.fillStyle = g; ctx.fillRect(cx - w * 2, cy - Hh * 1.2, w * 4, Hh * 1.4);
  const rg = ctx.createLinearGradient(cx, 0, cx + w, 0);
  rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = rg; ctx.fillRect(cx, cy - Hh * 1.2, w * 2, Hh * 1.4);
  // rocky mottle + drip banding
  for (let i = 0; i < 24; i++) {
    const yy = cy - rnd() * Hh, xw = w * (1 - (cy - yy) / Hh) * 0.9, xx = cx + (rnd() - 0.5) * xw * 1.6, s = w * (0.06 + rnd() * 0.1);
    ctx.fillStyle = rnd() > 0.5 ? `rgba(180,168,150,${0.05 + rnd() * 0.08})` : `rgba(15,12,10,${0.06 + rnd() * 0.1})`;
    ctx.beginPath(); ctx.ellipse(xx, yy, s, s * 0.7, 0, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,16,14,0.25)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i++) { const yy = cy - Hh * (i / 5), ww = w * (1 - i / 5) * 0.9; ctx.beginPath(); ctx.moveTo(cx - ww, yy); ctx.quadraticCurveTo(cx, yy + ww * 0.2, cx + ww, yy); ctx.stroke(); }
  const hg = ctx.createLinearGradient(cx - w, 0, cx, 0);
  hg.addColorStop(0, 'rgba(210,200,190,0.32)'); hg.addColorStop(1, 'rgba(210,200,190,0)');
  ctx.fillStyle = hg; ctx.fillRect(cx - w, cy - Hh * 1.2, w, Hh * 1.4);
  ctx.restore();
  trace(); ctx.strokeStyle = '#1a1512'; ctx.lineWidth = Math.max(1.6, w * 0.13); ctx.lineJoin = 'round'; ctx.stroke();
}

// ------------------------------------------------ glowing mushroom cluster ---
export function drawGlowMushroom(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, glow: string): void {
  const rnd = mulberry32(seed);
  const halo = ctx.createRadialGradient(cx, cy - R * 0.5, 0, cx, cy - R * 0.5, R * 1.9);
  halo.addColorStop(0, glow + '44'); halo.addColorStop(1, glow + '00');
  ctx.fillStyle = halo; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
  ctx.fillStyle = 'rgba(18,22,20,0.6)'; ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.22, R * 0.6, R * 0.2, 0, 0, TAU); ctx.fill();
  const n = 2 + Math.floor(rnd() * 3), caps: { x: number; h: number; cw: number }[] = [];
  for (let i = 0; i < n; i++) caps.push({ x: cx + (rnd() - 0.5) * R * 1.1, h: R * (0.5 + rnd() * 0.7), cw: R * (0.26 + rnd() * 0.16) });
  caps.sort((a, b) => a.h - b.h);
  for (const m of caps) {
    const st = cy - m.h;
    ctx.strokeStyle = '#dccfb6'; ctx.lineWidth = m.cw * 0.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m.x, cy + R * 0.08); ctx.quadraticCurveTo(m.x + (m.x - cx) * 0.12, cy - m.h * 0.5, m.x, st); ctx.stroke();
    const cg = ctx.createRadialGradient(m.x, st, 0, m.x, st, m.cw * 2.4);
    cg.addColorStop(0, glow + '99'); cg.addColorStop(1, glow + '00');
    ctx.fillStyle = cg; ctx.fillRect(m.x - m.cw * 2.6, st - m.cw * 2.6, m.cw * 5.2, m.cw * 5.2);
    const capPath = (): void => { ctx.beginPath(); ctx.moveTo(m.x - m.cw, st); ctx.quadraticCurveTo(m.x - m.cw, st - m.cw * 1.35, m.x, st - m.cw * 1.35); ctx.quadraticCurveTo(m.x + m.cw, st - m.cw * 1.35, m.x + m.cw, st); ctx.closePath(); };
    capPath(); ctx.fillStyle = glow; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(m.x, st, m.cw, m.cw * 0.2, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(m.x - m.cw * 0.3, st - m.cw * 0.72, m.cw * 0.3, m.cw * 0.2, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let s = 0; s < 3; s++) { ctx.beginPath(); ctx.arc(m.x + (rnd() - 0.5) * m.cw * 1.1, st - m.cw * 0.45 - rnd() * m.cw * 0.4, m.cw * 0.09, 0, TAU); ctx.fill(); }
    capPath(); ctx.strokeStyle = 'rgba(10,20,18,0.6)'; ctx.lineWidth = Math.max(1.2, m.cw * 0.11); ctx.lineJoin = 'round'; ctx.stroke();
  }
}

// ------------------------------------------------------ crystal-ore node ---
export function drawGemNode(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, pal: CrystalPalette): void {
  const base = drawRock(ctx, cx, cy, R, seed, false);
  const rnd = mulberry32(seed * 3 + 7);
  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const bx = cx + (rnd() - 0.5) * base * 0.8, by = cy + (rnd() - 0.3) * base * 0.4;
    shard(ctx, bx, by, -Math.PI / 2 + (rnd() - 0.5) * 0.9, R * (0.4 + rnd() * 0.3), R * 0.13, pal);
  }
}

// ---------------------------------------------------------------- sheet ---
const GLOWS = ['#4fe0c0', '#ff9a4d', '#7fe04f', '#4fe0c0', '#ff9a4d', '#c94fe0', '#4fe0c0'];

/** Draw the full cave showcase sheet at logical size W×H, seeded. */
export function drawCaveSheet(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number): void {
  const bgg = ctx.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H * 0.5, W * 0.75);
  bgg.addColorStop(0, '#37324a'); bgg.addColorStop(1, '#1f1c2a');
  ctx.fillStyle = bgg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 74) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 74) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0.1)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#e8e2f0'; ctx.font = '600 30px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('Cave asset set', W / 2, 44);
  ctx.font = 'italic 16px Georgia, serif'; ctx.fillStyle = '#b9b2c8';
  ctx.fillText('one owned style · drawn from code, seeded · light upper-left, ink outlines throughout', W / 2, 70);
  ctx.textAlign = 'left'; ctx.font = '600 14px Georgia, serif'; ctx.fillStyle = '#cfc8de';
  ctx.fillText('ORE ROCKS + CRYSTAL-ORE NODES', 60, 118);
  ctx.fillText('CRYSTAL CLUSTERS (chunky facets)', 60, 330);
  ctx.fillText('STALAGMITES', 60, 560);
  ctx.fillText('GLOWING MUSHROOMS', 60, 800);

  const xs = [150, 340, 530, 720, 910, 1100, 1290];
  let sd = seed;
  for (let i = 0; i < xs.length; i++) {
    if (i === 2 || i === 5) drawGemNode(ctx, xs[i], 190, 58, sd++, i === 2 ? CRYSTAL_BLUE : CRYSTAL_PURPLE);
    else drawRock(ctx, xs[i], 190, 52 + ((sd * 7) % 5) * 7, sd++);
  }
  for (let i = 0; i < xs.length; i++) drawCrystal(ctx, xs[i], 400, 66 + ((sd * 5) % 4) * 7, sd++, i % 2 ? CRYSTAL_PURPLE : CRYSTAL_BLUE);
  for (let i = 0; i < xs.length; i++) drawStalagmite(ctx, xs[i], 640, 90 + ((sd * 11) % 6) * 16, sd++);
  for (let i = 0; i < xs.length; i++) drawGlowMushroom(ctx, xs[i], 900, 70, sd++, GLOWS[i]);
}
