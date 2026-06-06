# Intrigue System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/intrigue/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Intrigue System
Project folder: docs/projects/intrigue
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/intrigue/NORTH_STAR.md
Tracker: docs/projects/intrigue/TRACKER.md
Gaps: docs/projects/intrigue/GAPS.md

## Previous Agent Handoff

Iteration 1 established the project handoff docs and active queue. This pass
refreshed the dashboard schema, tracker alignment, and gap registry so the next
agent can resume directly from the active queue.

## Current Mission

Active task:
I2 - Audit leverage chain from player-discovered secrets to actionable social consequences.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/intrigue/NORTH_STAR.md
- docs/projects/intrigue/TRACKER.md
- docs/projects/intrigue/GAPS.md
- docs/projects/intrigue/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now has an explicit Dashboard Card Schema, the tracker references
the current gap registry, and the gap registry carries a short triage alignment
note for I2/I3/I4. No source code was changed in this pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
