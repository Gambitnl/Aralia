# Demo Area Cold Start Agent Handoff

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
docs/projects/demo-area/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Demo Area
Project folder: docs/projects/demo-area
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/demo-area/NORTH_STAR.md
Tracker: docs/projects/demo-area/TRACKER.md
Gaps: docs/projects/demo-area/GAPS.md

## Previous Agent Handoff

The prior pass refreshed the Demo Area handoff docs, added the dashboard schema
to `NORTH_STAR.md`, and kept the retention decision open. Use
`NORTH_STAR.md` for scope and current state, `TRACKER.md` for the active queue,
and `GAPS.md` for unresolved findings.

## Current Mission

Active task:
T3 - Resolve demo area retention decision

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/demo-area/NORTH_STAR.md
- docs/projects/demo-area/TRACKER.md
- docs/projects/demo-area/GAPS.md
- docs/projects/demo-area/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Demo Area docs were compacted for resume clarity. The active blocker remains the
retention decision for `src/components/demo/CombatMessagingDemo.tsx`.

Key files to touch:
- docs/projects/demo-area/NORTH_STAR.md
- docs/projects/demo-area/TRACKER.md
- docs/projects/demo-area/GAPS.md
- docs/projects/demo-area/COLD_START_AGENT_PROMPT.md
- docs/projects/demo-area/DECISIONS.md
- docs/projects/demo-area/AUDIT_OR_PROOF.md
- docs/projects/demo-area/RUNBOOK.md
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
