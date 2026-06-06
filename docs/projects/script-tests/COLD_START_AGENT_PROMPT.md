# NORTHSTAR: Script Tests Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/LIVING_PROJECT_TASK_PROTOCOL.md

Project entry point:
docs/projects/script-tests/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Script Tests
Project folder: docs/projects/script-tests
Iteration: 2
Shared workflow: docs/agent-workflows/LIVING_PROJECT_TASK_PROTOCOL.md
North Star: docs/projects/script-tests/NORTH_STAR.md
Tracker: docs/projects/script-tests/TRACKER.md
Gaps: docs/projects/script-tests/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial living-project split for this folder. The packet now points at the real shared workflow entry point, and the dashboard-facing schema has been refreshed for the next agent.

## Current Mission

Active task:
T2 - Add follow-up test coverage for uncovered script integration risks

This pass was docs-only; the active task remains open and the next agent should continue from the gap list rather than treat the packet refresh as completion.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/script-tests/NORTH_STAR.md
- docs/projects/script-tests/TRACKER.md
- docs/projects/script-tests/GAPS.md
- docs/projects/script-tests/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or NORTH_STAR.md. If none is named, add one before claiming the task is done. This iteration did not run tests; the next agent should use the named narrow Vitest check or add a new one if the safer gap changes.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs.

Recent progress:
This iteration refreshed the dashboard-facing docs, added the North Star card schema, and corrected the shared workflow entry point. No code or tests were run in this pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
