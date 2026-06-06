# NORTHSTAR: Scripts: Quality Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared
workflow file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/scripts-quality/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Scripts: Quality
Project folder: docs/projects/scripts-quality
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/scripts-quality/NORTH_STAR.md
Tracker: docs/projects/scripts-quality/TRACKER.md
Gaps: docs/projects/scripts-quality/GAPS.md

## Previous Agent Handoff

Iteration 1 established the project doc set and the initial quality-policy map.
This pass refreshed the dashboard-facing schema, compacted the tracker/gap
state, and recorded the repeated shared-path workflow ambiguity as a +1.

## Current Mission

Active task:
T3 - Capture quality-monitoring gaps and define next checks

Acceptance criteria:
Use the active TRACKER.md row and the acceptance criteria in NORTH_STAR.md.
If the active task lacks a scoped check, define one before moving beyond docs.

Key files to touch:
- docs/projects/scripts-quality/NORTH_STAR.md
- docs/projects/scripts-quality/TRACKER.md
- docs/projects/scripts-quality/GAPS.md
- docs/projects/scripts-quality/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Run `npm run quality:debt` and compare the output shape to the
`scripts/quality/debt-summary.cjs` map. If the scope stays narrow on purpose,
record that in NORTH_STAR.md instead of leaving it implicit.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
The North Star now includes a Dashboard Card Schema section, the tracker and
gap log are compacted to the current active follow-ups, and the workflow gap
about moved shared paths now has another testimony.

## Required End State For This Iteration

Before ending, refresh this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
