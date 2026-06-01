# Spell Completeness Audit Living Tracker

Status: active
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh project continuity surface for the audit scope and stale-drift handling. | Worker D | 2026-05-31 | `NORTH_STAR.md`; `GAPS.md`; registry and status links | Proceed to the next slice only after re-run decision is recorded. | `TRACKER.md` + `NORTH_STAR.md` consistency check |
| T2 | active | Decide when to rerun coverage comparison with the current spell inventory and PHB list. | Worker D | 2026-05-31 | `output/LOCAL-INVENTORY.md`; `output/PHB-2024-REFERENCE.md`; `docs/spells/STATUS_LEVEL_*.md` | Recompute local-vs-PHB deltas and update `@SPELL-COMPLETENESS-REPORT.md` as a current report, or explicitly mark this as a planned rerun. | Live `public/data/spells` level counts and a fresh PHB source cross-check |
| T3 | waiting | Align with spell migration lane before using any gap rows as implementation blockers. | Worker D | 2026-05-31 | `docs/tasks/spell-system-overhaul/NORTH_STAR.md`; `docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md` | Keep audit findings scoped to planning until migration confirmation for each flagged spell. | Spell command/validation completion notes in migration lane |
| T4 | waiting | Sync handoff expectations with `docs/projects/spells` before closing any cross-project gap rows. | Worker D | 2026-05-31 | `docs/projects/spells/NORTH_STAR.md`; `docs/projects/spells/TRACKER.md`; `docs/projects/spells/GAPS.md` | Reconcile terminology and ownership so completeness findings are not duplicated or lost across projects. | Confirm references and owner linkage in both trackers |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G001 | active | in_scope_now | Worker D | spell-system-overhaul / spell-completeness-audit | T2 decision | Audit report is historical and mismatched against current level counts. | `@SPELL-COMPLETENESS-REPORT.md`, `output/LOCAL-INVENTORY.md`, live `public/data/spells` count output | Can not claim current completeness status without re-run. | Recompute level sets and publish an updated report. | New `@SPELL-COMPLETENESS-REPORT.md` generated from live folders and PHB list |
| G002 | active | support_needed_now | Worker D | docs/spells/STATUS_LEVEL_*.md | T2 decision | PHB-2024 source has not been freshly revalidated in this pass. | `output/PHB-2024-REFERENCE.md` | Source confidence is weak for publication-critical claims. | Reconfirm PHB list source and page citations before closing completeness claims. | Explicit source check log and updated report preamble |

## Update Rules

- Keep active/blocked/waiting rows with owner, evidence, and next proof.
- Use `GAPS.md` for durable findings that require follow-up beyond status signaling.
- Keep this tracker scoped to this project; route unrelated issues to
  `docs/projects/GLOBAL_GAPS.md`.
