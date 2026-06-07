# 3D Combat Map Gap Registry

Status: active
Last updated: 2026-06-07

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | closed | in_scope_now | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Boundary audit | No explicit MVP quality gate is documented at project level for combat-only 3D delivery. Closed 2026-06-05 after `NORTH_STAR.md` gained the Dashboard Card Schema and MVP acceptance criteria; sync confirmed here 2026-06-07 (this registry was still showing `open` while TRACKER had it closed). | `docs/projects/3d-combat-map/NORTH_STAR.md`, `docs/superpowers/specs/2026-05-21-3d-combat-map-design.md`, `src/components/BattleMap/BattleMap3D.tsx`, `src/components/Combat/CombatView.tsx` | Teams can over-scope into non-combat or non-critical 3D work. | Keep acceptance criteria synchronized with future tracker edits. | Next doc sweep confirms criteria are still visible and current. |
| G2 | open | support_needed_now | Claude | `docs/projects/3d-combat-map/TRACKER.md` | Runtime scan | 2026-06-07 reclassified: SSAO + `enableNormalPass` were already removed in code (caused `GL_INVALID_OPERATION` / `glBlitFramebuffer` on WebGL2 + three r170 + `@react-three/postprocessing` 3.x). The post-processing stack is now Bloom+Vignette with ContactShadows replacing the SSAO ground darkening. The original SSAO/NormalPass console errors no longer apply; residual is confirming the replacement stack is console-clean in a live pass. | `src/components/BattleMap/BattleMap3D.tsx:228-251` (removal rationale), `:437` (ContactShadows) | Stale gap wording can mislead the next agent into re-fixing already-removed code. | Run NC1 visual smoke check to confirm no repeated WebGL/postprocessing console errors. | NC1 (see `AUDIT_OR_PROOF.md` and `TRACKER.md` Next-Check List). |
| G3 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Runtime scan | `CombatView` pop-out lifecycle state and render-mode state can diverge. `renderMode` is a single `useState` (`CombatView.tsx:141`) shared by both toggles, but the pop-out container remount path (`:477-503`) is unverified. | `src/components/Combat/CombatView.tsx:141,477-503` | Visual mode can become inconsistent after pop-out interactions. | Add sync rule set for pop-out entry/exit and mode restore. | NC2 integration check in one encounter session (see `AUDIT_OR_PROOF.md`). |
| G4 | open | in_scope_now | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Runtime scan | Character elevation and tile interaction math differs from terrain displacement at steep slopes. | `src/components/BattleMap/BattleMap.tsx`, `src/components/BattleMap/terrain/TerrainMesh.tsx` | Click targets can route to wrong tiles despite clear visual output. | Schedule dedicated interaction correction pass and coordinate with hook contracts. | One slope test case in an integration or E2E check. |
| G5 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/TRACKER.md` | Relationship scan | No joint visual standard document exists across `BattleMap3D`, `World3D`, and `ThreeDModal`. | `docs/projects/world3d/NORTH_STAR.md`, `docs/projects/three-d-modal/NORTH_STAR.md`, `src/components/BattleMap/BattleMap3D.tsx` | Future style drift can confuse users when shifting between combat and exploration 3D surfaces. | Add a short policy note if shared standards are adopted; otherwise keep explicit boundaries. | Add link/decision in next project update only. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Directly blocks or reduces confidence in this project's core goal. |
| `support_needed_now` | Not core implementation, but it blocks confidence in the main MVP path. |
| `adjacent_follow_up` | Useful, related, but not required for current 3D-combat MVP completion. |
