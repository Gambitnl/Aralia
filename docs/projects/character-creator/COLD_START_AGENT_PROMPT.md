# Character Creator Cold Start Agent Handoff

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
docs/projects/character-creator/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Character Creator
Project folder: docs/projects/character-creator
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/character-creator/NORTH_STAR.md
Tracker: docs/projects/character-creator/TRACKER.md
Gaps: docs/projects/character-creator/GAPS.md

## Previous Agent Handoff

Iteration 1 created the first project handoff and established the live
Character Creator scope. This pass refreshed the North Star dashboard schema,
aligned the tracker/gap state to the current sidebar-navigation ambiguity, and
kept the handoff compact for a cold-start resume.

## Current Mission

Active task:
G2 - sidebar-navigation contract clarification

Acceptance criteria:
Use the active TRACKER.md row and the G2 entry in GAPS.md as the source of
truth. Keep the docs aligned with the current permissive sidebar navigation
behavior unless a product decision says otherwise. Do not invent strict
gating as current behavior.

Key files to touch:
- docs/projects/character-creator/NORTH_STAR.md
- docs/projects/character-creator/TRACKER.md
- docs/projects/character-creator/GAPS.md
- docs/projects/character-creator/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Docs consistency only for this pass; no implementation verification was run.
If implementation work resumes, use the tracker-defined proof source or add one
before claiming completion.

Blocking dependencies / do-not-touch:
No project-local blocker beyond the unresolved G2 navigation-contract
ambiguity. Stay inside this project's scope boundaries and route sibling-project
issues elsewhere.

Recent progress:
North Star now carries the Dashboard Card Schema. TRACKER.md and GAPS.md both
point at the same active sidebar-navigation ambiguity. No optional
DECISIONS.md, AUDIT_OR_PROOF.md, or RUNBOOK.md files exist in this project
folder.

Key files to touch:
- docs/projects/character-creator/NORTH_STAR.md
- docs/projects/character-creator/TRACKER.md
- docs/projects/character-creator/GAPS.md
- docs/projects/character-creator/COLD_START_AGENT_PROMPT.md
- docs/projects/character-creator/DECISIONS.md
- docs/projects/character-creator/AUDIT_OR_PROOF.md
- docs/projects/character-creator/RUNBOOK.md
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
