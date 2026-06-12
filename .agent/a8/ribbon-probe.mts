import { getWorldforgeLocalForLocation } from '../../src/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../src/systems/worldforge/bridge/groundChunkLoader';
const r = getWorldforgeLocalForLocation(42, 12, 8, 25, 16);
console.log('region rivers:', r.region.rivers.length, '| region roads:', r.region.roads.length);
const g = makeGroundWorld(r.local, 42, r.region);
console.log('ground rivers:', g.rivers.length, '| ground roads:', g.roads.length);
if (r.region.rivers.length) {
  const riv = r.region.rivers[0];
  console.log('river[0] pts:', riv.centerline.length, 'first:', JSON.stringify(riv.centerline[0]), 'local bounds:', JSON.stringify(r.local.bounds));
}
