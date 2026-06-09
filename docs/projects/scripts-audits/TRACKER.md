# Scripts: Audits Tracker

Status: review-required
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
| T1 | done | Document project continuity for `scripts/audits` in project docs | User-facing maintainer | 2026-06-05 | `docs/projects/scripts-audits/NORTH_STAR.md` | Keep tracker and gap registry aligned to this state | `docs/projects/scripts-audits` files exist and match the current map |
| T2 | active | Validate command and report paths against live docs references | User-facing maintainer | 2026-06-05 | `docs/projects/scripts-audits/NORTH_STAR.md`, `docs/projects/scripts-audits/GAPS.md` | Confirm the command/report paths named in the North Star still resolve or record any stale references explicitly | Run the next checks in `NORTH_STAR.md` and update evidence paths |
| T3 | active | Capture durable unresolved audit-project gaps | User-facing maintainer | 2026-06-05 | `docs/projects/scripts-audits/GAPS.md` | Keep the durable gap list compact, actionable, and aligned with the tracker | One follow-up entry per gap with proof path |
| T4 | blocked | Decide mandatory CI gates versus optional/manual audit workflow | project owner | 2026-06-08 | `docs/projects/scripts-audits/GAPS.md` S4; `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`; `docs/portraits/race_portrait_regen_handoff.md` | Record audit policy before assigning forward automation work | Human/policy decision written in project docs |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | scripts-audits maintainer | scripts/audits execution | docs scan + current docs refresh | No canonical full-audit entrypoint is documented | `GAPS.md` S1; `package.json` exposes separate audit commands | Hard to reproduce end-to-end checks consistently | Document the ordered local audit path and keep it in the North Star | Next agent can run the listed checks in order without guessing |
| G2 | active | adjacent_follow_up | scripts-audits maintainer | scripts/audits/qa-batches | docs scan + current docs refresh | Old dated QA batch files can be mistaken for active output | `GAPS.md` S2; dated files under `scripts/audits/qa-batches` | Stale evidence can hide regressions | Add a retention or refresh rule in the project docs | Latest batch id is called out in the refreshed handoff |
| G3 | active | support_needed_now | scripts-audits maintainer | audit/report cadence | docs scan + current docs refresh | Generated reports do not define freshness policy | `GAPS.md` S3; `base-trait-coverage.report.json`, `base-trait-key-coverage.report.json`, `race-image-byte-audit.json`, `slice-of-life-settings.json` | Owners may trust stale snapshots as live truth | Add run cadence and ownership in this tracker or North Star | Reports have named freshness guidance before reuse |
| G4 | active | blocked_human_decision | project owner | audit policy | docs scan + current docs refresh | The project still has no decision on mandatory CI checks versus optional/manual audits | `GAPS.md` S4; `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`; `docs/portraits/race_portrait_regen_handoff.md` | Automation scope can block contributors or miss regressions | Record the policy decision before turning any new audit into a gate | The owner decision is written down in project docs or a follow-up note |

## Update Rules

- Keep queue rows current before any new check run that changes project state.
- Every active row must include next proof/check and evidence/source.
- Keep cross-project questions in `docs/projects/GLOBAL_GAPS.md` rather than this file unless they directly block this project.
