# Documentation Cleanup Cold Start Agent Handoff

Status: active
Last updated: 2026-06-07

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/documentation-cleanup/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Documentation Cleanup
Project folder: docs/projects/documentation-cleanup
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/documentation-cleanup/NORTH_STAR.md
Tracker: docs/projects/documentation-cleanup/TRACKER.md
Gaps: docs/projects/documentation-cleanup/GAPS.md

## Previous Agent Handoff

Iteration 2 verified the path-drift evidence for packets 1G.7–1G.10 against the
live repo, resolving G2 with full evidence in `DECISIONS.md` D-01 and
`AUDIT_OR_PROOF.md`. Found and corrected G4 (stale PROJECT_TRACKER.md link).
Created `DECISIONS.md` and `AUDIT_OR_PROOF.md` as new required supporting docs.
Added WFG-001 +1 testimony. T2 advanced from not_started to in_progress.

## Current Mission

Active task:
T2 in `TRACKER.md`: curate stale/duplicate docs with evidence-backed decisions.
G2 is resolved; remaining open gaps are G1, G3, and G4.

Acceptance criteria:
Use the active `TRACKER.md` row, the gap rows in `GAPS.md`, and any
acceptance criteria listed in `NORTH_STAR.md`. If the active task still lacks a
source-backed path, record the missing evidence as a blocker before continuing.

Key files to touch:
- docs/projects/documentation-cleanup/NORTH_STAR.md
- docs/projects/documentation-cleanup/TRACKER.md
- docs/projects/documentation-cleanup/GAPS.md
- docs/projects/documentation-cleanup/COLD_START_AGENT_PROMPT.md
- docs/projects/documentation-cleanup/DECISIONS.md
- docs/projects/documentation-cleanup/AUDIT_OR_PROOF.md
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
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs.

Recent progress:
G2 (path-drift) resolved with evidence table. G4 (stale tracker link) corrected.
DECISIONS.md and AUDIT_OR_PROOF.md created. G1 (broad curation) and G3
(duplicate-cleanup scope) remain open. PROJECT_TRACKER.md has duplicate table
sections (Feature/UI, Tools/Automation repeated) — noted as adjacent
documentation quality issue, not in this project's current slice.

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
