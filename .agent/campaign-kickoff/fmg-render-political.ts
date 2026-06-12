/** Political map render — visual proof for the FMG civilization port (2c). */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFmgWorld } from '../../src/systems/worldforge/fmg/generateWorld';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 960, H = 540;
const world = generateFmgWorld('world-42', { width: W, height: H, cellsDesired: 10000, template: 'continents' }) as any;
const pack = world.pack;
const verts = pack.vertices.p as Array<[number, number]>;
const cellsN = pack.cells.h.length;

const polys: Array<{ pts: number[]; fill: string }> = [];
for (let i = 0; i < cellsN; i++) {
  const vIds: number[] = pack.cells.v[i]; if (!vIds || vIds.length < 3) continue;
  const h = pack.cells.h[i];
  let fill: string;
  if (h < 20) { const t = h / 20; fill = `rgb(${15+40*t|0},${55+70*t|0},${115+75*t|0})`; }
  else {
    const st = pack.cells.state ? pack.cells.state[i] : 0;
    fill = st > 0 && pack.states[st]?.color ? pack.states[st].color : '#d8d0b8';
  }
  const pts: number[] = [];
  for (const v of vIds) { const p = verts[v]; if (p) pts.push(p[0], p[1]); }
  polys.push({ pts, fill });
}
const routes = (pack.routes ?? []).map((r: any) => {
  const pts: number[] = [];
  for (const c of (r.cells ?? [])) { const p = pack.cells.p[c]; if (p) pts.push(p[0], p[1]); }
  return { pts, kind: r.group ?? 'road' };
}).filter((r: any) => r.pts.length >= 4);
const burgs = pack.burgs.filter((b: any) => b && b.i).map((b: any) => ({ x: b.x, y: b.y, cap: !!b.capital, name: b.name }));
const labels = pack.states.filter((s: any) => s.i > 0 && s.center).map((s: any) => ({
  name: s.name, x: pack.cells.p[s.center][0], y: pack.cells.p[s.center][1],
}));
console.log('political:', { polys: polys.length, routes: routes.length, burgs: burgs.length, labels: labels.length });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<canvas id="c" width="${W}" height="${H}"></canvas>`);
await page.evaluate(({ polys, routes, burgs, labels, w, h }) => {
  const ctx = (document.getElementById('c') as HTMLCanvasElement).getContext('2d')!;
  ctx.fillStyle = '#0e2d52'; ctx.fillRect(0, 0, w, h);
  for (const p of polys) {
    ctx.beginPath(); ctx.moveTo(p.pts[0], p.pts[1]);
    for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i], p.pts[i+1]);
    ctx.closePath(); ctx.fillStyle = p.fill; ctx.globalAlpha = 0.9; ctx.fill();
  }
  ctx.globalAlpha = 0.65; ctx.lineCap = 'round';
  for (const r of routes) {
    ctx.strokeStyle = r.kind === 'searoutes' ? '#9bc4e8' : '#7a5a30';
    ctx.setLineDash(r.kind === 'searoutes' ? [4, 4] : []);
    ctx.lineWidth = r.kind === 'roads' ? 1.2 : 0.6;
    ctx.beginPath(); ctx.moveTo(r.pts[0], r.pts[1]);
    for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i+1]);
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  for (const b of burgs) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.cap ? 3 : 1.2, 0, Math.PI * 2);
    ctx.fillStyle = b.cap ? '#fff' : '#2a2a2a'; ctx.fill();
    if (b.cap) { ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8; ctx.stroke(); }
  }
  ctx.font = 'bold 13px Georgia'; ctx.textAlign = 'center';
  for (const l of labels) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.strokeText(l.name, l.x, l.y);
    ctx.fillStyle = '#1a1a1a'; ctx.fillText(l.name, l.x, l.y);
  }
}, { polys, routes, burgs, labels, w: W, h: H });
await page.locator('#c').screenshot({ path: path.join(__dirname, 'fmg-political-1.png') });
console.log('wrote fmg-political-1.png');
await browser.close();
