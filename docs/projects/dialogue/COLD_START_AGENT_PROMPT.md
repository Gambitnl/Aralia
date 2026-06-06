# Dialogue Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/dialogue/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Dialogue
Project folder: docs/projects/dialogue
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/dialogue/NORTH_STAR.md
Tracker: docs/projects/dialogue/TRACKER.md
Gaps: docs/projects/dialogue/GAPS.md

## Previous Agent Handoff

The first pass created the project handoff and seeded the active task queue.
This pass refreshed the dashboard schema, kept the active gap inventory aligned,
and added two evidence-backed Dialogue follow-ups. Use NORTH_STAR.md for scope
and intent, TRACKER.md for the active queue, and GAPS.md for unresolved
findings.

## Current Mission

Primary active task:
D2 - Track unresolved dialogue gaps and keep this project-level gap list aligned

Adjacent active task:
D3 - Validate current session persistence and memory update path

Acceptance criteria:
Keep NORTH_STAR.md, TRACKER.md, and GAPS.md mutually aligned. Preserve the
active objective, keep the dashboard card schema current, and only add gap rows
when evidence supports them.

Key files to touch:
- docs/projects/dialogue/NORTH_STAR.md
- docs/projects/dialogue/TRACKER.md
- docs/projects/dialogue/GAPS.md
- docs/projects/dialogue/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use docs consistency as the scoped verification for this pass. If the active
task later expands into runtime work, add the code-side verification source
before claiming completion.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs, and do not edit the shared workflow files.

Recent progress:
The resume path is now clearer: the North Star has a dashboard card schema, the
tracker keeps D2/D3 visible, and GAPS now records DIAL-004 and DIAL-005 as
project-specific follow-ups.

## Required End State For This Iteration

Before ending, keep the handoff compact and current. Update the iteration
number, active task, acceptance criteria, key files, verification method,
blockers, and recent progress so the next agent can resume without re-deriving
scope from the shared workflow. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
