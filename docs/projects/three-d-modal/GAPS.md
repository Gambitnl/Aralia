# ThreeD Modal Gaps

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | in_scope_now | in_scope_now | Worker B | docs/projects/three-d-modal/TRACKER.md | implementation read | ThreeD modal travel callback payload contract is implicit and not centrally defined | `src/components/ThreeDModal/ThreeDModal.tsx`, `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/actionHandlers.ts` | Inconsistent movement assumptions can break modal-triggered submap movement and action analytics | Define a shared callback contract and add one explicit test or code note in tracker | Add a proof line in tracker after test addition |
| G2 | in_scope_now | in_scope_now | Worker B | docs/projects/three-d-modal/TRACKER.md | test scan | Submap/ThreeD integration tests are incomplete for real component behavior | `src/components/Submap/__tests__/SubmapPane.test.tsx` | Regressions in launch and close flow may go undetected | Add shallow or contract tests for 3D open/close + overlay behavior | Confirm with a focused test run output |
| G3 | adjacent_follow_up | adjacent_follow_up | Worker B | docs/projects/GLOBAL_GAPS.md (possible) | implementation read | 3D modal UX should be aligned with World3D and battle-map UX conventions, but ownership boundaries are not documented as policy | `src/components/World3D/World3DScene.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, `docs/projects/three-d-modal/NORTH_STAR.md` | Without policy, future merges may duplicate or conflict with unrelated systems | Add a shared decision note in project handoff if scope broadens to visual standards | Decision summary attached to tracker |
| G4 | adjacent_follow_up | adjacent_follow_up | Worker B | docs/projects/GLOBAL_GAPS.md (possible) | integration scan | No single documented close/focus policy when 3D launched from global vs submap entry path | `src/components/layout/GameModals.tsx`, `src/components/Submap/SubmapPane.tsx`, `src/components/ThreeDModal/ThreeDModal.tsx` | Accessibility and nested overlay behavior can diverge | Add documented close/focus sequence and accessibility check in NORTH_STAR | Manual proof via QA notes or screen-level flow test |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in slice but required for this task to progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Route cross-project items to `docs/projects/GLOBAL_GAPS.md` with a short rationale.
- Do not broaden project scope in this file while doing docs-only updates.
