---
schema_version: 1
handoff_type: agent_to_agent
project: Intrigue System
slug: intrigue
status: active
last_updated: 2026-06-15
iteration: 3
source_agent: Claude Codex
target_agent: next cold-start agent
runtime_surface: CLI agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/intrigue/NORTH_STAR.md
tracker: docs/projects/intrigue/TRACKER.md
gaps: docs/projects/intrigue/GAPS.md
---
# Intrigue System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-15

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/intrigue/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Not recorded | unknown | unknown | 2026-06-10 | Iteration 2 established dashboard schema, tracker, and gap alignment |
| 3 | Claude Codex (opencode) | CLI agent | certain | 2026-06-15 | I2 executed: LeverageSystem wired into production (APPLY_LEVERAGE action, reducer case, LeverageUI, integration tests) |

---BEGIN NEXT AGENT HANDOFF---
Project: Intrigue System
Project folder: docs/projects/intrigue
iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/intrigue/NORTH_STAR.md
Tracker: docs/projects/intrigue/TRACKER.md
Gaps: docs/projects/intrigue/GAPS.md

## Previous Agent Handoff

Iteration 3 (2026-06-15, Claude Codex) executed I2 end-to-end:
- Added `ApplyLeveragePayload` to identityPayloads.ts
- Added `APPLY_LEVERAGE` action type to actionTypes.ts:245
- Added APPLY_LEVERAGE case to identityReducer.ts:109 (resolves target from factions or NPCs, handles secret burning, gold rewards, faction standing changes, hostility)
- Created `LeverageUI.tsx` component with secret/target/goal selection
- Added 2 integration tests in LeverageSystem.test.ts (secret-burned-on-blackmail, unknown-secret-rejection)

## Current Mission

Active task:
I3 - Resolve rumor lead handling contract (lead type currently non-actionable).

Acceptance criteria:
Define payload contract and ownership target (quest/world marker/schedule) for the lead type. See GAPS.md G-002 for details.

Key files to touch:
- docs/projects/intrigue/NORTH_STAR.md
- docs/projects/intrigue/TRACKER.md
- docs/projects/intrigue/GAPS.md
- docs/projects/intrigue/COLD_START_AGENT_PROMPT.md
- src/systems/intrigue/TavernGossipSystem.ts
- src/components/Town/Intrigue/RumorMill.tsx
- src/components/Trade/MerchantModal.tsx

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or NORTH_STAR.md. Add scoped tests for any new action/payload entrypoints.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs.

Recent progress:
I2 completed: LeverageSystem now has production wiring. APPLY_LEVERAGE action + reducer + LeverageUI component + 2 integration tests all pass. G-005 resolved. 6 open gaps remain. Gap signal updated. GAPS.md G-005 status changed to `resolved` with evidence.

Key files to touch:
- docs/projects/intrigue/NORTH_STAR.md
- docs/projects/intrigue/TRACKER.md
- docs/projects/intrigue/GAPS.md
- docs/projects/intrigue/COLD_START_AGENT_PROMPT.md
- docs/projects/intrigue/DECISIONS.md (not present)
- docs/projects/intrigue/AUDIT_OR_PROOF.md (not present)
- docs/projects/intrigue/RUNBOOK.md (not present)
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- docs/projects/intrigue plus source/docs named by the active tracker task

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Run `npx vitest run src/systems/intrigue/__tests__/LeverageSystem.test.ts` to verify leverage chain integration. Full sake: `npx vitest run src/systems/intrigue/`.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, and GAPS.md as the current source of truth.

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
