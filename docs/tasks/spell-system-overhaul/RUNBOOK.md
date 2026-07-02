# Spell System Overhaul Runbook

Status: historical (folder is a merged-reference archive)
Last updated: 2026-07-01

## Purpose

Historical operator workflow for the retired task-folder surface. This folder is historical evidence only; do not dispatch slices from it.

## Pre-flight for each slice

1. Start from `docs/projects/spells/SUBPROJECTS.md` — the live entry point for all spell work.
2. Read the relevant child `GAPS.md` file under `docs/projects/spells/subprojects/*/` for the selected lane.
3. Treat this folder (`docs/tasks/spell-system-overhaul/`) as historical evidence only; its open gap rows were re-homed into the child GAPS files on 2026-07-01.
4. Validate assumptions against `docs/projects/PROJECT_TRACKER.md` row for this project.
5. If a new cross-project gap is found, add it first to
   `docs/projects/GLOBAL_GAPS.md` or route directly to the owning project.

## Recommended starting command set

- Check required project files exist:
  `Test-Path docs\tasks\spell-system-overhaul\NORTH_STAR.md` etc.
- Refresh project snapshot quickly:
  `Get-Content -Raw docs\tasks\spell-system-overhaul/NORTH_STAR.md`
- Read the archived slice log (historical):
  `Get-Content -Raw docs\archive\spell-system\SSO-TASK-SLICE.md`
- Inspect top tracker row:
  `Get-Content -Raw docs/tasks/spell-system-overhaul/TRACKER.md`

## Slice completion commands

- After each docs slice, update the owning child lane's `TRACKER.md`/`GAPS.md` under
  `docs/projects/spells/subprojects/` (this folder's TRACKER is historical; its old
  AUDIT_OR_PROOF log is archived at `docs/archive/spell-system/SSO-AUDIT-OR-PROOF.md`)
- Keep cross-project findings in `GLOBAL_GAPS.md` and avoid filling tracker with unrelated items.

## Failures and recovery

- If project scope is unclear, prioritize existing registry row in
  `docs/projects/PROJECT_TRACKER.md` and update it in place.
- If in doubt whether a gap belongs to this project, leave it as:
  - `in_scope_now` if it blocks the active implementation slice
  - `adjacent_follow_up` if helpful but optional
  - global routing if outside spell-system ownership

## Known handoff order

1. `docs/projects/spells/SUBPROJECTS.md`
2. The relevant `docs/projects/spells/subprojects/*/GAPS.md` file for the selected child lane
3. This folder's `NORTH_STAR.md` and `TRACKER.md` (historical anchors only)
4. Archived evidence, if needed: `docs/archive/spell-system/SSO-GAPS-EVIDENCE-LOG.md`, `SSO-TASK-SLICE.md`, `SSO-AUDIT-OR-PROOF.md`

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/RUNBOOK.md","sha256WithoutMarker":"05d0edb9948e7f8da81a1a00365bdf9216dfbab37e5e41b39263aa6c11527fd0","markedAtUtc":"2026-06-25T22:29:38.588Z"} -->
