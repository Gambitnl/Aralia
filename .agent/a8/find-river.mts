import { getBridgeAtlas, getWorldforgeLocalForLocation } from '../../src/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../src/systems/worldforge/bridge/groundChunkLoader';
const atlas = getBridgeAtlas(42);
const c: any = atlas.pack.cells;
let found = 0;
for (let i = 0; i < c.h.length && found < 6; i++) {
  if (c.h[i] < 22 || !c.r || !c.r[i]) continue;
  const p = c.p[i];
  const lx = Math.max(0, Math.min(24, Math.round((p[0] / 960) * 25 - 0.5)));
  const ly = Math.max(0, Math.min(15, Math.round((p[1] / 540) * 16 - 0.5)));
  const r = getWorldforgeLocalForLocation(42, lx, ly, 25, 16);
  if (r.anchorCellId !== i) continue; // mapping landed elsewhere
  const g = makeGroundWorld(r.local, 42, r.region);
  if (g.rivers.length > 0) {
    console.log('RIVER LOCATION: legacy tile', lx, ly, '| anchor', i, '| ground rivers:', g.rivers.length, '| roads:', g.roads.length, '| towns:', r.region.townSites.length);
    found++;
  }
}
if (!found) console.log('no river windows found in scan');
