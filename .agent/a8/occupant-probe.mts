import { getWorldforgeLocalForLocation } from '../../src/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../src/systems/worldforge/bridge/groundChunkLoader';

const CLOTHING = new Set(['#6e4a3a', '#4a5e6e', '#5e6e4a', '#7a6a4a', '#6a4a6e']);
const b = getWorldforgeLocalForLocation(42, 16, 4, 25, 16);
for (const hour of [12, 22]) {
  const g = makeGroundWorld(b.local, 42, b.region, { hour });
  const figs = (bld: { parts: Array<{ colorHex: string }> }) =>
    bld.parts.filter((p) => CLOTHING.has(p.colorHex)).length;
  const market = g.buildings.filter((x) => x.role === 'market');
  const marketFigs = market.reduce((a, m) => a + figs(m), 0);
  const totalFigs = g.buildings.reduce((a, x) => a + figs(x), 0);
  console.log(`hour=${hour}: market figures=${marketFigs}, total figures=${totalFigs}, roster=${g.rosters[0]?.occupants.length ?? 0}`);
}
