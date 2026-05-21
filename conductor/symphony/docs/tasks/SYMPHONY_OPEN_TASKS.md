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

Documentation is part of the live workflow, not an after-action cleanup item.
Whenever a proof stage moves, the foreman should update the owning status text
in this ordered queue, the audit, the operating spec, and the architecture map
before treating that stage as settled. If a stage only gets read-only evidence,
record that as read-only evidence and keep the next mutation boundary explicit.
For this queue, "operator approval" means external or workflow-advancing
mutation: Linear/Jules/GitHub actions, PR branch updates, deployment waivers,
local master sync, or user-visible task decisions. It does not block ordinary
local Symphony implementation hygiene such as docs edits, verifier updates,
dashboard/API code edits, local verifier runs, or local checkpoint commits that
do not push, launch, merge, sync, contact external systems, or claim that a live
boundary has advanced. The canonical approval-boundary table is
`../JULES_MIDDLEMAN_OPERATING_SPEC.md#approval-boundaries`; this queue should
point there instead of maintaining a second approval list.
The canonical workflow-phase table is
`../JULES_MIDDLEMAN_OPERATING_SPEC.md#workflow-phases`; this queue should record
current proof against those phases instead of maintaining a second phase ladder.
ARA-6 is now historical proof for the workflow rather than the current live
contract target. For the current spell Phase 1 flow, the operator has allowed
assumed approvals at each phase boundary. Every assumed approval must still be
reported with the decision point, options, decision made by the agent,
rationale/evidence, mutation performed or skipped, and next expected proof.

## Historical ARA-6 Proof Thread

- Payload: ARA-6, "Add regression coverage for non-proficient weapon attack penalties"
- Linear: `https://linear.app/aralia/issue/ARA-6/add-regression-coverage-for-non-proficient-weapon-attack-penalties`
- Jules session: `https://jules.google.com/session/4101281510355198885`
- Handoff id: `handoff-1779226708033-v4ohk7`
- GitHub PR: `https://github.com/Gambitnl/Aralia/pull/931`
- Coordinator lockfile repair PR: `https://github.com/Gambitnl/Aralia/pull/932`
- Historical PR movement: under the ARA-6 assumed-approval test-flow rule,
  Codex pushed two `github_pr` boundary repairs to PR #931. First,
  `19eb1cd4` applied the prepared lockfile setup repair; that moved Build,
  Tests, Quality Scan, and CodeQL-family checks green but exposed Lint and
  Poison File Check as the remaining blockers. Second, `f755df2b` removed the
  forbidden `package-lock.json` PR diff, kept the final diff to
  `.github/workflows/ci.yml`, the task note, and the two regression-test files,
  fixed the PR test lint errors, and pushed the branch again at
  `2026-05-20T15:39:26Z`. That rerun passed Poison File Check but Build, Lint,
  Tests, and Quality Scan still failed at `npm ci`, proving the remaining
  blocker is the coordinator-owned base lockfile mismatch rather than another
  ordinary PR-file repair. Jules then pushed bot commit `bb44a2f7`, which
  superseded the PR-local CI workflow edit and leaves the live PR diff to the
  task note plus the two regression-test files. The durable decision report is
  `../decision-reports/ARA-6_ASSUMED_APPROVAL_DECISIONS.md`. Codex later used
  that historical assumed-approval rule to open the separate coordinator/dependency
  repair PR #932 from branch `codex/dependabot-aralia-lockfile-sync`; that PR
  contained only commit `f19cc779` and only changed `package-lock.json` so the
  base branch could satisfy npm 10.8.2 `npm ci` without putting a forbidden
  lockfile diff back into PR #931. PR #932 was merged as `ca10728f`; PR #931 was
  then updated to head `91ceee43`, all GitHub checks passed, and PR #931 was
  merged as `1c4316c`.
- Latest known workflow finding: local Jules/Symphony status initially reported
  `COMPLETED` with no PR URL while Jules API, browser-visible state, and GitHub
  exposed additional facts. Current browser evidence shows `Plan approved`,
  `All plan steps completed`, `View PR`, and failed check summaries; Jules API
  and GitHub expose PR #931. Symphony now reconciles that missing local PR URL
  from the Jules API session output, records PR #931, and derives
  `julesStateReconciliation` so the dashboard explains whether external evidence
  settled the mismatch or browser/API proof is still required. Scout/Core,
  repair/feedback, deployment, merge, local sync, and full ROI proof remain open.
  The first Delegation ROI ledger is now implemented on the handoff snapshot and
  dashboard. It can now record task-scoped Codex foreman usage receipts in
  addition to Symphony runtime `codex_totals`, and it now keeps broad
  `codex_goal_context` receipts in a separate context bucket so long-thread
  usage cannot count as task-level savings proof. ARA-6 correctly remains
  `ROI unknown` until a real ARA-6 foreman-usage receipt and documented
  avoided-work estimate are attached. A local isolated worktree at
  `F:\Repos\Aralia\.worktrees\pr-931-setup-repair` now contains local commit
  `19eb1cd4` with a `package-lock.json` setup repair for PR #931; npm 10.8.2 can
  install and the two task-specific Vitest files pass there. That repair was
  pushed under the ARA-6 assumed-approval rule, then superseded by
  `f755df2b` after the poison gate proved feature PRs cannot carry
  `package-lock.json`. Symphony now also has a non-mutating
  `repairPushReadiness` packet and dashboard panel for this exact boundary: it
  can show the prepared branch, commit, repair base, current PR head, changed
  file list, verification, and push command while still marking the push as
  external mutation under the approval rules that existed during that proof
  thread. Historical read-only GitHub inspection then showed PR #931 head
  `bb44a2f7`, open, not draft, and mergeable.
  It also carries `postPushFollowUp`, which makes the after-push sequence
  explicit: wait for GitHub checks, refresh Symphony's PR packet, then update
  Scout/Core readiness. Symphony now also has a local `repairPushResult`
  receipt contract and dashboard `Record Repair Push Result` control for the
  moment after an approved push happens. The live pushes and the coordinator
  repair PR, PR #932 merge, PR #931 branch update, PR #931 merge, and deployment
  evidence receipt happened under the ARA-6 assumed-approval rule. Scout
  conflict detection, CodeQL, and GitHub Pages deployment passed for merge
  commit `1c4316c`; local sync then merged `origin/master` into
  `feature/ollama-model-router` as local commit `28ff49a6`, preserving the
  Symphony docs/verifier updates while bringing in the ARA-6 lockfile, task-doc,
  and regression-test changes. Local `master` was also fast-forwarded to match
  `origin/master` at `1c4316c`. None of these ARA-6 approvals are live contract
  gates for Spell Phase 1; they remain historical examples only.
- Latest browser/tooling finding: the direct Playwright MCP browser tool can
  fail with `Transport closed` in this Codex app session, but the Browser
  plugin's intended in-app browser bridge still works. It listed the current
  Jules tab, read the visible Jules page, and captured a screenshot without
  opening external Chrome. Current visible Jules state shows `Ready for review`,
  a `View PR` control, changed-file review entries, `Time: 51 mins`, and
  `Check Suite Failure` with four failed checks. Treat this as proof that
  live follow-along should use the Browser plugin/in-app browser bridge first;
  terminal Playwright remains acceptable for repeatable local dashboard
  verification, but not as the operator-visible Jules follow-along surface.
  The dashboard and `/proof` now expose read-only
  `/api/v1/browser-tooling-health`; `verify-browser-tooling-health.mjs` proves
  that packet records the primary bridge, the known direct-Playwright failure
  mode, allowed/disallowed uses, observed ARA-6 evidence, next expected proof,
  and false mutation flags.

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
7. For live follow-along, use the Codex Browser plugin's in-app browser bridge
   before falling back to terminal Playwright. A `Transport closed` response from
   the direct Playwright MCP tool is not enough to conclude Jules cannot be
   observed; first try the Browser plugin path against the already-open Jules
   tab.
8. Do not gitignore contract verifiers. Files such as
   `conductor/symphony/scripts/verify-*.mjs` are durable source when they protect
   the Symphony workflow, dashboard rendering, or API packet contracts. Runtime
   state such as `conductor/symphony/.symphony/*`, live proof captures, visual
   verification images, and Jules run output should stay ignored unless a proof
   artifact is deliberately selected for documentation.
   `verify-gitignore-contract-boundary.mjs` is now part of
   `verify:jules-contract` and checks both sides of this boundary.

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
Official Jules REST API documentation also matters for Symphony: it currently
describes the API as alpha, uses `X-Goog-Api-Key` authentication, describes
sessions as the continuous unit of work, activities as per-session agent/user
events, `GetSession`/`ListSessions` as polling surfaces, exposes `approvePlan`
and `sendMessage` as explicit session actions, and uses session outputs as the
place where an automatically created PR can appear. That matches the ARA-6
lesson: use Jules API output first when available, then browser-visible proof,
then GitHub fallback lookup before claiming the PR is missing.

Original broad setup script attempted for Spell Phase 1:

```bash
npm ci --no-audit --no-fund
npm run typecheck
npm run validate:spells
```

Result: the broad script failed during `npm run typecheck` in a clean Jules
clone because repo-wide typecheck currently depends on local untracked/generated
TypeScript modules that are present in this workspace but absent from a tracked
clone. Local `npm run typecheck -- --pretty false` passed afterward, so this was
classified as pre-existing tracked-clone typecheck debt, not an npm install
failure.

Accepted Package 2 scoped setup script:

```bash
npm ci --no-audit --no-fund
npm run validate:spells
npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose
```

Result: the scoped setup passed in Jules. `npm ci` completed, `npm run
validate:spells` completed with 0 invalid spell files by level, and the split
combat utility test glob passed 6 files and 37 tests before Jules exported
environment state. Do not add secrets. Later broad schema/runtime/UI slices must
not inherit this typecheck waiver automatically.

## Ordered Work Queue

| Order | Task | Status | Next action | Needs operator? |
|---:|---|---|---|---|
| 1 | ARA-6 Jules status reconciliation | Implemented for API PR output | Jules API session-output reconciliation now fills in PR #931 when stored local state has no PR URL. Browser fallback remains a future guard for cases where API evidence is missing or contradicted. | No for read-only inspection; yes for PR/commit/approval/chat actions. |
| 2 | ARA-6 PR detection and GitHub watch | PR refreshed through Symphony | Symphony recorded PR #931 from Jules API output, branch `add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885`, and failing check state in `ara6-pr-refresh-summary-2026-05-20.json`. | No for read-only refresh; yes for feedback comments or merge. |
| 3 | PR checks and feedback path | ARA-6 live repair path completed; pattern ready for next spell PR | Symphony classified the ARA-6 failures as `workflow_setup`, recorded the assumed-approval repair decisions, used a coordinator lockfile repair PR (#932), then let PR #931 rerun green and merge. The durable decision record remains `../decision-reports/ARA-6_ASSUMED_APPROVAL_DECISIONS.md`. The next use of this machinery should happen on the first spell Phase 1 PR, where failures must again be classified as code, data, setup, or decision-boundary issues before feedback or repair. | For spell Phase 1, the operator has allowed scoped branch pushes, PR opens, and PR merges under assumed approval, but each decision must be recorded in `../decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`. |
| 4 | Scout/Core readiness | Local packet now distinguishes post-push check-rerun wait | Classify changed-file risk, Scout conflict signals, external review comments, and Core readiness after the setup/check blockers are resolved. `verify-scout-core-readiness-packet.mjs` now also proves a handoff with a recorded `repairPushResult` enters `waiting_for_checks_rerun`, keeps Core validation/merge disabled, and points the foreman at the GitHub checks command plus the Symphony PR refresh endpoint before Scout/Core readiness can advance. | Yes before Core merge/validation mutation. |
| 5 | GitHub Pages deployment gate | Local packet, direct read endpoint, receipt, and ARA-6 live proof completed | ARA-6 produced live GitHub Pages deployment proof after PR #931 merged. Keep using `deployment_readiness` and `deploymentEvidence` as the guarded proof path for the first spell Phase 1 PR before local sync or completion claims. | For spell Phase 1, assumed approval may cover the scoped merge path, but deployment waivers or repairs still need an explicit decision report entry. |
| 6 | Local sync readiness | ARA-6 local sync completed; post-sync verifier passed after Git safe-directory fix | ARA-6 local sync completed as merge commit `28ff49a6`, with local `master` matching `origin/master` at `1c4316c`. On 2026-05-21, `cmd.exe /c npm run verify:jules-contract` passed after `F:/Repos/Aralia` was marked as a narrow Git safe directory for the current process user. Use the same local-sync readiness/execution receipt pattern after the first spell Phase 1 PR. | For spell Phase 1, scoped local sync is inside the assumed-approval test flow only when recorded with readiness, execution, and post-sync verifier evidence. |
| 7 | Symphony task-centered dashboard | Baseline timeline, navigator, filters, detail preview, task page, single-task read API, Jules prompt/dialogue packets, local task filing, local task messages, structured task clarifications, and task-page local action receipts implemented; richer external actions still open | Handoff snapshots now derive a read-only `handoffTimeline`, the dashboard renders it as `Task timeline`, and `verify-handoff-timeline.mjs` proves the ARA-6-style event order through task creation, Linear, manifest, Jules launch, plan approval, operator message, Jules refresh, GitHub PR refresh, task-nudge wake-up evidence, repair decision, operator answer, repair-lane execution, repair push readiness, repair push result, ROI ledger, deployment evidence, and later local sync events without mutation. Task-nudge events are derived from the same durable nudge ledger, so the ARA-6 `refresh / github_pr` nudge and its 300-second next-check cadence now appear in the task chronology instead of only in the global scheduler proof. The dashboard now also renders a read-only `Task navigator`; `verify-task-dashboard-navigator.mjs` proves it counts all tasks, tasks needing human input, open tasks, completed tasks, and archived tasks, filters by those buckets as a browser display preference, links to the existing draft/handoff card instead of owning separate state, and renders a compact `Task detail` preview for the first visible task. `verify-task-detail-api.mjs` now proves `GET /api/v1/tasks/:id` returns a non-mutating detail packet for one draft or handoff, including current boundary, timeline, attached links, operator-question state, local `clarificationState`, ROI/readiness records when present, read-only Jules handoff prompt, read-only Jules dialogue/approval history, stored `taskMessages`, stored `taskClarifications`, local `taskDisposition`, the local `operatorAnswer` endpoint link, PR check summary, PR next action, PR check/view commands, PR state/head fields, and explicit mutation flags. `verify-task-detail-page.mjs` proves `/tasks/:id` renders a standalone task workspace from that same packet with current boundary, safety flags, task links, local messages, `Task Clarifications`, `Record Clarification`, local `Task Filing`, local-only `Record Operator Answer`, local-only `Record Repair Push Result` when repair-push readiness exists, timeline, readable `PR Checks And Repair`, readable `ROI Evidence`, readable `Deployment And Local Sync`, scope, verification, `Jules Handoff Prompt`, `Jules Dialogue And Approvals`, and expandable readiness packets. Rendered proof `task-page-2026-05-20.png` captured the live ARA-6 handoff task page on dashboard-safe port 8126, `task-page-prompt-dialogue-2026-05-20.png` captured the updated prompt/dialogue sections on dashboard-safe port 8127, `task-page-filing-2026-05-20.png` captured the local filing controls on dashboard-safe port 8128, and `task-page-operator-answer-2026-05-20.png` captured the local-only operator-answer form on dashboard-safe port 8131. `verify-task-message-api.mjs` proves `POST /api/v1/tasks/:id/messages` records local operator/Codex task notes with all mutation flags false and rejects empty messages. `verify-task-clarification-api.mjs` proves `POST /api/v1/tasks/:id/clarifications` records a structured Codex-foreman question plus optional operator answer with all mutation flags false, and that unanswered clarifications make the task detail report `needsHumanInput: true`; `verify-task-detail-page.mjs` proves the same local clarification path is visible on `/tasks/:id` without sending Jules feedback, creating Linear work, pushing to GitHub, or mutating Git. `verify-task-disposition-api.mjs` proves `POST /api/v1/tasks/:id/disposition` can mark work active, completed, archived, or abandoned as local dashboard state with all mutation flags false. The preview exposes `Task page`, `Task detail JSON`, `Task messages`, and `Record Task Message` without sending Jules feedback. Still open: optional terminal-simulator live mirror and true external task actions such as actually sending Jules feedback, commenting on GitHub, pushing, rerunning checks, merging, deployment repair, and local sync after their explicit gates. The structured task event log remains canonical; terminal scrollback is only a view. | No for implementation if scoped; yes for UX choices that change operator workflow. |
| 8 | Jules visual/session reconciliation in Symphony | Baseline reconciliation and browser-health packets implemented | Handoff snapshots now derive `julesStateReconciliation`, the dashboard renders `Jules state reconciliation`, and `verify-jules-state-reconciliation-packet.mjs` proves two key ARA-6 patterns: external Jules API/GitHub PR evidence becomes `reconciled_from_external_evidence`, while `COMPLETED` with no PR remains `needs_browser_reconciliation` instead of a false completion claim. `GET /api/v1/browser-tooling-health` now gives future foremen a read-only packet for the follow-along tool path: use the Codex Browser plugin bridge first, treat direct Playwright `Transport closed` as a known unreliable path, keep live observation operator-visible, and record observed evidence into task/handoff packets before advancing. Still open: live browser-proof capture for future visible Jules actions that API/local state miss. | No for local implementation; yes before automating external actions. |
| 9 | Jules environment setup script | Package 2 scoped snapshot proof captured | `GET /api/v1/jules-environment-setup` now returns `package2_scoped_snapshot_passed`. The broad `npm run typecheck` setup failed in a clean tracked clone, but the accepted Package 2 script passed `npm ci --no-audit --no-fund`, `npm run validate:spells`, and `npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose`. The decision report records the typecheck gate replacement; `../../../docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK.md` and `../../../docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md` preserve the operator steps, failed attempts, evidence screenshots, and Package 2 dispatch clearance. | No for submitting the local Symphony task draft; external Jules/GitHub follow-through must still be recorded in `../decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`. |
| 10 | Open task/docs consolidation | Active handoff into spell Phase 1 Package 2 | Keep this file, the audit, architecture overview, spec, README, and per-task files in sync as implementation/proof stages advance. The active spell plan is `../../../docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`; the Package 1 baseline is `../../../docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`; the Phase 1 decision report is `../decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`. Package 2 local Symphony draft `draft-1779344522441-vdy0hi` exists; the setup branch `codex/spell-phase1-symphony-package2-setup` is now pushed to origin at `6fc9e81a`, and `../../../docs/tasks/spells/PACKAGE_2_GIT_SYNC_ATTEMPT_RECEIPT.md` records both the rejected tool-boundary attempt and the successful remote sync. The next live proof is a refreshed Symphony task queue or Git preflight result before Jules dispatch. | No for local docs/status updates. |
| 11 | Delegation ROI ledger | Baseline implemented; next live measured proof should be spell Phase 1 | Handoff snapshots generate `delegationRoiLedger`, task-scoped foreman usage can be recorded locally, broad goal-context usage is kept separate, and incomplete evidence stays `ROI unknown`. ARA-6 remains useful workflow evidence, but the next meaningful ROI proof should be captured on the first bounded spell Phase 1 Jules slice with actual foreman usage and a documented avoided-work estimate. | No for local receipt capture; yes before claiming real savings. |
| 12 | Quiet-hour and human-blocker behavior | Baseline operator-question, answer receipts, and local quiet-hour preferences implemented | Handoff snapshots now derive a read-only `operatorQuestion` when a repair decision needs the operator or when prepared repair-push readiness needs explicit approval, the dashboard shows `Needs your input` with a `pending-human-input` badge, and `verify-operator-question-packet.mjs` proves the default weekday 01:00-09:00 Europe/Amsterdam quiet hours suppress immediate notification and schedule the next check at 09:00 local time. `verify-operator-preferences.mjs` now proves `operatorPreferences.quietHours` can locally override the time zone, start/end hours, weekday-only behavior, and enabled/disabled state, and that the dashboard renders `Operator Preferences` plus `Record Operator Preferences` without contacting Jules, GitHub, Linear, local files, or Git. The same question verifier proves `repair_push_approval` uses approve/reject/wait choices, hides repair-lane execution, and takes precedence over the older repair-lane question after a repair commit exists. Rendered local fixture `repair-push-approval-question-2026-05-20.png` captures the push-approval question layout without contacting external systems. `verify-operator-answer-recording.mjs` now proves both repair-lane choices and `approve_repair_push` can be recorded as local-only `operatorAnswers` without sending Jules feedback, creating Linear tasks, mutating GitHub, or touching local Git; after `approve_repair_push`, it also proves routing advances to an `operator_only` `Record repair push result` boundary instead of re-asking the approval question. `verify-handoff-timeline.mjs` now labels the later push approval answer separately from the earlier repair-lane answer. Still open: full task-scoped chat and execution of external repair lanes after explicit approval. | Maybe, for changing quiet-hour preferences or answering/executing a live blocker. |
| 13 | Dispatch/real worker proof | Deferred; spell Phase 1 uses sequential Jules, not parallel local workers | Do not start parallel local worker dispatch for the spell project. The next proof should show one Jules implementation slice at a time, with Codex as foreman and model routing recorded for efficient chores versus stronger decision work. | Yes before enabling real local dispatch; not needed for sequential Jules use. |

Task 3 current-state override: the coordinator/dependency repair path has now
been completed under the ARA-6 assumed-approval rule. PR #932
(`https://github.com/Gambitnl/Aralia/pull/932`) merged as `ca10728f`, PR #931
updated to `91ceee43`, all GitHub checks passed, and PR #931 merged as
`1c4316c`. GitHub Pages deployment run
`https://github.com/Gambitnl/Aralia/actions/runs/26175016417` passed and was
recorded as local Symphony deployment evidence. The next boundary is local sync,
not additional PR repair. Local sync has now completed as merge commit
`28ff49a6`, with local `master` matching `origin/master` at `1c4316c`; the
remaining proof is post-sync verification on the local checkout.

Task 7 clarification addendum: the standalone task page now renders structured
`Task Clarifications` with a `Record Clarification` form. `verify-task-detail-page.mjs`
protects the visible form and local clarification URL, while
`verify-task-clarification-api.mjs` protects the non-mutating API receipt and
derived `clarificationState`. This updates the older table wording that still
listed clarification controls as open; the remaining open work is proving this
path on a future dashboard-started task and adding any richer UX around it.

Task 7 addendum: the standalone task detail packet now includes `guardedActions`,
and `/tasks/:id` renders them as `Guarded Operator Actions`. This is a runbook
surface for the current Symphony endpoint, operator-run Jules PR feedback
command, prepared repair push command, and future local-sync command. It shows
mutation flags and command text, but it does not run those actions. Rendered
proof `task-page-guarded-actions-2026-05-20.png` and its Markdown receipt show
the then-live ARA-6 task page rendering the guarded PR refresh endpoint and Jules PR
feedback command on a dashboard-only server with dispatch paused. The live
handoff JSON captured in `task-page-guarded-actions-live-json-2026-05-20.json`
also records that `repairPushReadiness` is not currently present on that live
handoff, so the prepared repair-push guarded action remains fixture-proven until
a live readiness receipt is recorded. Follow-up proof
`repair-push-readiness-live-recorded-2026-05-20.json`,
`task-page-guarded-actions-live-json-after-readiness-2026-05-20.json`, and
`task-page-guarded-actions-after-readiness-2026-05-20.png` closes that live
visibility gap: the ARA-6 handoff now has local `repairPushReadiness`,
freshness status `matches_current_pr_head`, the local-only `Record Repair Push
Result` link, and corrected quiet-hours next check `2026-05-20T07:00:00.000Z`.
Follow-up rendered proof `task-page-worktree-qualified-push-2026-05-20.png`
and text receipt `task-page-worktree-qualified-push-2026-05-20.md` verify that
the dashboard displays the worktree-qualified push command so the operator does
not accidentally run the push from the wrong checkout. The exact operator-owned
command now waiting for approval is:

```powershell
git -C F:\Repos\Aralia\.worktrees\pr-931-setup-repair push origin codex/pr-931-setup-repair:add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885
```

No push, check rerun, Jules message, Linear mutation, merge, or local Git sync
was performed by Symphony.

Task 7 addendum: `GET /api/v1/tasks/:id` now also carries an
`approvalCheckpoint` packet, and `/tasks/:id` renders it as `Approval
Checkpoint`. This local, read-only summary keeps the current operator question,
latest local answer when present, the still-external guarded command, mutation
flags, and next expected proof in one place. `verify-task-detail-api.mjs` and
`verify-task-detail-page.mjs` protect that the checkpoint records local proof
only, identifies the repair push as an external operator-run mutation, and does
not approve plans, send Jules feedback, comment on GitHub, push branches, rerun
checks, merge, pull, or edit local files. Rendered proof
`symphony-task-approval-checkpoint.png` captured the then-live ARA-6 task page on
dashboard-safe port 8136 with `Approval Checkpoint`, `External mutation if run`,
and `Records local proof only` visible and no browser console errors.

Task 3/7 addendum: the task detail API now preserves PR failed check
names/details links alongside the aggregate PR check summary, and `/tasks/:id`
renders them inside `PR Checks And Repair`. The ARA-6 page can therefore show
individual failed checks such as Build, Lint, Tests, and Quality Scan from the
first-class `failedChecks` packet or from older blocker evidence, without
refreshing GitHub or running a push/check mutation.

## Dashboard Improvements Identified By ARA-6

These are implementation targets, not proof claims:

1. Baseline implemented: add fallback PR discovery and reconciliation display
   when Jules/Symphony stores `COMPLETED` with
   `pullRequestUrl: null`: prefer Jules API `GetSession`/activities when a key
   is available, fall back to browser inspection when API evidence is missing or
   suspect, then search GitHub by session id, generated branch name, handoff
   title, and Linear issue before showing "no PR". The derived
   `julesStateReconciliation` packet now shows whether external evidence
   reconciled the missing PR or whether browser/API proof is still required.
2. Baseline implemented: add a task detail timeline that keeps Linear creation,
   manifest staging, Jules launch, plan approval, operator notes, Jules refresh,
   PR refresh, repair decisions, ROI ledger generation, and future merge or
   deployment events in chronological order. `verify-handoff-timeline.mjs` now
   guards the current read-only `handoffTimeline` packet and dashboard rendering.
   The home dashboard now also has a read-only `Task navigator`; it counts and
   filters all/open/completed/archived records plus tasks needing human input,
   shows a compact read-only `Task detail` preview for the first visible task,
   links to the existing draft or handoff card, links to `/tasks/:id`, and links
   to `Task detail JSON` from `GET /api/v1/tasks/:id`.
   `verify-task-dashboard-navigator.mjs`, `verify-task-detail-api.mjs`, and
   `verify-task-detail-page.mjs` guard this baseline, including the read-only
   Jules prompt/dialogue sections, local task filing, and the task-page
   local-only approval checkpoint, operator-answer, and repair-push-result
   receipt forms. The view-only task activity mirror now reads those structured
   records, and true external actions remain open.
3. Add a check-blocker classification layer so setup/workflow failures such as
   lockfile mismatch or stale Gemini model config are not presented as failed
   Jules implementation logic. Local verifier coverage exists for the ARA-6
   build/lint/test/quality setup pattern, and the live PR #931 Symphony refresh
   now records the actual `workflow_setup` blocker packet.
4. Add a task-scoped operator question panel for decisions such as whether to
   fix the lockfile locally, send Jules feedback, or adjust the workflow config.
   The first repair-decision packet now exists for PR #931 and asks whether to
   create a setup repair task, send Jules feedback, wait for manual repair, or
   refresh after repair. Baseline implemented: `operatorQuestion` now turns that
   repair packet into one plain-language `Needs your input` panel and applies
   weekday quiet-hour guidance without mutating external systems. The local
   `operator-answer` path records the chosen repair lane as durable local
   evidence before any external action runs, and the standalone task page now
   exposes that receipt path where the operator is already reading the task.
   Baseline execution now supports
   `create_setup_repair_task` by creating a local setup-repair draft only, and
   routing now focuses that draft as local-careful Codex work.
5. Keep the main dashboard focused on the current boundary and move full packet
   detail into expandable task sections or `/proof`, so the operator is not
   forced to scan every low-level safety packet during a live task.
6. Continue the Delegation ROI ledger: the baseline panel and local
   task-scoped foreman-usage receipt path exist, but the next stage must record
   real measured Spell Phase 1 usage and documented avoided-work estimates before
   any task can claim Jules saved Codex usage. The task page now has a readable
   `ROI Evidence` card that surfaces those missing proof pieces and keeps broad
   goal-context usage separate from task-scoped spend. Rendered proof
   `symphony-task-roi-evidence.png` captures the then-live ARA-6 task page with the
   missing-savings-proof warning visible and no browser console errors.
7. Add an optional terminal-simulator panel for live Codex foreman visibility,
   backed by a real process/PTY only when useful. Store the durable task chat,
   questions, answers, blockers, and decisions as structured task events rather
   than relying on terminal scrollback.
8. Baseline implemented: add a browser-tooling health note so future foremen
   can tell the difference between direct Playwright MCP transport failure and
   the working Codex Browser plugin in-app bridge. The main dashboard now shows
   `Browser Follow-along` inside the Jules Lifecycle group, and `/proof` shows
   the same compact card. This is guidance, not browser automation; actual task
   evidence still belongs in Jules/API/GitHub/handoff packets.

## Objective Completion Audit

This section audits the completed mapping/documentation slice. It is preserved
because it explains how ARA-6 informed the current full workflow goal; it is not
a claim that the full Symphony delegation workflow is implemented.

| Requirement | Evidence | Status |
|---|---|---|
| Observe ARA-6 without disrupting Jules | Read-only GitHub CLI refresh on 2026-05-20 showed PR #931 was open, not draft, mergeable, and unchanged at head `0c0d948010b3b72d05deb4f2f37ed9c462990593` with latest PR update `2026-05-19T23:09:48Z`. No Jules chat, feedback, environment snapshot, CI rerun, merge, or local sync was performed during this documentation pass. | Achieved for that historical observation slice |
| Record timing and stage transitions | Timing log records Symphony/Jules launch, visible plan approval mismatch, PR creation at `2026-05-19 22:55 UTC`, check failure window, `2026-05-20 01:05 Europe/Amsterdam` PR refresh, and Jules Environment setup inspection. | Achieved, continue appending future observations |
| Record safe interaction rules | `Interaction Rules While Jules Works` defines read-only preference, chat restraint, separate-signal treatment, non-tight polling cadence, mutation-boundary confirmation, and runtime-artifact handling. | Achieved |
| Inspect Jules environment configuration opportunities | `Jules Environment Setup Finding` records the Environment page controls, the public docs' snapshot behavior, and the safe setup-script recommendation split between post-lockfile `npm ci` and diagnostic `npm install`. | Achieved; no setup mutation performed |
| Reproduce browser follow-along tooling state | Direct Playwright MCP returned `Transport closed`; the Browser plugin in-app bridge successfully listed the Jules tab, read visible text, and captured a screenshot of the same signed-in Jules session. The dashboard and proof board now render `Browser Follow-along` guidance that points foremen at the Browser plugin bridge before declaring visual observation blocked. | Achieved for current tooling diagnosis; keep using the Browser plugin path for live follow-along |
| Consolidate stale Symphony task/docs into ordered checklist | `Ordered Work Queue` sequences the remaining work, `Superseded Per-Task Status` marks Task 02, Task 03, and Task 04 against ARA-6 evidence, and `verify-task-doc-consolidation.mjs` guards the per-task files against drifting back to stale pre-ARA-6 boundaries. | Achieved for documentation; files must be committed to make it durable |
| Identify dashboard improvements for future Codex foremen | `Dashboard Improvements Identified By ARA-6` lists fallback PR discovery, task timeline, check-blocker classification, task-scoped operator questions, and current-boundary dashboard focus. The task timeline item now has baseline implementation and local verifier coverage. | Achieved as an implementation target list; timeline baseline implemented |
| Prove the full Symphony implementation is complete | Audit/spec still show open implementation proof for browser fallback, Scout/Core readiness, repair/feedback sequencing, deployment, local sync, live task chat usage, ROI, and real worker dispatch. Quiet-hour preference editing, role-aware local task messages, and the view-only task activity mirror now have local verifier coverage. | Not achieved; keep the broader Symphony goal active |

## Current Full-Workflow Completion Audit

| Requirement | Current evidence | Status |
|---|---|---|
| Codex clarifies tasks and acts as foreman through Symphony | Foreman prompt/routing contracts exist, local task messages exist, `verify-task-clarification-api.mjs` proves structured local clarification questions and optional operator answers can be recorded on a draft or handoff with `clarificationState` and no external mutation, and `verify-task-detail-page.mjs` proves `/tasks/:id` renders `Task Clarifications`, `Record Clarification`, the existing question text, and the local clarification URL. ARA-6 still used a partially manual flow, so the next proof is exercising that clarification loop on a future dashboard-started task rather than only fixture/live page rendering. | Partially achieved |
| Linear tracking | ARA-6 created Linear issue `ARA-6` through Symphony after clean Git proof. | Achieved for ARA-6 |
| Jules staging and launch | ARA-6 staged `handoff-1779226708033-v4ohk7` and launched Jules session `4101281510355198885`. | Achieved for ARA-6 |
| Jules planning/execution/PR creation follow-through | Browser inspection and Jules API/GitHub evidence showed more state than the local `pullRequestUrl: null` record. Symphony now reconciles the missing PR URL from Jules API session output for PR #931 and derives a `julesStateReconciliation` packet so the dashboard records whether the mismatch was settled by external evidence or still needs browser proof. | Partially achieved |
| GitHub checks and repair/feedback sequencing | PR #931 is now refreshed through Symphony, classified as a `workflow_setup` blocker with next action `Resolve CI Setup Blocker`, and carries a read-only repair decision packet. Local isolated setup repair commit `19eb1cd4` has been prepared and verified against npm 10.8.2 plus the two task-specific Vitest files. `verify-repair-push-readiness-packet.mjs` proves Symphony can preserve that as a non-mutating push-readiness receipt with repair-base/current-PR-head freshness and `postPushFollowUp`; current PR head `0c0d9480` matches the repair base. `verify-repair-push-result-receipt.mjs` proves the next local receipt after an operator-owned push can record pushed commit, PR head, evidence URL, check command, refresh endpoint, and `github_checks_rerun` boundary without mutation, and the dashboard now has the `Record Repair Push Result` control to capture that receipt. `verify-scout-core-readiness-packet.mjs` now proves that receipt drives a `waiting_for_checks_rerun` Scout/Core state instead of allowing Core validation before the rerun evidence is refreshed. The repair has not been pushed or refreshed through GitHub, so that receipt is only locally contracted. | Partially achieved |
| Task-centered dashboard timeline and navigator | Handoff snapshots now carry a read-only `handoffTimeline`, the dashboard renders a `Task timeline` on handoff cards, and `verify-handoff-timeline.mjs` proves the ARA-6-style chronological event chain through repair answer, task-nudge wake-up evidence, repair execution, push-readiness/result, ROI, and deployment evidence without Jules/GitHub/Linear/local mutation. The dashboard also renders a read-only `Task navigator`; `verify-task-dashboard-navigator.mjs` proves all/open/completed/archived counts, pending-human-input visibility, display-only bucket filters, links to existing draft/handoff cards, a compact read-only `Task detail` preview for the first visible task, the visible `Task page` link, and the visible `Task detail JSON` link. `verify-task-detail-api.mjs` proves `GET /api/v1/tasks/:id` returns one draft or handoff detail packet without mutation, including Jules prompt/dialogue history, local task disposition, local `clarificationState`, stored `taskClarifications`, the local handoff `operatorAnswer` link when present, and a read-only `approvalCheckpoint` that keeps the current human decision, still-external guarded command, mutation flags, and next proof together; `verify-task-detail-page.mjs` proves `/tasks/:id` renders that packet as a standalone workspace with `Task Clarifications`, `Record Clarification`, `Approval Checkpoint`, `Task Filing`, local-only `Record Operator Answer`, local-only `Record Repair Push Result`, `Jules Handoff Prompt`, and `Jules Dialogue And Approvals`; `verify-task-disposition-api.mjs` proves local active/completed/archived/abandoned filing receipts stay non-mutating; `task-page-2026-05-20.png` captures the live ARA-6 handoff page, `symphony-task-approval-checkpoint.png` captures the live approval checkpoint, and `verify-task-message-api.mjs` plus `verify-task-clarification-api.mjs` prove local task messages and clarification receipts can be recorded without Jules feedback or external/local mutation. | Baseline implemented; live task-chat usage and true external task actions remain open |
| Human-blocker and quiet-hour behavior | Handoff snapshots now carry a read-only `operatorQuestion` when the PR repair decision needs the operator, the dashboard renders a `Needs your input` panel plus pending-human-input badge, `verify-operator-question-packet.mjs` proves the default weekday 01:00-09:00 Europe/Amsterdam quiet-hour behavior, `verify-operator-preferences.mjs` proves local `operatorPreferences.quietHours` can override or disable that waiting policy without external/local mutation, `verify-operator-answer-recording.mjs` proves local-only `operatorAnswers` can store the chosen repair lane, `verify-repair-lane-local-draft.mjs` proves `create_setup_repair_task` can create a local draft, and `verify-setup-repair-draft-routing.mjs` proves that draft becomes the local-careful routing focus. | Baseline implemented; live task-chat usage and external repair lanes remain open |
| Deployment state | `verify-deployment-readiness-packet.mjs` now proves the local read-only deployment gate exists between merged PR and local sync, including GitHub Pages/deployment inspection commands, direct `GET /api/v1/jules-handoffs/:id/deployment-readiness` access, task-detail `links.deploymentReadiness`, and `/proof` visibility. `verify-deployment-evidence-receipt.mjs` proves deployment success/failure/waiver can be recorded locally without mutating GitHub or local files. No merged PR or live GitHub Pages deployment proof exists for ARA-6. | Local packet, direct read endpoint, and receipt implemented; live proof not achieved |
| Merge readiness and local repo sync after merge | Local sync readiness contracts now require deployment success or waiver before exposing the sync action, and `/tasks/:id` now renders a readable `Deployment And Local Sync` card from the existing readiness packets so the operator can see deployment blockers, local-sync blockers, mutation flags, and expected proof without opening raw JSON. No real merged dashboard-started Jules PR has gone through deployment proof and local sync. | Local contract strengthened; live proof not achieved |
| Delegation ROI ledger | Handoff snapshots now carry a conservative `delegationRoiLedger`, the dashboard renders measured facts separately from avoided-work estimates, `/api/v1/task-drafts` passes Symphony runtime `codex_totals` into the ledger when available, the local `roi-foreman-usage` path records task-scoped Codex foreman tokens/runtime/turns without external/local mutation, broad `codex_goal_context` receipts stay visible as goal-context usage without unlocking task-level savings, the local `roi-estimate` path records documented avoided-work estimates without external/local mutation, and `verify-delegation-roi-ledger.mjs` protects the rule that incomplete evidence stays `ROI unknown`. `/tasks/:id` now renders a readable `ROI Evidence` card from that same packet, including missing task-scoped receipts, missing avoided-work estimate, goal-context tokens, and the rule that goal-context usage is not measured savings; rendered proof `symphony-task-roi-evidence.png` captures the then-live ARA-6 task page. | Local measured-usage and estimate paths implemented; Spell Phase 1 owns the next real usage receipt plus avoided-work estimate |

## Superseded Per-Task Status

The older task files remain useful as handoff prompts, but their status sections
must be read through the ARA-6 evidence:

- `02-linear-creation-proof.md`: superseded by ARA-6 Linear issue creation.
- `03-jules-manifest-staging-proof.md`: superseded by ARA-6 manifest staging.
- `04-jules-launch-readiness-and-launch-proof.md`: superseded through Jules launch,
  PR discovery, baseline Symphony-side reconciliation of the missing local PR URL,
  and check-status classification. Live check repair, Scout/Core, deployment,
  merge, and local sync remain later boundaries.
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
| 2026-05-20 09:13 Europe/Amsterdam | GitHub CLI + Symphony API | Status refresh | PR #931 remains open, not draft, mergeable, and unchanged at head `0c0d948010b3b72d05deb4f2f37ed9c462990593` with latest PR update `2026-05-19T23:09:48Z`; Symphony proof `ara6-pr-refresh-before-repair-push-2026-05-20.json` still reports nine checks total, five passed, four failed, no pending checks, `workflow_setup` as the blocker, and repair-push readiness matching the current PR head. | Next live move is still operator-approved repair push/apply, then GitHub check rerun and Symphony PR refresh. |
| 2026-05-20 09:22 Europe/Amsterdam | Symphony API | Dashboard-started due refresh | `ara6-dashboard-started-due-nudge-record-2026-05-20.json` records a timed `refresh / github_pr` nudge for ARA-6 handoff `handoff-1779226708033-v4ohk7`. `ara6-dashboard-started-due-refresh-rescheduled-2026-05-20.json` proves `/api/v1/task-nudges/refresh-due` refreshed that dashboard-started PR boundary, produced two safe PR refreshes total, had zero failures, kept `mutatesExternalSystems: false`, and rescheduled the ARA-6 nudge to a 300-second waiting cadence instead of leaving it immediately due. | Historical proof pattern only; Spell Phase 1 owns the next live cadence proof. |
| 2026-05-19 23:38 UTC | Symphony API | PR refresh | `ara6-pr-refresh-summary-2026-05-20.json` proves Symphony matched PR #931 from Jules API session output, refreshed nine GitHub checks, classified build/lint/test/quality as `workflow_setup`, and set next action to `Resolve CI Setup Blocker` without external mutation. | Historical proof pattern only; no ARA-6 repair decision remains live. |
| 2026-05-19 23:52 UTC | Symphony API | Repair decision packet | `ara6-pr-repair-decision-refresh-2026-05-20.json` proves the refreshed handoff now includes `githubPullRequestRepairDecision.status: needs_operator_decision`, category `workflow_setup`, and options `create_setup_repair_task`, `send_jules_feedback`, `wait_for_manual_repair`, and `refresh_after_repair`. | Historical proof pattern only; Spell Phase 1 decisions must be recorded in its own decision report. |
| 2026-05-20 | Symphony local contract + API | Delegation ROI baseline | `verify-delegation-roi-ledger.mjs` proves the ARA-6-style ledger reports `ROI unknown`, keeps measured Codex spend separate from estimated avoided work, records Jules PR/scoped-workflow signals, accepts measured `codex_totals`, records a documented avoided-work estimate through the local `roi-estimate` path, and classifies the current stall as `ci_setup`. Live proof `ara6-delegation-roi-ledger-2026-05-20.json` confirms the dashboard-safe `/api/v1/task-drafts` snapshot carries `tokenSource: codex_totals`, `totalTokens: 0`, and the same conservative `ROI unknown` ledger for handoff `handoff-1779226708033-v4ohk7`. | Capture broader task-scoped Codex usage and a real avoided-work estimate before claiming savings. |
| 2026-05-20 | Symphony local contract + API | Task-scoped foreman usage baseline | `verify-delegation-roi-ledger.mjs` now proves handoffs can store `delegationRoiForemanUsage` receipts, aggregate input/output/total tokens, active runtime, foreman turns, receipt count, and `task_scoped_foreman_usage` source evidence, and expose `POST /api/v1/jules-handoffs/:id/roi-foreman-usage` plus the dashboard `Record Foreman Usage` control without touching Jules, GitHub, Linear, local files, or Git. It now also proves `codex_goal_context` receipts aggregate separately as goal-context usage, render on the dashboard, and do not unlock `candidate_savings` without task-scoped spend. The ledger can reach `candidate_savings` only when measured task-scoped spend and a documented avoided-work estimate are both present. | Attach Spell Phase 1 task-scoped usage and an avoided-work estimate before making any savings claim. |
| 2026-05-20 | Symphony local contract | Task timeline baseline | `verify-handoff-timeline.mjs` proves an ARA-6-style handoff produces a non-mutating `handoffTimeline` with chronological task, Linear, Jules, GitHub, task-nudge, repair-decision, operator-answer, repair-lane, repair-push, ROI, deployment-evidence, and future local-sync events, and the dashboard renders `Task timeline` entries. The verifier now includes the ARA-6-style `refresh / github_pr` nudge and its 300-second next-check cadence as a task event derived from the nudge ledger. | Keep adding new workflow receipts to this packet instead of creating a second task history store. |
| 2026-05-20 | Symphony dashboard/API contract | Task navigator/detail baseline | `verify-task-dashboard-navigator.mjs` proves the dashboard renders `Task navigator`, counts all tasks, tasks needing input, open tasks, completed tasks, and archived tasks, filters the navigator by those buckets, links each summary row to the existing draft or handoff card that owns the detailed receipts, shows a compact read-only `Task detail` preview for the first visible task, and exposes `Task page` plus `Task detail JSON` links. `verify-task-detail-api.mjs` proves `GET /api/v1/tasks/:id` returns a non-mutating draft or handoff detail packet with Jules prompt/dialogue history, local task disposition, the local handoff `operatorAnswer` link when present, and `guardedActions` for visible operator-run boundaries. `verify-task-detail-page.mjs` proves `/tasks/:id` renders the same packet as a standalone task workspace with local task-message recording, `Guarded Operator Actions`, local-only `Record Operator Answer`, local-only `Record Repair Push Result`, `Task Filing`, readable `ROI Evidence`, readable `Deployment And Local Sync`, `Jules Handoff Prompt`, and `Jules Dialogue And Approvals`. `verify-task-disposition-api.mjs` proves local active/completed/archived/abandoned filing receipts keep all mutation flags false. Rendered proofs `task-page-2026-05-20.png`, `task-page-prompt-dialogue-2026-05-20.png`, `task-page-filing-2026-05-20.png`, `task-page-guarded-actions-2026-05-20.png`, `task-page-guarded-actions-after-readiness-2026-05-20.png`, and `task-page-worktree-qualified-push-2026-05-20.png` capture `/tasks/handoff-1779226708033-v4ohk7` on dashboard-safe servers with dispatch disabled. The latest guarded-actions JSON receipt records local `repairPushReadiness`, the repair-push guarded action, the repair-push result link, and quiet-hours next check `2026-05-20T07:00:00.000Z` without external mutation; the latest rendered proof verifies the safer `git -C F:\Repos\Aralia\.worktrees\pr-931-setup-repair push origin ...` command display. | Add true external task actions and optional terminal mirror without creating a second task store. |
| 2026-05-20 | Symphony dashboard/API contract | Role-aware task messages | The dashboard task preview and `/tasks/:id` page now let a local task message be recorded as either `operator` or `codex_foreman` while still posting to the same local task-message endpoint. `verify-task-dashboard-navigator.mjs`, `verify-task-detail-page.mjs`, and `verify-task-message-api.mjs` protect the author selector, Codex-foreman option, stored author, and non-mutation flags. | Keep the structured task event log canonical; terminal mirror remains a view-only future layer. |
| 2026-05-20 | Symphony dashboard/API contract | View-only task activity mirror | `/tasks/:id` now renders `Task Activity Mirror`, a terminal-style local trail assembled from the existing timeline events, task messages, and clarifications. `verify-task-detail-page.mjs` protects that it is view-only, does not read terminal scrollback, and does not mutate external systems. | A live local Codex-process mirror remains optional future work; the durable task records stay canonical. |
| 2026-05-20 | Symphony local contract | Jules state reconciliation baseline | `verify-jules-state-reconciliation-packet.mjs` proves an ARA-6-style handoff can show `reconciled_from_external_evidence` when Jules API/GitHub evidence supplies a PR missing from the local record, and `needs_browser_reconciliation` when Jules says `COMPLETED` but no PR is captured. | Prove against future live contradictory Jules states and keep browser/API evidence attached. |
| 2026-05-20 | Symphony local contract | Operator question baseline | `verify-operator-question-packet.mjs` proves an ARA-6-style repair decision produces a non-mutating `operatorQuestion`, suppresses immediate notification during weekday quiet hours, schedules the next check at 09:00 Europe/Amsterdam, and renders `Needs your input` / `pending-human-input` dashboard text. | Add durable operator-answer capture and task-scoped chat. |
| 2026-05-20 | Symphony local contract + dashboard | Operator preference baseline | `verify-operator-preferences.mjs` proves `operatorPreferences.quietHours` defaults to weekday 01:00-09:00 Europe/Amsterdam, can locally override time zone/start/end/weekdays-only settings, can disable quiet hours, feeds those preferences into `operatorQuestion`, and renders `Operator Preferences` / `Record Operator Preferences` on the dashboard. The route and store are local-only and keep Jules, GitHub, Linear, local files, and Git untouched. | Add richer task-scoped chat and live operator preference proof when the dashboard is next run. |
| 2026-05-20 | Symphony local contract | Operator answer baseline | `verify-operator-answer-recording.mjs` proves an ARA-6-style handoff can record `create_setup_repair_task` as a local-only `operatorAnswer`, persist it on the handoff, and expose the dashboard/API strings without contacting Jules, GitHub, Linear, or local Git. | Execute the selected repair lane through a guarded next boundary. |
| 2026-05-20 | Symphony local contract | Setup repair lane baseline | `verify-repair-lane-local-draft.mjs` proves the selected `create_setup_repair_task` lane creates a new local setup-repair draft with package/workflow scope and setup verification commands, while recording a non-mutating `repairLaneExecution` receipt on the source handoff. | Decide whether the new repair draft goes local, Linear, or Jules after review. |
| 2026-05-20 | Symphony local contract | Setup repair routing | `verify-setup-repair-draft-routing.mjs` proves that once the setup repair draft exists, Symphony routes that new draft as the next actionable subject and recommends `local_careful` Codex work before sending more Jules feedback. | Implement or delegate the setup repair through the now-focused repair draft, then refresh PR #931. |
| 2026-05-20 | Isolated PR worktree | Local setup repair committed | Worktree `F:\Repos\Aralia\.worktrees\pr-931-setup-repair` on branch `codex/pr-931-setup-repair` reproduced the GitHub runner failure with `npx -p npm@10.8.2 npm ci --dry-run --no-audit --no-fund`, updated only `package-lock.json` with `npx -p npm@10.8.2 npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, then passed `npx -p npm@10.8.2 npm ci --dry-run --no-audit --no-fund`, `npx -p npm@10.8.2 npm ci --ignore-scripts --no-audit --no-fund`, and `npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts` with 11 tests passing. The local intent gate was mirrored into the ignored worktree `.agent/workflows` folder and refreshed for this task; commit `19eb1cd4 fix(ci): sync lockfile for PR 931 checks` passed the normal pre-commit hook without bypass. | Historical proof pattern only; the live repair path has moved to Spell Phase 1 package receipts. |
| 2026-05-20 | Symphony local contract | Repair push readiness | `verify-repair-push-readiness-packet.mjs` proves an ARA-6-style handoff can record local commit `19eb1cd4`, branch `codex/pr-931-setup-repair`, repair base `0c0d9480`, current PR head `0c0d9480`, changed file `package-lock.json`, local verification commands, PR #931, the canonical `git push origin ...` ref, and the safer worktree-qualified `git -C F:\Repos\Aralia\.worktrees\pr-931-setup-repair push origin ...` command as a `repairPushReadiness` packet. `verify-operator-answer-recording.mjs` and `verify-task-detail-api.mjs` now prove the approval routing detail and task detail API use that same worktree-qualified command. The packet and dashboard panel keep `canPushNow: false`, `mutatesExternalSystemsIfRun: true`, and `mutatesLocalFiles: false`, and the same verifier proves a stale repair base is labeled before push. The packet now also carries `postPushFollowUp` so the after-push sequence is explicit: `operator_pushes_repair`, `github_checks_rerun`, `symphony_refreshes_pr`, then `scout_core_readiness_updates`. | Historical proof pattern only; Spell Phase 1 PR mutations use the Phase 1 assumed-approval report. |
| 2026-05-20 | Symphony local contract | Repair push result receipt | `verify-operator-answer-recording.mjs` now proves that recording `approve_repair_push` advances routing to an `operator_only` `Record repair push result` boundary with dispatch disabled and the exact human-owned push command visible. `verify-repair-push-result-receipt.mjs` proves an ARA-6-style handoff can then record a later operator-owned push as local `repairPushResult`, including status, pushed commit `19eb1cd4`, target PR head, evidence URL, `gh pr checks 931 --repo Gambitnl/Aralia`, PR refresh endpoint, `github_checks_rerun` next boundary, and non-mutation flags. The dashboard now exposes `Record Repair Push Result` fields under repair-push readiness so the operator can record that receipt after the external push. | Historical proof pattern only; the next live receipt should attach to a Spell Phase 1 PR. |
| 2026-05-20 15:27 UTC | GitHub PR #931 | Assumed approval repair push 1 | Under the ARA-6 assumed-approval rule, Codex pushed `19eb1cd4` from `codex/pr-931-setup-repair` to the PR branch. Build, Tests, Quality Scan, and CodeQL-family checks later passed, but Lint and Poison File Check still failed. The poison log named `package-lock.json` as forbidden by the PR policy. | Historical event; no remaining ARA-6 repair action is live. |
| 2026-05-20 15:39 UTC | GitHub PR #931 | Assumed approval repair push 2 | Codex pushed `f755df2b`, which removes `package-lock.json` from the final PR diff, switches CI install steps to `npm install --no-audit --no-fund`, and fixes the PR test lint errors. Local verification passed install, focused lint, focused Vitest, full lint with zero errors, `npx tsc --noEmit`, `npm run build`, `git diff --check`, and a diff-name poison simulation. The PR later continued through coordinator repair and merge. | Historical event; no remaining ARA-6 repair action is live. |
| 2026-05-20 15:42 UTC | GitHub PR #931 | Post-repair check rerun | The fresh rerun passed Poison File Check but Build, Lint, Tests, and Quality Scan still failed in the install step with `Run npm ci` and the same missing React 18 peer lockfile entries. Jules also pushed bot commit `bb44a2f7`, leaving the live PR diff to the task note and two test files while the base lockfile mismatch remained. | Historical event; the coordinator repair path resolved this blocker. |
| 2026-05-20 16:00 UTC | GitHub PR #932 | Coordinator lockfile repair opened | Under the ARA-6 assumed-approval rule, Codex created commit `f19cc779` on `codex/dependabot-aralia-lockfile-sync`, pushed the branch, and opened PR #932 with a one-file `package-lock.json` repair. Local proof: npm 10.8.2 package-lock-only install, npm 10.8.2 `npm ci --dry-run --no-audit --no-fund`, `git diff --check`, and pre-push `npm run sync-check`; the worktree-local hook path issue is recorded in the decision report. | Historical event; PR #932 later merged and unblocked PR #931. |
| 2026-05-20 | Symphony local contract | Post-push check-rerun readiness | `verify-scout-core-readiness-packet.mjs` proves a handoff with a local `repairPushResult` now reports Scout/Core status `waiting_for_checks_rerun`, keeps Core validation and merge disabled, carries the GitHub checks command and PR refresh endpoint as blockers, and stays read-only until GitHub check rerun evidence is refreshed. Rendered proof `scout-core-post-push-rerun-2026-05-20.png` captures the `/proof` board showing the same post-push wait state. | Historical proof pattern only; the next live check-rerun proof should attach to a Spell Phase 1 PR. |
| 2026-05-20 | Symphony local contract + GitHub docs review | Deployment readiness baseline | `verify-deployment-readiness-packet.mjs` proves handoffs now carry a non-mutating `deployment_readiness` packet and expose it through direct `GET /api/v1/jules-handoffs/:id/deployment-readiness` access plus task-detail `links.deploymentReadiness`. For merged dashboard-started PRs it exposes read-only `gh api repos/OWNER/REPO/pages/builds/latest`, recent deployments, and deployment-status commands; for unmerged PRs it waits for merge; for observed PRs it stays read-only learning. GitHub's current REST docs expose Pages build/deployment and deployment-status endpoints for this evidence path. | Prove the packet against a real merged dashboard-started Jules PR, then only proceed to local sync after deployment evidence or explicit operator waiver. |
| 2026-05-20 | Symphony local contract | Deployment evidence receipt | `verify-deployment-evidence-receipt.mjs` proves a merged dashboard-started handoff with safe local-sync facts still cannot sync until deployment proof or waiver is recorded. Posting to the local `deployment-evidence` endpoint stores `deploymentEvidence` with non-mutation flags, changes `deployment_readiness` to `passed` or `waived`, and only then lets `local_sync_readiness.canSyncNow` become true. | Prove the same sequence against a real merged dashboard-started Jules PR. |
| 2026-05-20 | Jules Environment page | Setup opportunity | Page supports setup script plus `Run and snapshot`; the first broad Spell Phase 1 script later failed during clean-clone typecheck, then the Package 2 scoped script passed. Public docs confirm snapshots can speed later tasks after successful setup. | Historical setup opportunity is now resolved for Package 2; later broad slices must revisit typecheck debt deliberately. |
| 2026-05-21 | Symphony API + proof board | Jules environment setup packet | `verify-jules-environment-setup-packet.mjs` proves `GET /api/v1/jules-environment-setup` returns a non-mutating `package2_scoped_snapshot_passed` packet with official Jules environment assumptions, the accepted Package 2 script (`npm ci --no-audit --no-fund`, `npm run validate:spells`, and `npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose`), and evidence paths for the broad typecheck failure, bad aggregate test-path attempt, and corrected scoped pass. `/proof` now renders a `Jules Environment Setup` card with the same status and JSON link. | Submit the Package 2 Symphony task draft, record the returned draft id, then dispatch Jules with the Package 2 prompt. |
| 2026-05-20 | Codex Browser plugin + Jules web UI | Browser follow-along diagnosis | Direct Playwright MCP navigation failed with `Transport closed`, but the Browser plugin in-app bridge successfully accessed the current Jules tab. Visible state showed `Ready for review`, `View PR`, `Time: 51 mins`, changed-file review entries, and `Check Suite Failure` with four failed checks. `verify-proof-board.mjs` and `verify-dashboard-foreman-console.mjs` now guard visible `Browser Follow-along` guidance on `/proof` and the main dashboard. | Use Browser plugin bridge for live Jules follow-along; keep terminal Playwright for repeatable local dashboard verification only. |
| 2026-05-20 | GitHub CLI + current Jules docs | Historical read-only external-state refresh | `gh pr view 931` once confirmed PR #931 was open, not draft, mergeable, unchanged at head `0c0d9480`, and had the same four failing CI checks: Build, Lint, Tests, and Quality Scan. Current Jules docs still describe the REST API as alpha with `X-Goog-Api-Key`, sessions, activities, `approvePlan`, `sendMessage`, and PR outputs; current environment docs still describe short-lived Ubuntu VMs, preinstalled Node/npm/rg, and `Run and Snapshot` for reusable setup snapshots. | Historical ARA-6 evidence only; next live movement is Package 2 Symphony task draft submission and Jules dispatch. |
