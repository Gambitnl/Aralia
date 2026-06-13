# Scripts: Quality Living Tracker

Status: active
Last updated: 2026-06-10 (script-tests merge recorded)

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
| T5 | active | Maintain routed quality checkpoint and keep scripts-git follow-up explicit | Codex | 2026-06-08 | [docs/projects/scripts-quality/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-quality/NORTH_STAR.md), [docs/projects/scripts-quality/GAPS.md](F:/Repos/Aralia/docs/projects/scripts-quality/GAPS.md), [docs/projects/scripts-quality/COLD_START_AGENT_PROMPT.md](F:/Repos/Aralia/docs/projects/scripts-quality/COLD_START_AGENT_PROMPT.md) | Keep the routed follow-up out of this project and refresh the checkpoint note only when quality scope, lint scope, or push policy changes | `npm run quality:debt` summary plus docs consistency on the next quality-scope change |
| T6 | not_started | Own the merged script-tests support surface (`scripts/__tests__` continuity + inherited ST-GAP-001..004) | scripts-quality maintainer | 2026-06-10 | `docs/projects/DECISION_BLITZ_2026-06-10.md` (D21); `docs/projects/script-tests/` (merged-reference support surface); `docs/projects/scripts-quality/GAPS.md` G4 | Close ST-GAP-001 first (deterministic `spellFieldInventory` fixture test), then continue per the inherited gap list; mirror status into the support-surface registry | `npx vitest run scripts/__tests__/spellFieldInventory.test.ts` plus the focused tests for each inherited gap |

## Gap Log

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
| Routed follow-up remains cross-project and is explicitly limited to the scripts-git interface | confirmed | Codex | 2026-06-08 |

## Next Check Cycle

- Keep `npm run quality:debt` aligned with `scripts/quality/debt-summary.cjs`; rerun and record one dated line if lint scope, quality scope, or push policy changes.
- Confirm strict path (`ARALIA_PRE_PUSH_STRICT=1 git push`) still matches the documented pre-push flow and local policy.
- If lint scope changes, update the scope rationale and `G2` status in this project.
- Keep the routed cadence/policy follow-up outside this project unless ownership changes.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
