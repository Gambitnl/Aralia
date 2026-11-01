import {describe,expect,it} from 'vitest';
import {buildTerrainBankGeometry,type TerrainBankCellInput} from '../riverTerrainBankGeometry';
import {bankHll,createBankState,prepareBankTransaction} from '../riverSubcellBankExperiment';
type P=readonly [number,number,number];
const hash='a'.repeat(64);
function rect(x0=0,x1=1,z0=0,z1=1,bed=(x:number,_z:number)=>x):TerrainBankCellInput {
  const p=(x:number,z:number):P=>[x,z,bed(x,z)],a=p(x0,z0),b=p(x1,z0),c=p(x1,z1),d=p(x0,z1);
  return {bounds:[x0,x1,z0,z1],triangles:[[a,b,c],[a,c,d]]};
}
function advance(g:ReturnType<typeof buildTerrainBankGeometry>['geometry'],s:ReturnType<typeof createBankState>,cap=.001){
  const p=prepareBankTransaction(g,s,1000,cap,c=>c.diagnosticBoundS);if(!p.ok)throw Error(p.reason);return p.transaction;
}
describe('actual terrain storage for the existing bank HLL operator',()=>{
  it('does not give dry face length the velocity of a partly wet owner',()=>{
    expect(bankHll(0,3,7,0,-2,-1)).toEqual({mass:0,normal:0,tangent:0,speed:0});
    // Thin positive inventory still contributes real waves; no dry cutoff.
    expect(bankHll(1e-20,3,7,0,-2,-1).speed).toBeGreaterThan(3);
  });
  it('uses the exact consistent flux at identical states without introducing wall-normal momentum',()=>{
    const h=.073,u=1.7,v=-.2,q=h*u;
    expect(bankHll(h,u,v,h,u,v)).toEqual({mass:q,normal:q*u+9.81*h**2/2,tangent:q*v,speed:Math.abs(u)+Math.sqrt(9.81*h)});
    const {geometry:g}=buildTerrainBankGeometry('transverse',hash,[rect(0,.1,0,.1,(x,z)=>10-2*x+z),rect(.1,.2,0,.1,(x,z)=>10-2*x+z)]);
    let s=createBankState('transverse',g.geometryId,[.00001,0],[.01,0],[0,0]);
    for(let i=0;i<50;i++)s=advance(g,s,.00001).after;
    expect(s.pzKgMS).toEqual([0,0]);
  });
  it('integrates a partly wet slope instead of extending center depth over dry rock',()=>{
    const g=buildTerrainBankGeometry('slope',hash,[rect()]),m=g.measureLevel(0,.25);
    expect(m.volume).toBeCloseTo(.25**2/2,14);expect(m.wetArea).toBeCloseTo(.25,14);
    expect(m.potential).toBeCloseTo(.25**3/3,14);expect(m.squared).toBeCloseTo(.25**3/3,14);
    const inverse=g.geometry.cells[0].measureVolume(m.volume);expect(inverse.etaM).toBeCloseTo(.25,13);
    expect(m.polygons.flat().every(p=>p[0]<=.25&&p[2]<=.25)).toBe(true);
  });
  it('preserves a genuinely still water surface across different sloping cells',()=>{
    const {geometry:g,measureLevel}=buildTerrainBankGeometry('rest',hash,[rect(0,.5),rect(.5,1)]);
    const volumes=g.cells.map((_,i)=>measureLevel(i,.65).volume);
    let s=createBankState('rest',g.geometryId,volumes,[0,0],[0,0]);
    for(let k=0;k<100;k++)s=advance(g,s).after;
    s.volumeM3.forEach((v,i)=>expect(v).toBeCloseTo(volumes[i],12));
    s.pxKgMS.forEach(p=>expect(Math.abs(p)).toBeLessThan(1e-9));
    s.pzKgMS.forEach(p=>expect(Math.abs(p)).toBeLessThan(1e-9));
  });
  it('moves an admitted pulse into an initially dry neighbor while retaining water after admission stops',()=>{
    const {geometry:g}=buildTerrainBankGeometry('dry-source',hash,[rect(0,.5,0,1,()=>0),rect(.5,1,0,1,()=>0)]);
    const dry=createBankState('source',g.geometryId,[0,0],[0,0],[0,0]);
    expect(advance(g,dry).after.volumeM3).toEqual([0,0]);
    // One declared boundary-admission event supplies this finite pulse. No
    // downstream owner is filled, and subsequent steps have no further source.
    let s=createBankState('source',g.geometryId,[.01,0],[1,0],[0,0],1,0);
    let reached=false;
    for(let k=0;k<250;k++){const t=advance(g,s);expect(t.faceQuadratureStatus).toBe('UNQUALIFIED');s=t.after;reached ||= s.volumeM3[1]>0;}
    expect(reached).toBe(true);expect(s.volumeM3[1]).toBeGreaterThan(.001);
    expect(s.volumeM3.reduce((a,b)=>a+b,0)).toBeCloseTo(.01,13);
    expect(s.volumeM3.every(v=>v>=0)).toBe(true);expect(dry.volumeM3).toEqual([0,0]);
  });
  it('supports signed return flux rather than trapping water in an outgoing queue',()=>{
    const {geometry:g}=buildTerrainBankGeometry('return',hash,[rect(0,.5,0,1,()=>0),rect(.5,1,0,1,()=>0)]);
    const s=createBankState('return',g.geometryId,[.005,.02],[0,0],[0,0]),t=advance(g,s);
    expect(t.transfers.find(f=>f.right!==null)!.signedVolumeM3).toBeLessThan(0);
    expect(t.after.volumeM3[0]).toBeGreaterThan(s.volumeM3[0]);
    expect(t.after.volumeM3.reduce((a,b)=>a+b,0)).toBeCloseTo(.025,14);
  });
  it('resolves one-sided bed traces at a bank, rather than averaging across it',()=>{
    const {geometry:g}=buildTerrainBankGeometry('bank',hash,[rect(0,1,0,1,()=>0),rect(0,1,1,2,()=>2)]);
    const s=createBankState('bank',g.geometryId,[.3,0],[0,0],[0,0]),t=advance(g,s);
    expect(t.after.volumeM3[1]).toBe(0);expect(t.after.volumeM3[0]).toBe(.3);
    const face=g.faces.find(f=>f.right!==null)!,nodes=face.measureFace(.3,2).nodes;
    expect(nodes.every(p=>p.bedLeftM===0&&p.bedRightM===2)).toBe(true);
  });
  it('does not combine separate wet basins behind a dry ridge',()=>{
    const a=rect(0,.5,0,1,x=>2*x),b=rect(.5,1,0,1,x=>2*(1-x));
    const g=buildTerrainBankGeometry('ridge',hash,[{bounds:[0,1,0,1],triangles:[...a.triangles,...b.triangles]}]);
    expect(g.measureLevel(0,.2).components).toBe(2);
    expect(()=>g.geometry.cells[0].measureVolume(.02)).toThrow('Disconnected wet basins');
  });
  it('rejects gaps, overlapping ground and overlapping water owners',()=>{
    const a=rect();expect(()=>buildTerrainBankGeometry('gap',hash,[{...a,triangles:[a.triangles[0]]}])).toThrow('support area');
    expect(()=>buildTerrainBankGeometry('double',hash,[{...a,triangles:[...a.triangles,...a.triangles]}])).toThrow('support area');
    expect(()=>buildTerrainBankGeometry('owners',hash,[a,a])).toThrow('Overlapping water owners');
  });
  it('preserves true dry state at a large world-height offset',()=>{
    const g=buildTerrainBankGeometry('offset',hash,[rect(0,1,0,1,x=>164+x)]);
    const dry=g.geometry.cells[0].measureVolume(0);expect(dry.representedVolumeM3).toBe(0);expect(dry.wetAreaM2).toBe(0);
    expect(dry.potentialIntegralM4).toBe(0);const q=g.measureLevel(0,164.25);expect(q.volume).toBeCloseTo(.03125,13);
    expect(g.geometry.cells[0].measureVolume(q.volume).etaM).toBeCloseTo(164.25,12);
  });
  it('rejects water too thin for a representable world-height level without deleting it',()=>{
    const g=buildTerrainBankGeometry('unresolved-offset',hash,[rect(0,1,0,1,x=>164+x)]);
    expect(()=>g.geometry.cells[0].measureVolume(1e-100)).toThrow('world-height precision');
    const s=createBankState('unresolved',g.geometry.geometryId,[1e-100],[0],[0]);
    const p=prepareBankTransaction(g.geometry,s,1000,.001,c=>c.diagnosticBoundS);
    expect(p.ok).toBe(false);if(!p.ok)expect(p.state).toBe(s);
    expect(s.volumeM3[0]).toBe(1e-100);
  });
});
