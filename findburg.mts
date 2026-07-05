import { getBridgeAtlas } from './src/systems/worldforge/bridge/legacySubmapBridge';
import { canonicalArtifactTownForSite } from './src/systems/worldforge/bridge/groundChunkLoader';

const SEED = 596346834;
const atlas = getBridgeAtlas(SEED);
const burgs = (atlas.pack.burgs ?? []) as Array<{ i?: number; cell?: number; removed?: boolean; name?: string }>;
let found = 0;
for (const b of burgs) {
  const id = b.i ?? 0;
  if (!id || b.removed) continue;
  const site = { burgId: id, envelope: { x: 0, y: 0, width: 200, height: 200 } } as never;
  try {
    const { plan } = canonicalArtifactTownForSite(SEED, site);
    const shops = plan.plots.filter((p: any) => p.role === 'market' || p.role === 'workshop');
    if (shops.length > 0) {
      console.log(JSON.stringify({ burgId: id, cell: b.cell, name: b.name, shopPlots: shops.length }));
      if (++found >= 3) break;
    }
  } catch (e) { /* skip */ }
}
if (!found) console.log('NO SHOP BURG FOUND');
