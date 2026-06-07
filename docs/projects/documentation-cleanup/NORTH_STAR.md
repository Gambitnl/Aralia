# Documentation Cleanup North Star

Status: active
Last updated: 2026-06-07

## Why This Project Exists

Documentation Cleanup is registered in `docs/projects/PROJECT_TRACKER.md`, but
the historical task folder `docs/tasks/documentation-cleanup/` is ignored in
this checkout. This trackable project surface preserves the living-project
protocol in Aralia-facing docs.

## Intended Outcome

Maintain durable ownership for stale/duplicate documentation curation while
keeping ignored local cleanup artifacts out of tracked project history.

## Current State

- T2 is now in_progress: path-drift packets 1G.7–1G.10 have been verified against the live repo (G2 resolved).
- Evidence-backed decisions are recorded in `DECISIONS.md` (D-01, D-02) and `AUDIT_OR_PROOF.md`.
- G1 (broad stale-doc curation) and G3 (duplicate-cleanup completion check) remain open.
- G4 (stale PROJECT_TRACKER.md link) discovered and corrected this iteration.
- The ignored task-folder files remain as evidence only.

## Dashboard Card Schema

Project: Documentation Cleanup
Slug: documentation-cleanup
Category: Documentation / Project Ops
Status: active
Confidence: medium
Evidence: docs/projects/documentation-cleanup
Gap signal: 3 open gaps (G1, G3, G4), 1 resolved (G2)
Protocol: living project doc set
Next step: Continue G1 (evidence-backed curation of remaining stale docs beyond 1G.7–1G.10).
Required verification: source-backed decision, docs_consistency
Completed verification: source-backed decision (path-drift verification D-01), docs_consistency (G2 resolved, G4 corrected)
Last proof: 2026-06-07
Workflow gaps reviewed: 2026-06-07

## Active Task

| Field | Value |
|---|---|
| Task | Curate stale/duplicate docs with evidence-backed decisions. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay aligned, and each open gap has source-backed evidence. |
| Allowed boundaries | Documentation under `docs/projects/documentation-cleanup/`; ignored task files are evidence only. |
| Stop condition | Stop after the current open gaps are registered and the next resume path is clear. |
| Verification | Confirm the doc set is internally consistent and the gap rows cite evidence. |
| Owner | Iteration 2 agent |
| Next action | Continue from G1 (broad stale-doc curation beyond path-drift packets). |

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
| Stale/duplicate docs need evidence-backed curation (G1). | in_scope_now | future agent | `DECISIONS.md`, `docs/projects/PROJECT_TRACKER.md`, `docs/tasks/documentation-cleanup` | Continue reviewing candidate docs beyond the now-resolved path-drift set. |
| Historical packets `1G.7`–`1G.10` path-drift (G2). | resolved | iteration 2 | `DECISIONS.md` D-01, `AUDIT_OR_PROOF.md` | Reconciliation complete. Packets preserved as historical intent. |
| Duplicate-cleanup scope is partial with no completion check (G3). | adjacent_follow_up | future agent | `docs/tasks/documentation-cleanup/GAPS.md`, `docs/tasks/documentation-cleanup/TRACKER.md` | Add a follow-up tracker row when duplicate-scope expansion is explicitly approved. |
| PROJECT_TRACKER.md stale link (G4). | in_scope_now | iteration 2 | `DECISIONS.md` D-02 | Corrected this iteration. Verify link resolves to living-project surface. |

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
6. Continue from G1 (broad stale-doc curation) or G3 (duplicate-cleanup scope).

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- add only real new gaps with source evidence
- do not invent gaps just to satisfy a count or to keep the file looking busy
