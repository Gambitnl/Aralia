# <Project> Cold Start Agent Handoff

Status: active
Last updated: <YYYY-MM-DD>

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/<project-slug>/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: <Project>
Project folder: docs/projects/<project-slug>
Iteration: <N>
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/<project-slug>/NORTH_STAR.md
Tracker: docs/projects/<project-slug>/TRACKER.md
Gaps: docs/projects/<project-slug>/GAPS.md

## Previous Agent Handoff

<For iteration 1: "No prior project iteration handoff exists yet. Use
NORTH_STAR.md for scope, TRACKER.md for the active queue, and GAPS.md for
unresolved findings.">

<For later iterations: summarize what changed, what was verified, what was not
verified, what gaps were opened/closed/imported, and what remains blocked.>

## Current Mission

Active task:
<task id and task>

Acceptance criteria:
<done state, from TRACKER.md/NORTH_STAR.md/task doc>

Key files to touch:
- NORTH_STAR.md
- TRACKER.md
- GAPS.md
- COLD_START_AGENT_PROMPT.md
- DECISIONS.md
- AUDIT_OR_PROOF.md
- RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- <source/docs named by active task>

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
<exact command/evidence source plus empirical proof if observable>

Blocking dependencies / do-not-touch:
<scope boundaries and sibling-project blockers>

Recent progress:
<brief handoff summary from the previous agent>

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, recent progress, workflow-gap review result, and dashboard-schema
updates. Account for every required doc, mention optional docs touched or
skipped, update `agent_comments` only when an out-of-flow note is useful, and
keep only the current handoff between the same BEGIN/END markers; do not
preserve old handoff transcripts in this file.
---END NEXT AGENT HANDOFF---
