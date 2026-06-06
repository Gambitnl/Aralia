# NORTH STAR: Item Categorization Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It does not duplicate the workflow rules. The agent must follow the shared workflow file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/item_categorization/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTH STAR: Item Categorization
Project folder: docs/projects/item_categorization
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/item_categorization/NORTH_STAR.md
Tracker: docs/projects/item_categorization/TRACKER.md
Gaps: docs/projects/item_categorization/GAPS.md

## Previous Agent Handoff

Iteration 1 established the first project handoff and confirmed the Equipment grouping pipeline is already in place. This iteration refreshes the resume path and points the next agent at the active contract-parity gap.

## Current Mission

Active task:
Start with the tracker's top open item: resolve the `itemMetadata` type-surface drift gap between `src/types/ui.ts` and `src/types/ui.d.ts`, or explicitly document why declaration-only consumers remain unsupported.

Acceptance criteria:
Use the active TRACKER.md row and the open gaps in `GAPS.md` as the source of truth. If the type-surface gap is implemented, declaration parity must be verified before the gap is treated as closed.

Key files to touch:
- docs/projects/item_categorization/NORTH_STAR.md
- docs/projects/item_categorization/TRACKER.md
- docs/projects/item_categorization/GAPS.md
- docs/projects/item_categorization/COLD_START_AGENT_PROMPT.md
- docs/projects/item_categorization/DECISIONS.md
- If implementation resumes: src/types/ui.ts and src/types/ui.d.ts

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or NORTH_STAR.md. For docs-only work, do a consistency pass across the project docs. If code changes are made, add a focused declaration/type check for `itemMetadata` parity before claiming the gap is closed.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs.

Recent progress:
North Star now has a `Dashboard Card Schema` section. The tracker names the `itemMetadata` parity gap as the current active work. Shared workflow files were read for context and left unchanged.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, and recent progress. End the response with the refreshed handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
