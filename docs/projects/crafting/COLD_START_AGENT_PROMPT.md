# Crafting System Cold Start Agent Handoff

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
docs/projects/crafting/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Crafting System
Project folder: docs/projects/crafting
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
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

Key files to touch:
- docs/projects/crafting/NORTH_STAR.md
- docs/projects/crafting/TRACKER.md
- docs/projects/crafting/GAPS.md
- docs/projects/crafting/COLD_START_AGENT_PROMPT.md
- docs/projects/crafting/DECISIONS.md
- docs/projects/crafting/AUDIT_OR_PROOF.md
- docs/projects/crafting/RUNBOOK.md
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
