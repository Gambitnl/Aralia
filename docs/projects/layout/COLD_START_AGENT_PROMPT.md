---
schema_version: 1
handoff_type: agent_to_agent
project: Layout Project
slug: layout
Status: active
last_updated: 2026-06-12
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

Status: active
Last updated: 2026-06-12

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
iteration: 3
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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original layout handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/layout/NORTH_STAR.md
- docs/projects/layout/TRACKER.md
- docs/projects/layout/GAPS.md
- docs/projects/layout/COLD_START_AGENT_PROMPT.md
- docs/projects/layout/DECISIONS.md
- docs/projects/layout/AUDIT_OR_PROOF.md
- docs/projects/layout/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
