---
schema_version: 1
handoff_type: agent_to_agent
project: Layout Project
slug: layout
status: review-required
last_updated: "2026-06-08"
iteration: 3
source_agent: Codex / gpt-5.4-mini high
target_agent: next cold-start agent
runtime_surface: MCP-subagent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/layout/NORTH_STAR.md
tracker: docs/projects/layout/TRACKER.md
gaps: docs/projects/layout/GAPS.md
---
# Layout Project Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/layout/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Layout Project
Project folder: docs/projects/layout
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/layout/NORTH_STAR.md
Tracker: docs/projects/layout/TRACKER.md
Gaps: docs/projects/layout/GAPS.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker |

## Previous Agent Handoff

Iteration 2 closed the `ConversationPanel` ownership question and left the `GameModals.isUIInteractive` decision open. The Layout docs now agree that `ConversationPanel` is a PLAYING-only floating shell sibling rendered directly by `App.tsx`, not by `GameModals`.

## Current Mission

Active task:
T4 - Resolve `GameModals.isUIInteractive` contract

Acceptance criteria:
Use the active TRACKER.md row and the scope/boundary notes in NORTH_STAR.md. The current safe interpretation is compatibility-preserving: `App.tsx` computes the interaction flag, `GameModals` accepts it, and the modal host does not consume it yet. Keep the prop surface intact until the owner chooses wire-or-retire.

Key files to touch:
- docs/projects/layout/NORTH_STAR.md
- docs/projects/layout/TRACKER.md
- docs/projects/layout/GAPS.md
- docs/projects/layout/COLD_START_AGENT_PROMPT.md

Scoped verification:
Docs/source consistency pass plus `git diff --check` on touched files. No source edits are required for this review-gate pass.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not remove `isUIInteractive` from the source surface until the Required Review Brief decision is recorded.

Required-review handling:
The project is already review-required. The Required Review Brief now lives in `docs/projects/layout/NORTH_STAR.md` and captures the decision question, current behavior, blocked reason, options, evidence, decision owner, and proof-after-decision. Do not assign forward implementation agents until the decision is recorded.

Recent progress:
The conversation-shell boundary is documented, and the remaining open Layout gap is now a review-gated modal contract question rather than an ambiguous cleanup target. `G4` remains a separate app-shell modularization blocker.

Workflow-gap review result:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was read; WFG-001 remains open, but it does not change this iteration's safety because the canonical workflow paths were already resolved in the local handoff.

Dashboard-schema updates:
Status now reads `review-required`, the gap signal distinguishes the review-gated modal contract from the separate App-shell follow-up, and the Next step now points future agents toward the owner decision instead of code movement.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Keep only the current handoff between the BEGIN/END markers; do not preserve old handoff transcripts in this file.
## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, agent identity/runtime surface, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers.

---END NEXT AGENT HANDOFF---
