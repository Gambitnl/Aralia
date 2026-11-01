/**
 * The shared-sampler plan (oceanSharedSamplers.ts, GG-388): no plan at or
 * under the limit; over it, one sampler per state per group; the declarations
 * leave the block and the later binding numbers move down.
 */
import { describe, expect, it } from 'vitest';
import { planSharedSamplers, samplerKey, stripSamplerDeclarations } from '../oceanSharedSamplers';

const clamp = { wrapS: 1001, wrapT: 1001, wrapR: 1001, magFilter: 1006, minFilter: 1008, anisotropy: 1 };
const repeat = { ...clamp, wrapS: 1000, wrapT: 1000 };
const smp = (name: string, texture: object) => ({ isSampler: true, name, texture });
const tex = (name: string) => ({ name });

describe('planSharedSamplers', () => {
  it('leaves a stage at or under the limit alone', () => {
    const g = { object: [smp('a_sampler', clamp), tex('a'), smp('b_sampler', clamp), tex('b')] };
    expect(planSharedSamplers(g, 2)).toBeNull();
  });
  it('keeps the first sampler of each state and maps the rest to it', () => {
    const g = { object: [smp('a_sampler', clamp), tex('a'), smp('b_sampler', repeat), tex('b'), smp('c_sampler', clamp), tex('c'), smp('d_sampler', repeat), tex('d')] };
    const plan = planSharedSamplers(g, 3);
    expect(plan).not.toBeNull();
    expect([...(plan as Map<string, Map<string, string>>).get('object')!.entries()]).toEqual([['c_sampler', 'a_sampler'], ['d_sampler', 'b_sampler']]);
  });
  it('keys the state on wrap, filters, anisotropy and compare', () => {
    expect(samplerKey(clamp)).toBe(samplerKey({ ...clamp }));
    expect(samplerKey(clamp)).not.toBe(samplerKey(repeat));
    expect(samplerKey(clamp)).not.toBe(samplerKey({ ...clamp, anisotropy: 4 }));
    expect(samplerKey({ ...clamp, isDepthTexture: true, compareFunction: 515 })).not.toBe(samplerKey(clamp));
  });
});

describe('stripSamplerDeclarations', () => {
  it('removes the dropped lines and moves the later bindings of that group down', () => {
    const block = [
      '@binding( 0 ) @group( 1 ) var a_sampler : sampler;',
      '@binding( 1 ) @group( 1 ) var a : texture_2d<f32>;',
      '@binding( 2 ) @group( 1 ) var c_sampler : sampler;',
      '@binding( 3 ) @group( 1 ) var c : texture_2d<f32>;',
      '@binding( 0 ) @group( 0 ) var z : texture_2d<f32>;',
      'struct S { x : f32 };',
      '@binding( 4 ) @group( 1 )',
      'var<uniform> s : S;',
    ].join('\n');
    const r = stripSamplerDeclarations(block, new Set(['c_sampler']), new Map());
    expect(r.block).toBe([
      '@binding( 0 ) @group( 1 ) var a_sampler : sampler;',
      '@binding( 1 ) @group( 1 ) var a : texture_2d<f32>;',
      '@binding( 2 ) @group( 1 ) var c : texture_2d<f32>;',
      '@binding( 0 ) @group( 0 ) var z : texture_2d<f32>;',
      'struct S { x : f32 };',
      '@binding( 3 ) @group( 1 )',
      'var<uniform> s : S;',
    ].join('\n'));
    expect(r.removed.get(1)).toEqual([2]);
  });
});
