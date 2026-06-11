---
schema_version: 1
handoff_type: agent_to_agent
project: Compass Pane
slug: compass-pane
status: active
last_updated: "2026-06-08"
iteration: 3
source_agent: Codex / gpt-5.4-mini high
target_agent: next cold-start agent
runtime_surface: MCP-subagent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/compass-pane/NORTH_STAR.md
tracker: docs/projects/compass-pane/TRACKER.md
gaps: docs/projects/compass-pane/GAPS.md
---
# Compass Pane Cold Start Agent Handoff

Status: active
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/compass-pane/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Compass Pane
Project folder: docs/projects/compass-pane
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/compass-pane/NORTH_STAR.md
Tracker: docs/projects/compass-pane/TRACKER.md
Gaps: docs/projects/compass-pane/GAPS.md

## Iteration Ledger

| Iteration | Agent / Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Codex desktop context with sub-agent repo access |

## Previous Iteration Summary

T2 is complete. The Compass Pane movement/action slice now has durable proof for
move dispatch, `look_around` dispatch, edge disablement, and pass-time wait
confirmation. The proof note lives in `docs/projects/compass-pane/AUDIT_OR_PROOF.md`.

## Current Mission

Active task:
T3 - Resolve navigation-affordance gap from registry

Acceptance criteria:
Validate the current affordance rules for map/submap/3D toggles in
`GameLayout` vs `SubmapPane`, confirm whether the world-map toggle should stay
visible in submap context, and add a Required Review Brief if the visibility
rule itself is a product decision.

Key files to touch:
- docs/projects/compass-pane/NORTH_STAR.md
- docs/projects/compass-pane/TRACKER.md
- docs/projects/compass-pane/GAPS.md
- docs/projects/compass-pane/AUDIT_OR_PROOF.md
- docs/projects/compass-pane/COLD_START_AGENT_PROMPT.md
- src/components/CompassPane/index.tsx
- src/components/layout/GameLayout.tsx
- src/components/Submap/SubmapPane.tsx

Scoped verification:
`npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx`

Blocking dependencies / do-not-touch:
No blocker currently. Stay inside Compass Pane scope and do not widen into
unrelated UI refactors.

Recent progress:
Movement/action regression proof is durable and `G2` is resolved in
`docs/projects/compass-pane/GAPS.md`. `TRACKER.md` now points T3 at the
navigation-affordance decision.

Workflow gap review:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was read
and no workflow-level update was needed this iteration.
## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, agent identity/runtime surface, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers.

---END NEXT AGENT HANDOFF---
