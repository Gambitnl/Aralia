# World 3D System North Star

Status: active
Last updated: 2026-06-01

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

**Known visibility limitation (→ T8 / W3D-G11):** terrain relief is near-flat at world scale
(`MAX_TERRAIN_HEIGHT_M=150` over `METERS_PER_CELL=1024`), so the rivers/roads/town-boxes the
engine builds are hard to *see* from a near-horizontal camera. Vertical exaggeration is the
highest visual-value next task.

## Active Task

| Field | Value |
|---|---|
| Task | T8 — add **vertical exaggeration** so terrain relief (and thus the rivers/roads/town-boxes the engine already builds) is legible (W3D-G11) |
| Acceptance criteria | A clean load of `?phase=world3d` shows hills with visible relief, and the water/road ribbons read as rivers/roads from the default camera — not a flat plane |
| Allowed boundaries | `src/systems/world3d/chunkGeometry.ts`, `src/systems/world3d/config.ts`, optionally `World3DScene.tsx` camera. Do NOT touch entry/transition (owned by `world-3d-ui`) or `worldSim` generation (owned by `worldsim-service`). |
| Stop condition | Stop when relief is legible; do not build LOD detail (T7), lakes (T6), or biome blending (T9) in the same slice. |
| Verification | dev-start, navigate `?phase=world3d` (may take 2-3 tries due to the world-3d-ui entry bounce), screenshot shows relief + legible ribbons. |
| Owner | unassigned |
| Next action | Introduce a vertical-exaggeration factor (e.g., multiply the height→meters mapping in `chunkGeometry`, or expose a config knob); re-verify content legibility. The cold-load `?phase=world3d` bounce that blocks *reaching* the scene is owned by `world-3d-ui` (W3DUI-5/6) — not this slice. |

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
| **Flat terrain relief → rivers/roads/towns hard to see (W3D-G11)** | adjacent_follow_up | unassigned | T4 screenshot: flat plane; `MAX_TERRAIN_HEIGHT_M` vs `METERS_PER_CELL` | **active task (T8)** — add vertical exaggeration |
| Hard biome-color seams (no blending) (W3D-G12) | adjacent_follow_up | unassigned | `sampleBiomeNearest` + per-vertex color | feather biome colors across boundaries |
| Demo world all-`plains` → uniform terrain | done | claude | resolved by T4: real `generateMap` world | — |
| `WorldData.lakes` polygons not meshed (only river ribbons) | adjacent_follow_up | unassigned | `waterGeometry.ts` | add lake-fill geometry behind the bundle |
| Per-LOD geometry detail (LOD only tints) | adjacent_follow_up | unassigned | `lod.ts` unused by sampler resolution | lower resolution for mid/low tiers |
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
4. Verify: `npx vitest run src/systems/world3d src/components/World3D` (expect green), then dev-start + `?phase=world3d`.
5. Continue from the Active Task: feed the demo a varied biome world so rivers/roads/towns render. Entry/transition issues belong to `world-3d-ui`; generation issues to `worldsim-service`.
