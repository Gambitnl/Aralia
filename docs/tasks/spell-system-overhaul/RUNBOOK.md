# Spell System Overhaul Runbook

Status: active
Last updated: 2026-05-31

## Purpose

Provide the minimum recurring workflow for maintaining this living project surface and continuing execution slices.

## Pre-flight for each slice

1. Read `docs/tasks/spell-system-overhaul/NORTH_STAR.md`.
2. Read `docs/tasks/spell-system-overhaul/TRACKER.md`.
3. Read `docs/tasks/spell-system-overhaul/GAPS.md`.
4. Validate assumptions against `docs/projects/PROJECT_TRACKER.md` row for this project.
5. If a new cross-project gap is found, add it first to
   `docs/projects/GLOBAL_GAPS.md` or route directly to the owning project.

## Recommended starting command set

- Check required project files exist:
  `Test-Path docs\tasks\spell-system-overhaul\NORTH_STAR.md` etc.
- Refresh project snapshot quickly:
  `Get-Content -Raw docs\tasks\spell-system-overhaul/NORTH_STAR.md`
- Read active slice:
  `Get-Content -Raw docs\tasks\spell-system-overhaul/TASK_SLICE.md`
- Inspect top tracker row:
  `Get-Content -Raw docs/tasks/spell-system-overhaul/TRACKER.md`

## Slice completion commands

- After each docs slice, update:
  - `TRACKER.md` active row timestamp and next proof
  - `NORTH_STAR.md` resume path if boundaries changed
  - `AUDIT_OR_PROOF.md` with what changed and what remains
- Keep cross-project findings in `GLOBAL_GAPS.md` and avoid filling tracker with unrelated items.

## Failures and recovery

- If project scope is unclear, prioritize existing registry row in
  `docs/projects/PROJECT_TRACKER.md` and update it in place.
- If in doubt whether a gap belongs to this project, leave it as:
  - `in_scope_now` if it blocks the active implementation slice
  - `adjacent_follow_up` if helpful but optional
  - global routing if outside spell-system ownership

## Known handoff order

1. `NORTH_STAR.md`
2. `TRACKER.md`
3. `GAPS.md`
4. `TASK_SLICE.md`
5. `docs/projects/spells/SUBPROJECTS.md`
6. The relevant `docs/projects/spells/subprojects/*/GAPS.md` file for the selected child lane
