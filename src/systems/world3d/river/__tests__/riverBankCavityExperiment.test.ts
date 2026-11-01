
/** Disposable geometric and hydraulic cases check the bounded candidate before
 * any captured terrain is invoked. These cases never touch production water. */
import { describe, expect, it } from 'vitest';
import { cavityExperimentInternals as core, cavityStripPressure, cavityPressureResultant, cavityStepJetUnsupported, cavityReservoirHead } from '../riverBankCavityExperiment';
type Geometry = ReturnType<typeof core.buildGeometry>;
const D=1/64;
function fixture(roof:number|null=null):Geometry {
  const floor={id:0,source:'ground-test',ground:true,p:[[34,20],[42,20],[34,28]],y:[3.2,3.2,3.2],plane:[0,0,3.2],orientation:64} as Geometry['triangles'][number];
  const upper=roof===null?null:{...floor,id:1,ground:false,source:'rock-tile-bottom',y:[roof,roof,roof],plane:[0,0,roof]} as typeof floor;
  const top=upper?{...upper,id:2,source:'rock-other-tile-top',orientation:-64,p:[upper.p[0],upper.p[2],upper.p[1]],y:[roof!+.1,roof!+.1,roof!+.1],plane:[0,0,roof!+.1]} as typeof floor:null;
  const polygon=[[36,22],[36+D,22],[36+D,22+D],[36,22+D]] as Geometry['pieces'][number]['p'];
  const piece={id:0,bin:0,p:polygon,area:D*D,floor,roof:upper,state:0};
  const names=['south','east','north','west'] as const;
  const boundaries=polygon.map((a,i)=>{const b=polygon[(i+1)%4];return {id:i,left:0,right:null,a,b,nx:(b[1]-a[1])/D,nz:-(b[0]-a[0])/D,leftPiece:0,rightPiece:null,kind:names[i],floor,roof:upper};});
  return {pieces:[piece],states:[[0]],boundaries,triangles:[floor,...(upper&&top?[upper,top]:[])],identity:'synthetic',sourceHash:'0'.repeat(64),budget:new core.Budget(0,()=>0)};
}
const dry=(g:Geometry,time=0)=>core.state('test',g,0,time,[0],[0],[0]);
describe('bounded bank cavity candidate',()=>{
  it('limits initial dry fill by incoming waves and conserves its measured dose',()=>{
    const g=fixture(), result=core.advance(g,dry(g),1/60);
    expect(result.ledger.dtS).toBeGreaterThan(0);
    expect(result.ledger.dtS).toBeLessThan(1/60);
    expect(result.state.volumeM3[0]).toBeGreaterThan(0);
    expect(result.state.volumeM3[0]).toBeCloseTo(result.ledger.boundaryVolumeM3,14);
    expect(core.surface(result.state,result.measures,g.budget).stateId).toBe(result.ledger.stateId);
    expect(result.ledger.energyStatus).toBe('ENERGY_UNKNOWN');
  });
  it('integrates overlying pressure on blocked wall strips exactly once',()=>{
    const full=cavityStripPressure(5,2,2,Infinity);
    expect(cavityStripPressure(5,2,2,3)+cavityStripPressure(5,2,3,4)+cavityStripPressure(5,2,4,Infinity)).toBeCloseTo(full,9);
    // The strip from y=3 to4 has mean head1.5m: rho*g*1.5, not2.5.
    expect(cavityStripPressure(5,2,3,4)).toBeCloseTo(14715,9);
    expect(cavityPressureResultant([{weightM:1,depthM:2,nx:1,nz:0},{weightM:1,depthM:2,nx:-1,nz:0}])).toEqual([0,0]);
  });
  it('preserves stationary inventory and momentum behind reflecting walls',()=>{
    const g=fixture();g.boundaries.forEach(b=>b.kind='wall');
    const s=core.state('wall',g,0,0,[D*D*.02],[0],[0]);
    const result=core.advance(g,s,1/60);
    expect(result.state.volumeM3).toEqual(s.volumeM3);
    expect(result.state.pxKgMS[0]).toBeCloseTo(0,12);expect(result.state.pzKgMS[0]).toBeCloseTo(0,12);
  });
  it('ends source supply at four seconds without resetting resident water',()=>{
    const g=fixture(),s=core.state('off',g,0,4,[D*D*.02],[0],[0]);
    const result=core.advance(g,s,1/60);
    expect(result.ledger.boundaryVolumeM3).toBeLessThan(0);
    expect(result.state.volumeM3[0]).toBeGreaterThan(0);
    expect(result.state.volumeM3[0]).toBeLessThan(s.volumeM3[0]);
    expect(cavityReservoirHead(0)).toBe(3.25);expect(cavityReservoirHead(2)).toBe(3.5);
  });
  it('stops roof contact before committing the boundary fill',()=>{
    const g=fixture(3.22),s=dry(g);
    expect(()=>core.advance(g,s,1/60)).toThrow(/ceiling pressure/);
    expect(s.revision).toBe(0);expect(s.volumeM3).toEqual([0]);
  });
  it('stops occupied trapped air but treats a dry open column as atmosphere',()=>{
    const g=fixture(3.5);g.boundaries.forEach(b=>b.kind='wall');
    const m=core.invert(g,0,D*D*.02);
    expect(()=>core.atmospheric(g,[m])).toThrow(/air route/);
    g.pieces[0].roof=null;
    expect(()=>core.atmospheric(g,[core.invert(g,0,0)])).not.toThrow();
  });
  it('rejects detachment only when an actual downward wet transfer lacks receiving support',()=>{
    expect(cavityStepJetUnsupported(3,2,2.5,.1)).toBe(true);
    expect(cavityStepJetUnsupported(3,2,3,.1)).toBe(false);
    expect(cavityStepJetUnsupported(3,2,2.5,0)).toBe(false);
  });
  it('stops moving submerged partial-wall reflection before inventing its force',()=>{
    const g=fixture(),s=core.state('partial',g,0,4,[D*D*.2],[D*D*.2*1000*.7],[0]);
    g.boundaries[1].kind='wall';g.boundaries[1].roof={...g.pieces[0].floor,plane:[0,0,3.3],y:[3.3,3.3,3.3]};
    expect(()=>core.advance(g,s,1/60)).toThrow(/partial-wall dynamic/);
    expect(s.revision).toBe(0);
  });
  it('builds actual lower and upper passages across rock tile identities',()=>{
    const ground=fixture().triangles[0],A=[36.3,3.4,22.3],B=[36.8,3.4,22.3],C=[36.3,3.4,22.8],T=[36.4,3.8,22.4];
    const faces=[[A,B,C],[A,T,B],[B,T,C],[C,T,A]];
    const input={identity:'original-synthetic-overhang',sourceSha256:'0'.repeat(64),
      vertices:[...ground.p.flatMap((p,i)=>[p[0],ground.y[i],p[1]]),...faces.flat(2)],
      triangles:[{objectIndex:0},...faces.map((_,i)=>({objectIndex:i===0?1:2}))],
      objects:[{sourceName:'ground-test'},{sourceName:'rock-bottom-tile'},{sourceName:'rock-top-tile'}]};
    const g=core.buildGeometry(input,new core.Budget(0,()=>0));
    const passages=g.boundaries.filter(b=>b.kind==='interior');
    // The tetrahedron's roof meets its top at a zero-thickness silhouette.
    // Outside and lower equal-floor pieces therefore share connected storage
    // within a bin; demanding a separate aperture there was incorrect.
    expect(g.states.some(ids=>ids.some(i=>g.pieces[i].roof!==null)&&ids.some(i=>!g.pieces[i].roof&&g.pieces[i].floor.ground))).toBe(true);
    expect(passages.length).toBeGreaterThan(0);
    expect(g.triangles.filter(t=>!t.ground).some(t=>t.source==='rock-bottom-tile')).toBe(true);
    expect(g.triangles.filter(t=>!t.ground).some(t=>t.source==='rock-top-tile')).toBe(true);
    expect(g.pieces.some(p=>p.roof!==null)).toBe(true);
    expect(g.pieces.some(p=>!p.roof&&!p.floor.ground)).toBe(true);
    // Its solid has no finite vertical wall at the silhouette. Distinct upper
    // inventory and shared aperture ownership are the relevant invariants here.
    expect(g.pieces.filter(p=>!p.roof&&!p.floor.ground).every(p=>!g.states[p.state].some(i=>g.pieces[i].roof!==null))).toBe(true);
    const keys=passages.map(b=>[b.left,b.right,...b.a,...b.b,b.floor.id,b.roof?.id].join(':'));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('rejects negative inventory rather than repairing it',()=>{
    const g=fixture();expect(()=>core.state('bad',g,0,0,[-.1],[0],[0])).toThrow(/Negative/);
  });
});


describe('certified local supporting-line exclusion',()=>{
  const R=128*Number.EPSILON;
  const point=(a:number,b:number,c:number)=>[[a,a],[b,b],[c,c]] as const;
  function triangle(id:number,a:number,b:number,c:number):Geometry['triangles'][number] {
    const p=[[35,21],[39,21],[35,25]] as const;
    return {id,ground:true,source:'ground-test',p,y:p.map(q=>a*(q[0]-36)+b*(q[1]-22)+c),plane:[a,b,0],orientation:16};
  }
  it('excludes analytically distant lines while retaining real crossing and touching controls',()=>{
    expect(core.lineProvablyOutside(point(1,0,-2*D),36,22)).toBe(true);
    expect(core.lineProvablyOutside(point(1,0,-D/2),36,22)).toBe(false);
    for(const bounds of [point(1,0,0),point(1,0,-D),point(0,1,0),point(0,1,-D),point(1,1,0),point(1,1,-2*D)]) {
      expect(core.lineProvablyOutside(bounds,36,22)).toBe(false);
    }
    const candidates=[triangle(0,0,0,0),triangle(1,1,0,-D/2)],budget=new core.Budget(0,()=>0);
    const {lines,linePairs}=core.collectLocalLines(candidates,36,22,budget);
    const pair=linePairs.findIndex(ids=>ids.has('0:1'));
    expect(pair).toBeGreaterThanOrEqual(0);expect(lines[pair][2]).toBeCloseTo(-D/2,12);
    const polygons=core.localPartition(candidates,36,22,new core.Budget(0,()=>0));
    const area=(p:readonly (readonly [number,number])[])=>Math.abs(p.reduce((sum,q,i)=>sum+(q[0]-36)*(p[(i+1)%p.length][1]-22)-(p[(i+1)%p.length][0]-36)*(q[1]-22),0))/2;
    expect(polygons.length).toBe(2);expect(polygons.reduce((sum,p)=>sum+area(p),0)).toBeCloseTo(D*D,15);
    expect([...budget.crossings.values()]).toHaveLength(0);
    const graphBudget=new core.Budget(0,()=>0);core.localPartition(candidates,36,22,graphBudget);
    expect([...graphBudget.crossings.values()].some(ids=>ids.has('0:1'))).toBe(true);
    expect(budget.lineDiagnostics?.rejected).toBeGreaterThan(0);
  });
  it('keeps expanded-edge and final global-add rounding admission',()=>{
    const maximum=36+D+R,roundedLocal=core.outward(maximum-36,1);
    expect(roundedLocal).toBeGreaterThan(D+R);
    expect(36+roundedLocal).toBe(maximum);
    expect(core.lineProvablyOutside(point(1,0,-roundedLocal),36,22)).toBe(false);
    const global=core.outward(maximum,1),local=global-36;
    expect(local).toBeGreaterThan(D+R);
    expect(core.lineProvablyOutside(point(1,0,-local),36,22)).toBe(false);
    expect(core.lineProvablyOutside(point(1,0,D/2),36,22)).toBe(true);
    for(const axis of [0,1]) for(const side of [-R,D+R]) {
      expect(core.lineProvablyOutside(axis===0?point(1,0,-side):point(0,1,-side),36,22)).toBe(false);
    }
  });
  it('retains uncertain original constructions and bounds adjacent/subnormal values outward',()=>{
    expect(core.outward(0,1)).toBe(Number.MIN_VALUE);expect(core.outward(-0,-1)).toBe(-Number.MIN_VALUE);
    expect(core.outward(Number.MIN_VALUE,-1)).toBe(0);expect(core.outward(Number.MAX_VALUE,1)).toBe(Infinity);
    expect(core.lineProvablyOutside([[1,1],[0,0],[-Infinity,Infinity]],36,22)).toBe(false);
    expect(core.lineProvablyOutside([[NaN,NaN],[0,0],[-1,-1]],36,22)).toBe(false);
    const analytic=core.originalSlopeBounds([[0,0],[2,1],[1,3]],[0,7,11]);
    expect(analytic[0][0]).toBeLessThanOrEqual(2);expect(analytic[0][1]).toBeGreaterThanOrEqual(2);
    expect(analytic[1][0]).toBeLessThanOrEqual(3);expect(analytic[1][1]).toBeGreaterThanOrEqual(3);
    expect(analytic.flat().every(Number.isFinite)).toBe(true);
    const slopes=core.originalSlopeBounds([[0,0],[1,1],[1,core.outward(1,1)]],[0,1,2]);
    expect(slopes[0]).toEqual([-Infinity,Infinity]);
    const base=triangle(0,0,0,0), uncertain={...triangle(1,1,0,10),slopeBounds:slopes};
    const budget=new core.Budget(0,()=>0),collected=core.collectLocalLines([base,uncertain],36,22,budget);
    expect(collected.linePairs.some(ids=>ids.has('0:1'))).toBe(true);
  });
  it('merges duplicate pair provenance before exclusion in either arrival order',()=>{
    const a=triangle(0,0,0,0),b=triangle(1,1,0,-D/2),c=triangle(2,2,0,-D);
    for(const candidates of [[a,b,c],[c,b,a]]) {
      const result=core.collectLocalLines(candidates,36,22,new core.Budget(0,()=>0));
      const owner=result.linePairs.find(ids=>ids.has('0:1'));
      expect(owner).toEqual(new Set(['0:1','0:2','1:2']));
    }
    // These identical represented outside lines share a key. The later original
    // coefficient enclosure is uncertain, so the first key must be resurrected.
    const outside=triangle(1,1,0,2),late={...triangle(2,2,0,4),slopeBounds:[[-Infinity,Infinity],[0,0]] as const};
    for(const candidates of [[a,outside,late],[late,outside,a]]) {
      const result=core.collectLocalLines(candidates,36,22,new core.Budget(0,()=>0));
      expect(result.linePairs.some(ids=>ids.has('0:1')&&ids.has('0:2'))).toBe(true);
    }
  });
  it('keeps the fixed relevant-line cap and structured failing-bin evidence',()=>{
    const candidates=Array.from({length:18},(_,id)=>{const a=Math.cos(id),b=Math.sin(id);return triangle(id,a,b,-(a+b)*D/2);});
    const budget=new core.Budget(0,()=>0);
    expect(()=>core.collectLocalLines(candidates,36,22,budget)).toThrow('Local line cap');
    expect(budget.lineDiagnostics?.bin).toBe(0);expect(budget.lineDiagnostics?.candidateIds).toHaveLength(18);
    expect(budget.lineDiagnostics!.retained).toBeGreaterThan(96);
    expect(budget.operations).toBeGreaterThan(budget.lineDiagnostics!.unique);
    expect(budget.lineDiagnostics!.lines.some(line=>line.pairIds.length>0&&!line.outside)).toBe(true);
  });
});


describe('independent outside certificate for rounded near-parallel intersections',()=>{
  it('can omit physically outside lines even when the old rounded solve invents an admitted point',()=>{
    // Both exact supporting lines lie beyond the northeast corner by about 1e-8.
    // Cancellation in the existing Cramer solve puts their computed point inside.
    // Exclusion removes this false point; it does not claim all remaining graph
    // intersections or the physical geometry are exact.
    const a=[0.7071067811865475,0.7071067811865475,-0.022097096912079613] as const;
    const b=[0.7071067811863707,0.7071067811867243,-0.022097096912079617] as const;
    const det=a[0]*b[1]-b[0]*a[1],R=128*Number.EPSILON;
    expect(Math.abs(det)).toBeGreaterThan(R);
    const x=36+(a[1]*b[2]-b[1]*a[2])/det,z=22+(b[0]*a[2]-a[0]*b[2])/det;
    expect(x).toBeGreaterThanOrEqual(36-R);expect(x).toBeLessThanOrEqual(36+D+R);
    expect(z).toBeGreaterThanOrEqual(22-R);expect(z).toBeLessThanOrEqual(22+D+R);
    for(const q of [a,b]) {
      expect((q[0]+q[1])*D+q[2]).toBeLessThan(-9e-9);
      expect(core.lineProvablyOutside([[q[0],q[0]],[q[1],q[1]],[q[2],q[2]]],36,22)).toBe(true);
    }
  });
});

describe('bounded retained-intersection validity',()=>{
  const bounds=(p:readonly [number,number,number])=>p.map(v=>[v,v] as const) as unknown as readonly [readonly [number,number],readonly [number,number],readonly [number,number]];
  const owner=(p:readonly [number,number,number],axis:0|1|null=null,coordinate:number|null=null,points:readonly (readonly [number,number])[]=[])=>({bounds:bounds(p),identity:'synthetic',axis,coordinate,points});
  it('keeps exact grid corners and certified parallel grid lines',()=>{
    const a=[1,0,0] as const,b=[0,1,0] as const;
    expect(core.retainedIntersection(a,b,owner(a,0,36),owner(b,1,22),36,22)).toEqual({point:[36,22],exact:true});
    const c=[1,0,-D] as const;
    expect(core.retainedIntersection(a,c,owner(a,0,36),owner(c,0,36+D),36,22).point).toBeNull();
  });
  it('preserves an exact original edge endpoint touching the grid',()=>{
    const a=[1,0,0] as const,b=[1,1,0] as const,p=[36,22] as const;
    expect(core.retainedIntersection(a,b,owner(a,0,36,[p]),owner(b,null,null,[p,[36+D,22-D]]),36,22)).toEqual({point:p,exact:true});
  });
  it('certifies an interior solve or an outside skip without a determinant tolerance',()=>{
    const a=[1,0,-D/2] as const,b=[0,1,-D/2] as const;
    expect(core.retainedIntersection(a,b,owner(a),owner(b),36,22).point).toEqual([36+D/2,22+D/2]);
    const outside=[1,0,-2*D] as const;
    expect(core.retainedIntersection(outside,b,owner(outside),owner(b),36,22).point).toBeNull();
  });
  it('refuses unresolved near-parallel and nonfinite solves',()=>{
    const a=[1,1,-D] as const,b=[1,core.outward(1,1),-D] as const;
    expect(()=>core.retainedIntersection(a,b,owner(a),owner(b),36,22)).toThrow(/determinant/);
    const invalid=[Infinity,1,0] as const;
    expect(()=>core.retainedIntersection(a,invalid,owner(a),owner(invalid),36,22)).toThrow(/determinant/);
  });
  it('refuses the ambiguous alias witness at its first unresolved original separator',()=>{
    const h=D/2,other=core.outward(h,1),p=[[36,22],[36+D,22],[36,22+D]] as const;
    const triangle=(id:number,k:number):Geometry['triangles'][number]=>({id,ground:true,source:'ground-test',p,y:p.map(q=>q[0]-36-k),plane:[1,0,-36-k],orientation:D*D});
    const zero={...triangle(0,0),y:[0,0,0],plane:[0,0,0] as const};
    const candidates=[zero,triangle(1,h),triangle(2,other)],budget=new core.Budget(0,()=>0);
    expect(h).not.toBe(other);
    expect([1,0,-h].map(v=>v.toPrecision(15))).toEqual([1,0,-other].map(v=>v.toPrecision(15)));
    // The earlier collector merged these original pair IDs. The new zero-normal
    // guard now stops their unproved mutual pair before publishing any graph.
    expect(()=>core.collectLocalLines(candidates,36,22,budget)).toThrow(/zero-length original separator/);
  });
  it('allows constant-height zero normals but refuses unresolved rounded-zero source planes',()=>{
    const p=[[36,22],[36+D,22],[36,22+D]] as const;
    const a:Geometry['triangles'][number]={id:0,ground:true,source:'ground-test',p,y:[0,0,0],plane:[0,0,0],orientation:D*D};
    expect(()=>core.collectLocalLines([a,{...a,id:1,y:[1,1,1],plane:[0,0,1]}],36,22,new core.Budget(0,()=>0))).not.toThrow();
    expect(()=>core.collectLocalLines([a,{...a,id:1,y:[1,2,1]}],36,22,new core.Budget(0,()=>0))).toThrow(/zero-length original separator/);
  });
  it('retains shared original edge identity in a usable two-triangle partition',()=>{
    const p=[[36,22],[36+D,22],[36,22+D]] as const,q=[[36+D,22],[36+D,22+D],[36,22+D]] as const;
    const a:Geometry['triangles'][number]={id:0,ground:true,source:'ground-test',p,y:[0,0,0],plane:[0,0,0],orientation:D*D};
    const b={...a,id:1,p:q};
    expect(core.localPartition([a,b],36,22,new core.Budget(0,()=>0))).toHaveLength(2);
  });
});
