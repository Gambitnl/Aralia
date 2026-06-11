# Scripts: Quality Gap Registry

Status: active
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Current State

- `G1` and `G2` are resolved and recorded as done.
- `G3` remains routed to `docs/projects/scripts-git/TRACKER.md`; scripts-quality keeps the checkpoint convention and debt snapshot cadence only.
- `G4` (2026-06-10): the script-tests project merged into this one (DECISION_BLITZ D21); the inherited ST-GAP-001..004 test-coverage gaps are now owned here and remain listed in `docs/projects/script-tests/GAPS.md` (support surface).

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | docs/projects/scripts-quality/TRACKER.md | This docs refresh | No repeatable evidence path for debt trend or baseline | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs), [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md) | Quality debt is summarized on demand only; trend visibility is weak during long sessions | Resolved: `NORTH_STAR.md` now records a compact checkpoint convention for quality-scope, lint-scope, or push-policy changes, plus a dated 2026-06-08 snapshot | `npm run quality:debt` passed as a non-blocking debt snapshot: TS 73 diagnostics; ESLint 15 errors / 1706 warnings; areas `src`, `scripts`, `tests` |
| G2 | done | in_scope_now | Worker C | docs/projects/scripts-quality/TRACKER.md | This docs refresh | Lint scope is limited to `src`, `scripts`, and `tests` in debt-summary | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs), [docs/projects/scripts-quality/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-quality/NORTH_STAR.md) | Non-code folders and generated artifacts are intentionally out-of-scope for this local debt summary, so the debt surface is tied to the runtime-facing lint entrypoint. | Documented as intentional in NORTH_STAR and verified via `npm run quality:debt` file-area output (`src`, `scripts`, `tests`) | Re-evaluate only if lint target scope is intentionally expanded | If lint target scope changes, run `npm run quality:debt` and confirm file-area coverage in `NORTH_STAR.md` |
| G3 | adjacent_follow_up | adjacent_follow_up | Worker C | docs/projects/scripts-git/TRACKER.md | This docs refresh | Quality gate cadence is documented here, but the automation and runbook mirror belongs to the scripts-git slice, not this project | [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md), [docs/projects/scripts-git/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-git/NORTH_STAR.md) | Without an explicit route, future agents may treat the cadence mirror as a local scripts-quality task | Keep it routed to scripts-git; if that project opens a runbook or verification slice, mirror the cadence there instead of widening this project | Add the explicit cadence note in scripts-git or the next quality slice only if ownership changes |
| G4 | not_started | adjacent_follow_up | scripts-quality maintainer | docs/projects/script-tests/GAPS.md (merged support surface) | 2026-06-10 D21 merge | Inherited script-tests coverage gaps ST-GAP-001..004 (spellFieldInventory snapshot test, raceReconciliationInventory CLI/report contract, check-non-ascii full-scan report coverage, validateSpellTemplateContracts regression) are now owned by this project | `docs/projects/script-tests/GAPS.md`; `docs/projects/DECISION_BLITZ_2026-06-10.md` (D21); `docs/projects/scripts-quality/DECISIONS.md` D2 | The merged-in `scripts/__tests__` surface guards migration safety and data contracts; without an owner row here the inherited gaps would go dark after the merge | Close ST-GAP-001 first (deterministic fixture test for `buildSpellFieldInventory()` + `querySpellFieldInventory()`), then proceed per the inherited list | Focused Vitest passes per inherited gap; status mirrored back into the support-surface gap registry |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
