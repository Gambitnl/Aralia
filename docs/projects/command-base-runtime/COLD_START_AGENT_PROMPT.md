# NORTHSTAR: Command Base Runtime Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/command-base-runtime/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Command Base Runtime
Project folder: docs/projects/command-base-runtime
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/command-base-runtime/NORTH_STAR.md
Tracker: docs/projects/command-base-runtime/TRACKER.md
Gaps: docs/projects/command-base-runtime/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial cold-start packet and registry-backed project
docs. This pass refreshed the dashboard schema, tracker, and gap routing. The
rollback policy decision remains open.

## Current Mission

Active task:
T3 - Decide execution policy for rollback (`executeWithRollback` adoption vs explicit fallback)

Acceptance criteria:
The decision is recorded in the project docs. If rollback is adopted, the next
implementation slice must add the missing call-site/test follow-up. If rollback
is not adopted, G1 and G2 are closed with rationale and G3 stays as regression
coverage for the chosen execution path.

Key files to touch:
- docs/projects/command-base-runtime/NORTH_STAR.md
- docs/projects/command-base-runtime/TRACKER.md
- docs/projects/command-base-runtime/GAPS.md
- docs/projects/command-base-runtime/COLD_START_AGENT_PROMPT.md
- src/commands/base/CommandExecutor.ts
- src/hooks/useAbilitySystem.ts
- src/commands/__tests__/CommandExecutor.test.ts

Scoped verification:
Use the docs consistency pass plus the targeted CommandExecutor rollback/failure
checks named by TRACKER.md and NORTH_STAR.md. If the decision changes
implementation behavior, collect empirical proof before claiming completion.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not edit shared workflow docs.
Route sibling-project blockers instead of copying them here.

Recent progress:
Dashboard card schema added, tracker/gaps synchronized, and the rollback
decision is still the active blocker.
---END NEXT AGENT HANDOFF---
