# Testing Overhaul North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

This project keeps the test-planning context for a large, growing area of the app in one cold-start surface.  
Its goal is to prevent duplicate discovery and preserve unfinished scope while execution ownership is assigned.

## Purpose And Scope

Ensure testing work for UI, interaction, map, gameplay, and utility areas proceeds from a shared, explicit plan.

- in-scope for docs: clarify current reality, define the next bounded slice, and preserve execution evidence.
- not in-scope for this pass: source code edits or behavior changes.

## Current State

- The project is registered in `docs/projects/PROJECT_TRACKER.md` with status `planned` and next-step `define test matrix + owners`.
- This folder contains historical planning slices in:
  - `00-MASTER-PLAN.md`
  - `01-CORE-UI.md`
  - `02-CHARACTER-CREATOR.md`
  - `02-COMPLEX-INTERACTIVE.md`
  - `03-GAMEPLAY-SYSTEMS.md`
  - `03-CANVAS-MAP.md`
  - `04-MAP-SYSTEMS.md`
  - `05-UTILITIES.md`
- The three project docs in this folder are the live handoff surface for this task.
- No implementation file changes are included in this docs-only update.

## Active Task

| Field | Value |
|---|---|
| Task | Normalize testing-overhaul handoff docs into an execution-ready slice with explicit matrix, owners, and next checks. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` describe test scope, file map, active ownership, evidence, and next action in one cold-start path. |
| Allowed boundaries | Files in `F:\Repos\Aralia\docs\tasks\testing-overhaul` only. |
| Stop condition | Pause after docs are corrected and gaps are classified if no source execution is authorized. |
| Verification | Confirm consistency between this project docs, `docs/projects/PROJECT_TRACKER.md`, and `docs/projects/GLOBAL_GAPS.md`. |
| Owner | Worker D |
| Next action | Define first execution slice with explicit owner matrix across core UI, complex interactive, map, gameplay, and utility targets. |

## Scope Boundaries

In scope:
- Preserve and update existing planning artifacts (`00`-`05` phase docs).
- Track what has been implemented versus planned.
- Record owner-aware, risk-aware next actions.
- Keep cross-project gap routing visible.

Adjacent but not in this slice:
- Detailed per-file implementation plans beyond the first active slice.
- Full cross-task harmonization of all non-testing roadmap docs.

Out of scope:
- Refactors, behavior work, or edits outside `docs/tasks/testing-overhaul`.

## File Map

| File | Role |
|---|---|
| `NORTH_STAR.md` | Cold-start entry point and scope memory. |
| `TRACKER.md` | Active queue, owner, status, evidence, and next checks. |
| `GAPS.md` | Durable unresolved findings with next proof. |
| `00-MASTER-PLAN.md` | Priority framing and historical target list. |
| `01-CORE-UI.md` | Core UI coverage backlog. |
| `02-CHARACTER-CREATOR.md` | Character creator coverage backlog. |
| `02-COMPLEX-INTERACTIVE.md` | Complex interaction backlog. |
| `03-GAMEPLAY-SYSTEMS.md` | Gameplay system coverage backlog. |
| `03-CANVAS-MAP.md` | Legacy canvas/map coverage backlog. |
| `04-MAP-SYSTEMS.md` | Map-system coverage backlog. |
| `05-UTILITIES.md` | Hooks and utility coverage backlog. |

## Implemented / Planned

Implemented:
- Project registration in the repo-level tracker remains visible.
- Core three-file handoff surface is present.
- Existing planning slices are preserved and linked.

Planned:
- Add explicit owner map and test matrix by area (core UI, complex interactions, map/gameplay, hooks/utils).
- Define verification gates for slice entry and exit.
- Carry forward only required follow-ups into `GAPS.md`.

## Integrations

- `docs/projects/PROJECT_TRACKER.md`: owns project registry and required progress signal.
- `docs/projects/GLOBAL_GAPS.md`: cross-project or external gap routing.
- `docs/ARCHITECTURE.md`: system ownership context for components named in this testing scope (`CharacterCreator`, `Submap`, `Town`, `Combat`, `Inventory`, `Spellbook`).
- Testing strategy context in `00-MASTER-PLAN.md`: existing base on phased rollout and key target components.

## Gaps And Uncertainties

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Owner assignments for each test stream are not explicit. | in_scope_now | to assign | `docs/projects/PROJECT_TRACKER.md`; `00-MASTER-PLAN.md` | Add owner matrix in `TRACKER.md` and align next actions. |
| Duplicate phase naming and stale status labels create ambiguity (`02` and `03` overlap by topic). | adjacent_follow_up | Worker D | `01-CORE-UI.md`; `02-CHARACTER-CREATOR.md`; `02-COMPLEX-INTERACTIVE.md`; `03-GAMEPLAY-SYSTEMS.md`; `03-CANVAS-MAP.md`; `04-MAP-SYSTEMS.md` | Add a one-page execution map in `TRACKER.md`. |
| No concrete integration test matrix is defined in this project surface. | support_needed_now | to assign | `00-MASTER-PLAN.md`; all phase notes | Draft matrix in next active slice. |

## Next Checks

1. Confirm ownership fields and test boundaries in `TRACKER.md`.
2. Validate `GAPS.md` includes every unresolved in-project finding from this pass.
3. Re-run quick alignment check with `docs/projects/PROJECT_TRACKER.md` and report any mismatch.

## Resume Path For A Cold Agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Validate registry + global links.
5. Continue with: define first test slice execution path.
