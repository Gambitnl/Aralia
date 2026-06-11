---
schema_version: 1
project: Three D Modal
slug: three-d-modal
category: active project
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: merged-reference
last_updated: 2026-06-10
confidence: unknown
evidence: "docs/projects/three-d-modal/TRACKER.md; docs/projects/three-d-modal/GAPS.md"
gap_signal: present (open gaps now route through docs/projects/world-3d-ui)
protocol: living-project
next_step: "Merged into World 3D UI (D5, 2026-06-10): World 3D UI is the single owner of all 3D entrypoints (modal launch, phase transition, close/focus policy). Route forward work through docs/projects/world-3d-ui; this folder is merged-reference."
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
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: merged-reference
deprecation_confidence: confirmed
deprecation_reason: merged_into_world_3d_ui_per_D5_2026-06-10
canonical_owner: "docs/projects/world-3d-ui"
human_decision_required: "no"
---
# ThreeD Modal North Star

Status: merged-reference (decision recorded 2026-06-10; merged into World 3D UI)
Last updated: 2026-06-10

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Three D Modal |
| Slug | three-d-modal |
| Category | merged-reference |
| Status | merged-reference (merged into World 3D UI, D5 2026-06-10) |
| Confidence | unknown |
| Evidence | docs/projects/three-d-modal/TRACKER.md; docs/projects/three-d-modal/GAPS.md |
| Gap signal | present (open gaps now route through docs/projects/world-3d-ui) |
| Protocol | living-project |
| Next step | Merged into World 3D UI (D5, 2026-06-10): route forward 3D-entrypoint work through docs/projects/world-3d-ui; keep this folder as merged-reference. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | 2026-06-08 |
| Lifecycle status | merged-reference |
| Deprecation confidence | confirmed |
| Deprecation reason | merged_into_world_3d_ui_per_D5_2026-06-10 |
| Canonical owner | docs/projects/world-3d-ui |
| Human decision required | no (merge decision recorded 2026-06-10) |

## Decision (2026-06-10): Merged into World 3D UI

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D5 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`):

- **ThreeD Modal merges into World 3D UI.** `docs/projects/world-3d-ui` becomes the
  single owner of all 3D entrypoints: modal launch, phase transition, and close/focus
  policy.
- **These docs become merged-reference.** All content below is preserved as the
  implementation record of the ThreeD modal surface (`src/components/ThreeDModal/*`,
  its `GameModals`/`SubmapPane` entry paths, and state wiring), but forward work —
  including the open gaps in `GAPS.md` (G1/G2/G4 entry/close/movement contracts,
  CMA-G14 split routing) — is owned and scheduled through World 3D UI.
- The "should this merge with World 3D UI" review question that held this project at
  `human-review-required` is thereby closed.

Status: decision recorded 2026-06-10; lifecycle is merged-reference.

## Why This Project Exists

This project preserves the existing ThreeD modal implementation as a stable handoff surface for future slices. The feature now has runtime entry points, not just registry evidence.

## Intended Outcome

Create an implementation-grounded cold-start snapshot that records:

- What currently works and where.
- How the modal is wired into state and UI overlays.
- What is distinct from World3D and battle-map 3D.
- What must be resolved before UX is complete.

## Current State

- Implemented full-screen immersive modal at `src/components/ThreeDModal/ThreeDModal.tsx`.
- Implemented R3F scene graph in `src/components/ThreeDModal/Scene3D.tsx`.
- Rendered through `src/components/layout/GameModals.tsx` when `gameState.isThreeDVisible` is true.
- Also launched from `src/components/Submap/SubmapPane.tsx` via local `isThreeDOpen` state.
- Action/reducer chain exists for `TOGGLE_THREE_D_VISIBILITY`.

## Active Task

| Field | Value |
|---|---|
| Task | Convert three-d-modal docs to an execution-ready living snapshot |
| Acceptance criteria | NORTH_STAR.md, TRACKER.md, GAPS.md document scope, integrations, file map, and concrete unresolveds |
| Allowed boundaries | `docs/projects/three-d-modal/NORTH_STAR.md`, `docs/projects/three-d-modal/TRACKER.md`, `docs/projects/three-d-modal/GAPS.md` only |
| Stop condition | No source edits; docs reflect current implementation plus unresolved follow-ups |
| Verification | `rg -n "TOGGLE_THREE_D_VISIBILITY|ThreeDModal|GameModals|WORLD_3D|BattleMap3D|THREE_D_MODAL|SUBMAP" src/components src/state src/styles src/hooks` |
| Owner | Worker B |
| Next action | Keep `TRACKER.md` and `GAPS.md` aligned with the next UX/contract check |

## Scope Boundaries

In scope:
- `src/components/ThreeDModal` implementation and integration points.
- `GameModals.tsx` and `SubmapPane.tsx` entry conditions.
- `state` wiring for visibility and overlay conflicts.
- `styles` layering and ID contract used by the modal.

Adjacent but not in scope:
- Refactors to combat rendering or world-level 3D chunk streaming.
- New 3D feature design, camera style, or performance rewrites.
- Global test strategy for all modal flows.

Out of scope:
- Editing non-doc artifacts.
- Editing `docs/projects/PROJECT_TRACKER.md`.
- Any source refactors.

## File Map

- `src/components/ThreeDModal/ThreeDModal.tsx`: Modal shell, HUD, social panel, travel buttons, close flow.
- `src/components/ThreeDModal/Scene3D.tsx`: Canvas scene and content composition.
- `src/components/ThreeDModal/*`: Camera, player, units, terrain, lighting, sky and post-processing helpers.
- `src/components/layout/GameModals.tsx`: Global overlay mount with state guard and dispatch close action.
- `src/components/Submap/SubmapPane.tsx`: Local "Enter 3D" button and local modal open flow.
- `src/state/initialState.ts`: `isThreeDVisible` initial flag.
- `src/state/actionTypes.ts` and `src/state/actionTypes.d.ts`: `TOGGLE_THREE_D_VISIBILITY`.
- `src/state/reducers/uiReducer.ts`: overlay exclusivity toggles for map, submap, 3D.
- `src/hooks/actions/actionHandlers.ts`: `toggle_three_d` command dispatch.
- `src/styles/zIndex.ts`: immersive modal layer constants.
- `src/styles/uiIds.ts`: `THREE_D_MODAL` test and query id.

## Implemented State

- `TOGGLE_THREE_D_VISIBILITY` action exists in action types.
- Initial game state includes `isThreeDVisible: false`.
- `TOGGLE_THREE_D_VISIBILITY` in reducer sets `isThreeDVisible` and disables competing overlays.
- `GameModals.tsx` renders `ThreeDModal` when:
  - `isThreeDVisible` is true,
  - party lead exists,
  - and coordinate context exists.
- Local submap entry uses `isThreeDOpen` and invokes the same modal component without touching global reducer state.
- `ThreeDModal` currently accepts direct `onMove` callbacks that dispatch `move` actions from callers.
- Modal uses immersive z-index slots:
  - `Z_INDEX.MODAL_IMMERSIVE_BACKGROUND`
  - `Z_INDEX.MODAL_IMMERSIVE_CONTENT`

## Integration Relations

- `world3d` / `World3D/*` is a separate pathway. It is chunk-streamed world-scale exploration in `World3DScene.tsx` and `World3DDemo.tsx` and is not imported by ThreeDModal.
- `battle-map` / `BattleMap3D.tsx` is a combat renderer used in `CombatView.tsx` with 2D/3D toggles. It is driven by combat state and does not share movement flow with submap exploration 3D.
- ThreeDModal is therefore an exploration modal and a testable standalone R3F stack under `src/components/ThreeDModal/*`.

## What Must Not Be Lost

- Overlay conflict prevention in `uiReducer` so modal surfaces stay mutually exclusive.
- Two entry styles (global and submap local) that currently coexist.
- Existing safeguards for close semantics (`Escape` and explicit close controls).
- Existing unresolved scope in registry: establish UX contract for 3D entrypoints.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| UX contract for 3D entry and close flow across global and submap entrypoints | adjacent_follow_up | Worker B | `docs/projects/PROJECT_TRACKER.md` | Add explicit rule docs and acceptance tests before product handoff |
| Shared movement action contract for `onMove` callbacks between modal and gameplay action handlers | support_needed_now | Worker B | `src/components/ThreeDModal/ThreeDModal.tsx`, `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/actionHandlers.ts` | Add one command contract check and verify payload compatibility |
| Submap full integration test coverage for 3D path remains partial due mocks | in_scope_now | Worker B | `src/components/Submap/__tests__/SubmapPane.test.tsx` | Move to shallow/component-contract tests for 3D launch and close |

## Global Gap Imports

Check the global tracker for re-home candidates:
[docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md)

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | Project scope is self-contained for now |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Action type and handler mapping | 3D can be toggled by UI and action system | `src/state/actionTypes.ts`, `src/hooks/actions/actionHandlers.ts`, `src/state/reducers/uiReducer.ts` |
| Render gate and props | Modal opens from global state and receives game context | `src/components/layout/GameModals.tsx` |
| Local launch path | Submap can independently open 3D experience | `src/components/Submap/SubmapPane.tsx` |
| Runtime composition | Scene features and controls are implemented in modal modules | `src/components/ThreeDModal/ThreeDModal.tsx`, `src/components/ThreeDModal/Scene3D.tsx` |
| Layering contract | Dedicated immersive modal z-index intent exists | `src/styles/zIndex.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| docs/projects/three-d-modal/TRACKER.md | Task queue and status log | active |
| docs/projects/three-d-modal/GAPS.md | Durable unresolved items | active |
| docs/projects/PROJECT_TRACKER.md | Registry evidence | active |
| docs/projects/GLOBAL_GAPS.md | Cross-project gap routing | active |

## Artifact Boundary

Keep durable intent, decisions, and unresolved gaps here. Do not move test logs, local run diagnostics, or temporary renderer artifacts into this folder unless they are promoted with a clear decision rationale.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Should local Submap 3D use global toggle action instead of local `isThreeDOpen` state? | Avoids duplicated overlay lifecycle behavior | Worker B | Next UX harmonization pass |
| Should ThreeD modal, battle map, and world3d share a common 3D preset contract? | Reduces config drift across render stacks | Worker B | Architecture consolidation pass |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/three-d-modal/TRACKER.md`.
3. Read `docs/projects/three-d-modal/GAPS.md`.
4. Verify linked runtime files in `src/components/ThreeDModal`, `src/components/layout/GameModals.tsx`, `src/components/Submap/SubmapPane.tsx`, and `src/state`.
5. Continue from the highest-priority open gap.
6. Update 2026-06-10: this project is merged-reference (D5). Do not pick up forward work from here — route it through `docs/projects/world-3d-ui`, which now owns all 3D entrypoint contracts.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
