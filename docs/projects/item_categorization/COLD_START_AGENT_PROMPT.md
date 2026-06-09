# NORTH STAR: Item Categorization Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker |

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/item_categorization/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTH STAR: Item Categorization
Project folder: docs/projects/item_categorization
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/item_categorization/NORTH_STAR.md
Tracker: docs/projects/item_categorization/TRACKER.md
Gaps: docs/projects/item_categorization/GAPS.md

## Previous Agent Handoff

Iteration 2 resolved the stale `itemMetadata` contract drift in the docs and then stopped on a real taxonomy choice: vendor `itemGroup` data exists, but the project has not yet decided whether that signal should become a first-class grouping primitive.

## Current Mission

Active task:
Use the Required Review Brief in `NORTH_STAR.md` to decide whether `itemGroup` should become a first-class grouping primitive, or explicitly document that it remains source-only metadata while Equipment grouping stays `itemType`-driven.

Acceptance criteria:
If human/product review chooses a path, update `DECISIONS.md`, `TRACKER.md`, and `GAPS.md` to reflect the decision. Do not manually split or delete generated item corpora.

Key files to touch:
- docs/projects/item_categorization/NORTH_STAR.md
- docs/projects/item_categorization/TRACKER.md
- docs/projects/item_categorization/GAPS.md
- docs/projects/item_categorization/COLD_START_AGENT_PROMPT.md
- docs/projects/item_categorization/DECISIONS.md
- docs/projects/item_categorization/AUDIT_OR_PROOF.md
- docs/projects/item_categorization/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- vendor/5etools-src/data/items.json
- <source/docs named by the active tracker or review decision>

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Use the scoped verification named by TRACKER.md or the updated decision path. If no implementation is approved yet, record the blocker and next proof instead of forcing code changes.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Preserve generated item data and route taxonomy questions through the Required Review Brief.

Recent progress:
`itemGroup` support is real in the vendor corpus. The active slice is now a review gate rather than a mechanical metadata parity fix.

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
