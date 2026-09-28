---
schema_version: 1
project: Spells
slug: spells
category: Game & Simulation
main_category: Game & Simulation
subcategory: Spell Runtime And Data
status: active
last_updated: 2026-09-23
confidence: medium
evidence: docs/projects/spells/GAPS.md
gap_signal: "Parent registry records 53 resolved and 0 open rows; child routing and canonical doc coverage remain incomplete."
protocol: living project doc set
next_step: Reconcile the missing child registry and living-project files against current sources before dispatching lane work.
project_mode: parent_with_subprojects
subproject_tracker: ""
subproject_count: 0
subproject_signal: "Current child inventory unavailable; historical eight-lane count is not verified."
agent_comments: "The parent routing intent survives in Git history, but the child registry and several canonical documents are absent. Do not dispatch from historical lane priorities."
active_agent: ""
agent_pass_status: not_started
agent_pass_started_at: ""
agent_pass_ended_at: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - SUBPROJECTS.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - subprojects/
  - docs/tasks/spells/
required_verification:
  - docs_consistency
completed_verification: []
last_proof: ""
workflow_gaps_reviewed: 2026-09-23
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: unconfirmed
human_decision_required: no
---
# Spells Parent North Star

Status: active
Last updated: 2026-09-23

## Purpose and boundary

Spells is a parent routing surface for spell runtime, data, validation, UI,
and audit work. The parent records ownership and cross-lane findings. A
concrete implementation pass belongs with its verified child packet or task,
not with this parent dashboard.

This boundary comes from the earlier North Star at
`2033cc4ce^:docs/projects/spells/NORTH_STAR.md`. That document was deleted
in the 2026-07-16 snapshot. Its routing model is useful historical context,
not proof that its former lane inventory or priority order is still current.

## Current evidence

- `GAPS.md` is the surviving canonical parent gap registry. Its frontmatter,
  last updated 2026-08-12, records 53 rows, 53 resolved, and 0 open. Those
  counts describe the parent registry only. They do not prove every spell
  behavior, child project, or release gate is complete.
- The working folder currently contains `GAPS.md` and a spell-completeness
  snapshot under `subprojects/`. The historical child registry
  `SUBPROJECTS.md` is absent. The former eight-lane claim cannot be used as a
  current assignment or dashboard count.
- `COLD_START_AGENT_PROMPT.md`, `DECISIONS.md`, `AUDIT_OR_PROOF.md`, and
  `RUNBOOK.md` are also absent. They remain required by the living-project
  contract; this page does not claim that contract is complete.
- WF-G201 still requires a passing pull-request CI log for `npm run validate`.
  A local validation pass cannot substitute for that proof.

## Resume route

1. Read `GAPS.md` for parent-visible gap status and its dated evidence.
2. Read `TRACKER.md` for current parent routing work and known uncertainty.
3. Before assigning implementation to a former child lane, verify that the
   child packet exists and has current ownership, status, and proof. Do not
   infer those facts from the deleted 2026-06 North Star.
4. Restore or re-establish `SUBPROJECTS.md` and the other required project
   documents only from current, source-backed decisions. Keep child-local
   implementation proof in the child packet or task.

## Proof boundary

Restoring this page fixes a declared link from `GAPS.md`. It does not restore
the former child inventory, validate the spell runtime, or certify the full
living-project document set. The parent dashboard should show that distinction
until a current routing audit and executable child proof are recorded.
