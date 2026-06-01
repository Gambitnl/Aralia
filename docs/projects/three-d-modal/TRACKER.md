# ThreeD Modal Tracker

Status: active
Last updated: 2026-05-31

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
| T1 | done | Read required root instructions and protocol docs before edits | Worker B | 2026-05-31 | AGENTS.md, docs/agent-workflows/LIVING_PROJECT_TASK_PROTOCOL.md | None | Notes added to final package |
| T2 | done | Produce implementation-grounded docs from existing ThreeD Modal runtime state | Worker B | 2026-05-31 | `src/components/ThreeDModal/ThreeDModal.tsx`, `src/components/layout/GameModals.tsx` | Verify `TRACKER.md` and `NORTH_STAR.md` include file map and state wiring | Manual diff review |
| T3 | done | Document integration boundaries to World3D and battle map systems | Worker B | 2026-05-31 | `src/components/World3D/World3DScene.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, `src/components/Combat/CombatView.tsx` | Confirm distinct integration paths in NORTH_STAR.md | No code edits required |
| T4 | active | Align gap tracking with concrete evidence and next checks | Worker B | 2026-05-31 | `src/components/Submap/SubmapPane.tsx`, `src/state/reducers/uiReducer.ts`, `src/components/Submap/__tests__/SubmapPane.test.tsx` | Fill GAPS.md with specific, actionable follow-ups | Add a next-check line and evidence for each gap |
| T5 | done | Verify scope restriction to docs folder only | Worker B | 2026-05-31 | Git working tree, edit history | Keep only three docs changed |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | in_scope_now | in_scope_now | Worker B | `docs/projects/three-d-modal/GAPS.md` | docs/state surface read | Submap full integration coverage for ThreeD path remains partial and relies on mocks for complex dependencies | `src/components/Submap/__tests__/SubmapPane.test.tsx` | Confident regressions are hard to detect around open/close and nested modal behavior | Add contract-level test coverage focused on `Enter 3D`, close, and overlay state | Add test evidence before touching feature behavior |
| G2 | support_needed_now | support_needed_now | Worker B | `docs/projects/three-d-modal/GAPS.md` | integration scan | No single movement action contract for modal `onMove` callbacks across callsites | `src/components/ThreeDModal/ThreeDModal.tsx`, `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/actionHandlers.ts` | UX can diverge if movement payload rules change in reducer/action handling | Define/record minimal shared contract and verify with one focused proof test | Command payload check in action path |
| G3 | adjacent_follow_up | adjacent_follow_up | Worker B | `docs/projects/GLOBAL_GAPS.md`? | registry row | Distinction and coexistence rules between 3D modal, world3d, and battle-map 3D are not yet codified as product behavior | `docs/projects/PROJECT_TRACKER.md` | Prevents accidental reuse that can blur feature ownership and UX assumptions | Add a brief architecture decision summary in NORTH_STAR when scope expands | Team decision log |

## Update Rules

- Update this tracker before any docs slice change.
- Keep active rows to owner, date, evidence, and next proof/action.
- Keep unresolved gaps in `docs/projects/three-d-modal/GAPS.md` and move truly cross-project findings to the global tracker.
