# Scripts: Audits Gap Registry

Status: active â€” S4 decision recorded 2026-06-10
Last updated: 2026-06-10

This file is the durable open-gap list for `scripts/audits`. Keep it compact,
actionable, and aligned with the active tracker queue.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | not_started | support_needed_now | scripts-audits maintainer | scripts/audits execution | docs scan | There is still no single canonical entrypoint for the full audit surface | `package.json` exposes `audit:races`, `scan`, and other separate commands, but no combined audit command for all files in `scripts/audits` | Manual re-runs can miss checks and produce inconsistent safety posture | Define the project-local check order in docs and keep it visible in North Star | Run the ordered checks from `NORTH_STAR.md` without guessing |
| S2 | not_started | adjacent_follow_up | scripts-audits maintainer | QA batch workflows | docs scan | Old dated files in `scripts/audits/qa-batches` can still be mistaken for active source output | `scripts/audits/qa-batches/*.input.json`, `*.output.json`, `*.raw.json` | Stale artifacts are easy to up-level as evidence and can hide regression in review lanes | Add a clear retention or refresh rule and archive process for aged files | Confirm the latest batch id appears in the refreshed handoff |
| S3 | not_started | support_needed_now | scripts-audits maintainer | audit/report cadence | docs scan | Report files in `scripts/audits` do not define a freshness policy | `base-trait-coverage.report.json`, `base-trait-key-coverage.report.json`, `race-image-byte-audit.json`, `slice-of-life-settings.json` | Without freshness policy, owners may use stale snapshots as live truth | Add run cadence and ownership in this tracker or North Star | Verify `generatedAt` timestamps are current before trusting outputs |
| CMA-G19 | not_started | adjacent_follow_up | scripts-audits owner | `docs/projects/code-modularization-audit/GAPS.md` CMA-G19 | Code modularization audit routing | `generateSpellReferencedRulesEnrichment.ts` (~743 lines), `auditSpellSubClassesRoster.ts` (~671 lines), and `captureSpellCanonicalData.ts` (~658 lines) are large multi-stage scripts; modularization should preserve the generator/harvest sequence and emitted artifacts. | `scripts/generateSpellReferencedRulesEnrichment.ts`; `scripts/auditSpellSubClassesRoster.ts`; `scripts/archive/spell-canonical-retrieval/captureSpellCanonicalData.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G19 | Splitting without stage-boundary proof can lose the harvest sequence or break the canonical outputs the scripts produce. Blocked on S4 (automation policy decision). *(S4 resolved 2026-06-10: audits stay optional/manual â€” CMA-G19 is unblocked under the manual policy.)* | Accept or defer the inbound CMA-G19 route; if accepting, resolve S4 first and create a narrow stage-boundary split plan with script dry-run or diff-check proof. *(S4 is resolved as of 2026-06-10 â€” the route may now be accepted under the manual policy.)* | Owner gap row exists and CMA-G19 status is updated to reflect acceptance or deferral. |

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

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
