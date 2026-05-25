# Living Project Task Protocol

Status: reusable project-kickoff prompt and documentation setup pattern.

Use this file when starting a new project or substantial task from a cold start
and you want the project's operating architecture to be a living documentation
system. This is project-agnostic: it can be used for coding, content migration,
design systems, data cleanup, workflow repair, research, or any multi-step
project where future agents need to resume without relying on conversation
memory.

The purpose is not to make every project heavier. The purpose is to create a
small, explicit project skeleton first, then let task work leave behind a
reliable map of what changed, what remains, and where the next agent should
continue.

## Copyable Prompt

```md
I want to start a project using a living project task protocol.

Use this protocol as the project architecture:
1. Create a concise north-star document written to future agents.
2. Create a living operational tracker.
3. Split supporting detail into focused files instead of one monolithic doc.
4. Keep clear pointers between the north-star, tracker, task docs, gap records,
   decision logs, architecture notes, proof/audit records, and runbooks.
5. Advance the actual project work while updating documentation as reality
   changes.
6. Discover gaps as you work, classify them, and add them to the right tracker
   without letting discovery swallow the active task.
7. Preserve durable intent, decisions, evidence, and next actions; keep raw
   process exhaust external, ignored, or summarized.

Primary objective:
Bootstrap the project structure first, then begin the first bounded task inside
that structure. Do not shrink success to whatever is easiest to finish, and do
not let documentation work become a substitute for progressing the project.

Cold-start setup:
1. Ask only for missing information that blocks creating the initial project
   skeleton. Otherwise make reasonable assumptions and record them.
2. Choose a project folder/doc location that fits the repo or workspace.
3. Create the initial north-star doc.
4. Create the initial living tracker.
5. Add the first task slice or task queue rows.
6. Add scope boundaries, artifact rules, and a resume path.
7. If the project already has related docs/code, search them before creating a
   parallel structure.
8. If the project is genuinely new, state that the initial docs are scaffolds
   and should evolve as evidence appears.

Documentation structure:
1. Maintain a concise north-star document for the project.
   - Write it to future agents with no conversation history.
   - Explain the objective, intended outcome, current state, scope boundaries,
     key files, active tracker, evidence sources, assumptions, and exact resume
     path.
   - Keep it as the cold-start map, not a full archive.
2. Avoid monolithic documentation.
   - Split details into focused files when the work becomes complex:
     tracker, package docs, gap registry, decision log, audit/proof record,
     architecture note, runbook, or subsystem plan.
   - Each file should have one clear job.
3. Maintain clear pointers between docs.
   - The north-star doc points to the tracker, active task docs, architecture
     notes, decision logs, proof/audit files, and runbooks.
   - Detailed docs point back to the north-star or tracker when useful.
   - Superseded docs are marked as superseded and point to their replacement.
4. Maintain a living operational tracker.
   - Record active work, completed work, blockers, discovered gaps, adjacent
     follow-ups, out-of-scope findings, and next actions.
   - Use consistent statuses such as: not_started, active, waiting, blocked,
     done, superseded, out_of_scope.

During the task:
1. Work on the current bounded task as the main objective.
2. When reality reveals new information, update the relevant docs in the same
   pass.
3. If the first task reveals that the project skeleton is wrong, repair the
   skeleton rather than continuing with misleading docs.
4. Classify every discovered gap:
   - in_scope_now: required to complete the current task.
   - support_needed_now: not the product task, but needed so the task can move.
   - adjacent_follow_up: useful, but should not widen this slice.
   - out_of_scope: explicitly not part of this project/task.
   - blocked_human_decision: needs operator or owner choice.
   - blocked_external_state: waiting on another system, person, PR, job, or
     environment.
5. Fix small support gaps immediately when they are clearly needed, bounded,
   and safe.
6. For larger or adjacent gaps, record them in the living tracker or a focused
   gap file with enough context that a future agent can continue without
   rediscovering the issue.
7. Preserve future possibility. Do not delete unfinished intent, scaffolds, or
   branches of work just because they are messy or incomplete.
8. If a finding belongs to another subsystem, link to that subsystem's tracker
   instead of making the current tracker own everything.

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
5. If a raw artifact answers a future "what happened here?" question, promote
   only the useful summary into the appropriate doc.

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

Completion rule:
Before claiming the first setup pass or any later task is complete, verify both
the project outcome and the documentation state.

Confirm:
1. The project skeleton exists or the task outcome was tested/verified.
2. The north-star doc still points to the right resume path.
3. The tracker reflects current status, blockers, and next actions.
4. Any detailed docs touched by the work agree with the tracker.
5. Discovered gaps are classified and recorded in the right place.
6. Raw process artifacts were not promoted unless a concise durable summary was
   useful.

Final report:
Name the created/updated project docs, the first active task, verification
performed, gaps recorded, assumptions made, and anything intentionally left out
of scope.
```

## Cold-Start Outputs

For a brand-new project, the first pass should normally create or identify
these outputs before doing implementation-heavy work:

1. **North-star doc**: the future-agent entry point.
2. **Living tracker**: the operational task queue and gap log.
3. **Initial task slice**: the first bounded piece of real work.
4. **Scope boundaries**: what is in, adjacent, deferred, and out.
5. **Artifact boundary**: what gets preserved, ignored, or summarized.
6. **Resume path**: exact docs/files/commands the next agent should read.
7. **Assumptions/open questions**: what was assumed to start moving and what
   still needs an owner decision.

## File Roles

Use these roles as defaults. A project can rename them, but it should not blur
their jobs.

| File role | Purpose | What belongs there | What does not belong there |
|---|---|---|---|
| North-star doc | Cold-start entry point for future agents | Objective, scope, current state, resume path, key docs, boundaries | Full history, raw logs, every detailed task |
| Living tracker | Operational queue and status surface | Active tasks, statuses, blockers, gaps, next actions | Long transcripts, every tool event, raw artifacts |
| Package/task doc | Bounded slice definition | Scope, acceptance criteria, allowed files, verification, owner | Whole-project scope, unrelated follow-ups |
| Gap registry | Durable unresolved findings | Gap, evidence, why it matters, owner/next proof, status | Issues already handled in the active task |
| Decision log | Inspectable choices | Options, chosen path, rationale, mutation/skips, next proof | Raw receipts, unresolved work without tracker entries |
| Audit/proof doc | Evidence ledger | Verification commands, screenshots, result summaries, known limits | Unfiltered terminal output or generated dumps |
| Architecture note | System map | Ownership, file map, contracts, boundaries | Task status that belongs in the tracker |
| Runbook | Repeatable operator steps | Commands, prerequisites, expected outputs, failure handling | Project rationale or active queue state |

## Status Vocabulary

Prefer a small shared vocabulary so future agents do not guess what a row means.

| Status | Meaning |
|---|---|
| `not_started` | Known work, not active yet. |
| `active` | Work is being handled now. |
| `waiting` | Waiting for external checks, another actor, or scheduled follow-up. |
| `blocked` | Next action is known but cannot proceed until a blocker is removed. |
| `done` | Complete with evidence linked or summarized. |
| `superseded` | Replaced by another task, file, or decision. |
| `out_of_scope` | Recorded for awareness, but intentionally not part of this task. |

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

Rule: if a future agent needs the information to avoid rediscovery, summarize
it. If the future agent only needs to know that a tool event happened, leave the
raw event out unless the project explicitly requires an audit trail.

## Project Setup Checklist

When starting a new project with this protocol:

1. Name the project and its intended outcome in plain language.
2. Decide where the project docs live.
3. Create the north-star doc as the cold-start entry point.
4. Create the living tracker as the operational queue.
5. Add a concise resume path to the north-star doc.
6. Add a status vocabulary to the tracker.
7. Add initial scope boundaries, assumptions, and out-of-scope notes.
8. Add the first known task rows.
9. Add a gap section or point to a gap registry.
10. Add a decision log only if the project will involve meaningful path choices.
11. Add artifact rules: what is durable, what is ignored, what is summarized.
12. Start the first implementation slice only after the active objective and
    tracker are clear enough for another agent to resume.

## Anti-Patterns

Avoid these failure modes:

- one giant document that mixes objective, status, raw logs, decisions, and
  implementation notes
- a tracker that becomes a transcript
- a decision log that hides unresolved work
- deleting unfinished scaffolds just to make the task look cleaner
- marking a task done while the tracker still points to stale blockers
- letting adjacent discoveries silently expand the active slice
- preserving every generated artifact as if it were project intent
- relying on conversation memory as the only status source
- creating a new system before checking whether an unfinished one already
  exists

## Minimal Starter Template

Use this when a project is just beginning and does not yet need many files.
Create these two files first, then add focused supporting files only as the
project becomes complex enough to need them.

```md
# <Project Or Task> North Star

Status: active

## Objective

<What outcome are we trying to create?>

## Starting Assumptions

- <Assumption made so work can begin>

## Open Questions

| Question | Why it matters | Needed by |
|---|---|---|
| <question> | <why> | <date or task> |

## Scope Boundaries

In scope:
- <...>

Out of scope:
- <...>

## Resume Path

1. Read this file.
2. Read `<living-tracker-file>`.
3. Read `<active-task-or-package-file>`.
4. Verify current state with `<command or evidence source>`.

## Current State

<Short factual state summary. On first creation, say this is the initial
project scaffold and name what evidence still needs to be gathered.>

## Living Tracker

Use `<living-tracker-file>` for active work, statuses, blockers, gaps, and next
actions.

## Key Files

| File | Purpose |
|---|---|
| `<path>` | `<purpose>` |

## Supporting Docs

Create these only when needed:

| File | Purpose | Status |
|---|---|---|
| `<optional-path>` | `<why it exists>` | `<planned/active/done>` |

## Artifact Boundary

Track durable intent, decisions, verification summaries, and next actions.
Keep raw logs, generated files, temporary screenshots, caches, and local run
state external or ignored unless a concise summary is useful later.
```

```md
# <Project Or Task> Living Tracker

Status: active

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Evidence | Next action |
|---|---|---|---|---|---|
| T1 | active | <task> | <owner> | <evidence> | <next> |

## Gap Log

| Gap ID | Status | Classification | Found during | Gap | Why it matters | Next action |
|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | <task> | <gap> | <why> | <next> |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
```
