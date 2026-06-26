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
| Decision report | `SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`, `SPELL_PHASE_1_DECISION_TRENDS_INDEX.md`, `SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md`, archived full ledger | Keep the short entry point, trend index, lesson-resolution matrix, and archived history. Do not append routine waits or raw receipts to the archived ledger. Add new full decision entries only for real forks, and resolve reusable lessons into the lesson matrix. |
| Package task packet | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`, `PACKAGE_3_SPELL_SELECTION_AND_SPELLBOOK_VISIBILITY.md`, `PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`, prompt packet, dispatch checklist | Keep while active. After completion, mark completed/superseded and link the final product PR and any concise acceptance summary. Archive later only if the summary remains reachable from the plan and still helps future Aralia contributors. |
| Receipt summaries | environment snapshot, git sync, PR/deployment/local-sync, ROI, foreman review, task communication | Keep only when the summary explains a durable Aralia decision, boundary, blocker, or acceptance result. Treat raw Symphony handoff payloads, click receipts, draft ids, local task-store churn, support-PR lists, and run-state dumps as external or ignored unless a short excerpt is intentionally summarized into a packet or migration note. |
| Proof screenshots | `docs/tasks/spells/evidence/*.png` | Keep while referenced by a receipt. If superseded, archive or mark superseded; delete only when no durable doc references it. |
| Generated reports | spell gate report, spell audits, mechanics reports | Keep canonical generated outputs that the app or reports consume. For review-only generated reports, regenerate at checkpoints and archive/delete stale copies only when the source command and replacement output are documented. |
| Runtime state | `.symphony/`, `conductor/symphony/.symphony/`, `.jules/runs/`, `.jules/feedback/`, `.jules/verification/`, `.jules/dashboard/`, `.jules/orchestrator/`, `.playwright-*`, generated manifests, local dashboard state, draft ids, click receipts, retry state, local sync receipts | Ignore or delete as local runtime artifacts. Do not commit unless a specific packet or migration note intentionally captures a small durable excerpt. |
| Symphony operator/process docs | `conductor/symphony/docs/tasks/SYMPHONY_OPEN_TASKS.md`, local dashboard backlog notes, workflow scratchpads, draft inventories, task-store explanations, repeated wait-state ledgers | Local or separate-Symphony-home by default. Do not commit with Aralia product/spell PRs. If the work exposes a durable Aralia-facing lesson, copy only that lesson into this tracker, a package packet, or a migration note. |
| Symphony implementation/repair material | dashboard source, API/source files, operating spec drafts, architecture map drafts, verifier scripts, local repair branches, workflow experiments | Keep outside Aralia product PRs by default. Do not track in this repo merely because Symphony was repaired while running Aralia work. Track only a tiny migration note or Aralia-facing excerpt when it is needed to explain package history. |
| Local app/operator settings | `.codex/config.toml`, local credentials, tokens, machine preferences | Ignore. Never commit. |
| Setup branch artifacts | setup PR docs, setup verifier changes, concise setup summaries | Keep until the setup PR is merged and Package 2 dispatch has been proven from `master`. Then mark final state; do not preserve raw branch receipts unless later slices need the exact handoff boundary. |

## Symphony Boundary Rule

Symphony is the local orchestration layer around Aralia work. Its source code,
operator docs, and runtime receipts are not all the same kind of artifact.

Use this classification before syncing any Symphony-related file to GitHub:

| Category | Examples | GitHub policy |
|---|---|---|
| Aralia-facing handoff material | package task packet, Jules prompt, acceptance criteria, final PR link, concise blocker or repair summary | Track when it helps Jules or future Aralia contributors understand product work. |
| Symphony implementation/spec repair material | dashboard source, API/source files, operating spec drafts, architecture map drafts, verifier scripts, local repair branches, workflow experiments | Keep local or move to a separate Symphony home. Do not track in Aralia by default, even when the repair unblocks the Aralia task. Preserve only a concise Aralia-facing summary when future package readers need the decision. |
| Local operator/process state | `SYMPHONY_OPEN_TASKS.md`, dashboard backlog notes, draft inventories, click-path notes, repeated wait-state ledgers, local process TODOs | Keep local, ignored, or move to a separate Symphony home. Summarize only the durable lesson into Aralia-facing docs. |
| Runtime artifacts | `.symphony/`, `.jules/`, generated manifests, dashboard caches, raw receipts, task-store churn | Ignore/delete unless a small excerpt is intentionally copied into a durable packet or migration note. |

## Spark Subagent Fit

Use `gpt-5.3-codex-spark` subagents for lifecycle chores when the input and
output can be bounded to this policy and the active package docs. Spark may
prepare recommendations; the Codex foreman remains responsible for final
classification, external actions, and any decision that changes package scope.

| Chore | Spark input | Spark output | Foreman responsibility |
|---|---|---|---|
| Package artifact inventory | Completed or abandoned package file list, tracker row, and PR/session evidence | Keep/archive/delete/supersede recommendation with short rationale | Decide whether to apply it and preserve required context |
| Receipt and checklist refresh | Verification output, PR/Jules state, package checklist or receipt path | Proposed field/status updates | Confirm the evidence proves the status before committing |
| Tracker consistency scan | Package docs, tracker rows, package IDs, PR links, gap IDs | Drift list and suggested row edits | Apply only edits that match current authoritative state |
| Decision lesson extraction | Decision-report section, active tracker context, this policy | Reusable lesson summary and local/process-noise pruning recommendation | Decide what belongs in Aralia-facing history |
| Symphony artifact boundary review | Changed-file list including Symphony files | Aralia-facing vs local/Symphony-owned classification | Make the final inclusion/exclusion decision |

Do not delegate final package acceptance, Jules plan approval, GitHub comments
or branch pushes, merge/deployment/local-sync decisions, or product-scope
arbitration to Spark. Those stay with the Codex foreman.

This rule supersedes older Symphony proving-ground habits where every workflow
note was committed to the Aralia repo for continuity. If a file already exists
in Git, do not delete it casually; first classify it and either keep it local,
migrate it to the right home, or replace it with a concise Aralia-facing
summary.

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
- the decision-report entry point or lesson-resolution matrix records why the
  context is no longer needed.

Do not delete:

- canonical plans;
- decision-report entry points, trend indexes, lesson-resolution matrices, and
  archived full ledgers;
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

The post-Package 6 checkout hygiene blocker is resolved as of PR #999. The
main checkout is clean and aligned with `origin/master`, so the active boundary
is now next-package dispatch through the visible Symphony dashboard rather than
local dirty-worktree isolation.

Current next-package candidates are:

1. `G48` / Package 7 Atlas discoverability/source repair.
2. `G49` a small buff/status combat bridge follow-up.

Package 7 is the current preferred next step because Atlas proof is needed
before later packages rely on Atlas/gate checkpoints as durable completion
evidence. Start it from clean `master` through the dashboard-first workflow, and
keep raw Symphony/Jules runtime state ignored or external while preserving the
Jules-readable task packet and prompt in GitHub.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md","sha256WithoutMarker":"7c20945412d5e0e5a185c8639a82aa2e174940d8bc5d4cf7b7af639f4fcfba62","markedAtUtc":"2026-06-25T22:29:38.360Z"} -->
