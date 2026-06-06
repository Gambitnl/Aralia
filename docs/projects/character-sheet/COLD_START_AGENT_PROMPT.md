# Character Sheet Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/character-sheet/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Character Sheet
Project folder: docs/projects/character-sheet
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/character-sheet/NORTH_STAR.md
Tracker: docs/projects/character-sheet/TRACKER.md
Gaps: docs/projects/character-sheet/GAPS.md

## Previous Agent Handoff

Iteration 1 established the initial project handoff and the open schema
alignment task. This pass refreshed the living docs, added explicit acceptance
criteria, and kept T2 as the active slice. Use NORTH_STAR.md for scope and
resume criteria, TRACKER.md for the active queue, and GAPS.md for unresolved
findings.

## Current Mission

Active task:
T2 - Preserve and route known gap: sheet fields vs schema alignment

Acceptance criteria:
Use the active TRACKER.md row and the acceptance criteria now listed in
NORTH_STAR.md. Do not close T2 until the field map is documented or a concrete
blocker is recorded.

Key files to touch:
- docs/projects/character-sheet/NORTH_STAR.md
- docs/projects/character-sheet/TRACKER.md
- docs/projects/character-sheet/GAPS.md
- docs/projects/character-sheet/COLD_START_AGENT_PROMPT.md
- `src/types/character.ts` and the Character Sheet render use sites if proof
  work is needed

Scoped verification:
Field-by-field validation against `src/types/character.ts` and the relevant
render use sites. If source validation is not done yet, keep T2 active and
record the missing proof instead of implying closure.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now includes a dashboard card schema and explicit acceptance
criteria. Tracker T2 points to that contract, and no workflow-level ambiguity
was found during this pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
