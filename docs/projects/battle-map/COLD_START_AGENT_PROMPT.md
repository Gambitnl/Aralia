---
schema_version: 1
handoff_type: agent_to_agent
project: Battle Map
slug: battle-map
Status: active
last_updated: 2026-06-10
iteration: 8
source_agent: Codex / gpt-5.4-mini high
target_agent: next cold-start agent
runtime_surface: MCP-subagent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/battle-map/NORTH_STAR.md
tracker: docs/projects/battle-map/TRACKER.md
gaps: docs/projects/battle-map/GAPS.md
---
# Battle Map Cold Start Agent Handoff

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
docs/projects/battle-map/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Battle Map
Project folder: docs/projects/battle-map
iteration: 8
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/battle-map/NORTH_STAR.md
Tracker: docs/projects/battle-map/TRACKER.md
Gaps: docs/projects/battle-map/GAPS.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | gpt-5.3-codex-spark high | MCP-subagent | certain | 2026-06-08 | Documented Battle Map map-state/events sync contract; no runtime files changed |
| 4 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Multi-agent worker fallback because gpt-5.3-codex-spark was at usage limit until 2026-06-08 21:03 |
| 5 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Multi-agent worker fallback because gpt-5.3-codex-spark remained over limit |
| 6 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Fallback while gpt-5.3-codex-spark remained over limit; documented the hook-shaped filename contract without renaming callers |
| 7 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Built the 2D/3D parity checklist and focused renderer proof, corrected stale tile selectors, and added the safe 3D lighting guard |
| 8 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker; elevated the Battle Map naming contract to review-required and added the Required Review Brief |

## Previous Agent Handoff

Iteration 3 completed T2 and closed the map-state/events sync contract. Iteration 4 split T3 into separate follow-up slices. Iteration 5 closed G2 by proving `ensureConnectivity()` now repairs disconnected cave/dungeon maps. Iteration 6 documented the `useBattleMapGeneration.ts` naming contract in source/docs without renaming callers, so G3 stayed a deliberate docs/naming follow-up. Iteration 7 recorded the parity checklist/proof gate, fixed stale tile-title assumptions in the 2D visibility tests, and added a null guard to the 3D lighting target so the renderer proof stays testable. Iteration 8 elevated the G3 naming choice to review-required with a Required Review Brief and kept the renderer parity gate unchanged. No broad renderer behavior expansion was made.

## Current Mission

Active task:
G3 - naming contract review gate; the helper stays hook-shaped until the decision brief is answered.

Acceptance criteria:
Keep the G3 naming contract explicit, keep the Required Review Brief current, and preserve the parity checklist as the gate before any renderer behavior expansion.

Key files to touch:
- docs/projects/battle-map/NORTH_STAR.md
- docs/projects/battle-map/TRACKER.md
- docs/projects/battle-map/GAPS.md
- docs/projects/battle-map/COLD_START_AGENT_PROMPT.md
- docs/projects/battle-map/PARITY_CHECKLIST.md
- src/hooks/useBattleMapGeneration.ts only if a coordinated rename is approved

Scoped verification:
Docs consistency sweep across the Battle Map handoff files plus `git diff --check`; no Battle Map runtime tests unless a rename is approved.

Blocking dependencies / do-not-touch:
Do not rename `useBattleMapGeneration.ts` blindly while callers exist. Do not expand renderer behavior unless the parity checklist is refreshed first. Route sibling-project blockers instead of editing their docs.

Required-review handling:
If this iteration discovers a human/product/policy blocker, mark the project review-required only after creating or refreshing a `Required Review Brief` in `NORTH_STAR.md`, `TRACKER.md`, or `GAPS.md`. That brief is the project-detail visual decision segment; include the decision question, issue, current behavior, blocked reason, options, evidence, decision owner, and proof-after-decision. Once marked review-required, do not assign forward implementation agents until the decision is recorded.

Recent progress:
T2 closed as a documentation-only pass. T3 remains the split decision boundary. G2 is closed with a focused seed-2 reachability/pathability regression. G3 is now review-required, with the `useBattleMapGeneration.ts` naming contract explicit in source/docs and the Required Review Brief carrying the decision. G4 now has a concrete parity checklist plus focused renderer tests, and the older visibility checks were updated to match the actual tile labels. Workflow gaps were re-read with no workflow-level update needed. The dashboard card schema stayed on the supported section-based path. No broad renderer behavior expansion was made.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers. Keep the iteration agent ledger as one compact row per completed iteration; do not preserve old handoff transcripts in this file.
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-10

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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original battle-map handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/battle-map/NORTH_STAR.md
- docs/projects/battle-map/TRACKER.md
- docs/projects/battle-map/GAPS.md
- docs/projects/battle-map/COLD_START_AGENT_PROMPT.md
- docs/projects/battle-map/DECISIONS.md
- docs/projects/battle-map/AUDIT_OR_PROOF.md
- docs/projects/battle-map/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
