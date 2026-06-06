# Naval UI Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/naval-ui/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Naval UI
Project folder: docs/projects/naval-ui
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/naval-ui/NORTH_STAR.md
Tracker: docs/projects/naval-ui/TRACKER.md
Gaps: docs/projects/naval-ui/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial Naval UI cold-start handoff. This pass refreshed
the durable docs, added an explicit dashboard card schema, and kept the active
project gaps unchanged.

## Current Mission

Active task:
U2 - Document naval UI implementation state, integration points, and current gaps

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/naval-ui/NORTH_STAR.md
- docs/projects/naval-ui/TRACKER.md
- docs/projects/naval-ui/GAPS.md
- docs/projects/naval-ui/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. For
docs-only refreshes, a compact consistency check across the three Naval UI docs
is enough; if the task moves into source work, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now has an explicit Dashboard Card Schema. TRACKER and GAPS were
refreshed to 2026-06-05, and no new project-specific blocker was added.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
