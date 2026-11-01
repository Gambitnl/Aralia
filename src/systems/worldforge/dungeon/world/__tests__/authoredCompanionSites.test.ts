import {describe,it,expect} from 'vitest';
import {authoredCompanionSitesForWorld} from '../authoredCompanionSites';
import {enumerateDungeonSites} from '../dungeonSites';
import {dungeonIdentityForSite,generateDungeonForIdentity,generateDungeonForSite,resolveDungeonIdentity} from '../deriveIdentity';
import {getBridgeAtlas} from '../../../bridge/legacySubmapBridge';

function fixture(){
  return {h:new Uint8Array(9).fill(40),p:Array.from({length:9},(_,i)=>[i*10,20] as [number,number]),
    c:Array.from({length:9},(_,i)=>[i-1,i+1].filter(n=>n>=0&&n<9)),r:new Uint16Array(9),burg:new Uint16Array([1,0,0,0,0,0,0,0,0])};
}
describe('authored companion goal geography',()=>{
  it('adds a distinct source without touching old sites, burg seats or other markers',()=>{
    const cells=fixture(),existing=[{cellId:2}],burgs=[{i:1,cell:0,name:'Source Town'}];
    const before={h:[...cells.h],p:cells.p.map(p=>[...p]),c:cells.c.map(c=>[...c]),r:[...cells.r],existing:structuredClone(existing)};
    const sites=authoredCompanionSitesForWorld(42,cells,burgs,existing,[3]);
    expect(sites).toHaveLength(1);
    expect([0,2,3]).not.toContain(sites[0].cellId);
    expect(sites[0]).toMatchObject({origin:'authored',entranceKind:'ruin-door',authoredGoal:{companionId:'elara_vance',goalId:'restore_temple',nearbyBurgId:1,nearbyBurgName:'Source Town',worldSeed:42}});
    expect(Object.isFrozen(sites[0].authoredGoal)).toBe(true);
    expect({h:[...cells.h],p:cells.p,c:cells.c,r:[...cells.r],existing}).toEqual(before);
  });
  it('has the same address after fresh inputs and reordered source records',()=>{
    const cells=fixture(),burgs=[{i:1,cell:0,name:'A'},{i:2,cell:8,name:'B'}],old=[{cellId:2},{cellId:6}];
    expect(authoredCompanionSitesForWorld(1793175445852,cells,burgs,old))
      .toEqual(authoredCompanionSitesForWorld(1793175445852,fixture(),[...burgs].reverse(),[...old].reverse()));
  });
  it('does not invent a source when land, river data or a real settlement is unavailable',()=>{
    const cells=fixture(),burgs=[{i:1,cell:0,name:'Town'}];
    expect(authoredCompanionSitesForWorld(42,{...cells,r:undefined},burgs,[])).toEqual([]);
    expect(authoredCompanionSitesForWorld(42,cells,[{i:0,cell:0,name:'Phantom'},{i:1,cell:0,name:'',removed:true}],[])).toEqual([]);
    cells.r.fill(1);
    expect(authoredCompanionSitesForWorld(42,cells,burgs,[])).toEqual([]);
  });
  it('keeps river neighbors and steep or water cells out of the selected site',()=>{
    const cells=fixture();cells.r[3]=1;cells.h[4]=70;cells.h[5]=10;
    expect(authoredCompanionSitesForWorld(42,cells,[{i:1,cell:0,name:'Town'}],[])[0].cellId).toBe(1);
  });
  it('retains the complete source seed even when two worlds share a uint32 root',()=>{
    const first=authoredCompanionSitesForWorld(42,fixture(),[{i:1,cell:0,name:'Town'}],[])[0];
    const second=authoredCompanionSitesForWorld(42+2**32,fixture(),[{i:1,cell:0,name:'Town'}],[])[0];
    expect(first.authoredGoal?.worldSeed).toBe(42);
    expect(second.authoredGoal?.worldSeed).toBe(42+2**32);
  });
});

describe('canonical authored site integration',()=>{
  it('uses the actual full-seed atlas for one new site and keeps old temple identities',()=>{
    const seed=1793175445852,atlas=getBridgeAtlas(seed),sites=enumerateDungeonSites(seed);
    const authored=sites.filter(site=>site.origin==='authored');
    expect(authored).toHaveLength(1);
    const site=authored[0];
    expect(atlas.pack.burgs?.[3]).toMatchObject({name:'Serara',cell:3052});
    expect(site.cellId).not.toBe(3052);
    expect(site.authoredGoal?.worldSeed).toBe(seed);
    expect(sites.filter(other=>other.origin!=='authored').some(other=>other.cellId===site.cellId)).toBe(false);
    expect(sites.filter(other=>other.origin==='temple')).toHaveLength(5);
    expect(atlas.pack.cells.r?.[site.cellId]).toBe(0);
  },15000);
  it('regenerates the new name and full plan through its normal receipt without altering legacy seed policy',()=>{
    const seed=1793175445852,sites=enumerateDungeonSites(seed),site=sites.find(site=>site.authoredGoal)!;
    const receipt=dungeonIdentityForSite(site);
    expect(resolveDungeonIdentity(receipt,seed).worldSeed).toBe(seed);
    const direct=generateDungeonForSite(seed,site),reloaded=generateDungeonForIdentity(receipt,seed);
    // genMs is a measured execution duration, not generated source content.
    const content=(plan:typeof direct)=>{const {genMs,...stats}=plan.stats;return {...plan,stats};};
    expect(content(reloaded)).toEqual(content(direct));
    expect(reloaded.name).toBe('Temple of the Morning: Undercroft');
    expect(reloaded.builderName).toBe('the Order of the Morning');
    const old=sites.find(site=>site.origin==='temple')!;
    expect(resolveDungeonIdentity(dungeonIdentityForSite(old),seed).worldSeed).toBe(seed>>>0);
    expect(()=>generateDungeonForSite(seed>>>0,site)).toThrow('different source world');
  },15000);
});
