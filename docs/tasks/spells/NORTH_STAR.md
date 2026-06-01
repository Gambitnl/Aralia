# Spells Task North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

Preserve a compact handoff for the spell corpus execution and validation work so a
cold agent can continue without rediscovering active branch/workflow state,
validation lane ownership, and Atlas execution assumptions.

## Intended Outcome

Keep one reliable entry for:

- project purpose and non-negotiable state
- what is implemented vs still planned
- current branch/Jules/package flow
- where to continue with confidence

## Current State Snapshot

This task-folder is active and registered in:

- `docs/projects/PROJECT_TRACKER.md` (`Spells Task` entry)
- `docs/agent-workflows/LIVING_PROJECT_TASK_PROTOCOL.md` converted flow

The latest working surface is now:

- package queue: `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- implementation branch policy: `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- validation plan: `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md`
- live truth lanes: `docs/tasks/spells/SPELL_CANONICAL_SYNC_TRACKER.md`
- validation flags and model notes: `docs/tasks/spells/SPELL_CANONICAL_SYNC_FLAGS.md`

Corpus-wide JSON structure is currently green (`459 / 459` in
`docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md`) and split by lane:

- canonical->structured lane remains active with targeted residue
- structured->json lane still has open mismatch buckets
- canonical retrieval is complete for supported spells

Current implementation package is in-flight as Package 18 in
`docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` with an active Jules wait
state and follow-up PR gate noted there.

## Active Task

| Field | Value |
|---|---|
| Task | Keep this docs project a compact, accurate cold-start surface across active spell execution slices and validation evidence. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay synchronized to the same package and lane state, and do not leak irrelevant runtime workflow artifacts into scope. |
| Allowed boundaries | `docs/tasks/spells` docs only; no source edits in this pass. |
| Stop condition | No boundary drift: do not expand into engine code work or replace execution records in unrelated trackers. |
| Verification | Re-read this file, `TRACKER.md`, and `GAPS.md`, then compare to `docs/projects/PROJECT_TRACKER.md`, `SPELL_PHASE_1_TASK_TRACKER.md`, and `SPELL_DATA_VALIDATION_PLAN.md`. |
| Owner | Worker D |
| Next action | Continue from the first queue row marked active/waiting in `TRACKER.md`, then reconcile any changed package gates in `SPELL_PHASE_1_TASK_TRACKER.md`. |

## File Map

- Scope map and resume path: this file
- Active task queue and status: `TRACKER.md`
- Durable unresolved findings: `GAPS.md`
- Branch/model reference: `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- Corpus and lane references:
  - `docs/tasks/spells/SPELL_CANONICAL_SYNC_TRACKER.md`
  - `docs/tasks/spells/SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - `docs/tasks/spells/SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - `docs/tasks/spells/SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`
  - `docs/tasks/spells/SPELL_HIGHER_LEVEL_DESCRIPTION_COVERAGE_REPORT.md`
- Atlas execution contracts:
  - `docs/tasks/spells/ATLAS_AGENT_PROMPT_V3.md`
  - `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md`
  - `docs/tasks/spells/atlas-prompts/README.md`
- Package execution artifacts:
  - `docs/tasks/spells/SPELL_PHASE_1_PACKAGE_HISTORY.md`
  - `docs/tasks/spells/PACKAGE_18_REACTION_OPPORTUNITY_CONTINUATION_JULES_TASK.md`
  - `docs/tasks/spells/PACKAGE_18_REACTION_OPPORTUNITY_CONTINUATION_JULES_PROMPT.md`

## Scope Boundaries

In scope:
- documentation for this task-folder continuity
- branch/worktree/Jules/package routing context
- tracking gaps relevant to this folder continuity

Adjacent but not in scope:
- direct source implementation and runtime tuning
- broad engine architecture decisions and schema design

Out of scope:
- implementation slicing owned by other living workstreams, including
  `docs/tasks/spell-system-overhaul`

## What Must Not Be Lost

- package queue + branch policy from `SPELL_PHASE_1_TASK_TRACKER.md`
- split validation model (canonical->structured and structured->json)
- tracker-to-package mapping and wait/check state signals
- Atlas-model caveat: no automated tracker-to-atlas drift check exists

## Resume Path

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Read `SPELL_PHASE_1_TASK_TRACKER.md`.
5. Continue from the first non-complete row.

## Known Gaps And Follow-Ups

| Gap | Classification | Evidence | Next action |
|---|---|---|---|
| Package 18 is still in wait state, so this project cannot be marked package-closed | in_scope_now | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` | Refresh Jules session and PR boundary before advancing this folder to a closed package state. |
| No automated Atlas drift check between tracker values and Atlas row counts | support_needed_now | `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` | Capture a one-shot count alignment check on each major package transition. |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor and project evidence | active |
| `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` | Active package queue and workflow state | active |
| `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` | Validation lane plan and lane split | active |
| `docs/tasks/spells/SPELL_CANONICAL_SYNC_TRACKER.md` | Current corpus sync/lane status | active |
| `docs/tasks/spells/ATLAS_AGENT_PROMPT_V3.md` | Atlas execution contract | active |
