# TRACKER: Scripts: Archive

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
| T1 | done | Refresh protocol docs with concrete archive state, file map, and integration links | Worker C | 2026-05-31 | `scripts/archive`, `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` | Confirm retention check steps are documented in `docs/projects/scripts-archive/GAPS.md` | `Get-ChildItem scripts/archive` and `rg -n -F "one-time canonical retrieval tooling" docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` |
| T2 | active | Verify deprecation/cleanup policy for archived scripts and temporary auth artifacts | Worker C | 2026-05-31 | `docs/projects/scripts-archive/GAPS.md` | Add explicit retention decision or closure note in this project docs and tracker | `rg -n "scripts/archive" docs/tasks/spells; Get-ChildItem .agent/roadmap-local/spell-validation/dndbeyond-auth.json` |

## Gap Log

- See `docs/projects/scripts-archive/GAPS.md` for durable follow-up items.
