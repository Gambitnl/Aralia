# Demo Area Gap Registry

Status: active (G1 decided 2026-06-10)
Last updated: 2026-06-10

Use this file for durable unresolved findings that belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | blocked_human_decision | Worker B | docs/projects/demo-area/TRACKER.md | runtime scan | Decide what to do with `src/components/demo/CombatMessagingDemo.tsx`: retain as reference, re-home into active demo entry, or remove | `src/components/demo/CombatMessagingDemo.tsx` exists but is not imported or routed; `docs/projects/DECISION_BLITZ_2026-06-10.md` D19 | Prevents drift between written intent and runtime behavior | Decided 2026-06-10 (Remy, D19): retain as a reference artifact — no re-home, no removal (expansion-first); the orphaned state is accepted and documented | Decision recorded 2026-06-10 in DECISIONS.md D2 and NORTH_STAR Decision section |
| G2 | not_started | support_needed_now | Worker B | docs/projects/PROJECT_TRACKER.md | scan | Update registry evidence path to match active demo implementations (`components/BattleMap`, `components/World3D`) or explicitly mark why it remains `components/demo` | `docs/projects/PROJECT_TRACKER.md` row uses `src/components/demo`; active flows in `App.tsx` use other folders | Keeps onboarding handoff accurate for future work and avoids stale scope references | Update `docs/projects/PROJECT_TRACKER.md` in a scope-allowed follow-up, or add a local justification here if the registry stays untouched | Registry row and tracker check aligned |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it |
| `support_needed_now` | Not in slice but required for task progress |
| `adjacent_follow_up` | Related, useful, and outside current proof scope |
| `out_of_scope` | Explicitly not part of this project/task |
| `blocked_human_decision` | Owner/operator choice is required |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service |

## Update Rules

- Keep gaps tied to concrete evidence and a next proof/check.
- Move cross-project or external items to `docs/projects/GLOBAL_GAPS.md` only when they do not belong to Demo Area outcomes.
