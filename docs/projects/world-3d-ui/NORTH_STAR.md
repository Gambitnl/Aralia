# World 3D UI North Star

Status: active
Last updated: 2026-06-05

> One of three distinct surfaces in the **Azgaar-driven streamed 3D world** initiative:
> - `world3d` — the 3D **rendering engine** (chunk streaming, meshes, R3F scene).
> - `worldsim-service` — world **generation + simulation** (geometry + first-build history/story).
> - **this surface (`world-3d-ui`)** — the **transition + HUD** layer.
> These are not consolidated; each owns a separate concern. Owner: claude.

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | World 3d Ui |
| Slug | world-3d-ui |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/world-3d-ui/TRACKER.md; docs/projects/world-3d-ui/GAPS.md |
| Gap signal | present |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | yes |

## Why This Project Exists

The 3D world needs two things the rendering engine deliberately does not own: a way to
**get into and out of it** (the handoff from the 2D Azgaar atlas down into the streamed 3D
world, and back), and the **2D UI layered on top of it** while you're there (controls,
nameplates, minimap, mode toggles). Keeping this separate from `world3d` prevents the
rendering engine from absorbing transition state and HUD concerns, and gives the eventual
atlas↔3D bridge a clear owner.

## Intended Outcome

- A smooth **2D atlas → 3D world transition**: zoom/dive from the Azgaar map into the
  streamed world at the chosen location, mount the 3D scene, and reverse it on exit.
- A **bidirectional marker sync**: the player's 3D world position projects to a marker on
  the 2D atlas; clicking the atlas can drive entry/relocation. (Spec §8–§9, "Plan 4".)
- An **in-3D HUD**: control panel, view-mode toggle, nameplates/labels, minimap, and debug
  overlays composited over the rendering engine's canvas.

## Current State

**Plan 4 complete (T7–T11).** Production PLAYING entry path is wired:

- **Game-state anchors** (`worldViewMode`, `playerWorldPos`, actions, reducer, hooks) — done (T7).
- **PLAYING-phase 3D routing** — `TransitionController` cross-fades atlas ↔ `World3DWrapper` by `worldViewMode` (T8/T10).
- **`World3DWrapper`** — worker-backed `ChunkLoader` from `worldData` (W3DUI-1), throttled position dispatch with terrain height via `getTerrainHeight()`, FPS/chunk debug stats (T8/T9).
- **`InWorldHUD`** — control panel (Open Map, Exit to Menu), view-mode toggle, dev-only `DebugHUD` (T9).
- **`AtlasPlayerMarker` + click-to-travel** — marker on MapPane Azgaar overlay; **Enter 3D** interaction mode dispatches position + `worldViewMode`; compass **Enter 3D** routes to streamed world (T10).
- **Integration tests + perf budget** — RTL lifecycle (W3DUI-3), `worldCoords` unit tests, Playwright HUD round-trip, `docs/projects/world-3d-ui/PERF.md` (T11).
- **Sandbox** `WORLD3D_DEMO` → `<World3DDemo />` via `?phase=world3d` remains unchanged.
- **In-3D minimap** — `World3DMinimap` paints a top-down view from `WorldData.biomeIds` with the live `AtlasPlayerMarker`, mounted bottom-left of `InWorldHUD` (W3DUI-26). **Nameplates** still deferred (W3DUI-27).
- **`WorldAtlasStrip`** — compact world-map preview with `AtlasPlayerMarker` on PLAYING `GameLayout` when `playerWorldPos` is set (W3DUI-23).

## Active Task

| Field | Value |
|---|---|
| Task | Plan 4 deferred UX: in-3D **nameplates** (minimap done — W3DUI-26) |
| Acceptance criteria | Billboarded labels over visible `WorldData.sites`, distance/LOD gated; no perf regression |
| Allowed boundaries | `world-3d-ui` surface |
| Stop condition | Operator prioritizes next slice |
| Verification | Labels track sites as camera moves; vitest green |
| Owner | unassigned |
| Next action | Build nameplates (W3DUI-27) or operator directs TownCanvas handoff |

## Scope Boundaries

In scope:
- 2D→3D and 3D→2D transition orchestration (entry trigger, camera dive, scene mount/unmount handoff).
- Bidirectional Azgaar atlas ↔ 3D position marker sync; `playerWorldPos` game-state anchor.
- Phase/entry wiring that makes the 3D world reachable (`WORLD3D_DEMO` today; real routing later).
- In-3D HUD: control panel, view-mode toggle, nameplates, minimap, debug overlays.

Out of scope (owned elsewhere):
- Chunk streaming, mesh generation, the R3F scene/camera-controller, materials — `world3d`.
- World generation + history/story/events — `worldsim-service`.
- Combat HUD / `BattleMap3D` — separate combat surfaces.

## What Must Not Be Lost

- The `world3d` URL slug for entry; the existing `WORLD3D_DEMO` phase as the current entry seam.
- The eventual transition must **reuse** `world3d`'s scene rather than re-implement rendering.
- Worker utilities exist in `world3d` but are unused by the demo entry — an entry-strategy decision lives here, not a reason to delete them.

## Known Gaps And Follow-Ups

See `docs/projects/world-3d-ui/GAPS.md`. Headline:

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Cold-load `?phase=world3d` bounces to main_menu intermittently | done | claude | W3DUI-5 | Fixed |
| 2D↔3D transition animations in PLAYING | done | unassigned | W3DUI-20 | `TransitionController` wraps PLAYING branch (T10) |
| Bidirectional atlas ↔ 3D marker sync | done | unassigned | W3DUI-7 | T10: marker + Enter 3D mode |
| Compass "Enter 3D" → `worldViewMode` | done | unassigned | W3DUI-21 | T10: `toggle_three_d` in PLAYING |
| Transition lifecycle RTL proof | done | unassigned | W3DUI-3 | T11: `TransitionController.lifecycle.test.tsx` |
| Legacy `ThreeDModal` parallel to streamed entry | done | unassigned | W3DUI-22 | PLAYING uses streamed path only; legacy modal non-PLAYING + submap |
| Marker only on MapPane modal | done | unassigned | W3DUI-23 | `WorldAtlasStrip` on GameLayout when `playerWorldPos` set |
| `mapData` cast to `WorldData` (format risk) | done | unassigned | W3DUI-18 | `mapDataToWorldData.ts` adapter |
| Demo/production loader strategy (inline vs worker) | done | unassigned | W3DUI-1 | PLAYING worker; sandbox inline |
| `entryPosition` unused on TransitionController | done | unassigned | W3DUI-24 | Removed from controller; `World3DWrapper` only |
| Atlas marker E2E after 3D movement | done | claude | W3DUI-25 | Playwright test covers pan and marker verification |
| In-3D minimap (deferred Plan 4 UX) | done | claude | W3DUI-26 | `World3DMinimap` in HUD; `World3DMinimap.test.tsx` |
| In-3D nameplates over sites | active | unassigned | W3DUI-27 | Remaining deferred half of Plan 4 HUD UX |

## Global Gap Imports

Checked `docs/projects/GLOBAL_GAPS.md` on **2026-06-02**.

| Global gap | Pertains to this surface? | Imported? | Destination | Scope rationale |
|---|---|---|---|---|
| GG-1..GG-3, GG-5..GG-13 | No | no | — | Character/economy/combat/inventory surfaces — not transition/HUD |
| GG-4 (vegetation scatter perf) | No | no | already routed → `world3d` | Rendering-engine perf; owned by sibling `world3d`, not this layer |
| GG-14 (jsdom canvas getContext) | Partially (touches `World3DMinimap`/`WorldAtlasStrip` tests) | no | — | Repo-wide test-infra fix (`vitest-canvas-mock`); not a transition/HUD feature — left global for tooling owner |
| GG-15 (Ollama proxy log flood) | No | no | — | Vite dev-tooling config; unrelated to this surface |

None imported this cycle: no global gap is owned by the 2D↔3D transition + in-3D HUD surface.

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `?phase=world3d` renders the sandbox (when it sticks) | the entry seam works | live this session |
| Design spec §7–§9 | the intended transition/marker model | `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` |
| Plan 4 doc | complete design for transition + marker sync + HUD | `docs/superpowers/plans/2026-06-01-world-3d-ui-transition-and-marker-sync.md` |
| RTL + Playwright + PERF | T11 verification | `src/components/World3D/__tests__/`, `tests/world-3d-ui-transition.spec.ts`, `PERF.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry (World 3D UI row) | active |
| `docs/projects/world-3d-ui/TRACKER.md` | Active queue (T1, T4-T11) | active |
| `docs/projects/world-3d-ui/GAPS.md` | In-project gaps (W3DUI-1..28) | active |
| `docs/projects/world-3d-ui/PERF.md` | Entry/exit/dispatch perf budget | active |
| `docs/projects/world3d/NORTH_STAR.md` | Sibling: the rendering engine this layer drives | active |
| `docs/projects/worldsim-service/NORTH_STAR.md` | Sibling: world generation/simulation | active |
| `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` | Governing spec (transition §8, marker §9) | active |
| `docs/superpowers/plans/2026-06-01-world-3d-ui-transition-and-marker-sync.md` | Plan 4: transition + marker sync design | active |

## Artifact Boundary

Durable: transition/HUD design intent, the entry seam, decisions, gap classifications. Transient: raw vite logs, screenshots, preview IDs.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Does the real entry replace `WORLD3D_DEMO`, or layer on top of the live PLAYING phase? | **Resolved:** layer on PLAYING via `worldViewMode` | operator | Plan 4 kickoff |
| Inline vs worker-backed loader for the live entry? | Affects transition perf budget | operator/claude | Before production hardening (W3DUI-1) |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/world-3d-ui/TRACKER.md` then `GAPS.md`.
3. Read Plan 4: `docs/superpowers/plans/2026-06-01-world-3d-ui-transition-and-marker-sync.md`.
4. Plan 4 slices T7–T11 are **done**; pick follow-up from Active Task or `GAPS.md`.
5. Run `npx vitest run src/components/World3D/__tests__` and optionally `npx playwright test tests/world-3d-ui-transition.spec.ts`.
6. W3DUI-1/18/22/23/24/25/26 done. Highest-impact remaining follow-up: **W3DUI-27 in-3D nameplates** over `WorldData.sites`.
