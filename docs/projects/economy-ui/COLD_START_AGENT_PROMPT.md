# Economy UI Cold Start Agent Handoff

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
docs/projects/economy-ui/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 5 | Kuhn / gpt-5.4-mini high | MCP-subagent docs-only contract pass | certain | 2026-06-09 | Closed G3 by documenting reducer visibility ownership without migrating source flags. |

---BEGIN NEXT AGENT HANDOFF---
Project: Economy UI
Project folder: docs/projects/economy-ui
Iteration: 5
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/economy-ui/NORTH_STAR.md
Tracker: docs/projects/economy-ui/TRACKER.md
Gaps: docs/projects/economy-ui/GAPS.md

## Previous Agent Context

Iteration 4 closed the visibility ownership gap as a docs-only contract. The
economy UI packet now records the stable reducer split and keeps the modal host
wiring intact.

## Current Mission

Active task:
None. Preserve the documented ownership contract and only reopen if a future
reducer migration is explicitly approved.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. Keep the reducer split documented and stable, preserve the
working modal mounts and action dispatch paths already in place, and do not
move visibility flags between reducers in this pass.

Key files to touch:
- docs/projects/economy-ui/NORTH_STAR.md
- docs/projects/economy-ui/TRACKER.md
- docs/projects/economy-ui/GAPS.md
- docs/projects/economy-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/economy-ui/DECISIONS.md
- docs/projects/economy-ui/AUDIT_OR_PROOF.md
- docs/projects/economy-ui/RUNBOOK.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the living-project audit and `git diff --check` on touched docs. If a future
migration is requested, add a separate review gate before any source edits.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
T2 gap-complete pass mounted `LedgerBook` and `CourierPouch` in `GameModals`,
added fallback Escape closure for both, and routed open actions through
`App.tsx`/`DevMenu.tsx` as `toggle_economy_ledger` and `toggle_courier_pouch`.
T3 resolved the `InvestmentBoard` action-entry gap by mounting the board in
`GameModals`, wiring caravan/loan callbacks to `INVEST_IN_CARAVAN` and
`TAKE_LOAN`, and giving Dev Menu a direct close-and-open path for the board.
Focused regression coverage now proves the modal host path and the Dev Menu
entry path both dispatch the expected actions.
T4 resolved the visibility ownership question as a docs-only contract, so the
packet now records the intentional split between `uiReducer` and
`economyReducer`.
`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, `DECISIONS.md`, `AUDIT_OR_PROOF.md`,
and `RUNBOOK.md` are the current source of truth for this project.
Scope-safe remaining work is now any future non-dev entry strategy for
`InvestmentBoard` or an explicitly approved reducer migration.

Workflow-gap review:
- Reviewed `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
- No new project-specific blocker surfaced for this pass.
- `G3` is resolved as a documentation-only ownership contract.

Dashboard schema updates:
- `docs/projects/economy-ui/NORTH_STAR.md` now carries valid schema frontmatter.
- `gap_signal` now reports `0 open gaps`.
- `required_docs` includes `DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md`.
- `agent_comments` is intentionally empty.

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
