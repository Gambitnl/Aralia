---
schema_version: 1
handoff_type: agent_to_agent
project: Economy UI
slug: economy-ui
Status: active
last_updated: 2026-06-10
iteration: 6
source_agent: Claude Opus 4.6 (Thinking) / Antigravity CLI
target_agent: next cold-start agent
runtime_surface: application agent (Antigravity CLI in VS Code)
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/economy-ui/NORTH_STAR.md
tracker: docs/projects/economy-ui/TRACKER.md
gaps: docs/projects/economy-ui/GAPS.md
---
# Economy UI Cold Start Agent Handoff

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
docs/projects/economy-ui/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 5 | Kuhn / gpt-5.4-mini high | MCP-subagent docs-only contract pass | certain | 2026-06-09 | Closed G3 by documenting reducer visibility ownership without migrating source flags. |
| 6 | Claude Opus 4.6 (Thinking) / Antigravity CLI | application agent (Antigravity CLI in VS Code) | certain | 2026-06-10 | Normalized duplicate tables in TRACKER/GAPS, ran full source audit, registered G4-G7 from bounded gap sweep. |

---BEGIN NEXT AGENT HANDOFF---
Project: Economy UI
Project folder: docs/projects/economy-ui
iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/economy-ui/NORTH_STAR.md
Tracker: docs/projects/economy-ui/TRACKER.md
Gaps: docs/projects/economy-ui/GAPS.md

## Previous Agent Context

Iteration 6 normalized the duplicate table structures in TRACKER.md and GAPS.md
that were left by a prior schema-normalization template append. A full source
audit confirmed all economy UI files match the documented file map and that the
reducer ownership split is correctly implemented. The bounded gap sweep
discovered three new real gaps (G4, G6, G7) beyond the structural debt (G5,
now resolved).

## Current Mission

Active task:
G6 (in_scope_now): Add `isTradeRouteDashboardVisible` to the Escape key
handler chain in `GameModals.tsx` and verify with a focused test.

Secondary candidates:
- G7 (adjacent_follow_up): Add `TOGGLE_INVESTMENT_BOARD` to `actionTypes.d.ts`.
- G4 (adjacent_follow_up): Define player-facing entry points for economy modals
  (only when a product pass requests this).

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. G6 requires pressing Escape while TradeRouteDashboard is open
to dispatch `TOGGLE_TRADE_ROUTE_DASHBOARD` and close the modal. G7 requires
`actionTypes.d.ts` to include `TOGGLE_INVESTMENT_BOARD`.

Key files to touch:
- src/components/layout/GameModals.tsx (G6 escape chain fix)
- src/state/actionTypes.d.ts (G7 type declaration)
- src/components/layout/__tests__/GameModals.test.tsx (G6 proof)
- docs/projects/economy-ui/NORTH_STAR.md
- docs/projects/economy-ui/TRACKER.md
- docs/projects/economy-ui/GAPS.md
- docs/projects/economy-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/economy-ui/AUDIT_OR_PROOF.md

Scoped verification:
Run focused tests for GameModals Escape handler. Verify `tsc --noEmit` passes
after actionTypes.d.ts update. Use `git diff --check` on touched docs.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not modify reducer ownership.
Route sibling-project blockers instead of editing their docs.

Recent progress:
T5 merged the two duplicate Active Task Queue tables, two Gap Log tables, two
Classification Reference sections, and two Status Vocabulary sections into
single canonical tables. Source audit confirmed all economy UI source files
exist and match the documented file map with no dead flags or orphaned actions.
G4 (missing player-facing entry points), G5 (duplicate tables, now resolved),
G6 (Escape key chain gap), and G7 (actionTypes.d.ts drift) were registered
from the bounded gap sweep.

Workflow-gap review:
- Reviewed `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
- No active workflow gaps. WFG-001 remains resolved.
- No new project-specific workflow blocker surfaced for this pass.

Dashboard schema updates:
- `docs/projects/economy-ui/NORTH_STAR.md` carries valid schema frontmatter.
- `gap_signal` now reports `3 open gaps (G4 player-facing entry, G6 escape chain, G7 type drift)`.
- `required_docs` includes `DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md`.
- `agent_comments` is intentionally empty.
- `last_updated`, `last_proof`, `workflow_gaps_reviewed` set to 2026-06-10.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, recent progress, workflow-gap review result, and
dashboard-schema updates. Account for every required doc, mention optional docs
touched or skipped, update `agent_comments` only when an out-of-flow note is
useful, and keep only the current handoff between the same BEGIN/END markers;
do not preserve old handoff transcripts in this file.

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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original economy-ui handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/economy-ui/NORTH_STAR.md
- docs/projects/economy-ui/TRACKER.md
- docs/projects/economy-ui/GAPS.md
- docs/projects/economy-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/economy-ui/DECISIONS.md
- docs/projects/economy-ui/AUDIT_OR_PROOF.md
- docs/projects/economy-ui/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
