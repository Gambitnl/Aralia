import { getBridgeAtlas, getWorldforgeLocalForLocation } from '../../src/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../src/systems/worldforge/bridge/groundChunkLoader';
const atlas = getBridgeAtlas(42);
const c: any = atlas.pack.cells;
let found = 0;
for (let i = 0; i < c.h.length && found < 4; i++) {
  if (!c.burg || !c.burg[i] || c.h[i] < 20) continue;
  const p = c.p[i];
  const lx = Math.max(0, Math.min(24, Math.round((p[0] / 960) * 25 - 0.5)));
  const ly = Math.max(0, Math.min(15, Math.round((p[1] / 540) * 16 - 0.5)));
  const r = getWorldforgeLocalForLocation(42, lx, ly, 25, 16);
  if (r.anchorCellId !== i) continue;
  const g = makeGroundWorld(r.local, 42, r.region);
  if (g.towns.length > 0) {
    console.log('TOWN WINDOW: tile', lx, ly, '| anchor', i, '| towns:', g.towns.length, '| rivers:', g.rivers.length, '| townCenter m:', g.towns[0].xM.toFixed(0), g.towns[0].zM.toFixed(0), '| half m:', g.towns[0].halfM.toFixed(0));
    found++;
  }
}
if (!found) console.log('no town windows found');
