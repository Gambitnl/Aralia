# Crafting System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-09

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/crafting/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Crafting System
Project folder: docs/projects/crafting
Iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crafting/NORTH_STAR.md
Tracker: docs/projects/crafting/TRACKER.md
Gaps: docs/projects/crafting/GAPS.md

Agent identity / runtime:
Next agent must identify its model and runtime surface before selecting work.
This handoff was refreshed from a Codex desktop foreman review after the G1
compatibility proof closed and the Crafting living-project docs stayed schema-valid.

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Mill / gpt-5.3-codex-spark high | MCP/subagent | certain | 2026-06-08 | Subagent completion notification `019ea7bb-81a9-7113-9692-65b27e500704` |
| 4 | Codex desktop foreman / gpt-5 | desktop | certain | 2026-06-09 | Crafting G1 compatibility proof closure, schema-valid North Star refresh, focused test run, and living-project audit |

## Previous Agent Handoff

Iteration 4 broadened G1 compatibility proof with explicit success/failure
normalization, full quality-matrix coverage, and an audit-backed schema-valid
Crafting North Star. Iteration 5 closed that proof with stable side-effect
field coverage and the unavailable enhanced field list. The pass preserved both
craft engines, did not move refining/enchanting UX ownership, and left G5 blocked.

## Current Mission

Active task:
None for G1. Preserve both craft engines, keep G5 blocked, and wait for the
next evidence-backed Crafting gap before changing implementation.

Acceptance criteria:
Do not delete, merge, or replace `craftingSystem.ts` or `craftingEngine.ts`.
Keep the Crafting living-project schema valid and keep the dashboard card
aligned with the current proof state. Preserve the closed G1 compatibility
contract unless new evidence reopens it.

Key files to touch:
- docs/projects/crafting/NORTH_STAR.md
- docs/projects/crafting/TRACKER.md
- docs/projects/crafting/GAPS.md
- docs/projects/crafting/COLD_START_AGENT_PROMPT.md
- src/systems/crafting/craftingCompatibility.ts
- src/systems/crafting/__tests__/craftingCompatibility.test.ts
- Any additional source/docs named by the active tracker task

Scoped verification:
Run the focused compatibility tests, the living-project schema audit, and any
adjacent crafting tests touched by the change. Re-run dependency sync if
exported signatures change.

Blocking dependencies / do-not-touch:
Do not advance G5 until a human/product decision places refining/enchanting in
a dedicated panel, an existing crafting tab, or a system-only lane. Stay inside
Crafting scope and route sibling-project blockers instead of editing their
docs.

Recent progress:
G13 now records legacy-result provenance with explicit unavailable enhanced
fields. Focused tests now cover success/failure normalization, bidirectional
quality mapping, stable side-effect fields, and a stable unavailable-field
list. The Crafting North Star is schema-valid, the dashboard card reflects the
closed G1 proof, and G5 remains blocked by review.

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
