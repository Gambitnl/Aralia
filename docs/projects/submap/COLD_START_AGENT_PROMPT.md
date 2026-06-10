# Submap Cold Start Agent Handoff

Status: active
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
| 4 | Codex / gpt-5 | direct dashboard correction pass | certain | 2026-06-09 | User clarified Submap should be active pre-deprecation extraction, not immediate reference-only deprecation. |

## Current State

- The DOM/tile Submap remains present in the repo while pre-deprecation extraction proceeds.
- `docs/projects/submap/DEPENDENCY_CONTRACT.md` now records the renderer-independent quick-travel, inspect, tooltip, and timing contract.
- `docs/projects/submap/AUDIT_OR_PROOF.md` records the 2026-06-09 dependency inventory evidence.
- `TRACKER.md` keeps extraction tasks active and separates the later replacement-owner decision from extraction work.
- The phase-out path is contract extraction first, not renderer replacement or
  deletion.

## Active Task

Task:
Assign only extraction/inventory/proof work before any Submap component
deprecation.

Acceptance criteria:
- `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay aligned with the active extraction scope.
- The contract note remains focused on retained functions and dependent systems, not renderer replacement.
- The next agent can resume an extraction slice without re-deriving the contract from source.

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
- Do not delete or replace Submap components. Extraction-only implementation is
  allowed when it preserves behavior and includes proof.

Recent progress:
- The quick-travel and inspect dependency contract is now documented in a durable Submap note.
- The North Star and tracker now point at that contract instead of leaving the next step implicit.

Workflow gap review:
- Read `WORKFLOW_GAPS.md`; no new workflow-level ambiguity was introduced by this pass.

agent_comments: User clarification on 2026-06-09 made Submap an active
pre-deprecation extraction/modularization project. Assign only extraction,
inventory, and proof slices; no deletion or replacement.

## Required End State For This Iteration

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

The Submap packet has been corrected to keep the DOM/tile surface in place
while making the renderer-independent quick-travel and inspect dependencies
explicit for extraction work.

## Current Mission

Active task:
T3/T4/T5 - Continue extraction inventory and retained-function proof before
component deprecation.

Acceptance criteria:
Use the contract note and tracker rows to extract or prove retained behavior.
Do not delete or replace components.

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
Do not delete the DOM/tile Submap surface. Do not continue renderer replacement
or component removal. Extraction-only implementation with proof is allowed.

Recent progress:
The dependency contract now captures the preserved quick-travel and inspect
inputs, outputs, action payload semantics, modal visibility routing, action menu
and material lookup dependents, generation services, town/village overlap,
puzzle hooks, MapData compatibility, and combat-map separation.

agent_comments: User clarification on 2026-06-09 made Submap an active
pre-deprecation extraction/modularization project. Assign only extraction,
inventory, and proof slices; no deletion or replacement.

Required closeout reminders:
- Keep `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and this handoff aligned.
- Keep the handoff compact; only the latest iteration ledger row should remain.
---END NEXT AGENT HANDOFF---
