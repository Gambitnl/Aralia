# Spell Phase 1 Decision Lessons Resolution

Status: active lesson-resolution matrix.
Last updated: 2026-05-27.

Purpose: extract the reusable lessons from the oversized decision ledger and
show where each lesson is now resolved. A lesson is resolved when it has a live
operating rule, tracker row, package-template rule, or explicit remaining gap.
This file is not another chronological log.

## Resolution States

| State | Meaning |
|---|---|
| `implemented` | A rule or tracker/process update now tells agents what to do. |
| `active_gap` | The lesson is understood, but source/dashboard/template work remains. |
| `monitor` | The rule exists; future packages should prove whether it holds. |
| `retired` | The lesson is historical and no longer needs active routing attention. |

## Lessons

| Lesson | Resolution | Owning live surface | Current rule |
|---|---|---|---|
| Tool approval prompts are not automatically project approval gates. | `implemented` | `SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`; `JULES_MIDDLEMAN_OPERATING_SPEC.md` | Separate environment/tool boundaries from project decisions. Record the exact external proof needed, but do not block product scope on generic tooling prompts. |
| Durable context should be concise and Aralia-facing, not raw Symphony output. | `implemented` | `../../../docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`; `../../../AGENTS.md` | Commit task packets, prompts, tracker updates, product PR links, acceptance summaries, and short blocker explanations. Keep generated manifests, click receipts, draft ids, local task-store churn, and raw Jules/Symphony runtime state ignored or external. |
| Jules sessions are isolated launch clones. | `implemented` | `../JULES_MIDDLEMAN_OPERATING_SPEC.md`; `../tasks/SYMPHONY_OPEN_TASKS.md` | Later local tracker edits or merged GitHub docs do not reach a running Jules session automatically. Use a visible Jules message, bounded PR feedback, PR-branch repair/rebase, or replacement handoff. |
| Active Jules work needs visual page inspection. | `implemented` | `../JULES_MIDDLEMAN_OPERATING_SPEC.md`; `../tasks/SYMPHONY_OPEN_TASKS.md` | Dashboard/local status is only one signal. Open the visible Jules page when a task is active and record whether it is planning, waiting, working, failed, or showing PR proof. |
| Ordinary Jules progress is not a full decision. | `implemented` | `SPELL_PHASE_1_DECISION_TRENDS_INDEX.md`; `../JULES_MIDDLEMAN_OPERATING_SPEC.md` | Queue/setup/working/verify refreshes should be compact wait rows unless the foreman must choose between materially different actions. |
| Plan revision feedback should change the next action away from stale approval. | `active_gap` | `../tasks/SYMPHONY_OPEN_TASKS.md` | After Codex sends a bounded revision note while Jules waits for approval, the dashboard should route to refresh/wait for revised plan, not keep surfacing `Approve Jules Plan`. |
| Package selection must come from the living tracker and execution plan. | `implemented` | `../../../docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`; `../../../docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md` | Do not encode temporary package state into the goal. Pick the next package from tracker evidence and update the tracker before dispatch. |
| Jules package size needs a higher minimum boundary. | `implemented` | `../JULES_MIDDLEMAN_OPERATING_SPEC.md`; `../../../docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` | Jules should get coherent multi-row mechanics/schema/test batches or deliberate workflow proofs. One-file docs, stale counts, PR-body edits, raw-artifact cleanup, tracker closeout, and branch-hygiene acceptance repairs stay local. Add a concrete `Jules value: ...` line before launch. |
| Plans that name out-of-scope files require rejection or justification. | `implemented` | `../JULES_MIDDLEMAN_OPERATING_SPEC.md`; package task packets | Withhold approval unless the extra file is necessary, package-local, and explicitly justified. |
| Larger packages still need classification-first planning. | `monitor` | `../tasks/SYMPHONY_OPEN_TASKS.md`; future package packets | Require full candidate classification before implementation selection, then list `implement_now`, residual, deferred, and out-of-scope rows. |
| Helper artifacts and workflow quota bypasses are branch noise, not product work. | `implemented` | `SPELL_PHASE_1_DECISION_TRENDS_INDEX.md`; `../tasks/SYMPHONY_OPEN_TASKS.md` | Ask Jules to remove scratch scripts/caches before PR submission. If final PR still carries helper or workflow noise, preserve accepted product files on a clean branch or reject the PR. |
| Useful Jules work can be salvaged through bounded branch hygiene. | `implemented` | `SPELL_PHASE_1_DECISION_TRENDS_INDEX.md`; `../JULES_MIDDLEMAN_OPERATING_SPEC.md` | After at least one clear repair request, a foreman may repair the PR branch from current `origin/master` if it preserves only accepted product/test/docs and reruns focused proof. |
| A new Jules PR head does not automatically resolve repair feedback. | `implemented` | `../tasks/SYMPHONY_OPEN_TASKS.md`; `SPELL_PHASE_1_DECISION_TRENDS_INDEX.md` | Compare the new diff with the requested repair. Green checks or a changed commit hash are not enough. |
| One explicit `@jules` nudge is enough before choosing a different repair path. | `implemented` | `SPELL_PHASE_1_DECISION_TRENDS_INDEX.md` | If bounded repair feedback receives no useful head change, post one clear nudge. After acknowledgement or another incomplete repair, choose branch hygiene, replacement handoff, or stale filing instead of looping indefinitely. |
| Local `COMPLETED` without PR proof is not package closeout. | `active_gap` | `../tasks/SYMPHONY_OPEN_TASKS.md` | Treat no-PR completion as `needs_browser_reconciliation` until visible Jules/GitHub proof confirms a PR, blocker, or true no-PR result. |
| Fresh drafts must outrank stale completed handoffs in the dashboard queue. | `active_gap` | `../tasks/SYMPHONY_OPEN_TASKS.md` | Completed/local-current handoffs and closed PR feedback should remain history, but the global next action should prefer the newest ready draft when no live boundary requires operator action. |
| Visible controls must remain stable while the operator interacts. | `monitor` | `../tasks/SYMPHONY_OPEN_TASKS.md`; dashboard verifier suite | Task-intake controls should not detach during interaction. Future dashboard controls should follow the open-drawer stability rule. |
| Mutation labels need to match real external boundaries. | `active_gap` | `../tasks/SYMPHONY_OPEN_TASKS.md`; task-page safety labels | Linear creation, manifest staging, Jules launch, PR feedback, push, merge, and local sync should be labeled as real boundary changes, not harmless display refreshes. |
| Decision evidence should be modular. | `implemented` | This file; `SPELL_PHASE_1_DECISION_TRENDS_INDEX.md`; archived full ledger | Use the short decision record as the entry point, the trend index for operator reading, the lesson matrix for reusable rules, and the archive only for exact historical audit. |

## Retired Historical Lessons

| Lesson | Why retired |
|---|---|
| Package 2 setup needed the original assumed-approval decision scaffolding. | Package 2 through Package 15 proved the basic decision trail. The active need is compact routing, not a longer chronological ledger. |
| Every phase needed a full decision entry during the test flow. | Superseded by compact wait-state logging and the lesson matrix. Full entries are now only for real forks. |

## Remaining Work Queue

These are the unresolved lessons that still need source/dashboard/template work:

1. Make plan-revision feedback route to refresh/wait instead of stale approval.
2. Reconcile local Jules `COMPLETED` with visible Jules/GitHub proof before
   calling a package complete.
3. Keep fresh drafts ahead of stale completed handoff history in the visible
   dashboard queue.
4. Keep visible controls stable during interaction.
5. Correct task-page mutation labels for external boundary actions.
6. Add the `Jules value: ...` line to future package templates and dashboard
   launch/approval surfaces.
