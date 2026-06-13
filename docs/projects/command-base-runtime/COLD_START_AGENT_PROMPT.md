---
schema_version: 1
handoff_type: agent_to_agent
project: Command Base Runtime
slug: command-base-runtime
status: idle
last_updated: 2026-06-12
iteration: 4
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/command-base-runtime/NORTH_STAR.md
tracker: docs/projects/command-base-runtime/TRACKER.md
gaps: docs/projects/command-base-runtime/GAPS.md
---
# Command Base Runtime Cold Start Agent Handoff

status: idle
Last updated: 2026-06-12
This is the project-specific context packet. Follow the shared workflow file for iteration process and include workflow gaps in closeout reporting.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
Project entry point: docs/projects/command-base-runtime/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |

---BEGIN NEXT AGENT HANDOFF---
Project: Command Base Runtime
Project folder: docs/projects/command-base-runtime
Iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/command-base-runtime/NORTH_STAR.md
Tracker: docs/projects/command-base-runtime/TRACKER.md
Gaps: docs/projects/command-base-runtime/GAPS.md

## Previous Agent Handoff

Iteration 3 established and recorded rollback policy (`T3`): `executeWithRollback` is not the
production execution path; `CommandExecutor.execute` is the default.

## Current Mission

Active task completed:
T4 â€” Expand `CommandExecutor.execute` failure-path tests (G3)

Acceptance criteria completed:
- Async failure path tested (promise rejection).
- Partial execution state returned when a later command fails.
- Failed command and error reporting asserted.
- Initial state snapshot preserved / not mutated by failure path.

## Evidence

- `src/commands/__tests__/CommandExecutor.test.ts` now includes 4 focused tests.
- Verification command run: `npx vitest run src/commands/__tests__/CommandExecutor.test.ts` (pass).
- `docs/projects/command-base-runtime/TRACKER.md` and `GAPS.md` updated to `done` for `T4`/`G3`.

## Next Task

T5 â€” Add an explicit state-freshness contract for context-vs-live reads (`G4`) and any minimal focused proof needed.

## Required End State For This Iteration

- `G4` is either closed with evidence or narrowed into a sharper remaining gap.
- The command context freshness contract is documented in the project docs.
- Any source/test change stays inside the command-base-runtime surface unless a real integration dependency is discovered.
- New project or global gaps are added only when the iteration finds concrete missing work.

## Required Files

- `docs/projects/command-base-runtime/NORTH_STAR.md`
- `docs/projects/command-base-runtime/TRACKER.md`
- `docs/projects/command-base-runtime/GAPS.md`
- `docs/projects/command-base-runtime/COLD_START_AGENT_PROMPT.md`
- `src/commands/__tests__/CommandExecutor.test.ts`

## agent_comments

- No active inline agent comments are carried into the next iteration.
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

Conformance issues repaired on 2026-06-12: missing_decisions_reference, missing_proof_reference, missing_runbook_reference.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original command-base-runtime handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/command-base-runtime/NORTH_STAR.md
- docs/projects/command-base-runtime/TRACKER.md
- docs/projects/command-base-runtime/GAPS.md
- docs/projects/command-base-runtime/COLD_START_AGENT_PROMPT.md
- docs/projects/command-base-runtime/DECISIONS.md
- docs/projects/command-base-runtime/AUDIT_OR_PROOF.md
- docs/projects/command-base-runtime/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
