# Spell Completeness Audit Gaps

Status: active
Last updated: 2026-05-31

No cross-project routing has been applied yet.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G001 | active | in_scope_now | Worker D | `docs/tasks/spell-completeness-audit` | T2 | Historical `@SPELL-COMPLETENESS-REPORT.md` no longer matches current local spell inventory state. | `@SPELL-COMPLETENESS-REPORT.md`, `output/LOCAL-INVENTORY.md`, `docs/spells/STATUS_LEVEL_1.md` .. `STATUS_LEVEL_9.md`, live count command | Any "present/missing/extra" result used now would be stale by inventory drift. | Recompute local set and rerun PHB comparison; then regenerate report with new timestamp and evidence notes. | Replayed comparison output and report diff against current `public/data/spells` |
| G002 | active | support_needed_now | Worker D | `docs/tasks/spell-completeness-audit` | T2 | PHB 2024 source in `output/PHB-2024-REFERENCE.md` is preserved, not freshly revalidated. | `output/PHB-2024-REFERENCE.md`, `1B~RESEARCH-PHB-2024-LIST.md` | PHB-based completeness claims depend on source correctness and current citations. | Recheck PHB 2024 source and citation alignment for all missing/extra classifications before final claims. | Source verification memo in project notes plus updated reference file header |
| G003 | active | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul` | T3 | Level counts used by spell-system references differ across sources (`STATUS_LEVEL_*`, migration guide, and local folder check). | `docs/spells/STATUS_LEVEL_*.md`, `docs/tasks/spell-system-overhaul/NORTH_STAR.md`, live `public/data/spells` check | Inconsistent numbers reduce confidence when routing missing-coverage items into migration batches. | Synchronize on one inventory source of truth for handoff handshakes; if needed, note per-file exceptions. | Updated source-of-truth note in this project and migration handoff docs |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, or another person. |

## Import Rules

- Route cross-project or unrelated findings to `docs/projects/GLOBAL_GAPS.md`.
- Keep local gap IDs linked to explicit owners and next proof conditions.

