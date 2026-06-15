---
schema_version: 1
handoff_type: agent_to_agent
project: <Project>
slug: <project-slug>
status: active
last_updated: <YYYY-MM-DD>
iteration: <N>
source_agent: <agent/model or not recorded>
target_agent: next cold-start agent
runtime_surface: <CLI agent/application agent/browser-app agent/MCP-subagent/unknown>
certainty: <certain/inferred/unknown>
active_agent: <agent/model or not recorded>
agent_pass_status: <not_started/in_progress/blocked/finished/waiting/review_required/idle>
agent_pass_started_at: <YYYY-MM-DDTHH:mm:ss+TZ or empty>
agent_pass_ended_at: <YYYY-MM-DDTHH:mm:ss+TZ or empty>
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/<project-slug>/NORTH_STAR.md
tracker: docs/projects/<project-slug>/TRACKER.md
gaps: docs/projects/<project-slug>/GAPS.md
---
# <Project> Cold Start Agent Handoff

Status: active
Last updated: <YYYY-MM-DD>

This file is the project-specific agent-to-agent handoff for the next cold-start agent. The YAML header is the machine-readable handoff index; the Markdown body is the readable context packet. It does not duplicate the workflow rules. The agent must follow the shared workflow file and use this file only for current project context.

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

Agent identity / runtime:
<Before selecting work, identify yourself and the surface you are running
through. Use one of: CLI agent, application agent, browser/app-embedded agent,
MCP/subagent, or unknown. Name the system clue used, such as shell-only
terminal, app browser context, Codex desktop context, MCP handoff, or explicit
operator statement. Mark the classification as certain or inferred.>

Pass telemetry:
<After reading this handoff index and identifying yourself, but before deeper
project reading or task selection, update the project dashboard schema in
NORTH_STAR.md or TRACKER.md: set active_agent to your agent/model identity,
agent_pass_status to in_progress, agent_pass_started_at to the local start
timestamp, and agent_pass_ended_at to empty. At closeout, keep the agent and
start time, then set agent_pass_status to finished, blocked, waiting,
review_required, idle, or another explicit local status, and set
agent_pass_ended_at to the local closeout timestamp.>

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| <N> | <agent/model> | <CLI agent/application agent/browser-app agent/MCP-subagent/unknown> | <certain/inferred/unknown> | <YYYY-MM-DD> | <short clue> |

## Previous Agent Handoff

<For iteration 1: "No prior project iteration handoff exists yet. Use
NORTH_STAR.md for scope, TRACKER.md for the active queue, and GAPS.md for
unresolved findings.">

<For later iterations: summarize what changed, what was verified, what was not
verified, what gaps were opened/closed/imported, and what remains blocked.>

## Current Mission

Active task:
<task id and task>

If active task is empty, `None`, or only says to preserve state:
<Do not stop after reading the docs. Complete the scan phase, then choose the
next actionable item from this project's TRACKER.md, GAPS.md,
docs/projects/GLOBAL_GAPS.md, or WORKFLOW_GAPS.md. Record the chosen item here
as the new active task before executing. If no actionable item exists, set
status to idle, leave Active task as "None - no actionable gap found on
<YYYY-MM-DD>", and write the resume trigger in Recent progress and Current
Mission.>

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

Bounded gap sweep:
<Check active task surface, touched files, nearby integrations, this project's
GAPS.md, docs/projects/GLOBAL_GAPS.md, WORKFLOW_GAPS.md, and inbound routed
gaps from known routing projects. If another project names this project as the
destination owner and no local gap row exists, add or explicitly reject/reroute
the inbound stub before closeout.>

Expansion radar:
<While executing, look for source-backed opportunities to expand or preserve
future work: missing capabilities, reusable systems, automation targets,
adjacent owner tasks, or scope boundaries worth keeping. Classify each
opportunity with the normal gap classifications and record it in TRACKER.md,
GAPS.md, or docs/projects/GLOBAL_GAPS.md. Do not widen the active slice unless
the opportunity is in_scope_now or support_needed_now. If no real expansion
opportunity appears, say what surfaces were checked.>

Blocking dependencies / do-not-touch:
<scope boundaries and sibling-project blockers>

Required-review handling:
<If this iteration discovers a human/product/policy blocker, mark the project
review-required only after creating or refreshing a `Required Review Brief` in
NORTH_STAR.md, TRACKER.md, or GAPS.md. That brief is the project-detail visual
decision segment; include the decision question, issue, current behavior,
blocked reason, options, evidence, decision owner, and proof-after-decision.
Once marked review-required, do not assign forward implementation agents until
the decision is recorded.>

Decision visualizations:
<If the required decision is user-facing or observable, create an isolated
"this is what I mean" visual page before requesting the decision. Register it
in a `Decision Visualizations` table in NORTH_STAR.md, TRACKER.md, or GAPS.md:
| Decision | Status | Visual page | Summary | Owner |
|---|---|---|---|---|
| <decision> | <draft/needs decision/approved/rejected> | <relative or /Aralia/ link> | <what the page shows> | <owner> |
If the decision is not visual, state why no visualization page is needed.>

Recent progress:
<brief handoff summary from the previous agent>

Idle registration:
<Use only when the scan finds no actionable project, global, or workflow gap.
Record the checked surfaces, set status/frontmatter to idle where project docs
use a status field, update docs/projects/PROJECT_TRACKER.md when it has a row
for this project, and state the next resume trigger. Do not mark the project
done, dormant, or paused unless the operator or source evidence says so.>

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, agent identity/runtime surface, active task, acceptance criteria,
key files, verification method, blockers, recent progress, workflow-gap review
result, expansion-radar result, dashboard-schema updates, active agent, pass
status, pass start time, and pass end time. Account for every required doc,
mention optional docs touched or skipped, update `agent_comments` only when an
out-of-flow note is useful, and keep only the current handoff between the same
BEGIN/END markers. Keep the iteration agent ledger as one compact row per
completed iteration; do not preserve old handoff transcripts in this file.
---END NEXT AGENT HANDOFF---
