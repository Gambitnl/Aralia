# Crafting System Cold Start Agent Handoff

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
docs/projects/crafting/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Crafting System
Project folder: docs/projects/crafting
Iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crafting/NORTH_STAR.md
Tracker: docs/projects/crafting/TRACKER.md
Gaps: docs/projects/crafting/GAPS.md

Agent identity / runtime:
Next agent must identify its model and runtime surface before selecting work.
This handoff was refreshed from a Codex desktop foreman review after MCP
subagent Mill completed the G13 source pass.

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Mill / gpt-5.3-codex-spark high | MCP/subagent | certain | 2026-06-08 | Subagent completion notification `019ea7bb-81a9-7113-9692-65b27e500704` |

## Previous Agent Handoff

Iteration 3 closed G13 by adding `craftingCompatibility.ts` provenance fields
and focused compatibility tests. The pass preserved both craft engines, did not
move refining/enchanting UX ownership, and left G5 review-blocked.

## Current Mission

Active task:
T5 - Continue G1 compatibility regression hardening while preserving both
craft engines.

Acceptance criteria:
Expand the compatibility proof beyond the current provenance adapter without
deleting, merging, or replacing `craftingSystem.ts` or `craftingEngine.ts`.
Keep quality, material loss, time, gold, XP, and unavailable enhanced fields
explicit in tests and docs.

Key files to touch:
- docs/projects/crafting/NORTH_STAR.md
- docs/projects/crafting/TRACKER.md
- docs/projects/crafting/GAPS.md
- docs/projects/crafting/COLD_START_AGENT_PROMPT.md
- src/systems/crafting/craftingCompatibility.ts
- src/systems/crafting/__tests__/craftingCompatibility.test.ts
- Any additional source/docs named by the active tracker task

Scoped verification:
Run the focused compatibility tests and any adjacent crafting tests touched by
the change. Re-run dependency sync if exported signatures change.

Blocking dependencies / do-not-touch:
Do not advance G5 until a human/product decision places refining/enchanting in
a dedicated panel, an existing crafting tab, or a system-only lane. Stay inside
Crafting scope and route sibling-project blockers instead of editing their
docs.

Recent progress:
G13 now records legacy-result provenance with explicit unavailable enhanced
fields. Focused tests cover success/failure normalization and bidirectional
quality mapping. The dashboard schema reports Crafting as active and assignable;
G5 remains blocked by review.

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
