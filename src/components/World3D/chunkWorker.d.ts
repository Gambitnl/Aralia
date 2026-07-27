/**
 * @file chunkWorker.ts
 * @description Web Worker entry. Thin glue around handleChunkRequest — receives the WorldData
 * once via an `init` message, then answers `load` requests with geometry arrays.
 *
 * Why this is built this way:
 * - Real-time mesh generation of large 3D heightfields is computationally expensive.
 *   Running this task on a background worker thread keeps the React main render thread
 *   silky-smooth at 60fps.
 * - Transferable objects: The Float32Array and Uint32Array backing buffers are passed in
 *   the second argument of postMessage. This transfers ownership of the memory instantly
 *   without doing any deep copies, making off-thread rendering zero-overhead.
 *
 * Known limitations/deferred issues:
 * - Web Workers do not run in Node/jsdom/Vitest environments. Therefore, all worker core logic
 *   lives inside pure, synchronously-testable modules (chunkWorkerCore.ts) so we maintain test coverage.
 */
export {};
