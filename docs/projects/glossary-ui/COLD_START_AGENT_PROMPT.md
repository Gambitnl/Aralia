# Glossary UI Cold Start Agent Handoff

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
docs/projects/glossary-ui/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent / Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Codex | CLI agent | inferred | 2026-06-05 | Legacy handoff row |
| 2 | Codex | CLI agent | inferred | 2026-06-05 | Legacy handoff row |
| 3 | Antigravity (Claude Opus 4.6 Thinking) | application agent | certain | 2026-06-08 | Existing ledger note |
| 4 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Sub-agent final receipt |
| 5 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Handoff prepared after verified rebuild pass |

---BEGIN NEXT AGENT HANDOFF---
Project: Glossary UI
Project folder: docs/projects/glossary-ui
Iteration: 5
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/glossary-ui/NORTH_STAR.md
Tracker: docs/projects/glossary-ui/TRACKER.md
Gaps: docs/projects/glossary-ui/GAPS.md
Runbook: docs/projects/glossary-ui/RUNBOOK.md
Decisions: docs/projects/glossary-ui/DECISIONS.md
Audit/proof: docs/projects/glossary-ui/AUDIT_OR_PROOF.md

## Previous Agent Handoff

Iteration 4 closed T4 by adding `npm run glossary:rebuild`, delegating `build:data` to the named rebuild path, and verifying the bundle refresh path. Updated RUNBOOK.md, NORTH_STAR.md, TRACKER.md, GAPS.md, DECISIONS.md, and AUDIT_OR_PROOF.md. G1 and G6 are now resolved; the glossary bundle rebuild has a named non-dev entry point and the item-registry ordering note is no longer live.

## Current Mission

Active task:
T3 - Track item metadata and categorization assumptions affecting this UI

Secondary task:
None; T4 is complete.

Acceptance criteria:
- Glossary UI assumptions about `itemMetadata` fields are documented and evidence-backed.
- The boundary between this project and `docs/projects/item_categorization` is clear.
- `GAPS.md` G2 and G3 are updated with any new evidence.

Key files to touch:
- docs/projects/glossary-ui/NORTH_STAR.md
- docs/projects/glossary-ui/TRACKER.md
- docs/projects/glossary-ui/GAPS.md
- docs/projects/glossary-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/glossary-ui/RUNBOOK.md
- scripts/ingestPhbGlossary.ts (read for itemMetadata contract)
- scripts/generateGlossaryIndex.js (read for Equipment grouping logic)
- src/components/Glossary/GlossaryItemStatBlock.tsx (read for field consumption)
- package.json (for the named rebuild entry point already added)
- docs/projects/glossary-ui/DECISIONS.md
- docs/projects/glossary-ui/AUDIT_OR_PROOF.md

Optional docs to check when present or named by tracker:
- docs/projects/item_categorization/NORTH_STAR.md
- docs/projects/item_categorization/GAPS.md
- docs/tasks/glossary/

Scoped verification:
For T3: docs consistency check and targeted contract review. T4 has already been verified by running `npm run glossary:rebuild` and checking the generated bundle output.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route item-categorization decisions to `docs/projects/item_categorization`. Do not edit the Equipment taxonomy without confirming the decision with the item-categorization owner.

Recent progress:
T2 is complete. T4 is complete. G1 and G6 are resolved. The glossary rebuild now has a named non-dev entry point with proof in AUDIT_OR_PROOF.md. Use TRACKER.md and GAPS.md as current source of truth.

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
