# Crafting UI Cold Start Agent Handoff

Status: active
Last updated: 2026-06-09

This file is the project-specific context package and directive checklist for
the next cold-start agent. It does not duplicate the full workflow rules. The
agent must follow the shared workflow file and use this file for current
project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/crafting-ui/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Crafting UI
Project folder: docs/projects/crafting-ui
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crafting-ui/NORTH_STAR.md
Tracker: docs/projects/crafting-ui/TRACKER.md
Gaps: docs/projects/crafting-ui/GAPS.md

## Previous Agent Context

Iteration 2 closed the shared crafter-contract gap in source and refreshed the
Crafting UI docs around it. The key change was the move from local mock crafter
logic to the shared `crafterAdapter` path used by gathering and creature
harvest.

## Current Mission

Active task:
T2 - Preserve unresolved UI/systems boundary, and define what is in scope for the next implementation slice

Acceptance criteria:
Use the active `TRACKER.md` row and any acceptance criteria listed in
`NORTH_STAR.md`. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- `docs/projects/crafting-ui/NORTH_STAR.md`
- `docs/projects/crafting-ui/TRACKER.md`
- `docs/projects/crafting-ui/GAPS.md`
- `docs/projects/crafting-ui/COLD_START_AGENT_PROMPT.md`
- `docs/projects/crafting-ui/DECISIONS.md`
- `docs/projects/crafting-ui/AUDIT_OR_PROOF.md`
- `docs/projects/crafting-ui/RUNBOOK.md`
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by `TRACKER.md` or
`NORTH_STAR.md`. If none is named, add one before claiming the task is done.
For this pass, `docs_consistency` and the focused Crafting UI vitest run are
the completed verification.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
G1 is now closed with source-backed proof. The North Star and tracker now
resume with G3 first, and `AUDIT_OR_PROOF.md` records the proof path for the
shared crafter boundary.

Workflow gap review:
Read `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
No new workflow-level ambiguity was added by this iteration.

Dashboard schema updates:
- `NORTH_STAR.md` now reflects the 2026-06-09 status, proof date, and resume
  path.
- `TRACKER.md` now records the closed G1 proof slice.
- `GAPS.md` now marks G1 done and narrows the remaining follow-up language.

Optional docs:
- `DECISIONS.md` and `RUNBOOK.md` now exist as compact support docs.
- `AUDIT_OR_PROOF.md` was added because the proof is worth preserving.

## Iteration Ledger

| Iteration | Agent / model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | `src/components/Crafting/crafterAdapter.ts` plus Crafting UI panel tests now back the shared crafter boundary |

## Required End State

Keep this handoff current, keep the current handoff only between the markers,
and preserve the next safe resume path without replaying older transcripts.
---END NEXT AGENT HANDOFF---
