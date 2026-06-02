# Spells Task Gaps

Status: active
Last updated: 2026-06-01

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G201 | done | in_scope_now | Worker D | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` | this pass | Package 18 needed live closure proof before this project layer could advance | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`; PR [#1143](https://github.com/Gambitnl/Aralia/pull/1143) | Closure proof is now visible: Package 18 safe-replacement PR #1143 merged remotely on 2026-06-01. Local sync/package-history closeout remains a separate boundary. | Move the project layer from wait-state to post-merge closeout and select the next Spell Phase package from current `master`. | Tracker row records PR #1143 merge proof and next boundary |
| G202 | active | support_needed_now | Worker D | `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` | this pass | Gap 09 (no automated tracker-to-atlas drift check) is still open | `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` | Tracker and Atlas can diverge, weakening cold-start accuracy | Add a manual alignment check at each package transition before the next package launch | Manual proof note in `TRACKER.md` and `NORTH_STAR.md` |
| G203 | active | adjacent_follow_up | Worker D | `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` | this pass | Structured->json residue is live and should be re-checked against implementation before declaring end-state | `docs/tasks/spells/SPELL_DATA_VALIDATION_PLAN.md` | Overstating completion can hide remaining runtime-level misses in glossary-facing JSON | Keep package-level checklists aligned with `SPELL_STRUCTURED_VS_JSON_REPORT.md` and `SPELL_PHASE_1_TASK_TRACKER.md` | Next package transition review |
| G204 | out_of_scope | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul` | this pass | Engine-level schema/runtime decisions should remain in spell-system-overhaul ownership surface | `docs/tasks/spell-system-overhaul/NORTH_STAR.md`; `docs/tasks/spell-system-overhaul/TRACKER.md` | Prevent overlapping scope and duplicated fix planning across two task projects | Route future runtime-engine findings to the spell-system-overhaul docs | Not applicable here unless a handoff exception is required |

## Classification Reference

- `in_scope_now`: required for the active task to proceed
- `support_needed_now`: not required for correctness but blocks safe continuation
- `adjacent_follow_up`: useful and related but not required in this slice
- `out_of_scope`: explicitly outside this project boundary
- `blocked_human_decision`: waiting on explicit owner/operator choice
- `blocked_external_state`: waiting on external PR/session/CI state

## Import Rules

- Cross-project gaps belong to `docs/projects/GLOBAL_GAPS.md`.
- Keep only durable gaps needed by this task-folder continuity path.
- If any out-of-scope gap becomes required for this task, move it and reclassify here with updated owner.
