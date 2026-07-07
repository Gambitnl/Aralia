# Off-thread ground chunk meshing

**Date:** 2026-07-07
**Status:** BUILT + verified 2026-07-07. All acceptance criteria met bar a live
in-game re-render check (blocked this attempt by dummy-party state — no errors
from the change). See progress note at the bottom.

## The problem

Walking in the 3D ground world stutters. Each terrain chunk is meshed on the
main thread as the player moves. The loader runs three functions per chunk —
`sampleGroundChunk`, `buildChunkBundle`, and `buildGroundVegetation` — and they
block the frame while they run.

The continent path does not have this problem. It meshes chunks in a Web Worker
(`createWorkerChunkLoader` → `chunkWorker`). Ground mode skips that worker and
uses an inline closure instead (`buildGroundLoaderFromWorld`), so all its mesh
work lands on the main thread.

This is the follow-on to the staged-entry work
(`2026-07-06-staged-offthread-3d-world-entry-design.md`), which moved world
*generation* off-thread. This moves chunk *meshing* off-thread.

## Goal

Mesh ground chunks in a Web Worker, so walking stays smooth. The meshes must be
identical to the ones the main thread builds today.

## Why this is low-risk

Two facts make this a mirror of code that already works.

1. The ground mesh functions are pure functions of `GroundWorld`. They read
   `heights`, `biomeIds`, `features`, and config constants. They touch no DOM.
   So they run unchanged in a worker.
2. `GroundWorld` survives structured clone. This was proven in the staged-entry
   spike, so it can be sent into a worker as init data.

The continent path already shows the exact pattern to copy: init a worker with
the world data, answer chunk requests by id, transfer the mesh buffers back,
and respawn the worker if it dies.

## Non-goals

- The prop layer. Props are a separate scene layer, not per-chunk mesh, so the
  mesh worker never needs them and never re-inits when props arrive (Stage B).
- Townsfolk and agent animation. Handled elsewhere.
- The continent path. It already meshes off-thread and stays untouched.
- Worker pools, `SharedArrayBuffer`, or other throughput optimizations. Build the
  single-worker baseline first, measure the real stutter, then optimize only if
  it is still there.

## Architecture

Three new files, each mirroring an existing sibling on the continent path.

**`groundChunkWorkerCore.ts`** — the pure function
`handleGroundChunkRequest(ground, { cx, cy, resolution })` that returns a
`ChunkMeshBundle`. It is extracted from the current loader-closure body, so the
closure and the worker both call it. One source of truth for ground meshing.
Mirrors `chunkWorkerCore.ts`.

**`groundChunkWorker.ts`** — the worker entry. It receives the `GroundWorld` once
via an `init` message, then answers `load` requests with mesh bundles, and
transfers the array buffers back for a zero-copy hand-off. Mirrors
`chunkWorker.ts`.

**`createGroundWorkerChunkLoader.ts`** — a self-healing, disposable
`ChunkLoader` backed by one worker. It owns the worker, correlates each request
by id, respawns the worker if it dies, and re-sends stranded requests. Mirrors
`createWorkerChunkLoader.ts`.

### The StrictMode point

A prior ground-worker attempt (noted as "W3DUI-1" in `World3DWrapper.tsx`) was
reverted because React StrictMode's dev double-mount terminated the worker out of
band, leaving the streamer posting to a dead worker — the empty 3D world bug.
The self-healing loader is the fix for exactly that, and it is why
`createWorkerChunkLoader` exists. This design uses the same one-effect
setup-and-dispose lifecycle, so the committed tree always holds a live worker.

## Wiring

In the `onStageA` callback added by the staged-entry work, replace the inline
`disposable` loader with `createGroundWorkerChunkLoader(ground)`. Dispose it in
the effect cleanup, next to the world-gen client's dispose.

The mesh worker is init with the Stage A ground (props empty). That is correct:
meshing never reads props. When Stage B patches props into the scene, the mesh
worker is not touched.

One extra structured clone happens at entry: the ground is cloned from the
gen worker back to the main thread, then again into the mesh worker. This is a
one-time cost per 3D entry, off the walking path, so it is acceptable.

## Determinism gate

The worker's mesh must equal the main thread's mesh for the same chunk. Both call
`handleGroundChunkRequest`, so this holds by construction. A golden test proves
it: for a fixed seed and several chunks, assert `handleGroundChunkRequest(ground,
req)` deep-equals the output of the current `buildGroundLoaderFromWorld(ground)`
closure.

## Testing

- `groundChunkWorkerCore.test.ts` — the core's output equals the current
  closure's output, chunk for chunk (the determinism gate).
- `createGroundWorkerChunkLoader.test.ts` — with an injected synchronous fake
  worker: resolves a load, correlates concurrent loads, honors the requested LOD
  resolution, respawns after the worker dies, and stops after dispose. Mirrors
  `createWorkerChunkLoader.test.ts`.

## Acceptance criteria

1. Ground chunks mesh in a worker; the main thread no longer runs
   `sampleGroundChunk` / `buildChunkBundle` / `buildGroundVegetation` while
   walking.
2. The golden test passes: worker meshes deep-equal today's main-thread meshes.
3. The loader self-heals under StrictMode — no empty 3D world, no posting to a
   dead worker.
4. Props, townsfolk, and the continent path are unchanged.
5. The world still loads and renders on a real 3D entry.

## Progress note — 2026-07-07 (built)

Built test-first, mirroring the continent worker.

**Files:**
- `src/systems/worldforge/bridge/groundChunkWorkerCore.ts` — pure
  `handleGroundChunkRequest(ground, {cx,cy,resolution})`.
- `src/components/World3D/groundChunkWorker.ts` — worker entry (init with ground,
  transfer mesh buffers back).
- `src/components/World3D/createGroundWorkerChunkLoader.ts` — self-healing,
  disposable loader.
- `src/systems/worldforge/bridge/groundChunkLoader.ts` — `buildGroundLoaderFromWorld`
  now delegates to `handleGroundChunkRequest` (one source of truth).
- `src/components/World3D/World3DWrapper.tsx` — `onStageA` builds a
  `createGroundWorkerChunkLoader(ground)`, disposed in cleanup.

**Verification:**
- 6 new tests: the equivalence gate (worker core mesh deep-equals the old inline
  closure, every LOD, every chunk) + the loader protocol (resolve, correlate,
  LOD, self-heal, dispose).
- 181 worldforge/bridge regression tests green (loader refactor is
  behavior-preserving).
- 0 type errors, 0 new lint errors in the changed files.
- The real ground worker meshed a chunk end-to-end in a browser: spawned, init'd
  with the GroundWorld via structured clone, returned 867 terrain vertices with
  normals off the main thread.

**Open gap:** a live in-game re-render check (walk into 3D and confirm chunks
stream from the worker in the running game) did not complete this attempt. The
dummy party used for headless testing has no entry cell, so 3D entry bailed
cleanly — no errors from this change. The same wiring path was proven to render
3D earlier the same day with a resumed save; the only change since is the
drop-in loader swap.

## Open

- Live in-game re-render check — confirm chunks stream from the worker in the
  running game. Blocked this attempt by dummy-party state (no entry cell); no
  errors came from the change, and the worker meshed a real chunk off-thread in
  a browser.
