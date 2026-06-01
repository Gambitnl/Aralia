# GAPS: Scripts: Archive

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Gap | Classification | Owner | Evidence | Next action | Next proof | Status |
|---|---|---|---|---|---|---|
| SARCH-001 | Retired archive scripts are not represented in active tooling registry metadata, so re-enable/reuse intent may be unclear later. | adjacent_follow_up | Worker C | `scripts/tooling/script-registry.json` has no `scripts/archive` entries | Decide whether to add a retired/deprecated bucket or tombstone policy for archive scripts. | Registry entry or decision note added in project docs | open |
| SARCH-002 | Temporary auth/session inputs for one-time retrieval runs are only described narratively, with no direct project-level cleanup check recorded near the archive project. | support_needed_now | Worker C | `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` says auth file should be deleted; status check is currently manual | Add a small next-check entry in `docs/projects/scripts-archive/TRACKER.md` and keep a periodic verification command | `Test-Path .agent/roadmap-local/spell-validation/dndbeyond-auth.json` used during manual checks | open |
