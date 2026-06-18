---
schema_version: 1
handoff_type: agent_to_agent
project: Crime UI
slug: crime-ui
status: active
last_updated: 2026-06-17
iteration: 3
source_agent: Gemini CLI
target_agent: next cold-start agent
runtime_surface: application agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/crime-ui/NORTH_STAR.md
tracker: docs/projects/crime-ui/TRACKER.md
gaps: docs/projects/crime-ui/GAPS.md
---
# Crime UI Cold Start Agent Handoff

Status: active
Last updated: 2026-06-17

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/crime-ui/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Qoder | application agent | inferred | 2026-06-15 | IDE-integrated agent (Qoder/Qoder IDE) |
| 3 | Gemini CLI | application agent | certain | 2026-06-17 | Explicit identification in session |

---BEGIN NEXT AGENT HANDOFF---
Project: Crime UI
Project folder: docs/projects/crime-ui
iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crime-ui/NORTH_STAR.md
Tracker: docs/projects/crime-ui/TRACKER.md
Gaps: docs/projects/crime-ui/GAPS.md

## Previous Agent Handoff

Iteration 3 (2026-06-17, Gemini CLI, application agent): Completed T3 by validating the future UI work against `docs/projects/crime` core contract changes. Identified that G2 (fence semantics), G3 (type debt), and G5 (heist phase assumptions) in core overlap with UI needs. Added regression test notes to `TRACKER.md` as required. Updated `NORTH_STAR.md` verification fields and gap signals.

## Current Mission

Active task:
T4 - Resolve G4 (safehouse service source-of-truth) and G3 (heist plan type narrowing)

Acceptance criteria:
- For G4: Replace the hardcoded service list in `ThievesGuildSafehouse.tsx` with `ThievesGuildSystem.getAvailableServices()` and add snapshot/unit tests for consistency.
- For G3: Narrow `HeistPlan.approaches` and `HeistPlan.intelGathered` types or add a runtime guard in `HeistPlanningModal.tsx` to remove the brittle type cast. Update reducer and type test coverage.

Key files to touch:
- src/components/Crime/ThievesGuild/ThievesGuildSafehouse.tsx
- src/components/Crime/ThievesGuild/HeistPlanningModal.tsx
- src/state/reducers/crimeReducer.ts
- src/types/crime/index.ts
- docs/projects/crime-ui/TRACKER.md
- docs/projects/crime-ui/GAPS.md
- docs/projects/crime-ui/NORTH_STAR.md
- docs/projects/crime-ui/COLD_START_AGENT_PROMPT.md

Scoped verification:
Add unit/snapshot checks for safehouse service list consistency. Add type/reducer test coverage for narrowed heist plan types.

Blockers / boundaries:
Do not expand the scope to fixing core `crime` G5 or G2 unless it directly blocks these specific UI fixes. Route core fixes to the `crime` tracker if encountered.

Recent progress:
T3 completed on 2026-06-17. Cross-project validation against \crime` core performed and documented. `TRACKER.md` updated with regression test notes for future UI changes. `NORTH_STAR.md` verified and aligned.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update \gent_comments\ only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

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

