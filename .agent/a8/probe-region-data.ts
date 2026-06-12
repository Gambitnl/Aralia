/**
 * A8 probe — is the demo-path RegionArtifact degenerate (flat samples) or
 * healthy (component must be at fault)? Mirrors AtlasDemo's exact descend
 * call: feetPerPixel = FEET_PER_FMG_PIXEL (9842.52), resolutionFt = 100.
 */
import { generateFmgAtlas } from '../../src/systems/worldforge/fmg/generateAtlas';
import { generateRegion, expandRegionMembership } from '../../src/systems/worldforge/region/generateRegion';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath';
import { FEET_PER_FMG_PIXEL } from '../../src/systems/worldforge/adapter/atlasArtifact';

const atlas = generateFmgAtlas('world-42', {
  width: 960, height: 540, cellsDesired: 10000, template: 'continents',
});
const { pack } = atlas;

// first land cell with a river (same shape of anchor the demo click would hit)
let anchor = -1;
for (let i = 0; i < pack.cells.h.length; i++) {
  if (pack.cells.h[i] >= 20) { anchor = i; break; }
}
console.log('anchor cell:', anchor, 'h:', pack.cells.h[anchor]);

for (const fpp of [FEET_PER_FMG_PIXEL, 1000]) {
  const members = expandRegionMembership(pack.cells.c, anchor, pack.cells.p, fpp);
  const region = generateRegion(atlas, anchor, rootSeedPath(42), {
    feetPerPixel: fpp,
    resolutionFt: 100,
  });
  const s = region.heightfield.samples;
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] < min) min = s[i];
    if (s[i] > max) max = s[i];
    sum += s[i];
  }
  console.log(`\nfeetPerPixel=${fpp}`);
  console.log('  members:', members.length);
  console.log('  bounds:', Math.round(region.bounds.width), 'x', Math.round(region.bounds.height), 'ft @', region.bounds.x.toFixed(0), ',', region.bounds.y.toFixed(0));
  console.log('  grid:', region.heightfield.width, 'x', region.heightfield.height, 'res', region.heightfield.resolutionFt);
  console.log('  samples min/max/mean:', min.toFixed(4), max.toFixed(4), (sum / s.length).toFixed(4), 'range:', (max - min).toFixed(6));
  console.log('  rivers:', region.rivers.length, 'towns:', region.townSites.length, 'roads:', region.roads.length);
}
