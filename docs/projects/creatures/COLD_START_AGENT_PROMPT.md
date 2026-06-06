# Creatures System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It keeps
current project context only; shared workflow rules live in
`docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/creatures/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Creatures System
Project folder: docs/projects/creatures
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/creatures/NORTH_STAR.md
Tracker: docs/projects/creatures/TRACKER.md
Gaps: docs/projects/creatures/GAPS.md

## Previous Agent Handoff

The iteration-1 docs refresh pass completed on 2026-06-05. NORTH_STAR.md now
has the dashboard card schema, TRACKER.md reflects the current queue order, and
GAPS.md remains the durable blocker registry.

## Current Mission

Active task:
CT-3 - Resolve the creature-type schema policy before deeper validator refactors.

Acceptance criteria:
Document the canonical read/write rules for `creatureType` / `creatureTypes`,
`size` / `sizes`, and `alignment` / `alignments`, then record the migration
boundary in the project docs so CT-2 can proceed without guessing.

Key files to touch:
- docs/projects/creatures/NORTH_STAR.md
- docs/projects/creatures/TRACKER.md
- docs/projects/creatures/GAPS.md
- docs/projects/creatures/COLD_START_AGENT_PROMPT.md
- src/types/spells.ts
- src/types/creatures.ts
- any validator or test file named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done.

Blocking dependencies / do-not-touch:
CT-2 stays deferred until the schema policy is explicit. Stay inside this
project's scope boundaries and route sibling-project blockers instead of
editing their docs.

Recent progress:
The docs refresh is complete. The next safe resume path is schema policy first,
then validator wiring.
---END NEXT AGENT HANDOFF---
