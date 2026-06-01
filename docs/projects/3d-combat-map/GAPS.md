# 3D Combat Map Gap Registry

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | open | in_scope_now | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Boundary audit | No explicit MVP quality gate is documented at project level for combat-only 3D delivery. | `docs/superpowers/specs/2026-05-21-3d-combat-map-design.md`, `src/components/BattleMap/BattleMap3D.tsx`, `src/components/Combat/CombatView.tsx` | Teams can over-scope into non-combat or non-critical 3D work. | Add concise pass criteria and acceptance checklist in `NORTH_STAR.md` and tracker. | Update this tracker when all criteria are evidence-based. |
| G2 | open | support_needed_now | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Runtime scan | `BattleMap3D.tsx` post-processing still logs SSAO NormalPass errors. | `src/components/BattleMap/BattleMap3D.tsx` | Debug noise reduces confidence and can mask render regressions. | Decide hard MVP policy: keep SSAO but fix compatibility, or make optional per profile. | One pass in same visual test lane with no repeated console noise. |
| G3 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Runtime scan | `CombatView` pop-out lifecycle state and render-mode state can diverge. | `src/components/Combat/CombatView.tsx` | Visual mode can become inconsistent after pop-out interactions. | Add sync rule set for pop-out entry/exit and mode restore. | Manual flow check in one encounter session. |
| G4 | open | in_scope_now | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Runtime scan | Character elevation and tile interaction math differs from terrain displacement at steep slopes. | `src/components/BattleMap/BattleMap.tsx`, `src/components/BattleMap/terrain/TerrainMesh.tsx` | Click targets can route to wrong tiles despite clear visual output. | Schedule dedicated interaction correction pass and coordinate with hook contracts. | One slope test case in an integration or E2E check. |
| G5 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Relationship scan | No joint visual standard document exists across `BattleMap3D`, `World3D`, and `ThreeDModal`. | `docs/projects/world3d/NORTH_STAR.md`, `docs/projects/three-d-modal/NORTH_STAR.md`, `src/components/BattleMap/BattleMap3D.tsx` | Future style drift can confuse users when shifting between combat and exploration 3D surfaces. | Add a short policy note if shared standards are adopted; otherwise keep explicit boundaries. | Add link/decision in next project update only. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Directly blocks or reduces confidence in this project's core goal. |
| `support_needed_now` | Not core implementation, but it blocks confidence in the main MVP path. |
| `adjacent_follow_up` | Useful, related, but not required for current 3D-combat MVP completion. |
