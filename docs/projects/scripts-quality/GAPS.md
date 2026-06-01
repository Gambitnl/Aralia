# GAPS: Scripts: Quality

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker C | docs/projects/scripts-quality/TRACKER.md | This docs refresh | No repeatable evidence path for debt trend or baseline | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs), [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md) | Quality debt is currently summarized on demand only; trend visibility is weak during long sessions | Add a lightweight check note (or runbook) for periodic review cadence if the project continues | run `npm run quality:debt` and archive a dated snapshot only when policy work changes |
| G2 | active | in_scope_now | Worker C | docs/projects/scripts-quality/TRACKER.md | This docs refresh | Lint scope is limited to `src`, `scripts`, and `tests` in debt-summary | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs) | Unknown whether this is intentional or a narrow-slice artifact; other folders may carry quality debt signals | Decide intent (keep narrow or expand), then document scope rationale in `NORTH_STAR.md` | Validate scope once during next quality slice with command review and explicit acceptance |
| G3 | adjacent_follow_up | adjacent_follow_up | Worker C | docs/projects/scripts-git/TRACKER.md | This docs refresh | Quality gate cadence and policy is documented but not mirrored by automation across task slices | [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md), [docs/projects/scripts-git/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-git/NORTH_STAR.md) | Without shared cadence, teams may run inconsistent checks between script and Git-policy work | Route as project-follow-up if this area is being actively expanded to runbook or local verification docs | add explicit note in scripts-git or next quality slice if ownership changes |
