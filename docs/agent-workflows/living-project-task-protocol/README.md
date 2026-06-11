# Living Project Task Protocol

Status: reusable task-to-project conversion protocol.

Audience: cold-start or mid-task agents. This file is addressed to the agent
doing the conversion, not to the human operator.

Invocation trigger: use this protocol when the user says "convert this to the
living project format", "make this a living project", or asks to preserve an
expanding task for future cold-start agents.

You are reading this because an active task is behaving like a project: the
scope is growing, important context is scattered through the conversation,
future agents will need to resume cold, or a bounded task has uncovered enough
gaps that a single chat thread is no longer a safe source of truth.

The goal is not to make every task heavier. The goal is to convert real scope
creep into a small living project surface before context limits, stale memory,
or accidental narrowing damage the work.

The main project file is the **North Star**. It is the cold-start drop-in file
for a future agent. If the next agent can read only one file, the North Star
should prevent them from restarting discovery, duplicating work, shrinking the
project, or losing unfinished intent.

## Canonical Aralia Paths

For Aralia project iteration work, use these canonical paths. These are the
paths cold-start agents should read before selecting work:

```text
docs/projects/<project-slug>/NORTH_STAR.md
docs/projects/<project-slug>/TRACKER.md
docs/projects/<project-slug>/GAPS.md
docs/projects/<project-slug>/COLD_START_AGENT_PROMPT.md
docs/projects/<project-slug>/DECISIONS.md
docs/projects/<project-slug>/AUDIT_OR_PROOF.md
docs/projects/<project-slug>/RUNBOOK.md
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
docs/projects/PROJECT_CARD_SCHEMA.md
docs/projects/PROJECT_TRACKER.md
docs/projects/GLOBAL_GAPS.md
docs/projects/PROJECT_WORKFLOW_DOC_MIGRATION_NOTES.md
```

Template filenames under `docs/agent-workflows/living-project-task-protocol/templates/`
are scaffolds only. Do not treat generic names such as `PROJECT_NORTH_STAR.md`
or `PROJECT_REGISTRY.md` as live Aralia paths.

Workflow-doc normalization decisions for existing Aralia project folders are
tracked in `docs/projects/PROJECT_WORKFLOW_DOC_MIGRATION_NOTES.md`.

Supporting files exist only to make the North Star operational. The generic
roles are:

```text
NORTH_STAR.md              <- main cold-start entry point
TRACKER.md                 <- active queue, statuses, blockers, next actions
COLD_START_AGENT_PROMPT.md <- project-specific current handoff for the next agent
GAPS.md                    <- unresolved findings if too large for the tracker
DECISIONS.md               <- meaningful path choices only
AUDIT_OR_PROOF.md          <- verification summaries and proof ledger when needed
RUNBOOK.md                 <- repeatable commands or operator workflow when needed
```

## Agent Instructions

Treat the current task as expanding beyond a single bounded work session.
Convert it into a living project.

Follow this system as the project architecture:
1. Create or refresh a project-specific North Star document as the primary
   cold-start entry point for future agents.
2. Treat the North Star as the main file. It should preserve the objective,
   intended outcome, current state, active task, scope boundaries, critical
   evidence, known gaps, artifact rules, and exact resume path.
3. Create or refresh the required operational files: tracker, gap registry,
   and project-specific cold-start handoff. Keep shared workflow rules in
   `docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`
   instead of duplicating them in every project. Check
   `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` for
   process-level ambiguity before launching into implementation, and update it
   only when the workflow itself needs clarification across projects.
   Create or link optional supporting files only when they have a clear job:
   task docs, decision log, audit/proof record, architecture note, or runbook.
4. Keep clear pointers between the North Star, tracker, task docs, gap records,
   decision logs, proof records, architecture notes, and runbooks.
5. Continue the actual task after the project surface exists. Documentation
   setup is not a substitute for project progress.
6. Discover gaps as you work, classify them, and add them to the right tracker
   without letting discovery swallow the active task.
7. Preserve durable intent, decisions, evidence, and next actions; keep raw
   process exhaust external, ignored, or summarized.

Preflight before creating files:
1. Read the repo or workspace instructions that govern this task.
2. Read user/project calibration if the workspace provides one.
3. Search existing docs, code, trackers, roadmaps, architecture notes, and local
   memory/indexes for related or unfinished work.
4. Check the global gap tracker, if one exists, for pre-registered gaps that may
   belong to this project. In Aralia, use `docs/projects/GLOBAL_GAPS.md`.
5. Check the project registry, if one exists, for an existing project row. In
   Aralia, use `docs/projects/PROJECT_TRACKER.md`.
6. Identify the closest existing system, tracker, or scaffold.
7. If an existing project surface already owns the work, update it instead of
   creating a parallel project.
8. Choose the project file location before creating files. Do not dump project
   files in the repo or workspace root unless local instructions explicitly say
   that is the project-doc home.
9. Ask only for missing information that blocks a safe conversion. Otherwise
   make reasonable assumptions and record them in the North Star.

Sizing gate:
1. If the work only needs one durable reminder, add one row to the existing
   tracker or gap file.
2. If future agents need a cold-start map but the project is still small,
   create a North Star and a tracker.
3. If the work has multiple slices, durable gaps, or meaningful decisions, add
   focused supporting files only when each file has a clear job.

North Star requirements:
1. Write it for a future agent with no conversation history.
2. Explain why the project exists, the intended outcome, current state, active
   task, scope boundaries, critical files, evidence sources, assumptions, open
   questions, and exact resume path.
3. Name what must not be lost: unfinished intent, future optionality, known
   partial systems, accepted boundaries, or fragile evidence.
4. Keep it current and concise. It is the cold-start map, not a full archive.
5. Point to supporting files rather than copying their full contents.

Bounded active task requirements:
Before continuing implementation, define the active slice with:
1. task objective
2. acceptance criteria
3. allowed files, systems, or ownership boundaries
4. stop condition
5. verification command or evidence source
6. current owner or actor
7. next action

During the task:
1. Work on the current bounded task as the main objective.
2. When reality reveals new information, update the relevant docs in the same
   pass.
3. If the first task reveals that the project surface is wrong, repair the
   North Star and pointers before continuing with misleading docs.
4. Keep an active expansion radar while you work. At each meaningful discovery
   point, ask whether the evidence reveals a new project slice, missing
   capability, reusable system, automation opportunity, adjacent owner task, or
   scope boundary that should be preserved for future agents. Expansion radar
   is continuous, not only a closeout sweep.
5. Classify every discovered gap or expansion opportunity:
   - in_scope_now: required to complete the current task.
   - support_needed_now: not the product task, but needed so the task can move.
   - adjacent_follow_up: useful, but should not widen this slice.
   - out_of_scope: explicitly not part of this project/task.
   - blocked_human_decision: needs operator or owner choice.
   - blocked_external_state: waiting on another system, person, PR, job, or
     environment.
6. Fix small support gaps immediately when they are clearly needed, bounded,
   and safe.
7. For larger or adjacent gaps that belong to this project, record them in the
   living tracker or project gap file with source evidence, owner, next action,
   and next proof.
8. For gaps or expansion opportunities that do not belong to this project,
   record them in the global gap tracker with enough routing context that a
   later agent can decide whether to import, route, reject, or leave them
   unowned.
9. Preserve future possibility. Do not delete unfinished intent, scaffolds, or
   branches of work just because they are messy or incomplete.
10. If a finding belongs to another subsystem, link to that subsystem's tracker
   from the global row instead of making the current project own everything.

Evidence and artifact boundary:
1. Preserve durable intent, decisions, acceptance evidence, and next actions.
2. Do not preserve raw process exhaust by default.
3. Track concise summaries when they help future work:
   - what task was attempted
   - what changed
   - what passed or failed
   - what decision was made
   - why a boundary moved or stayed blocked
   - what should happen next
4. Keep transient artifacts external, ignored, or summarized:
   - raw logs
   - generated manifests
   - dashboard state
   - click receipts
   - cache files
   - temporary screenshots
   - local run state
   - tool-specific IDs that do not help future work
5. Promote raw or semi-raw proof only when the future agent cannot reasonably
   regenerate it, when it records visual/audit evidence, when it proves an
   external state such as PR/CI/vendor behavior, or when the project explicitly
   requires an audit trail. Promote the smallest useful excerpt or summary.

Decision handling:
1. Record meaningful decision points when the agent chooses between valid paths.
2. For each decision, capture:
   - decision point
   - options considered
   - decision made
   - rationale and evidence
   - mutation performed or skipped
   - resulting status
   - next expected proof
3. Do not let a decision log become the only home for unresolved work. If the
   decision creates a follow-up, put that follow-up in the tracker or gap file.

Completion checks:
Do not collapse setup, task, and project completion into one claim.

Setup is complete only when:
1. The North Star exists or the existing North Star was refreshed.
2. The North Star points to the right tracker, task docs, gaps, decisions,
   proof records, and resume path.
3. The active slice is defined clearly enough for another agent to resume.
4. Raw process artifacts were not promoted unless a concise durable summary or
   proof excerpt was useful.

The active task slice is complete only when:
1. Its acceptance criteria were met or explicitly revised with rationale.
2. Required verification was run or the missing verification is recorded as a
   blocker with next action.
3. The tracker reflects current status, blockers, owner, last update, next
   action, and evidence.
4. Discovered gaps are classified and recorded in the right place: project
   tracker/project gap file for in-project gaps, global gap tracker for
   out-of-project gaps.

The project is complete only when:
1. The intended outcome in the North Star has been satisfied.
2. Open gaps are done, superseded, or intentionally out of scope.
3. The tracker and supporting docs agree with the North Star.
4. The final evidence is linked or summarized.

Final report:
Report the created/updated North Star, supporting docs changed, active task
status, verification performed, gaps recorded, assumptions made, and anything
intentionally left out of scope.

## When To Convert A Task Into A Project

Convert when one or more of these are true:

- the task has multiple slices that future agents may need to resume
- the conversation contains important context that should survive compaction or
  thread limits
- implementation uncovered durable gaps, blockers, or decisions
- there is a risk of creating a parallel system because existing ownership is
  unclear
- raw tool output is accumulating but only a small summary belongs in the repo
- a future cold agent needs a reliable map before touching code or content

Do not convert when a single tracker row, issue comment, or short task doc would
preserve the needed context. Use the lightest durable structure that protects
the work.

## Sizing Options

| Size | Use when | Required output |
|---|---|---|
| Tracker row only | The work remains bounded and existing docs already own it. | One updated row with status, evidence, and next action. |
| North Star + tracker | A future cold agent needs a map and active queue. | North Star, tracker, active slice, resume path. |
| Full project surface | The project has multiple slices, durable gaps, path decisions, or proof records. | North Star plus focused supporting files as needed. |

## Project File Placement

Choose the project location before creating files. The protocol should create a
small project folder or update an existing owning folder, not scatter files at
the repository root.

Placement priority:

1. If an existing tracker, project folder, roadmap area, or subsystem doc
   already owns the work, update that location and link back to it from the
   North Star.
2. If the repo has a documented project-doc convention, follow it.
3. For Aralia project docs with no better owner, default to:
   `docs/projects/<project-slug>/`
4. For Aralia bounded package/task work that already belongs to an established
   domain, prefer the domain's task folder, for example:
   `docs/tasks/<domain>/<task-or-package-slug>/`
5. For non-Aralia workspaces with no convention, prefer:
   `docs/projects/<project-slug>/`

The project folder should normally contain the North Star and any supporting
files that project owns:

```text
docs/projects/<project-slug>/
  NORTH_STAR.md
  TRACKER.md
  GAPS.md
  COLD_START_AGENT_PROMPT.md
  DECISIONS.md
  AUDIT_OR_PROOF.md
  RUNBOOK.md
  tasks/
    <task-slice>.md
```

COLD_START_AGENT_PROMPT.md is required for every living project. It should be
project-specific handoff context that references
`docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`.
Only create supporting files such as DECISIONS.md, AUDIT_OR_PROOF.md, and RUNBOOK.md when
those roles are needed. If a project already has a shared
gap registry, decision log, audit record, or runbook elsewhere, link to that
owning file instead of creating a duplicate.

## Project Registry

Register every living project in the workspace project registry when one exists.
This keeps the project discoverable even when future agents do not know the
project folder name.

Default Aralia location:

```text
docs/projects/PROJECT_TRACKER.md
```

Registration rules:

1. Before creating a new project row, check whether the tracker already has a
   row for the same system, feature, task cluster, or planning area.
2. If a row exists, refresh it with the North Star path, current status, gap
   signal, evidence, and next step instead of adding a duplicate.
3. If a row exists but the project has no living-project docs yet, treat the row
   as the discovery anchor. Create the missing North Star and supporting files
   in the correct owning folder, then update the row to point to them.
4. If no row exists, add the project to the closest matching section. If no
   section fits, add a clearly named section rather than forcing the project
   into a misleading category.
5. The tracker row should point to the North Star and project gap file when they
   exist.
6. If global gaps were imported into the project, mention the imported global
   gap IDs in the row's gap signal or next step when useful.
7. Do not mark the project as complete in the registry merely because the
   living-project setup files were created.

## Upgrading A Preregistered Project

Sometimes `docs/projects/PROJECT_TRACKER.md` already has a project row, but the
project does not yet have a North Star, tracker, or gap file that conforms to
this protocol. In that case, do not create a second project. Upgrade the
registered project.

Upgrade path:

1. Treat the existing registry row as evidence that the project exists.
2. Use the row's evidence, gap signal, and next step to choose the owning folder.
3. Search for any existing docs or task files that should be linked rather than
   replaced.
4. Create the missing North Star first.
5. Create or link the living tracker and project gap file only when needed.
6. Check `docs/projects/GLOBAL_GAPS.md` for candidate gaps that belong to this
   project, then import only the ones that survive critical scope review.
7. Refresh the registry row so it points to the North Star, tracker, project gap
   file, imported global gap IDs, and next action.
8. Preserve the original project intent from the registry row. Do not shrink the
   project to only the current task just because the docs are new.

## North Star Responsibilities

The North Star is the project's main file. It should answer:

1. Why does this project exist?
2. What outcome is it trying to create?
3. What is true right now?
4. What active task should the next agent continue?
5. What scope boundaries prevent accidental widening or shrinking?
6. What unfinished intent or optionality must be preserved?
7. What evidence proves the current state?
8. What supporting files exist, and what is each file for?
9. What exact resume path should a cold agent follow?
10. What remains uncertain or blocked?

Keep the North Star current, not exhaustive. Move operational rows to the
tracker, unresolved findings to the gap file, path choices to the decision log,
and repeatable commands to the runbook.

## File Roles

Use these roles as defaults. A project can rename files, but it should not blur
their jobs.

| File role | Purpose | What belongs there | What does not belong there |
|---|---|---|---|
| North Star | Cold-start entry point and main project file | Objective, outcome, current state, active task, scope, resume path, key docs, evidence, boundaries | Full history, raw logs, every detailed task |
| Living tracker | Operational queue and status surface | Active tasks, statuses, owners, blockers, gaps, evidence, next actions, next checks | Long transcripts, every tool event, raw artifacts |
| Package/task doc | Bounded slice definition | Scope, acceptance criteria, allowed files, verification, owner, stop condition | Whole-project scope, unrelated follow-ups |
| Gap registry | Durable unresolved findings | Gap, classification, evidence/source, owning tracker, owner, next action, next proof, status | Issues already handled in the active task |
| Iteration workflow | Shared rules for all project iteration agents | Read order, work selection, scoped verification, bounded gap sweep, closeout rules, final report and handoff format | Project-specific current state or prior-agent handoff context |
| Cold-start agent prompt | Project-specific next-agent handoff | Iteration number, active task, acceptance criteria, key files, scoped verification, blockers, previous-agent context, recent progress, and link to ITERATION_AGENT_WORKFLOW.md | Full project history, raw logs, vague generic instructions, or duplicated workflow text |
| Decision log | Inspectable choices | Options, chosen path, rationale, mutation/skips, next proof | Raw receipts, unresolved work without tracker entries |
| Audit/proof doc | Evidence ledger | Verification commands, screenshots or proof references, result summaries, known limits | Unfiltered terminal output or generated dumps |
| Architecture note | System map | Ownership, file map, contracts, boundaries | Task status that belongs in the tracker |
| Runbook | Repeatable operator steps | Commands, prerequisites, expected outputs, failure handling | Project rationale or active queue state |

## Status Vocabulary

Prefer a small shared vocabulary so future agents do not guess what a row means.

| Status | Meaning |
|---|---|
| `not_started` | Known work, not active yet. |
| `active` | Work is being handled now. |
| `idle` | Project is alive and may resume, but the latest scan found no actionable project, global, or workflow gap. Do not dispatch another forward iteration until a new gap or operator task appears. |
| `waiting` | Waiting for external checks, another actor, or scheduled follow-up. Include a next check condition. |
| `blocked` | Next action is known but cannot proceed until a blocker is removed. Include owner and unblock condition. |
| `done` | Complete with evidence linked or summarized. |
| `superseded` | Replaced by another task, file, or decision. Link the replacement. |
| `out_of_scope` | Recorded for awareness, but intentionally not part of this task. |

Rows that are `active`, `waiting`, or `blocked` should include owner, last
updated date, next action, and evidence or next proof. Rows that are `done`
should include completion evidence. This prevents old tracker state from
looking current.

An empty or `None` active-task field is not a stop signal for an `active`
project. It means the next iteration agent must complete the scan phase, choose
the next actionable project/global/workflow gap if one exists, and record that
gap as the active task before executing. If no actionable gap exists, set the
project to `idle`, record the scan outcome in the North Star, tracker, project
tracker row when applicable, and cold-start handoff, and name the trigger that
would make the project actionable again.

## Gap Classification

Use these classifications when new work appears.

| Classification | Use when | Agent action |
|---|---|---|
| `in_scope_now` | The task cannot honestly complete without it. | Fold into the active plan and verify it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. | Fix if bounded; otherwise record as blocker. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. | Add to tracker/gap registry with next action. |
| `out_of_scope` | It should not be part of this project/task. | Record only if useful for future boundary clarity. |
| `blocked_human_decision` | A real owner/operator choice is needed. | Ask or leave a clear decision request. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. | Record evidence and next refresh/check condition. |

Every iteration must perform a bounded gap sweep. Check the active task
surface, touched files, nearby integration points, this project GAPS.md,
GLOBAL_GAPS.md, and inbound routes from known routing projects. Known routing
projects include `docs/projects/GLOBAL_GAPS.md`, architecture sweep docs,
code-modularization audits, and any project whose tracker or gap file names the
current project as the destination owner. During the sweep, also report whether
the iteration surfaced any real expansion opportunity: a new capability, system
owner, project slice, automation target, reuse path, or explicit boundary worth
preserving. Record real gaps found. If fewer than two related or unrelated gaps
are real, the final report must name the checked surfaces and state that no
additional real gap was found. If no expansion opportunity was found, say which
surfaces were checked and that no source-backed expansion opportunity appeared.
Do not invent filler gaps or speculative expansion just to satisfy the workflow.

Every durable gap should include:

1. classification
2. source evidence
3. owning tracker or subsystem
4. owner or decision maker
5. next action
6. next proof or refresh condition

## Global Gap Routing

Use the global gap tracker for gaps an agent discovers while working but that do
not clearly belong inside the active project's own scope.

Default Aralia location:

```text
docs/projects/GLOBAL_GAPS.md
```

The global gap tracker is a surfacing file shared by agents across projects. It
keeps out-of-project discoveries visible without forcing the active project to
own every issue the agent notices.

Routing rules:

1. Before creating or refreshing a living project, check the global gap tracker
   for rows that may already describe gaps in the project's scope.
2. Critically review each candidate. Do not import a global gap just because it
   is nearby; import it only when it belongs to the project objective,
   acceptance path, or explicit follow-up surface.
3. When a global gap belongs to the project, copy the actionable context into
   the project's tracker or `GAPS.md`, then mark the global row as `imported`
   and link the destination project gap ID.
4. When a global gap belongs to another established subsystem, mark the global
   row as `routed`, link that subsystem's tracker, and write a minimal inbound
   stub row into the destination project's `GAPS.md` in the same iteration.
   The stub must cross-reference the source gap ID, source tracker, evidence,
   classification, why it matters, next action, and next proof/check. A routed
   gap is not fully routed until the destination stub exists or the routing
   agent records why it could not be written.
5. When a gap is discovered during project work but is outside the active
   project's scope, add it to the global gap tracker instead of the project gap
   file.
6. Preserve the global row as routing history after import or routing. Do not
   silently delete it unless local instructions explicitly say to prune routed
   rows.

Routing projects that are not `GLOBAL_GAPS.md` follow the same obligation. If a
project such as a code-modularization audit, architecture sweep, or roadmap
review routes a gap to an owner project, the routing project must both record
the route in its own tracker/gap file and add the inbound stub row to the owner
project's `GAPS.md`.

## Iteration Pass Closing Rule

Every agent iteration that moves a living project forward must close by updating
or explicitly reporting on the project files. This keeps the dashboard honest
and prevents the North Star from drifting away from operational files.

Minimum closeout for every project iteration:

1. Refresh NORTH_STAR.md with current state, resume path, scope changes,
   evidence, and anything that must not be lost.
2. Refresh TRACKER.md with active task status, owner or actor, last updated
   date, blockers, next action, and evidence or next proof.
3. Refresh GAPS.md with every durable gap discovered or closed during the
   iteration, including classification, owner, next action, and next proof.
   If this iteration routes a gap to another owner project, also refresh that
   owner project's `GAPS.md` with an inbound stub row that links back to the
   source gap. If this project received an inbound route, acknowledge it,
   import it, route it onward, decline it with rationale, or leave an explicit
   next action.
4. Refresh COLD_START_AGENT_PROMPT.md with project-specific handoff context:
   next iteration number, previous-agent summary, active task, acceptance
   criteria, key files, scoped verification, blockers, and recent progress.
   Do not duplicate the shared workflow; link to ITERATION_AGENT_WORKFLOW.md.
5. Review optional supporting files and update any that are relevant:
   DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md, and bounded task docs under
   tasks/.
6. If an optional supporting file exists but was not updated, say why in the
   final report. If it does not exist and is not needed, report it as not needed
   instead of creating filler documentation.
7. Set the written Last updated: YYYY-MM-DD line on every touched project file.
   The dashboard uses those dates to show whether supporting files are aligned
   with the North Star.

The final report must include: files updated, files intentionally not updated,
verification performed or skipped, bounded gap sweep surfaces checked, gaps
recorded, assumptions made, and the next safe resume action.

## Durable Evidence Boundary

The tracker and docs should explain the project. They should not become a dump
of the tools used to work on it.

Durable:

- objective and scope
- acceptance criteria
- final or material PR links
- verification summaries
- meaningful decisions
- current blockers
- gap classifications
- next recommended actions
- concise summaries of important artifacts
- non-regenerable proof that future agents need

Usually transient:

- raw logs
- generated IDs
- generated manifests
- temporary screenshots
- dashboard state
- click receipts
- caches
- local run state
- unreviewed generated reports
- tool-specific data that does not change future decisions

Promote only the useful part of a transient artifact when it answers a future
"what happened here?" question, proves external state, captures visual/audit
evidence that cannot be regenerated, or is required by the project's audit
rules.

## Conversion Checklist

When converting an active task into a living project:

1. Name the project and intended outcome in plain language.
2. Read governing repo/workspace instructions and user calibration.
3. Search for existing docs, code, trackers, memory, and roadmaps before
   creating a parallel structure.
4. Check the global gap tracker for pre-registered gaps that may belong to this
   project. Import only the gaps that survive critical scope review.
5. Check the project registry for an existing row, or plan the new row's
   section and evidence.
6. Choose the owning folder before creating files.
7. If the registry row exists but living docs do not, upgrade that registered
   project instead of creating a duplicate project surface.
8. Choose the lightest sizing option that protects the work.
9. Create or refresh the North Star as the cold-start entry point.
10. Register or refresh the project row in the project registry.
11. Add a concise resume path to the North Star.
12. Create or update the living tracker with status vocabulary and stale-state
   controls.
13. Define the active bounded task with acceptance criteria, allowed boundaries,
   verification, stop condition, owner, and next action.
14. Add scope boundaries, assumptions, open questions, and out-of-scope notes.
15. Add a project gap section or point to a project gap registry.
16. Link the global gap tracker and record any imported global gap IDs.
17. Add a decision log only if the project involves meaningful path choices.
18. Add artifact rules: what is durable, what is ignored, what is summarized,
    and what proof may be promoted.
19. Resume project work once another agent could continue from the North Star
    without conversation memory.

## Anti-Patterns

Avoid these failure modes:

- treating documentation setup as project completion
- one giant document that mixes objective, status, raw logs, decisions, and
  implementation notes
- a North Star that becomes a full archive instead of a cold-start map
- a tracker that becomes a transcript
- a tracker row with no owner, evidence, next action, or staleness signal
- a decision log that hides unresolved work
- deleting unfinished scaffolds just to make the task look cleaner
- marking a task done while the tracker still points to stale blockers
- letting adjacent discoveries silently expand the active slice
- preserving every generated artifact as if it were project intent
- relying on conversation memory as the only status source
- creating a new system before checking whether an unfinished one already
  exists

## Templates

Use these as copyable starting points. Start with the North Star and living
tracker. Add the other files only when the project needs that supporting role.

| Template | Use when |
|---|---|
| [NORTH_STAR.md](./templates/NORTH_STAR.md) | The project needs a cold-start drop-in file. |
| [LIVING_TRACKER.md](./templates/LIVING_TRACKER.md) | The project needs an active queue, blockers, and next actions. |
| [TASK_SLICE.md](./templates/TASK_SLICE.md) | A bounded task needs acceptance criteria, allowed boundaries, and verification. |
| [GAPS.md](./templates/GAPS.md) | Durable unresolved findings are too large for the tracker alone. |
| [ITERATION_AGENT_WORKFLOW.md](./ITERATION_AGENT_WORKFLOW.md) | Shared workflow all project iteration agents must follow. |
| [COLD_START_AGENT_PROMPT.md](./templates/COLD_START_AGENT_PROMPT.md) | Every living project needs project-specific next-agent handoff context. |
| [GLOBAL_GAPS.md](./templates/GLOBAL_GAPS.md) | The workspace needs a shared surfacing tracker for cross-project or orphaned gaps. |
| [DECISIONS.md](./templates/DECISIONS.md) | The project has meaningful path choices to preserve. |
| [AUDIT_OR_PROOF.md](./templates/AUDIT_OR_PROOF.md) | Verification summaries or non-regenerable proof need a focused record. |
| [RUNBOOK.md](./templates/RUNBOOK.md) | Repeatable operator steps need to survive beyond the conversation. |
