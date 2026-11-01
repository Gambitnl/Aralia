/** The faster readback guard must accept and reject exactly the same Float32
 * values as the old callback scan; no water value is changed or rounded here. */
import { describe, expect, it } from 'vitest';
import { residentReadbackIsFinite } from '../riverGpuResident';

describe('resident GPU readback finite validation', () => {
  it('preserves every finite bit pattern, including negative zero and subnormals', () => {
    const bits=new Uint32Array([0,0x80000000,1,0x80000001,0x7f7fffff,0xff7fffff,0x3f800000]);
    const values=new Float32Array(bits.buffer),before=bits.slice();
    expect(residentReadbackIsFinite(values)).toBe(values.every(Number.isFinite));
    expect(residentReadbackIsFinite(values)).toBe(true);
    expect(bits).toEqual(before);
  });
  it.each([0x7f800000,0xff800000,0x7fc00000,0x7f800001,0xffc12345])('rejects nonfinite pattern %i at every boundary', bits => {
    for(const at of [0,31,63]){
      const words=new Uint32Array(64).fill(0x3f000000);words[at]=bits;
      const values=new Float32Array(words.buffer);
      expect(residentReadbackIsFinite(values)).toBe(values.every(Number.isFinite));
      expect(residentReadbackIsFinite(values)).toBe(false);
      expect(words[at]).toBe(bits);
    }
  });
  it('matches the native predicate for a deterministic spread of raw Float32 bits', () => {
    let seed=7123;
    for(let batch=0;batch<128;batch++){
      const bits=new Uint32Array(128);
      for(let i=0;i<bits.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;bits[i]=seed;}
      const values=new Float32Array(bits.buffer);
      expect(residentReadbackIsFinite(values)).toBe(values.every(Number.isFinite));
    }
  });
  it('retains the native empty and detached-array behavior', () => {
    expect(residentReadbackIsFinite(new Float32Array())).toBe(true);
    const values=new Float32Array(4);
    structuredClone(values,{transfer:[values.buffer]});
    // The DOM test environment and Node transfer can produce different error
    // prototypes. Match the native rejection text across those realms.
    expect(()=>values.every(Number.isFinite)).toThrow('detached ArrayBuffer');
    expect(()=>residentReadbackIsFinite(values)).toThrow('detached ArrayBuffer');
  });
});
