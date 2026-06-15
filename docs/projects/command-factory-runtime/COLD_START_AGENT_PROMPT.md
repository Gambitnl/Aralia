---
schema_version: 1
handoff_type: agent_to_agent
project: Command Factory Runtime
slug: command-factory-runtime
status: active
last_updated: 2026-06-14
iteration: 4
source_agent: Antigravity / Gemini 3.5 Flash (Medium)
target_agent: next cold-start agent
runtime_surface: MCP-subagent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/command-factory-runtime/NORTH_STAR.md
tracker: docs/projects/command-factory-runtime/TRACKER.md
gaps: docs/projects/command-factory-runtime/GAPS.md
---
# Command Factory Runtime Cold Start Agent Handoff

Status: active
Last updated: 2026-06-14

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/command-factory-runtime/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Command Factory Runtime
Project folder: docs/projects/command-factory-runtime
iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/command-factory-runtime/NORTH_STAR.md
Tracker: docs/projects/command-factory-runtime/TRACKER.md
Gaps: docs/projects/command-factory-runtime/GAPS.md

## Iteration Ledger

| Iteration | Agent / model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker |
| 3 | Antigravity / Gemini 3.5 Flash (Medium) | MCP-subagent | certain | 2026-06-14 | Spawned by the foreman as a bounded living-project iteration worker |

## Previous Handoff

Iteration 3 redirected the last internal caller of the deprecated `SpellCommandFactory.matchesFilter` wrapper to target the shared `TargetValidationUtils.matchesFilter` directly. Gap `G2` was marked closed, and two new gaps (`G5` - split mapping pathways, `G6` - co-located WeaponAttackCommand implementation) were registered in `GAPS.md`.

## Current Mission

Active task:
None - select next actionable gap from `GAPS.md` (G1 is currently in_scope_now)

Acceptance criteria:
Select next actionable gap (such as G1) from `GAPS.md`, perform research, implementation, and verify using Vitest.

Key files to touch:
- docs/projects/command-factory-runtime/NORTH_STAR.md
- docs/projects/command-factory-runtime/TRACKER.md
- docs/projects/command-factory-runtime/GAPS.md
- docs/projects/command-factory-runtime/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use `vitest run src/commands/factory` to verify factory behavior.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs.

Recent progress:
SpellCommandFactory.ts no longer calls its deprecated matchesFilter wrapper internally. Gap G2 has been closed. Gaps G5 and G6 were registered.

Workflow-gap review result:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was read and found to have no active workflow gaps; no changes were made.

Dashboard schema updates:
`NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` were refreshed to reflect the resolution of G2, addition of G5/G6, and current iteration metadata.

Optional docs:
`DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md` are not present for this project yet, so they were not needed this iteration.

Next safe resume path:
Confirm existing registry patterns in `src/commands/index.ts` and `hooks/useAbilitySystem.ts`, then design the explicit command registration registry for G1.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

Final response must report:
- files updated
- files intentionally not updated
- verification performed or skipped
- bounded gap sweep surfaces checked
- project gaps recorded
- workflow gaps read or updated
- dashboard schema fields updated
- required docs accounted for
- optional docs touched, skipped, or not present
- documentation compaction performed or not needed
- agent comments added or intentionally left empty
- assumptions made
- next safe resume action
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-14

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_iteration_ledger.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original command-factory-runtime handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/command-factory-runtime/NORTH_STAR.md
- docs/projects/command-factory-runtime/TRACKER.md
- docs/projects/command-factory-runtime/GAPS.md
- docs/projects/command-factory-runtime/COLD_START_AGENT_PROMPT.md
- docs/projects/command-factory-runtime/DECISIONS.md
- docs/projects/command-factory-runtime/AUDIT_OR_PROOF.md
- docs/projects/command-factory-runtime/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
