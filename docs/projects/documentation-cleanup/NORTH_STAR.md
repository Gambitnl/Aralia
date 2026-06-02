# Documentation Cleanup North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

Documentation Cleanup is registered in `docs/projects/PROJECT_TRACKER.md`, but
the historical task folder `docs/tasks/documentation-cleanup/` is ignored in
this checkout. This trackable project surface preserves the living-project
protocol in Aralia-facing docs.

## Intended Outcome

Maintain durable ownership for stale/duplicate documentation curation while
keeping ignored local cleanup artifacts out of tracked project history.

## Current State

- Registry evidence: `docs/tasks/documentation-cleanup`.
- Ignored task files may exist locally and can be used as evidence.
- This project surface is the durable, registered entry point.

## Active Task

| Field | Value |
|---|---|
| Task | Establish durable living-project docs for Documentation Cleanup. |
| Acceptance criteria | `docs/projects/documentation-cleanup/NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` exist. |
| Allowed boundaries | Documentation under `docs/projects/documentation-cleanup/`; ignored task files are evidence only. |
| Stop condition | Stop after trackable scaffold exists. |
| Verification | Confirm file existence and `git diff --check`. |
| Owner | Codex integration pass |
| Next action | Curate stale/duplicate docs with evidence-backed gap rows. |

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
| Stale/duplicate docs need evidence-backed curation. | adjacent_follow_up | future agent | `docs/projects/PROJECT_TRACKER.md`, `docs/tasks/documentation-cleanup` | Review evidence and classify cleanup candidates without premature pruning. |

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
5. Continue from: stale/duplicate documentation curation pass.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
