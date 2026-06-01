# Investigation Task Cluster North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

This cluster keeps investigation outputs in one durable, low-friction surface so a
future agent can resume work without re-discovering scope, evidence links, and
handoff expectations.

## Intended Outcome

Define and maintain a cold-start map for investigation work.

## File Map

- `NORTH_STAR.md`: project purpose, boundaries, evidence links, and resume path.
- `TRACKER.md`: active task queue, status updates, and next checks.
- `GAPS.md`: project-owned unresolved findings.
- `DICE_ROLLER_ANALYSIS.md`: preserved technical investigation packet.

## Current State

Implemented:
- Registry linkage exists in `docs/projects/PROJECT_TRACKER.md` under
  "Investigation Task Cluster".
- This cluster has a live scaffold in `docs/tasks/investigations`.
- One preserved investigation packet is present and currently documented:
  `DICE_ROLLER_ANALYSIS.md` (re-verified on 2026-03-14).

Planned:
- Document the expected output shape for any future inquiry packets.
- Keep evidence expectations and integration points explicit in this folder.

## Active Task

| Field | Value |
|---|---|
| Task | Rebuild the cluster as a concise cold-start surface that captures scope, integrations, implemented state, gaps, and next checks. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` reflect consistent scope, evidence pointers, and immediate next checks for continuing investigations. |
| Allowed boundaries | `F:\\Repos\\Aralia\\docs\\tasks\\investigations` plus references to `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`. |
| Stop condition | Pause only after documentation is internally consistent for cold-start continuity. |
| Verification | Confirm all three files contain the required fields and reference paths consistently. |
| Owner | Worker D |
| Next action | Wait for the next inquiry packet request and apply this cluster output contract when it arrives. |

## Scope Boundaries

In scope:
- Project documentation for investigation packets and inquiry state.
- Gap registration and routing decisions for this cluster.
- Integration links to project registry and global gap surface.

Out of scope:
- Any application source changes.
- Cross-project governance redesign.
- New implementation artifacts outside this folder.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Expected-output contract for future inquiry packets is not yet documented. | in_scope_now | Worker D | `docs/projects/PROJECT_TRACKER.md` | Add a short packet output contract section in this folder docs before starting the next inquiry. |
| No dedicated investigation index for non-dice inquiry packets exists in this folder. | adjacent_follow_up | Worker D | `docs/tasks/investigations` | Add entries as inquiry packets are created. |

## Integrations

- `docs/projects/PROJECT_TRACKER.md`: owning registry row and project signal.
- `docs/projects/GLOBAL_GAPS.md`: routing for cross-project and orphaned gaps.
- `docs/registry/@DOC-REVIEW-LEDGER.md`: review-state context for `DICE_ROLLER_ANALYSIS.md`.

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project/out-of-scope gap routing | active |
| `TRACKER.md` | Active queue and next checks | active |
| `GAPS.md` | Durable unresolved findings | active |
| `DICE_ROLLER_ANALYSIS.md` | Baseline investigation evidence | active |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Read `DICE_ROLLER_ANALYSIS.md` for preserved technical context.
5. Continue from the top row in `TRACKER.md`.

## Next Checks

- Verify `TRACKER.md` remains the highest-confidence signal of current task status.
- Verify every new inquiry packet records purpose, evidence, integration points, and explicit next checks before implementation.
