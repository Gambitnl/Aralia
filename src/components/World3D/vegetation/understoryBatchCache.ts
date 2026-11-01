/** Keep the rendered plants when walking only recreates their input wrappers.
 * Compare the complete plant data, not a hash or just its object identity, so
 * live terrain and vegetation edits still rebuild through the existing code.
 * Each mounted field retains only its most recent inputs and result. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 14:59:47
 * Dependents: components/World3D/vegetation/UnderstoryField.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { UnderstoryChunkInput } from './UnderstoryField';

const FLOAT_FIELDS = ['positions', 'scales', 'rotations', 'colors'] as const;
interface InputSnapshot {
  offset: readonly number[];
  count: number;
  species: readonly string[];
  floats: readonly Uint8Array[];
}

function bytesEqual(values: Float32Array, saved: Uint8Array): boolean {
  if (values.byteLength !== saved.byteLength) return false;
  const current = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  for (let i = 0; i < current.length; i++) if (current[i] !== saved[i]) return false;
  return true;
}

function unchanged(chunks: readonly UnderstoryChunkInput[], saved: readonly InputSnapshot[]): boolean {
  if (chunks.length !== saved.length) return false;
  return chunks.every((chunk, i) => {
    const old = saved[i], data = chunk.understory;
    return chunk.offset.length === old.offset.length
      && chunk.offset.every((value, j) => Object.is(value, old.offset[j]))
      && Object.is(data.count, old.count)
      && data.species.length === old.species.length
      && data.species.every((value, j) => value === old.species[j])
      && FLOAT_FIELDS.every((field, j) => bytesEqual(data[field], old.floats[j]));
  });
}

/** The original builder still owns every position, color, normal and variant.
 * Byte copies also detect edits made in place, including a changed signed zero;
 * retaining references alone would miss those changes. No source array is edited. */
export function createUnderstoryBatchCache<T>(build: (chunks: readonly UnderstoryChunkInput[]) => T) {
  let previous: { inputs: InputSnapshot[]; value: T } | undefined;
  return (chunks: readonly UnderstoryChunkInput[]): T => {
    if (previous && unchanged(chunks, previous.inputs)) return previous.value;
    const value = build(chunks);
    const inputs = chunks.map(chunk => ({
      offset: [...chunk.offset], count: chunk.understory.count,
      species: [...chunk.understory.species],
      floats: FLOAT_FIELDS.map(field => {
        const values = chunk.understory[field];
        return new Uint8Array(values.buffer, values.byteOffset, values.byteLength).slice();
      }),
    }));
    previous = { inputs, value };
    return value;
  };
}
