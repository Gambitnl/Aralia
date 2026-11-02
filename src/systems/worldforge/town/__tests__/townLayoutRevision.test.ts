/** Source compatibility uses the exact protected native town as a reference.
 * These checks distinguish the normalized layout/founding roster from the
 * later living/civic projection. They do not qualify save migration, terrain,
 * permissions or the player's physical position. */
import {createHash} from 'node:crypto';
import {beforeAll, describe, expect, it} from 'vitest';
import {getBridgeAtlas, getBurgNamer} from '../../bridge/legacySubmapBridge';
import {canonicalTownSeedPath, getCanonicalTownPlan, getCanonicalTownPersonality} from '../canonicalTown';
import {toArtifactPlan} from '../townPlanAdapter';
import {generateTownRoster} from '../../roster/generateTownRoster';
import {CURRENT_TOWN_LAYOUT_REVISION, requireTownLayoutRevision, type TownLayoutRevision} from '../townLayoutRevision';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Chromium reproduces the retained artifact byte for byte. Node's trigonometry
// differs at 49 footprint coordinates by at most 5.69e-14 town units. Round
// only footprint coordinates to a billionth for this cross-runtime check;
// identifiers, metadata, the normalized plan and every person stay exact.
const footprintHash=(artifact:ReturnType<typeof toArtifactPlan>['plan'])=>hash({
  ...artifact,
  plots:artifact.plots.map(plot=>({...plot,
    footprint:plot.footprint.map(point=>point.map(value=>Math.round(value*1e9)/1e9)),
  })),
});
const seed=1793432134128,burgId=188;
let atlas:ReturnType<typeof getBridgeAtlas>;
beforeAll(()=>{atlas=getBridgeAtlas(seed);},60000);

describe('explicit town layout revision',()=>{
 it('recovers the pre-road-scale Kodok source without changing reader1 or the default',()=>{
  const worldSeed=1793176397587,burg=200,world=getBridgeAtlas(worldSeed);
  const source=getCanonicalTownPlan(world,worldSeed,burg,4),artifact=toArtifactPlan(source,burg).plan;
  expect(artifact.plots).toHaveLength(78);
  expect(artifact.plots.filter(p=>p.role==='market'||p.role==='workshop').map(p=>p.id))
    .toEqual([13,14,18,20,21,22,23,24,31,37,49,64,68]);
  const roster=generateTownRoster(artifact,canonicalTownSeedPath(worldSeed,burg),{nameFor:getBurgNamer(worldSeed,burg)});
  expect(roster.occupants).toHaveLength(219);
  expect(roster.occupants.slice(0,6).map(p=>[p.id,p.name,p.householdMemberId])).toEqual([
   [1,'Hew Oakton','b0:head'],[2,'Sten Oakton','b0:spouse'],[3,'Fen Oakton','b0:child:0'],
   [4,'Bryn Woodstead','b1:head'],[5,'Bess Woodstead','b1:child:0'],[6,'Ulric Ashbourne','b2:head'],
  ]);
  expect(requireTownLayoutRevision(4)).toBe(4);
  expect(getCanonicalTownPlan(world,worldSeed,burg)).toBe(getCanonicalTownPlan(world,worldSeed,burg,2));
  expect(getCanonicalTownPlan(world,worldSeed,burg,1)).not.toBe(source);
 });
  it('reconstructs the exact normalized protected Stamstad layout',()=>{
    const plan=getCanonicalTownPlan(atlas,seed,burgId,1);
    expect(plan.plots).toHaveLength(65);
    expect(hash(plan)).toBe('5eac8711d515ad314b6fefb328488203883c0e683698aab409070fcac978d40d');
  });
  it('preserves the original artifact and the current canonical roster reader',()=>{
    const artifact=toArtifactPlan(getCanonicalTownPlan(atlas,seed,burgId,1),burgId).plan;
    expect(footprintHash(artifact)).toBe('ba631e8444c33f8f9a4fc4a5e75839528b9ab7d8ff82c67b7196a84afb03bf3c');
    const roster=generateTownRoster(artifact,canonicalTownSeedPath(seed,burgId),{nameFor:getBurgNamer(seed,burgId)});
    // 237 is the founding projection, before saved deaths and civic attendance
    // produce the separately captured 226-person living ground projection.
    expect(roster.occupants).toHaveLength(237);
    // The current reader already includes proprietor/retirement changes from
    // before rural source3. A captured pre-edit-source comparison proves this
    // exact roster is unchanged by the rural work; the old3f1d hash used an
    // earlier job reader, even though its layout/artifact hashes still match.
    expect(hash(roster)).toBe('b5eb88d6e64d1668cb63f0742db00b03266cbe667f477e2fffbd6eb741f383ca');
    expect(roster.occupants.find(person=>person.householdMemberId==='b20:head')).toEqual({
      id:55,name:'Tomas Dunfield',ageBand:'adult',homePlotId:20,occupation:'resident',householdMemberId:'b20:head',
    });
  });
  it('keeps the approved newer layout as the default, after a legacy read',()=>{
    const old=getCanonicalTownPlan(atlas,seed,burgId,1);
    const current=getCanonicalTownPlan(atlas,seed,burgId);
    expect(current).toBe(getCanonicalTownPlan(atlas,seed,burgId,CURRENT_TOWN_LAYOUT_REVISION));
    expect(current).not.toBe(old);
    expect(current.plots.length).toBeGreaterThan(old.plots.length);
    expect(getCanonicalTownPlan(atlas,seed,burgId,1)).toBe(old);
  });
  it('does not let a current-first cache replace the legacy layout',()=>{
    // A distinct Atlas identity exercises the reverse request order.
    const other={...atlas};
    const current=getCanonicalTownPlan(other,seed,burgId,2);
    const old=getCanonicalTownPlan(other,seed,burgId,1);
    expect(current).not.toBe(old);
    expect(hash(old)).toBe('5eac8711d515ad314b6fefb328488203883c0e683698aab409070fcac978d40d');
  });
  it('separates world seeds even when a caller reuses one Atlas object',()=>{
    expect(getCanonicalTownPlan(atlas,seed,burgId,1)).not.toBe(getCanonicalTownPlan(atlas,seed+1,burgId,1));
  });
  it('keeps personality caches tied to the selected layout',()=>{
    const old=getCanonicalTownPersonality(atlas,seed,burgId,1);
    const current=getCanonicalTownPersonality(atlas,seed,burgId,2);
    expect(old).not.toBe(current);
    expect(getCanonicalTownPersonality(atlas,seed,burgId,1)).toBe(old);
    expect(getCanonicalTownPersonality(atlas,seed,burgId)).toBe(current);
  });
  it('keeps rural source3 explicit and separates its household facts from default2',()=>{
    const old=getCanonicalTownPlan(atlas,seed,burgId,2);
    const candidate=getCanonicalTownPlan(atlas,seed,burgId,3);
    expect(requireTownLayoutRevision(3)).toBe(3);
    expect(CURRENT_TOWN_LAYOUT_REVISION).toBe(2);
    expect(candidate).not.toBe(old);
    expect(candidate.wards).toEqual(old.wards);
    expect(candidate.farmsteads.map(({id,x,y})=>({id,x,y}))).toEqual(old.farmsteads.map(({id,x,y})=>({id,x,y})));
    expect(candidate.farmsteads.length).toBeGreaterThan(0);
    expect(candidate.farmsteads.every(f=>f.farmParcelIndex!==undefined&&f.representedPopulation!==undefined&&f.occupants<=8)).toBe(true);
    expect(old.farmsteads.every(f=>!Object.hasOwn(f,'farmParcelIndex')&&!Object.hasOwn(f,'representedPopulation'))).toBe(true);
    expect(getCanonicalTownPlan(atlas,seed,burgId)).toBe(old);
  // 2026-11-02 (GG-586): an explicit 20 s. The test builds two whole town
  // plans; alone it takes 4.6 s against the 5 s default, so it timed out
  // whenever other suites ran beside it.
  },20000);
  it.each([0,5,'1',null,NaN])('rejects unsupported revision %s instead of silently substituting',value=>{
    expect(()=>requireTownLayoutRevision(value)).toThrow('unsupported layout revision');
    expect(()=>getCanonicalTownPlan(atlas,seed,burgId,value as TownLayoutRevision)).toThrow('unsupported layout revision');
  });
});
