# Racial Mechanics / Race Hierarchy Living Tracker

Status: active

Last updated: 2026-06-12
Owner: Racial mechanics project agent

This tracker is the operational surface for this project.

Status vocabulary:
- `done`: completed with evidence linked in `AUDIT_OR_PROOF.md`, tests, or runtime files.
- `active`: currently being implemented.
- `in_progress`: accepted with clear next action.
- `blocked`: scope decision exists, and implementation waits.
- `deferred`: documented as adjacent and not required to finish baseline objectives.

This iteration refreshed the living-project docs and aligned tracker state with the gap log; no implementation status changed.

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active and adjacent work queue

| Task ID | Status | Scope | Why it exists | Next action |
| --- | --- | --- | --- | --- |
| RM-032 | active | in_scope_now | The Character Creator may not present required choice steps (skills, spells, tools, etc.) for all races. | Audit the character creation flow against all races to ensure no choices are skipped. Add missing UI steps. |
| RM-038 | active | 2026-06-01 | [F:/Repos/Aralia/public/data/glossary/entries/races/](F:/Repos/Aralia/public/data/glossary/entries/races/) | Race glossary entries may use outdated 2014 trait descriptions instead of the 2024 versions. | Audit all race glossary entries and update to 2024 versions. Core species updated. |
| RM-SYNC-001 | open | support_needed_now | Systemic sync gap between TS data and glossary JSONs. | Identify and fix misalignments. |
| RM-013 | in_progress | adjacent-deferred | `Spells of the Mark` traits still require table/list-based list access into class spell lists. | Build a class spell-list source model and promote if scope allows. |
| RM-014 | in_progress | adjacent-deferred | Some traits use open spell choice text without concrete spell IDs (`...one cantrip ... of your choice...`). | Define race-choice schema and UI selection flow before implementation. |
| RM-006 | deferred | adjacent-deferred | Heuristic feature-type inference is brittle across multiple race text forms. | Replace with explicit schema tags only when parser touchpoints are stable. |
| RM-009 | deferred | adjacent-deferred | File naming cleanup is UI/docs hygiene and not required for mechanic parity. | Resume only if mechanical milestones are closed. |

## Current next check

1. Re-run race parser and trait-analyzer audit scripts after any parser or race-data changes.
2. Keep `docs/projects/racial-mechanics/traits-implementation-mapping.md` and `AUDIT_OR_PROOF.md` aligned with tracker scope.
3. Do not promote any adjacent task to `active` unless `TRACKER.md` records why it is required for current release scope.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | active | Normalize this tracker to the living-project workflow contract | future agent | 2026-06-10 | docs/projects/PROJECT_CARD_SCHEMA.md; docs/agent-workflows/living-project-task-protocol/templates/LIVING_TRACKER.md | Replace this seeded row with the current real project task during the next iteration | Project tracker has at least one current active/waiting/done row with evidence and next proof |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
