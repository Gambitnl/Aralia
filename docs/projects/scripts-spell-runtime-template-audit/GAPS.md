# Scripts: Spell Runtime Template Audit Gap Registry

Status: active — SRTA-001 decision recorded 2026-06-10
Last updated: 2026-06-10

Use this file only for durable unresolved findings that belong to this project
through the lens of runtime-template auditing.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SRTA-001 | active | support_needed_now | Worker C | This project | `npm run audit:spell-template` | `Recurring Mechanics` and `Recurring Mechanic Timing` are unregistered in the strict template vocabulary and produce warnings in 14 spells each (28 total). | [docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md](docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md); `docs/projects/DECISION_BLITZ_2026-06-10.md` (D22) | Strict runtime-template contract is incomplete; this keeps the report non-green for recurring-mechanics content. | **Decided 2026-06-10 (Remy, DECISION_BLITZ D22):** register both fields in the strict vocabulary with migration notes; implementation lane open — add both labels to `scripts/spellRuntimeTemplateAudit/vocabulary.ts` and rerun the audit. Recorded in `DECISIONS.md` D2. | Re-run `npm run audit:spell-template` and prove the 28-warning family clears |
| SRTA-002 | not_started | adjacent_follow_up | Worker C | `docs/tasks/spell-system-overhaul` | `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md` | Recurring-mechanics coverage is likely tied to broader choice/repeater mechanics execution and validation in spell-system-overhaul slices. | [docs/tasks/spell-system-overhaul](docs/tasks/spell-system-overhaul) | Without lane alignment, remediation can split ownership and lose consistency across conversion and runtime behavior. | Add a short handoff note in the relevant spell-system-overhaul tracker path before slice handoff. | Update in that lane and confirm reference in this project's tracker |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
