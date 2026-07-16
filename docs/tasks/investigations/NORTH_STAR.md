# Investigation Task Cluster North Star

Status: active
Last updated: 2026-06-25

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
- Dice roller investigation packet: retired 2026-06-25 after valid follow-ups were routed to the Dice project as D-G4 and D-G5 (now absorbed into the planmap `dice` topic; see `docs/superpowers/specs/2026-07-14-absorbed-dice.md`).

## Current State

Implemented:
- Registry linkage exists in `docs/projects/PROJECT_TRACKER.md` under
  "Investigation Task Cluster".
- This cluster has a live scaffold in `docs/tasks/investigations`.
- No standalone investigation packet currently carries active backlog work.
- The retired dice packet's valid follow-ups now live in the Dice project gap registry.
- Future inquiry packets now have a required output contract in this file.

Planned:
- Keep evidence expectations and integration points explicit in this folder.

## Active Task

| Field | Value |
|---|---|
| Task | Keep the cluster as a concise cold-start surface that captures scope, integrations, implemented state, gaps, and next checks. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` reflect consistent scope, evidence pointers, and immediate next checks for continuing investigations. |
| Allowed boundaries | `F:\\Repos\\Aralia\\docs\\tasks\\investigations` plus references to `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`. |
| Stop condition | Pause only after documentation is internally consistent for cold-start continuity. |
| Verification | Confirm all three files contain the required fields and reference paths consistently. |
| Owner | Worker D |
| Next action | Wait for the next inquiry packet request and apply the output contract below when it arrives. |

## Inquiry Packet Output Contract

Every future investigation packet in this folder should include:

- purpose and trigger: why the inquiry exists and what decision it is meant to support
- evidence scope: exact files, commands, rendered surfaces, reports, or project rows checked
- findings: source-backed observations separated from guesses and open questions
- routing: owning project, tracker, or global gap destination for each valid follow-up
- next checks: the smallest proof needed before implementation or closure
- retirement note: whether the packet remains active, is reference-only, or has been migrated to another owner

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
| Expected-output contract for future inquiry packets is documented. | done | Codex | `docs/projects/PROJECT_TRACKER.md`; this file | Apply the contract when the next inquiry packet is created. |
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
| `DICE_ROLLER_ANALYSIS.md` | Dice visual/silent roller investigation | retired 2026-06-25; follow-ups routed to Dice D-G4/D-G5 |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Continue from the top row in `TRACKER.md`; read owning project gap registries for retired packet follow-ups.

## Next Checks

- Verify `TRACKER.md` remains the highest-confidence signal of current task status.
- Verify every new inquiry packet records purpose, evidence, integration points, and explicit next checks before implementation.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/investigations/NORTH_STAR.md","sha256WithoutMarker":"a9cdc70f200104fcd6b790a1d0d1d8c61a5a1aeeb571aca5693df60d809f557b","markedAtUtc":"2026-06-25T22:29:38.635Z"} -->
