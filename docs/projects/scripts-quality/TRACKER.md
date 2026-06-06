# TRACKER: Scripts: Quality

Status: active
Last updated: 2026-06-05

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
| T1 | done | Create protocol surface files in `docs/projects/scripts-quality/` | Worker C | 2026-05-31 | [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) | Keep docs aligned and linked to registry evidence | `Test-Path docs/projects/scripts-quality/NORTH_STAR.md` |
| T2 | done | Document quality script map and policy integration for `scripts/quality` | Worker C | 2026-05-31 | [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs), [package.json](F:/Repos/Aralia/package.json), [scripts/git/pre-push-aralia.sh](F:/Repos/Aralia/scripts/git/pre-push-aralia.sh) | Keep scope and integration boundaries explicit | `Get-Content docs/projects/scripts-quality/NORTH_STAR.md` |
| T3 | active | Capture quality-monitoring gaps and define next checks | Worker C | 2026-06-05 | [docs/projects/scripts-quality/GAPS.md](F:/Repos/Aralia/docs/projects/scripts-quality/GAPS.md), [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md), [docs/projects/scripts-quality/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-quality/NORTH_STAR.md) | Keep unresolved monitoring gaps visible and bounded | run `npm run quality:debt` once, compare output shape to this map, and decide whether the lint scope note needs a doc update |

## Gap Log

- `G1` is in-scope and tracked in `docs/projects/scripts-quality/GAPS.md`.
- `G2` is in-scope and tracked in `docs/projects/scripts-quality/GAPS.md`.
- `G3` is adjacent_follow_up and routed to the broader scripts quality + scripts-git interface in `docs/projects/scripts-quality/GAPS.md`.

## Evidence And Progress

| Evidence | Status | Owner | Date |
|---|---|---|---|
| `package.json` scripts include `quality:debt`, `quality:debt:strict`, `sync-check`, `intent-gate`, and `git:hygiene` entries | confirmed | Worker C | 2026-05-31 |
| `scripts/quality/debt-summary.cjs` defines non-blocking normal mode and strict mode gating | confirmed | Worker C | 2026-05-31 |
| `scripts/git/pre-push-aralia.sh` runs strict quality debt only in `ARALIA_PRE_PUSH_STRICT=1` mode | confirmed | Worker C | 2026-05-31 |
| Project docs now include file map, integrations, scope boundaries, gap log, and dashboard card schema | updated | Worker C | 2026-06-05 |

## Next Check Cycle

- Run `npm run quality:debt` and confirm the lint/type summary inputs are still aligned with `scripts/quality/debt-summary.cjs`.
- Confirm strict path (`ARALIA_PRE_PUSH_STRICT=1 git push`) still matches the documented pre-push flow and local policy.
- If the `src`, `scripts`, `tests` scope remains intentional, record that explicitly in `NORTH_STAR.md`; otherwise route it as a real gap.
