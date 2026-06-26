# Iteration Agent Workflow

Status: active
Last updated: 2026-06-22

This is the shared workflow for every agent that performs an iteration pass on a
living project. Project-specific context belongs in
`docs/projects/<project-slug>/COLD_START_AGENT_PROMPT.md`; do not copy this
whole workflow into every project handoff file.

## Start Of Iteration

1. Read the project-specific `COLD_START_AGENT_PROMPT.md` first. This is the
   handoff index that tells you which project files own the pass.
2. Identify yourself before selecting work. Record:
   - agent/model name if available
   - runtime surface: CLI agent, application agent, browser/app-embedded agent,
     MCP/subagent, or unknown
   - system clue used to classify the surface, such as shell-only terminal,
     app browser context, Codex desktop context, MCP handoff, or explicit
     operator statement
   - whether the classification is certain or inferred
   If the surface cannot be determined safely, write `runtime surface:
   unknown` and record the uncertainty in the final report. Do not invent a
   specific runtime identity.
3. Before deeper project reading or task selection, write pass-start telemetry
   into the project dashboard schema fields in `NORTH_STAR.md` or `TRACKER.md`
   frontmatter when those files are available:
   - `active_agent`: your agent/model name, or the safest available runtime
     identity
   - `agent_pass_status`: `in_progress`
   - `agent_pass_started_at`: local timestamp for this pass start
   - `agent_pass_ended_at`: empty while the pass is active
   If the files cannot be edited yet, continue only far enough to identify the
   blocker, then report the missing pass-start update in the final response or
   handoff.
4. Read this shared workflow and
   `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
   Treat active workflow gaps as process-health warnings before choosing work.
5. Follow the handoff's project paths to read `NORTH_STAR.md`, `TRACKER.md`, and
   `GAPS.md`.
6. Read any optional supporting files named by the handoff or tracker:
   `DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`, and task docs under
   `tasks/`.
7. Read `docs/projects/PROJECT_CARD_SCHEMA.md` so dashboard-facing fields are
   updated from the documented schema instead of guessed from prose.
8. Read the `required_docs` and `optional_docs` lists from the project schema.
   Account for every required doc in the final report, even when a supporting
   doc was not changed because it was not relevant this iteration.
   If `schema_version` frontmatter is missing, either add the frontmatter during
   doc-refresh work or record schema migration as a project gap.
9. Treat `NORTH_STAR.md` as the durable scope and intent file. Treat
   `COLD_START_AGENT_PROMPT.md` as the current handoff packet.

## Choose The Work

1. Complete the scan phase before deciding that there is no work. Read the
   handoff, workflow, North Star, tracker, gap files, global gaps, workflow
   gaps, and required schema docs named in Start Of Iteration.
2. If the handoff names a concrete active task, execute the highest-value open
   task from `TRACKER.md` end-to-end.
3. If the active task field is `None`, empty, stale, or only says to preserve
   state, treat that as a decision gate, not a terminal stop. Pick the next
   actionable item from this project's `GAPS.md`, `TRACKER.md`,
   `docs/projects/GLOBAL_GAPS.md`, or `WORKFLOW_GAPS.md`; record it as the new
   active task in `COLD_START_AGENT_PROMPT.md` before executing.
4. If no actionable project, global, or workflow gap appears after the read
   scan, do not register the project as `idle` yet. First perform the active
   edge-case sweep described in Bounded Gap Sweep against adjacent components,
   integration points, state boundaries, and recent project changes. Only when
   that active probing finds no actionable work may the agent register the
   project as `idle` instead of repeating a scan-only iteration. Refresh the
   tracker, North Star/frontmatter, project tracker row when applicable, and
   cold-start handoff so the next dispatcher sees that the project is alive but
   currently has no safe forward slice. Do not mark the project `done`,
   `dormant`, or `paused` without explicit evidence or human direction.
5. Implement the selected task unless the tracker explicitly says design-only.
6. If you deviate from the active tracker task, justify the deviation in one
   line and update the tracker so the next agent is not misled.
7. Do not widen the active slice just because adjacent work is visible. Record
   adjacent findings as gaps or follow-ups.
8. Keep an active expansion radar while executing the selected task. When a
   source file, doc, test, proof result, or integration point reveals a
   source-backed opportunity to widen the project later, create a follow-up in
   the project tracker/gap file or route it to `docs/projects/GLOBAL_GAPS.md`.
   Expansion radar does not authorize widening the current slice unless the
   finding is classified `in_scope_now` or `support_needed_now`.
9. If the task becomes blocked by a required human/product/policy review, stop
   forward implementation for that project and create or refresh a
   `Required Review Brief` in the project docs using the schema in
   `docs/projects/PROJECT_CARD_SCHEMA.md`. The brief is the dashboard decision
   segment: it must explain the issue visually enough for the project detail
   page to show what needs to be decided, not just say "blocked."
   If the decision is about a user-facing UI, layout, interaction, wording,
   visual style, map surface, or other observable experience, also create an
   isolated decision visualization page that shows "this is what I mean" before
   asking for the decision. Register that page in a `Decision Visualizations`
   table in `NORTH_STAR.md`, `TRACKER.md`, or `GAPS.md`.
10. Once a project is marked `review-required`, `human-review-required`,
   `policy-review-required`, or has `human_decision_required: yes`, do not
   assign it to another forward-iteration agent until the required decision is
   recorded.

## Continuous Expansion Radar

Every iteration agent must look for expansion opportunities while working, not
only during closeout. Expansion opportunities are source-backed discoveries
that could grow, preserve, or route future work, including:

1. a missing capability or project slice exposed by the active task
2. a reusable system, scaffold, adapter, test harness, or automation path
3. an unfinished intent branch that should not be collapsed into cleanup
4. a cross-project owner or global gap that should be routed
5. an explicit boundary that protects the active slice from accidental
   shrinkage or uncontrolled widening

When an opportunity appears, classify it with the normal gap classifications.
Act on `in_scope_now` and `support_needed_now` only when needed for the current
slice. Record `adjacent_follow_up`, cross-project, and out-of-scope
opportunities in the owning tracker, project `GAPS.md`, or
`docs/projects/GLOBAL_GAPS.md`. If no source-backed expansion opportunity
appears, say that in the final report; do not invent speculative work.

## Verification Standard

1. Use scoped verification from `TRACKER.md`, `NORTH_STAR.md`, or the task
   doc. Do not default to broad repo-wide checks unless the task requires them.
2. A task is not done until the scoped verification is run or the missing check
   is recorded as a blocker with next action.
3. If the change is observable, collect empirical proof: browser inspection,
   screenshot, deterministic replay, captured log, or other visible evidence.
4. Record durable verification summaries in `AUDIT_OR_PROOF.md` when proof
   should survive the chat. Keep raw logs out unless a concise excerpt is needed.

## Bounded Gap Sweep

Every iteration must perform a bounded gap sweep. Check:

1. the active task surface
2. files touched this iteration
3. nearby integration points named by the tracker or North Star
4. closely coupled adjacent files/components, including unedited files that
   call into, are called by, render beside, or share state with the active task
   surface
5. recent commits or handoff notes for this project that may have changed
   assumptions around the active surface
6. this project's `GAPS.md`
7. `docs/projects/GLOBAL_GAPS.md`
8. `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` for
   process-level ambiguity that affects the iteration workflow itself
9. inbound routed gaps from known routing projects, including
   `code-modularization-audit`, architecture sweep docs, global gaps, roadmap
   reviews, or any tracker/gap file that names this project as the destination
   owner
10. expansion opportunities observed while executing the task, including
   missing capabilities, reusable systems, automation opportunities, adjacent
   owner tasks, and scope boundaries worth preserving

The sweep must include active edge-case or chaos probes when the project has an
observable UI, command flow, state machine, data parser, integration boundary,
or other executable behavior. Do not rely only on static reading or the files
you changed. Try representative invalid states, unusual action order, missing
or stale data, disabled/loading/error states, and adjacent controls or callers
that share the same state. Keep the probes bounded to the active project
surface, but make them adversarial enough to test whether nearby unedited code
actually holds.

Record real gaps found. If fewer than two related or unrelated gaps are real,
the final report must name the checked surfaces and state that no additional
real gap was found. Also state whether a source-backed expansion opportunity
was found; if none was found, name the checked surfaces and do not invent one.
If the agent claims no additional real gaps, gap-free, or idle, the final
report must also name the active edge-case/chaos probe vectors used and the
result. If no active probe was possible, explain the concrete reason and avoid
calling the project gap-free.

Use the standard classifications:

- `in_scope_now`
- `support_needed_now`
- `adjacent_follow_up`
- `out_of_scope`
- `blocked_human_decision`
- `blocked_external_state`

Each durable gap needs classification, source evidence, owning tracker or
subsystem, owner or decision maker, next action, and next proof.

If an inbound routed gap is already represented in this project's `GAPS.md`,
acknowledge it in the sweep result and continue from the existing row. If a
known routing project names this project as destination owner but no local row
exists, add a stub row with the source gap ID, source tracker, classification,
evidence, why it matters, next action, and next proof/check before closing the
sweep. If the route is wrong, record a declined/rerouted note with rationale
instead of silently ignoring it.

## Workflow Gap Detection

Use `WORKFLOW_GAPS.md` for workflow-level issues only. A workflow gap is a
problem in the iteration process itself: unclear wording, unsafe required
assumptions, missing proof guidance, unclear closeout rules, or repeatable
ambiguity that could affect agents on multiple projects.

Do not put project-specific blockers here. If the blocker concerns one
project's product scope, missing implementation, or local evidence, record it
in that project's `GAPS.md`. If it concerns a repo-wide product or codebase
gap, record it in `docs/projects/GLOBAL_GAPS.md`.

When you encounter a workflow gap:

1. Check whether `WORKFLOW_GAPS.md` already has the same issue.
2. If it exists, add a dated `+1` testimony that explains your project context,
   what instruction was ambiguous, why it is the same issue, and what
   assumption you avoided or had to make.
3. If it is new, open a new `WFG-*` entry using the template in
   `WORKFLOW_GAPS.md`.
4. If the gap is `blocking`, stop before implementation unless the operator has
   already approved a safe interpretation.
5. Mention any workflow-gap read, update, or non-update in the final report.

## Required Closeout Updates

Before ending the iteration, update or explicitly report on:

1. `NORTH_STAR.md`: current state, scope changes, resume path, key evidence,
   and the structured dashboard schema from
   `docs/projects/PROJECT_CARD_SCHEMA.md`.
   Keep `gap_signal` dashboard-readable: it must begin with `0 open gaps`,
   `1 open gap`, or `<N> open gaps` before any explanatory details. Do not
   replace the count with prose such as "all gaps resolved" or "open gaps
   remain"; those phrases can follow the parseable count after a semicolon.
   Also update pass telemetry: keep `active_agent` and
   `agent_pass_started_at`, set `agent_pass_status` to the true closeout state
   (`finished`, `blocked`, `waiting`, `review_required`, `idle`, or another
   explicit local status), and set `agent_pass_ended_at` to the local closeout
   timestamp.
2. `TRACKER.md`: task status, owner/actor, last updated date, blockers, next
   action, evidence or next proof.
3. `GAPS.md`: opened, closed, imported, routed, or reclassified gaps. When this
   iteration routes a gap to another owner project, update the destination
   owner's `GAPS.md` with a minimal inbound stub row in the same pass. A routed
   gap is not complete unless the owner stub exists or the closeout explains
   why it could not be written.
4. `COLD_START_AGENT_PROMPT.md`: next iteration handoff context.
   If no actionable work remains after the read scan and active edge-case
   sweep, set the mission to an explicit idle handoff: status `idle`, active
   task `None - no actionable gap found on YYYY-MM-DD`, recent progress naming
   the scan surfaces, active probe vectors, and next resume trigger such as
   "resume only when a new project/global/workflow gap is registered or the
   operator supplies a new task."
5. `WORKFLOW_GAPS.md`: workflow-level ambiguity read, updated, or explicitly
   left unchanged because no workflow-level gap was found.
6. Optional files when relevant:
   `DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`, task docs.
7. For any required-review gate opened or preserved this iteration, verify that
   a `Required Review Brief` exists in `NORTH_STAR.md`, `TRACKER.md`, or
   `GAPS.md` with the decision question, current behavior, blocked reason,
   options, evidence, decision owner, and proof-after-decision. Mention in the
   final report which file supplies the dashboard decision segment.
8. For any user-facing required-review choice, verify that a decision
   visualization page exists and that the project docs include a
   `Decision Visualizations` table row with decision, status, visual page,
   summary, and owner. If no visual page is needed, state why the decision is
   non-visual in the final report.

If an optional file exists but was not updated, say why in the final report. If
it does not exist and is not needed, say it was not needed instead of creating
filler documentation.

Use the schema `agent_comments` field only for concise notes that sit outside
the normal closeout flow. If the note identifies reusable workflow ambiguity,
also update `WORKFLOW_GAPS.md`; do not hide workflow gaps inside comments.

If the project appears duplicate, superseded, corrupted, reference-only, or
archive-worthy, do not delete it. Add or update lifecycle/deprecation schema
fields and route evidence to `docs/projects/PROJECT_DEPRECATION_REVIEW.md`.

## Documentation Size Discipline

Project docs are living state files, not iteration transcripts. After many
passes, they must remain useful to a cold-start agent.

Rules:

1. Update stable sections in place. Do not append a new full project narrative
   every iteration.
2. Keep only the latest `COLD_START_AGENT_PROMPT.md` handoff between the
   markers. The next agent needs current context, not ten old handoffs.
   Keep the compact iteration agent ledger table, but store one short row per
   iteration only: iteration number, agent/model, runtime surface, certainty,
   and date. Do not paste full final reports into the ledger.
3. Keep `NORTH_STAR.md` focused on current scope, state, boundaries, evidence,
   and resume path. Compress stale history into one short historical summary
   when it stops helping direct work.
4. Keep `TRACKER.md` as the active queue plus concise closed/deferred rows.
   Avoid duplicate rows for the same task.
5. Keep `GAPS.md` one-entry-per-gap. Add dated testimony/status notes to the
   existing entry instead of opening duplicate gaps.
6. Keep `AUDIT_OR_PROOF.md` to durable proof summaries. Do not paste raw logs
   unless a short excerpt is the evidence.
7. Around every tenth iteration, perform a compaction pass before closeout:
   remove repeated handoff prose, compress stale progress notes, and preserve
   only decisions, evidence, open gaps, and next actions.

## End Of Iteration Response

End with a concise report covering:

1. files updated
2. files intentionally not updated
3. agent identity and runtime surface, including whether it was certain or
   inferred
4. verification performed or skipped
5. bounded gap sweep surfaces checked, including adjacent components and active
   edge-case/chaos probe vectors when no new gap is found
6. expansion opportunities found, routed, or explicitly not found
7. gaps recorded
8. workflow gaps read or updated
9. dashboard schema fields updated, including active agent, pass status, start
   time, and end time
10. required docs accounted for
11. optional docs touched, skipped, or not present
12. documentation compaction performed or not needed
13. agent comments added or intentionally left empty
14. assumptions made
15. next safe resume action

Before replacing the handoff, update the compact iteration agent ledger in
`COLD_START_AGENT_PROMPT.md`. Add exactly one row for the completed iteration
with the agent/model, runtime surface, certainty, date, and source clue. This
ledger is what the project UI uses for the iteration counter popup.

Then output the refreshed project handoff between these markers:

```text
---BEGIN NEXT AGENT HANDOFF---
...
---END NEXT AGENT HANDOFF---
```

Do not add text after the `---END NEXT AGENT HANDOFF---` marker when the
handoff is intended for direct copy-paste into a cold-start agent.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md","sha256WithoutMarker":"d53cce2ca89853c1ca4c022f05f7732b4e544649263dfba4ff3806be871043e3","markedAtUtc":"2026-06-25T22:57:26.953Z"} -->
