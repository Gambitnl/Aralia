# GAPS: Scripts: Quality

Status: active
Last updated: 2026-06-08

## Current State

- `G1` and `G2` are resolved and recorded as done.
- `G3` remains routed to `docs/projects/scripts-git/TRACKER.md`; scripts-quality keeps the checkpoint convention and debt snapshot cadence only.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | docs/projects/scripts-quality/TRACKER.md | This docs refresh | No repeatable evidence path for debt trend or baseline | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs), [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md) | Quality debt is summarized on demand only; trend visibility is weak during long sessions | Resolved: `NORTH_STAR.md` now records a compact checkpoint convention for quality-scope, lint-scope, or push-policy changes, plus a dated 2026-06-08 snapshot | `npm run quality:debt` passed as a non-blocking debt snapshot: TS 73 diagnostics; ESLint 15 errors / 1706 warnings; areas `src`, `scripts`, `tests` |
| G2 | done | in_scope_now | Worker C | docs/projects/scripts-quality/TRACKER.md | This docs refresh | Lint scope is limited to `src`, `scripts`, and `tests` in debt-summary | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs), [docs/projects/scripts-quality/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-quality/NORTH_STAR.md) | Non-code folders and generated artifacts are intentionally out-of-scope for this local debt summary, so the debt surface is tied to the runtime-facing lint entrypoint. | Documented as intentional in NORTH_STAR and verified via `npm run quality:debt` file-area output (`src`, `scripts`, `tests`) | Re-evaluate only if lint target scope is intentionally expanded | If lint target scope changes, run `npm run quality:debt` and confirm file-area coverage in `NORTH_STAR.md` |
| G3 | adjacent_follow_up | adjacent_follow_up | Worker C | docs/projects/scripts-git/TRACKER.md | This docs refresh | Quality gate cadence is documented here, but the automation and runbook mirror belongs to the scripts-git slice, not this project | [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md), [docs/projects/scripts-git/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-git/NORTH_STAR.md) | Without an explicit route, future agents may treat the cadence mirror as a local scripts-quality task | Keep it routed to scripts-git; if that project opens a runbook or verification slice, mirror the cadence there instead of widening this project | Add the explicit cadence note in scripts-git or the next quality slice only if ownership changes |
