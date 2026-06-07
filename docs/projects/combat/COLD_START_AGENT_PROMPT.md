# Combat System Cold Start Agent Handoff

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
docs/projects/combat/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Combat System
Project folder: docs/projects/combat
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/combat/NORTH_STAR.md
Tracker: docs/projects/combat/TRACKER.md
Gaps: docs/projects/combat/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial Combat living-project packet. This pass
refreshed the durable docs, added the dashboard schema, and selected G11 as
the active combat resume slice.

## Current Mission

Active task:
G11 - Class feature generation gap in `src/utils/combat/combatUtils.ts`.

Acceptance criteria:
Add the missing class-specific combat ability generation, then verify the
target classes named in G11. Minimum proof is that monk gains Flurry of Blows
and warlock gains Pact features in the combat palette.

Key files to touch:
- docs/projects/combat/NORTH_STAR.md
- docs/projects/combat/TRACKER.md
- docs/projects/combat/GAPS.md
- src/utils/combat/combatUtils.ts
- related combat tests under `src/utils/combat/**/__tests__` or neighboring
  combat test surfaces

Scoped verification:
Run the focused combat unit tests or equivalent proof named by the tracker
row. If the active slice changes, update the tracker before doing
implementation work.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Combat docs now include the Dashboard Card Schema, the North Star scope
explicitly includes `src/utils/combat/*`, and G11 is marked active in both
TRACKER.md and GAPS.md.

Key files to touch:
- docs/projects/combat/NORTH_STAR.md
- docs/projects/combat/TRACKER.md
- docs/projects/combat/GAPS.md
- docs/projects/combat/COLD_START_AGENT_PROMPT.md
- docs/projects/combat/DECISIONS.md
- docs/projects/combat/AUDIT_OR_PROOF.md
- docs/projects/combat/RUNBOOK.md
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
