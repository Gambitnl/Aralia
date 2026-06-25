---
schema_version: 1
gap_schema: project_gap_registry
project: World3d
slug: world3d
status: "active â€” W3D-G10 resolved 2026-06-21 (T7 LOD loader contract + skirts)"
status_note: "Preserved as routed_reference to avoid flattening existing gap provenance. W3D-G10 resolved (D4 implemented)."
registry_mode: routed_reference
last_updated: "2026-06-25"
gap_count: 14
open_gap_count: 13
resolved_gap_count: 1
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: low
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/world3d/NORTH_STAR.md
tracker: docs/projects/world3d/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# World3d Gap Registry

Status: active â€” W3D-G10 resolved 2026-06-21 (T7 LOD loader contract + skirts implemented)
Last updated: 2026-06-25

North Star: `docs/projects/world3d/NORTH_STAR.md`

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Scope
In-project execution gaps rooted in current implementation evidence. Resolved gaps are
retained with `done`/`superseded` status as history; do not silently delete.

## Gap Log

| Gap ID | Status | Classification | Owner | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| W3D-G1 | not_started | adjacent_follow_up | unassigned | 2026-05-31 scan | `World3DDemo` uses inline `handleChunkRequest`, not the worker-backed loader | `src/components/World3D/World3DDemo.tsx`, `createWorkerChunkLoader.ts` | Worker path is unverified in the real scene entry | Decide inline vs worker for the demo; if worker, wire `createWorkerChunkLoader` | Trace loaded-chunk call stack under `WORLD3D_DEMO` |
| W3D-G3 | routed | blocked_human_decision | world-3d-ui | 2026-05-31 scan | `WORLD3D_DEMO` is a sandbox, not connected to gameplay/saved world-actor state | `src/App.tsx`, `useHistorySync.ts` | Without routing from real play, the 3D world ships as test-only | **Routed to `world-3d-ui`** (entry/transition owner); tracked as its Plan 4 | see `docs/projects/world-3d-ui/GAPS.md` |
| W3D-G7 | routed | blocked_human_decision | world-3d-ui | 2026-06-01 live debug | `?phase=world3d` cold-load intermittently bounces to `main_menu` | live nav this session; `optimizeDeps` change did not fix; server logs show no Vite re-optimize â†’ app-level race | Deep link is unreliable for testing/demo | **Routed to `world-3d-ui`** (entry/transition owner) | see `docs/projects/world-3d-ui/GAPS.md` (W3DUI-5) |
| W3D-G10 | resolved | in_scope_now | iteration-agent | 2026-06-08 T7 worker review | Per-LOD geometry detail cannot be safely implemented as a sampler-only change because the loader API requests chunks by `cx/cy` before `ChunkStreamer` records each chunk's LOD tier. Mixed-resolution meshes also need an explicit seam/skirt strategy. | `src/components/World3D/createWorkerChunkLoader.ts`, `src/systems/world3d/chunkStreamer.ts`, `src/systems/world3d/chunkGeometry.ts`, `src/systems/world3d/lod.ts` | A local resolution change would either ignore the computed LOD or introduce visible cracks between adjacent chunks with different mesh densities. | **Resolved 2026-06-21 (D4 implemented):** `ChunkLoader` carries the requested `lod` (types.ts); `ChunkStreamer.pump` computes the tier from chunk distance and passes it; `config.LOD_RESOLUTION`/`resolutionForLod` map full=16/mid=9/low=5 and every loader honors it; `chunkGeometry.buildTerrainMesh` adds an adaptive-depth perimeter skirt to hide mixed-resolution seams (`buildPlaceholderHeightfield` stays skirtless). | DONE — 91 world3d + 30 component tests green incl. `chunkSkirt.test.ts` (mixed near/mid/low), `createWorkerChunkLoader` LOD-tier, `chunkStreamer` passes-tier, `config` resolutionForLod; `?phase=world3d` renders seam-free (`.agent/3d-visual-quality/captures/lod-after.png`). |
| W3D-G12 | not_started | adjacent_follow_up | unassigned | 2026-06-01 T4 live verify | Hard biome-color seams: terrain color is per-vertex nearest-neighbor biome (`sampleBiomeNearest`) with no cross-boundary blending, so biome edges are abrupt color steps | `chunkSampler.ts` `sampleBiomeNearest`, `chunkGeometry.ts` per-vertex `biomeColor` | Biome transitions look banded/unnatural at world scale | Blend biome colors across a feather band (e.g., sample neighbor biomes and lerp by distance to boundary) | Adjacent biomes show a gradient, not a hard line |
| W3D-G13 | not_started | adjacent_follow_up | unassigned | 2026-06-01 unrelated scan | The `culled` LOD tier is unreachable dead logic: `lod.ts` only returns `culled` for Chebyshev distance > `LOD_RINGS.low` (6), but `ChunkStreamer` unloads any chunk beyond `UNLOAD_RADIUS` (6) â€” so a chunk is removed before it can ever be tagged `culled`. Any future `culled`-tier handling will never run. | `src/systems/world3d/lod.ts` (`LOD_RINGS.low=6`), `src/systems/world3d/chunkStreamer.ts` (`UNLOAD_RADIUS=6` unload + `dist <= unloadRadius` guard) | Dead branch hides the intended "draw far chunks cheaply instead of unloading them" behavior; LOD ring config is misleading | Either raise `UNLOAD_RADIUS` above `LOD_RINGS.low` so a `culled`/billboard tier renders beyond the detailed rings, or delete the `culled` tier and document that the unload radius is the true horizon | A chunk exists in the `culled` tier and renders cheaply, OR the tier is removed and tests assert the new contract |
| W3D-G14 | not_started | adjacent_follow_up | unassigned | 2026-06-01 unrelated scan | Floating-origin never rebases: `World3DScene` fixes `sceneOrigin` at the mount `start` and never recenters. The streamer follows the camera in absolute world coords fine, but rendered scene-local coordinates grow without bound as the player pans â€” after enough travel the float-precision problem the floating-origin was introduced to solve returns (vertex jitter, shadow/camera math drift). | `src/components/World3D/World3DScene.tsx` (`sceneOrigin = useMemo(..., [start])`), `src/components/World3D/FreeRoamCameraController.tsx` (reports world coords via `sceneToWorld`) | Long-range traversal silently degrades rendering precision; this is the "moving floating-origin" the NORTH_STAR lists as future but has no gap row | Rebase `sceneOrigin` (and offset the camera/controls + loaded chunk positions) when the camera drifts beyond a threshold (e.g., > N chunks) from the current origin | After panning > a few km, vertex positions stay near 0 (no jitter); a unit test covers the rebase offset math |
| W3D-G16 | not_started | adjacent_follow_up | unassigned | 2026-06-02 T8 implement | Sub-cell view window flattens relief: the streamed window is `LOAD_RADIUS(4) Ã— CHUNK_WORLD_SIZE(128)` â‰ˆ 512 m radius, but `METERS_PER_CELL = 1024`, so the camera sees **â‰¤ ~1 height cell**. Within one cell the heightfield is a single bilinear-interpolated slope, so even with strong vertical exaggeration the terrain reads as one smooth ridge, never *rolling* hills, and multi-cell features (a road crossing several cells, a valley) can't fit in frame. (Related to T8: it's the deeper limiter on relief legibility that exaggeration alone can't fix.) | `config.ts` (`LOAD_RADIUS`, `CHUNK_WORLD_SIZE`, `METERS_PER_CELL`); live T8 screenshots show a single ridge | Relief/roads/rivers are only ever seen one cell at a time; shrinking `METERS_PER_CELL` would cross the worldâ†”grid coord contract `world-3d-ui` depends on, so it needs a deliberate plan | Widen the visible window without exploding chunk count â€” e.g., bigger `CHUNK_WORLD_SIZE` (fewer chunks/cell) and/or a coarse far-LOD ring beyond the detailed window (ties into W3D-G10/G13) | Camera frames â‰¥ 3â€“4 cells of varied terrain; multiple hills + a road segment read at once |
| W3D-G22 | not_started | adjacent_follow_up | unassigned | 2026-06-02 T12 implement | Site horizontal positions are quantized to integer grid cells: the T12 replay showed **all 58** demo sites sit at integer grid coordinates (`(xÂ·METERS_PER_CELL) % CHUNK_WORLD_SIZE === 0` for every site). Consequence in the renderer: a site's chunk-local position is `gxÂ·M âˆ’ cxÂ·S`, which for an integer-grid site is exactly `0` â€” so every town seats flush at its owning chunk's NW corner (`localX = localZ = 0`), never in the chunk interior, and towns snap to a coarse 1024 m lattice. The half-open rule (W3D-G20) deterministically assigns these corner sites to the higher chunk. | `chunkSampler.ts` + `siteGeometry.ts` (chunk-local placement); T12 in-page replay (`boundarySitesOnGrid: 58/58`) | Towns can't be placed sub-cell; at world scale settlements visibly snap to a grid and always hug a chunk corner, which looks artificial and can collide with chunk-seam artifacts | Decide whether sub-cell site placement is wanted; if so, carry fractional site positions from the generator (likely a `worldsim-service` concern) and verify the renderer honours them. If integer placement is intended, document it so the corner-seating isn't mistaken for a bug | Either sites render at fractional in-chunk positions, or the integer-lattice placement is documented as intended with the corner-seating noted |
| W3D-G23 | not_started | adjacent_follow_up | Codex | `docs/BACKLOG.md` migration 2026-06-25 | 3D exploration still needs a scene controller and event bridge for React UI actions. | `docs/BACKLOG.md`; `docs/tasks/3d-exploration/1A-3D-EXPLORATION-ROADMAP.md`; `src/components/World3D` | Exploration 3D needs a clear action/event boundary before UI controls, world state, and scene state can evolve safely. | Define the scene-controller API and the first UI event bridge slice. | Focused tests or rendered proof showing a React UI action changes 3D scene state through the bridge. |
| W3D-G24 | not_started | adjacent_follow_up | Codex | `docs/BACKLOG.md` migration 2026-06-25 | Outdoor tile generation still needs chunking, biome-driven props, and cache integration. | `docs/BACKLOG.md`; `src/systems/world3d`; `src/services/worldSim` | Terrain and prop generation quality depends on coordinated streaming and cache behavior, not one-off scene patches. | Pick a bounded chunk/prop/cache slice after WorldSim feature-source contracts are stable. | Chunk-generation tests plus rendered proof for biome props in a live 3D window. |
| W3D-G25 | not_started | adjacent_follow_up | Codex | `docs/BACKLOG.md` migration 2026-06-25 | Time-of-day lighting and fog need to follow the game clock. | `docs/BACKLOG.md`; `src/components/World3D`; `src/state` game-time fields | Time state should visibly affect exploration mood and visibility without each scene inventing its own clock. | Define lighting/fog inputs from game time and add a small day/night proof slice. | Rendered proof at two game times plus tests for mapping game time to light/fog values. |
| W3D-G26 | not_started | adjacent_follow_up | Codex | `docs/BACKLOG.md` migration 2026-06-25 | Dungeon and town scene-generation paths need explicit 3D ownership and proof. | `docs/BACKLOG.md`; Worldforge town/ground tracker; `src/components/World3D` | Town and dungeon entry paths should not fork into incompatible 3D generation models. | Route town generation through Worldforge ground-mode contracts and define whether dungeon generation is World3D-owned or a separate project. | One town or dungeon entry proof that names the generator, cache key, and scene handoff contract. |
| W3D-G27 | not_started | adjacent_follow_up | Codex | `docs/BACKLOG.md` migration 2026-06-25 | Generated scenes need seed-based caching and entry toggles wired through submap/world UI. | `docs/BACKLOG.md`; `src/components/MapPane.tsx`; `src/components/World3D` | Players need repeatable scene entry, and agents need deterministic proof when moving between map/submap/world UI and 3D. | Define cache key, invalidation, and entry-toggle ownership before adding more scene paths. | Re-entering the same seed/location produces the same scene and uses the documented cache path. |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
