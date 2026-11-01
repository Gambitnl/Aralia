/** Verifies the last supported wedge drains through the existing shared face.
 * The saved drawn bank is a real regression, not a claim about all terrain.
 * Invalid regimes must preserve the ordinary HLL path and its refusal state.
 */
import {describe,expect,it} from 'vitest';
import {buildTerrainBankGeometry,type TerrainBankCellInput} from '../riverTerrainBankGeometry';
import {createBankState,prepareBankTransaction,commitBankTransaction,type BankState} from '../riverSubcellBankExperiment';

// Drawn triangle5818, capture SHA256 below; coordinates are x/z/bed-y.
const hash='593f343b428d06bc19ddcf8b2f2476862cbaef899d3906f639d1b948aa4feaa4';
const triangle:TerrainBankCellInput['triangles'][number]=[
  [5.3000016869538555,7.700001377210746,166.3259735107422],
  [5.999999138713111,7.000001608653253,157.6379852294922],
  [5.300000528554736,7.000002767052372,165.6259765625],
];
function patch(){return buildTerrainBankGeometry('captured-corner',hash,[
  {bounds:[5.4,5.5,7.05,7.15],triangles:[triangle]},
  {bounds:[5.5,5.6,7.05,7.15],triangles:[triangle]},
]);}
const sum=(xs:readonly number[])=>xs.reduce((s,v)=>s+v,0);
describe('audited actual-bank corner interval in the support transaction',()=>{
  it('continues past the baseline stall, drains exactly, and closes its shared impulse ledger at four refinements',()=>{
    const expected=[.0404489405,.0408945787,.0412043765,.0413597078];
    for(const [k,cap]of [.0005,.00025,.000125,.0000625].entries()){
      const bank=patch();let s=createBankState('drain',bank.geometry.geometryId,[.001,0],[.2,0],[0,0]);
      let dry:number|undefined,events=0,steps=0;
      while(s.timeS<.2&&steps++<4000){
        const p=bank.prepareCornerTransaction(s,1000,Math.min(cap,.2-s.timeS));
        if(!p.ok)throw Error(p.reason);
        const t=p.transaction;
        expect(t.energyStatus).toBe('ENERGY_UNKNOWN');expect(t.faceQuadratureStatus).toBe('UNQUALIFIED');
        expect(Math.abs(sum(t.after.volumeM3)-.001)).toBeLessThan(2e-17);
        if(t.cornerEvent){
          events++;
          expect(t.cornerEvent.receiverMaximumLevelM).toBeLessThan(t.cornerEvent.edgeMinimumM);
          const shared=t.transfers.find(f=>f.right!==null)!;
          expect(shared.signedVolumeM3).toBe(t.cornerEvent.sharedVolumeM3);
          if(t.cornerEvent.terminal){
            expect(shared.signedVolumeM3).toBe(s.volumeM3[0]);
            expect(shared.hllPxKgMS).toBeGreaterThan(s.pxKgMS[0]);
          }
          const external=[0,0];for(const f of t.transfers){
            external[0]+=f.correctionLeft[0]+f.bedReactionLeft[0]+f.correctionRight[0]+f.bedReactionRight[0]-(f.right===null?f.hllPxKgMS:0);
            external[1]+=f.correctionLeft[1]+f.bedReactionLeft[1]+f.correctionRight[1]+f.bedReactionRight[1]-(f.right===null?f.hllPzKgMS:0);
          }
          expect(Math.abs(sum(t.after.pxKgMS)-sum(s.pxKgMS)-external[0])).toBeLessThan(1e-16);
          expect(Math.abs(sum(t.after.pzKgMS)-sum(s.pzKgMS)-external[1])).toBeLessThan(1e-16);
        }
        s=commitBankTransaction(s,t);
        if(dry===undefined&&s.volumeM3[0]===0)dry=s.timeS;
      }
      expect(events).toBeGreaterThan(0);expect(s.timeS).toBe(.2);expect(dry).toBeCloseTo(expected[k],8);
      expect(s.volumeM3[0]).toBe(0);expect(s.pxKgMS[0]).toBe(0);expect(s.pzKgMS[0]).toBe(0);
      expect(s.volumeM3[1]).toBeCloseTo(.001,15);
    }
  },60000);
  it('leaves rest, reverse, transverse, subcritical and backpressure cases on the ordinary operator',()=>{
    const b=patch(),g=b.geometry;
    const still=g.cells.map((_,i)=>b.measureLevel(i,164.3).volume);
    const cases:BankState[]=[
      createBankState('rest',g.geometryId,still,[0,0],[0,0]),
      createBankState('zero',g.geometryId,[1e-6,0],[0,0],[0,0]),
      createBankState('subcritical',g.geometryId,[1e-6,0],[.0001,0],[0,0]),
      createBankState('reverse',g.geometryId,[1e-6,0],[-.1,0],[0,0]),
      createBankState('transverse',g.geometryId,[1e-6,0],[.1,0],[1e-12,0]),
      createBankState('backpressure',g.geometryId,[1e-6,.02],[.1,0],[0,0]),
    ];
    for(const s of cases){
      const ordinary=prepareBankTransaction(g,s,1000,.0001,c=>c.diagnosticBoundS);
      expect(b.prepareCornerTransaction(s,1000,.0001)).toEqual(ordinary);
    }
  });
  it('does not infer a corner across an unequal terrain trace',()=>{
    const shifted=triangle.map(p=>[p[0],p[1],p[2]-.01] as const) as unknown as typeof triangle;
    const b=buildTerrainBankGeometry('jump',hash,[
      {bounds:[5.4,5.5,7.05,7.15],triangles:[triangle]},
      {bounds:[5.5,5.6,7.05,7.15],triangles:[shifted]},
    ]);
    const s=createBankState('jump',b.geometry.geometryId,[1e-6,0],[.1,0],[0,0]);
    expect(b.prepareCornerTransaction(s,1000,.0001)).toEqual(prepareBankTransaction(b.geometry,s,1000,.0001,c=>c.diagnosticBoundS));
  });
  it('keeps certified support immutable even if the caller changes its triangle after construction',()=>{
    const points=triangle.map(p=>[...p]) as number[][];
    const supplied=points as unknown as typeof triangle;
    const b=buildTerrainBankGeometry('frozen',hash,[
      {bounds:[5.4,5.5,7.05,7.15],triangles:[supplied]},
      {bounds:[5.5,5.6,7.05,7.15],triangles:[supplied]},
    ]);
    const s=createBankState('frozen',b.geometry.geometryId,[1e-6,0],[.1,0],[0,0]);
    const before=b.prepareCornerTransaction(s,1000,.0001);
    points[0][2]+=100;
    expect(b.prepareCornerTransaction(s,1000,.0001)).toEqual(before);
    expect(Object.isFrozen(b.geometry)).toBe(true);
    expect(Object.isFrozen(b.geometry.cells[0])).toBe(true);
    expect(Object.isFrozen(b.geometry.faces)).toBe(true);
  });
  it('rejects invalid or unresolved input without replacing any stored water',()=>{
    const b=patch(),s=createBankState('rollback',b.geometry.geometryId,[1e-100,0],[0,0],[0,0]);
    const p=b.prepareCornerTransaction(s,1000,.001);
    expect(p.ok).toBe(false);if(!p.ok){expect(p.state).toBe(s);expect(p.reason).toContain('world-height precision');}
    const wet=createBankState('invalid',b.geometry.geometryId,[1e-6,0],[.1,0],[0,0]);
    const q=b.prepareCornerTransaction(wet,NaN,.001);expect(q.ok).toBe(false);if(!q.ok)expect(q.state).toBe(wet);
    const good=b.prepareCornerTransaction(wet,1000,.001);if(!good.ok)throw Error(good.reason);
    expect(()=>commitBankTransaction(good.transaction.after,good.transaction)).toThrow('Stale');
    expect(s.volumeM3[0]).toBe(1e-100);
  });
});
