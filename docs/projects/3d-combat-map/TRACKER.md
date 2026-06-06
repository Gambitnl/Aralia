# 3D Combat Map Living Tracker

Status: active
Last updated: 2026-06-05

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|
| T1 | done | Convert docs to Aralia-facing living project surface in `docs/projects/3d-combat-map`. | Codex | 2026-05-31 | `docs/projects/3d-combat-map/NORTH_STAR.md` | Keep tracker/gap docs aligned to current code state. | 1-2 file map and ownership checks pass. |
| T2 | done | Finalize this project's MVP boundary and engine constraints in docs. | Codex | 2026-06-05 | `docs/projects/3d-combat-map/NORTH_STAR.md` | Keep the dashboard card schema and acceptance criteria synchronized with future tracker edits. | `docs_consistency` on the next doc sweep. |
| T3 | done | Capture concrete in-scope gaps and unresolveds for next implementation slice. | Codex | 2026-06-05 | `docs/projects/3d-combat-map/GAPS.md` | Refresh gap statuses as implementation findings change. | 1-3 rows remain evidence-backed and current. |
| T4 | pending | Add next-check list for future slices. | future_worker | 2026-06-05 | `src/components/BattleMap/BattleMap3D.tsx`, `src/components/Combat/CombatView.tsx` | Track one explicit visual smoke check and one integration check. | Update `TRACKER.md` with proof IDs. |
| T5 | done | Make embedded 3D combat map behave like a windowpane that fills the available combat-center space. | Codex | 2026-05-31 | `src/components/Combat/CombatView.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, browser visual inspection | Watch future layout passes for mobile/small-height behavior and pop-out parity. | Browser visual check at 1717x1272: embedded 3D canvas measured 1244x1094 and filled the center pane. |

Current resume path: T4 is the next open task unless a new in-scope gap appears first.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | closed | in_scope_now | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Project handoff conversion | No durable evidence-based MVP gate was defined for 3D quality outcomes. Closed 2026-06-05 after `NORTH_STAR.md` gained the dashboard card schema and MVP acceptance criteria. | `docs/projects/3d-combat-map/NORTH_STAR.md`, `conductor/projects/3d-combat-map/SPEC.md`, `docs/superpowers/specs/2026-05-21-3d-combat-map-design.md` | The doc set now carries a clear done state for the combat-only 3D boundary. | Keep the acceptance criteria synchronized with future tracker edits. | Next doc sweep confirms the criteria are still visible and current. |
| G2 | open | support_needed_now | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Runtime scan | `BattleMap3D.tsx` post-processing stack logs SSAO NormalPass errors and is no longer cleanly noisy. | `src/components/BattleMap/BattleMap3D.tsx` | Debug signal can hide future regressions in combat rendering loops. | Decide whether SSAO is required for MVP profile or optional by preset. | One targeted visual check with same renderer path. |
| G3 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Runtime scan | Combat pop-out 3D lifecycle and map-mode state can drift outside `CombatView`. | `src/components/Combat/CombatView.tsx` | Weakens UX confidence and can cause stale render mode state during pop-out. | Decide required sync behavior before the next visual pass. | Manual flow check for toggle, pop-out, and return in one encounter session. |
| G4 | open | in_scope_now | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Runtime audit | Terrain tile click/raycast mapping still uses coarse world-to-tile math and may mismatch steep slope displacement. | `src/components/BattleMap/terrain/TerrainMesh.tsx` and `src/components/BattleMap/BattleMap.tsx` | Incorrect tile targeting affects gameplay correctness even if visuals are improved. | Resolve in a dedicated interaction pass after main MVP visuals. | one interaction test for slope tile selection. |
| G5 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Project boundary review | `World3D` and `ThreeDModal` follow their own renderer stacks; shared style standards are undefined. | `docs/projects/world3d/NORTH_STAR.md`, `docs/projects/three-d-modal/NORTH_STAR.md`, `src/components/BattleMap/BattleMap3D.tsx` | Risk of drift in color, lighting, and interaction expectation. | Add a short policy note in this project before extending shared renderer assets. | Add one decision row in both projects if shared standards are adopted. |
