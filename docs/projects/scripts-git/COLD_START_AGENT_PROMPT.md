# NORTHSTAR: Scripts: Git Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/scripts-git/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: NORTHSTAR: Scripts: Git
Project folder: docs/projects/scripts-git
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/scripts-git/NORTH_STAR.md
Tracker: docs/projects/scripts-git/TRACKER.md
Gaps: docs/projects/scripts-git/GAPS.md

## Previous Agent Summary

This iteration was a docs-only refresh. The North Star now has a `Dashboard Card
Schema` section, the tracker and gap notes are compacted, and the handoff now
points at the current open follow-up. No scripts, CI, or hook behavior changed.

## Current Mission

Active task:
No implementation slice is open yet. If you continue beyond docs maintenance,
start with G1 in `GAPS.md`: define the smallest believable verification path
for the hook-policy scripts.

Acceptance criteria:
The next agent should be able to resume from `TRACKER.md` and `GAPS.md`
without hunting for the project state. If work begins on G1, document the
verification path before claiming completion.

Key files to touch:
- docs/projects/scripts-git/NORTH_STAR.md
- docs/projects/scripts-git/TRACKER.md
- docs/projects/scripts-git/GAPS.md
- docs/projects/scripts-git/COLD_START_AGENT_PROMPT.md

Scoped verification:
Use the verification source named by the next chosen task. For the current
docs state, the proof is the refreshed markdown set plus `git diff --check`.

Blocking dependencies / do-not-touch:
Stay inside `docs/projects/scripts-git/*` unless the task explicitly expands.

Recent progress:
Added the dashboard schema to the North Star and compacted the tracker/gaps for
the next agent. Shared workflow gaps were reviewed; the stale moved-path issue
remains a process concern, not a project blocker.

## Required End State For This Iteration

Before ending, keep this handoff aligned with the latest tracker and gap
state, and preserve the same markers.
---END NEXT AGENT HANDOFF---
