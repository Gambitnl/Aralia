# Spell Completeness Audit North Star

Status: active
Last updated: 2026-06-25

## Why This Project Exists

This project preserves the continuity of spell-coverage checks so future agents can
resume without guessing whether coverage claims are historical snapshots or live
status. It tracks what was compared, how it was compared, and where this work
must hand off into ongoing spell migration and status systems.

## Intended Outcome

Keep `spell-completeness-audit` as the compact cold-start memory for:

- what evidence exists for PHB 2024 vs local spell coverage,
- which files are historical baselines,
- what is implemented, what is planned next, and
- what must be rerun before claiming current coverage truth.

## Current State

- Registered in `docs/projects/PROJECT_TRACKER.md` with active status.
- Historical audit evidence in this folder is present and intentionally preserved:
  - `output/LOCAL-INVENTORY.md`
  - `output/PHB-2024-REFERENCE.md`
  - `@SPELL-COMPLETENESS-REPORT.md`
- Historical task context remains in `@PROJECT-INDEX.md`, `@WORKFLOW.md`,
  `PROPOSED_SCHEMA_V2.md`, the preserved output/report files, and the backlog
  retirement ledger rows for the retired `1A~`, `1B~`, `1C~`, `2A~`, `2B~`,
  and old task-folder `GAPS.md` packets.
- The per-level inventory snapshot used by the audit is from Dec 2025 and is not a
  current runtime truth.
- `docs/spells/STATUS_LEVEL_1.md` through `STATUS_LEVEL_9.md` are the
  currently maintained inventory surfaces.
- A live folder check on 2026-05-31 (no source edits in this pass) counted:
  - level-0: 43 files
  - level-1: 68
  - level-2: 65
  - level-3: 67
  - level-4: 46
  - level-5: 58
  - level-6: 44
  - level-7: 26
  - level-8: 22
  - level-9: 20

## Active Task

| Field | Value |
|---|---|
| Task | Refresh this project surface as a current handoff for coverage work and stale-drift tracking. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md` describe scope, links, implemented/planned state, integrations, and next checks in one pass. |
| Allowed boundaries | `docs/tasks/spell-completeness-audit` only. |
| Stop condition | Stop after the three docs reflect the live evidence boundary without source edits. |
| Verification | Internal consistency between this North Star, `TRACKER.md`, the nested Spells subproject `GAPS.md`, and external registry links. |
| Owner | Worker D |
| Next action | Decide whether to replay the audit against current local data before any new gap claims are treated as current. |

## Scope Boundaries

In scope:
- Coverage continuity docs for spell completeness.
- Links and handoff paths between this folder, `docs/spells`, and spell migration docs.
- Project-local gap capture that blocks a fresh, reliable completion verdict.

Adjacent but not in this slice:
- Re-running every level-1..9 spell behavior audit.
- Implementing spell migration, command, or validation code changes.

Out of scope:
- Full spell-system implementation or bugfixing.
- New runtime scope outside spell coverage bookkeeping.

## What Must Not Be Lost

- Historical artifact chain from inventory list, PHB reference list, and report.
- Evidence that the audit packet is a snapshot and not a current guarantee.
- Handoff relationship into `docs/tasks/spell-system-overhaul`.
- This project row in `docs/projects/PROJECT_TRACKER.md` and gap routing in
  `docs/projects/GLOBAL_GAPS.md`.

## File Map

| File | Purpose |
|---|---|
| `NORTH_STAR.md` | Cold-start entry and current project memory. |
| `TRACKER.md` | Queue and active action planning. |
| `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md` | Living unresolved findings for this lane. |
| `output/LOCAL-INVENTORY.md` | Historical local spell list snapshot. |
| `output/PHB-2024-REFERENCE.md` | Historical PHB 2024 reference snapshot. |
| `@SPELL-COMPLETENESS-REPORT.md` | Historical present/missing/extra output. |
| `1A~`, `1B~`, `1C~` | Provenance for baseline inventory and gap analysis. |
| `2A~`, `2B~` | Historical extraction planning context (preserved). |

## Integrations and Consumers

- `docs/projects/PROJECT_TRACKER.md` (registry entry and project continuity).
- `docs/projects/GLOBAL_GAPS.md` (cross-project gap routing).
- `docs/spells/STATUS_LEVEL_*.md` (current inventory surfaces).
- `docs/projects/spells/NORTH_STAR.md` and `docs/projects/spells/TRACKER.md` for broader spell-project context.
- `docs/projects/spells/subprojects/spell-completeness-audit/{NORTH_STAR.md,TRACKER.md,GAPS.md}` for the current living subproject packet.
- `docs/tasks/spell-system-overhaul/NORTH_STAR.md` (overall migration strategy).
- `docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md` (batch workflow handoff).
- `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` and source spell validation files when testing whether a spell is actually runnable.

## Relationship to Spell Workstreams

- `docs/tasks/spell-completeness-audit` defines the coverage baseline and
  historical proof lanes.
- `docs/projects/spells` tracks the broader spell project state.
- `docs/tasks/spell-system-overhaul` owns migration, implementation, and behavior
  follow-through.
- The two should stay linked: this folder tells you where coverage claims came from,
  the other shows whether those claims are still operationally true.

## Gaps, Uncertainties, and Next Checks

| Gap | Classification | Why it matters | Next check |
|---|---|---|---|
| Historical local vs PHB delta is stale | in_scope_now | Existing report is from 2025 and no longer aligns with current local inventories | Re-run local-vs-PHB comparison from live `public/data/spells` data |
| PHB source verification is not fresh | support_needed_now | PHB list has no explicit current source recheck in this folder | Reconfirm spell list source and citations before publication claims |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md`.
4. Read `@SPELL-COMPLETENESS-REPORT.md` and both `output` snapshots.
5. Continue from the next action in `TRACKER.md`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-completeness-audit/NORTH_STAR.md","sha256WithoutMarker":"b625631e635a59be10150cb2df9925f36a4e88cd51fc8718959c83a01f3c8b85","markedAtUtc":"2026-06-25T22:29:38.619Z"} -->
