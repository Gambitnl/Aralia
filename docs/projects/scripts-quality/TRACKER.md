# TRACKER: Scripts: Quality

Status: active
Last updated: 2026-06-08

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
| T3 | done | Capture quality-monitoring gaps and define next checks | Worker C | 2026-06-08 | [docs/projects/scripts-quality/GAPS.md](F:/Repos/Aralia/docs/projects/scripts-quality/GAPS.md), [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md), [docs/projects/scripts-quality/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-quality/NORTH_STAR.md), [scripts/quality/debt-summary.cjs](F:/Repos/Aralia/scripts/quality/debt-summary.cjs) | Keep unresolved monitoring gaps visible and bounded | `npm run quality:debt` once, compare output shape to this map, and document scope rationale |
| T4 | done | Add repeatable quality-debt checkpoint convention | Codex | 2026-06-08 | [docs/projects/scripts-quality/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-quality/NORTH_STAR.md), [docs/projects/scripts-quality/GAPS.md](F:/Repos/Aralia/docs/projects/scripts-quality/GAPS.md) | Convention recorded: capture one compact `npm run quality:debt` summary only when quality scope, lint scope, or push policy changes | `npm run quality:debt` passed as a non-blocking debt snapshot: TS 73 diagnostics; ESLint 15 errors / 1706 warnings; areas `src`, `scripts`, `tests` |
| T5 | active | Maintain routed quality checkpoint and keep scripts-git follow-up explicit | Codex | 2026-06-08 | [docs/projects/scripts-quality/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-quality/NORTH_STAR.md), [docs/projects/scripts-quality/GAPS.md](F:/Repos/Aralia/docs/projects/scripts-quality/GAPS.md), [docs/projects/scripts-quality/COLD_START_AGENT_PROMPT.md](F:/Repos/Aralia/docs/projects/scripts-quality/COLD_START_AGENT_PROMPT.md) | Keep the routed follow-up out of this project and refresh the checkpoint note only when quality scope, lint scope, or push policy changes | `npm run quality:debt` summary plus docs consistency on the next quality-scope change |

## Gap Log

- `G1` is resolved and recorded as done in `docs/projects/scripts-quality/GAPS.md`.
- `G2` is resolved and recorded as done in `docs/projects/scripts-quality/GAPS.md`.
- `G3` is adjacent_follow_up and routed to the broader scripts quality + scripts-git interface in `docs/projects/scripts-quality/GAPS.md`.
- The routed follow-up is explicitly cross-project now; scripts-quality keeps the checkpoint convention and debt snapshot cadence only.

## Evidence And Progress

| Evidence | Status | Owner | Date |
|---|---|---|---|
| `package.json` scripts include `quality:debt`, `quality:debt:strict`, `sync-check`, `intent-gate`, and `git:hygiene` entries | confirmed | Worker C | 2026-05-31 |
| `scripts/quality/debt-summary.cjs` defines non-blocking normal mode and strict mode gating | confirmed | Worker C | 2026-05-31 |
| `scripts/git/pre-push-aralia.sh` runs strict quality debt only in `ARALIA_PRE_PUSH_STRICT=1` mode | confirmed | Worker C | 2026-05-31 |
| Project docs now include file map, integrations, scope boundaries, gap log, and dashboard card schema | updated | Worker C | 2026-06-05 |
| `npm run quality:debt` output was reviewed and confirmed to match scoped map assumptions (`src`, `scripts`, `tests` areas; TS 73 diagnostics; ESLint 15 errors / 1706 warnings) | confirmed | Codex | 2026-06-08 |
| Repeatable checkpoint convention added: record a compact debt snapshot only on quality-scope, lint-scope, or push-policy changes | done | Codex | 2026-06-08 |
| Routed follow-up remains cross-project and is explicitly limited to the scripts-git interface | confirmed | Codex | 2026-06-08 |

## Next Check Cycle

- Keep `npm run quality:debt` aligned with `scripts/quality/debt-summary.cjs`; rerun and record one dated line if lint scope, quality scope, or push policy changes.
- Confirm strict path (`ARALIA_PRE_PUSH_STRICT=1 git push`) still matches the documented pre-push flow and local policy.
- If lint scope changes, update the scope rationale and `G2` status in this project.
- Keep the routed cadence/policy follow-up outside this project unless ownership changes.
