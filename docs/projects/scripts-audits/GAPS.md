# Scripts: Audits Gaps

Status: active
Last updated: 2026-06-05

This file is the durable open-gap list for `scripts/audits`. Keep it compact,
actionable, and aligned with the active tracker queue.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | not_started | support_needed_now | scripts-audits maintainer | scripts/audits execution | docs scan | There is still no single canonical entrypoint for the full audit surface | `package.json` exposes `audit:races`, `scan`, and other separate commands, but no combined audit command for all files in `scripts/audits` | Manual re-runs can miss checks and produce inconsistent safety posture | Define the project-local check order in docs and keep it visible in North Star | Run the ordered checks from `NORTH_STAR.md` without guessing |
| S2 | not_started | adjacent_follow_up | scripts-audits maintainer | QA batch workflows | docs scan | Old dated files in `scripts/audits/qa-batches` can still be mistaken for active source output | `scripts/audits/qa-batches/*.input.json`, `*.output.json`, `*.raw.json` | Stale artifacts are easy to up-level as evidence and can hide regression in review lanes | Add a clear retention or refresh rule and archive process for aged files | Confirm the latest batch id appears in the refreshed handoff |
| S3 | not_started | support_needed_now | scripts-audits maintainer | audit/report cadence | docs scan | Report files in `scripts/audits` do not define a freshness policy | `base-trait-coverage.report.json`, `base-trait-key-coverage.report.json`, `race-image-byte-audit.json`, `slice-of-life-settings.json` | Without freshness policy, owners may use stale snapshots as live truth | Add run cadence and ownership in this tracker or North Star | Verify `generatedAt` timestamps are current before trusting outputs |
| S4 | not_started | blocked_human_decision | project owner | policy | review | How much of `scripts/audits` should be mandatory in CI versus optional/manual workflows is still undecided | `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`, `docs/portraits/race_portrait_regen_handoff.md` | Over-broad automation can block normal contributor flow, while under-coverage can miss regressions | Confirm policy before binding a new audit into a gate | Record the decision in a follow-up note or project tracker update |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | A task cannot be completed without it |
| `support_needed_now` | Not a core feature, but needed for current maintenance workflow |
| `adjacent_follow_up` | Related improvement, not required for current slice |
| `out_of_scope` | Should be explicitly excluded from this project |
| `blocked_human_decision` | Needs explicit owner decision |
| `blocked_external_state` | Depends on another person/system |

## Import Rules

- Keep this file project-owned only for durable, meaningful gaps.
- Move unrelated or cross-project policy questions to `docs/projects/GLOBAL_GAPS.md` rather than this file unless they directly affect the project.
- Shared workflow ambiguity is tracked in `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`, not duplicated here.
