# World 3D UI Living Tracker

Status: active
Last updated: 2026-06-10

North Star: `docs/projects/world-3d-ui/NORTH_STAR.md`
Scope (clarified 2026-06-01): the **2D->3D transition + in-3D HUD** layer that drives and
overlays the `world3d` rendering engine. Gaps are authoritative in
`docs/projects/world-3d-ui/GAPS.md`.

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
| T22 | not_started | Triage inherited ThreeD Modal entrypoint gaps after the D5 merge (entry/close/focus policy, shared `onMove` contract, submap 3D test coverage, CMA-G14 split route) into W3DUI gap rows | unassigned | 2026-06-10 | `docs/projects/DECISION_BLITZ_2026-06-10.md` D5; `docs/projects/three-d-modal/GAPS.md` (merged-reference); `src/components/ThreeDModal/*`, `src/components/Submap/SubmapPane.tsx`, `src/components/layout/GameModals.tsx` | Open W3DUI rows for the inherited items that get scheduled; keep the merged-reference inventory intact | Inherited items appear as W3DUI rows or an explicit defer note in `GAPS.md` |

Gaps are tracked in `docs/projects/world-3d-ui/GAPS.md` (W3DUI-1..28) - see it for the full gap log, including the routed entry/transition gaps from `world3d`.

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/world-3d-ui/GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
