# Puzzles System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-09

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/puzzles/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Puzzles System
Project folder: docs/projects/puzzles
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/puzzles/NORTH_STAR.md
Tracker: docs/projects/puzzles/TRACKER.md
Gaps: docs/projects/puzzles/GAPS.md

## Iteration Ledger

| Iteration | Agent / Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Codex / gpt-5.3-codex-spark high | MCP-subagent | certain | 2026-06-09 | Sub-agent final receipt |

## Previous Agent Handoff

Iteration 2 completed `T2`: first production lockpicking dispatch from a real world location lock feature:
- Added cave entrance `interactableFeatures` lock contract in `src/data/world/locations.ts`
- Emitted `OPEN_LOCKPICKING_MODAL` from `src/components/ActionPane/useActionGeneration.ts`
- Routed action handling in `src/hooks/actions/actionHandlers.ts`
- Added `src/components/ActionPane/__tests__/ActionPane.test.tsx` lock action assertion

## Current Mission

Active task:
`T2` is done. Next in-scope task is the highest open gap in `TRACKER.md`, currently `PZ-002` (`puzzleSystem` hint flow).

Acceptance criteria:
Use `docs/projects/puzzles/TRACKER.md`, `NORTH_STAR.md`, and `GAPS.md` as your live queue, then close at least one gap with proof or explicit blocker decision in-scope.

Key files to touch:
- docs/projects/puzzles/NORTH_STAR.md
- docs/projects/puzzles/TRACKER.md
- docs/projects/puzzles/GAPS.md
- docs/projects/puzzles/COLD_START_AGENT_PROMPT.md
- docs/projects/puzzles/DECISIONS.md
- docs/projects/puzzles/AUDIT_OR_PROOF.md
- docs/projects/puzzles/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- src/systems/puzzles/puzzleSystem.ts
- src/systems/puzzles/__tests__/puzzleSystem.test.ts

Scoped verification:
Use the scoped verification named by the active tracker row plus these proofs:
- `src/components/ActionPane/__tests__/ActionPane.test.tsx`
- `docs/projects/puzzles/NORTH_STAR.md`
- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
- `T2` completed; lockpicking dispatch now has a non-dev production callsite.
- `PZ-001` marked done and proof row points at lock feature + action flow.
- `docs/projects/puzzles/NORTH_STAR.md`, `docs/projects/puzzles/TRACKER.md`, and `docs/projects/puzzles/GAPS.md` have been kept aligned.

## Required End State For This Iteration

Before ending, update:
- this handoff file with next iteration context,
- all required docs above,
- `DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md` with what was done and why,
- and keep only the current handoff block; do not keep historical handoff transcripts in this file.

## Workflow Gap Review

Read: `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`
Update needed: none for this iteration.

## Next Safe Resume Action

Continue with `PZ-002` in `docs/projects/puzzles/GAPS.md` and verify the hint route proof before considering map/key follow-ups.

## agent_comments

agent_comments: ""
---END NEXT AGENT HANDOFF---
