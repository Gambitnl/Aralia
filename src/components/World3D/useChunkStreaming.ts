/**
 * @file useChunkStreaming.ts
 * @description React binding for ChunkStreamer. Creates one streamer per mount, re-renders
 * when its loaded set changes (via useSyncExternalStore), and exposes update().
 *
 * Why this is built this way:
 * - `useSyncExternalStore` is React's recommended hook for subscribing to external stateful
 *   objects, ensuring no rendering glitches, race conditions, or state tearing.
 * - Snapshots are cached referentially using `snapshotRef` because React requires referential
 *   stability for `getSnapshot` when no actual loaded set change occurred, preventing
 *   infinite re-render loops.
 * - `.dispose()` is called on unmount inside `useEffect` to safely cancel all in-flight loaders,
 *   preventing memory leaks.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ChunkStreamer, type ChunkStreamerOptions } from '@/systems/world3d/chunkStreamer';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';

export interface UseChunkStreamingResult {
  loaded: LoadedChunk[];
  update: (worldX: number, worldZ: number) => void;
  pendingCount: number;
}

/**
 * Custom React hook that hosts a persistent ChunkStreamer instance and exposes its loaded state.
 */
export function useChunkStreaming(
  loader: ChunkLoader,
  options?: ChunkStreamerOptions,
): UseChunkStreamingResult {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streamer = useMemo(() => new ChunkStreamer(loader, options), []);

  useEffect(() => {
    return () => streamer.dispose();
  }, [streamer]);

  // Keep a stable snapshot reference to avoid infinite re-renders when React compares state
  const snapshotRef = useRef<LoadedChunk[]>([]);
  const subscribe = useCallback((cb: () => void) => streamer.onChange(cb), [streamer]);
  
  const getSnapshot = useCallback(() => {
    const next = streamer.getLoaded();
    // Verify structural equality so we only swap the array reference when content changed
    const current = snapshotRef.current;
    if (
      current.length === next.length &&
      current.every((c, idx) => c.cx === next[idx].cx && c.cy === next[idx].cy && c.lod === next[idx].lod)
    ) {
      return current;
    }
    snapshotRef.current = next;
    return next;
  }, [streamer]);

  const loaded = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const update = useCallback((worldX: number, worldZ: number) => streamer.update(worldX, worldZ), [streamer]);

  return { loaded, update, pendingCount: streamer.pendingCount };
}
