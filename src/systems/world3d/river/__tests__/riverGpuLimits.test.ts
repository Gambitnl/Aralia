import {describe,it,expect} from 'vitest';
import {assertRiverGpuBufferSizes,residentBufferSizes,residentSlots,riverGpuDispatch,riverRendererRequiredLimits,RIVER_RESIDENT_MAX_STEPS,RIVER_RESIDENT_TAIL} from '../riverGpuLimits';

const full={maxBufferSize:2147483648,maxStorageBufferBindingSize:2147483644};
const defaults={maxBufferSize:268435456,maxStorageBufferBindingSize:134217728};
describe('full-course GPU admission',()=>{
 it('requests the exact binding reported by the live course, within adapter capacity',()=>{
  const sizes=residentBufferSizes(4420,1339);
  // 2026-10-27: +640 bytes for the 32-step journal tail (RIVER_RESIDENT_TAIL 72 vec4s, was 32).
  expect(sizes[3]).toBe(190868912);
  expect(riverRendererRequiredLimits(full,4420,1339)).toEqual({maxStorageBufferBindingSize:190868912,maxBufferSize:284082240});
  expect(()=>assertRiverGpuBufferSizes({...defaults,...riverRendererRequiredLimits(full,4420,1339)},sizes,[1,2,3,4,5,6,7,8])).not.toThrow();
 });
 it('never requests unsupported limits, and refuses an insufficient device before allocation',()=>{
  expect(riverRendererRequiredLimits(defaults,4420,1339)).toEqual({});
  expect(()=>assertRiverGpuBufferSizes(defaults,residentBufferSizes(4420,1339),[1,2,3,4,5,6,7,8])).toThrow('binding 3 requires 190868912');
 });
 it('admits history by its actual size rather than assuming live no-history capacity',()=>{
  const live={...defaults,...riverRendererRequiredLimits(full,4420,1339)};
  expect(()=>assertRiverGpuBufferSizes(live,residentBufferSizes(4420,1339,8,true),[1,2,3,4,5,6,7,8])).toThrow();
  expect(()=>assertRiverGpuBufferSizes(full,residentBufferSizes(4420,1339,8,true),[1,2,3,4,5,6,7,8])).not.toThrow();
 });
 it('keeps small courses at default limits, and checks non-storage readback size separately',()=>{
  expect(riverRendererRequiredLimits(full,32,24)).toEqual({});
  expect(()=>assertRiverGpuBufferSizes(defaults,[32,128,284082240],[1])).toThrow('maxBufferSize');
  expect(()=>assertRiverGpuBufferSizes(defaults,[32,160000000],[])).not.toThrow();
 });
 it('covers the full course with a second workgroup row and guards only padding',()=>{
  const groups=Math.ceil(4420*1339/64),[x,y]=riverGpuDispatch(groups);
  expect([x,y]).toEqual([65535,2]);
  const covered=new Set<number>();
  for(let row=0;row<y;row++)for(let col=0;col<x;col++){const group=col+row*65535;if(group<groups)covered.add(group);}
  expect(covered.size).toBe(groups);expect(Math.max(...covered)).toBe(groups-1);
  expect((65534*64+63)).toBe(4194239);
  expect(0+64*65535).toBe(4194240);
  expect(riverGpuDispatch(1)).toEqual([1,1]);
 });
 it('rejects malformed dimensions before calculating GPU capacity',()=>{
  for(const args of [[0,10],[1.5,10],[0xffffffff,2]])expect(()=>residentBufferSizes(...args as [number,number])).toThrow();
  expect(()=>riverGpuDispatch(0)).toThrow();
 });
});

// 2026-10-27: longer resident intervals (more steps for each exchange).
describe('resident interval slots',()=>{
 it('gives the steps at the first time step plus two, within the capacity',()=>{
  // Slow water: the longest step (0.05 s) sets dt; 0.8 s needs 16 steps.
  expect(residentSlots(0.8,0.05,0.4,0.5,0.5)).toBe(18);
  // Fast water (wave 8 m/s): dt = 0.4 * 0.5 / 8 = 0.025 s; 0.8 s is past the capacity.
  expect(residentSlots(0.8,0.05,0.4,0.5,8)).toBe(RIVER_RESIDENT_MAX_STEPS);
  expect(residentSlots(1e-6,0.05,0.4,0.5,1)).toBe(3);
  expect(RIVER_RESIDENT_TAIL).toBe(8+2*RIVER_RESIDENT_MAX_STEPS);
 });
});
