# Documentation Cleanup Runbook

Status: active
Last updated: 2026-06-08

## Purpose

This project curates stale, duplicate, or drifted documentation while
preserving historical packets as evidence of prior intent.

## Before You Edit

Read the living project docs first:

- `docs/projects/documentation-cleanup/NORTH_STAR.md`
- `docs/projects/documentation-cleanup/TRACKER.md`
- `docs/projects/documentation-cleanup/GAPS.md`
- `docs/projects/documentation-cleanup/DECISIONS.md`
- `docs/projects/documentation-cleanup/AUDIT_OR_PROOF.md`
- the Documentation Cleanup row in `docs/projects/PROJECT_TRACKER.md`

If the work touches a historical packet in `docs/tasks/documentation-cleanup/`,
treat that packet as preserved history unless a project doc explicitly routes a
correction.

## Curation Rules

- Prefer evidence-backed classifications: keep, correct, or preserve as
  history.
- Do not delete documentation just to make the tree smaller or the audit
  cleaner.
- Do not rewrite unfinished intent out of historical packets unless a project
  doc explicitly says to correct that packet.
- Record any decision that changes the interpretation of a doc in
  `DECISIONS.md`.
- Put unresolved questions, adjacent follow-up work, and scope boundaries in
  `GAPS.md`.
- Put verification notes, path checks, and proof of the current state in
  `AUDIT_OR_PROOF.md`.

## How To Work The Gap Queue

1. Start with the active gap in `TRACKER.md`.
2. Compare the claimed state against the live repo or durable evidence.
3. Update the relevant gap row and decision note before widening scope.
4. Keep G1 as the current curation path unless the tracker explicitly routes
   work to G3.
5. Leave G3 open until there is an explicit completion check for the duplicate
   cleanup scope.

## Verification

Run both checks before closing a Documentation Cleanup pass:

```powershell
npm run projects:audit
git diff --check
```

The pass is only settled when the audit no longer reports a missing
`RUNBOOK.md` for this project and the diff contains only the intended doc
updates.
