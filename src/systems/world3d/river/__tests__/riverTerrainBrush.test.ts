/** Brush controls exercise terrain math and drag undo, not water physics. */
import {describe,it,expect} from 'vitest';
import {RiverTerrainBrush,type TerrainBrushLayer,type RiverTerrainBrushCommand} from '../riverTerrainBrush';
const layer=(values=Array(25).fill(0)):TerrainBrushLayer=>({id:'ground',nx:5,nz:5,step:1,x0:-2,z0:-2,heights:values});
const dab={kind:'dab' as const,stroke:1,tool:'raise' as const,x:0,z:0,radius:2,strength:1};
describe('live landscape brushes',()=>{
  it('batches overlapping raise, flatten and smooth dabs with exactly the sequential ground and undo',()=>{
    const a=new RiverTerrainBrush(),b=new RiverTerrainBrush(),base=Array.from({length:25},(_,i)=>i===12?4:1),l=layer([...base]);
    const commands:RiverTerrainBrushCommand[]=[dab,dab,{...dab,tool:'flatten',target:2,strength:.4},
      {...dab,tool:'smooth',strength:.5},{kind:'finish'}];
    for(const command of commands){a.apply(command,[l]);for(let i=0;i<25;i++)(l.heights as number[])[i]=base[i]+a.offset('ground',i);}
    b.applyBatch(commands,[layer(base)]);
    for(let i=0;i<25;i++)expect(b.offset('ground',i)).toBeCloseTo(a.offset('ground',i),13);
    expect(b.undoCount).toBe(1);b.apply({kind:'undo'},[]);
    for(let i=0;i<25;i++)expect(b.offset('ground',i)).toBe(0);
    expect(()=>b.applyBatch([dab,{...dab,x:NaN}],[layer(base)])).toThrow();
    expect(b.offset('ground',12)).toBe(0);
  });
  it('raises the center with a soft edge and does not touch the radius boundary',()=>{
    const b=new RiverTerrainBrush();b.apply(dab,[layer()]);
    expect(b.offset('ground',12)).toBe(1);expect(b.offset('ground',13)).toBe(.5);expect(b.offset('ground',14)).toBe(0);
  });
  it('lowers and flattens toward the stroke target, without replacing unrelated offsets',()=>{
    const b=new RiverTerrainBrush(),l=layer(Array(25).fill(10));
    b.apply({...dab,tool:'lower',strength:2},[l]);expect(b.offset('ground',12)).toBe(-2);
    (l.heights as number[])[12]=8;
    b.apply({...dab,stroke:2,tool:'flatten',target:4,strength:.5},[l]);expect(b.offset('ground',12)).toBe(-4);
  });
  it('smooths from one snapshot symmetrically rather than from earlier writes',()=>{
    const heights=Array(25).fill(0);heights[12]=9;const b=new RiverTerrainBrush();
    b.apply({...dab,tool:'smooth',radius:3},[layer(heights)]);
    expect(b.offset('ground',12)).toBe(-8);
    expect(b.offset('ground',11)).toBe(b.offset('ground',13));
    expect(b.offset('ground',7)).toBe(b.offset('ground',17));
  });
  it('undoes a complete multi-dab drag on both native ground lattices',()=>{
    const b=new RiverTerrainBrush(),l=layer(),o={...layer(),id:'outer' as const};
    b.apply(dab,[l,o]);(l.heights as number[])[12]=1;(o.heights as number[])[12]=1;
    b.apply(dab,[l,o]);b.apply({kind:'finish'},[l,o]);expect(b.undoCount).toBe(1);
    expect(b.offset('ground',12)).toBe(2);b.apply({kind:'undo'},[l,o]);
    expect(b.offset('ground',12)).toBe(0);expect(b.offset('outer',12)).toBe(0);expect(b.undoCount).toBe(0);
  });
  it('can undo clearing the landscape and rejects malformed input without changing history',()=>{
    const b=new RiverTerrainBrush();b.apply(dab,[layer()]);b.apply({kind:'reset'},[]);expect(b.offset('ground',12)).toBe(0);
    b.apply({kind:'undo'},[]);expect(b.offset('ground',12)).toBe(1);
    const count=b.undoCount;expect(()=>b.apply({...dab,x:NaN},[layer()])).toThrow('Invalid terrain brush');expect(b.undoCount).toBe(count);
  });
});
