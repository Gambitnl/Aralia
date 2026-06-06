# Conversation Panel Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/conversation-panel/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Conversation Panel
Project folder: docs/projects/conversation-panel
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
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

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
