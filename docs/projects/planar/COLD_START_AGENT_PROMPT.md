# Planar System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared
workflow file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/planar/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Planar System
Project folder: docs/projects/planar
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/planar/NORTH_STAR.md
Tracker: docs/projects/planar/TRACKER.md
Gaps: docs/projects/planar/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project file set and the first durable gap
registry. This pass refreshed the dashboard-facing schema, compacted the gap
registry, and kept the next implementation slice pointed at the highest-priority
open gap.

## Current Mission

Active task:
Resume from `GAPS.md` row `P1` and keep the next slice evidence-backed and
small.

Acceptance criteria:
Use the active `TRACKER.md` row or, if no tracker row is active, start from the
highest-priority open gap in `GAPS.md`. Keep project-local gaps compact and
traceable to source evidence.

Key files to touch:
- docs/projects/planar/NORTH_STAR.md
- docs/projects/planar/TRACKER.md
- docs/projects/planar/GAPS.md
- docs/projects/planar/COLD_START_AGENT_PROMPT.md
- Any source or docs named by the selected gap

Scoped verification:
Use the verification method named in the selected gap or tracker row. If this is
a docs-only pass, verify against `docs/projects/PROJECT_CARD_SCHEMA.md` and the
shared workflow docs.

Blocking dependencies / do-not-touch:
Stay inside the Planar project folder. Route workflow ambiguity to
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` and
cross-project issues to `docs/projects/GLOBAL_GAPS.md`.

Recent progress:
Added the `Dashboard Card Schema` section to North Star, refreshed the tracker
and gap summaries, and confirmed no workflow-level gap needed escalation.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.

---END NEXT AGENT HANDOFF---
