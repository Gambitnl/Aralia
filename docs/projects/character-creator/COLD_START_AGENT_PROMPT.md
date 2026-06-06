# Character Creator Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/character-creator/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Character Creator
Project folder: docs/projects/character-creator
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/character-creator/NORTH_STAR.md
Tracker: docs/projects/character-creator/TRACKER.md
Gaps: docs/projects/character-creator/GAPS.md

## Previous Agent Handoff

Iteration 1 created the first project handoff and established the live
Character Creator scope. This pass refreshed the North Star dashboard schema,
aligned the tracker/gap state to the current sidebar-navigation ambiguity, and
kept the handoff compact for a cold-start resume.

## Current Mission

Active task:
G2 - sidebar-navigation contract clarification

Acceptance criteria:
Use the active TRACKER.md row and the G2 entry in GAPS.md as the source of
truth. Keep the docs aligned with the current permissive sidebar navigation
behavior unless a product decision says otherwise. Do not invent strict
gating as current behavior.

Key files to touch:
- docs/projects/character-creator/NORTH_STAR.md
- docs/projects/character-creator/TRACKER.md
- docs/projects/character-creator/GAPS.md
- docs/projects/character-creator/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Docs consistency only for this pass; no implementation verification was run.
If implementation work resumes, use the tracker-defined proof source or add one
before claiming completion.

Blocking dependencies / do-not-touch:
No project-local blocker beyond the unresolved G2 navigation-contract
ambiguity. Stay inside this project's scope boundaries and route sibling-project
issues elsewhere.

Recent progress:
North Star now carries the Dashboard Card Schema. TRACKER.md and GAPS.md both
point at the same active sidebar-navigation ambiguity. No optional
DECISIONS.md, AUDIT_OR_PROOF.md, or RUNBOOK.md files exist in this project
folder.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification method,
blockers, and recent progress. End the response with the refreshed handoff
between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---
