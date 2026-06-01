# TRACKER: Scripts: Spell Runtime Template Audit

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
| T1 | done | Create protocol files in `docs/projects/scripts-spell-runtime-template-audit/` | Worker C | 2026-05-31 | [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) | Keep files aligned and add active remediations | `Test-Path docs/projects/scripts-spell-runtime-template-audit/{NORTH_STAR.md,TRACKER.md,GAPS.md}` |
| T2 | active | Resolve recurring warning follow-up by deciding the schema path for `Recurring Mechanics` labels and documenting execution handoff | Worker C | 2026-05-31 | `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md` | Choose one path (`vocabulary` vs `migrations`) and update `GAPS.md` + this queue | Re-run `npm run audit:spell-template` and confirm warning family status changes |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SRTA-001 | not_started | support_needed_now | Worker C | This project | T2 | `Recurring Mechanics` and `Recurring Mechanic Timing` are currently unregistered structured labels, generating 28 warnings | [docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md](docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md) | Prevents strict runtime-template completion and may hide schema drift in recurring-mechanic spells | Add either vocabulary entries with migration notes, or formal deferred follow-up and rerun the audit | `npm run audit:spell-template` |
| SRTA-002 | not_started | adjacent_follow_up | Worker C | `docs/tasks/spell-system-overhaul` | T2 | Recurring label family needs execution ownership for the broader migration lane | [docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md](docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md) | Keeps execution work in the right subsystem while maintaining audit evidence continuity | Add a spell-system-overhaul cross-reference note before next slice | Cross-link update plus tracker continuity check |
