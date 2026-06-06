# NORTHSTAR: Command Effects Runtime Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. Use it only for the current project
context and keep the shared workflow as the authority for process details.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/command-effects-runtime/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Command Effects Runtime
Project folder: docs/projects/command-effects-runtime
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/command-effects-runtime/NORTH_STAR.md
Tracker: docs/projects/command-effects-runtime/TRACKER.md
Gaps: docs/projects/command-effects-runtime/GAPS.md

## Previous Agent Handoff

Iteration 1 was the initial handoff creation pass. This pass refreshed
`NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md`, and added the dashboard schema so
the next agent can resume without re-triaging the project shape.

## Current Mission

Active task:
T2 - Track and close core execution gaps: reactive execution, teleport/budget behavior, ability movement mapping

Acceptance criteria:
Use the active `TRACKER.md` row and the matching `NORTH_STAR.md` task block.
Keep G1, G2, and G4 evidence-backed in `GAPS.md`; leave G3 and G5 parked unless
new source evidence changes their scope.

Key files to touch:
- docs/projects/command-effects-runtime/NORTH_STAR.md
- docs/projects/command-effects-runtime/TRACKER.md
- docs/projects/command-effects-runtime/GAPS.md
- docs/projects/command-effects-runtime/COLD_START_AGENT_PROMPT.md
- `src/commands/effects/ReactiveEffectCommand.ts`
- `src/commands/effects/MovementCommand.ts`
- `src/commands/factory/AbilityEffectMapper.ts`

Scoped verification:
Use the verification source named by `TRACKER.md` or `NORTH_STAR.md`. If source
changes are made, use the project's scoped proof path before claiming the task
is done.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs. No new blocker was discovered in this pass.

Recent progress:
Project docs were refreshed for cold-start resume, the dashboard card schema was
added to `NORTH_STAR.md`, and the active slice was narrowed to G1/G2/G4.
---END NEXT AGENT HANDOFF---
