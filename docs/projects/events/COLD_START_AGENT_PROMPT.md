---
schema_version: 1
handoff_type: agent_to_agent
project: Events System
slug: events
status: review-required
last_updated: "2026-06-08"
iteration: 4
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/events/NORTH_STAR.md
tracker: docs/projects/events/TRACKER.md
gaps: docs/projects/events/GAPS.md
---
# Events System Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/events/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Events System
Project folder: docs/projects/events
Iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/events/NORTH_STAR.md
Tracker: docs/projects/events/TRACKER.md
Gaps: docs/projects/events/GAPS.md

## Previous Agent Handoff

Iteration 3 documented the replay contract at the event-bus level and then
split the remaining work into review-gated lane-contract decisions. The open
set now includes a compatibility-contract decision for the split combat/event
lanes, a marker-contract decision for turn order versus day scheduling, and a
new reducer-merge gap for daily world events.

## Current Mission

Active task:
T2 - Define and document remaining cross-lane scheduling gaps for src/systems/events and adjacent combat event lanes, but keep the lane-contract decisions review-gated.

Acceptance criteria:
Use TRACKER.md and NORTH_STAR.md as authority, keep the remaining gap set
aligned with source evidence, and preserve the proof map for event order,
replay snapshot round-tripping, split-lane compatibility, turn/day marker
ownership, and the daily-world merge contract.

Key files to touch:
- docs/projects/events/NORTH_STAR.md
- docs/projects/events/TRACKER.md
- docs/projects/events/GAPS.md
- docs/projects/events/COLD_START_AGENT_PROMPT.md

Scoped verification:
Run a docs-only verification pass:
`git diff --check`

Blocking dependencies / do-not-touch:
Stay inside docs/projects/events. Do not edit docs/projects/PROJECT_TRACKER.md
or docs/projects/GLOBAL_GAPS.md in this pass.

Recent progress:
CombatEvents now records a canonical replay trace and supports snapshot/restore
round-tripping. G2 remains done, G3 and G4 are now review-required, and G6
captures the world-reducer merge gap for daily simulation output.

Blockers:
- G3 is review-required on the split combat/event lane compatibility contract.
- G4 is review-required on turn-day marker ownership and proof boundaries.
- G6 needs a reducer merge contract before daily world output can be treated
  as fully preserved.

Workflow-gap review result:
- Source evidence confirms the split lanes are real, but the compatibility
  envelope, marker ownership, and reducer merge contract are not yet explicit.
- No forward implementation work should be assigned until the owner decision is
  recorded.

Dashboard-schema updates:
- Gap signal now reports three open project gaps.
- Next step now points future agents toward review-gated contract alignment
  instead of implementation assignment.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, recent progress, workflow-gap review result, and
dashboard-schema updates. Keep only the current handoff between the BEGIN/END
markers; do not preserve old handoff transcripts in this file.
## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, agent identity/runtime surface, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers.

---END NEXT AGENT HANDOFF---
