# Scripts: Audits Gaps

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| S1 | not_started | support_needed_now | scripts-audits maintainer | scripts/audits execution | docs scan | There is no single canonical entrypoint command for the full audit surface | `package.json` has `audit:races`, `scan`, `quality:debt`, but not a combined audit command for all files in `scripts/audits` | Manual re-runs can miss checks and produce inconsistent safety posture | Define a project-local check order in docs and document as required local verification | run `npx tsx` set of commands from NORTH_STAR after docs update |
| S2 | not_started | adjacent_follow_up | scripts-audits maintainer | QA batch workflows | docs scan | Old dated files in `scripts/audits/qa-batches` can be mistaken for active source output | `scripts/audits/qa-batches/*.input.json`, `*.output.json`, `*.raw.json` | Stale artifacts are easy to up-level as evidence and can hide regression in review lanes | Add a clear retention/refresh rule and archive process for aged files | confirm latest batch id appears in `slice-of-life-settings.md` |
| S3 | not_started | support_needed_now | scripts-audits maintainer | audit/report cadence | usage audit | Report files in `scripts/audits` do not define generation freshness policy | `base-trait-coverage.report.json`, `base-trait-key-coverage.report.json`, `race-image-byte-audit.json`, `slice-of-life-settings.json` | Without freshness policy owners may use stale snapshots as live truth | Add run cadence and ownership in this project tracker | verify file `generatedAt` timestamps are current before trusting outputs |
| S4 | not_started | blocked_human_decision | project owner | policy | review | How much of `scripts/audits` should be moved into CI/local mandatory checks versus optional/manual workflows is not decided | `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`, `docs/portraits/race_portrait_regen_handoff.md` | Over-broad automation can block normal contributor flow, while under-coverage can miss regressions | Confirm policy before binding new CI gates | record decision in a follow-up PR or project tracker note |

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
- Move unrelated or cross-project policy questions to `docs/projects/GLOBAL_GAPS.md`.
