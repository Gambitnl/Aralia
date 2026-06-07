# 3D Combat Map Living Tracker

Status: active
Last updated: 2026-06-07

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|
| T1 | done | Convert docs to Aralia-facing living project surface in `docs/projects/3d-combat-map`. | Codex | 2026-05-31 | `docs/projects/3d-combat-map/NORTH_STAR.md` | Keep tracker/gap docs aligned to current code state. | 1-2 file map and ownership checks pass. |
| T2 | done | Finalize this project's MVP boundary and engine constraints in docs. | Codex | 2026-06-05 | `docs/projects/3d-combat-map/NORTH_STAR.md` | Keep the dashboard card schema and acceptance criteria synchronized with future tracker edits. | `docs_consistency` on the next doc sweep. |
| T3 | done | Capture concrete in-scope gaps and unresolveds for next implementation slice. | Codex | 2026-06-05 | `docs/projects/3d-combat-map/GAPS.md` | Refresh gap statuses as implementation findings change. | 1-3 rows remain evidence-backed and current. |
| T4 | done | Add next-check list for future slices. | Claude | 2026-06-07 | `TRACKER.md` Next-Check List + `AUDIT_OR_PROOF.md` (NC1 visual smoke, NC2 integration) | Run NC1 + NC2 in the next implementation slice and capture results in `AUDIT_OR_PROOF.md`. | NC1 (visual smoke) and NC2 (integration) executed with captured evidence. |
| T5 | done | Make embedded 3D combat map behave like a windowpane that fills the available combat-center space. | Codex | 2026-05-31 | `src/components/Combat/CombatView.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, browser visual inspection | Watch future layout passes for mobile/small-height behavior and pop-out parity. | Browser visual check at 1717x1272: embedded 3D canvas measured 1244x1094 and filled the center pane. |

Current resume path: T4 is done. Next open work is G4 (terrain raycast/tile mapping, `in_scope_now`) or executing NC1/NC2 to retire the post-processing and pop-out concerns. Pick the highest-value in-scope item first.

## Next-Check List For Future Slices

These are the standing acceptance checks the next implementation slice should run
before claiming combat-3D visual/parity work is done. They are deliberately small,
evidence-backed, and mapped to open gaps. Full step-by-step definitions and the
pass/fail bars live in `AUDIT_OR_PROOF.md`.

| Check ID | Type | What it proves | Primary surface | Guards | Pass bar |
|---|---|---|---|---|---|
| NC1 | visual smoke | 3D combat scene renders cleanly with no repeated WebGL/postprocessing console errors | `src/components/BattleMap/BattleMap3D.tsx` (Canvas + Bloom/Vignette + ContactShadows) | G2 | A ~5s 3D render pass with camera movement shows terrain, grid, and actors and logs no repeated `GL_INVALID_OPERATION` / `glBlitFramebuffer` / SSAO / NormalPass errors. |
| NC2 | integration | Render-mode and combat lifecycle survive a pop-out round trip | `src/components/Combat/CombatView.tsx` (`renderMode` state + inline/pop-out toggles + pop-out container) | G3 | Enter combat → 3D → pop-out → interact → return: `renderMode` stays `3d`, turn order and selected token persist, and the 2D⇄3D toggle still works afterward. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | closed | in_scope_now | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Project handoff conversion | No durable evidence-based MVP gate was defined for 3D quality outcomes. Closed 2026-06-05 after `NORTH_STAR.md` gained the dashboard card schema and MVP acceptance criteria. | `docs/projects/3d-combat-map/NORTH_STAR.md`, `conductor/projects/3d-combat-map/SPEC.md`, `docs/superpowers/specs/2026-05-21-3d-combat-map-design.md` | The doc set now carries a clear done state for the combat-only 3D boundary. | Keep the acceptance criteria synchronized with future tracker edits. | Next doc sweep confirms the criteria are still visible and current. |
| G2 | open | support_needed_now | Claude | `docs/projects/3d-combat-map/GAPS.md` | Runtime scan | 2026-06-07 reclassified: SSAO + `enableNormalPass` were already removed in code; the stack is now Bloom+Vignette with ContactShadows replacing SSAO ground darkening. The original "SSAO NormalPass errors" no longer apply. Residual = confirm the replacement stack is console-clean in a live pass. | `src/components/BattleMap/BattleMap3D.tsx:228-251`, `:437` | Stale gap wording can mislead the next agent into re-fixing already-removed code. | Run NC1 to confirm no repeated WebGL/postprocessing console errors in a live render pass. | NC1 visual smoke check (see `AUDIT_OR_PROOF.md`). |
| G3 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Runtime scan | Combat pop-out 3D lifecycle and map-mode state can drift outside `CombatView`. `renderMode` is a single `useState` in `CombatView.tsx:141` shared by both the inline (`:583`) and pop-out (`:485`) toggles, but the pop-out container (`:477-503`) remount path is unverified. | `src/components/Combat/CombatView.tsx:141,485,583` | Weakens UX confidence and can cause stale render mode state during pop-out. | Decide required sync behavior before the next visual pass. | NC2 integration check: toggle, pop-out, and return in one encounter session (see `AUDIT_OR_PROOF.md`). |
| G4 | open | in_scope_now | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Runtime audit | Terrain tile click/raycast mapping still uses coarse world-to-tile math and may mismatch steep slope displacement. | `src/components/BattleMap/terrain/TerrainMesh.tsx` and `src/components/BattleMap/BattleMap.tsx` | Incorrect tile targeting affects gameplay correctness even if visuals are improved. | Resolve in a dedicated interaction pass after main MVP visuals. | one interaction test for slope tile selection. |
| G5 | open | adjacent_follow_up | future_worker | `docs/projects/3d-combat-map/GAPS.md` | Project boundary review | `World3D` and `ThreeDModal` follow their own renderer stacks; shared style standards are undefined. | `docs/projects/world3d/NORTH_STAR.md`, `docs/projects/three-d-modal/NORTH_STAR.md`, `src/components/BattleMap/BattleMap3D.tsx` | Risk of drift in color, lighting, and interaction expectation. | Add a short policy note in this project before extending shared renderer assets. | Add one decision row in both projects if shared standards are adopted. |
