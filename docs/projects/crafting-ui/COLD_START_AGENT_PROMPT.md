# Crafting UI Cold Start Agent Handoff

Status: active
Last updated: 2026-06-04

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/crafting-ui/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Crafting UI
Project folder: docs/projects/crafting-ui
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
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

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
