---
schema_version: 1
project: World 3D UI
slug: world-3d-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-12
iteration: 5
confidence: high
evidence: docs/projects/world-3d-ui
gap_signal: "0 open gaps; local W3DUI rows are closed, while inherited ThreeD Modal routes remain listed in docs/projects/three-d-modal/GAPS.md"
protocol: living project doc set
next_step: "D5 merge recorded 2026-06-10: this project now owns all 3D entrypoints (modal launch, phase transition, close/focus policy) including the merged ThreeD Modal contracts; triage the inherited three-d-modal gaps (entry/close/focus policy, onMove contract, submap test coverage, CMA-G14) into this surface's queue. Otherwise monitor nameplate density/perf."
agent_comments: "Historical '29/29'/'30/30' suite counts in tracker notes were measured over a broader scope; the __tests__ directory is 11 files/25 tests as of 2026-06-10 and its inventory only grew since 06-02 Ã¢â‚¬â€ do not read the lower count as lost tests."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - PERF.md
  - Plan 4 design notes
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - scoped_tests
  - docs_consistency
last_proof: 2026-06-10
workflow_gaps_reviewed: 2026-06-10
compaction_status: needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# World 3D UI North Star

Status: active
Last updated: 2026-06-12

> One of three distinct surfaces in the **Azgaar-driven streamed 3D world** initiative:
> - `world3d` Ã¢â‚¬â€ the 3D **rendering engine** (chunk streaming, meshes, R3F scene).
> - `worldsim-service` Ã¢â‚¬â€ world **generation + simulation** (geometry + first-build history/story).
> - **this surface (`world-3d-ui`)** Ã¢â‚¬â€ the **transition + HUD** layer.
> These are not consolidated; each owns a separate concern. Owner: claude.
>
> Merge update (2026-06-10, D5): the former `three-d-modal` project merged into this
> surface. World 3D UI is now the **single owner of all 3D entrypoints** Ã¢â‚¬â€ modal launch,
> phase transition, and close/focus policy Ã¢â‚¬â€ including the legacy `ThreeDModal`
> entrypoint contracts. `docs/projects/three-d-modal` is merged-reference.

## Dashboard Card Schema

Project: World 3D UI
Slug: world-3d-ui
Category: Feature/UI Projects
Status: active
Confidence: high
Evidence: docs/projects/world-3d-ui
Gap signal: 0 open gaps; local W3DUI rows are closed, while inherited ThreeD Modal routes remain listed in docs/projects/three-d-modal/GAPS.md
Protocol: living project doc set
Next step: D5 merge recorded 2026-06-10 Ã¢â‚¬â€ this surface now owns all 3D entrypoints (modal launch, phase transition, close/focus policy); triage the inherited three-d-modal gaps into this queue, otherwise monitor nameplate density/perf.
Required verification: scoped_tests, docs_consistency
Completed verification: scoped_tests, docs_consistency
Last proof: 2026-06-10
Workflow gaps reviewed: 2026-06-10
Agent comments: Historical "29/29"/"30/30" suite counts in tracker notes were measured over a broader scope; the __tests__ directory is 11 files/25 tests as of 2026-06-10 and its inventory only grew since 06-02.
Required docs: NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md
Optional docs: PERF.md, Plan 4 design notes
Compaction status: not_needed

## Why This Project Exists

The 3D world needs two things the rendering engine deliberately does not own: a way to
**get into and out of it** (the handoff from the 2D Azgaar atlas down into the streamed 3D
world, and back), and the **2D UI layered on top of it** while you're there (controls,
nameplates, minimap, mode toggles). Keeping this separate from `world3d` prevents the
rendering engine from absorbing transition state and HUD concerns, and gives the eventual
atlasÃ¢â€ â€3D bridge a clear owner.

## Intended Outcome

- A smooth **2D atlas Ã¢â€ â€™ 3D world transition**: zoom/dive from the Azgaar map into the
  streamed world at the chosen location, mount the 3D scene, and reverse it on exit.
- A **bidirectional marker sync**: the player's 3D world position projects to a marker on
  the 2D atlas; clicking the atlas can drive entry/relocation. (Spec Ã‚Â§8Ã¢â‚¬â€œÃ‚Â§9, "Plan 4".)
- An **in-3D HUD**: control panel, view-mode toggle, nameplates/labels, minimap, and debug
  overlays composited over the rendering engine's canvas.

## Current State

**Plan 4 complete (T7Ã¢â‚¬â€œT11).** Production PLAYING entry path is wired:

- **Game-state anchors** (`worldViewMode`, `playerWorldPos`, actions, reducer, hooks) Ã¢â‚¬â€ done (T7).
- **PLAYING-phase 3D routing** Ã¢â‚¬â€ `TransitionController` cross-fades atlas Ã¢â€ â€ `World3DWrapper` by `worldViewMode` (T8/T10).
- **`World3DWrapper`** Ã¢â‚¬â€ worker-backed `ChunkLoader` from `worldData` (W3DUI-1), throttled position dispatch with terrain height via `getTerrainHeight()`, FPS/chunk debug stats (T8/T9).
- **`InWorldHUD`** Ã¢â‚¬â€ control panel (Open Map, Exit to Menu), view-mode toggle, dev-only `DebugHUD` (T9).
- **`AtlasPlayerMarker` + click-to-travel** Ã¢â‚¬â€ marker on MapPane Azgaar overlay; **Enter 3D** interaction mode dispatches position + `worldViewMode`; compass **Enter 3D** routes to streamed world (T10).
- **Integration tests + perf budget** Ã¢â‚¬â€ RTL lifecycle (W3DUI-3), `worldCoords` unit tests, Playwright HUD round-trip, `docs/projects/world-3d-ui/PERF.md` (T11).
- **Sandbox** `WORLD3D_DEMO` Ã¢â€ â€™ `<World3DDemo />` via `?phase=world3d` remains unchanged.
- **In-3D minimap** Ã¢â‚¬â€ `World3DMinimap` paints a top-down view from `WorldData.biomeIds` with the live `AtlasPlayerMarker`, mounted bottom-left of `InWorldHUD` (W3DUI-26). In-3D nameplates are now implemented and gated in `World3DNameplates` (W3DUI-27).
- **`WorldAtlasStrip`** Ã¢â‚¬â€ compact world-map preview with `AtlasPlayerMarker` on PLAYING `GameLayout` when `playerWorldPos` is set (W3DUI-23).

## Active Task

| Field | Value |
|---|---|
| Task | W3DUI-27 complete: in-3D nameplates over visible `WorldData.sites` |
| Acceptance criteria | Labels render for visible `world3d.sites` with distance + LOD + max-visible gates and no UI flooding |
| Allowed boundaries | `world-3d-ui` surface |
| Stop condition | Monitor label behavior under dense sites; no open task in this surface |
| Verification | `World3DNameplates.test.tsx` and full `World3D` suite pass |
| Owner | gpt-5.3-codex-spark |
| Status | done |
| Next action | None queued on world-3d-ui; monitor thresholds in broader perf sweep. Re-verified green on 2026-06-10 (iteration 4 monitor pass, 25/25) |

## Scope Boundaries

In scope:
- 2DÃ¢â€ â€™3D and 3DÃ¢â€ â€™2D transition orchestration (entry trigger, camera dive, scene mount/unmount handoff).
- Bidirectional Azgaar atlas Ã¢â€ â€ 3D position marker sync; `playerWorldPos` game-state anchor.
- Phase/entry wiring that makes the 3D world reachable (`WORLD3D_DEMO` today; real routing later).
- In-3D HUD: control panel, view-mode toggle, nameplates, minimap, debug overlays.
- Since 2026-06-10 (D5 merge): **all 3D entrypoint contracts** Ã¢â‚¬â€ modal launch, phase
  transition, and close/focus policy Ã¢â‚¬â€ including the legacy `ThreeDModal` surface
  (`src/components/ThreeDModal/*`, its `GameModals`/`SubmapPane` entry paths, and the
  `isThreeDVisible`/`TOGGLE_THREE_D_VISIBILITY` wiring) formerly owned by
  `docs/projects/three-d-modal` (now merged-reference).

Out of scope (owned elsewhere):
- Chunk streaming, mesh generation, the R3F scene/camera-controller, materials Ã¢â‚¬â€ `world3d`.
- World generation + history/story/events Ã¢â‚¬â€ `worldsim-service`.
- Combat HUD / `BattleMap3D` Ã¢â‚¬â€ separate combat surfaces.

## What Must Not Be Lost

- The `world3d` URL slug for entry; the existing `WORLD3D_DEMO` phase as the current entry seam.
- The eventual transition must **reuse** `world3d`'s scene rather than re-implement rendering.
- Worker utilities exist in `world3d` but are unused by the demo entry Ã¢â‚¬â€ an entry-strategy decision lives here, not a reason to delete them.

## Merge Record (2026-06-10): ThreeD Modal Ã¢â€ â€™ World 3D UI

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D5 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`), recorded here from the receiving side:

- World 3D UI is now the **single owner of all 3D entrypoints**: modal launch, phase
  transition, and close/focus policy.
- The `three-d-modal` project's docs (`docs/projects/three-d-modal/*`) become
  merged-reference; its implementation record stays there, but forward work routes
  through this project.
- Inherited open items from `docs/projects/three-d-modal/GAPS.md` to triage into this
  surface's queue: the global-vs-submap entry/close/focus policy (their G1/G4), the
  shared `onMove` movement-action contract (their G2 / NORTH_STAR follow-up), submap 3D
  launch/close test coverage, and the CMA-G14 split route for `Scene3D.tsx`/`PropsLayer.tsx`.
- Existing W3DUI-22 work (legacy `ThreeDModal` gated to non-PLAYING + submap) remains the
  current behavior contract for the merged surface.

## Known Gaps And Follow-Ups

See `docs/projects/world-3d-ui/GAPS.md`. Headline:

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Cold-load `?phase=world3d` bounces to main_menu intermittently | done | claude | W3DUI-5 | Fixed |
| 2DÃ¢â€ â€3D transition animations in PLAYING | done | unassigned | W3DUI-20 | `TransitionController` wraps PLAYING branch (T10) |
| Bidirectional atlas Ã¢â€ â€ 3D marker sync | done | unassigned | W3DUI-7 | T10: marker + Enter 3D mode |
| Compass "Enter 3D" Ã¢â€ â€™ `worldViewMode` | done | unassigned | W3DUI-21 | T10: `toggle_three_d` in PLAYING |
| Transition lifecycle RTL proof | done | unassigned | W3DUI-3 | T11: `TransitionController.lifecycle.test.tsx` |
| Legacy `ThreeDModal` parallel to streamed entry | done | unassigned | W3DUI-22 | PLAYING uses streamed path only; legacy modal non-PLAYING + submap |
| Marker only on MapPane modal | done | unassigned | W3DUI-23 | `WorldAtlasStrip` on GameLayout when `playerWorldPos` set |
| `mapData` cast to `WorldData` (format risk) | done | unassigned | W3DUI-18 | `mapDataToWorldData.ts` adapter |
| Demo/production loader strategy (inline vs worker) | done | unassigned | W3DUI-1 | PLAYING worker; sandbox inline |
| `entryPosition` unused on TransitionController | done | unassigned | W3DUI-24 | Removed from controller; `World3DWrapper` only |
| Atlas marker E2E after 3D movement | done | claude | W3DUI-25 | Playwright test covers pan and marker verification |
| In-3D minimap (deferred Plan 4 UX) | done | claude | W3DUI-26 | `World3DMinimap` in HUD; `World3DMinimap.test.tsx` |
| In-3D nameplates over sites | done | gpt-5.3-codex-spark | W3DUI-27 | `World3DNameplates` + `World3DScene` + `World3DWrapper`; gate by LOD/distance and max visible |

## Global Gap Imports

Checked `docs/projects/GLOBAL_GAPS.md` on **2026-06-10** (previous check 2026-06-02).

| Global gap | Pertains to this surface? | Imported? | Destination | Scope rationale |
|---|---|---|---|---|
| GG-1..GG-3, GG-5..GG-13 | No | no | Ã¢â‚¬â€ | Character/economy/combat/inventory surfaces Ã¢â‚¬â€ not transition/HUD |
| GG-4 (vegetation scatter perf) | No | no | already routed Ã¢â€ â€™ `world3d` | Rendering-engine perf; owned by sibling `world3d`, not this layer |
| GG-14 (jsdom canvas getContext) | Partially (touches `World3DMinimap`/`WorldAtlasStrip` tests) | no | Ã¢â‚¬â€ | Repo-wide test-infra fix (`vitest-canvas-mock`); not a transition/HUD feature Ã¢â‚¬â€ left global for tooling owner. Warnings still observed (non-failing) in the 2026-06-10 suite run |
| GG-15 (Ollama proxy log flood) | No | no | Ã¢â‚¬â€ | Vite dev-tooling config; unrelated to this surface |
| GG-16..GG-25 (dep headers, type drift, character/combat/spell debt, coverage) | No | no | Ã¢â‚¬â€ | Tooling/types/character/combat surfaces Ã¢â‚¬â€ none owned by transition/HUD |
| GG-26 (project-card schema migration) | Already satisfied here | no | Ã¢â‚¬â€ | This folder has full `NORTH_STAR.md` frontmatter plus DECISIONS/AUDIT_OR_PROOF/RUNBOOK (created 2026-06-10 migration pass) |
| GG-27 (missing Required Review Briefs) | No | no | Ã¢â‚¬â€ | This project is not review-required (`human_decision_required: no`) |

None imported this cycle: no global gap is owned by the 2DÃ¢â€ â€3D transition + in-3D HUD surface.

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `?phase=world3d` renders the sandbox (when it sticks) | the entry seam works | live this session |
| Design spec Ã‚Â§7Ã¢â‚¬â€œÃ‚Â§9 | the intended transition/marker model | `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` |
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
| `docs/superpowers/specs/2026-05-28-azgaar-3d-streamed-world-design.md` | Governing spec (transition Ã‚Â§8, marker Ã‚Â§9) | active |
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
4. Plan 4 slices T7Ã¢â‚¬â€œT11 are **done**; pick follow-up from Active Task or `GAPS.md`.
5. Run `npx vitest run src/components/World3D/__tests__` and optionally `npx playwright test tests/world-3d-ui-transition.spec.ts`.
6. W3DUI-1/18/22/23/24/25/26/27 done. Plan 4 HUD UX is complete; monitor naming plate density and perf as follow-up signals.
