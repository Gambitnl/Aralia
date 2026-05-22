# Spell Phase 1 Artifact Lifecycle Policy

Status: active policy for Spell Phase 1 slices.

This policy defines what happens to planning, prompt, receipt, proof, generated,
and setup artifacts after each bounded Spell Phase 1 slice. It exists because
cleanup should prevent stale task context from misleading future agents without
destroying the durable evidence humans need to understand what happened.

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
| Package task packet | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`, `PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`, prompt packet, dispatch checklist | Keep while active. After completion, mark completed/superseded and link final PR/receipts. Archive later only if the summary remains reachable from the plan and still helps future Aralia contributors. |
| Receipts | environment snapshot, git sync, PR/deployment/local-sync, ROI, foreman review, task communication | Keep when they explain a durable decision or boundary. Do not retain transient Symphony handoff payloads, click receipts, draft ids, or run-state dumps unless they are intentionally summarized into a packet or migration note. |
| Proof screenshots | `docs/tasks/spells/evidence/*.png` | Keep while referenced by a receipt. If superseded, archive or mark superseded; delete only when no durable doc references it. |
| Generated reports | spell gate report, spell audits, mechanics reports | Keep canonical generated outputs that the app or reports consume. For review-only generated reports, regenerate at checkpoints and archive/delete stale copies only when the source command and replacement output are documented. |
| Runtime state | `.symphony/`, `conductor/symphony/.symphony/`, `.jules/runs/`, `.jules/verification/`, `.jules/dashboard/`, `.jules/orchestrator/`, `.playwright-*`, generated manifests, local dashboard state, draft ids, click receipts, retry state, local sync receipts | Ignore or delete as local runtime artifacts. Do not commit unless a specific packet or migration note intentionally captures a small durable excerpt. |
| Local app/operator settings | `.codex/config.toml`, local credentials, tokens, machine preferences | Ignore. Never commit. |
| Setup branch artifacts | setup PR docs, setup verifier changes, branch receipts | Keep until the setup PR is merged and Package 2 dispatch has been proven from `master`. Then mark final state; do not delete if later slices need to understand the handoff boundary. |

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
- receipts that prove a live Symphony/Jules/GitHub boundary;
- proof images still referenced by receipts;
- package prompts/tasks before the package's final PR, deployment/local-sync,
  ROI, and review receipts are complete;
- unfinished or future-facing scaffolds merely because they look stale.

## Package 2 Application

For Package 2, the setup docs and receipts remain active until:

1. PR #933 or its replacement lands the setup context on `master`;
2. local `master` is synced and Symphony preflight is rerun from `master`;
3. `draft-1779344522441-vdy0hi` is promoted/dispatched or explicitly superseded;
4. Jules returns an implementation PR or recorded non-PR result;
5. Codex fills the foreman review, Atlas/gate, task communication,
   PR/deployment/local-sync, and ROI receipts.

Only after those proofs exist should the Package 2 prompt/task/checklist files
be marked completed or archived. They should not be deleted unless a later
canonical summary preserves their important context.

## Package 4 Application

For Package 4, keep the deterministic combat simulator pilot packet in
`docs/tasks/spells/PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md` or its
replacement. Treat transient Symphony draft ids, handoff receipts, click
receipts, and local sync state as external or ignored unless the packet needs a
short durable summary for future Aralia contributors.

## Package 3 Application

For Package 3, keep the spell-selection and spellbook-visibility packet in
`docs/tasks/spells/PACKAGE_3_SPELL_SELECTION_AND_SPELLBOOK_VISIBILITY.md` or
its replacement. Treat creator-session scratch state, sheet inspection receipts,
and other orchestration internals as external or ignored unless the packet needs
short durable proof notes for future Aralia contributors.
