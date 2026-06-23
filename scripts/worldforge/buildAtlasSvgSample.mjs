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
import { generateFmgAtlas } from '../../src/systems/worldforge/fmg/generateAtlas.ts';
import { buildAtlasSvgModel } from '../../src/components/Worldforge/atlasSvg.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 960, H = 540;

const atlas = generateFmgAtlas('world-761', { width: W, height: H, cellsDesired: 10000, template: 'continents' });
const model = buildAtlasSvgModel(atlas);
const land = model.layers.find((l) => l.id === 'land').polygons;
const polys = land.map((p) => `<polygon points="${p.points}" fill="${p.fill}"/>`).join('');
const k = Math.min(W / model.width, H / model.height);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Worldforge atlas SVG sample (SP0 iter1)</title>
<style>html,body{margin:0;height:100%;background:#0e1b2b;overflow:hidden;font-family:system-ui,sans-serif}
#hud{position:fixed;top:8px;left:8px;color:#cfe6ff;font-size:12px;background:#0009;padding:5px 9px;border-radius:6px}
svg{width:100vw;height:100vh;background:#15375d;cursor:grab;display:block}</style></head>
<body>
<div id="hud">Worldforge native SVG atlas — seed 761 — ${land.length} land cells · scroll = zoom, drag = pan</div>
<svg id="map" viewBox="0 0 ${model.width} ${model.height}"><g id="vp"><rect width="${model.width}" height="${model.height}" fill="#3d6ea4"/>${polys}</g></svg>
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
console.log('wrote', out, '-', land.length, 'land polygons, graph', model.width + 'x' + model.height, 'fit', k.toFixed(3));
