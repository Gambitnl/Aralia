/**
 * Build a standalone interactive HTML sample of the SP0 native SVG atlas
 * (pan/zoom) into public/ so it can be opened in the preview pane. Owned
 * FMG data → buildAtlasSvgModel → inline SVG. Not a product surface; a sample.
 *
 * Usage: node scripts/worldforge/buildAtlasSvgSample.mjs
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateFmgWorld } from '../../src/systems/worldforge/fmg/generateWorld.ts';
import { buildAtlasSvgModel } from '../../src/components/Worldforge/atlasSvg.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 960, H = 540;

const atlas = generateFmgWorld('761', { width: W, height: H, cellsDesired: 10000, template: 'continents' });
const model = buildAtlasSvgModel(atlas);
const ocean = model.layers.find((l) => l.id === 'ocean').regions ?? [];
const oceanPaths = ocean.map((r) => `<path d="${r.d}" fill="${r.fill}" fill-rule="evenodd"/>`).join('');
const land = model.layers.find((l) => l.id === 'land').regions ?? [];
const paths = land.map((r) => `<path d="${r.d}" fill="${r.fill}" fill-rule="evenodd"/>`).join('');
const riverPaths = (model.rivers ?? []).map((r) => `<path d="${r.d}" fill="${r.fill}"/>`).join('');
const routePaths = (model.routes ?? []).map((rt) => {
  const s = rt.group === 'trails' ? { c: '#708090', d: '3 3', w: 0.8 }
    : rt.group === 'searoutes' ? { c: '#87cefa', d: '4 4', w: 1 }
    : { c: '#8b5a2b', d: '', w: 1.2 };
  return `<path d="${rt.d}" fill="none" stroke="${s.c}" stroke-width="${s.w}"${s.d ? ` stroke-dasharray="${s.d}"` : ''} stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
}).join('');
const burgMarks = (model.burgs ?? []).map((b) => (b.capital
  ? `<circle cx="${b.x}" cy="${b.y}" r="3.5" fill="#fff" stroke="#7a1228" stroke-width="0.8" vector-effect="non-scaling-stroke"/><circle cx="${b.x}" cy="${b.y}" r="1.6" fill="#e11d48"/>`
  : `<circle cx="${b.x}" cy="${b.y}" r="2" fill="#fff" stroke="#374151" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`)).join('');
const borderPath = model.stateBorders
  ? `<path d="${model.stateBorders}" fill="none" stroke="#2d1b38" stroke-opacity="0.7" stroke-width="1" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>` : '';
const coast = model.coastline
  ? `<path d="${model.coastline}" fill="none" stroke="#9fcdef" stroke-opacity="0.4" stroke-width="5" vector-effect="non-scaling-stroke"/>`
    + `<path d="${model.coastline}" fill="none" stroke="#1a3d66" stroke-width="1.2" vector-effect="non-scaling-stroke"/>` : '';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const stateLabels = (model.labels ?? []).filter((l) => l.kind === 'state')
  .map((l) => `<text x="${l.x}" y="${l.y}" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="700" fill="#2d1b38" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(l.text)}</text>`).join('');
const demo = (model.burgs ?? []).find((b) => b.capital) ?? (model.burgs ?? [])[0];
const markerSvg = demo
  ? `<g transform="translate(${demo.x},${demo.y})"><circle r="9" fill="none" stroke="#f5c542" stroke-width="2" vector-effect="non-scaling-stroke"/><circle r="3.5" fill="#f5c542" stroke="#5a3e00" stroke-width="1" vector-effect="non-scaling-stroke"/></g>`
  : '';
const k = Math.min(W / model.width, H / model.height);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Worldforge atlas SVG sample (SP0 iter1)</title>
<style>html,body{margin:0;height:100%;background:#0e1b2b;overflow:hidden;font-family:system-ui,sans-serif}
#hud{position:fixed;top:8px;left:8px;color:#cfe6ff;font-size:12px;background:#0009;padding:5px 9px;border-radius:6px}
svg{width:100vw;height:100vh;background:#15375d;cursor:grab;display:block}</style></head>
<body>
<div id="hud">Worldforge native SVG atlas — seed 761 — ${land.length} biome regions, ${ocean.length} depth bands (T2/T3) · scroll = zoom, drag = pan</div>
<svg id="map" viewBox="0 0 ${model.width} ${model.height}"><defs><filter id="atlas-soften" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1"/></filter></defs><g id="vp"><rect width="${model.width}" height="${model.height}" fill="#1f4a73"/>${oceanPaths}<g filter="url(#atlas-soften)">${paths}</g>${riverPaths}${borderPath}${routePaths}${coast}${burgMarks}${stateLabels}${markerSvg}</g></svg>
<script>
var vp=document.getElementById('vp'),svg=document.getElementById('map');
var s=1,x=0,y=0,drag=null;
function apply(){vp.setAttribute('transform','translate('+x+','+y+') scale('+s+')');}
svg.addEventListener('wheel',function(e){e.preventDefault();var f=e.deltaY<0?1.1:1/1.1;s=Math.max(0.1,Math.min(64,s*f));apply();},{passive:false});
svg.addEventListener('mousedown',function(e){drag={x:e.clientX-x,y:e.clientY-y};svg.style.cursor='grabbing';});
window.addEventListener('mousemove',function(e){if(!drag)return;x=e.clientX-drag.x;y=e.clientY-drag.y;apply();});
window.addEventListener('mouseup',function(){drag=null;svg.style.cursor='grab';});
</script></body></html>`;

const out = path.join(__dirname, '../../public/wf-atlas-sample.html');
fs.writeFileSync(out, html);
console.log('wrote', out, '-', land.length, 'merged biome regions, graph', model.width + 'x' + model.height, 'fit', k.toFixed(3));
