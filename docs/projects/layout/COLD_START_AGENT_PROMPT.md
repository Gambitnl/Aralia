# Layout Project Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/layout/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Layout Project
Project folder: docs/projects/layout
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
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

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
