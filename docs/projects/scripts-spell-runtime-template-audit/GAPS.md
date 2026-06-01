# GAPS: Scripts: Spell Runtime Template Audit

Status: active
Last updated: 2026-05-31

Use this file only for durable unresolved findings that belong to this project
through the lens of runtime-template auditing.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SRTA-001 | not_started | support_needed_now | Worker C | This project | `npm run audit:spell-template` | `Recurring Mechanics` and `Recurring Mechanic Timing` are unregistered in the strict template vocabulary and produce warnings in 14 spells each (28 total). | [docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md](docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md) | Strict runtime-template contract is incomplete; this keeps the report non-green for recurring-mechanics content. | Choose and implement one schema path: register both fields with migration notes, or route to a follow-up migration lane and record closure conditions. | Re-run audit and prove warning reduction or explicit deferral with status |
| SRTA-002 | not_started | adjacent_follow_up | Worker C | `docs/tasks/spell-system-overhaul` | `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md` | Recurring-mechanics coverage is likely tied to broader choice/repeater mechanics execution and validation in spell-system-overhaul slices. | [docs/tasks/spell-system-overhaul](docs/tasks/spell-system-overhaul) | Without lane alignment, remediation can split ownership and lose consistency across conversion and runtime behavior. | Add a short handoff note in the relevant spell-system-overhaul tracker path before slice handoff. | Update in that lane and confirm reference in this project's tracker |
