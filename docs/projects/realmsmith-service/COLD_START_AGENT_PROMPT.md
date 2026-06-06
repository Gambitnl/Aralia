# NORTHSTAR: RealmSmith Service Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/realmsmith-service/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: RealmSmith Service
Project folder: docs/projects/realmsmith-service
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/realmsmith-service/NORTH_STAR.md
Tracker: docs/projects/realmsmith-service/TRACKER.md
Gaps: docs/projects/realmsmith-service/GAPS.md

## Previous Agent Handoff

Iteration 1 established the initial project packet. This pass refreshed the
dashboard schema, compacted the tracker/gap wording, and recorded the shared
workflow path mismatch as a workflow testimony. No source or code changes were
made.

## Current Mission

Active task:
T2 - Confirm RealmSmith service contract and retry policy before next implementation change

Acceptance criteria:
- TRACKER.md and NORTH_STAR.md agree on the active contract/retry state.
- The next agent can point to the named source files and explain the current
  service contract surface.
- Any new ambiguity found during source review is recorded in GAPS.md or
  routed to the shared workflow / global gap docs.

Key files to touch:
- docs/projects/realmsmith-service/NORTH_STAR.md
- docs/projects/realmsmith-service/TRACKER.md
- docs/projects/realmsmith-service/GAPS.md
- docs/projects/realmsmith-service/COLD_START_AGENT_PROMPT.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md if the
  workflow-path ambiguity recurs
- Any source/docs named by T2

Scoped verification:
- Docs consistency is already refreshed.
- The next agent should perform the source scan or documented proof named by
  TRACKER.md / NORTH_STAR.md before claiming T2 is ready.

Blocking dependencies / do-not-touch:
- Stay inside this project's docs and source boundaries.
- Do not broaden into sibling project docs unless a real cross-project gap is
  found.

Recent progress:
- Dashboard Card Schema added to NORTH_STAR.md.
- TRACKER.md and GAPS.md were compacted to the current active contract/retry
  gap set.
- Workflow-level path ambiguity was encountered and testified in
  WORKFLOW_GAPS.md.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
