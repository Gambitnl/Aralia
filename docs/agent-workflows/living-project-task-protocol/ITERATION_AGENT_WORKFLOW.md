# Iteration Agent Workflow

Status: active
Last updated: 2026-06-04

This is the shared workflow for every agent that performs an iteration pass on a
living project. Project-specific context belongs in
`docs/projects/<project-slug>/COLD_START_AGENT_PROMPT.md`; do not copy this
whole workflow into every project handoff file.

## Start Of Iteration

1. Read the project-specific `COLD_START_AGENT_PROMPT.md` first.
2. Read this shared workflow and
   `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
   Treat active workflow gaps as process-health warnings before choosing work.
3. Follow the handoff's project paths to read `NORTH_STAR.md`, `TRACKER.md`, and
   `GAPS.md`.
4. Read any optional supporting files named by the handoff or tracker:
   `DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`, and task docs under
   `tasks/`.
5. Read `docs/projects/PROJECT_CARD_SCHEMA.md` so dashboard-facing fields are
   updated from the documented schema instead of guessed from prose.
6. Treat `NORTH_STAR.md` as the durable scope and intent file. Treat
   `COLD_START_AGENT_PROMPT.md` as the current handoff packet.

## Choose The Work

1. Execute the highest-value open task from `TRACKER.md` end-to-end.
2. Implement the task unless the tracker explicitly says design-only.
3. If you deviate from the active tracker task, justify the deviation in one
   line and update the tracker so the next agent is not misled.
4. Do not widen the active slice just because adjacent work is visible. Record
   adjacent findings as gaps or follow-ups.

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
4. this project's `GAPS.md`
5. `docs/projects/GLOBAL_GAPS.md`
6. `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` for
   process-level ambiguity that affects the iteration workflow itself

Record real gaps found. If fewer than two related or unrelated gaps are real,
the final report must name the checked surfaces and state that no additional
real gap was found. Do not invent filler gaps.

Use the standard classifications:

- `in_scope_now`
- `support_needed_now`
- `adjacent_follow_up`
- `out_of_scope`
- `blocked_human_decision`
- `blocked_external_state`

Each durable gap needs classification, source evidence, owning tracker or
subsystem, owner or decision maker, next action, and next proof.

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
   and the `Dashboard Card Schema` section from
   `docs/projects/PROJECT_CARD_SCHEMA.md`.
2. `TRACKER.md`: task status, owner/actor, last updated date, blockers, next
   action, evidence or next proof.
3. `GAPS.md`: opened, closed, imported, routed, or reclassified gaps.
4. `COLD_START_AGENT_PROMPT.md`: next iteration handoff context.
5. `WORKFLOW_GAPS.md`: workflow-level ambiguity read, updated, or explicitly
   left unchanged because no workflow-level gap was found.
6. Optional files when relevant:
   `DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`, task docs.

If an optional file exists but was not updated, say why in the final report. If
it does not exist and is not needed, say it was not needed instead of creating
filler documentation.

## Documentation Size Discipline

Project docs are living state files, not iteration transcripts. After many
passes, they must remain useful to a cold-start agent.

Rules:

1. Update stable sections in place. Do not append a new full project narrative
   every iteration.
2. Keep only the latest `COLD_START_AGENT_PROMPT.md` handoff between the
   markers. The next agent needs current context, not ten old handoffs.
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
3. verification performed or skipped
4. bounded gap sweep surfaces checked
5. gaps recorded
6. workflow gaps read or updated
7. dashboard schema fields updated
8. documentation compaction performed or not needed
9. assumptions made
10. next safe resume action

Then output the refreshed project handoff between these markers:

```text
---BEGIN NEXT AGENT HANDOFF---
...
---END NEXT AGENT HANDOFF---
```

Do not add text after the `---END NEXT AGENT HANDOFF---` marker when the
handoff is intended for direct copy-paste into a cold-start agent.
