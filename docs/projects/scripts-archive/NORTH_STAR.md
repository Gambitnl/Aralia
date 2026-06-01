# NORTH_STAR: Scripts: Archive

Status: active
Last updated: 2026-05-31

## Why this project exists

`scripts/archive` holds historical spell-data tooling from the canonical retrieval lane.
The live lane was marked complete, so these scripts are now evidence retention and
reuse context rather than active pipeline inputs.

## Purpose and scope

This project exists to preserve:

- what was archived (`scripts/archive`)
- why it was retired
- what retained artifacts are still needed as evidence
- where to pick up future reuse, cleanup, or retention decisions

Scope is documentation and continuity support only.

## File map

| File | Role |
|---|---|
| `scripts/archive/spell-canonical-retrieval/captureSpellCanonicalData.ts` | Archived retrieval runner for raw D&D Beyond capture (HTTP + browser fallback) |
| `scripts/archive/spell-canonical-retrieval/generateSpellCanonicalRetrievalTracker.ts` | Archived tracker generator for one retrieval lane |
| `docs/tasks/spells/archive/spell-canonical-retrieval/SPELL_CANONICAL_RETRIEVAL_TRACKER.md` | Archived lane tracker output retained by history |

## Implemented state

- `scripts/archive` exists with two files:
  - `captureSpellCanonicalData.ts` (modified 2026-05-18)
  - `generateSpellCanonicalRetrievalTracker.ts` (modified 2026-03-30)
- The spell-lane state in docs marks canonical retrieval complete and notes both
  archived tooling files as one-time finishers:
  - `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md`
- `docs/tasks/spells/SPELL_CORPUS_EXECUTION_TRACKER.md` also marks the live current
  truth surface as moved to sync and review artifacts, not the old lane file.
- `scripts/tooling/script-registry.json` has no live registry entries for
  `scripts/archive`, matching the de-emphasis to historical status.

## Integrations and dependencies

- `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` records lane rules and the
  archive decision.
- `docs/tasks/spells/archive/spell-canonical-retrieval/SPELL_CANONICAL_RETRIEVAL_TRACKER.md`
  is the final in-lane tracker artifact.
- `.agent/roadmap-local/spell-validation/spell-corpus-dndbeyond-report.json` is a
  source dependency for the archived scripts.
- `.agent/roadmap-local/spell-validation/dndbeyond-auth.json` was a temporary
  runtime auth input and should not be retained in archive artifacts.

## Active task

Keep ownership focused on continuity:

- Last task completed: update this project surface from concrete evidence.
- Next task: verify deprecation/cleanup decisions for archived scripts and lock the
  retention rule for future reuse.

## What must stay stable

- Do not remove archive scripts without recording a replacement decision path.
- Keep the "one-time retrieval lane" history in place for audit and rerun evidence.
- Keep auth/session files out of durable archive storage.

## Resume path

1. Read this file.
2. Read `docs/projects/scripts-archive/TRACKER.md`.
3. Read `docs/projects/scripts-archive/GAPS.md`.
4. Check completion evidence in:
   - `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md`
   - `docs/tasks/spells/SPELL_CORPUS_EXECUTION_TRACKER.md`
5. Continue from active gap decisions in `docs/projects/scripts-archive/TRACKER.md`.
