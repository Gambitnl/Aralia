# World 3D System North Star

Status: active
Last updated: 2026-06-01

> Canonical cold-start entry point for Aralia's **Azgaar-driven streamed 3D world**
> (the `WORLD3D_DEMO` surface). This is the main file for the initiative; sibling
> auto-generated surfaces `docs/projects/worldsim-service/` (upstream WorldData) and
> `docs/projects/world-3d-ui/` (overlapping UI shell) are related — see Supporting Files.

## Why This Project Exists

Aralia is replacing the legacy grid world-map + submap layers with a single massive,
streamed 3D world derived from the same Azgaar/`WorldData` source, so the 2D atlas and
the 3D view cannot drift. The work spans multiple slices (data generation → streaming →
per-chunk meshes → gameplay integration) that future agents must resume cold without
restarting discovery or re-deriving the architecture. This North Star protects that
multi-slice intent and the hard-won "why it was blank" debugging knowledge.

Governing design spec: `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md`.

## Intended Outcome

A free-roam 3D world that streams chunks around the camera, renders biome-colored terrain
with rivers, roads, town/dungeon/ruin exteriors, and vegetation — all generated
deterministically from `WorldData` — and is ultimately reachable from real gameplay (not
just the sandbox phase), with a synchronized marker on the 2D Azgaar atlas.

## Current State

Implemented and rendering. As of 2026-06-01:

- **Plan 1 (WorldSim)** landed: `runWorldSim` produces rich `WorldData` (polyline rivers +
  flow, sites with footprints, road graph, coastlines/lakes/biome polygons). Owned by the
  `worldsim-service` surface; consumed here.
- **Plan 2 (Streaming)** landed: coords/config/chunkManager/lod/sampler/streamer + worker +
  `World3DScene` shell. 81-chunk window streams correctly (`loaded → 81, pending → 0`).
- **Plan 3 (Real meshes)** landed: `ChunkMeshBundle` rewire + biome-colored terrain, river
  water ribbons, road ribbons, site boxes, instanced vegetation. All rendered in the scene.
- **Rendering hardening** landed: scene-origin (floating-origin) rendering, vegetation cap,
  shadows dropped + WebGL context-loss recovery, and a concrete canvas height — which was
  the final fix that made terrain actually appear.
- **Verified live:** `?phase=world3d` renders green streamed terrain to the horizon with
  scattered instanced trees, no WebGL context loss, no console errors. 65 unit tests pass
  across `src/systems/world3d` + `src/components/World3D`; `tsc --noEmit` clean for world3d.

Not yet done: the cold-load deep-link is intermittent (below); the demo world is all-`plains`
so rivers/roads/towns exist in data + tests but aren't visible in the demo view; the sandbox
is not yet wired into real gameplay (Plan 4).

## Active Task

| Field | Value |
|---|---|
| Task | Make `?phase=world3d` reliably enter the 3D scene on the first cold navigation (kill the intermittent bounce to `main_menu`) |
| Acceptance criteria | A clean dev start + single navigation to `?phase=world3d` lands on `WORLD3D_DEMO` and renders terrain, repeatably (≥3 consecutive cold loads) without a `main_menu` bounce |
| Allowed boundaries | `src/hooks/useHistorySync.ts`, `src/App.tsx` startup/phase-init effects, `src/components/World3D/*`. Do NOT touch the streaming/sampler/builder core (it works). |
| Stop condition | Stop once the deep link is reliable; do not expand into Plan 4 gameplay wiring or atlas marker sync in this slice. |
| Verification | Stop preview server, `rm -rf node_modules/.vite`, start, navigate once to `?phase=world3d`; screenshot shows terrain; console clean. Repeat 3×. |
| Owner | unassigned (next agent) |
| Next action | Instrument the mount-time phase dispatch order (useHistorySync initial-mount vs. App game-init effects) to find what overrides the URL phase; the Vite `optimizeDeps` change did NOT fix it (server logs show no re-optimize reload), so the race is app-level. |

## Scope Boundaries

In scope:
- The streamed 3D world rendering surface: `src/systems/world3d/`, `src/components/World3D/`.
- The `WORLD3D_DEMO` phase entry, URL deep-link, and demo host.
- Consuming `WorldData` from `worldSim`.

Adjacent but not in this slice:
- Plan 4: 2D↔3D transition animation, bidirectional Azgaar atlas marker sync, `playerWorldPos`
  in game state, submap deletion, grid-mode world-map removal.
- Pointing the demo at a varied biome map so water/roads/towns are visible.
- Per-LOD geometry detail (LOD currently only tints; mid/low build full-res meshes).
- Meshing `WorldData.lakes` polygons (only river ribbons are built today).
- Switching the demo to the worker-backed loader.

Out of scope:
- PBR terrain textures, animated water shaders, glTF tree/building models.
- Combat (`BattleMap3D`) — separate surface, shares the R3F stack only.

## What Must Not Be Lost

- **The "why it was blank" knowledge:** three stacked causes — WebGL context loss (shadow load
  + repeated remounts), extreme world coordinates (~30k, METERS_PER_CELL=1024), and a collapsed
  150px canvas (`height:100%` never resolved). All fixed; the canvas-height fix was decisive.
  Do not reintroduce `shadows` on the streamed world or `height:100%` on the scene container
  without re-verifying.
- The deterministic, worker-offloadable, unit-tested core (sampler → builders → bundle). Keep
  rendering changes in the React shell; keep logic pure.
- The `ChunkMeshBundle` contract is the Plan-3 seam; future content rides it. Do not regress to
  raw `ChunkGeometryArrays` in the loader path.
- Unfinished optionality: worker loader, polylineClip, per-LOD detail, lakes — all present and
  intentionally not yet wired; do not delete as "unused."

## Known Gaps And Follow-Ups

See `docs/projects/world3d/GAPS.md` for the full registry. Headline open gaps:

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Cold-load `?phase=world3d` bounce to main_menu | blocked_human_decision / adjacent_follow_up | next agent | live debugging this session; server logs show no Vite re-optimize | instrument mount-time phase dispatch order |
| Demo world all-`plains` → no visible water/roads/towns | adjacent_follow_up | next agent | `World3DDemo.tsx` builds an all-`plains` biome array | feed a varied biome map / real `WorldData` |
| Worker loader unused by demo (inline path only) | adjacent_follow_up | next agent | `World3DDemo.tsx` uses inline `handleChunkRequest` | decide inline vs worker for the demo entry |
| `WorldData.lakes` polygons not meshed | adjacent_follow_up | next agent | only `buildWaterMesh` river ribbons exist | add lake-fill geometry behind the bundle |
| Per-LOD geometry detail (LOD only tints) | adjacent_follow_up | next agent | `lod.ts` tier unused by geometry resolution | lower resolution for mid/low tiers |

## Global Gap Imports

Checked `docs/projects/GLOBAL_GAPS.md` before refreshing this surface.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| Physical object registry (2026-05-31) | no | none | Belongs to spell/combat targeting, not the streamed world. |

(One out-of-project gap surfaced during this work — the app-wide `SKILL_DATA` import crash — is recorded in `GLOBAL_GAPS.md`, not here, because it is a `characterValidation`/data-module issue, not world3d.)

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| 65 passing unit tests | core + builders + streaming correct | `npx vitest run src/systems/world3d src/components/World3D` |
| Live screenshot: green terrain + trees, no errors | scene renders after hardening | this session's `?phase=world3d` verification |
| Plan docs | architecture + per-task TDD history | `docs/superpowers/plans/2026-05-31-world3d-chunk-rendering.md`, `…-world3d-rendering-hardening.md` |
| Consolidated engine reference | how this relates to combat/atlas | `docs/architecture/COMBAT_MAP_ENGINE.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry (World 3D System row) | active |
| `docs/projects/world3d/TRACKER.md` | Active queue, blockers, gaps, next actions | active |
| `docs/projects/world3d/GAPS.md` | In-project durable gap registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project / out-of-scope gap surfacing | active |
| `docs/projects/worldsim-service/NORTH_STAR.md` | Upstream `WorldData` generation (Plan 1) — related surface | active |
| `docs/projects/world-3d-ui/NORTH_STAR.md` | Overlapping UI shell surface; candidate to consolidate into this project | active |
| `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` | Governing design spec | active |
| `docs/superpowers/plans/2026-05-31-world3d-chunk-rendering.md` | Plan 3 (real meshes) | done |
| `docs/superpowers/plans/2026-05-31-world3d-rendering-hardening.md` | Rendering hardening plan | done |

## Artifact Boundary

Durable: objective, scope, the blank-canvas root-cause knowledge, decisions, verification
summaries, gap classifications, next actions. Transient (keep external/ignored): raw vite
logs, screenshots, preview server IDs, the temporary `[world3d-debug]` console logs used
during diagnosis (already removed).

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Consolidate `world-3d-ui` + `world3d` into one surface? | They both own `src/components/World3D`; two surfaces risk drift | operator | before Plan 4 |
| Keep `WORLD3D_DEMO` sandbox, or route from map/player state? | Decides whether this stays test-only or becomes the real world view | operator | Plan 4 kickoff |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/world3d/TRACKER.md` then `docs/projects/world3d/GAPS.md`.
3. Skim `docs/superpowers/plans/2026-05-31-world3d-rendering-hardening.md` for the latest fixes.
4. Verify current state: `npx vitest run src/systems/world3d src/components/World3D` (expect green), then dev-start + `?phase=world3d` and confirm terrain renders.
5. Continue from the Active Task: make the cold-load deep-link reliable (instrument the mount-time phase dispatch order).
