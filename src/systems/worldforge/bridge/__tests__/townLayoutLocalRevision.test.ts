/** Local artifacts and restored Atlas addresses must use the selected town.
 * These pure reconstruction checks do not qualify saved people or body support. */
import {describe,it,expect} from 'vitest';
import {getBridgeAtlas,getWorldforgeLocalForCell,canonicalTownSiteForLocal} from '../legacySubmapBridge';
import {canonicalArtifactTownForSiteFromAtlas} from '../../town/canonicalTown';
import {findCellAtPoint} from '../../../../components/Worldforge/atlasSvg';
import {generateRegion} from '../../region/generateRegion';
import {generateLocal} from '../../local/generateLocal';
import {rootSeedPath} from '../../seedPath';
import {FEET_PER_FMG_PIXEL} from '../../adapter/atlasArtifact';
import {groundFocusesForLocal,buildAtlasGroundDrilldown,atlasGroundAddressFromDrilldown} from '../../leaf3d/atlasGroundDrilldown';
import {restoreAtlasGroundDrilldown} from '../../leaf3d/atlasGroundRestore';

describe('selected layout in Local source readers',()=>{
 it('separates earlier/current Local caches while retaining the default current identity',()=>{
  const seed=1793432134128,atlas=getBridgeAtlas(seed);
  const burg=atlas.pack.burgs![188] as {x:number;y:number};
  const cell=findCellAtPoint(atlas as never,burg.x,burg.y),centerPx:[number,number]=[burg.x,burg.y];
  const current=getWorldforgeLocalForCell(seed,cell,{centerPx});
  const townLayouts={188:{layoutRevision:1 as const}},before=JSON.stringify(townLayouts);
  const earlier=getWorldforgeLocalForCell(seed,cell,{centerPx,townLayouts});
  const site=canonicalTownSiteForLocal(earlier.region,earlier.local)!;
  expect(site.burgId).toBe(188);
  expect(earlier.local.townPlan).toEqual(canonicalArtifactTownForSiteFromAtlas(atlas,seed,site,1).plan);
  expect(earlier.local.townPlan!.plots).toHaveLength(67);
  expect(current.local.townPlan!.plots.length).toBeGreaterThan(67);
  expect(earlier.local).not.toBe(current.local);
  expect(getWorldforgeLocalForCell(seed,cell,{centerPx,townLayouts}).local).toBe(earlier.local);
  expect(getWorldforgeLocalForCell(seed,cell,{centerPx,townLayouts:{188:{layoutRevision:2}}}).local).toBe(current.local);
  expect(JSON.stringify(townLayouts)).toBe(before);
 },60000);

 it('restores a serialized earlier-layout Atlas focus through that same plan',()=>{
  // Reuse the independently qualified cell-centered Arvalhana lineage. The
  // burg-centered Classic window is a different address and is not substituted.
  const worldSeed=1793176470555,atlasCellId=1567,atlas=getBridgeAtlas(worldSeed);
  const region=generateRegion(atlas,atlasCellId,rootSeedPath(worldSeed),{
   feetPerPixel:FEET_PER_FMG_PIXEL,resolutionFt:100,world:atlas,
  });
  const generated=generateLocal(region,{x:7512588.96516654,y:1931792.495045879},region.seedPath,{biomeId:12});
  const site=canonicalTownSiteForLocal(region,generated)!;
  expect(site).toBeDefined();
  const local={...generated,townPlan:canonicalArtifactTownForSiteFromAtlas(atlas,worldSeed,site,1).plan};
  const focus=groundFocusesForLocal(local).find(focus=>focus.kind==='town')!;
  expect(focus).toBeDefined();
  const receipt=buildAtlasGroundDrilldown({worldSeed,atlasCellId,region,local,focus});
  const address=JSON.parse(JSON.stringify(atlasGroundAddressFromDrilldown(receipt)));
  const restored=restoreAtlasGroundDrilldown(address,worldSeed,{[site.burgId]:{layoutRevision:1}});
  expect(restored.status).toBe('ready');
  if(restored.status!=='ready')throw new Error(restored.status==='rejected'?restored.reason:'Missing address');
  expect(restored.address).toEqual(address);
  expect(restored.drilldown.focus).toEqual(focus);
  expect(restored.drilldown.local.townPlan).toEqual(local.townPlan);
 },60000);
});
