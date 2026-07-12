/**
 * @file registry.test.ts — part registry invariants.
 * Spec: docs/superpowers/specs/2026-07-11-entity-generator-3d-design.md (Layer 2).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerPart, getPart, allParts, resetRegistryForTests } from '../registry';
import type { PartDef } from '../types';

const fieldPart = (id: string): PartDef => ({
  id,
  anchor: 'head',
  kind: 'field',
  buildField: (sink) => sink.ball(0, 0, 0, 0.1),
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
    const def = fieldPart('snoutTest');
    registerPart(def);
    expect(getPart('snoutTest')).toBe(def);
  });

  it('throws on duplicate id', () => {
    registerPart(fieldPart('dup'));
    expect(() => registerPart(fieldPart('dup'))).toThrow(/dup/);
  });

  it('throws on unknown id — no fallback path', () => {
    expect(() => getPart('nope')).toThrow(/nope/);
  });

  it('lists all registered parts', () => {
    registerPart(fieldPart('a'));
    registerPart(meshPart('b'));
    expect(allParts().map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('rejects a field part without buildField', () => {
    expect(() =>
      registerPart({ id: 'bad1', anchor: 'head', kind: 'field' }),
    ).toThrow(/buildField/);
  });

  it('rejects a mesh part without buildMesh', () => {
    expect(() =>
      registerPart({ id: 'bad2', anchor: 'head', kind: 'mesh' }),
    ).toThrow(/buildMesh/);
  });
});
