# Scripts: Audits Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It does not duplicate the workflow rules. The agent must follow the shared workflow file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/scripts-audits/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Audits
Project folder: docs/projects/scripts-audits
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/scripts-audits/NORTH_STAR.md
Tracker: docs/projects/scripts-audits/TRACKER.md
Gaps: docs/projects/scripts-audits/GAPS.md

## Previous Agent Handoff

Iteration 1 established the project handoff files and pointed the work at the
scripts/audits surface. This pass refreshed the durable docs so the dashboard
can read the current state directly from the project folder.

## Current Mission

Active task:
T2 - Validate command and report paths against live docs references

Acceptance criteria:
Use the active TRACKER.md row and the active gap list in GAPS.md. Confirm that
the command and report paths named in NORTH_STAR.md still resolve to live docs
or source files, and record any stale references explicitly.

Key files to touch:
- docs/projects/scripts-audits/NORTH_STAR.md
- docs/projects/scripts-audits/TRACKER.md
- docs/projects/scripts-audits/GAPS.md
- docs/projects/scripts-audits/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Run the Next Checks listed in NORTH_STAR.md or a narrower equivalent file/path
check if the listed commands are too broad. If any path is stale, record the
mismatch before claiming the task is done.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route any workflow-level ambiguity
to docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md rather
than hiding it in project-local docs.

Recent progress:
The project docs now include a dashboard card schema, the tracker and gap log
have been compacted, and the shared workflow path mismatch was resolved by
using the canonical moved protocol files. No runtime checks were run in this
pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
