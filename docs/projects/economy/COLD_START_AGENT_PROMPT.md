# Economy System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/economy/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Economy System
Project folder: docs/projects/economy
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/economy/NORTH_STAR.md
Tracker: docs/projects/economy/TRACKER.md
Gaps: docs/projects/economy/GAPS.md

## Previous Agent Handoff

Iteration 1 established the initial project handoff. This pass refreshed the
resume state, added the Dashboard Card Schema to NORTH_STAR.md, and kept the
active task centered on T3. Use NORTH_STAR.md for project scope and intent,
TRACKER.md for the active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
T3 - Verify route-region id validity (seed routes vs region catalog) before major gameplay tuning.

Acceptance criteria:
Use the active TRACKER.md row and the resume path in NORTH_STAR.md.
Acceptance is met when every seed route id resolves to a region entry, the
failing mappings are repaired, and a CI-safe assertion or test remains in place.

Key files to touch:
- docs/projects/economy/NORTH_STAR.md
- docs/projects/economy/TRACKER.md
- docs/projects/economy/GAPS.md
- docs/projects/economy/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Docs-only continuity refresh completed on 2026-06-05. NORTH_STAR.md now
includes the Dashboard Card Schema, TRACKER.md and GAPS.md were aligned to keep
T3 as the resume path, and no source code or shared workflow files were changed.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
