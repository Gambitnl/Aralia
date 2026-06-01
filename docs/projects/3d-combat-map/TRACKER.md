# 3D Combat Map Living Tracker

Status: active
Last updated: 2026-05-31

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|
| T1 | done | Convert docs to Aralia-facing living project surface in `docs/projects/3d-combat-map`. | Codex | 2026-05-31 | `docs/projects/3d-combat-map/NORTH_STAR.md` | Keep tracker/gap docs aligned to current code state. | 1-2 file map and ownership checks pass. |
| T2 | active | Finalize this project's MVP boundary and engine constraints in docs. | Worker A | 2026-05-31 | `docs/architecture/COMBAT_MAP_ENGINE.md`, `docs/architecture/domains/battle-map.md`, `src/components/Combat/CombatView.tsx` | Add explicit boundaries for 3D scope vs adjacent 3D systems. | Documented in `NORTH_STAR.md` with acceptance notes. |
| T3 | active | Capture concrete in-scope gaps and unresolveds for next implementation slice. | Worker A | 2026-05-31 | `conductor/projects/3d-combat-map/SPEC.md`, `conductor/projects/3d-combat-map/TRACKER.md` | Add 3D-specific gaps that are not source bugs in hooks only. | 1-3 rows in this `GAPS.md` with evidence links. |
| T4 | pending | Add next-check list for future slices. | Worker A | 2026-05-31 | `src/components/BattleMap/BattleMap3D.tsx`, `src/components/Combat/CombatView.tsx` | Track one explicit visual/logic smoke verification step and one integration check. | Update `TRACKER.md` with proof IDs. |
| T5 | done | Make embedded 3D combat map behave like a windowpane that fills the available combat-center space. | Codex | 2026-05-31 | `src/components/Combat/CombatView.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, browser visual inspection | Watch future layout passes for mobile/small-height behavior and pop-out parity. | Browser visual check at 1717x1272: embedded 3D canvas measured 1244x1094 and filled the center pane. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | open | in_scope_now | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Project handoff conversion | No durable evidence-based MVP gate is fully defined for 3D quality outcomes. | `conductor/projects/3d-combat-map/SPEC.md`, `docs/superpowers/specs/2026-05-21-3d-combat-map-design.md`, `src/components/BattleMap/BattleMap3D.tsx` | Implementation can proceed without clear done state in docs. | Finalize acceptance rows in `NORTH_STAR.md` with concrete checks. | 10-point quality gate plus 60fps note. |
| G2 | open | support_needed_now | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Runtime scan | `BattleMap3D.tsx` post-processing stack logs SSAO NormalPass errors and is no longer cleanly noisy. | `src/components/BattleMap/BattleMap3D.tsx` | Debug signal can hide future regressions in combat rendering loops. | Decide whether SSAO is required for MVP profile or optional by preset. | One targeted visual check with same renderer path. |
| G3 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Runtime scan | Combat pop-out 3D lifecycle and map-mode state can drift outside `CombatView`. | `src/components/Combat/CombatView.tsx` | Weakens UX confidence and can cause stale render mode state during pop-out. | Decide required sync behavior before the next visual pass. | Manual flow check for toggle, pop-out, and return in one encounter session. |
| G4 | open | in_scope_now | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Runtime audit | Terrain tile click/raycast mapping still uses coarse world-to-tile math and may mismatch steep slope displacement. | `src/components/BattleMap/terrain/TerrainMesh.tsx` and `src/components/BattleMap/BattleMap.tsx` | Incorrect tile targeting affects gameplay correctness even if visuals are improved. | Resolve in a dedicated interaction pass after main MVP visuals. | one interaction test for slope tile selection. |
| G5 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Project boundary review | `World3D` and `ThreeDModal` follow their own renderer stacks; shared style standards are undefined. | `docs/projects/world3d/NORTH_STAR.md`, `docs/projects/three-d-modal/NORTH_STAR.md`, `src/components/BattleMap/BattleMap3D.tsx` | Risk of drift in color, lighting, and interaction expectation. | Add a short policy note in this project before extending shared renderer assets. | Add one decision row in both projects if shared standards are adopted. |
