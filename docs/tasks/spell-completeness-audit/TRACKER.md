# Spell Completeness Audit Living Tracker

Status: closed (historical evidence)
Last updated: 2026-07-01

This tracker is closed. All rows are done, superseded, or executed in the
living nested packet at
`docs/projects/spells/subprojects/spell-completeness-audit/` — that packet is
the sole current owner of spell-completeness status and gaps. This file is
preserved as historical evidence only.

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Task Queue (Closed)

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh project continuity surface for the audit scope and stale-drift handling. | Worker D | 2026-06-25 | `NORTH_STAR.md`; `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md`; registry and status links | None — lane closed. | `TRACKER.md` + `NORTH_STAR.md` consistency check |
| T2 | done | Decide when to rerun coverage comparison with the current spell inventory and PHB list. | Worker D | 2026-07-01 | Executed in the nested packet: nested T5 done 2026-06-28 (`scripts/generateSpellCompletenessSnapshot.ts`, `npm run spells:completeness`, `SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md`); `@SPELL-COMPLETENESS-REPORT.md` 2026-06-28 redirect header | None — rerun executed as a maintained generated snapshot. | Snapshot regenerates cleanly via `npm run spells:completeness`. |
| T3 | superseded | Align with spell migration lane before using any gap rows as implementation blockers. | Worker D | 2026-07-01 | `docs/projects/spells/subprojects/spell-completeness-audit/{TRACKER.md,GAPS.md}` | Superseded: the nested packet is the sole living owner of alignment and gating. | n/a — see nested packet. |
| T4 | superseded | Sync handoff expectations with `docs/projects/spells` before closing any cross-project gap rows. | Worker D | 2026-07-01 | `docs/projects/spells/subprojects/spell-completeness-audit/{NORTH_STAR.md,TRACKER.md,GAPS.md}` | Superseded: ownership linkage now lives in the nested packet under `docs/projects/spells`. | n/a — see nested packet. |
| T5 | done | Align this task-folder tracker with the living Spells subproject gap owner after old local `GAPS.md` retirement. | Codex | 2026-06-25 | `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md`; `docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md` | Closed: future gap work belongs in the nested Spells subproject packet, while this task folder preserves historical report/output evidence. | This tracker no longer points cold agents at the deleted task-folder `GAPS.md`. |

## Gap Log (Closed)

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G001 | done | in_scope_now | Worker D | spell-system-overhaul / spell-completeness-audit | T2 decision | Audit report was historical and mismatched against current level counts. | Nested T5 done 2026-06-28: `SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md` generated from live folders; `@SPELL-COMPLETENESS-REPORT.md` carries the redirect | Resolved: current completeness status is claimable from the maintained snapshot. | None — executed via nested packet (nested G1 resolved). | `npm run spells:completeness` regenerates the snapshot from live data. |
| G002 | done | support_needed_now | Worker D | docs/spells/STATUS_LEVEL_*.md | T2 decision | PHB-2024 source had not been freshly revalidated. | Nested Canonical Source Gate in `SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md`; nested G3 resolved, nested G5 active (Guardian of Nature recapture) | Resolved as a lane: source-freshness is now structurally tracked by the nested packet's gates and gap rows. | None here — remaining canonical-recapture work is nested G5, owned by the nested packet. | Nested packet `GAPS.md` G5 row. |

## Update Rules

- Do not add new rows here — this tracker is closed historical evidence.
- All durable findings and follow-up belong in
  `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md`.
- Route unrelated issues to `docs/projects/GLOBAL_GAPS.md`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-completeness-audit/TRACKER.md","sha256WithoutMarker":"7472c8aa96699bb586490ae53be02f0651633daa7c9e91f9b37603b566c397f4","markedAtUtc":"2026-06-25T22:29:38.620Z"} -->
