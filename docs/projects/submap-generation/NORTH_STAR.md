# Submap Generation North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

Submap Generation is registered separately from the Submap UI project. It owns
the generation feature surface in `src/features/SubmapGeneration`, while
`docs/projects/submap/` remains the UI/component project for `src/components/Submap`.

## Intended Outcome

Preserve generation-specific ownership, evidence, and gap tracking without
overwriting the Submap UI living-project docs.

## Current State

- Registry evidence: `src/features/SubmapGeneration`.
- This scaffold was created during integration review to separate a worker
  collision between Submap UI and Submap Generation.
- No runtime generation code changed.

## Active Task

| Field | Value |
|---|---|
| Task | Establish a dedicated Submap Generation living-project surface. |
| Acceptance criteria | `docs/projects/submap-generation/NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` exist and link registry/global trackers. |
| Allowed boundaries | Documentation under `docs/projects/submap-generation/`. |
| Stop condition | Stop after the scaffold is present and distinct from `docs/projects/submap/`. |
| Verification | Confirm file existence and `git diff --check`. |
| Owner | Codex integration pass |
| Next action | Document generation parameters and outputs from source evidence. |

## Scope Boundaries

In scope:
- Generation parameters, output contracts, and feature ownership.

Adjacent but not in this slice:
- Submap UI behavior in `src/components/Submap`.

Out of scope:
- Runtime source edits during this scaffold pass.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Generation parameters and outputs need source-backed documentation. | adjacent_follow_up | future agent | `docs/projects/PROJECT_TRACKER.md`, `src/features/SubmapGeneration` | Inspect source and add concrete gaps. |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project gap surfacing | active |
| `docs/projects/submap-generation/TRACKER.md` | Active queue and status surface | active |
| `docs/projects/submap-generation/GAPS.md` | Durable unresolved findings | active |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/submap-generation/TRACKER.md`.
3. Read `docs/projects/submap-generation/GAPS.md`.
4. Check `src/features/SubmapGeneration`.
5. Continue from: generation parameter/output contract gap pass.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
