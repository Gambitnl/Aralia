---
schema_version: 1
project: Documentation Cleanup
slug: documentation-cleanup
category: Documentation / Project Ops
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: review-required
last_updated: 2026-06-08
confidence: medium
evidence: docs/projects/documentation-cleanup
gap_signal: 1 review-blocked gap (G3), 4 resolved (G1, G2, G4, G5)
protocol: living project doc set
next_step: Human/project decision: formally widen duplicate-cleanup scope, close it as complete enough, or keep it as adjacent evidence only.
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
lifecycle_status: human-review-required
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# Documentation Cleanup North Star

Status: review-required
Last updated: 2026-06-08

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
Status: review-required
Confidence: medium
Evidence: docs/projects/documentation-cleanup
Gap signal: 1 review-blocked gap (G3), 4 resolved (G1, G2, G4, G5)
Protocol: living project doc set
Next step: Human/project decision: formally widen duplicate-cleanup scope, close it as complete enough, or keep it as adjacent evidence only.
Required verification: source-backed decision, docs_consistency
Completed verification: source-backed decision (path-drift verification D-01), docs_consistency (G2 resolved, G4 resolved)
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

Dashboard lifecycle: human-review-required
Assignment rule: Do not assign forward Documentation Cleanup agents until the duplicate-cleanup completion-scope decision is recorded.

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

## Active Task

| Field | Value |
|---|---|
| Task | Close G1 with source-backed packet wording decisions, then route G3 as next gap. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay aligned, and each open gap has source-backed evidence. |
| Allowed boundaries | Documentation under `docs/projects/documentation-cleanup/`; ignored task files are evidence only. |
| Stop condition | Stop after the current open gaps are registered and the next resume path is clear. |
| Verification | Confirm the doc set is internally consistent and the gap rows cite evidence. |
| Owner | Iteration 2 agent |
| Next action | Wait for the G3 scope decision before assigning more Documentation Cleanup iteration work. |

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
| Stale/duplicate docs need evidence-backed curation (G1). | resolved | iteration 2 | `DECISIONS.md`, `docs/projects/documentation-cleanup/AUDIT_OR_PROOF.md`, `docs/tasks/documentation-cleanup/1G.7-REDUCER-LOGIC.md`, `docs/tasks/documentation-cleanup/1G.8-POINT-BUY-UI.md`, `docs/tasks/documentation-cleanup/1G.9-LOADING-TRANSITION.md`, `docs/tasks/documentation-cleanup/1G.10-SUBMAP-GENERATION.md` | G1 wording was corrected in place where stale and preserved as historical context. |
| Historical packets `1G.7`-`1G.10` path-drift (G2). | resolved | iteration 2 | `DECISIONS.md` D-01, `AUDIT_OR_PROOF.md` | Reconciliation complete. Packets preserved as historical intent. |
| Duplicate-cleanup scope is partial with no completion check (G3). | blocked_human_decision | human/project owner | `docs/tasks/documentation-cleanup/GAPS.md`, `docs/tasks/documentation-cleanup/TRACKER.md` | Choose whether to widen, close, or preserve as adjacent evidence before assigning more agents. |
| PROJECT_TRACKER.md stale link (G4). | resolved | iteration 2 | `DECISIONS.md` D-02 | Corrected this iteration; resolved with no further action needed unless the tracker link changes. |
| Documentation Cleanup is still missing the repo-required `RUNBOOK.md` (G5). | resolved | iteration 3 | `npm run projects:audit`, `docs/projects/PROJECT_TRACKER.md`, `docs/projects/documentation-cleanup/NORTH_STAR.md`, `docs/projects/documentation-cleanup/RUNBOOK.md` | Resolved by `docs/projects/documentation-cleanup/RUNBOOK.md`; rerun the audit to confirm the warning is gone. |

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
6. Do not continue G3 until the duplicate-cleanup completion-scope decision is recorded.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- add only real new gaps with source evidence
- do not invent gaps just to satisfy a count or to keep the file looking busy
