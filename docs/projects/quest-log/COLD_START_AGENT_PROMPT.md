# Quest Log Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/quest-log/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Quest Log
Project folder: docs/projects/quest-log
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/quest-log/NORTH_STAR.md
Tracker: docs/projects/quest-log/TRACKER.md
Gaps: docs/projects/quest-log/GAPS.md
Proof: docs/projects/quest-log/AUDIT_OR_PROOF.md

## Previous Agent Handoff

No prior project iteration handoff remains active. This is iteration 2. Use
NORTH_STAR.md for project scope and intent, TRACKER.md for the active queue,
GAPS.md for unresolved findings, and AUDIT_OR_PROOF.md for the last durable
proof note.

## Current Mission

Active task:
T2 - Confirm Quest Log integration boundaries and next implementation checks before code edits

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap. Keep the
project docs ready for a source-backed resume.

Key files to touch:
- docs/projects/quest-log/NORTH_STAR.md
- docs/projects/quest-log/TRACKER.md
- docs/projects/quest-log/GAPS.md
- docs/projects/quest-log/AUDIT_OR_PROOF.md
- docs/projects/quest-log/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof. This pass only refreshed the
handoff docs, so runtime proof is still pending for T2.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Added the missing project dashboard schema to NORTH_STAR.md, refreshed the
tracker and gap notes, and added a durable proof file for the next cold-start
agent. Workflow rules still live in ITERATION_AGENT_WORKFLOW.md.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
