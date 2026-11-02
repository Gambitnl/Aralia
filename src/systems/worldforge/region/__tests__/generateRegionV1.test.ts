/** Immutable recovery references and actually played coordinates. These tests
 * qualify source reconstruction, not rendered entry or campaign continuity. */
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {getBridgeAtlas,getWorldforgeLocalForCell} from '../../bridge/legacySubmapBridge';
import {makeGroundWorld,groundSurfaceY} from '../../bridge/groundChunkLoader';
import {inspectGroundWater} from '../../bridge/groundWaterSurfaceQuery';
import {generateRegionFromSource,requireTerrainSourceRevision} from '../terrainSource';
import {generateLocal} from '../../local/generateLocal';
import {FEET_PER_FMG_PIXEL} from '../../adapter/atlasArtifact';
import {rootSeedPath} from '../../seedPath';
import {buildTownSimStateForBurg} from '../../townsim/townSimRegistration';

const seed=1793176397587,cell=2016,centerPx=[775.71,226.5] as const;
const hash=(values:ArrayLike<number>)=>createHash('sha256').update(Buffer.from(Float32Array.from(values).buffer)).digest('hex');

describe('explicit retained terrain source',()=>{
 it('matches independent raw recovery heights and preserves unknown hydraulic slopes',()=>{
  const atlas=getBridgeAtlas(seed);
  const region=generateRegionFromSource(atlas,cell,rootSeedPath(seed),{
   feetPerPixel:FEET_PER_FMG_PIXEL,resolutionFt:100,world:atlas,windowCenterPx:centerPx,
  },1);
  const local=generateLocal(region,{x:region.bounds.x+region.bounds.width/2,y:region.bounds.y+region.bounds.height/2},
   region.seedPath,{biomeId:Number(atlas.pack.cells.biome?.[cell])});
  expect(hash(region.heightfield.samples)).toBe('3e145f6fabba932091e6aaaa118b9cc066ccc5f308eb1bc2d9973ef640af6512');
  expect(hash(local.terrain.elevationFt)).toBe('4e1ed173f616e928260ff8713b705c10de009d62965f0295db7c5e6c8aabd6ec');
  expect(region.rivers).toHaveLength(1);
  for(const river of region.rivers){
   expect(river.widthFtAt).toEqual(river.centerline.map(()=>river.widthFt));
   expect(river.slopeAt).toEqual([]);
  }
 },120000);

 it('replays every recorded approach/retreat height without inferring terrain from town reader 4',()=>{
  const options={centerPx,townLayouts:{200:{layoutRevision:4 as const}}};
  const current=getWorldforgeLocalForCell(seed,cell,options);
  const retained=getWorldforgeLocalForCell(seed,cell,{...options,terrainRevision:1});
  expect(current.region).not.toBe(retained.region);
  expect(getWorldforgeLocalForCell(seed,cell,{...options,terrainRevision:2}).region).toBe(current.region);
  const town=buildTownSimStateForBurg(seed,200,1,4);
  const ground=makeGroundWorld(retained.local,seed,retained.region,{skipProps:true,anchorCellId:cell,townLife:{200:town}});
  const points=[
   [459.88843960977545,466.54146692651653,22.984838970455353],
   [456.0581268116611,467.93544539003113,21.852847351433848],
   [450.72324586155065,469.877016707129,21.03473447832817],
   [449.76567777806116,470.2255427818899,21.43204620195084],
   [449.49552185192124,470.99676299898954,21.461301287745698],
   [449.2343756386887,470.93630915653796,21.62458065453981],
   [450.9857183579211,470.2326976620255,20.814883750082966],
   [450.7383223182861,469.6169100346759,21.091782356919584],
   [454.423997581031,468.13616988517265,21.629727152254404],
   [459.2962077128496,466.1787328771081,22.856961751052925],
  ];
  for(const [x,z,y] of points)expect(groundSurfaceY(ground,x,z)).toBe(y);
  // Dry admission is separate from matching terrain. Never translate missing
  // legacy water evidence into a claim that this position is safe to load.
  const bank=inspectGroundWater(ground,points[9][0],points[9][1]);
  expect(bank.status).toBe('valid');
  if(bank.status==='valid')expect(bank.surfaceY===undefined||bank.surfaceY<=points[9][2]+.1).toBe(true);
 },120000);

 it('refuses unknown and future source identities',()=>{
  for(const value of [0,3,'1',null,NaN])expect(()=>requireTerrainSourceRevision(value)).toThrow('unsupported terrain');
 });
});
