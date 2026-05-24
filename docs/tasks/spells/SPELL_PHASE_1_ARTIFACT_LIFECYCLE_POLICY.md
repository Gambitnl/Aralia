# Spell Phase 1 Artifact Lifecycle Policy

Status: active policy for Spell Phase 1 slices.

This policy defines what happens to planning, prompt, proof, generated, setup,
and summarized receipt artifacts after each bounded Spell Phase 1 slice. It
exists because cleanup should prevent stale task context from misleading future
agents without destroying the durable evidence humans need to understand what
happened.

## Default Bias

Preserve durable context. Do not delete a task file only because the task is
done.

The safe default is:

1. keep canonical plans, reports, and decision records;
2. mark completed or superseded package files clearly;
3. archive rather than delete when a file still explains why work happened;
4. delete only temporary/runtime artifacts, generated junk, or duplicate stale
   files that have a named replacement;
5. record deletion decisions when they remove human-readable context.

## Artifact Classes

| Class | Examples | Default action after slice completion |
|---|---|---|
| Canonical plan | `EARLY_GAME_SPELL_EXECUTION_PLAN.md`, live package order, completion definition | Keep and update in place. |
| Decision report | `SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md` | Keep. Append decisions; do not rewrite history except for explicit correction notes. |
| Package task packet | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`, `PACKAGE_3_SPELL_SELECTION_AND_SPELLBOOK_VISIBILITY.md`, `PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`, prompt packet, dispatch checklist | Keep while active. After completion, mark completed/superseded and link the final product PR and any concise acceptance summary. Archive later only if the summary remains reachable from the plan and still helps future Aralia contributors. |
| Receipt summaries | environment snapshot, git sync, PR/deployment/local-sync, ROI, foreman review, task communication | Keep only when the summary explains a durable Aralia decision, boundary, blocker, or acceptance result. Treat raw Symphony handoff payloads, click receipts, draft ids, local task-store churn, support-PR lists, and run-state dumps as external or ignored unless a short excerpt is intentionally summarized into a packet or migration note. |
| Proof screenshots | `docs/tasks/spells/evidence/*.png` | Keep while referenced by a receipt. If superseded, archive or mark superseded; delete only when no durable doc references it. |
| Generated reports | spell gate report, spell audits, mechanics reports | Keep canonical generated outputs that the app or reports consume. For review-only generated reports, regenerate at checkpoints and archive/delete stale copies only when the source command and replacement output are documented. |
| Runtime state | `.symphony/`, `conductor/symphony/.symphony/`, `.jules/runs/`, `.jules/feedback/`, `.jules/verification/`, `.jules/dashboard/`, `.jules/orchestrator/`, `.playwright-*`, generated manifests, local dashboard state, draft ids, click receipts, retry state, local sync receipts | Ignore or delete as local runtime artifacts. Do not commit unless a specific packet or migration note intentionally captures a small durable excerpt. |
| Local app/operator settings | `.codex/config.toml`, local credentials, tokens, machine preferences | Ignore. Never commit. |
| Setup branch artifacts | setup PR docs, setup verifier changes, concise setup summaries | Keep until the setup PR is merged and Package 2 dispatch has been proven from `master`. Then mark final state; do not preserve raw branch receipts unless later slices need the exact handoff boundary. |

## Slice Closeout Checklist

At the end of each package, Codex should record:

1. which package artifacts remain canonical;
2. which artifacts are completed but retained for evidence;
3. which artifacts are superseded and where the replacement lives;
4. which runtime/temp artifacts were ignored or deleted;
5. whether any generated report was refreshed, accepted stale, archived, or
   intentionally left unchanged;
6. whether MemPalace targeted mining was run or intentionally deferred;
7. the next package's active context file so future agents do not restart from
   stale prompts.

## Deletion Guardrails

Deletion is allowed only when at least one is true:

- the file is local runtime state already covered by `.gitignore`;
- the file is generated junk with a documented regeneration command;
- the file is a duplicate and the retained replacement is linked from the plan;
- the file contains local machine settings, credentials, or operator-only state
  that should never have been committed;
- the decision report records why the context is no longer needed.

Do not delete:

- canonical plans;
- decision reports;
- concise receipt summaries that prove a live Aralia package boundary or
  acceptance result;
- proof images still referenced by durable summaries;
- package prompts/tasks before the package's final PR, deployment/local-sync,
  ROI, and review summaries are complete;
- unfinished or future-facing scaffolds merely because they look stale.

## Completed Package Application

Packages 2 through 6 now have durable tracker entries and product evidence.
Their packets, prompts, concise receipts, and acceptance summaries should remain
reachable from `SPELL_PHASE_1_TASK_TRACKER.md`, but they are historical
evidence rather than active dispatch instructions.

Keep:

1. Package task packets and prompts that define accepted scope.
2. Concise closeout summaries that explain PRs, local consolidation, or known
   follow-up gaps.
3. Final product PR links and local consolidation notes.
4. Acceptance evidence that future Aralia contributors would need to understand
   why the package is considered done.

Do not keep expanding historical package files with raw Symphony state. Draft
ids, handoff payloads, local feedback drafts, dashboard caches, support-PR
lists, click receipts, and generated manifests should remain external or
ignored unless a short excerpt explains a durable package decision.

## Active Boundary Application

The active post-Package 6 boundary is checkout hygiene and next-package
selection, not cleanup of completed package history. Use the tracker's
`Current Local Change Classification` section before starting another Jules
handoff.

Current next-package candidates are:

1. `G48` Atlas discoverability/source repair.
2. `G49` a small buff/status combat bridge follow-up.

Neither should start from a checkout that also contains unrelated PHB
glossary/rules migration or BattleMap/glossary source edits.
