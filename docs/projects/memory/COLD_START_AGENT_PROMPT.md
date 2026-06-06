# Memory System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/memory/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Memory System
Project folder: docs/projects/memory
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/memory/NORTH_STAR.md
Tracker: docs/projects/memory/TRACKER.md
Gaps: docs/projects/memory/GAPS.md

## Previous Agent Handoff

Iteration 1 was a docs-only living-project refresh. The North Star now carries
the dashboard schema, and the tracker/gap docs were brought forward to the
current date without changing runtime ownership.

## Current Mission

Active task:
T2 - finalize Memory System gap registry for schema unification and gameplay wiring coverage.

Acceptance criteria:
Use the active TRACKER.md row and the gap list in GAPS.md as the source of
truth. If the next agent resumes implementation work, pick one real open gap,
keep the scope narrow, and record scoped proof before claiming completion.

Key files to touch:
- docs/projects/memory/NORTH_STAR.md
- docs/projects/memory/TRACKER.md
- docs/projects/memory/GAPS.md
- docs/projects/memory/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the chosen open gap

Scoped verification:
Use the verification command or evidence source named by TRACKER.md,
NORTH_STAR.md, or the chosen gap. If none is named yet, add one before claiming
the gap is done. For docs-only refreshes, verify doc consistency by re-reading
the project docs together.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
The project docs now reflect the current tracker state, the North Star has a
Dashboard Card Schema section, and no workflow-level ambiguity was found.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, current tracker state, active task or docs-only action,
acceptance criteria, key files, verification method, blockers, and recent
progress. End the response with the refreshed handoff between the same
BEGIN/END markers.
---END NEXT AGENT HANDOFF---
