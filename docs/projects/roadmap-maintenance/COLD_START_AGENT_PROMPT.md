# Roadmap Maintenance Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/roadmap-maintenance/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Roadmap Maintenance
Project folder: docs/projects/roadmap-maintenance
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/roadmap-maintenance/NORTH_STAR.md
Tracker: docs/projects/roadmap-maintenance/TRACKER.md
Gaps: docs/projects/roadmap-maintenance/GAPS.md

## Previous Agent Handoff

The first iteration created the durable handoff slice and established the
project-local docs baseline. This iteration refreshed the dashboard card
schema, compacted the tracker and gap rows, and kept the workflow-level path
mismatch in the shared workflow gap registry instead of duplicating it here.

## Current Mission

Active task:
T3 - Keep the remaining roadmap-local open items explicitly routed while the
audit artifacts remain historical until a new source-backed run refreshes them.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/roadmap-maintenance/NORTH_STAR.md
- docs/projects/roadmap-maintenance/TRACKER.md
- docs/projects/roadmap-maintenance/GAPS.md
- docs/projects/roadmap-maintenance/COLD_START_AGENT_PROMPT.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof. For this docs pass, manual
docs inspection plus `git diff --check` is the expected proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Dashboard Card Schema added to NORTH_STAR.md. TRACKER.md and GAPS.md now carry
compact open-item routing, and the stale shared-path issue is recorded as a
workflow gap instead of a project-local blocker.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
