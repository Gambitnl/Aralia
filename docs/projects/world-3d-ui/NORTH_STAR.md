# World 3D UI North Star

Status: active
Last updated: 2026-06-01

> One of three distinct surfaces in the **Azgaar-driven streamed 3D world** initiative:
> - `world3d` — the 3D **rendering engine** (chunk streaming, meshes, R3F scene).
> - `worldsim-service` — world **generation + simulation** (geometry + first-build history/story).
> - **this surface (`world-3d-ui`)** — the **transition + HUD** layer.
> These are not consolidated; each owns a separate concern. Owner: claude.

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

Early — mostly unbuilt. What exists today:

- The only entry point is the **sandbox** `GamePhase.WORLD3D_DEMO` → `<World3DDemo />`,
  reached via the `?phase=world3d` URL slug (`useHistorySync`). There is no real transition
  from the atlas yet; you jump straight to the sandbox.
- The only HUD is the demo's static header text; the only control is the orbit/pan camera
  (`FreeRoamCameraController`, owned by `world3d`). No view-mode toggle, control panel,
  nameplates, minimap, or marker sync exist.
- The 2D↔3D transition, marker sync, and `playerWorldPos` game-state anchor (spec §7–§9)
  are **not started** (this is "Plan 4").

## Active Task

| Field | Value |
|---|---|
| Task | Author the Plan 4 spec/plan for the 2D↔3D transition + bidirectional Azgaar marker sync (design before build) |
| Acceptance criteria | A written plan exists covering: entry trigger (atlas zoom/click), camera dive in/out, scene mount/unmount handoff with `world3d`, `playerWorldPos` in game state, and atlas marker projection both directions — with the world3d↔world-3d-ui boundary explicit |
| Allowed boundaries | `docs/superpowers/plans/`, `docs/projects/world-3d-ui/`. Design only; no implementation in this slice. |
| Stop condition | Stop when the plan is written and reviewed; do not start implementing the transition. |
| Verification | Plan doc committed under `docs/superpowers/plans/`; cross-linked from this North Star. |
| Owner | claude (claimed) |
| Next action | Resolve the cold-load `?phase=world3d` entry bounce first (it's an entry/transition concern — gap W3DUI-5), then draft Plan 4. |

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
| Cold-load `?phase=world3d` bounces to main_menu intermittently | blocked_human_decision | claude | live debug 2026-06-01; app-level phase race | instrument mount-time phase dispatch order; fix entry so it sticks |
| 2D↔3D transition + marker sync unbuilt (Plan 4) | adjacent_follow_up | claude | spec §8–§9; no code | author Plan 4 |
| No in-3D HUD (controls/toggle/minimap/nameplates) | adjacent_follow_up | claude | `World3DDemo` has header only | define HUD scope in Plan 4 |
| No scene mount/unmount + control lifecycle test | adjacent_follow_up | claude | `World3DScene`/`useChunkStreaming` | add one RTL/Playwright lifecycle proof |

## Global Gap Imports

Checked `docs/projects/GLOBAL_GAPS.md`. None belong to this surface.

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `?phase=world3d` renders the sandbox (when it sticks) | the entry seam works | live this session |
| Design spec §7–§9 | the intended transition/marker model | `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry (World 3D UI row) | active |
| `docs/projects/world-3d-ui/TRACKER.md` | Active queue | active |
| `docs/projects/world-3d-ui/GAPS.md` | In-project gaps | active |
| `docs/projects/world3d/NORTH_STAR.md` | Sibling: the rendering engine this layer drives | active |
| `docs/projects/worldsim-service/NORTH_STAR.md` | Sibling: world generation/simulation | active |
| `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` | Governing spec (transition §8, marker §9) | active |

## Artifact Boundary

Durable: transition/HUD design intent, the entry seam, decisions, gap classifications. Transient: raw vite logs, screenshots, preview IDs.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Does the real entry replace `WORLD3D_DEMO`, or layer on top of the live PLAYING phase? | Decides whether the 3D world is a mode or the main view | operator | Plan 4 kickoff |
| Inline vs worker-backed loader for the live entry? | Affects transition perf budget | operator/claude | Plan 4 |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/world-3d-ui/TRACKER.md` then `GAPS.md`.
3. Read spec §7–§9 for the transition/marker model.
4. Continue from the Active Task: fix the entry bounce, then author Plan 4. Reuse `world3d`'s scene — do not re-implement rendering here.
