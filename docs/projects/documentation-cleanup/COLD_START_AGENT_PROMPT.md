# Documentation Cleanup Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/documentation-cleanup/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Documentation Cleanup
Project folder: docs/projects/documentation-cleanup
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/documentation-cleanup/NORTH_STAR.md
Tracker: docs/projects/documentation-cleanup/TRACKER.md
Gaps: docs/projects/documentation-cleanup/GAPS.md

## Previous Agent Handoff

Iteration 1 established the durable project surface and aligned the project
docs with the living-project workflow. This pass refreshed the resume path and
pulled the real cleanup gaps forward from the ignored task evidence.

## Current Mission

Active task:
T2 in `TRACKER.md`: curate stale/duplicate docs with evidence-backed decisions.

Acceptance criteria:
Use the active `TRACKER.md` row, the three gap rows in `GAPS.md`, and any
acceptance criteria listed in `NORTH_STAR.md`. If the active task still lacks a
source-backed path, record the missing evidence as a blocker before continuing.

Key files to touch:
- docs/projects/documentation-cleanup/NORTH_STAR.md
- docs/projects/documentation-cleanup/TRACKER.md
- docs/projects/documentation-cleanup/GAPS.md
- docs/projects/documentation-cleanup/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
`NORTH_STAR.md` now has the dashboard card schema. `TRACKER.md` still points to
the evidence-backed cleanup task. `GAPS.md` now captures the real project gaps
from the ignored task evidence, so the next agent can start from a concrete
resume point instead of rebuilding context.

## Required End State For This Iteration

Before ending, keep the handoff current with the next iteration number,
previous-agent context, active task, acceptance criteria, key files,
verification method, blockers, and recent progress. End the response with the
refreshed handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
