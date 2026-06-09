# Economy System Cold Start Agent Handoff

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
docs/projects/economy/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Economy System
Project folder: docs/projects/economy
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/economy/NORTH_STAR.md
Tracker: docs/projects/economy/TRACKER.md
Gaps: docs/projects/economy/GAPS.md

Agent identity / runtime:
Next agent must identify its model and runtime surface before selecting work.
This handoff was refreshed from a Codex desktop foreman review after MCP
subagent Goodall completed the G1 event-typing pass.

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Goodall / gpt-5.3-codex-spark high | MCP/subagent | certain | 2026-06-08 | Subagent completion notification `019ea7bb-28ae-7921-a301-b8c832c7446a` |

## Previous Agent Handoff

Iteration 2 closed G1 by promoting active economy events to `MarketEvent[]`,
adding explicit route-event tags, deriving market factors through shared
helpers, and preserving legacy name parsing only as a fallback. The same
iteration also left T2-T5/G2-G5 documented as complete from the 2026-06-08
economy pass.

## Current Mission

Active task:
No open Economy implementation gap is currently registered.

Acceptance criteria:
Before assigning another implementation pass, run a fresh source-backed scan of
new or weakly typed economy event sources. If a real gap is found, add it to
GAPS.md and select a narrow proof. If no source-backed gap is found, leave
Economy unassigned and preserve the completed G1-G5 state.

Key files to touch:
- docs/projects/economy/NORTH_STAR.md
- docs/projects/economy/TRACKER.md
- docs/projects/economy/GAPS.md
- docs/projects/economy/COLD_START_AGENT_PROMPT.md
- docs/projects/economy/AUDIT_OR_PROOF.md
- Any source/docs named by a newly discovered, source-backed economy gap

Scoped verification:
For contract-parity work, run the focused TradeRouteManager, economyUtils, and
MerchantModal checks already named in TRACKER.md/AUDIT_OR_PROOF.md. Re-run the
dependency visualizer sync for touched economy types, utils, systems, or UI
entry files.

Blocking dependencies / do-not-touch:
Do not add speculative market features just to keep Economy moving. Stay inside
Economy scope, preserve active event parity, and route sibling-project blockers
instead of editing their docs.

Recent progress:
G1-G5 are marked done. `AUDIT_OR_PROOF.md` now holds the durable audit proof,
and focused tests cover route status transitions, typed event tags, market
factor projection, typed pricing application, and MerchantModal event rendering.

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
