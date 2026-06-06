# SaveLoad Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/saveload/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: SaveLoad
Project folder: docs/projects/saveload
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/saveload/NORTH_STAR.md
Tracker: docs/projects/saveload/TRACKER.md
Gaps: docs/projects/saveload/GAPS.md

## Previous Agent Context

This pass refreshed the SaveLoad living-project docs, added the dashboard card
schema, and left the runtime bootstrap/version-policy decision open. No source
files were changed.

## Current Mission

Active task:
T3 - Decide runtime bootstrap path for storage migration and version policy before code changes

Acceptance criteria:
NORTH_STAR, TRACKER, and GAPS stay aligned with the current SaveLoad scope,
dashboard card schema, open gaps, and next safe resume action.

Key files to touch next:
- docs/projects/saveload/NORTH_STAR.md
- docs/projects/saveload/TRACKER.md
- docs/projects/saveload/GAPS.md
- src/services/saveLoadService.ts
- src/services/indexedDBStorageService.ts
- src/state/migrations/worldDataMigration.ts

Scoped verification:
Use the docs-consistency check from the project docs first. When the runtime
slice resumes, verify the bootstrap and migration path against the named source
files or the proof source recorded in TRACKER/GAPS.

Blocking dependencies / do-not-touch:
Stay in SaveLoad until the runtime bootstrap decision is made. Route
cross-project findings to `docs/projects/GLOBAL_GAPS.md`.

Recent progress:
Dashboard Card Schema was added to NORTH_STAR.md, the tracker and gap dates were
refreshed, and the shared workflow path ambiguity was reviewed.

## Required End State For This Iteration

Before ending, keep the handoff current with the next iteration number, active
task, and next safe resume action. Do not expand scope beyond SaveLoad docs
unless the runtime task is explicitly resumed.
---END NEXT AGENT HANDOFF---