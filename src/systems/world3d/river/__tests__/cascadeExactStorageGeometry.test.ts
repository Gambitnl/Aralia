/** Exact storage prerequisites; these do not qualify fluid dynamics or optics. */
import {describe,it,expect} from 'vitest';
import {cascadeBox} from '../cascadeRuntimeV1Geometry';
import {cascadeSharedIntersection} from '../cascadeRuntimeV1SharedRemap';
import {cascadeExactStorage,CascadeExactArithmetic,cascadeExactFaceAreaVector,cascadeExactFaceIntersection,cascadeExactFaceCut,cascadeExactHeadTraction,type CascadeRationalPoint} from '../cascadeExactStorageGeometry';
const a=new CascadeExactArithmetic(),text=(q:{n:bigint;d:bigint})=>a.text(q);
describe('hydrostatic boundary traction',()=>{
 const points=(ps:number[][])=>ps.map(p=>p.map(n=>a.dyadic(n)) as CascadeRationalPoint);
 it('integrates the native rectangular pressure law and reverses the reaction',()=>{
  const face=points([[0,0,0],[0,0,2],[0,1,2],[0,1,0]]),level=a.q(1n);
  expect(cascadeExactHeadTraction(face,level).map(text)).toEqual(['-1/1','0/1','0/1']);
  expect(cascadeExactHeadTraction(face.slice().reverse(),level).map(text)).toEqual(['1/1','0/1','0/1']);
 });
 it('balances all three components on an oblique clipped body and detects a missing wall',()=>{
  const box=cascadeBox([0,0,0],[1,1,1]);box.planes.push({normal:[1,1,1],offset:1});
  const storage=cascadeExactStorage(box)!,faces=storage.faces.map(f=>f.map(h=>h.slice(0,3).map(n=>a.q(BigInt(n),BigInt(h[3]))) as CascadeRationalPoint));
  const tractions=faces.map(f=>cascadeExactHeadTraction(f,a.q(1n))),sum=tractions.reduce((s,f)=>s.map((q,d)=>a.add(q,f[d])) as CascadeRationalPoint,[a.q(0n),a.q(0n),a.q(0n)]);
  expect(sum.map(text)).toEqual(['0/1','-1/6','0/1']);
  expect(tractions.some(f=>f[0].n!==0n&&f[1].n!==0n&&f[2].n!==0n)).toBe(true);
  const missing=tractions.slice(1).reduce((s,f)=>s.map((q,d)=>a.add(q,f[d])) as CascadeRationalPoint,[a.q(0n),a.q(0n),a.q(0n)]);
  expect(missing.some((q,d)=>!a.equal(q,sum[d]))).toBe(true);
 });
 it('clips partial wet faces and refuses negative pressure instead of masking it',()=>{
  const face=points([[0,0,0],[0,0,1],[0,1,1],[0,1,0]]),level=a.q(1n,3n);
  expect(()=>cascadeExactHeadTraction(face,level)).toThrow(/wetted/);
  const wet=cascadeExactFaceCut(face,[a.q(0n),a.q(1n),a.q(0n)],level);
  expect(cascadeExactHeadTraction(wet,level).map(text)).toEqual(['-1/18','0/1','0/1']);
 });
});
describe('exact constructed storage',()=>{
 it('qualifies a closed cube with exact volume and first moments',()=>{
  const p=cascadeBox([0,0,0],[1,1,1]),before=JSON.stringify(p),r=cascadeExactStorage(p)!;
  expect(text(r.volume)).toBe('1/1');expect(r.first.map(text)).toEqual(['1/2','1/2','1/2']);expect(JSON.stringify(p)).toBe(before);
 });
 it('retains a non-dyadic one-third intersection rather than its rounded draw coordinate',()=>{
  const p=cascadeBox([0,0,0],[1,1,1]);p.planes.push({normal:[3,0,0],offset:1,exact:['3','0','0','1']});
  const r=cascadeExactStorage(p)!;expect(text(r.volume)).toBe('1/3');expect(r.first.map(text)).toEqual(['1/18','1/6','1/6']);
  expect(r.faces.flat().some(h=>BigInt(h[0])*3n===BigInt(h[3])&&BigInt(h[0])!==0n)).toBe(true);
 });
 it('preserves oblique positive volume and all three first moments',()=>{
  const p=cascadeBox([0,0,0],[1,1,1]);p.planes.push({normal:[1,1,1],offset:1});const r=cascadeExactStorage(p)!;
  expect(text(r.volume)).toBe('1/6');expect(r.first.map(text)).toEqual(['1/24','1/24','1/24']);
 });
 it('does not discard a small positive layer and rejects an insufficient arithmetic budget',()=>{
  const p=cascadeBox([0,0,0],[2**-80,1,1]);expect(text(cascadeExactStorage(p)!.volume)).toBe(`1/${1n<<80n}`);
  expect(()=>cascadeExactStorage(p,new CascadeExactArithmetic(64))).toThrow(/bit cap/);
 });
 it('returns no occupied region for zero-dimensional contact while preserving the legacy intersection path',()=>{
  const left=cascadeBox([0,0,0],[1,1,1]),right=cascadeBox([1,0,0],[2,1,1]);
  expect(cascadeSharedIntersection(left,right).faces).toEqual([]);
  expect(cascadeExactStorage({faces:[],planes:[...left.planes,...right.planes]})).toBeNull();
 });
 it('treats zero as exact zero without an enormous denominator and rejects invalid inputs',()=>{
  expect(a.dyadic(0)).toEqual({n:0n,d:1n});expect(()=>a.dyadic(Infinity)).toThrow(/Finite/);expect(()=>a.q(1n,0n)).toThrow(/denominator/);
 });
 it('closes both exact sides of an oblique split without losing first moments',()=>{
  const p=cascadeBox([0,0,0],[1,1,1]),left=cascadeExactStorage({...p,planes:[...p.planes,{normal:[1,2,0],offset:1.5}]})!,right=cascadeExactStorage({...p,planes:[...p.planes,{normal:[-1,-2,0],offset:-1.5}]})!;
  expect(text(a.add(left.volume,right.volume))).toBe('1/1');
  expect(left.first.map((v,d)=>text(a.add(v,right.first[d])))).toEqual(['1/2','1/2','1/2']);
 });
 it('does not double count coincident supports and refuses invalid or over-budget plane sets',()=>{
  const p=cascadeBox([0,0,0],[1,1,1]);
  expect(text(cascadeExactStorage({...p,planes:[...p.planes,...p.planes]})!.volume)).toBe('1/1');
  expect(()=>cascadeExactStorage({...p,planes:[...p.planes,{normal:[0,0,0],offset:0}]})).toThrow(/nonzero/);
  expect(()=>cascadeExactStorage({...p,planes:Array(31).fill(p.planes[0])})).toThrow(/support-plane cap/);
 });
});
describe('exact shared apertures',()=>{
 const points=(ps:number[][])=>ps.map(p=>p.map(n=>a.dyadic(n)) as CascadeRationalPoint);
 const square=points([[0,0,0],[1,0,0],[1,1,0],[0,1,0]]);
 it('constructs the same common area from either side and reversed winding',()=>{
  const other=points([[.5,-1,0],[1.5,-1,0],[1.5,.5,0],[.5,.5,0]]);
  const left=cascadeExactFaceIntersection(square,other,2),right=cascadeExactFaceIntersection(other.slice().reverse(),square,2);
  expect(cascadeExactFaceAreaVector(left).map(text)).toEqual(['0/1','0/1','1/4']);
  expect(cascadeExactFaceAreaVector(right).map(text)).toEqual(['0/1','0/1','-1/4']);
 });
 it('closes one square against two differently subdivided neighbors exactly',()=>{
  const triangles=[points([[0,0,0],[1,0,0],[1,1,0]]),points([[0,0,0],[1,1,0],[0,1,0]])];
  const areas=triangles.map(p=>cascadeExactFaceAreaVector(cascadeExactFaceIntersection(square,p,2))[2]);
  expect(text(a.add(areas[0],areas[1]))).toBe('1/1');
 });
 it('retains a non-dyadic wet edge and gives edge contact zero aperture',()=>{
  const wet=cascadeExactFaceCut(square,[a.q(0n),a.q(3n),a.q(0n)],a.q(1n));
  expect(text(cascadeExactFaceAreaVector(wet)[2])).toBe('1/3');
  const touch=cascadeExactFaceIntersection(square,points([[1,0,0],[2,0,0],[2,1,0],[1,1,0]]),2);
  expect(cascadeExactFaceAreaVector(touch).every(n=>n.n===0n)).toBe(true);
 });
 it('preserves an oblique area vector and rejects noncoplanar input',()=>{
  const slope=points([[0,0,0],[1,0,1],[1,1,1],[0,1,0]]);
  expect(cascadeExactFaceAreaVector(cascadeExactFaceIntersection(slope,slope.slice().reverse(),0)).map(text)).toEqual(['-1/1','0/1','1/1']);
  expect(()=>cascadeExactFaceIntersection(square,points([[0,0,1],[1,0,1],[0,1,1]]),2)).toThrow(/coplanar/);
 });
});
