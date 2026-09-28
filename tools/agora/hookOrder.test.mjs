// tools/agora/hookOrder.test.mjs
// WF-G138: the hook-order helper must list hook calls per function in source
// order, mark conditional ones, and ignore hooks inside nested callbacks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hookOrderOf } from './hookOrder.mjs';

test('hookOrderOf lists hooks per function, flags conditional calls, skips callback-nested hooks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-hookorder-'));
  try {
    fs.writeFileSync(path.join(dir, 'Comp.tsx'), [
      'import React, { useState, useEffect, useRef, useMemo } from "react";',
      'function useThing() { const r = useRef(null); useEffect(() => { useState; }, []); return r; }',
      'export const Comp = React.memo(function Comp(props: { on: boolean }) {',
      '  const [a, setA] = useState(0);',
      '  const t = useThing();',
      '  if (props.on) { useEffect(() => {}, []); }',
      '  const cb = React.useCallback(() => { const x = useMemo(() => 1, []); return x; }, []);',
      '  const v = props.on && useMemo(() => 2, []);',
      '  return null;',
      '});',
      'const helper = (n: number) => n + 1;',
      '',
    ].join('\n'));
    const order = hookOrderOf('Comp.tsx', { repoRoot: dir });
    assert.deepEqual(order.useThing, ['useRef', 'useEffect'], 'the callback-nested useState is not counted');
    assert.deepEqual(order.Comp, ['useState', 'useThing', '?useEffect', 'useCallback', '?useMemo']);
    assert.equal(order.helper, undefined, 'a function with no hooks is omitted');
    assert.throws(() => hookOrderOf('nope.tsx', { repoRoot: dir }), /no such file/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
