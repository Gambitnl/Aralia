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
 * - The streamer is created *inside* the mount effect (not `useMemo`) and disposed in that same
 *   effect's cleanup. This is the StrictMode-safe disposable-resource pattern: under React's dev
 *   double-mount (setup → cleanup → setup) each setup builds a fresh streamer and each cleanup
 *   disposes the very instance it created, so the remounted tree always gets a *live* streamer.
 *   A `useMemo`-pinned streamer would instead be permanently disposed by the simulated-unmount
 *   cleanup, leaving the scene with a dead streamer that drops its first load batch and never
 *   streams again (observed live as a stuck, empty 3D world).
 */
import { type ChunkStreamerOptions } from '@/systems/world3d/chunkStreamer';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';
export interface UseChunkStreamingResult {
    loaded: LoadedChunk[];
    update: (worldX: number, worldZ: number) => void;
    pendingCount: number;
}
/**
 * Custom React hook that hosts a per-mount ChunkStreamer instance and exposes its loaded state.
 */
export declare function useChunkStreaming(loader: ChunkLoader, options?: ChunkStreamerOptions): UseChunkStreamingResult;
