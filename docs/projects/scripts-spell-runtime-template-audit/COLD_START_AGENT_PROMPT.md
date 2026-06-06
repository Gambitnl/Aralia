# NORTHSTAR: Scripts: Spell Runtime Template Audit Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Scripts: Spell Runtime Template Audit
Project folder: docs/projects/scripts-spell-runtime-template-audit
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md
Tracker: docs/projects/scripts-spell-runtime-template-audit/TRACKER.md
Gaps: docs/projects/scripts-spell-runtime-template-audit/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project handoff files and the initial audit
baseline. The current pass refreshed the dashboard card schema, compacted the
queue, and kept the recurring-mechanics decision open for the next agent.

## Current Mission

Active task:
T2 - Resolve recurring warning follow-up by deciding the schema path for Recurring Mechanics labels and documenting execution handoff

Acceptance criteria:
Use the active TRACKER.md row and the acceptance criteria in NORTH_STAR.md.
The next agent should leave with one explicit schema-path decision, a matching
gap entry, and an audit rerun target.

Key files to touch:
- docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md
- docs/projects/scripts-spell-runtime-template-audit/TRACKER.md
- docs/projects/scripts-spell-runtime-template-audit/GAPS.md
- docs/projects/scripts-spell-runtime-template-audit/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Use `npm run audit:spell-template` and the tracker evidence chain named in the
North Star. If the task is only documented, make that clear instead of
claiming runtime completion.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs. No new blocker was found in this pass.

Recent progress:
Dashboard card schema added to NORTH_STAR.md; TRACKER.md and GAPS.md were
refreshed for the current recurring-mechanics warning family; workflow gaps
were reviewed and no new workflow-level ambiguity was opened.

## Required End State For This Iteration

Before ending, keep this handoff current with the next iteration number,
previous agent context, active task, acceptance criteria, key files,
verification method, blockers, and recent progress. End the response with the
refreshed handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
