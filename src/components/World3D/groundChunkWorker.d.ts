/**
 * @file groundChunkWorker.ts
 * @description Web Worker entry for GROUND chunk meshing. Thin glue around
 * handleGroundChunkRequest — receives the assembled GroundWorld once via an
 * `init` message, then answers `load` requests with mesh bundles. Mirrors
 * chunkWorker.ts (the continent path).
 *
 * Why this is built this way:
 * - Meshing large ground heightfields per chunk is expensive; running it here
 *   keeps the React main thread smooth while the player walks.
 * - Transferable objects: the Float32Array / Uint32Array backing buffers are
 *   passed as the second argument of postMessage, transferring ownership without
 *   a deep copy (zero-copy hand-off).
 *
 * Known limitations/deferred issues:
 * - Web Workers do not run in Node/jsdom/Vitest. All mesh logic therefore lives
 *   in the pure, synchronously-testable groundChunkWorkerCore.ts.
 */
export {};
