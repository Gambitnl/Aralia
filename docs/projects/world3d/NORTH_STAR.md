# World 3D System North Star

Status: active
Last updated: 2026-06-02

> The **3D rendering engine** for Aralia's Azgaar-driven streamed 3D world: chunk streaming,
> per-chunk mesh generation, and the R3F scene. One of three distinct surfaces (not
> consolidated — each owns a separate concern):
> - **this surface (`world3d`)** — the rendering engine.
> - `worldsim-service` — world generation + simulation; produces the `WorldData` this consumes.
> - `world-3d-ui` — the 2D↔3D transition + in-3D HUD that drives this engine.
> Owner: claude.

## Why This Project Exists

Aralia is replacing the legacy grid world-map + submap layers with a single massive,
streamed 3D world. This surface owns the **rendering technique** half of that: turning a
`WorldData` snapshot into streamed, biome-colored 3D terrain with rivers, roads, site
exteriors, and vegetation, around a free-roam camera, at 60fps. It deliberately does **not**
own how the world is generated (that is `worldsim-service`) or how the player enters/exits it
and what HUD sits on top (that is `world-3d-ui`). Keeping the engine pure keeps the hard-won
rendering knowledge (below) from being diluted by transition/generation concerns.

Governing design spec: `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md`.

## Intended Outcome

A deterministic, worker-offloadable rendering engine that streams chunks around the camera
and draws biome terrain + water + roads + site exteriors + vegetation from `WorldData`,
exposing a clean scene API that `world-3d-ui` can mount, drive, and overlay.

## Current State

Implemented and rendering. As of 2026-06-01:

- **Streaming + meshes done:** coords/config/chunkManager/lod/sampler/streamer/worker +
  `ChunkMeshBundle` (Plan 2 + Plan 3). Biome-colored terrain, river water ribbons, road
  ribbons, site boxes, instanced vegetation all render.
- **Rendering hardening done:** floating-origin (scene drawn near 0,0), vegetation cap,
  shadows dropped + WebGL context-loss recovery, and a concrete canvas height — the last of
  which was the decisive fix that made terrain visible.
- **Verified live:** `?phase=world3d` renders streamed terrain, no context loss, no console
  errors. 70 unit tests pass across `src/systems/world3d` + `src/components/World3D`;
  `tsc --noEmit` clean for world3d.
- **T4 done (2026-06-01):** the demo now feeds the **real** `generateMap(...).worldData`
  pipeline (varied biomes, flow-traced rivers, MST roads, ~30 towns) and spawns the camera on
  the first town. Live screenshot confirms biome variety renders (ocean meeting a landmass)
  instead of uniform plains.
- **T8 done (2026-06-02):** **vertical exaggeration** added. `config.VERTICAL_EXAGGERATION=12`
  feeds a single pure `heightToMeters(height)` helper that the terrain, water, road, **and**
  vegetation builders all route their Y-mapping through (lockstep — ribbons/trees stay welded to
  the surface). The camera and the demo spawn lift to the ground elevation (demo now spawns on
  the highest-*local-relief* town). Live `?phase=world3d` shows a clear peaked ridge against the
  sky where it was a near-flat plane. **While verifying, fixed a separate blocker (W3D-G17):**
  `useChunkStreaming` disposed its `useMemo`-pinned streamer on StrictMode's dev double-mount, so
  the live scene silently streamed **0 chunks** (blank/sky); the streamer is now created per-mount
  inside the effect (StrictMode-safe), and 81 chunks load live. 76 world3d tests pass.

**Residual relief limitation (→ W3D-G16):** the streamed window (`LOAD_RADIUS×CHUNK_WORLD_SIZE`
≈ 512 m) is smaller than one `METERS_PER_CELL` (1024 m) height cell, so the camera sees ≤ ~1 cell
and relief reads as a single smooth ridge rather than rolling hills. Widening the visible window
(without exploding chunk count, and without touching the `METERS_PER_CELL` world↔grid contract
owned with `world-3d-ui`) is the deeper follow-up. Also discovered: town boxes are buried under
the exaggerated terrain (→ W3D-G15, next task) and duplicate site React keys (→ W3D-G18).

## Active Task

| Field | Value |
|---|---|
| Task | T10 — seat **site/town boxes on the terrain surface** so they are visible (W3D-G15). They currently render at `Y=radius*0.5` (a few meters up), so with the new vertical exaggeration they are buried hundreds of meters under the ground. |
| Acceptance criteria | A clean load of `?phase=world3d` shows a town box sitting *on* the terrain surface in a town-containing chunk (not buried, not floating). |
| Allowed boundaries | `src/systems/world3d/siteGeometry.ts` (+ its sampler input), `src/systems/world3d/chunkSampler.ts`, `src/components/World3D/World3DScene.tsx` `SitePieces`. Reuse the shared `heightToMeters` so boxes track the same exaggerated surface as terrain. Do NOT touch entry/transition (`world-3d-ui`) or `worldSim` generation (`worldsim-service`). |
| Stop condition | Stop when town boxes sit on the ground; do not also do biome blending (T9), lakes (T6), LOD (T7), or the view-window widening (W3D-G16) in the same slice. |
| Verification | dev-start, navigate `?phase=world3d` (the demo spawns on the highest-relief town; may take 2-3 tries due to the world-3d-ui entry bounce; the Ollama modal overlay can be hidden via DOM for screenshots), screenshot shows a town box on the surface. |
| Owner | unassigned |
| Next action | Add a sampled surface Y to `ChunkSite` (sample `world.heights` at the site cell → `heightToMeters`) and seat the box center at `surfaceY + radius*0.5` in `SitePieces`. Fold in W3D-G18 (chunk-scope the React key) if cheap. |

## Scope Boundaries

In scope:
- `src/systems/world3d/*` (coords, config, chunkManager, lod, sampler, geometry builders, streamer, bundle, sceneOrigin) and the **rendering** parts of `src/components/World3D/` (World3DScene + chunk pieces, FreeRoamCameraController, useChunkStreaming, chunkWorker, createWorkerChunkLoader).
- Consuming `WorldData`; per-chunk mesh fidelity; LOD; rendering performance/robustness.

Out of scope (owned elsewhere):
- 2D↔3D transition, Azgaar atlas marker sync, `playerWorldPos`, phase/entry routing, in-3D HUD — `world-3d-ui` (this is "Plan 4").
- World generation, history/story/events — `worldsim-service`.
- PBR textures, animated water shaders, glTF models; combat `BattleMap3D`.

## What Must Not Be Lost

- **The "why it was blank" knowledge:** three stacked causes — WebGL context loss (shadow
  load + repeated remounts), extreme world coordinates (~30k, METERS_PER_CELL=1024), and a
  collapsed 150px canvas (`height:100%` never resolved). All fixed; canvas-height was decisive.
  Do not reintroduce `shadows` on the streamed world or `height:100%` on the scene container
  without re-verifying.
- The deterministic, worker-offloadable, unit-tested core (sampler → builders → bundle). Keep
  rendering changes in the React shell; keep logic pure.
- The `ChunkMeshBundle` contract (Plan-3 seam). Do not regress to raw `ChunkGeometryArrays`.
- Unfinished optionality: worker loader, polylineClip, per-LOD detail, lakes — present and
  intentionally not yet fully wired; do not delete as "unused."

## Known Gaps And Follow-Ups

See `docs/projects/world3d/GAPS.md`. Headline rendering-owned gaps:

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Flat terrain relief (W3D-G11) | **done** | claude | T8: `VERTICAL_EXAGGERATION=12` + `heightToMeters`; live ridge | resolved by T8 |
| **Site/town boxes buried under exaggerated terrain (W3D-G15)** | adjacent_follow_up | unassigned | `SitePieces` Y=`radius*0.5`; `ChunkSite` has no surface Y | **active task (T10)** — seat boxes on the surface |
| Sub-cell view window flattens relief (W3D-G16) | adjacent_follow_up | unassigned | window ≈512 m vs `METERS_PER_CELL=1024` → ≤1 cell visible | widen visible window w/o exploding chunk count |
| StrictMode-killed streamer → blank live scene (W3D-G17) | **done** | claude | live `loadOk=4, chunks=0` → fixed → `chunks=81` | resolved during T8 (per-mount streamer) |
| Duplicate site React keys (W3D-G18) | adjacent_follow_up | unassigned | console "two children with same key" | chunk-scope the key / de-dupe sites (T11) |
| Hard biome-color seams (no blending) (W3D-G12) | adjacent_follow_up | unassigned | `sampleBiomeNearest` + per-vertex color | feather biome colors across boundaries |
| `WorldData.lakes` polygons not meshed (only river ribbons) | adjacent_follow_up | unassigned | `waterGeometry.ts` | add lake-fill geometry behind the bundle |
| Per-LOD geometry detail (LOD only tints) | adjacent_follow_up | unassigned | `lod.ts` unused by sampler resolution | lower resolution for mid/low tiers |
| `culled` LOD tier unreachable / floating-origin never rebases (W3D-G13/G14) | adjacent_follow_up | unassigned | prior scan 2026-06-01 | see GAPS.md |
| Worker loader unused by demo (inline path) | adjacent_follow_up | unassigned | `World3DDemo.tsx` inline `handleChunkRequest` | decide inline vs worker (with `world-3d-ui` entry choice) |
| Cold-load `?phase=world3d` bounce | — | `world-3d-ui` | live debug 2026-06-01 | **owned by `world-3d-ui`** (entry/transition); see its GAPS |

## Global Gap Imports

Checked `docs/projects/GLOBAL_GAPS.md`.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| GG-1 (stale `SKILL_DATA` import) | no | none | Character/data module crash, not rendering. Stays global. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| 65 passing unit tests | core + builders + streaming correct | `npx vitest run src/systems/world3d src/components/World3D` |
| Live screenshot: terrain + trees, no errors | engine renders after hardening | this session's `?phase=world3d` verification |
| Plan docs | architecture + per-task TDD history | `docs/superpowers/plans/2026-05-31-world3d-chunk-rendering.md`, `…-world3d-rendering-hardening.md` |
| Consolidated engine reference | relation to combat/atlas | `docs/architecture/COMBAT_MAP_ENGINE.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry (World 3D System row) | active |
| `docs/projects/world3d/TRACKER.md` | Active queue, gaps, next actions | active |
| `docs/projects/world3d/GAPS.md` | In-project gap registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project gap surfacing | active |
| `docs/projects/worldsim-service/NORTH_STAR.md` | Upstream: produces the `WorldData` this consumes | active |
| `docs/projects/world-3d-ui/NORTH_STAR.md` | Downstream: drives/overlays this engine (transition + HUD) | active |
| `docs/superpowers/plans/2026-05-31-world3d-chunk-rendering.md` | Plan 3 (real meshes) | done |
| `docs/superpowers/plans/2026-05-31-world3d-rendering-hardening.md` | Rendering hardening | done |

## Artifact Boundary

Durable: rendering technique, the blank-canvas root-cause knowledge, decisions, verification
summaries, gap classifications, next actions. Transient (external/ignored): raw vite logs,
screenshots, preview IDs, the temporary `[world3d-debug]` logs from diagnosis (removed).

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Should distant chunks drop to a lower mesh resolution (per-LOD)? | Perf headroom for larger view distances | claude | before larger worlds |
| Inline vs worker loader for the live (non-demo) engine path? | Frame-budget under real movement | claude / `world-3d-ui` | Plan 4 |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/world3d/TRACKER.md` then `docs/projects/world3d/GAPS.md`.
3. Skim `docs/superpowers/plans/2026-05-31-world3d-rendering-hardening.md` for the latest fixes.
4. Verify: `npx vitest run src/systems/world3d src/components/World3D` (expect green ~76), then dev-start + `?phase=world3d`. To screenshot the scene, hide the Ollama modal overlay via DOM rather than clicking "Continue" (clicking it can trigger the `world-3d-ui` entry bounce).
5. Continue from the Active Task (T10): seat town boxes on the terrain surface — they're buried under the exaggerated terrain. Reuse `heightToMeters`. Entry/transition issues belong to `world-3d-ui`; generation + the `METERS_PER_CELL` world↔grid scale to `worldsim-service`/shared contract.
