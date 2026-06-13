# Compass Pane Living Tracker

Status: active
Last updated: 2026-06-12

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
| T3 | active | Resolve navigation-affordance gap from registry | Worker B | 2026-06-08 | `src/components/layout/GameLayout.tsx`; `src/components/Submap/SubmapPane.tsx`; `docs/projects/compass-pane/GAPS.md` | Decide intended affordances for map/submap/3D toggles per context and codify behavior | Final decision doc in `GAPS.md` or a Required Review Brief if the visibility rule itself must change | Validate the current affordance rules against source and close or escalate the decision |

## Update Rules

- Update this tracker before feature-scoped work starts.
- Keep active, waiting, or blocked rows current with owner, evidence, next action, and proof point.
- Keep unresolved durable gaps in `docs/projects/compass-pane/GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
