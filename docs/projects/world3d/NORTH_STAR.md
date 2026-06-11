---
schema_version: 1
project: World3d
slug: world3d
category: active project
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: active
last_updated: 2026-06-10
confidence: unknown
evidence: "docs/projects/world3d/TRACKER.md; docs/projects/world3d/GAPS.md; docs/projects/DECISION_BLITZ_2026-06-10.md (D4)"
gap_signal: "T6 and T14-T18 remediated; T7/W3D-G10 loader-LOD/seam decision recorded 2026-06-10 (requested-LOD loader contract + skirt geometry); implementation lane open. W3D-G16 view-window work remains a separate follow-up."
protocol: living-project
next_step: "Resume from TRACKER.md; T7 lane reopens under the decided contract — extend the chunk-loader request with the requested LOD tier and use skirt geometry for mixed-resolution seams; add mixed near/mid/low regression tests with the implementation."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs consistency
completed_verification:
  - docs refresh
last_proof: 2026-06-08
workflow_gaps_reviewed: ""
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# World 3D System North Star

Status: active — decision recorded 2026-06-10; implementation lane open
Last updated: 2026-06-10 (D4 decision recorded)

> The **3D rendering engine** for Aralia's Azgaar-driven streamed 3D world: chunk streaming,
> per-chunk mesh generation, and the R3F scene. One of three distinct surfaces (not
> consolidated — each owns a separate concern):
> - **this surface (`world3d`)** — the rendering engine.
> - `worldsim-service` — world generation + simulation; produces the `WorldData` this consumes.
> - `world-3d-ui` — the 2D↔3D transition + in-3D HUD that drives this engine.
> Owner: claude.

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | World3d |
| Slug | world3d |
| Category | active project |
| Status | active — decision recorded 2026-06-10; implementation lane open |
| Confidence | unknown |
| Evidence | docs/projects/world3d/TRACKER.md; docs/projects/world3d/GAPS.md; docs/projects/DECISION_BLITZ_2026-06-10.md (D4) |
| Gap signal | T6 and T14-T18 remediated; T7/W3D-G10 loader-LOD/seam decision recorded 2026-06-10 (requested-LOD loader contract + skirt geometry); W3D-G16 view-window work remains a separate follow-up |
| Protocol | living-project |
| Next step | Resume from TRACKER.md; T7 lane reopens — extend the chunk-loader request with the requested LOD tier, use skirt geometry for mixed-resolution seams, add mixed near/mid/low regression tests. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-08 focused world3d scene lifecycle proof plus useChunkStreaming StrictMode coverage |
| Workflow gaps reviewed | yes |

## Required Review Brief

Decision needed: choose the loader LOD API and mixed-LOD seam strategy before assigning more World3D implementation work.

Issue: T7/W3D-G10 is review-blocked because chunk loads request only `cx/cy`, while `ChunkStreamer` records LOD after dispatch and no seam/skirt contract exists for mixed-resolution chunks.

Why agents stop: a local sampler or mesh-density change would either ignore the requested LOD or risk visible cracks between neighboring chunks.

Decision owner: rendering/world owner.

Options:
- Extend the chunk-loader request contract to carry requested LOD/resolution and define seam handling.
- Keep current mesh resolution for now and document larger view-window work as a separate performance decision.

Evidence: `src/components/World3D/createWorkerChunkLoader.ts`, `src/systems/world3d/chunkStreamer.ts`, `src/systems/world3d/chunkGeometry.ts`, and `src/systems/world3d/lod.ts`.

After decision: add mixed near/mid/low chunk regression tests, then reassign T7 only with the selected loader/seam contract.

### Decision (2026-06-10)

Resolved — option 1 selected. **Extend the chunk-loader request contract to carry the requested LOD tier, and use skirt geometry to hide mixed-resolution seams.** The T7 lane reopens under this contract; implementation must add mixed near/mid/low chunk regression tests alongside the loader/seam changes.

- Decider: Remy (project owner), batched decision session 2026-06-10.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D4); local record: `docs/projects/world3d/DECISIONS.md` (D2).
- Status: decision recorded 2026-06-10; implementation lane open. (W3D-G16 view-window widening remains a separate follow-up, not covered by this decision.)

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

Implemented and rendering. As of 2026-06-08:

- **Streaming + meshes done:** coords/config/chunkManager/lod/sampler/streamer/worker +
  `ChunkMeshBundle` (Plan 2 + Plan 3). Biome-colored terrain, river water ribbons, road
  ribbons, site boxes, instanced vegetation all render.
- **Rendering hardening done:** floating-origin (scene drawn near 0,0), vegetation cap,
  shadows dropped + WebGL context-loss recovery, and a concrete canvas height — the last of
  which was the decisive fix that made terrain visible.
- **Verified live:** `?phase=world3d` renders streamed terrain, no context loss, no console
  errors. Focused world3d tests cover the rendering core; repo-wide `tsc --noEmit`
  still has unrelated failures outside the world3d slice.
- **Scene lifecycle proof added:** focused RTL coverage now checks that `World3DScene`
  stays visibly sized, forwards the start position into the camera/origin wiring,
  invokes the first stream update on mount, and renders loaded chunk content. The
  separate `useChunkStreaming` StrictMode regression test still guards the streamer
  lifecycle.
- **T6 and T14-T18 done (2026-06-08):** lake polygons now triangulate as filled water surfaces; town footprints now use bounded visual radii, road ribbons honor
  `road.type`, road/river clipping has a chunk-AABB prefilter, vegetation scatter payloads reuse
  cached typed buffers, and renderer-side vegetation matrix writes skip unchanged scatter payloads.
- **T4 done (2026-06-01):** the demo now feeds the **real** `generateMap(...).worldData`
  pipeline (varied biomes, flow-traced rivers, MST roads, ~30 towns) and spawns the camera on
  the first town. Live screenshot confirms biome variety renders (ocean meeting a landmass)
  instead of uniform plains.
- **T13 done (2026-06-02):** **river/road polyline clip is now half-open on its max edges** (W3D-G21),
  the line-geometry sibling of T12's site fix. `clipSegment` rejected boundary-coincident segments
  only when strictly outside (`q < 0`), so a segment lying exactly on a shared edge (`q === 0`) was
  kept by **both** adjacent chunks. Fix: the two max edges (`x < maxX`, `y < maxY`) now reject with
  `q <= 0` while min edges stay inclusive (`q < 0`) — a segment merely touching the min edge is still
  admitted. Discovery: road points sit at cell-center `.5` coords (e.g. `10.5`), and `0.5` is an exact
  multiple of the chunk grid step (`CHUNK_WORLD_SIZE/METERS_PER_CELL = 0.125`), so axis-aligned roads
  routinely lie exactly on boundaries. Verified by **deterministic in-page replay** of the demo world
  (seed 2026): 116 boundary-coincident road segments exist; the old inclusive clipper double-counted
  **31 of 34** roads (total clipped length up to 2.0× the original — whole roads drawn twice), the
  half-open clipper yields exactly 1.0× for all 34. 2 new unit tests; 67 world3d tests pass; tsc clean;
  live `?phase=world3d` re-verified (terrain + site render intact, no regression). New gaps: W3D-G23
  (roads drawn at a hardcoded uniform width — `road.type` ignored), W3D-G24 (no spatial pre-filter —
  every polyline clipped against every chunk).
- **T12 done (2026-06-02):** **chunkSampler site filter is now half-open `[min, max)`** (W3D-G20),
  which also resolves the residual duplicate-key warnings (W3D-G18). The filter used `<=` on both
  `maxGX`/`maxGY`, double-including any site on a shared chunk edge. Discovery: this was not a rare
  corner case — **every** site sits on a boundary because site positions are integer grid coords and
  `METERS_PER_CELL`(1024) is an exact multiple of `CHUNK_WORLD_SIZE`(128), so `(x·1024)%128===0` for
  all sites; the `<=` bug duplicated essentially every site. Fix: `s.position.x < aabb.maxGX` (and Y).
  Verified by a **deterministic in-page replay** of the demo world (seed 2026) against the live edited
  module: all 58 sites land in exactly one chunk (`sitesInMultipleChunks: []`), no generator-duplicate
  IDs. (The preview console buffer never clears across reloads, so the in-page replay — not the noisy
  console — is the authoritative proof here.) 2 new boundary unit tests; 9 chunkSampler tests pass; tsc
  clean. New gaps: W3D-G21 (polyline clip still `<=` on both edges → boundary rivers/roads double-drawn),
  W3D-G22 (sites quantized to integer grid → always seat at owning chunk's NW corner).
- **T10 done (2026-06-02):** **town boxes seat on terrain surface** (W3D-G15). `surfaceY` carried on `ChunkSite` (bilinear sample at site grid coords, `heightToMeters` applied); box seated at `surfaceY + radius*0.5` in `SitePieces`; chunk-scoped React key (`T11/W3D-G18` folded in). Discovered Voronoi footprint radii hit ~785m, putting camera inside box (back-face culling invisible) — capped at `MAX_RADIUS_M=80`. Live screenshot: golden town box visible on terrain surface. 76 tests pass; tsc clean. New gaps: W3D-G19 (footprint-radius formula) W3D-G20 (boundary half-open interval).
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
| Task | T19 complete. `World3DScene` lifecycle proof now covers the visible shell, mount-time camera/origin wiring, and first stream update, while `useChunkStreaming` keeps the StrictMode lifecycle guard. |
| Acceptance criteria | Scene mount stays visible, the initial stream update still fires, and loaded chunk content renders while the streamer lifecycle remains guarded by the existing StrictMode proof. |
| Allowed boundaries | `src/components/World3D/__tests__/World3DScene.lifecycle.test.tsx`, `src/components/World3D/__tests__/useChunkStreaming.test.tsx`, and World3D docs. |
| Stop condition | Focused scene lifecycle proof and streamer lifecycle tests remain green. |
| Verification | `World3DScene.lifecycle.test.tsx` covers visible shell, camera/origin wiring, first stream update, rendered chunk content, and WebGL context listeners; `useChunkStreaming.test.tsx` keeps the StrictMode streamer guard. |
| Owner | Codex worker |
| Next action | T7/W3D-G10 decision recorded 2026-06-10 (DECISION_BLITZ D4): loader request carries the requested LOD tier; skirt geometry hides mixed-resolution seams. T7 lane is open — implement the extended loader contract + skirts with mixed near/mid/low regression tests. |

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
| **Site/town boxes buried under exaggerated terrain (W3D-G15)** | **done** | claude | T10 fix: `surfaceY` on `ChunkSite`; box at `surfaceY+radius*0.5`; `MAX_RADIUS_M=80` cap | resolved by T10 |
| Sub-cell view window flattens relief (W3D-G16) | adjacent_follow_up | unassigned | window ≈512 m vs `METERS_PER_CELL=1024` → ≤1 cell visible | widen visible window w/o exploding chunk count |
| StrictMode-killed streamer → blank live scene (W3D-G17) | **done** | claude | live `loadOk=4, chunks=0` → fixed → `chunks=81` | resolved during T8 (per-mount streamer) |
| Duplicate site React keys (W3D-G18) | **done** | claude | T10/T11 chunk-scoped key + T12 half-open filter remove the underlying duplicate | resolved by T12 |
| Voronoi footprint radii → camera inside box (W3D-G19) | **done** | claude | T14: bounded kind/population radius (`8`-`30`m) replaced footprint-derived radius | resolved by T14 |
| Boundary sites in multiple chunks → dup keys (W3D-G20) | **done** | claude | `chunkSampler` half-open `[min, max)`; replay: 58/58 sites in exactly one chunk | resolved by T12 |
| Boundary rivers/roads double-drawn (W3D-G21) | **done** | claude | T13: `clipSegment` max edges half-open (`q <= 0`); replay: 31/34 roads double-counted → 0/34 | resolved by T13 |
| Roads drawn at hardcoded uniform width (W3D-G23) | **done** | claude | T15: `chunkSampler` maps `road.type` to width | resolved by T15 |
| No spatial pre-filter on polyline clip (W3D-G24) | **done** | claude | T16: `chunkSampler` prefilters road/river bboxes against chunk AABB | resolved by T16 |
| Vegetation scatter no instanced-mesh caching (W3D-G25, imported from GG-4) | **done** | Codex worker | T17: bounded payload-aware LRU cache reuses typed buffers | resolved by T17 |
| Renderer-side instance matrices still rebuild for unchanged scatter payloads (W3D-G26) | **done** | Codex worker | T18: `VegetationScatter.cacheKey` skips repeat `setMatrixAt` loops | resolved by T18 |
| Sites quantized to integer grid → seat at chunk NW corner (W3D-G22) | adjacent_follow_up | unassigned | T12 replay: all 58 sites integer-grid → `localX=localZ=0` | sub-cell placement (likely `worldsim-service`) or document as intended |
| Hard biome-color seams (no blending) (W3D-G12) | adjacent_follow_up | unassigned | `sampleBiomeNearest` + per-vertex color | feather biome colors across boundaries |
| `WorldData.lakes` polygons not meshed (only river ribbons) | **done** | Codex worker | T6: `chunkSampler` carries lake polygons and `waterGeometry` triangulates lake fills | resolved by T6 |
| Per-LOD geometry detail (LOD only tints) | decided 2026-06-10 — implementation open | unassigned | loader requests only `cx/cy`; `ChunkStreamer` records LOD after dispatch; decision (DECISION_BLITZ D4): loader carries requested LOD tier + skirt geometry for seams | implement extended loader contract + skirts; mixed near/mid/low regression tests |
| `culled` LOD tier unreachable / floating-origin never rebases (W3D-G13/G14) | adjacent_follow_up | unassigned | prior scan 2026-06-01 | see GAPS.md |
| Worker loader unused by demo (inline path) | adjacent_follow_up | unassigned | `World3DDemo.tsx` inline `handleChunkRequest` | decide inline vs worker (with `world-3d-ui` entry choice) |
| Cold-load `?phase=world3d` bounce | — | `world-3d-ui` | live debug 2026-06-01 | **owned by `world-3d-ui`** (entry/transition); see its GAPS |

## Global Gap Imports

Checked `docs/projects/GLOBAL_GAPS.md` (last reviewed 2026-06-02, T13).

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| GG-1 (stale `SKILL_DATA` import) | no | none (left `untriaged` for its owner) | Character/data module crash, not rendering. world3d is not the owner, so per the GLOBAL_GAPS scoped-status rule we leave the global row `untriaged` rather than declining it on the owner's behalf. |
| GG-4 (vegetationScatter no instanced-mesh caching) | yes | `world3d/GAPS.md` W3D-G25 | Rendering perf; the file lives in `src/systems/world3d/`. Global row marked `imported → world3d`. |

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
5. Continue from the Active Task section above. Entry/transition issues belong to `world-3d-ui`; generation + the `METERS_PER_CELL` world↔grid scale to `worldsim-service`/shared contract.

## Visual Verification Protocol (MANDATORY)

When taking screenshots to verify rendering work, **do not pre-assume what you expect to see**. Vision models are prone to confirmation bias — if you ask yourself "is the town box on the terrain?" you will tend to find it whether it is there or not ("pink elephant" effect).

Instead, follow this discipline for every screenshot:

1. **Describe first, conclude second.** Before checking acceptance criteria, write out exactly what you see: colours, shapes, positions, what fills the frame. Treat it like describing a photo to someone who cannot see it.
2. **Name the unexpected.** If something looks wrong, odd, or absent — say so explicitly before deciding whether it matters.
3. **Be a hostile witness to your own work.** Assume the feature is broken until the raw description proves otherwise. "I see a grey slope and a small golden cube sitting flush with the surface in the centre-frame" beats "I can confirm the town box is on the terrain."
4. **Watch for world-edge artifacts.** The terrain is a finite grid. A sharp "ridge" or "cliff" at the frame edge is the world boundary, not terrain relief. Do not count it as evidence of vertical exaggeration working.
5. **Screenshot more than once.** A single frame may catch a transient state (chunks still loading, WebGL not settled). Take at least two screenshots a few seconds apart and compare.
