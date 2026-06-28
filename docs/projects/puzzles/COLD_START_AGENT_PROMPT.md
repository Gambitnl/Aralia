---
schema_version: 1
handoff_type: agent_to_agent
project: Puzzles System
slug: puzzles
status: active
last_updated: 2026-06-27
iteration: 9
source_agent: Codex app lane / coordinator
target_agent: next cold-start agent
runtime_surface: Codex app thread
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/puzzles/NORTH_STAR.md
tracker: docs/projects/puzzles/TRACKER.md
gaps: docs/projects/puzzles/GAPS.md
---
# Puzzles System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-27

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/puzzles/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Puzzles System
Project folder: docs/projects/puzzles
iteration: 9
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/puzzles/NORTH_STAR.md
Tracker: docs/projects/puzzles/TRACKER.md
Gaps: docs/projects/puzzles/GAPS.md

## Iteration Ledger

| Iteration | Agent / Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Codex / gpt-5.3-codex-spark high | MCP-subagent | certain | 2026-06-09 | Sub-agent final receipt |
| 4 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Sub-agent final receipt |
| 5 | Schrodinger / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Subagent completion notification `019eaa3b-2e4b-77e3-90a6-38842e8af280` |
| 6 | Codex / GPT-5 | application agent | certain | 2026-06-27 | PZ-007 runtime surface implementation in local lane |
| 7 | Codex / GPT-5 | Codex app lane thread | certain | 2026-06-27 | PZ-003 key runtime contract implementation in local lane |
| 8 | Codex / GPT-5 | Codex app lane thread | certain | 2026-06-27 | PZ-004 runtime stat bridge implementation in local lane |

## Previous Agent Handoff

Iteration 2 completed `T2`: first production lockpicking dispatch from a real world location lock feature:
- Added cave entrance `interactableFeatures` lock contract in `src/data/world/locations.ts`
- Emitted `OPEN_LOCKPICKING_MODAL` from `src/components/ActionPane/useActionGeneration.ts`
- Routed action handling in `src/hooks/actions/actionHandlers.ts`
- Added `src/components/ActionPane/__tests__/ActionPane.test.tsx` lock action assertion

## Current Mission

Active task:
`T4` / `PZ-007`, `T5` / `PZ-003`, and `T6` / `PZ-004` are done. The next safe task is one of the remaining open gaps: `PZ-005` map/BattleMap integration, `PZ-006` skill challenge host ownership, or `G6` authored puzzle registry discovery. Keep those slices separate unless the coordinator explicitly joins them.

Acceptance criteria:
Use `docs/projects/puzzles/TRACKER.md`, `NORTH_STAR.md`, and `GAPS.md` as your live queue. Do not reopen PZ-003 or PZ-004 unless a caller integration needs them: deterministic key matching is puzzle-runtime owned through caller-supplied key ids, and puzzle runtime stat checks are modern-first through `getPuzzleCharacterStats`.

Key files to touch:
- docs/projects/puzzles/NORTH_STAR.md
- docs/projects/puzzles/TRACKER.md
- docs/projects/puzzles/GAPS.md
- docs/projects/puzzles/COLD_START_AGENT_PROMPT.md
- docs/projects/puzzles/AUDIT_OR_PROOF.md
- docs/projects/puzzles/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- source files named by the selected remaining gap
- nearby focused tests for the selected remaining gap

Scoped verification:
Use the scoped verification named by the active tracker row plus these proofs:
- Focused tests for the selected PZ-005/PZ-006/G6 slice
- Existing PZ-007 tests if the runtime surface is touched: `src/systems/puzzles/__tests__/puzzleRuntime.test.ts`, `src/components/puzzles/PuzzleRuntimeModal.test.tsx`, `src/components/ActionPane/__tests__/ActionPane.test.tsx`
- Existing PZ-004 tests if runtime stat resolution is touched: `src/systems/puzzles/__tests__/lockSystem.test.ts`, plus affected puzzle runtime tests
- `docs/projects/puzzles/NORTH_STAR.md`
- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`
- `docs/projects/puzzles/AUDIT_OR_PROOF.md`

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
- `T3` completed; `getPuzzleHint` now resolves a live Intelligence check.
- `PZ-002` is resolved at the helper layer.
- `PZ-007` is resolved: `PuzzleRuntimeModal` owns a live `Puzzle`, `requestPuzzleHint` wraps `getPuzzleHint`, and `cave_chamber.interactableFeatures[].type === 'puzzle'` routes into `OPEN_PUZZLE_RUNTIME`.
- `PZ-003` is resolved at the puzzle-runtime contract layer: `attemptKeyUnlock` accepts caller-supplied key ids and compares them deterministically to `Lock.keyId`; inventory/economy sourcing and visible modal key-use remain future bounded slices.
- `PZ-004` is resolved at the puzzle-runtime stat bridge layer: `getPuzzleCharacterStats` prefers `finalAbilityScores`, then `abilityScores`, and uses `character.stats` only as compatibility fallback.
- `docs/projects/puzzles/NORTH_STAR.md`, `docs/projects/puzzles/TRACKER.md`, `docs/projects/puzzles/GAPS.md`, `docs/projects/puzzles/AUDIT_OR_PROOF.md`, and `docs/projects/puzzles/RUNBOOK.md` have been kept aligned.

## Required End State For This Iteration

Before ending, update:
- this handoff file with next iteration context,
- all required docs above,
- `AUDIT_OR_PROOF.md` and `RUNBOOK.md` with what was done and why, and `DECISIONS.md` only if a new decision was introduced,
- and keep only the current handoff block; do not keep historical handoff transcripts in this file.

## Workflow Gap Review

Read: `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`
Update needed: none for this iteration.

## Next Safe Resume Action

Continue with `PZ-005`, `PZ-006`, or `G6` in `docs/projects/puzzles/GAPS.md`, based on coordinator priority. Preserve the resolved PZ-003 and PZ-004 contracts instead of redefining key matching or stat-source ownership.

## agent_comments

agent_comments: ""
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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original puzzles handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/puzzles/NORTH_STAR.md
- docs/projects/puzzles/TRACKER.md
- docs/projects/puzzles/GAPS.md
- docs/projects/puzzles/COLD_START_AGENT_PROMPT.md
- docs/projects/puzzles/DECISIONS.md
- docs/projects/puzzles/AUDIT_OR_PROOF.md
- docs/projects/puzzles/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
