# GAPS: Scripts: Tooling

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings tied directly to the scripts-tooling project.

Current iteration note: no new project-local gaps were added in this pass. The stale shared-path ambiguity is tracked centrally in `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| STG-001 | not_started | adjacent_follow_up | Worker C | `docs/projects/scripts-tooling/TRACKER.md` | Docs scan | `script-registry.json` tracks only one tooling bucket entry for `scripts/tooling/script-tracker.ts`; most `scripts/tooling` scripts are not represented in the branch registry yet. | `scripts/tooling/script-registry.json`, `.run-log.json` | Registry consumers do not show a complete tooling-script view. | Decide whether a `scripts-tooling` branch should be added or registry is intentionally scoped to selected scripts. | `rg -n "scripts/tooling/" scripts/tooling` and registry review. |
| STG-002 | not_started | support_needed_now | Worker C | `docs/projects/scripts-tooling/TRACKER.md` | Docs scan | Only `serialize-session-proof.ts` currently calls `trackRun()`, so most scripts in this folder do not update shared run metadata unless manually touched by workflow actors. | `scripts/tooling/script-tracker.ts`, `scripts/tooling/serialize-session-proof.ts` | Run freshness metrics can be misleading and reduce the value of tooling touch views. | Add `trackRun(import.meta.url)` in selected scripts or document why this folder is intentionally outside tracking. | Review `.run-log.json` coverage and script call-sites with no `@script-meta`. |
| STG-003 | not_started | adjacent_follow_up | Worker C | `docs/projects/scripts-tooling/` | Docs scan | Some scripts have `Called by:` workflow notes, but invocation evidence is not centrally indexed, so runtime path changes can be missed. | `scripts/tooling/*.ts` header comments, `public/agent-docs/workflows/*.md` | Manual linkage is fragile for future maintenance. | Consider a small indexed source of workflow-to-script mapping. | Add a dedicated map doc or registry annotation and keep it in project scope. |

## Classification Reference

- `in_scope_now` - required for active task completion.
- `support_needed_now` - blocks clean operation, but not the immediate task.
- `adjacent_follow_up` - useful work, not required to finish the docs refresh.
- `out_of_scope` - intentionally ignored here.
- `blocked_human_decision` - needs explicit owner decision.
- `blocked_external_state` - blocked on another system or environment state.

## Update Rules

- Keep each gap tied to evidence and a concrete next proof condition.
- Route non-project gaps into `docs/projects/GLOBAL_GAPS.md` and mark as routed.
- Close only with evidence or an explicit reclassification.
