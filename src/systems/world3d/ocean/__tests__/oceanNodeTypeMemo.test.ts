/**
 * The build-time type memo (oceanNodeTypeMemo.ts, GG-388): a hit returns what
 * the walk returned, only in the generate stage, per node cache, per stage and
 * output, and per class (a subclass that calls super gets the parent's answer).
 * Stand-in classes, so the test counts the walks.
 */
import { describe, expect, it } from 'vitest';
import { installNodeTypeMemo } from '../oceanNodeTypeMemo';

function makeClasses() {
  const calls = { base: 0, leaf: 0, sum: 0 };
  class Base { getNodeType(_builder?: unknown, _output?: string): string { calls.base += 1; return 'float'; } }
  class Leaf extends Base {
    constructor(public t: string) { super(); }
    getNodeType(): string { calls.leaf += 1; return this.t; }
  }
  class Sum extends Base {
    constructor(public a: { getNodeType(b: unknown, o?: string): string }, public b: { getNodeType(b: unknown, o?: string): string }) { super(); }
    getNodeType(builder: unknown, output?: string): string {
      calls.sum += 1;
      const ta = this.a.getNodeType(builder);
      const tb = this.b.getNodeType(builder);
      if (output === 'bool') return 'bool';
      return ta.length >= tb.length ? ta : tb;
    }
  }
  class Super extends Base { getNodeType(builder: unknown): string { return `super:${super.getNodeType.call(this, builder)}`; } }
  return { calls, Base, Leaf, Sum, Super };
}

const builder = (stage: string | null, cache: object = {}, shaderStage = 'fragment') => ({ buildStage: stage, shaderStage, getCache: () => cache });

describe('installNodeTypeMemo', () => {
  it('walks a shared graph once a node in the generate stage, with the same answer', () => {
    const K = makeClasses();
    expect(installNodeTypeMemo({ Base: K.Base, Leaf: K.Leaf, Sum: K.Sum, Super: K.Super, n: 3 })).toBe(4);
    // A chain where each level uses the one below twice: 2^depth paths unmemoized.
    let node: InstanceType<typeof K.Sum> | InstanceType<typeof K.Leaf> = new K.Leaf('vec3');
    for (let i = 0; i < 16; i += 1) node = new K.Sum(node, node);
    const b = builder('generate');
    expect(node.getNodeType(b)).toBe('vec3');
    expect(K.calls.sum).toBe(16);
    expect(K.calls.leaf).toBe(1);
    expect(node.getNodeType(b)).toBe('vec3');
    expect(K.calls.sum).toBe(16);
  });

  it('does not memoize outside the generate stage', () => {
    const K = makeClasses();
    installNodeTypeMemo({ Base: K.Base, Leaf: K.Leaf, Sum: K.Sum });
    const leaf = new K.Leaf('vec2');
    const s = new K.Sum(leaf, leaf);
    const b = builder('setup');
    s.getNodeType(b); s.getNodeType(b);
    expect(K.calls.sum).toBe(2);
    expect(K.calls.leaf).toBe(4);
  });

  it('keys on the output type, the shader stage and the node cache', () => {
    const K = makeClasses();
    installNodeTypeMemo({ Base: K.Base, Leaf: K.Leaf, Sum: K.Sum });
    const s = new K.Sum(new K.Leaf('vec4'), new K.Leaf('vec2'));
    const cache = {};
    expect(s.getNodeType(builder('generate', cache))).toBe('vec4');
    expect(s.getNodeType(builder('generate', cache), 'bool')).toBe('bool');
    expect(s.getNodeType(builder('generate', cache, 'vertex'))).toBe('vec4');
    expect(s.getNodeType(builder('generate', {}))).toBe('vec4');
    expect(K.calls.sum).toBe(4);
  });

  it('keeps each class its own memo, so super returns the parent answer', () => {
    const K = makeClasses();
    installNodeTypeMemo({ Base: K.Base, Super: K.Super });
    const n = new K.Super();
    const b = builder('generate');
    expect(n.getNodeType(b)).toBe('super:float');
    expect(n.getNodeType(b)).toBe('super:float');
    expect(K.calls.base).toBe(1);
  });

  it('installs once', () => {
    const K = makeClasses();
    expect(installNodeTypeMemo({ Leaf: K.Leaf })).toBe(1);
    expect(installNodeTypeMemo({ Leaf: K.Leaf })).toBe(0);
  });
});
