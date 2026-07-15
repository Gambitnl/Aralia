/**
 * @file registry.test.ts — part registry invariants (body v2 kinds).
 * Spec: docs/superpowers/specs/2026-07-15-entity-body-v2-segments-design.md.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerPart, getPart, allParts, resetRegistryForTests } from '../registry';
import type { PartDef } from '../types';

const chainPart = (id: string): PartDef => ({
  id,
  anchor: 'tailRoot',
  kind: 'chain',
  buildChain: () => [
    { id: `${id}.0`, ax: 0, ay: 1, az: 0, bx: 0, by: 0.5, bz: -0.2, r0: 0.05, r1: 0.03 },
  ],
});

const meshPart = (id: string): PartDef => ({
  id,
  anchor: 'handR',
  kind: 'mesh',
  buildMesh: () => ({ object: { children: [] } as never }),
});

describe('entities3d part registry', () => {
  beforeEach(() => {
    resetRegistryForTests();
  });

  it('registers and returns a part by id', () => {
    const def = chainPart('tailTest');
    registerPart(def);
    expect(getPart('tailTest')).toBe(def);
  });

  it('throws on duplicate id', () => {
    registerPart(chainPart('dup'));
    expect(() => registerPart(chainPart('dup'))).toThrow(/dup/);
  });

  it('throws on unknown id — no fallback', () => {
    expect(() => getPart('nope')).toThrow(/nope/);
  });

  it('lists all registered parts', () => {
    registerPart(chainPart('a'));
    registerPart(meshPart('b'));
    expect(allParts().map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('rejects a chain part without buildChain', () => {
    expect(() =>
      registerPart({ id: 'bad1', anchor: 'tailRoot', kind: 'chain' }),
    ).toThrow(/buildChain/);
  });

  it('rejects a mesh part without buildMesh', () => {
    expect(() =>
      registerPart({ id: 'bad2', anchor: 'head', kind: 'mesh' }),
    ).toThrow(/buildMesh/);
  });
});
