# Physics System Cold Start Agent Handoff

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
docs/projects/physics/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Physics System
Project folder: docs/projects/physics
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/physics/NORTH_STAR.md
Tracker: docs/projects/physics/TRACKER.md
Gaps: docs/projects/physics/GAPS.md

## Previous Agent Handoff

Iteration 1 was the bootstrap pass. This iteration refreshed the project
dashboard schema, routed the existing physics gaps into the shared workflow
classes, and split the bundled utility debt into separate follow-up items.
Use NORTH_STAR.md for project scope and intent, TRACKER.md for the active queue,
and GAPS.md for unresolved findings.

## Current Mission

Active task:
T4 - Wire elemental state transitions into damage/status command flow and add
one focused proof check.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. The task is done when the command-level state mapping exists,
the chosen regression path is covered, and the handoff clearly records the
proof source.

Key files to touch:
- docs/projects/physics/NORTH_STAR.md
- docs/projects/physics/TRACKER.md
- docs/projects/physics/GAPS.md
- docs/projects/physics/COLD_START_AGENT_PROMPT.md
- src/commands/effects/DamageCommand.ts
- src/commands/effects/StatusConditionCommand.ts
- src/types/elemental.ts
- src/types/combat.ts

Scoped verification:
Use targeted Vitest coverage for the elemental transition path, or record the
missing proof as a blocker with the next action if the flow is not yet wired.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs. No workflow-level gap was opened in this pass.

Recent progress:
The project docs now include a dashboard card schema, the tracker points at a
new implementation slice, and the physics gaps are split into explicit
in-scope, adjacent, and human-decision routes.

Key files to touch:
- docs/projects/physics/NORTH_STAR.md
- docs/projects/physics/TRACKER.md
- docs/projects/physics/GAPS.md
- docs/projects/physics/COLD_START_AGENT_PROMPT.md
- docs/projects/physics/DECISIONS.md
- docs/projects/physics/AUDIT_OR_PROOF.md
- docs/projects/physics/RUNBOOK.md
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
