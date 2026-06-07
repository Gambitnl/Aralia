# Dice Cold Start Agent Handoff

Status: active
Last updated: 2026-06-06

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/dice/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Dice
Project folder: docs/projects/dice
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/dice/NORTH_STAR.md
Tracker: docs/projects/dice/TRACKER.md
Gaps: docs/projects/dice/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial Dice handoff packet and established the current
doc set. This refresh adds the dashboard schema and aligns the active task with
the current project gaps.

## Current Mission

Active task:
D-2 - Add deterministic RNG + roll history plan

Acceptance criteria:
- Define one deterministic roll policy that covers silent and visual Dice paths.
- Decide the roll-history scope: session-only, persisted, or export-only.
- Record any unresolved project blocker in `GAPS.md` before implementation starts.

Key files to touch:
- docs/projects/dice/NORTH_STAR.md
- docs/projects/dice/TRACKER.md
- docs/projects/dice/GAPS.md
- docs/projects/dice/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
this planning slice, keep verification docs-only unless the task moves into
runtime changes.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now includes the dashboard card schema and the current resume
target. Tracker and gaps were refreshed to match the active D-2 planning
slice. No new project-specific blocker was discovered in this pass.

Key files to touch:
- docs/projects/dice/NORTH_STAR.md
- docs/projects/dice/TRACKER.md
- docs/projects/dice/GAPS.md
- docs/projects/dice/COLD_START_AGENT_PROMPT.md
- docs/projects/dice/DECISIONS.md
- docs/projects/dice/AUDIT_OR_PROOF.md
- docs/projects/dice/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- <source/docs named by the active tracker task>

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Use the scoped verification named by TRACKER.md, NORTH_STAR.md, or the active task. If verification cannot be run, record the blocker and next proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, and GAPS.md as the current source of truth.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

Final response must report:
- files updated
- files intentionally not updated
- verification performed or skipped
- bounded gap sweep surfaces checked
- project gaps recorded
- workflow gaps read or updated
- dashboard schema fields updated
- required docs accounted for
- optional docs touched, skipped, or not present
- documentation compaction performed or not needed
- agent comments added or intentionally left empty
- assumptions made
- next safe resume action
---END NEXT AGENT HANDOFF---
