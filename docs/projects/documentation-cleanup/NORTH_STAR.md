---
schema_version: 1
project: Documentation Cleanup
slug: documentation-cleanup
category: Documentation / Project Ops
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: complete
last_updated: 2026-06-12
iteration: 3
confidence: medium
evidence: docs/projects/documentation-cleanup; docs/projects/DECISION_BLITZ_2026-06-10.md (D23)
gap_signal: "0 open gaps; G3 decision recorded 2026-06-10 (close as complete-enough; scope not widened); all gaps G1-G5 resolved or closed; evidence preserved"
protocol: living project doc set
next_step: "Project closed as complete-enough 2026-06-10 (DECISION_BLITZ D23). No further iteration agents; duplicate findings remain preserved as historical evidence. Re-open only via an explicitly scoped future cleanup campaign."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - source-backed decision
  - docs_consistency
completed_verification:
  - source-backed decision (path-drift verification D-01)
  - docs_consistency (G2 resolved
  - G4 resolved)
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: closed-complete-enough
deprecation_confidence: strong
deprecation_reason: closed_complete_enough_2026-06-10_evidence_preserved
canonical_owner: ""
human_decision_required: "no"
---
# Documentation Cleanup North Star

Status: complete â€” G3 decision recorded 2026-06-10; project closed as complete-enough
Last updated: 2026-06-12

## Why This Project Exists

Documentation Cleanup is registered in `docs/projects/PROJECT_TRACKER.md`, but
the historical task folder `docs/tasks/documentation-cleanup/` is ignored in
this checkout. This trackable project surface preserves the living-project
protocol in Aralia-facing docs.

## Intended Outcome

Maintain durable ownership for stale/duplicate documentation curation while
keeping ignored local cleanup artifacts out of tracked project history.

## Current State

- T2 is now done: G1 stale-reference wording has been reconciled and recorded in `DECISIONS.md` D-03.
- Evidence-backed decisions are now recorded in `DECISIONS.md` (D-01, D-02, D-03) and `AUDIT_OR_PROOF.md`.
- G1 is resolved; G3 (duplicate-cleanup completion check) now needs a scope decision before more forward iteration.
- G4 (stale PROJECT_TRACKER.md link) and G5 (missing RUNBOOK.md) are resolved; the runbook exists in the living project surface.
- Task-folder files remain evidence-only and out of live authority.

## Dashboard Card Schema

Project: Documentation Cleanup
Slug: documentation-cleanup
Category: Documentation / Project Ops
Status: complete â€” G3 decision recorded 2026-06-10; closed as complete-enough
Confidence: medium
Evidence: docs/projects/documentation-cleanup; docs/projects/DECISION_BLITZ_2026-06-10.md (D23)
Gap signal: G3 closed as complete-enough 2026-06-10; all gaps G1-G5 resolved or closed; evidence preserved
Protocol: living project doc set
Next step: Project closed; no further iteration agents. Re-open only via an explicitly scoped future cleanup campaign.
Required verification: source-backed decision, docs_consistency
Completed verification: source-backed decision (path-drift verification D-01), docs_consistency (G2 resolved, G4 resolved)
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

Dashboard lifecycle: closed-complete-enough (was human-review-required; cleared 2026-06-10)
Assignment rule: Do not assign forward Documentation Cleanup agents until the duplicate-cleanup completion-scope decision is recorded. *(Decision recorded 2026-06-10: project closed as complete-enough â€” no further agents needed.)*

## Required Review Brief

Title: Duplicate Cleanup Completion Scope
Question: Should Documentation Cleanup formally widen G3 into a new duplicate-cleanup pass, close the duplicate-cleanup scope as complete enough, or preserve it only as adjacent historical evidence?
Issue: G3 says duplicate-cleanup scope is partial and lacks an explicit completion check, but the current living project pass has already resolved G1/G2/G4/G5 and no remaining source-backed implementation task is defined.
Current behavior: The dashboard still exposes Documentation Cleanup as active, while the only remaining gap depends on whether the project owner wants another cleanup sweep.
Why blocked: Assigning another agent now would force the agent to invent scope or decide whether duplicate cleanup is done, which is a project-policy decision rather than a concrete cleanup task.
Option A: Widen G3 into a bounded duplicate-cleanup pass with explicit target folders, stop rules, and preservation criteria.
Option B: Close G3 as complete enough for this living-project cycle and keep prior duplicate findings as historical evidence.
Option C: Keep G3 as adjacent evidence only, leaving Documentation Cleanup review-gated until a future cleanup campaign is explicitly scoped.
Evidence: `docs/tasks/documentation-cleanup/GAPS.md`; `docs/tasks/documentation-cleanup/TRACKER.md`; `docs/projects/documentation-cleanup/DECISIONS.md`; `docs/projects/documentation-cleanup/AUDIT_OR_PROOF.md`.
Decision owner: Human/project owner.
Proof after decision: Record the chosen policy in `DECISIONS.md`, update G3 in `GAPS.md` and `TRACKER.md`, then run `npm run projects:audit` and `git diff --check`.

### Decision (2026-06-10)

Resolved â€” **Option B selected: close G3 as complete enough for this living-project cycle.** The duplicate-cleanup scope is not widened; prior duplicate findings are kept as historical evidence (expansion-first â€” nothing deleted).

- Decider: Remy (project owner), batched decision session 2026-06-10.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D23); local record: `docs/projects/documentation-cleanup/DECISIONS.md` D-04.
- Status: decision recorded 2026-06-10; the project closes as complete-enough. No further iteration agents are assigned; a future duplicate-cleanup campaign would be scoped as a new decision.

## Active Task

| Field | Value |
|---|---|
| Task | Close G1 with source-backed packet wording decisions, then route G3 as next gap. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay aligned, and each open gap has source-backed evidence. |
| Allowed boundaries | Documentation under `docs/projects/documentation-cleanup/`; ignored task files are evidence only. |
| Stop condition | Stop after the current open gaps are registered and the next resume path is clear. |
| Verification | Confirm the doc set is internally consistent and the gap rows cite evidence. |
| Owner | Iteration 2 agent |
| Next action | G3 scope decision recorded 2026-06-10 (DECISION_BLITZ D23): closed as complete-enough; no more Documentation Cleanup iteration work is assigned. |

## Scope Boundaries

In scope:
- Stale-doc identification, duplicate-doc routing, and documentation ownership
  decisions.

Adjacent but not in this slice:
- Bulk deletion or pruning of project intent.

Out of scope:
- Tracking ignored documentation-cleanup scratch files wholesale.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project gap surfacing | active |
| `docs/projects/documentation-cleanup/TRACKER.md` | Active queue and status surface | active |
| `docs/projects/documentation-cleanup/GAPS.md` | Durable unresolved findings | active |
| `docs/projects/documentation-cleanup/DECISIONS.md` | Evidence-backed decisions | active (created iteration 2) |
| `docs/projects/documentation-cleanup/AUDIT_OR_PROOF.md` | Verification evidence | active (created iteration 2) |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/documentation-cleanup/TRACKER.md`.
3. Read `docs/projects/documentation-cleanup/GAPS.md`.
4. Read `docs/projects/documentation-cleanup/DECISIONS.md` for prior evidence-backed decisions.
5. Review ignored `docs/tasks/documentation-cleanup` files only as evidence if present.
6. Do not continue G3 until the duplicate-cleanup completion-scope decision is recorded. *(Recorded 2026-06-10: G3 closed as complete-enough â€” DECISIONS.md D-04; the project is closed and needs no further iteration.)*

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- add only real new gaps with source evidence
- do not invent gaps just to satisfy a count or to keep the file looking busy
