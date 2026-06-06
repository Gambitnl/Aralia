# Quests System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/quests/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Quests System
Project folder: docs/projects/quests
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/quests/NORTH_STAR.md
Tracker: docs/projects/quests/TRACKER.md
Gaps: docs/projects/quests/GAPS.md

## Previous Agent Handoff

Iteration 1 completed the docs-only living-project bootstrap. The Quests North
Star now includes the dashboard card schema, the tracker reflects QTS-2 as
done, and the gap registry is compacted for the next pass.

## Current Mission

Active task:
QTS-3 - Decide migration path for richer quest schema (`QuestDefinition`) against legacy reducer contract

Acceptance criteria:
Document the migration decision, the compatibility boundary it preserves, and
the next implementation slice or blocker. If the active task lacks scoped
criteria, define them before making any product changes and record that gap.

Key files to touch:
- docs/projects/quests/NORTH_STAR.md
- docs/projects/quests/TRACKER.md
- docs/projects/quests/GAPS.md
- docs/projects/quests/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
docs-only updates, confirm the dashboard-facing fields and gap notes stay in
sync with the tracker.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Living-project bootstrap is now complete for the Quests folder. The dashboard
schema is explicit, the tracker is compact, and no workflow-level ambiguity was
found during this pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
