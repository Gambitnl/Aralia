# Scripts: Audits Tracker

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
| T1 | done | Document project continuity for `scripts/audits` in project docs | User-facing maintainer | 2026-05-31 | `docs/projects/scripts-audits/NORTH_STAR.md` | Keep tracker and gap registry aligned to this state | `docs/projects/scripts-audits` files exist and match map |
| T2 | active | Validate command and report paths against live docs references | User-facing maintainer | 2026-05-31 | `docs/portraits/race_portrait_regen_handoff.md`, `docs/guides/RACE_ENRICHMENT_WORKFLOW.md` | Confirm references map to real files under `scripts/audits` | run listed next checks and update evidence fields |
| T3 | active | Capture durable unresolved audit-project gaps | User-facing maintainer | 2026-05-31 | `docs/projects/scripts-audits/GAPS.md` | Move only valid project-level gaps into `GAPS.md` | one follow-up entry per gap with proof path |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | scripts-audits maintainer | scripts/audits | docs scan | The project has no canonical "run all audits" entry in package.json or docs guide | `scripts/audits` scripts exist; no top-level command invokes the full suite | Hard to reproduce end-to-end checks consistently across check families | Add/declare a canonical command list in docs and confirm in next checks | run commands listed in NORTH_STAR next-check list |
| G2 | active | adjacent_follow_up | scripts-audits maintainer | scripts/audits/qa-batches | docs scan | Historical generated `.json/.md` artifacts in `scripts/audits/qa-batches` may no longer represent current portrait state | many dated files under `scripts/audits/qa-batches` | Stale evidence can hide regressions in review workflows | add date stamps and source batch ID in `TRACKER.md` or remove stale files intentionally | compare latest `slice-of-life-settings.json` against newest batch id |
| G3 | active | adjacent_follow_up | scripts-audits maintainer | scripts/audits/verify-cc-glossary-race-sync.ts | execution | Non-selectable base race IDs are hardcoded in verifier, so race policy edits can silently drift from sync logic | `NON_SELECTABLE_BASE_RACE_IDS` in `scripts/audits/verify-cc-glossary-race-sync.ts` | Rule drift creates false pass/fail in race image/paths checks | confirm base-race policy source of truth and keep verifier and glossary docs aligned | rerun verify after any base-race policy change |

## Update Rules

- Keep queue rows current before any new check run that changes project state.
- Every active row must include next proof/check and evidence/source.
- Keep cross-project questions in `docs/projects/GLOBAL_GAPS.md` rather than this file unless they directly block this project.
