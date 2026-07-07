# Staged, off-thread 3D world entry

**Date:** 2026-07-06
**Status:** BUILT + verified 2026-07-07 (both spikes passed; worker pipeline proven
end-to-end in a real browser). One gap: full in-game visual eyeball of the loading
screen is gated behind the game-entry flow. See progress note at the bottom.

## The problem

Entering the 3D world freezes the screen for close to a second. The freeze
comes from two heavy functions that run on the main thread the moment the 3D
wrapper mounts: `getWorldforgeLocalForCell` (about 325 ms) and `makeGroundWorld`
(about 445 ms). While they run, nothing paints and the page is dead to input.

Today the wait also *looks* like an error. The wrapper shows "World data is not
ready for 3D view. Use Open Map to return to the atlas"
(`src/components/World3D/World3DWrapper.tsx:978`) — a message that reads like
something broke, not like a world loading.

A separate note on where this came NOT from: an external performance report
blamed `?phase=webgpuprobe` and a heavy `useMemo` there. That page is a
developer hardware-parity probe, lazy-loaded and gated behind a query param; no
player ever loads it. The real freeze is on the player-facing 3D entry described
above, and that is what this spec fixes.

## Goal

Move the heavy world assembly off the main thread and build the world in stages,
so:

1. The main thread stays responsive during entry — the loading screen animates
   instead of freezing.
2. Terrain and the town appear first; props and gameplay wiring fill in after.
3. The world is byte-identical to today's, given the same seed.

## Non-goals

- **Per-chunk mesh generation on a worker.** As the player walks, each terrain
  chunk is meshed by the loader closure on the main thread. That is a real cost,
  but it belongs to the existing `createWorkerChunkLoader` machinery, which
  carries its own React StrictMode crash history. Out of scope here.
- **Any change to `?phase=webgpuprobe`.** The probe is meant to build its world
  synchronously; that is its job.
- **A themed or animated loading art scene.** Named stage text over a simple
  progress bar is the chosen treatment.

## Why this is feasible

The design rests on one fact confirmed in the code: the loader closure that
`createGroundChunkLoader` returns closes over **only the `ground` data object**
(`src/systems/worldforge/bridge/groundChunkLoader.ts:1657`). Its two helpers,
`sampleGroundChunk(ground, …)` and `buildGroundVegetation(ground, …)`, are pure
functions of that data. Nothing in the closure needs a live object that can't
cross a worker boundary.

So the split is clean:

- The **worker** builds the heavy `ground` data (plain arrays and objects).
- The **main thread** rebuilds the cheap loader closure from that data.

A second confirmed fact: the repo already has this exact worker pattern.
`createWorkerChunkLoader` spins up a worker, sends it serialized data via an
`init` message, correlates responses by request id, self-heals if the worker
dies, and accepts an injected fake worker for synchronous tests
(`src/components/World3D/createWorkerChunkLoader.ts:16-46`). The new world-gen
worker mirrors it rather than inventing anything.

`GroundWorld` looks structured-clone-safe: `SitePart` is plain numbers and
strings, and no class instances appear in the type. This is confirmed below as a
go/no-go spike, not assumed.

## Architecture

### One new world-gen worker

Add a `worldGenWorker` built on the same shape as `createWorkerChunkLoader`:

- The host posts a request: `{ wfSeed, entryCellId, centerPx, hour, deltas }` —
  all serializable.
- The worker runs the assembly and posts results back in stages (below), each
  tagged with the request id so a stale request from a previous mount is
  ignored.
- The worker is owned by the host, disposed on unmount, and respawns if it dies
  — the same self-healing lifecycle the chunk worker uses, for the same
  StrictMode reason.
- A synchronous in-process fake worker backs the unit tests.

### Three stages

The worker streams the world back in the order the player perceives it.

**Stage A — land and town.** The worker runs `getWorldforgeLocalForCell` then
`makeGroundWorld` **with the props pass skipped**. Props are already the final,
separable step of `makeGroundWorld`
(`src/systems/worldforge/bridge/groundChunkLoader.ts:489`), so this is a real
seam, not a rewrite. The worker posts `{ ground (props empty), local, region }`.
The host rebuilds the loader closure and hands it to `World3DScene`. Terrain,
town buildings, walls, roads, and water render. **This is the moment the player
can look around.**

**Stage B — dressing.** The worker runs `buildGroundProps` on the assembled
world and posts just the props array. The host patches `ground.props` and the
prop layer renders — market stalls, dock crates, wilderness cover.

**Stage C — gameplay wiring.** The NPC and shop registration loop
(`src/components/World3D/World3DWrapper.tsx:251-323`) stays on the main thread —
it dispatches Redux actions and reads live game state, so it cannot move to a
worker. It runs after Stage A paints, spread across idle frames so it never
blocks a frame. Buildings already show correct names before it finishes, because
`makeGroundWorld` has a deterministic name fallback
(`src/systems/worldforge/bridge/groundChunkLoader.ts:1130`). The only thing that
arrives late is *interactivity*: a shop becomes clickable a beat after the
player can walk. This was an explicit product decision (approved).

A subtlety that must survive this reordering: today the registration loop runs
*before* assembly, so `makeGroundWorld` sees the freshly registered businesses.
In the staged design the worker assembles *without* them. This is safe only
because the deterministic name fallback and the registration loop derive names
from the identical seed formula (`worldSeed + burgId + plotId` →
`generateBusinessName`, at `World3DWrapper.tsx:278` and
`groundChunkLoader.ts:1132`). The fallback name therefore equals the registered
name by construction. This invariant is load-bearing and is exactly what the
determinism gate below proves.

### Loading screen

Replace the error-looking placeholder with a staged loading view:

- Plain stage text that advances with the real stages: "Shaping the land…" →
  "Raising the town…" → "Scattering details…".
- A simple progress bar tied to stage completion.
- US spelling, plain wording, sentence case — house style.

Because assembly is off-thread, this screen animates smoothly instead of
freezing.

## Determinism — the hard acceptance gate

The worker-built world must equal today's main-thread world byte for byte, for a
fixed seed. Both paths run in the same JavaScript engine, so floating-point
results match; the risk is any hidden `Math.random` or unseeded state in the
assembly path. The assembly already runs on seeded PRNGs (`SeededRandom`,
`seedPath`), so this is a matter of proving it, not adding it.

Acceptance: a golden test runs assembly the old way (direct call, with
registered businesses passed in) and the new way (through the fake worker,
without them) for a set of fixed seeds and asserts the two `GroundWorld` results
are deep-equal, props included. Passing it proves both that the worker path is
deterministic and that the name-fallback invariant from Stage C holds.

## Feasibility spikes (do these first)

Two go/no-go checks before the full build. If either fails, we stop and rethink
before writing more code.

1. **Worker-safe import tree.** `makeGroundWorld` pulls a deep tree of worldforge
   modules. Confirm none of them touch `window` or `document` at import or call
   time, so they load inside a worker. Spike: import and run `makeGroundWorld`
   inside a worker for one seed and confirm it returns.
2. **Structured-clone round trip.** Post a fully built `GroundWorld` (props
   included) out of a worker and confirm it arrives intact and deep-equal. This
   catches any class instance or non-cloneable value the type inspection missed.

## Files touched (indicative)

- New: `src/components/World3D/worldGenWorker.ts` — the worker entry point.
- New: `src/components/World3D/createWorldGenClient.ts` — host-side client that
  owns the worker, streams stages, and rebuilds the loader closure. Mirrors
  `createWorkerChunkLoader`.
- New: a loading-screen component for the staged entry view.
- Change: `src/systems/worldforge/bridge/groundChunkLoader.ts` — split
  `makeGroundWorld` so the props pass can be skipped and run on its own
  (`makeGroundWorld({ withoutProps })` plus an exported props-only pass). The
  loader-closure builder becomes callable from an already-built `ground`.
- Change: `src/components/World3D/World3DWrapper.tsx` — replace the inline
  synchronous assembly in the ground `useEffect` with the staged worker client;
  swap the error-looking placeholder for the loading screen; move the
  registration loop to run after Stage A across idle frames.
- New tests: golden determinism test; worker-client stage-streaming test with a
  fake worker; loading-screen state test.

## Acceptance criteria

1. Entering the 3D world no longer freezes the main thread; the loading screen
   animates throughout.
2. Terrain and town render before props; props render before shop interactivity
   is required.
3. The staged loading screen shows honest stage text and progress, in house
   style, and never shows the old "not ready" error wording during a normal
   load.
4. The golden determinism test passes: worker-built world equals main-thread
   world for every fixed seed tested.
5. Both feasibility spikes passed before the full build landed.
6. No change to `?phase=webgpuprobe` behavior.

## Progress note — 2026-07-07 (built)

All infrastructure built test-first and wired into the live PLAYING 3D entry.

**Files:**
- `src/systems/worldforge/bridge/groundChunkLoader.ts` — added `skipProps` option,
  exported `computeGroundProps` (the Stage B pass) and `buildGroundLoaderFromWorld`
  (rebuild the loader closure from an assembled `ground`).
- `src/components/World3D/worldGenCore.ts` — pure two-stage orchestration + progress.
- `src/components/World3D/worldGenWorker.ts` — worker entry (thin glue).
- `src/components/World3D/createWorldGenClient.ts` — host client: owns the worker,
  streams stages, correlates by id, supersedes, self-heals, disposes.
- `src/components/World3D/WorldGenLoadingScreen.tsx` — staged loading view.
- `src/components/World3D/World3DWrapper.tsx` — ground `useEffect` now drives the
  worker client; registration deferred to idle after Stage A; props patched on
  Stage B; error-looking placeholder replaced by the loading screen.

**Verification:**
- 15 new unit tests + 2 feasibility spikes green.
- 165 worldforge/bridge regression tests green (split is behavior-preserving).
- 0 type errors, 0 lint errors in the changed files.
- All modules (incl. the worker) transform through Vite; the real worker runs
  end-to-end in a browser: progress → Stage A (terrain+town, loader rebuilt,
  props=0) → Stage B (props populated), all off the main thread.

**Open gap:** the in-game visual eyeball (character creation → spawn → Enter 3D →
see the loading screen give way to the world, props popping in) was not run — it
needs the full game-entry flow (and, per project notes, Ollama for the opening).
Everything up to that boundary is proven.

## Open

- Live in-game freeze-frame of the loading screen on a cold entry. The staged
  path runs live in the real game (proven via `window.__wfEntry` + a rendered
  scene, no errors), but the loading-label frames themselves were not captured —
  Stage A completes sub-second on a warm atlas.
