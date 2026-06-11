# Scripts: Spell Runtime Template Audit Living Tracker

Status: active — SRTA-001 decision recorded 2026-06-10; implementation lane open
Last updated: 2026-06-10

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
| T2 | active | Resolve recurring warning follow-up by deciding the schema path for `Recurring Mechanics` labels and documenting execution handoff | Worker C | 2026-06-10 | `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md`; **decision recorded 2026-06-10 (Remy, `docs/projects/DECISION_BLITZ_2026-06-10.md` D22): register both labels in the strict vocabulary with migration notes** | Implement the decided path: add `Recurring Mechanics` and `Recurring Mechanic Timing` to `scripts/spellRuntimeTemplateAudit/vocabulary.ts` with migration notes, reflect in `GAPS.md`, then rerun the audit | Re-run `npm run audit:spell-template` and confirm the 28-warning family clears |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SRTA-001 | active | support_needed_now | Worker C | This project | T2 | `Recurring Mechanics` and `Recurring Mechanic Timing` are currently unregistered structured labels, generating 28 warnings | [docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md](docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md); `docs/projects/DECISION_BLITZ_2026-06-10.md` (D22) | Prevents strict runtime-template completion and may hide schema drift in recurring-mechanic spells | **Decided 2026-06-10:** add vocabulary entries for both labels with migration notes (no deferral); implement and rerun the audit | `npm run audit:spell-template` shows the 28-warning family cleared |
| SRTA-002 | not_started | adjacent_follow_up | Worker C | `docs/tasks/spell-system-overhaul` | T2 | Recurring label family needs execution ownership for the broader migration lane | [docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md](docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md) | Keeps execution work in the right subsystem while maintaining audit evidence continuity | Add a spell-system-overhaul cross-reference note before next slice | Cross-link update plus tracker continuity check |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
