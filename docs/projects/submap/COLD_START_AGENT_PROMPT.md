# Submap Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-09

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/submap/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Multi-agent worker fallback while gpt-5.3-codex-spark was usage-limited. |

## Current State

- The DOM/tile Submap remains the live gameplay surface.
- `docs/projects/submap/DEPENDENCY_CONTRACT.md` now records the renderer-independent quick-travel, inspect, tooltip, and timing contract.
- `docs/projects/submap/AUDIT_OR_PROOF.md` records the 2026-06-09 dependency inventory evidence.
- `TRACKER.md` keeps the quick-travel proof slice waiting; `G3` blocks forward assignment on renderer authority.
- The renderer-phase-out path is contract extraction first, not renderer replacement.

## Active Task

Task:
Wait for the renderer-authority decision before assigning further Submap implementation or proof work.

Acceptance criteria:
- `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay aligned with the current live contract and review gate.
- The contract note remains focused on preserved dependencies, not renderer replacement.
- The next agent can resume after the decision with one concrete proof step instead of re-deriving the contract from source.

Key files:
- `docs/projects/submap/NORTH_STAR.md`
- `docs/projects/submap/TRACKER.md`
- `docs/projects/submap/GAPS.md`
- `docs/projects/submap/DEPENDENCY_CONTRACT.md`
- `docs/projects/submap/DECISIONS.md`
- `docs/projects/submap/AUDIT_OR_PROOF.md`
- `docs/projects/submap/RUNBOOK.md`
- `src/components/Submap/SubmapPane.tsx`
- `src/components/Submap/useQuickTravel.ts`
- `src/hooks/actions/handleMovement.ts`
- `src/hooks/actions/handleObservation.ts`
- `src/types/actions.ts`

Scoped verification:
- `git diff --check` for all touched files, including the new contract doc.

Blocking dependencies / do-not-touch:
- Do not delete the DOM/tile Submap surface.
- Do not continue renderer replacement, implementation, or proof work until the renderer authority decision in `G3` is recorded.

Recent progress:
- The quick-travel and inspect dependency contract is now documented in a durable Submap note.
- The North Star and tracker now point at that contract instead of leaving the next step implicit.

Workflow gap review:
- Read `WORKFLOW_GAPS.md`; no new workflow-level ambiguity was introduced by this pass.

Required end state:
- Update the project docs in place.
- Keep the current handoff only; do not preserve older transcript blocks between the markers.

---BEGIN NEXT AGENT HANDOFF---
Project: Submap
Project folder: docs/projects/submap
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/submap/NORTH_STAR.md
Tracker: docs/projects/submap/TRACKER.md
Gaps: docs/projects/submap/GAPS.md

## Previous Agent Handoff

The Submap packet has been refreshed to preserve the live DOM/tile surface
while making the renderer-independent quick-travel and inspect dependencies
explicit for later extraction work.

## Current Mission

Active task:
T4/G3 - Renderer authority decision is required before more Submap implementation or proof work.

Acceptance criteria:
Use the contract note and tracker rows to keep the quick-travel and inspect
proof path concrete, but do not assign it until the renderer-authority decision
is recorded.

Key files to touch:
- docs/projects/submap/NORTH_STAR.md
- docs/projects/submap/TRACKER.md
- docs/projects/submap/GAPS.md
- docs/projects/submap/DEPENDENCY_CONTRACT.md
- docs/projects/submap/DECISIONS.md
- docs/projects/submap/AUDIT_OR_PROOF.md
- docs/projects/submap/RUNBOOK.md
- docs/projects/submap/COLD_START_AGENT_PROMPT.md

Scoped verification:
Run `git diff --check` for all touched files, including the new contract doc.

Blocking dependencies / do-not-touch:
Do not delete the DOM/tile Submap surface. Do not continue renderer
replacement, implementation, or proof work until `G3` is decided.

Recent progress:
The dependency contract now captures the preserved quick-travel and inspect
inputs, outputs, action payload semantics, modal visibility routing, MapData
compatibility, and combat-map separation.

Required closeout reminders:
- Keep `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and this handoff aligned.
- Keep the handoff compact; only the latest iteration ledger row should remain.
---END NEXT AGENT HANDOFF---
