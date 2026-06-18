---
schema_version: 1
handoff_type: agent_to_agent
project: Crafting UI
slug: crafting-ui
status: active
last_updated: 2026-06-17
iteration: 4
source_agent: Qoder CLI
target_agent: next cold-start agent
runtime_surface: CLI agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/crafting-ui/NORTH_STAR.md
tracker: docs/projects/crafting-ui/TRACKER.md
gaps: docs/projects/crafting-ui/GAPS.md
---
# Crafting UI Cold Start Agent Handoff

Status: active
Last updated: 2026-06-17

This file is the project-specific context package and directive checklist for
the next cold-start agent. It does not duplicate the full workflow rules. The
agent must follow the shared workflow file and use this file for current
project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/crafting-ui/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent / model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original crafting-ui handoff predates the ledger requirement. |
| 3 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | `src/components/Crafting/crafterAdapter.ts` plus Crafting UI panel tests now back the shared crafter boundary |
| 4 | Qoder CLI | CLI agent | certain | 2026-06-17 | Qoder CLI shell session on win32 |

---BEGIN NEXT AGENT HANDOFF---
Project: Crafting UI
Project folder: docs/projects/crafting-ui
iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crafting-ui/NORTH_STAR.md
Tracker: docs/projects/crafting-ui/TRACKER.md
Gaps: docs/projects/crafting-ui/GAPS.md

## Previous Agent Context

Iteration 4 (Qoder CLI, 2026-06-17) executed T2 and defined the next
implementation slice boundary. Key finding: G3 (experiment damage) was
already resolved in source — `ExperimentPanel.tsx` dispatches
`MODIFY_PARTY_HEALTH` through the shared party-health reducer, proven by
`ExperimentPanel.test.tsx`. The gap was stale docs, not stale code.
Decision recorded in DECISIONS.md D-002: next slice is G2+G5
(typing + reducer proof). G7 opened for stats dispatch coverage gap.

## Current Mission

Active task:
Implement G2+G5 as a single slice: tighten `UPDATE_CRAFTING_STATS` payload
typing and add `craftingReducer.test.ts`.

Acceptance criteria:
Define `CraftingQuality` and `CraftingCategory` type unions in `types/crafting.ts`.
Update `actionTypes.ts` payload. Add reducer test covering ruined, standard,
masterwork, legendary, nat20, and category-count branches. `npm run typecheck`
and `npm run test` must pass.

Key files to touch:
- `src/types/crafting.ts`
- `src/state/actionTypes.ts`
- `src/state/reducers/craftingReducer.ts`
- `src/state/reducers/__tests__/craftingReducer.test.ts` (new)
- `src/components/Crafting/AlchemyBenchPanel.tsx` (dispatch site)
- `docs/projects/crafting-ui/NORTH_STAR.md`
- `docs/projects/crafting-ui/TRACKER.md`
- `docs/projects/crafting-ui/GAPS.md`
- `docs/projects/crafting-ui/COLD_START_AGENT_PROMPT.md`
- `docs/projects/crafting-ui/DECISIONS.md`
- `docs/projects/crafting-ui/AUDIT_OR_PROOF.md`
- `docs/projects/crafting-ui/RUNBOOK.md`
- `docs/projects/PROJECT_CARD_SCHEMA.md`
- `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`

Scoped verification:
`npm run typecheck` and
`npm run test -- --run src/state/reducers/__tests__/craftingReducer.test.ts`.
After implementation, also run the existing crafting panel tests to confirm
no regressions.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not widen into G4
(windowing), G6 (modularization), or G7 (stats dispatch coverage) unless
a typing change forces it. Route sibling-project blockers instead of
editing their docs.

Recent progress:
T2 closed with evidence-backed boundary definition. G3 resolved (source
moved ahead of docs). G2+G5 defined as next implementation slice. G7 opened
for stats dispatch coverage. North Star, tracker, gaps, decisions, and
audit docs all refreshed. 5 open gaps remain: G2, G4, G5, G6, G7.

Workflow gap review:
Read `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
No active workflow gaps. No new workflow-level ambiguity found.

Optional docs:
- `DECISIONS.md` updated with D-002 (next-slice scope decision).
- `AUDIT_OR_PROOF.md` updated with G3 resolution proof and T2 boundary scan.
- `RUNBOOK.md` still current for verification commands.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, agent identity/runtime surface, active task, acceptance
criteria, key files, verification method, blockers, recent progress,
workflow-gap review result, and dashboard-schema updates. Account for every
required doc, mention optional docs touched or skipped, update
`agent_comments` only when an out-of-flow note is useful, and keep only the
current handoff between the same BEGIN/END markers.

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

Last updated: 2026-06-17

This section aligns older cold-start prompts with the shared living-project
workflow without replacing the project-specific handoff above. The original
handoff remains authoritative for project context; this section records the
universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_iteration_ledger.
Conformance issues repaired on 2026-06-17: ledger row added for iteration 4.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running
through. Use one of: CLI agent, application agent, browser/app-embedded
agent, MCP/subagent, or unknown. Mark the classification as certain,
inferred, or unknown and name the clue used.

### Required project docs to account for

- docs/projects/crafting-ui/NORTH_STAR.md
- docs/projects/crafting-ui/TRACKER.md
- docs/projects/crafting-ui/GAPS.md
- docs/projects/crafting-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/crafting-ui/DECISIONS.md
- docs/projects/crafting-ui/AUDIT_OR_PROOF.md
- docs/projects/crafting-ui/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required
project doc above. If a supporting doc is not relevant to the current slice,
say why instead of silently ignoring it.
