# NORTHSTAR: Scripts: Archive

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

Project: Scripts: Archive
Slug: scripts-archive
Category: Docs / Continuity
Status: active
Confidence: medium
Evidence: docs/projects/scripts-archive
Gap signal: 2 open gaps
Protocol: living project doc set
Next step: Document the archive tombstone policy decision and keep the temp-auth cleanup check in the tracker.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Why this project exists

`scripts/archive` holds historical spell-data tooling from the canonical retrieval lane.
The live lane was marked complete, so these scripts are evidence-retention and reuse context rather than active pipeline inputs.

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

## Current state

- `scripts/archive` remains intentionally retained as historical tooling.
- `scripts/tooling/script-registry.json` has no live `scripts/archive` registry entry.
- `.agent/roadmap-local/spell-validation/dndbeyond-auth.json` was absent on 2026-06-05.
- The current unresolved policy question is whether retired archive scripts need a tombstone/deprecated registry rule or should stay implicitly omitted.

## Active task

T2 remains active:
- verify deprecation and cleanup policy for archived scripts and temporary auth artifacts
- keep the temp-auth cleanup check visible in the tracker
- record the archive tombstone decision in project docs once it is settled

## What must stay stable

- Do not remove archive scripts without a replacement decision path.
- Keep the one-time retrieval lane history in place for audit and rerun evidence.
- Keep auth/session files out of durable archive storage.
- Treat temporary auth inputs as runtime-only unless a future decision explicitly says otherwise.

## Resume path

1. Read this file.
2. Read `docs/projects/scripts-archive/TRACKER.md`.
3. Read `docs/projects/scripts-archive/GAPS.md`.
4. Re-check the temp-auth cleanup evidence only if the artifact has been recreated.
5. Continue with the archive tombstone decision or the cleanup-policy note that resolves it.
