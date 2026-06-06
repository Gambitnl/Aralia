# Religion System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/religion/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Religion System
Project folder: docs/projects/religion
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/religion/NORTH_STAR.md
Tracker: docs/projects/religion/TRACKER.md
Gaps: docs/projects/religion/GAPS.md

## Previous Agent Handoff

Iteration 1 seeded the project docs and current gap registry. This pass refreshed
the dashboard-facing North Star schema, marked the cold-start checklist task
complete, and tightened the next-resume order so the next agent starts from G1,
then G2.

## Current Mission

Active task:
Resume implementation from G1, then G2, using the refreshed handoff and the
compact gap order in TRACKER.md.

Acceptance criteria:
Keep the dual-state migration decision and the service-effect typing decision
aligned. If a blocker appears, record it in GAPS.md with evidence instead of
widening into unrelated religion work.

Key files to touch:
- docs/projects/religion/NORTH_STAR.md
- docs/projects/religion/TRACKER.md
- docs/projects/religion/GAPS.md
- docs/projects/religion/COLD_START_AGENT_PROMPT.md
- docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- docs/projects/PROJECT_CARD_SCHEMA.md

Scoped verification:
Use the tracker or North Star verification path for the active gap being worked.
For this docs pass, the durable proof is the refreshed project documentation and
the shared workflow-gap testimony.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now carries the dashboard card schema. TRACKER and GAPS are trimmed
to the current queue, and WFG-001 received another testimony because the stale
shared-path issue recurred during this pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
