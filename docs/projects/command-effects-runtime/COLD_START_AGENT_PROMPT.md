---
schema_version: 1
handoff_type: agent_to_agent
project: Command Effects Runtime
slug: command-effects-runtime
Status: active
last_updated: 2026-06-10
iteration: 5
source_agent: Russell / gpt-5.4-mini high
target_agent: next cold-start agent
runtime_surface: "MCP-subagent + source-context review"
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/command-effects-runtime/NORTH_STAR.md
tracker: docs/projects/command-effects-runtime/TRACKER.md
gaps: docs/projects/command-effects-runtime/GAPS.md
---
# Command Effects Runtime Cold Start Agent Handoff

Status: active
Last updated: 2026-06-10

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/command-effects-runtime/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Codex desktop context with sub-agent repo access |
| 3 | Rawls / gpt-5.4-mini high | MCP-subagent + local foreman verification | certain | 2026-06-09 | Closed G4 by keeping teleport ability effects on the `AbilityCommandFactory` -> `MovementCommand` path; G1 remained active. |
| 4 | Russell / gpt-5.4-mini high | MCP-subagent + source-context review | certain | 2026-06-09 | Source inspection found no safe delegated payload source in command context or game state, so G1 moved to review-required. |

---BEGIN NEXT AGENT HANDOFF---
Project: Command Effects Runtime
Project folder: docs/projects/command-effects-runtime
iteration: 5
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/command-effects-runtime/NORTH_STAR.md
Tracker: docs/projects/command-effects-runtime/TRACKER.md
Gaps: docs/projects/command-effects-runtime/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial handoff surface. Iteration 2 resolved the
teleport budget metadata gap in `MovementCommand`. Iteration 3 resolved G4 by
keeping teleport ability effects on the `AbilityCommandFactory` to
`MovementCommand` path. Iteration 4 reviewed the reactive trigger path and
confirmed there is no safe delegated payload source in `CommandContext` or
`GameState`, so G1 is now review-required instead of implementation-ready.

## Current Mission

Active task:
Keep the review brief current, preserve the G1 blocker in docs, and do not
resume forward implementation until the delegated payload owner has been
decided.

Key files to touch:
- docs/projects/command-effects-runtime/NORTH_STAR.md
- docs/projects/command-effects-runtime/TRACKER.md
- docs/projects/command-effects-runtime/GAPS.md
- docs/projects/command-effects-runtime/COLD_START_AGENT_PROMPT.md
- docs/projects/command-effects-runtime/DECISIONS.md
- docs/projects/command-effects-runtime/AUDIT_OR_PROOF.md
- docs/projects/command-effects-runtime/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- src/commands/effects/ReactiveEffectCommand.ts
- src/commands/base/SpellCommand.ts
- src/hooks/combat/useActionExecutor.ts
- src/types/state.ts

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Run `node scripts/audit-living-project-docs.cjs` and `git diff --check` on the
updated docs. Do not run implementation tests until the review decision is
recorded and the payload owner is approved.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not add a delegated payload
bridge or synthetic registry until the Required Review Brief is answered.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, and GAPS.md as the current source of truth.
G2 and G4 remain resolved in `GAPS.md`; G1 is now review-required because the
command layer has no safe delegated payload source-of-truth. Supporting docs
`DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md` now carry the same gate,
and `WORKFLOW_GAPS.md` was read and left unchanged. The `agent_comments` note in
`NORTH_STAR.md` is intentionally occupied by the blocker so the next agent sees
the ownership issue immediately.

## Required End State For This Iteration

Before ending, keep the current handoff between the same BEGIN/END markers,
refresh the Required Review Brief if the blocker wording changes, and report
the following in the final response:
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

Last updated: 2026-06-10

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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original command-effects-runtime handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/command-effects-runtime/NORTH_STAR.md
- docs/projects/command-effects-runtime/TRACKER.md
- docs/projects/command-effects-runtime/GAPS.md
- docs/projects/command-effects-runtime/COLD_START_AGENT_PROMPT.md
- docs/projects/command-effects-runtime/DECISIONS.md
- docs/projects/command-effects-runtime/AUDIT_OR_PROOF.md
- docs/projects/command-effects-runtime/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
