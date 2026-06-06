# GAPS: Scripts: Quality

Status: active
Last updated: 2026-06-05

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker C | docs/projects/scripts-quality/TRACKER.md | This docs refresh | No repeatable evidence path for debt trend or baseline | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs), [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md) | Quality debt is summarized on demand only; trend visibility is weak during long sessions | Add a lightweight cadence note or runbook line when this workstream continues | Run `npm run quality:debt` and capture a dated snapshot only after a policy or scope change |
| G2 | active | in_scope_now | Worker C | docs/projects/scripts-quality/TRACKER.md | This docs refresh | Lint scope is limited to `src`, `scripts`, and `tests` in debt-summary | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs) | Unknown whether this is intentional or a narrow-slice artifact; other folders may carry quality debt signals | Decide intent, then document the scope rationale in `NORTH_STAR.md` | Validate scope once during the next quality slice with command review and explicit acceptance |
| G3 | adjacent_follow_up | adjacent_follow_up | Worker C | docs/projects/scripts-git/TRACKER.md | This docs refresh | Quality gate cadence and policy is documented but not mirrored by automation across task slices | [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md), [docs/projects/scripts-git/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-git/NORTH_STAR.md) | Without shared cadence, teams may run inconsistent checks between script and Git-policy work | Route as project-follow-up if this area is expanded into a runbook or local verification doc | Add an explicit note in scripts-git or the next quality slice if ownership changes |
