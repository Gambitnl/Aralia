/** Scheduling must preserve the existing physics, source-off state and water
 * inventory when inspecting a different landform. Runtime numbers are observers. */
import { describe, expect, it, vi } from 'vitest';
import { WaterfallTerrainInspection } from '../waterfallTerrainInspection';
import { TERRAIN_COMPARISON_CASES, WaterfallTerrainComparisonRun } from '../waterfallTerrainComparisons';
function physical<T>(value:T):T {
 const copy=structuredClone(value);
 function strip(v:unknown){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='lastAdvanceMilliseconds'||k==='lastStepMilliseconds')(v as Record<string,unknown>)[k]=0;else strip(x);}}
 strip(copy);return copy;
}
describe('selected terrain inspection',()=>{
 it('publishes four unchanged physical ticks through cooperative yields',async()=>{
  const session=new WaterfallTerrainInspection(),reference=new WaterfallTerrainComparisonRun(TERRAIN_COMPARISON_CASES.filter(c=>c.id==='storfossen'));
  await session.executeYielding({type:'select',id:'storfossen'});await session.executeYielding({type:'running',running:true});reference.setRunning(true);
  for(const sourceOn of [true,false,true]){
   await session.executeYielding({type:'source',sourceOn});reference.setSourceOn(sourceOn);
   const yieldControl=vi.fn(async()=>{});
   const actual=await session.executeYielding({type:'step',ticks:4},yieldControl);
   for(let i=0;i<4;i++)reference.advanceTick();
   expect(yieldControl).toHaveBeenCalledTimes(3);
   expect(physical(actual!.snapshot)).toEqual(physical(reference.snapshot()));
  }
 });
 it.each([
  {type:'running' as const,running:false}, {type:'source' as const,sourceOn:false},
  {type:'reset' as const}, {type:'select' as const,id:'langfossen' as const}, {type:'dispose' as const},
 ])('cancels unfinished work without publishing old water on $type',async command=>{
  const session=new WaterfallTerrainInspection();
  await session.executeYielding({type:'select',id:'storfossen'});await session.executeYielding({type:'running',running:true});
  let resume!:()=>void;
  const advancing=session.executeYielding({type:'step',ticks:4},()=>new Promise<void>(resolve=>{resume=resolve;}));
  expect(session.snapshot().reading.physicalTime).toBe(1/120);
  await session.executeYielding(command);const accepted=physical(session.snapshot());
  resume();expect(await advancing).toBeNull();
  expect(physical(session.snapshot())).toEqual(accepted);
 });
 it('retains state on invalid cooperative requests and performs no paused ticks',async()=>{
  const session=new WaterfallTerrainInspection();await session.executeYielding({type:'select',id:'storfossen'});
  const before=physical(session.snapshot()),yieldControl=vi.fn(async()=>{});
  await expect(session.executeYielding({type:'step',ticks:5},yieldControl)).rejects.toThrow('Invalid');
  const paused=await session.executeYielding({type:'step',ticks:4},yieldControl);
  expect(physical(paused!.snapshot)).toEqual(before);expect(yieldControl).not.toHaveBeenCalled();
 });
 it('allocates no water before selection, and matches the original fixed ticks exactly',()=>{
  const session=new WaterfallTerrainInspection();expect(session.snapshot().snapshots).toEqual([]);
  const reference=new WaterfallTerrainComparisonRun(TERRAIN_COMPARISON_CASES.filter(c=>c.id==='langfossen'));
  session.execute({type:'select',id:'langfossen'});session.execute({type:'running',running:true});reference.setRunning(true);
  for(let i=0;i<125;i++){
   const actual=session.execute({type:'step'}), expected=reference.step();
   // Compare admission, pre-contact flight and developed contact. Traversing
   // the entire growing snapshot every tick would dominate this physics check.
   if(i===0||i===59||i===124)expect(physical(actual)).toEqual(physical(expected));
  }
 });
 it('pauses and preserves each course including source-off while another runs',()=>{
  const session=new WaterfallTerrainInspection();session.execute({type:'select',id:'langfossen'});session.execute({type:'running',running:true});
  session.execute({type:'step'});session.execute({type:'source',sourceOn:false});const before=session.execute({type:'step'});before.reading.running=false;
  session.execute({type:'select',id:'storfossen'});session.execute({type:'running',running:true});session.execute({type:'step'});
  expect(session.execute({type:'select',id:'langfossen'})).toEqual(before);
  session.execute({type:'reset'});expect(session.snapshot().reading.physicalTime).toBe(0);
  expect(session.execute({type:'select',id:'storfossen'}).reading.physicalTime).toBe(1/120);
 });
 it('batches unchanged ticks and refuses oversized or invalid work requests',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0);
  try {
   const session=new WaterfallTerrainInspection();session.execute({type:'select',id:'storfossen'});session.execute({type:'running',running:true});
   const reference=new WaterfallTerrainComparisonRun(TERRAIN_COMPARISON_CASES.filter(c=>c.id==='storfossen'));reference.setRunning(true);
   let state=reference.snapshot();for(let i=0;i<4;i++)state=reference.step();
   expect(physical(session.execute({type:'step',ticks:4}))).toEqual(physical(state));
   expect(()=>session.execute({type:'step',ticks:5})).toThrow();expect(()=>session.execute({type:'step',ticks:NaN})).toThrow();
   expect(()=>session.execute({type:'select',id:'broken'})).toThrow();expect(session.snapshot().reading.running).toBe(true);
  } finally {clock.mockRestore();}
 });
 it('stops a batch at an elapsed work boundary without changing a partial tick',()=>{
  let now=0;const clock=vi.spyOn(performance,'now').mockImplementation(()=>{now+=10;return now;});
  try {const session=new WaterfallTerrainInspection();session.execute({type:'select',id:'storfossen'});session.execute({type:'running',running:true});expect(session.execute({type:'step',ticks:4}).reading.physicalTime).toBe(1/120);}finally{clock.mockRestore();}
 });
 it('publishes one complete snapshot per batch and preserves source changes between requests',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0);
  const session=new WaterfallTerrainInspection();session.execute({type:'select',id:'storfossen'});session.execute({type:'running',running:true});
  const reference=new WaterfallTerrainComparisonRun(TERRAIN_COMPARISON_CASES.filter(c=>c.id==='storfossen'));reference.setRunning(true);
  const snapshots=vi.spyOn(WaterfallTerrainComparisonRun.prototype,'snapshot');
  try {
   for(const sourceOn of [true,false,true]){
    session.execute({type:'source',sourceOn});reference.setSourceOn(sourceOn);
    snapshots.mockClear();const actual=session.execute({type:'step',ticks:4});
    expect(snapshots).toHaveBeenCalledTimes(1);
    let expected=reference.snapshot();for(let i=0;i<4;i++)expected=reference.step();
    expect(physical(actual)).toEqual(physical(expected));
   }
   session.execute({type:'running',running:false});const before=session.snapshot();
   snapshots.mockClear();expect(session.execute({type:'step',ticks:4})).toEqual(before);expect(snapshots).toHaveBeenCalledTimes(1);
  }finally{snapshots.mockRestore();clock.mockRestore();}
 });
});
