# Documentation Cleanup North Star

Status: active
Last updated: 2026-06-05

## Why This Project Exists

Documentation Cleanup is registered in `docs/projects/PROJECT_TRACKER.md`, but
the historical task folder `docs/tasks/documentation-cleanup/` is ignored in
this checkout. This trackable project surface preserves the living-project
protocol in Aralia-facing docs.

## Intended Outcome

Maintain durable ownership for stale/duplicate documentation curation while
keeping ignored local cleanup artifacts out of tracked project history.

## Current State

- This project surface is the durable, registered entry point.
- The open work still lives in `TRACKER.md` row `T2`.
- Ignored `docs/tasks/documentation-cleanup` files exist and provide the cleanup evidence trail.
- The current gap set is three real project gaps: stale curation, path-drift in the `1G.7` to `1G.10` packets, and no explicit duplicate-cleanup completion check.

## Dashboard Card Schema

Project: Documentation Cleanup
Slug: documentation-cleanup
Category: Documentation / Project Ops
Status: active
Confidence: medium
Evidence: docs/projects/documentation-cleanup
Gap signal: 3 open gaps
Protocol: living project doc set
Next step: Read `TRACKER.md`, then resolve the evidence-backed cleanup gaps in `GAPS.md` without inventing new scope.
Required verification: source-backed decision, docs_consistency
Completed verification: none
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Active Task

| Field | Value |
|---|---|
| Task | Curate stale/duplicate docs with evidence-backed decisions. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay aligned, and each open gap has source-backed evidence. |
| Allowed boundaries | Documentation under `docs/projects/documentation-cleanup/`; ignored task files are evidence only. |
| Stop condition | Stop after the current open gaps are registered and the next resume path is clear. |
| Verification | Confirm the doc set is internally consistent and the gap rows cite evidence. |
| Owner | Codex integration pass |
| Next action | Read `TRACKER.md`, inspect the ignored evidence set if needed, and continue from the highest-value open gap. |

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
| Stale/duplicate docs need evidence-backed curation. | in_scope_now | future agent | `docs/projects/PROJECT_TRACKER.md`, `docs/tasks/documentation-cleanup` | Review evidence and classify cleanup candidates without premature pruning. |
| Historical packets `1G.7` to `1G.10` still point at path wording that no longer matches current source-adjacent targets. | in_scope_now | future agent | `docs/tasks/documentation-cleanup/GAPS.md`, `1G.7-REDUCER-LOGIC.md`, `1G.8-POINT-BUY-UI.md`, `1G.9-LOADING-TRANSITION.md`, `1G.10-SUBMAP-GENERATION.md` | Compare each brief against the actual target files and update the surviving notes in place or mark them historical. |
| Duplicate-cleanup scope is partial and has no explicit completion check. | adjacent_follow_up | future agent | `docs/tasks/documentation-cleanup/GAPS.md`, `docs/tasks/documentation-cleanup/TRACKER.md` | Add a follow-up tracker row when duplicate-scope expansion is explicitly approved. |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project gap surfacing | active |
| `docs/projects/documentation-cleanup/TRACKER.md` | Active queue and status surface | active |
| `docs/projects/documentation-cleanup/GAPS.md` | Durable unresolved findings | active |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/documentation-cleanup/TRACKER.md`.
3. Read `docs/projects/documentation-cleanup/GAPS.md`.
4. Review ignored `docs/tasks/documentation-cleanup` files only as evidence if present.
5. Continue from the highest-value open gap in `GAPS.md`, starting with the path-drift notes if they are still unresolved.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- add only real new gaps with source evidence
- do not invent gaps just to satisfy a count or to keep the file looking busy
