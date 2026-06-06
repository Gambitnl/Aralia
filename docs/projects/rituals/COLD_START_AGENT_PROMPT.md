# Rituals System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/rituals/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Rituals System
Project folder: docs/projects/rituals
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/rituals/NORTH_STAR.md
Tracker: docs/projects/rituals/TRACKER.md
Gaps: docs/projects/rituals/GAPS.md

## Previous Agent Handoff

The first pass established the project docs and gap surface. This iteration
refreshed the dashboard schema and tightened the tracker/gap handoff without
expanding scope. Use NORTH_STAR.md for project scope and intent, TRACKER.md for
the active queue, and GAPS.md for unresolved findings.

## Current Mission

Active task:
RIT-3 - Capture and verify ritual execution coupling between combat spell casting and ritual start flow.

Acceptance criteria:
Use the active TRACKER.md row and the Dashboard Card Schema / Next Checks in
NORTH_STAR.md. Keep the live caller-chain evidence and type-ownership notes in
sync with GAPS.md before making any source change.

Key files to touch:
- docs/projects/rituals/NORTH_STAR.md
- docs/projects/rituals/TRACKER.md
- docs/projects/rituals/GAPS.md
- docs/projects/rituals/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done.
This pass only refreshed docs, so keep proof limited to docs consistency unless
the next agent makes a source change.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Initial handoff file created as part of the living-project cold-start handoff
system split. This pass added the North Star dashboard card schema and compacted
the tracker/gap language so the next agent can resume RIT-3 or RIT-4 quickly.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
