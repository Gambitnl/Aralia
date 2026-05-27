# Spell Phase 1 Decision Record

Status: modularized decision entry point.
Last pruned: 2026-05-27.

This file used to contain the full assumed-approval ledger for Spell Phase 1.
That made the workflow auditable, but it also made the file too large to use as
an operator surface. The detailed history is now archived, and this file is the
stable map for where each kind of decision information belongs.

## Where To Read

| Need | File |
|---|---|
| Current operating lessons and repeated patterns | `SPELL_PHASE_1_DECISION_TRENDS_INDEX.md` |
| Lesson resolution status and remaining implementation gaps | `SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md` |
| Exact historical decision entries, timestamps, options, and proof | `archive/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS_FULL_LEDGER_2026-05-25.md` |
| Active package state and next spell work | `../../../docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` |
| Symphony workflow queue and dashboard gaps | `../tasks/SYMPHONY_OPEN_TASKS.md` |
| Durable artifact rules | `../../../docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` |

## What Belongs Here Now

Keep this file short. It should only point to the current decision surfaces and
state the logging policy. Do not append routine waits, file lists, verification
output, dashboard cache details, or package receipts here.

New full decision entries are allowed only when the foreman must choose between
materially different next actions, such as:

- approve or reject a Jules plan;
- send bounded repair feedback or accept a PR;
- wait for a new Jules head, file a stale session, or start a replacement
  handoff;
- use a bounded branch-hygiene repair instead of another Jules repair cycle;
- merge, defer, or explicitly widen a package boundary;
- change an approval, artifact, routing, or package-size policy.

Repeated observations that preserve the same state should become compact rows
in the task tracker, package receipt, open-task queue, or trend index.

## Approval Envelope

The operator approved this Phase 1 test flow to assume approval for scoped:

- branch pushes;
- PR opens;
- PR merges;
- shared spell schema/runtime architecture changes;
- premade roster semantic changes;
- broad AI arbitration policy.

That approval is limited to the documented Spell Phase 1 flow. It does not
authorize destructive repository actions, credential changes, billing/account
changes, unrelated Linear/Jules/GitHub mutation, production releases outside the
documented spell flow, or treating unresolved mechanics as permanent without a
recorded boundary.

## Logging Rule

The decision-reporting system is now resolved into three layers:

1. **Archive**: the full historical ledger remains available for audit.
2. **Trend index**: repeated patterns are summarized for operators and future
   agents.
3. **Lesson resolution**: each extracted learning is either linked to an
   implemented rule, linked to an active gap, or marked as retired.

If a new decision exposes a new reusable lesson, update
`SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md` and the owning live doc in the
same pass. The archived ledger should not become active again unless the user
explicitly asks for raw chronological detail.
