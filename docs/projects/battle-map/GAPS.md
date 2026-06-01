# Battle Map Gaps

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/TRACKER.md` | project bootstrap | Define map state/events sync spec and ownership boundaries between CombatView, map renderers, and save/state systems | `docs/projects/PROJECT_TRACKER.md` row + `src/components/Combat/CombatView.tsx` + `src/hooks/useBattleMap.ts` | Missing contract can diverge 2D/3D behavior and complicate debugging during future parity work | Decide contract, event source, and persistence model before large map feature changes | spec note plus review checklist |
| G2 | not_started | in_scope_now | Battle Map owner | `src/services/battleMapGenerator.ts` | implementation audit | Cave/dungeon connectivity is not guaranteed; `ensureConnectivity()` is currently a placeholder comment | `src/services/battleMapGenerator.ts` | Movement/pathing assumptions may fail on generated maps with disconnected regions | Validate connectivity expectations and implement stub before hardening map encounters | add dedicated generation or pathability test |
| G3 | not_started | adjacent_follow_up | Battle Map owner | `src/hooks/useBattleMapGeneration.ts` | implementation audit | Naming drift: file and function names imply hook but expose stateless utility logic | `src/hooks/useBattleMapGeneration.ts` | Increases onboarding ambiguity and complicates static assumptions around hook usage | Align naming or add explicit contract comments in architecture/docs; do not rename blindly while callers exist | decision stored in tracker/PR notes |
| G4 | not_started | support_needed_now | Battle Map owner | `src/components/Combat/CombatView.tsx` + `src/components/BattleMap` | implementation audit | No single parity checklist exists proving state updates, overlays, and highlighting behave identically across 2D and 3D | runtime renderers and shared hooks | Prevents silent renderer divergence and hard-to-trace visual/state bugs | Create and run a parity checklist on first render-mode expansion | checklist artifact in tracker or PR |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the core task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, environment, or another person. |

## Update Rules

- Keep gaps tied to evidence and a concrete next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of keeping them here.
