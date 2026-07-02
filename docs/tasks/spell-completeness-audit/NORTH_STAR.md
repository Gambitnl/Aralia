# Spell Completeness Audit North Star

Status: historical evidence (closed lane)
Last updated: 2026-07-01

## Why This Folder Exists

This folder preserves the provenance of the original spell-coverage audit so
future agents can tell historical snapshots from live status. It records what
was compared, how it was compared, and where the work handed off. It is no
longer the current-status authority.

## Current-Status Authority

- **Living packet:** `docs/projects/spells/subprojects/spell-completeness-audit/`
  (`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`) is the sole current owner of
  spell-completeness status and gaps.
- **Current counts:** do not trust any hardcoded per-level counts in this
  folder. The maintained, generated snapshot is
  `docs/projects/spells/subprojects/spell-completeness-audit/SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md`,
  regenerated with `npm run spells:completeness`
  (`scripts/generateSpellCompletenessSnapshot.ts`).

## What Was Executed (Resolution Record)

- The headline gap this folder carried — "re-run the local-vs-PHB comparison
  from live data" — was **executed 2026-06-28**: the snapshot generator
  (`scripts/generateSpellCompletenessSnapshot.ts`, wired as
  `npm run spells:completeness`) produces the maintained coverage snapshot with
  separated Dataset Coverage, Canonical Source, and Runtime Verification gates.
- `@SPELL-COMPLETENESS-REPORT.md` in this folder carries a 2026-06-28 redirect
  header pointing at that maintained snapshot; the report body remains the
  preserved Dec 2025 audit.
- The "PHB source verification is not fresh" concern is structurally handled by
  the nested packet's gates and its canonical-recapture gap rows (nested G3
  resolved; nested G5 active as of 2026-06-29).

## Historical Evidence Preserved Here

- `output/LOCAL-INVENTORY.md` — historical local spell list snapshot (Dec 2025).
- `output/PHB-2024-REFERENCE.md` — historical PHB 2024 reference snapshot.
- `@SPELL-COMPLETENESS-REPORT.md` — historical present/missing/extra output,
  with the 2026-06-28 redirect to the maintained snapshot.
- `@PROJECT-INDEX.md`, `@WORKFLOW.md`, `PROPOSED_SCHEMA_V2.md` — historical
  task context.
- Backlog retirement ledger rows cover the retired `1A~`, `1B~`, `1C~`, `2A~`,
  `2B~`, and old task-folder `GAPS.md` packets.

## What Must Not Be Lost

- The historical artifact chain from inventory list, PHB reference list, and
  report — these explain where the original coverage claims came from.
- The distinction that everything in this folder is a snapshot, not a current
  guarantee.
- The handoff relationships: `docs/tasks/spell-system-overhaul` owns migration
  and behavior follow-through; `docs/projects/spells` owns broader project
  state; the nested subproject packet owns living completeness status.

## Resume Path For A Cold Agent

1. Do not resume work from this folder — it is closed historical evidence.
2. For current status, read
   `docs/projects/spells/subprojects/spell-completeness-audit/NORTH_STAR.md`,
   `TRACKER.md`, and `GAPS.md`.
3. For current counts, regenerate/read
   `SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md` in that packet
   (`npm run spells:completeness`).
4. Consult this folder only when you need the provenance of the original
   Dec 2025 audit.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-completeness-audit/NORTH_STAR.md","sha256WithoutMarker":"b625631e635a59be10150cb2df9925f36a4e88cd51fc8718959c83a01f3c8b85","markedAtUtc":"2026-06-25T22:29:38.619Z"} -->
