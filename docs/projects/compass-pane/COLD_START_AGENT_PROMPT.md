---
schema_version: 1
handoff_type: agent_to_agent
project: Compass Pane
slug: compass-pane
status: active
last_updated: 2026-06-24
iteration: 6
source_agent: Codex application agent
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
Last updated: 2026-06-20

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
iteration: 7
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/compass-pane/NORTH_STAR.md
Tracker: docs/projects/compass-pane/TRACKER.md
Gaps: docs/projects/compass-pane/GAPS.md

## Iteration Ledger

| Iteration | Agent / Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Amazon Q MCP subagent | MCP-subagent | certain | 2026-06-19 | Amazon Q in IDE via MCP protocol |
| 4 | Kilo / kilo/kilo-auto/free | CLI agent | certain | 2026-06-18 | Direct CLI/tool session in F:\Repos\Aralia |
| 5 | Qoder CLI | CLI agent | certain | 2026-06-20 | Direct CLI session in F:\Repos\Aralia |
| 6 | Codex application agent | application agent | certain | 2026-06-24 | Direct Codex app session in F:\Repos\Aralia |

## Previous Iteration Summary

T6 is complete. G5 context-aware toggle coverage was resolved by restoring the missing main-context submap toggle and adding regression tests for both Compass Pane contexts. The main exploration context now proves world-map, submap, and 3D toggles are visible; the submap context proves world-map remains visible while submap/3D toggles are hidden. The restored submap toggle dispatches the existing `toggle_submap_visibility` action. Scoped Compass Pane tests passed with 8 tests.

## Current Mission

Active task:
No active Compass Pane implementation gap is currently open.

Acceptance criteria:
Run a fresh source-backed gap scan before assigning more Compass Pane work. Do not reopen G5 unless context-toggle behavior changes or the regression proof is invalidated.

Key files to inspect first:
- `docs/projects/compass-pane/NORTH_STAR.md`
- `docs/projects/compass-pane/TRACKER.md`
- `docs/projects/compass-pane/GAPS.md`
- `docs/projects/compass-pane/AUDIT_OR_PROOF.md`
- `src/components/CompassPane/index.tsx`
- `src/components/CompassPane/__tests__/CompassPane.test.tsx`

Scoped verification:
`npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx`

Blocking dependencies / do-not-touch:
No blocker currently. Stay inside Compass Pane scope and do not widen into unrelated UI refactors. Use the existing local checkout unless the operator explicitly allows worktrees or branches.

Recent progress:
T3 navigation affordances validated and G1 resolved. G3 UI pre-check semantics resolved with tests. G4 documentation continuity resolved (README verified synced to source). G6 stale JSDoc resolved. G5 context-toggle regression coverage resolved. Compass Pane currently has zero open project-owned gaps.

Workflow gap review:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was not re-read this iteration; no workflow-level update needed.
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

Last updated: 2026-06-20

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
