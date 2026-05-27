# Project Symphony North Star

Status: active top-level objective and navigation map for Project Symphony.

You are the next agent on Project Symphony. Start here. Treat this file as
your cold-start briefing, the prompt you resume from, and the map you use
before you touch anything else. It gives you the top-level objective, the
workflow shape, the latest project snapshot, the folder map, and the links you
need to continue without prior conversation history.

Use this file when you need the project-level answer to:

1. what Symphony is trying to become;
2. how the Codex/Jules workflow is supposed to work;
3. what has already been proven;
4. what remains open;
5. where the relevant folders and docs live.

Do not treat this file as the task tracker, the operating spec, or the audit.
It is your north star: the map that points you at the living docs.

## New Agent Resume Path

If you are starting here with no prior conversation history, read these in
order:

1. `conductor/symphony/docs/SYMPHONY_NORTH_STAR.md` - the project objective,
   folder map, and restart guide.
2. `conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md` - the workflow
   contract and completion rules.
3. `conductor/symphony/docs/SYMPHONY_MIDDLEMAN_ARCHITECTURE.md` - the code and
   ownership map.
4. `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md` - the current evidence ledger
   and remaining gaps.
5. `conductor/symphony/docs/tasks/SYMPHONY_OPEN_TASKS.md` - the current live
   Symphony queue and proof order.
6. `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` - the proving-ground task
   tracker and gap log.
7. `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md` - the
   proving-ground decision entry point and logging policy.
8. `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md` - the
   extracted decision lessons, resolution states, and remaining workflow gaps.

After that, use the linked living docs for the exact latest status. This north
star is the map; the audit, task queue, and trackers are the live state.

## Top-Level Objective

Project Symphony is meant to become a dashboard-first orchestration layer that
lets an operator state a bounded task once and then have Codex coordinate that
task through visible, durable workflow steps while Jules handles the
implementation-heavy work that is suitable for delegation.

You are building a system where:

- Codex acts as the foreman and orchestrator, not as the default bulk
  implementer.
- Symphony is the operator-facing dashboard, task tracker, and evidence layer.
- Jules receives bounded, visible handoffs for implementation work that is
  cheaper or safer to offload.
- Linear, GitHub, deployment, and local sync advance through explicit workflow
  boundaries instead of hidden side channels.
- Durable Aralia-facing task docs stay in GitHub; transient Symphony runtime
  state, raw receipts, and scratch artifacts stay external or ignored unless a
  short summary is intentionally needed for future contributors.
- Every live task is also a workflow test. When task execution exposes
  dashboard friction, stale instructions, missing proof, unclear ownership, or
  repeated decision ambiguity, the Codex foreman should either repair that
  workflow/documentation issue in the same pass or record the gap in the
  owning live tracker before moving on.

## How We Achieve It

You get there by moving through a staged workflow:

1. Capture the task in Symphony.
2. Clarify scope with a Codex foreman when the task is ambiguous or needs a
   bounded plan.
3. Create or link the Linear issue that anchors the work.
4. Stage the Jules manifest and launch or refresh Jules through the visible
   dashboard path.
5. Watch the Jules session, GitHub PR, checks, review, deployment, and local
   sync from the same workflow surface.
6. Record the proof and the decision trail in durable docs so later foremen can
   understand what happened without replaying the entire thread.

This is a dual responsibility, not a later cleanup phase: progress the bounded
task and keep the workflow/docs true while doing it. If fixing a workflow issue
would cross an external boundary or derail the active task, log the gap with an
owner, location, and next proof target in the audit, open queue, or proving
ground tracker.

You are validating that approach with the spell execution project as the
proving ground. The spell work is not the product goal by itself; it is the
bounded domain you use to prove that the Symphony workflow can move real work
forward.

## What We Have Made So Far

You already have the core pieces needed for a dashboard-first foreman flow:

- dashboard-backed task intake and task-draft tracking
- task navigator and task detail surfaces
- visible Codex/Jules handoff boundaries
- Linear issue linking
- Jules manifest staging and launch support
- PR, check, deployment, and local sync observation
- task-scoped messages, clarifications, and disposition records
- browser follow-along guidance for visible Jules inspection
- a task-level Delegation ROI ledger that keeps measured facts separate from
  estimates

You have also used the proving-ground spell project to validate the workflow in
practice. Spell Phase 1 now has durable packets, a living task tracker, an
artifact lifecycle policy, and the project-level decision/report trail needed
to keep the work understandable for future contributors.

## Current Status Snapshot

As of the latest verified docs, assume:

- The Symphony workflow project is still active and is tracked by the living
  audit plus the open-task queue.
- The Symphony progress doc set currently contains the operating spec,
  architecture map, open task queue, audit, and proof tasks that define the
  live workflow.
- Spell Phase 1 remains the active proving ground: Packages 2 through 6 have
  been used to exercise the Symphony/Jules path, with the exact current package
  frontier and remaining adjacent gaps tracked in
  `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`.
- Much of Symphony's runtime byproduct is intentionally untracked. Do not use
  local runtime artifacts as a substitute for the live queue, audit, or task
  tracker.

## North Star Gap Registry

If you understand the general objective but are missing x, y, or z before you
can move forward, write the gap here in first person. This section is for the
project-level pause that sounds like: "I understand the objective, but I am
missing x, y, and z."

Use this section for project-level missing context, not task-level
implementation gaps. If you need a concise restatement before switching into
the live tracker, audit, or task docs, write it here first.

When you register a gap, make it immediately usable by the next agent:

1. say what you already understand;
2. say exactly what is missing;
3. say why the missing piece blocks you;
4. say which live doc you will inspect next.

| Gap | What is missing | Why it matters | Where to look next | Status |
|---|---|---|---|---|
| Project objective | A clear one-paragraph summary of what Symphony is supposed to become | Without the objective, you may optimize the wrong workflow or treat the proving ground as the product | `## Top-Level Objective` | resolved |
| Current live state | The latest verified status of the Symphony workflow and the proving-ground spell project | You need to know what is already proven before changing anything | `## Current Status Snapshot` plus the live audit and trackers | resolved |
| Ownership boundary | Which parts are tracked source and which parts are intentionally local/runtime state | Without this boundary, you may commit transient orchestration junk or ignore durable docs | `## Where The Files Live` plus `.gitignore` | resolved |
| Missing specifics to continue | The exact x/y/z details that are still unclear even after reading the north star | This is the right place for a resume-blocking project gap before moving to the living trackers | Add a row here with the exact missing context and then route to the live docs below | write here |

If the gap is really about active work rather than project framing, move it to
the live source of truth instead of keeping it here:

- Symphony workflow gaps belong in `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
  or `conductor/symphony/docs/tasks/SYMPHONY_OPEN_TASKS.md`
- Spell Phase 1 gaps belong in `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- Spell decision history starts at
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`.
  Exact historical entries live in that file's linked archive; reusable lessons
  belong in `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md`.

## What Still Needs To Be Done

Your remaining work is not to invent a second workflow. It is to keep proving
and hardening the existing one:

- finish or retire the remaining entries in the Symphony open-task queue
- keep the operating spec, architecture map, audit, and task queue synchronized
  as the workflow changes
- continue using bounded tasks to prove the orchestration model beyond the
  spell proving ground
- treat workflow/documentation friction discovered during task execution as
  part of the live slice: repair it when bounded, or log it with an owner and
  next proof target when repair would derail the task or cross a guarded
  boundary
- keep separating durable documentation from transient Symphony runtime state
- keep the north-star, audit, and task trackers current as the system evolves

## Where The Files Live

Much of Symphony's operational byproduct is intentionally not tracked in Git.
The tracked parts are the source files, docs, and verifiers that define and
prove the workflow. The untracked parts are the runtime state, generated
manifests, click receipts, raw local receipts, local dashboard state, and other
scratch artifacts that would only distract future contributors if they were
committed as if they were durable design intent. If a receipt matters to future
Aralia work, promote only the useful summary into the package tracker, package
packet, audit, or open queue.

### Project Symphony Code And Runtime

- `conductor/symphony/src/` - orchestration, server, task intake, and worker
  runtime code
- `conductor/symphony/public/` - dashboard shell, browser controller, and
  visual styling
- `conductor/symphony/scripts/` - proof scripts and verifier coverage
- `conductor/symphony/WORKFLOW.md` - live workflow configuration used by the
  runtime
- `.symphony/`, `.jules/`, generated manifests, and local run state are
  intentionally local-only unless a specific packet or migration note says
  otherwise.

### Project Symphony Docs

- `conductor/symphony/docs/` - architecture, operating spec, task queue, and
  proof docs
- `conductor/symphony/README.md` - operator-facing quick start and repo entry
- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md` - evidence-based progress
  ledger and remaining gaps
- `conductor/symphony/docs/SYMPHONY_NORTH_STAR.md` - this entry point and
  your cold-start resume guide

### Proving-Ground Project Docs

- `docs/tasks/spells/` - Spell Phase 1 plans, packets, tracker, policy, and
  closeout material
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` - live Spell Phase 1 task
  tracker and adjacent gap log
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` - Spell Phase 1
  artifact retention and runtime-state policy
- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md` -
  the short decision-report entry point for the Spell Phase 1 flow
- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_DECISION_TRENDS_INDEX.md` -
  the operator-facing trend index for repeated decision patterns
- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md` -
  the extracted lesson matrix with implementation status and remaining gaps

## Proving-Ground Project: Spell Phase 1

Spell Phase 1 is the proving ground that validated the Symphony workflow on a
real bounded domain. It used cantrips and levels 1-3 to prove the selection,
preparation, visibility, and combat-simulator path while also exercising the
Jules/Linear/GitHub/dashboard handoff flow.

### Docs

- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- `docs/tasks/spells/PACKAGE_3_SPELL_SELECTION_AND_SPELLBOOK_VISIBILITY.md`
- `docs/tasks/spells/PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`

### Task Tracker

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`

### Gap Registry

- The Spell Phase 1 gap registry lives in the tracker’s `Adjacent Gap Log`.

### Progress Reports

- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_DECISION_TRENDS_INDEX.md`
- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md`
- package closeout sections inside the P3/P4 packet docs
- linked PRs and verification receipts referenced by the tracker

## Symphony Progress

The Symphony progress track is the workflow project itself: the dashboard,
operating spec, task queue, architecture, audit, and proof documents that keep
the orchestration system honest.

### Docs

- `conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`
- `conductor/symphony/docs/SYMPHONY_MIDDLEMAN_ARCHITECTURE.md`
- `conductor/symphony/README.md`

### Task Tracker

- `conductor/symphony/docs/tasks/SYMPHONY_OPEN_TASKS.md`

### Progress Reports

- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
- `conductor/symphony/docs/tasks/01-integration-health-checks.md`
- `conductor/symphony/docs/tasks/02-linear-creation-proof.md`
- `conductor/symphony/docs/tasks/03-jules-manifest-staging-proof.md`
- `conductor/symphony/docs/tasks/04-jules-launch-readiness-and-launch-proof.md`
- `conductor/symphony/docs/tasks/05-dispatch-toggle-real-worker-proof.md`
- `conductor/symphony/docs/tasks/06-dynamic-worker-mode-consumption-proof.md`

## How To Use This With The Other Docs

- Use this north-star doc to understand the project objective and document
  boundaries.
- Use the north-star doc's resume path when you are starting from scratch or
  picking up the project without prior conversation history.
- Use the north-star gap registry when you know the broad objective but need
  to record the missing x/y/z before you move into the live task tracker or
  audit.
- Use `JULES_MIDDLEMAN_OPERATING_SPEC.md` when you need the behavioral
  contract.
- Use `SYMPHONY_MIDDLEMAN_ARCHITECTURE.md` when you need file ownership and
  component layout.
- Use `SYMPHONY_OPEN_TASKS.md` when you need the live Symphony queue and proof
  order.
- Use `JULES_MIDDLEMAN_AUDIT.md` when you need the current evidence status and
  remaining gaps.
- Use the Spell Phase 1 tracker and packets when you need the proving-ground
  history or open spell-specific follow-up.
