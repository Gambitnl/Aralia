/**
 * @file worldGenWorker.ts
 * @description Web Worker entry for staged, off-thread 3D world entry. Thin glue
 * around `runWorldGen` — receives a `generate` request, runs the two-stage
 * assembly OFF the main thread, and posts each stage back as it completes.
 *
 * Why this is built this way:
 * - `getWorldforgeLocalForCell` + `makeGroundWorld` are hundreds of milliseconds
 *   of synchronous CPU. Running them here keeps the React main thread responsive,
 *   so the staged loading screen animates instead of freezing.
 * - No-fallback directive: if assembly throws, the failure is posted back as an
 *   `error` message for the host to surface — never silently swallowed.
 *
 * Known limitations/deferred issues:
 * - Web Workers do not run in Node/jsdom/Vitest. All logic therefore lives in the
 *   pure, synchronously-testable `worldGenCore.ts`; this file is untestable glue,
 *   matching chunkWorker.ts / chunkWorkerCore.ts.
 */
export {};
