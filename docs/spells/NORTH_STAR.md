# Spell Phase Workstream North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

Preserve this planning area as a small, reusable living-project surface so future agents can resume without rediscovering intent and boundaries.

## Intended Outcome

Establish a compact project operating surface (`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`) that records evidence links, scope boundaries, and a cold-start resume path.

## Current State

- This project is registered in `docs/projects/PROJECT_TRACKER.md`.
- Registry evidence paths:
- docs/spells
- docs/tasks/spell-system-overhaul
- src/systems/spells
- This is an **initial living-project scaffold** created from registry evidence only.
- No implementation source files were edited in this docs pass.

## Active Task

| Field | Value |
|---|---|
| Task | Create/update this project's living-project scaffold files. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` exist with evidence links, scope boundaries, and links to `docs/projects/PROJECT_TRACKER.md` + `docs/projects/GLOBAL_GAPS.md`. |
| Allowed boundaries | Project docs in `F:\Repos\Aralia\docs\spells` and registry evidence references only. |
| Stop condition | Stop after scaffold files are complete; no implementation scope changes. |
| Verification | Confirm file presence and supporting link consistency with project registry/global tracker. |
| Owner | Worker D |
| Next action | Resume with the first implementation task in this folder. |

## Scope Boundaries

In scope:
- Project scaffolding for this registry row.
- Registry and global tracker linkage.

Adjacent but not in scope:
- Source code changes and behavior work.
- New task slicing beyond the scaffold handoff.

Out of scope:
- Scope decisions that require cross-project owner arbitration.

## What Must Not Be Lost

- Evidence anchors in the owning evidence folder.
- Registry row continuity and cold-start intent.

## Resume Path For A Cold Agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Continue from the next action in the active task row.

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project/out-of-scope gap routing | active |
| `TRACKER.md` | Active queue and gap routing decisions | active |
| `GAPS.md` | Durable unresolved findings | active |

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/spells/NORTH_STAR.md","sha256WithoutMarker":"71cdc260c5f92e2c5925ed3e0c55d9b90b15a8a82ab58488a1d611ed38658b43","markedAtUtc":"2026-06-25T22:54:19.197Z"} -->
