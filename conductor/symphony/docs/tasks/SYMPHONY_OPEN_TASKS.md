# Symphony Open Task Order

This file is the current ordered work queue for the Symphony/Jules middleman track.
It merges the live audit, the operating spec, and the older per-task handoff files
into one place future Codex foremen can read before acting.

Use this file for sequencing. Use `../JULES_MIDDLEMAN_OPERATING_SPEC.md` for the
intended behavior, `../../JULES_MIDDLEMAN_AUDIT.md` for proof history, and
`../SYMPHONY_MIDDLEMAN_ARCHITECTURE.md` for file ownership.

Current full goal: build and prove the Symphony delegation workflow end to end:
Codex foreman clarification, Linear tracking, Jules staging/launch, Jules
planning/execution/PR creation, GitHub checks, deployment state, repair or
feedback sequencing, merge readiness, local repo sync after merge, and a
task-level Delegation ROI ledger that separates measured facts from estimates.
The implementation, workflow intent, audit, architecture overview, and ordered
task documents must stay current as each proof stage advances.

## Current Live Thread

- Payload: ARA-6, "Add regression coverage for non-proficient weapon attack penalties"
- Linear: `https://linear.app/aralia/issue/ARA-6/add-regression-coverage-for-non-proficient-weapon-attack-penalties`
- Jules session: `https://jules.google.com/session/4101281510355198885`
- Handoff id: `handoff-1779226708033-v4ohk7`
- GitHub PR: `https://github.com/Gambitnl/Aralia/pull/931`
- Latest known workflow finding: local Jules/Symphony status initially reported
  `COMPLETED` with no PR URL while Jules API, browser-visible state, and GitHub
  exposed additional facts. Current browser evidence shows `Plan approved`,
  `All plan steps completed`, `View PR`, and failed check summaries; Jules API
  and GitHub expose PR #931. Symphony now reconciles that missing local PR URL
  from the Jules API session output and records PR #931, but Scout/Core,
  repair/feedback, deployment, merge, local sync, and ROI proof remain open.

## Interaction Rules While Jules Works

1. Prefer read-only observation over chat.
2. Do not send chat messages to Jules unless there is a clear blocker, stale plan,
   missing context, or explicit operator instruction. Chat may distract Jules from
   producing the final PR/commit button.
3. Treat Jules web UI, local `.jules/runs` records, Symphony API state, Linear,
   and GitHub as separate signals. Do not trust one signal when another directly
   contradicts it.
4. When waiting, record elapsed time and stage transitions, but do not run a tight
   polling loop. A five-minute manual cadence is reasonable while active work is
   expected; longer waits are acceptable when no boundary is due.
5. If the page exposes a plan approval, PR creation button, commit/PR button, or
   other mutation boundary, stop and confirm the intended action unless the
   operator already approved that exact action.
6. Keep runtime artifacts ignored. Durable learning belongs in docs and the audit;
   only deliberately selected milestone proof should be committed.

## Jules Environment Setup Finding

The Jules repository Environment page for `Gambitnl/Aralia` exposes:

- a setup script textbox;
- a `Run and snapshot` button;
- text stating that the repository is cloned automatically into `/app`;
- text stating that a successful setup script is snapshotted for faster startups;
- optional environment variables;
- network access enabled for agent execution and always available during setup.

The public Jules environment documentation says tasks run in short-lived Ubuntu
VMs with common tools preinstalled, including Node.js, npm, and `rg`; it also
says `Run and Snapshot` validates the setup script and saves a reusable snapshot
for future tasks. For Aralia, that means environment setup can reduce repeated
dependency-install friction, but it should not hide repository health problems.

Recommended setup script after the lockfile is repaired:

```bash
npm ci --no-audit --no-fund
npm run typecheck
```

Short-term diagnostic setup candidate while the lockfile is out of sync:

```bash
npm install --no-audit --no-fund
npm run typecheck
```

Rationale: Aralia uses npm, TypeScript, Vite, and Vitest. The PR #931 GitHub
checks currently fail at `npm ci` because `package.json` and `package-lock.json`
are not in sync, before Jules' actual regression tests can run. `npm install`
may allow environment exploration, but it can also update the lockfile inside the
Jules working copy. Do not add secrets. Do not run and snapshot any script until
the operator approves the exact script on the Jules Environment page.

## Ordered Work Queue

| Order | Task | Status | Next action | Needs operator? |
|---:|---|---|---|---|
| 1 | ARA-6 Jules status reconciliation | Implemented for API PR output | Jules API session-output reconciliation now fills in PR #931 when stored local state has no PR URL. Browser fallback remains a future guard for cases where API evidence is missing or contradicted. | No for read-only inspection; yes for PR/commit/approval/chat actions. |
| 2 | ARA-6 PR detection and GitHub watch | PR refreshed through Symphony | Symphony recorded PR #931 from Jules API output, branch `add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885`, and failing check state in `ara6-pr-refresh-summary-2026-05-20.json`. | No for read-only refresh; yes for feedback comments or merge. |
| 3 | PR checks and feedback path | Repair decision packet implemented | Symphony classifies the live ARA-6 build/lint/test/quality failures as `workflow_setup`, changes the foreman label to `Resolve CI Setup Blocker`, and now emits a read-only repair decision packet with choices for setup repair task, Jules feedback, manual wait, or refresh-after-repair. Do not send Jules feedback automatically; the operator must choose a repair lane first. | Yes before sending feedback, comments, local fixes, or new Linear tasks. |
| 4 | Scout/Core readiness | Waiting on green checks | Classify changed-file risk, Scout conflict signals, external review comments, and Core readiness after the setup/check blockers are resolved. | Yes before Core merge/validation mutation. |
| 5 | GitHub Pages deployment gate | Waiting on merge | After merge, inspect GitHub Pages deployment health before local sync is considered complete. | No for read-only deployment check; yes for repair actions. |
| 6 | Local sync readiness | Waiting on merge/deployment | Verify local branch, dirty state, ahead/behind, and fast-forward safety. Expose sync only when safe. | Yes before mutating local Git. |
| 7 | Symphony task-centered dashboard | Open design/implementation | Build task list views, task detail page, task timeline, task-scoped Codex chat, optional terminal-simulator live mirror, pending-human-input badge, and expandable Jules prompt/dialogue records. The structured task event log remains canonical; terminal scrollback is only a view. | No for implementation if scoped; yes for UX choices that change operator workflow. |
| 8 | Jules visual/session reconciliation in Symphony | Open implementation | Add first-class states for "stored status says complete but visible Jules needs action" and "stored status has no PR URL but GitHub has a matching session PR". | No for local implementation; yes before automating external actions. |
| 9 | Jules environment setup script | Pending decision | Review exact setup script, then optionally run and snapshot on Jules Environment page. | Yes. |
| 10 | Open task/docs consolidation | Ongoing | Keep this file, the audit, architecture overview, spec, README, and per-task files in sync as implementation/proof stages advance. Mark old Task 02-04 files as superseded by ARA-6 evidence where appropriate. | No. |
| 11 | Delegation ROI ledger | Open design/implementation | Add per-task measured Codex spend, Jules/GitHub elapsed time, human intervention counts, local-edit avoidance, workflow-value signals, and estimated avoided Codex work with confidence/caveats. | No for local implementation; yes before claiming real savings. |
| 12 | Quiet-hour and human-blocker behavior | Open design/implementation | Add task states for waiting on operator, plain-language question, local time/quiet-hour policy, and non-busy wake-up behavior. | Maybe, for quiet-hour preferences. |
| 13 | Dispatch/real worker proof | Deferred | Prove local Codex worker dispatch consumes worker-mode policy only after the Jules/GitHub path is stable and dashboard control is clear. | Yes before enabling real dispatch. |

## Dashboard Improvements Identified By ARA-6

These are implementation targets, not proof claims:

1. Add fallback PR discovery when Jules/Symphony stores `COMPLETED` with
   `pullRequestUrl: null`: prefer Jules API `GetSession`/activities when a key
   is available, fall back to browser inspection when API evidence is missing or
   suspect, then search GitHub by session id, generated branch name, handoff
   title, and Linear issue before showing "no PR".
2. Add a task detail timeline that keeps Linear creation, manifest staging,
   Jules launch, plan approval, PR creation, check completion, and future merge
   or deployment events in chronological order.
3. Add a check-blocker classification layer so setup/workflow failures such as
   lockfile mismatch or stale Gemini model config are not presented as failed
   Jules implementation logic. Local verifier coverage exists for the ARA-6
   build/lint/test/quality setup pattern, and the live PR #931 Symphony refresh
   now records the actual `workflow_setup` blocker packet.
4. Add a task-scoped operator question panel for decisions such as whether to
   fix the lockfile locally, send Jules feedback, or adjust the workflow config.
   The first repair-decision packet now exists for PR #931 and asks whether to
   create a setup repair task, send Jules feedback, wait for manual repair, or
   refresh after repair.
5. Keep the main dashboard focused on the current boundary and move full packet
   detail into expandable task sections or `/proof`, so the operator is not
   forced to scan every low-level safety packet during a live task.
6. Add a Delegation ROI ledger that shows measured Codex tokens/runtime and
   foreman turns separately from estimated avoided Codex implementation tokens,
   avoided turns, avoided debugging cycles, and confidence notes.
7. Add an optional terminal-simulator panel for live Codex foreman visibility,
   backed by a real process/PTY only when useful. Store the durable task chat,
   questions, answers, blockers, and decisions as structured task events rather
   than relying on terminal scrollback.

## Objective Completion Audit

This section audits the completed mapping/documentation slice. It is preserved
because it explains how ARA-6 informed the current full workflow goal; it is not
a claim that the full Symphony delegation workflow is implemented.

| Requirement | Evidence | Status |
|---|---|---|
| Observe ARA-6 without disrupting Jules | Read-only GitHub CLI refresh showed PR #931 is still open, not draft, mergeable, and unchanged since `2026-05-19T22:56:36Z`. No Jules chat, feedback, environment snapshot, CI rerun, merge, or local sync was performed during this documentation pass. | Achieved for the current observation slice |
| Record timing and stage transitions | Timing log records Symphony/Jules launch, visible plan approval mismatch, PR creation at `2026-05-19 22:55 UTC`, check failure window, `2026-05-20 01:05 Europe/Amsterdam` PR refresh, and Jules Environment setup inspection. | Achieved, continue appending future observations |
| Record safe interaction rules | `Interaction Rules While Jules Works` defines read-only preference, chat restraint, separate-signal treatment, non-tight polling cadence, mutation-boundary confirmation, and runtime-artifact handling. | Achieved |
| Inspect Jules environment configuration opportunities | `Jules Environment Setup Finding` records the Environment page controls, the public docs' snapshot behavior, and the safe setup-script recommendation split between post-lockfile `npm ci` and diagnostic `npm install`. | Achieved; no setup mutation performed |
| Consolidate stale Symphony task/docs into ordered checklist | `Ordered Work Queue` sequences the remaining work, and `Superseded Per-Task Status` marks Task 02, Task 03, and Task 04 against ARA-6 evidence. | Achieved for documentation; files must be committed to make it durable |
| Identify dashboard improvements for future Codex foremen | `Dashboard Improvements Identified By ARA-6` lists fallback PR discovery, task timeline, check-blocker classification, task-scoped operator questions, and current-boundary dashboard focus. | Achieved as an implementation target list |
| Prove the full Symphony implementation is complete | Audit/spec still show open implementation proof for browser fallback, Scout/Core readiness, repair/feedback sequencing, deployment, local sync, quiet-hour behavior, ROI, and real worker dispatch. | Not achieved; keep the broader Symphony goal active |

## Current Full-Workflow Completion Audit

| Requirement | Current evidence | Status |
|---|---|---|
| Codex clarifies tasks and acts as foreman through Symphony | Foreman prompt/routing contracts exist, but ARA-6 used a partially manual flow and does not yet prove a task-scoped dashboard chat/clarification loop. | Partially achieved |
| Linear tracking | ARA-6 created Linear issue `ARA-6` through Symphony after clean Git proof. | Achieved for ARA-6 |
| Jules staging and launch | ARA-6 staged `handoff-1779226708033-v4ohk7` and launched Jules session `4101281510355198885`. | Achieved for ARA-6 |
| Jules planning/execution/PR creation follow-through | Browser inspection and Jules API/GitHub evidence showed more state than the local `pullRequestUrl: null` record. Symphony now reconciles the missing PR URL from Jules API session output for PR #931. | Partially achieved |
| GitHub checks and repair/feedback sequencing | PR #931 is now refreshed through Symphony, classified as a `workflow_setup` blocker with next action `Resolve CI Setup Blocker`, and carries a read-only repair decision packet. The actual chosen repair/feedback sequence and Scout/Core readiness proof have not run yet. | Partially achieved |
| Deployment state | No merged PR or GitHub Pages deployment proof exists for ARA-6. | Not achieved |
| Merge readiness and local repo sync after merge | Local sync readiness contracts exist, but no real merged dashboard-started Jules PR has gone through local sync. | Not achieved |
| Delegation ROI ledger | Spec now defines measured facts, estimated avoided Codex work, workflow-value signals, data sources, and "ROI unknown" behavior. No task-level ledger implementation exists yet. | Specified, not implemented |

## Superseded Per-Task Status

The older task files remain useful as handoff prompts, but their status sections
must be read through the ARA-6 evidence:

- `02-linear-creation-proof.md`: superseded by ARA-6 Linear issue creation.
- `03-jules-manifest-staging-proof.md`: superseded by ARA-6 manifest staging.
- `04-jules-launch-readiness-and-launch-proof.md`: superseded through Jules launch
  and PR discovery, but still open for Symphony-side reconciliation of missing
  local PR URL and check-status follow-through.
- `05-dispatch-toggle-real-worker-proof.md`: still deferred.
- `06-dynamic-worker-mode-consumption-proof.md`: local contract proof exists; live
  worker consumption remains deferred.

## Timing Log

Record future observations here or in the audit when they become meaningful.

| Time | Source | Stage | Observation | Next check |
|---|---|---|---|---|
| 2026-05-19 | Symphony/Jules | Launch | ARA-6 Linear issue, manifest, and Jules session were created. | Inspect Jules session for visible state. |
| 2026-05-19/20 | Jules web/API/GitHub | Reconciliation mismatch | Current web evidence shows `Plan approved`, `All plan steps completed`, `View PR`, and failed check summaries; Jules API and GitHub expose PR #931 while local Symphony status lacked `pullRequestUrl`. | Map API/browser/GitHub evidence into Symphony state. |
| 2026-05-19 22:55 UTC | GitHub | PR created | PR #931 was opened from branch `add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885` with three changed files. | Map PR into Symphony state. |
| 2026-05-19 22:55-22:56 UTC | GitHub Actions | Checks failed | Build, lint, tests, and advisory quality scan fail at `npm ci` because the lockfile is out of sync. Gemini review fails because `gemini-1.5-flash` is unavailable. | Decide whether to fix CI/setup separately or send Jules feedback. |
| 2026-05-20 01:05 Europe/Amsterdam | GitHub CLI | Status refresh | PR #931 remains open, not draft, mergeable, and unchanged since `2026-05-19T22:56:36Z`; the same failed/pass check set remains visible. | Refresh through Symphony once fallback PR discovery exists. |
| 2026-05-19 23:38 UTC | Symphony API | PR refresh | `ara6-pr-refresh-summary-2026-05-20.json` proves Symphony matched PR #931 from Jules API session output, refreshed nine GitHub checks, classified build/lint/test/quality as `workflow_setup`, and set next action to `Resolve CI Setup Blocker` without external mutation. | Decide the setup/workflow repair path before sending Jules feedback. |
| 2026-05-19 23:52 UTC | Symphony API | Repair decision packet | `ara6-pr-repair-decision-refresh-2026-05-20.json` proves the refreshed handoff now includes `githubPullRequestRepairDecision.status: needs_operator_decision`, category `workflow_setup`, and options `create_setup_repair_task`, `send_jules_feedback`, `wait_for_manual_repair`, and `refresh_after_repair`. | Operator chooses the repair lane; Symphony must not guess or mutate externally. |
| 2026-05-20 | Jules Environment page | Setup opportunity | Page supports setup script plus `Run and snapshot`; no script has been run by Codex. Public docs confirm snapshots can speed later tasks after successful setup. | Review setup script after lockfile decision. |
