# Naval System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/naval/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Naval System
Project folder: docs/projects/naval
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/naval/NORTH_STAR.md
Tracker: docs/projects/naval/TRACKER.md
Gaps: docs/projects/naval/GAPS.md

## Previous Agent Handoff

Iteration 1 established the baseline Naval living-project docs. This pass
refreshed the dashboard card schema, tightened the tracker and gap summaries,
and kept the implementation slice unchanged.

## Current Mission

Active task:
T2 - Finalize voyage + encounter coupling and naval action surface alignment.

Acceptance criteria:
Use the active TRACKER.md row and any acceptance criteria listed in
NORTH_STAR.md. If the active task lacks acceptance criteria, define scoped
criteria before implementation and record that documentation gap.

Key files to touch:
- docs/projects/naval/NORTH_STAR.md
- docs/projects/naval/TRACKER.md
- docs/projects/naval/GAPS.md
- docs/projects/naval/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use the verification command or evidence source named by TRACKER.md or
NORTH_STAR.md. If none is named, add one before claiming the task is done. If
the change is observable, collect empirical proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
North Star now exposes an explicit Dashboard Card Schema. TRACKER.md and
GAPS.md were compacted for the next implementation pass. No workflow-level
ambiguity was found during this iteration.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
