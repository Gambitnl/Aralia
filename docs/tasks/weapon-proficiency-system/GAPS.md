# Weapon Proficiency System Gaps

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker D | Weapon Proficiency System tracker (`TRACKER.md`) | `11-combat-ui-warnings.md` | Combat UI has no confirmed dedicated warning cue when a weapon action uses no proficiency bonus or mastery. | Non-proficient combat actions can be visually ambiguous and easy to misplay. | Add/verify a combat action-level warning cue and messaging path. | Visual verification + manual action-selection test in combat UI. |
| G2 | not_started | support_needed_now | Worker D | Weapon Proficiency System tracker (`TRACKER.md`) | `START-HERE.md`; `11-combat-ui-warnings.md` | No fresh rendered verification cycle confirms warning text and penalty behavior together after recent code changes. | Old proof may not match current runtime state; penalties and warning copy could drift. | Run a scoped verification pass for warning and penalty alignment. | Re-run relevant tests and attach pass evidence in tracker/audit artifact. |
| G3 | not_started | adjacent_follow_up | Worker D | Weapon Proficiency System tracker (`TRACKER.md`) | `09-attack-roll-penalties.md` | Confirm there is no bypass path that applies proficiency bonus outside the tested command/opportunity paths. | A hidden bypass would undermine landed penalty logic. | Add a defensive audit pass over combat damage/attack command callsites. | Code search + optional regression test expansion if a bypass exists. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Import Rules

- Keep only durable in-project unresolved findings here.
- Route cross-project or unrelated findings to `docs/projects/GLOBAL_GAPS.md`.
- Each durable gap must include next proof/check and owning tracker context.
