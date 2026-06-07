# Layout Project Cold Start Agent Handoff

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
docs/projects/layout/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Layout Project
Project folder: docs/projects/layout
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/layout/NORTH_STAR.md
Tracker: docs/projects/layout/TRACKER.md
Gaps: docs/projects/layout/GAPS.md

## Previous Agent Handoff

Iteration 1 refreshed the cold-start docs, added the dashboard card schema,
and left the active boundary question open. Use NORTH_STAR.md for scope and
intent, TRACKER.md for the active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
T3 - Resolve app-shell boundary ambiguity

Acceptance criteria:
Use the active TRACKER.md row and the scope/boundary notes in NORTH_STAR.md.
If the task still lacks a concrete boundary rule, record that blocker in
GAPS.md before moving on.

Key files to touch:
- docs/projects/layout/NORTH_STAR.md
- docs/projects/layout/TRACKER.md
- docs/projects/layout/GAPS.md
- docs/projects/layout/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If no implementation change is made, record that verification is
still pending rather than claiming completion. If the change is observable,
collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
The Layout docs now have a dashboard card schema and a clearer resume path.
The remaining open work is the `ConversationPanel` vs `GameModals` boundary
decision and the `isUIInteractive` contract check.

Key files to touch:
- docs/projects/layout/NORTH_STAR.md
- docs/projects/layout/TRACKER.md
- docs/projects/layout/GAPS.md
- docs/projects/layout/COLD_START_AGENT_PROMPT.md
- docs/projects/layout/DECISIONS.md
- docs/projects/layout/AUDIT_OR_PROOF.md
- docs/projects/layout/RUNBOOK.md
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
