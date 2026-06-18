---
schema_version: 1
handoff_type: agent_to_agent
project: Compass Pane
slug: compass-pane
status: active
last_updated: 2026-06-18
iteration: 4
source_agent: Kilo / kilo/kilo-auto/free
target_agent: next cold-start agent
runtime_surface: CLI agent
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
Last updated: 2026-06-18

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
iteration: 5
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/compass-pane/NORTH_STAR.md
Tracker: docs/projects/compass-pane/TRACKER.md
Gaps: docs/projects/compass-pane/GAPS.md

## Iteration Ledger

| Iteration | Agent / Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Amazon Q MCP subagent | MCP-subagent | certain | 2026-12-19 | Amazon Q in IDE via MCP protocol |
| 4 | Kilo / kilo/kilo-auto/free | CLI agent | certain | 2026-06-18 | Direct CLI/tool session in F:\Repos\Aralia |

## Previous Iteration Summary

T4 is complete. G3 UI pre-check semantics were resolved with a durable rule table and scoped regression tests. CompassPane now documents and tests that global disabled state, current-location world bounds, and adjacent world biome passability are UI pre-checks, while in-bounds submap moves and submap terrain validation remain handler-owned.

## Current Mission

Active task:
G4 - Documentation continuity for `src/components/CompassPane/README.md`

Acceptance criteria:
Sync `src/components/CompassPane/README.md` to current source behavior or explicitly preserve it as historical-only in `NORTH_STAR.md`. If syncing, the README should match the current `index.tsx` file name, prop surface, pass-time modal, submap context, and toggle coupling details without widening into unrelated UI refactors.

Key files to touch:
- `docs/projects/compass-pane/NORTH_STAR.md`
- `docs/projects/compass-pane/TRACKER.md`
- `docs/projects/compass-pane/GAPS.md`
- `docs/projects/compass-pane/AUDIT_OR_PROOF.md`
- `docs/projects/compass-pane/COLD_START_AGENT_PROMPT.md`
- `src/components/CompassPane/README.md`
- `src/components/CompassPane/index.tsx`

Scoped verification:
`npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx`

Blocking dependencies / do-not-touch:
No blocker currently. Stay inside Compass Pane scope and do not widen into unrelated UI refactors.

Recent progress:
T3 navigation affordances validated and G1 resolved. G3 UI pre-check semantics resolved with tests for current-location boundary checks and impassable adjacent world tiles. G4 remains open for README continuity.

Workflow gap review:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was read on 2026-06-18 and no workflow-level update was needed this iteration.
## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, agent identity/runtime surface, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers.

Required docs to account for before closeout:
- NORTH_STAR.md
- TRACKER.md
- GAPS.md
- COLD_START_AGENT_PROMPT.md
- DECISIONS.md
- AUDIT_OR_PROOF.md
- RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-12

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_iteration_ledger, missing_decisions_reference, missing_runbook_reference.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original compass-pane handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/compass-pane/NORTH_STAR.md
- docs/projects/compass-pane/TRACKER.md
- docs/projects/compass-pane/GAPS.md
- docs/projects/compass-pane/COLD_START_AGENT_PROMPT.md
- docs/projects/compass-pane/DECISIONS.md
- docs/projects/compass-pane/AUDIT_OR_PROOF.md
- docs/projects/compass-pane/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
