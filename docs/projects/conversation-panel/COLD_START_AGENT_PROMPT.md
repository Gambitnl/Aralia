# Conversation Panel Cold Start Agent Handoff

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
docs/projects/conversation-panel/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Conversation Panel
Project folder: docs/projects/conversation-panel
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/conversation-panel/NORTH_STAR.md
Tracker: docs/projects/conversation-panel/TRACKER.md
Gaps: docs/projects/conversation-panel/GAPS.md

## Previous Agent Handoff

Iteration 1 established the initial project handoff. This pass refreshed the
North Star dashboard schema, tracker dates, and gap ledger so the next agent
can resume from the current open task without stale handoff text.

## Current Mission

Active task:
T2 - Resolve trigger and exclusivity behavior between `activeConversation` and `activeDialogueSession`

Acceptance criteria:
Use the active TRACKER.md row and the criteria in NORTH_STAR.md. If the active
task lacks implementation details, record the missing proof in GAPS.md before
moving to code.

Key files to touch:
- docs/projects/conversation-panel/NORTH_STAR.md
- docs/projects/conversation-panel/TRACKER.md
- docs/projects/conversation-panel/GAPS.md
- docs/projects/conversation-panel/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Docs-only handoff refresh. No runtime verification was run in this pass.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now includes the Dashboard Card Schema; TRACKER.md and GAPS.md are
date-refreshed; the open project gaps remain CP-001 through CP-003.

Key files to touch:
- docs/projects/conversation-panel/NORTH_STAR.md
- docs/projects/conversation-panel/TRACKER.md
- docs/projects/conversation-panel/GAPS.md
- docs/projects/conversation-panel/COLD_START_AGENT_PROMPT.md
- docs/projects/conversation-panel/DECISIONS.md
- docs/projects/conversation-panel/AUDIT_OR_PROOF.md
- docs/projects/conversation-panel/RUNBOOK.md
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
