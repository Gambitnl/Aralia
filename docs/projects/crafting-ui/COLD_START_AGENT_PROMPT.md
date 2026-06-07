# Crafting UI Cold Start Agent Handoff

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
docs/projects/crafting-ui/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Crafting UI
Project folder: docs/projects/crafting-ui
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crafting-ui/NORTH_STAR.md
Tracker: docs/projects/crafting-ui/TRACKER.md
Gaps: docs/projects/crafting-ui/GAPS.md

## Previous Agent Handoff

Iteration 1 established the initial cold-start pack. This pass refreshed the
project docs, added the North Star dashboard schema, and tightened the gap
ordering for the next implementation slice. No code changes were made.

## Current Mission

Active task:
T2 - Preserve unresolved UI/systems boundary, and define what is in scope for the next implementation slice

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/crafting-ui/NORTH_STAR.md
- docs/projects/crafting-ui/TRACKER.md
- docs/projects/crafting-ui/GAPS.md
- docs/projects/crafting-ui/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
this docs-only pass, `docs_consistency` is the completed verification.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now has the required Dashboard Card Schema, the tracker and gaps
were refreshed to 2026-06-05, and the next agent resume path now points to
G1/G2/G3 first.

Key files to touch:
- docs/projects/crafting-ui/NORTH_STAR.md
- docs/projects/crafting-ui/TRACKER.md
- docs/projects/crafting-ui/GAPS.md
- docs/projects/crafting-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/crafting-ui/DECISIONS.md
- docs/projects/crafting-ui/AUDIT_OR_PROOF.md
- docs/projects/crafting-ui/RUNBOOK.md
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
