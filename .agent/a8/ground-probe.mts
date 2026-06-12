import { getWorldforgeLocalForLocation } from '../../src/systems/worldforge/bridge/legacySubmapBridge';
import { createGroundChunkLoader } from '../../src/systems/worldforge/bridge/groundChunkLoader';
const r = getWorldforgeLocalForLocation(42, 16, 4, 25, 16);
const { ground, loader } = createGroundChunkLoader(r.local, 42, r.region);
console.log('extent:', ground.extentMetersX.toFixed(1) + 'm x', ground.extentMetersZ.toFixed(1) + 'm');
const b = await loader(3, 3);
console.log('bundle keys:', Object.keys(b).join(','));
const t = (b as any).terrain ?? b;
let ymin = 1e9, ymax = -1e9;
for (let i = 1; i < t.positions.length; i += 3) { const y = t.positions[i]; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
console.log('chunk(3,3) Y range:', ymin.toFixed(2), '..', ymax.toFixed(2), 'm | verts:', t.positions.length / 3);


// vegetation check: artifact features inside chunk (3,3)
const v = (b as any).vegetation;
console.log('vegetation instances chunk(3,3):', v ? v.positions.length / 3 : 0);

// ribbon mechanism check across all chunks
let riverChunks = 0, roadChunks = 0;
for (let cx = 0; cx < 8; cx++) for (let cy = 0; cy < 8; cy++) {
  const bb: any = await loader(cx, cy);
  if (bb.water) riverChunks++;
  if (bb.roads) roadChunks++;
}
console.log('chunks with water ribbons:', riverChunks, '| with road ribbons:', roadChunks);

let siteChunks = 0; let siteIds: string[] = [];
for (let cx = 0; cx < 8; cx++) for (let cy = 0; cy < 8; cy++) {
  const bb: any = await loader(cx, cy);
  if (bb.sites && bb.sites.length) { siteChunks++; siteIds.push(...bb.sites.map((s: any) => s.id + '@' + cx + ',' + cy + ' y=' + s.surfaceY.toFixed(1))); }
}
console.log('chunks with sites:', siteChunks, '|', siteIds.join(' '));

