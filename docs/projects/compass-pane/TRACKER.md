# Compass Pane Tracker

Status: active
Last updated: 2026-06-05

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
| T2 | active | Validate movement/action surface for Compass Pane end-to-end | Worker B | 2026-06-05 | `src/components/CompassPane/index.tsx`; `src/hooks/actions/actionHandlers.ts`; `src/hooks/actions/handleMovement.ts`; `src/hooks/actions/handleObservation.ts` | Add focused regression checks for direction dispatch, look-around dispatch, and pass-time confirm flow, then record durable proof in the handoff docs | Confirm `handleMovement`, `look_around`, and `wait` are each exercised in tests or manual proof | Add one test per path (UI dispatch + handler effect) before expanding movement logic |
| T3 | not_started | Resolve navigation-affordance gap from registry | Worker B | 2026-06-05 | `src/components/layout/GameLayout.tsx`; `src/components/Submap/SubmapPane.tsx` | Decide intended affordances for map/submap/3D toggles per context and codify behavior | Final decision doc in `GAPS.md` and accepted acceptance phrasing in `TRACKER.md` | Add follow-up entry when acceptance lands |

## Update Rules

- Update this tracker before feature-scoped work starts.
- Keep active, waiting, or blocked rows current with owner, evidence, next action, and proof point.
- Keep unresolved durable gaps in `docs/projects/compass-pane/GAPS.md`.
