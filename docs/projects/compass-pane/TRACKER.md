# Compass Pane Living Tracker

Status: active
Last updated: 2026-06-08

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Establish living project docs from registry evidence and implementation scan | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `src/components/CompassPane/index.tsx` | Keep only living-project artifacts in this folder and keep them evidence-backed | `NORTH_STAR.md`, `GAPS.md`, and `TRACKER.md` now align with code evidence | Evidence-to-doc alignment check by reading these files |
| T2 | done | Validate movement/action surface for Compass Pane end-to-end | Worker B | 2026-06-08 | `src/components/CompassPane/index.tsx`; `src/components/CompassPane/__tests__/CompassPane.test.tsx`; `docs/projects/compass-pane/AUDIT_OR_PROOF.md` | Regression proof is in place for direction dispatch, look-around dispatch, edge disablement, and pass-time confirm flow | Confirmed in tests; keep the proof note durable for future cold-start agents | Keep the proof note current only if the compass action contract changes again |
| T3 | active | Resolve navigation-affordance gap from registry | Worker B | 2026-06-08 | `src/components/layout/GameLayout.tsx`; `src/components/Submap/SubmapPane.tsx`; `docs/projects/compass-pane/GAPS.md` | Decide intended affordances for map/submap/3D toggles per context and codify behavior | Final decision doc in `GAPS.md` or a Required Review Brief if the visibility rule itself must change | Validate the current affordance rules against source and close or escalate the decision |

## Update Rules

- Update this tracker before feature-scoped work starts.
- Keep active, waiting, or blocked rows current with owner, evidence, next action, and proof point.
- Keep unresolved durable gaps in `docs/projects/compass-pane/GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |
