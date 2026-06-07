# Scripts: Audits Cold Start Agent Handoff

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
docs/projects/scripts-audits/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Audits
Project folder: docs/projects/scripts-audits
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
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

Key files to touch:
- docs/projects/scripts-audits/NORTH_STAR.md
- docs/projects/scripts-audits/TRACKER.md
- docs/projects/scripts-audits/GAPS.md
- docs/projects/scripts-audits/COLD_START_AGENT_PROMPT.md
- docs/projects/scripts-audits/DECISIONS.md
- docs/projects/scripts-audits/AUDIT_OR_PROOF.md
- docs/projects/scripts-audits/RUNBOOK.md
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
