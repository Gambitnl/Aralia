# Puzzles System Cold Start Agent Handoff

Status: review-required
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
Iteration: 6
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
| 4 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Sub-agent final receipt |
| 5 | Schrodinger / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Subagent completion notification `019eaa3b-2e4b-77e3-90a6-38842e8af280` |

## Previous Agent Handoff

Iteration 2 completed `T2`: first production lockpicking dispatch from a real world location lock feature:
- Added cave entrance `interactableFeatures` lock contract in `src/data/world/locations.ts`
- Emitted `OPEN_LOCKPICKING_MODAL` from `src/components/ActionPane/useActionGeneration.ts`
- Routed action handling in `src/hooks/actions/actionHandlers.ts`
- Added `src/components/ActionPane/__tests__/ActionPane.test.tsx` lock action assertion

## Current Mission

Active task:
`T3` is done. The remaining caller gap in `TRACKER.md`, currently `PZ-007` (`getPuzzleHint` runtime caller), is now review-required because no runtime `Puzzle` owner exists yet.

Acceptance criteria:
Use `docs/projects/puzzles/TRACKER.md`, `NORTH_STAR.md`, and `GAPS.md` as your live queue, then either wire one gameplay caller to `getPuzzleHint` or keep the blocker documented with a Required Review Brief if ownership sits elsewhere.

Key files to touch:
- docs/projects/puzzles/NORTH_STAR.md
- docs/projects/puzzles/TRACKER.md
- docs/projects/puzzles/GAPS.md
- docs/projects/puzzles/COLD_START_AGENT_PROMPT.md
- docs/projects/puzzles/AUDIT_OR_PROOF.md
- docs/projects/puzzles/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- src/systems/puzzles/puzzleSystem.ts
- src/systems/puzzles/__tests__/puzzleSystem.test.ts

Scoped verification:
Use the scoped verification named by the active tracker row plus these proofs:
- `src/systems/puzzles/__tests__/puzzleSystem.test.ts`
- `docs/projects/puzzles/NORTH_STAR.md`
- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`
- `docs/projects/puzzles/AUDIT_OR_PROOF.md`

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
- `T3` completed; `getPuzzleHint` now resolves a live Intelligence check.
- `PZ-002` is resolved at the helper layer; `PZ-007` is now review-required while the caller owner is undecided.
- `docs/projects/puzzles/NORTH_STAR.md`, `docs/projects/puzzles/TRACKER.md`, `docs/projects/puzzles/GAPS.md`, `docs/projects/puzzles/AUDIT_OR_PROOF.md`, and `docs/projects/puzzles/RUNBOOK.md` have been kept aligned.

## Required End State For This Iteration

Before ending, update:
- this handoff file with next iteration context,
- all required docs above,
- `AUDIT_OR_PROOF.md` and `RUNBOOK.md` with what was done and why, and `DECISIONS.md` only if a new decision was introduced,
- and keep only the current handoff block; do not keep historical handoff transcripts in this file.

## Workflow Gap Review

Read: `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`
Update needed: none for this iteration.

## Next Safe Resume Action

Continue with `PZ-007` in `docs/projects/puzzles/GAPS.md` after the Required Review Brief is resolved, then verify a source-backed runtime caller proof before considering map/key follow-ups.

## agent_comments

agent_comments: ""
---END NEXT AGENT HANDOFF---
