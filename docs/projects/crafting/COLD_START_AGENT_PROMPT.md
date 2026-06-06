# Crafting System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/crafting/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Crafting System
Project folder: docs/projects/crafting
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/crafting/NORTH_STAR.md
Tracker: docs/projects/crafting/TRACKER.md
Gaps: docs/projects/crafting/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial living-project handoff and seeded the first
gap registry. This pass refreshed the North Star dashboard schema, clarified
the tracker resume path, and expanded the explicit crafting gap set to G1-G8.

## Current Mission

Active task:
T3 - Convert unresolved areas into explicit gap rows with owners and follow-on proof checks.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. The gap registry now holds the known crafting follow-ups
explicitly; the next agent should continue from the highest-priority open gap
instead of re-opening already-captured uncertainty.

Key files to touch:
- docs/projects/crafting/NORTH_STAR.md
- docs/projects/crafting/TRACKER.md
- docs/projects/crafting/GAPS.md
- docs/projects/crafting/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. For this doc-only pass, keep verification documentation-safe and
record the expected proof path in the gap rows instead of widening scope.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
The handoff now points at the detailed gap registry, the North Star includes
the dashboard schema, and `GAPS.md` has explicit rows for the alchemy
drag-and-drop follow-up and the ingredient glossary CR fallback.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
