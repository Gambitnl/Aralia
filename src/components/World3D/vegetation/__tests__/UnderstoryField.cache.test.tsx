/** Unchanged streamed plants must keep their rendered batches when walking
 * recreates the chunk wrappers. Real plant edits, including in-place edits,
 * must still reach the existing batching and ground-normal calculation. */
import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UnderstoryField, type UnderstoryChunkInput } from '../UnderstoryField';

type RenderBatch = { species: string; position: number[]; rotation: number[] };
function batches(node: ReturnType<typeof UnderstoryField>): RenderBatch[] {
  if (node && typeof node === 'object' && 'then' in node) {
    throw new Error('Expected the field to return its synchronous render tree');
  }
  const fragment = node as React.ReactElement<{ children: React.ReactNode }>;
  return React.Children.toArray(fragment.props.children).map(child =>
    (child as React.ReactElement<{ batch: RenderBatch }>).props.batch);
}
function plants(): UnderstoryChunkInput {
  return {
    offset: [0, 0, 0],
    understory: {
      positions: new Float32Array([1, 2, 3, 5, 2, 6]),
      scales: new Float32Array([1, 1]),
      rotations: new Float32Array([0, 0]),
      colors: new Float32Array([0.4, 0.5, 0.6, 0.4, 0.5, 0.6]),
      species: ['fern', 'fern'],
      count: 2,
    },
  };
}
function clone(chunk: UnderstoryChunkInput): UnderstoryChunkInput {
  const u = chunk.understory;
  return { offset: [...chunk.offset], understory: {
    positions: u.positions.slice(), scales: u.scales.slice(),
    rotations: u.rotations.slice(), colors: u.colors.slice(),
    species: [...u.species], count: u.count,
  } };
}

describe('UnderstoryField unchanged-content reuse', () => {
  it('retains every batch for fresh wrappers and byte-identical plant arrays', () => {
    const input = plants();
    const { result, rerender } = renderHook(({ chunks }) => UnderstoryField({ chunks }), {
      initialProps: { chunks: [input] },
    });
    const before = batches(result.current);
    const bytes = new Uint8Array(input.understory.positions.buffer).slice();
    rerender({ chunks: [clone(input)] });
    const after = batches(result.current);
    expect(after).toHaveLength(before.length);
    after.forEach((batch, i) => expect(batch).toBe(before[i]));
    expect(new Uint8Array(input.understory.positions.buffer)).toEqual(bytes);
  });

  const edits: Array<[string, (chunk: UnderstoryChunkInput) => void]> = [
    ['position', c => { c.understory.positions[0] += 1; }],
    ['scale', c => { c.understory.scales[0] += 0.25; }],
    ['rotation', c => { c.understory.rotations[0] += 0.125; }],
    ['color', c => { c.understory.colors[0] += 0.1; }],
    ['species', c => { c.understory.species[0] = 'log'; }],
    ['offset', c => { c.offset = [0.5, 0, 0]; }],
    ['count', c => { c.understory.count = 1; }],
  ];
  it.each(edits)('rebuilds after a real %s edit even when wrappers are retained', (_name, edit) => {
    const input = plants(), chunks = [input];
    const { result, rerender } = renderHook(({ chunks }) => UnderstoryField({ chunks }), {
      initialProps: { chunks },
    });
    const before = batches(result.current);
    edit(input);
    rerender({ chunks });
    expect(batches(result.current)).not.toEqual(before);
  });

  it('preserves a changed signed zero instead of treating it as the old rotation', () => {
    const input = plants(), chunks = [input];
    const { result, rerender } = renderHook(({ chunks }) => UnderstoryField({ chunks }), {
      initialProps: { chunks },
    });
    input.understory.rotations[0] = -0;
    rerender({ chunks });
    expect(batches(result.current).some(b => b.rotation.some(r => Object.is(r, -0)))).toBe(true);
  });

  it('drops cleared chunks and rebuilds their original plants on return', () => {
    const input = plants();
    const { result, rerender } = renderHook(({ chunks }) => UnderstoryField({ chunks }), {
      initialProps: { chunks: [input] },
    });
    const before = batches(result.current);
    rerender({ chunks: [] });
    expect(batches(result.current)).toEqual([]);
    rerender({ chunks: [input] });
    expect(batches(result.current)).toEqual(before);
  });
});
