import { renderHook, act, waitFor } from '@testing-library/react';
import { useChunkStreaming } from '../useChunkStreaming';
import type { ChunkMeshBundle, ChunkLoader } from '@/systems/world3d/types';

const fakeBundle = (cx = 0, cy = 0): ChunkMeshBundle => ({
  cx,
  cy,
  terrain: {
    positions: new Float32Array(0),
    indices: new Uint32Array(0),
    normals: new Float32Array(0),
    colors: new Float32Array(0),
  },
  sites: [],
});
const loader: ChunkLoader = async (cx, cy) => fakeBundle(cx, cy);

it('exposes loaded chunks after an update', async () => {
  const { result } = renderHook(() => useChunkStreaming(loader, { loadRadius: 1, unloadRadius: 2 }));
  expect(result.current.loaded).toHaveLength(0);
  act(() => { result.current.update(0, 0); });
  await waitFor(() => expect(result.current.loaded.length).toBe(9));
});
