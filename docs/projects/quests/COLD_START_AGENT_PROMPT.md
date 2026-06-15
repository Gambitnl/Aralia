---
schema_version: 1
handoff_type: agent_to_agent
project: Quests System
slug: quests
status: active
last_updated: 2026-06-10
iteration: 3
source_agent: Qoder
target_agent: next cold-start agent
runtime_surface: application agent
certainty: inferred
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/quests/NORTH_STAR.md
tracker: docs/projects/quests/TRACKER.md
gaps: docs/projects/quests/GAPS.md
---
# Quests System Cold Start Agent Handoff

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
docs/projects/quests/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Qoder | application agent | inferred | 2026-06-10 | IDE agent session executing cold-start directive |

---BEGIN NEXT AGENT HANDOFF---
Project: Quests System
Project folder: docs/projects/quests
iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/quests/NORTH_STAR.md
Tracker: docs/projects/quests/TRACKER.md
Gaps: docs/projects/quests/GAPS.md

## Previous Agent Handoff

Iteration 2 completed QTS-3: the migration decision from legacy `Quest` to `QuestDefinition` is now documented as D2 in `DECISIONS.md`. The decision adopts a phased adapter-bridge approach with four phases. GQ-1 is resolved. Two new gaps (GQ-7, GQ-8) were identified during the migration analysis.

## Current Mission

Active task:
QTS-5 - Implement Phase 1 adapter â€” `adaptQuestDefinitionToQuest` with round-trip unit test

Acceptance criteria:
1. Create `src/systems/quests/questAdapter.ts` with `adaptQuestDefinitionToQuest(def: QuestDefinition): Quest`.
2. The adapter must flatten the active stage's objectives into the legacy `QuestObjectiveProgress[]` shape.
3. The adapter must map `QuestReward` fields to `QuestRewards` (gold, xp, items from itemIds).
4. The adapter must map `QuestFailureCondition[type=Deadline]` to `Quest.deadline` and `Quest.deadlineConsequence`.
5. Ship a unit test in `src/systems/quests/__tests__/questAdapter.test.ts` that round-trips a `QuestDefinition` through the adapter and asserts the resulting `Quest` shape.
6. Verify the adapted `Quest` can pass through the existing `questReducer` `ACCEPT_QUEST` action without type errors.

Key files to touch:
- `src/systems/quests/questAdapter.ts` (new)
- `src/systems/quests/__tests__/questAdapter.test.ts` (new)
- `docs/projects/quests/NORTH_STAR.md`
- `docs/projects/quests/TRACKER.md`
- `docs/projects/quests/GAPS.md`
- `docs/projects/quests/COLD_START_AGENT_PROMPT.md`
- `docs/projects/quests/DECISIONS.md`
- `docs/projects/quests/AUDIT_OR_PROOF.md`
- `docs/projects/quests/RUNBOOK.md`
- `docs/projects/PROJECT_CARD_SCHEMA.md`
- `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Run the adapter unit test (`npx vitest run src/systems/quests/__tests__/questAdapter.test.ts`). Run the existing quest reducer tests to confirm no regression. Run the contract tests to confirm no type drift. Record results in AUDIT_OR_PROOF.md.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs.

Recent progress:
QTS-3 migration decision is documented (D2). The phased adapter-bridge approach is the agreed path. GQ-1 is resolved. GQ-7 (factory type mismatch) and GQ-8 (save/load shape-blindness) are registered for future phases.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

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
agent_comments: No new agent comment was added during the schema repair pass; preserve existing project intent until the next substantive iteration updates this handoff.
---END NEXT AGENT HANDOFF---
