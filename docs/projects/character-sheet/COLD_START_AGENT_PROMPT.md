# Character Sheet Cold Start Agent Handoff

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
docs/projects/character-sheet/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Character Sheet
Project folder: docs/projects/character-sheet
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
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

Key files to touch:
- docs/projects/character-sheet/NORTH_STAR.md
- docs/projects/character-sheet/TRACKER.md
- docs/projects/character-sheet/GAPS.md
- docs/projects/character-sheet/COLD_START_AGENT_PROMPT.md
- docs/projects/character-sheet/DECISIONS.md
- docs/projects/character-sheet/AUDIT_OR_PROOF.md
- docs/projects/character-sheet/RUNBOOK.md
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
