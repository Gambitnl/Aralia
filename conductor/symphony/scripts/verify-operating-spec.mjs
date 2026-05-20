import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This verifier protects the operating spec as the stable source of truth for
// Symphony/Jules work. The active goal should stay short and point here; this
// file keeps the detailed task scenarios, blockers, proof rules, and completion
// criteria versioned and testable instead of trapped in a static prompt.

const spec = await readFile(
  new URL('../docs/JULES_MIDDLEMAN_OPERATING_SPEC.md', import.meta.url),
  'utf8',
);
const openTasks = await readFile(
  new URL('../docs/tasks/SYMPHONY_OPEN_TASKS.md', import.meta.url),
  'utf8',
);

assert.match(spec, /# Symphony\/Jules Middleman Operating Spec/);
assert.match(spec, /Use this file as the stable scope reference/);
assert.match(spec, /The active thread goal should point\s+here instead of carrying every scenario inline/);
assert.match(spec, /audit file records evidence\s+and live task status/);
assert.match(spec, /Codex workers launched by Symphony are foremen/);
assert.match(spec, /Symphony also acts as task tracker and task nudger/);
assert.match(spec, /Jules planning, Jules execution, GitHub\s+checks, PR review, Scout\/Core review, and local sync can each require different\s+wait cadences/);
assert.match(spec, /GitHub Actions\s+checks are part of that foreman surface/);
assert.match(spec, /faster, clearer, more actionable\s+failure signals/);
assert.match(spec, /Not every change should go to Jules/);
assert.match(spec, /local Codex agent when that\s+is lower overhead/);
assert.match(spec, /built-in Codex app browser/);
assert.match(spec, /intended operator experience is task-centered/);
assert.match(spec, /tasks waiting for human input/);
assert.match(spec, /task-scoped Codex chat surface/);
assert.match(spec, /weekday nights from 01:00 to 09:00/);
assert.match(spec, /not\s+keep running a tight background script while blocked on the human/);
assert.match(spec, /current active goal is the full \*\*Symphony delegation workflow\*\*/);
assert.match(spec, /Codex acts as a foreman, clarifies\s+tasks, creates or updates Linear tracking/);
assert.match(spec, /follows Jules through planning, execution, PR creation, GitHub checks,\s+deployment state, repair or feedback sequencing, merge readiness, and local repo\s+sync after merge/);
assert.match(spec, /task-level Delegation ROI\s+ledger that measures whether delegating to Jules reduces Codex usage/);
assert.match(spec, /implementation, workflow\s+intent, audit, architecture overview, and ordered task documents must stay\s+current/);
assert.match(spec, /supporting slices of that larger end-to-end proof, not the whole goal/);

for (const heading of [
  'Dashboard Intake',
  'Linear Issue Creation',
  'Jules Handoff Staging',
  'Jules Launch And Session Tracking',
  'GitHub PR Monitoring',
  'GitHub Pages Deployment Verification',
  'GitHub Actions And Check Quality',
  'Scout/Core Review And Merge Readiness',
  'Local Sync',
  'Worker Assignment',
  'Task Routing And Nudging',
  'Dashboard Foreman Console',
  'Approvals',
  'Usage And Spending',
  'Delegation ROI Ledger',
  'Documentation Creation',
]) {
  assert.match(spec, new RegExp(`### ${heading}`));
}

assert.match(spec, /PR comments and review comments are a valid course-correction channel back\s+to Jules/);
assert.match(spec, /operator-run `gh pr comment \.\.\. --body-file \.\.\.`\s+feedback command/);
assert.match(spec, /instead of auto-commenting or silently switching to local\s+implementation/);
assert.match(spec, /Other review agents can also leave PR comments/);
assert.match(spec, /only\s+explicitly marked `\[Jules feedback\]` comments as Jules course correction/);
assert.match(spec, /Scout conflict comments are a separate foreman signal/);
assert.match(spec, /Potential Conflict Detected by Scout/);
assert.match(spec, /conflict file\s+plus priority PR number/);
assert.match(spec, /Existing GitHub or Jules PRs can be added as `observed_pr` watch records/);
assert.match(spec, /no Jules manifest staging, no Jules launch claim, and no local sync action/);
assert.match(spec, /ARA-6 live run showed local status can report\s+`COMPLETED` with no PR URL/);
assert.match(spec, /Jules API\/browser\/GitHub evidence exposes\s+additional task state/);
assert.match(spec, /visually reconcile the session through the Codex app browser/);
assert.match(spec, /After the PR is merged, Symphony should observe the GitHub Pages deployment\s+state/);
assert.match(spec, /deployment check is read-only unless the operator explicitly authorizes a\s+repair path/);
assert.match(spec, /worker-mode packet recommends a mode from task evidence/);
assert.match(spec, /`operator_only` for blocked human decisions, `local_fast` for tiny local\s+edits\/verifiers\/docs, `local_careful`/);
assert.match(spec, /explicit config wins and the dashboard should say\s+when it is overriding the automatic recommendation/);
assert.match(spec, /process startup defaults dispatch to paused, even without\s+`--dashboard-only`/);
assert.match(spec, /backend dispatch-control endpoint is explicitly enabled/);
assert.match(spec, /dashboard dispatch toggle mirrors backend state only/);
assert.match(spec, /Routing is the source of the dynamic worker-mode packet/);
assert.match(spec, /The main dashboard must not force every proof packet and every control to\s+compete equally for first-screen attention/);
assert.match(spec, /current screen-space inventory is: header controls, dispatch toggle, run\s+totals, worker roster/);
assert.match(spec, /Symphony must measure whether Jules delegation is saving Codex usage/);
assert.match(spec, /Measured facts: Codex input\/output\/total tokens/);
assert.match(spec, /Estimated avoided Codex work: estimated local Codex implementation turns/);
assert.match(spec, /Workflow value signals: whether Jules produced a PR/);
assert.match(spec, /must never present avoided-token estimates as actual token savings/);
assert.match(spec, /`codex_totals`, worker roster token totals, retained usage\/rate-limit\s+activity/);
assert.match(spec, /show "ROI unknown" rather than "saved"/);
assert.match(spec, /ARA-6 first-run baseline/);

for (const heading of [
  'Git And GitHub Blockers',
  'Draft And Issue Blockers',
  'Jules Blockers',
  'GitHub PR Blockers',
  'Scout/Core Blockers',
  'Local Sync Blockers',
  'Worker And Runtime Blockers',
  'Test And Documentation Blockers',
]) {
  assert.match(spec, new RegExp(`### ${heading}`));
}

assert.match(spec, /## Scenario Coverage Matrix/);
assert.match(spec, /This matrix is the working queue for the spec/);
assert.match(spec, /audit file is the live Markdown status ledger for task areas, goalposts,\s+achieved\/not-achieved state, blockers, remaining proof, and evidence paths/);
assert.match(spec, /\| Dashboard intake \| Local verifier coverage plus Codex in-app browser proof/);
assert.match(spec, /Missing title, body, write scope, verification commands, and exact duplicate draft\/handoff submissions are rejected before storage or Git preflight/);
assert.match(spec, /verify-handoff-readiness-packet\.mjs` proves each draft now exposes one non-mutating handoff-readiness packet/);
assert.match(spec, /connects Git sync, Linear issue preview, Jules manifest preview, launch waiting state, and the first nudge endpoint/);
assert.match(spec, /verify-clean-handoff-pass-path\.mjs` proves the same packet has a clean-Git pass path/);
assert.match(spec, /verify-middleman-path\.mjs` proves the queue also exposes one global middleman path/);
assert.match(spec, /Git sync, Linear, Jules manifest, Jules launch, Jules session, GitHub PR, Scout\/Core, and local sync/);
assert.match(spec, /foreman action packet for the current middleman boundary/);
assert.match(spec, /Git-blocked action is operator-only and points to Git disposition review and recording endpoints/);
assert.match(spec, /verify-middleman-foreman-pass-path\.mjs` proves that after clean Git/);
assert.match(spec, /advances through Linear issue creation, Jules manifest staging, Jules launch, Jules session refresh, GitHub PR refresh, and local sync/);
assert.match(spec, /separate read-only evidence endpoint where one exists/);
assert.match(spec, /before Linear it marks the Linear issue boundary runnable and the Jules manifest boundary waiting/);
assert.match(spec, /after Linear is linked it marks the Jules manifest boundary runnable/);
assert.match(spec, /handoff-readiness-2026-05-17\.\*/);
assert.match(spec, /handoff-pass-path-2026-05-17\.\*/);
assert.match(spec, /middleman-path-2026-05-17\.\*/);
assert.match(spec, /foreman-action-packet-2026-05-17\.\*/);
assert.match(spec, /current boundary remains Git sync while later Linear\/Jules\/local-sync stages are waiting and non-runnable/);
assert.match(spec, /live proof board exposes the operator-only Git disposition foreman action with review and record endpoints/);
assert.match(spec, /pass-path section while Git remains blocked/);
assert.match(spec, /\| GitHub sync gate \| Local verifier coverage plus Codex in-app browser proof/);
assert.match(spec, /verify-git-preflight-blockers\.mjs` covers non-repo, missing remote, wrong branch, and diverged-branch blockers/);
assert.match(spec, /verify-git-disposition-workflow\.mjs` and Codex in-app browser proof show a non-mutating Git disposition ledger/);
assert.match(spec, /verify-git-disposition-review-packet\.mjs` proves the dashboard\/API now exposes a read-only review packet/);
assert.match(spec, /required categories, blockers, evidence counts, source\/generated untracked classification, allowed decisions, task links, and `\/proof` board visibility/);
assert.match(spec, /verify-git-resolution-packet\.mjs` proves the preflight also emits a read-only resolution packet/);
assert.match(spec, /concrete local-only commits, remote-only commits, tracked files, nested untracked files/);
assert.match(spec, /verify-git-sync-plan\.mjs` proves the snapshot derives a guarded human execution plan and an execution packet/);
assert.match(spec, /verify-git-sync-execution-receipt\.mjs` proves that execution packet now carries the preflight receipt, decision receipt, and safety checklist/);
assert.match(spec, /git-sync-execution-packet-2026-05-17\.\*/);
assert.match(spec, /git-sync-execution-receipt-2026-05-17\.\*/);
assert.match(spec, /git-disposition-review-2026-05-17\.\*/);
assert.match(spec, /git-disposition-review-proof-board-2026-05-17\.\*/);
assert.match(spec, /four missing disposition decisions/);
assert.match(spec, /no exposed mutating commands while blocked, verification commands, blockers, required human confirmation, and the expected next proof/);
assert.match(spec, /preflight receipt, decision receipt, and safety checklist while remaining non-executable and non-mutating/);
assert.match(spec, /\| Linear issue creation \| Local verifier coverage/);
assert.match(spec, /verify-linear-issue-blockers\.mjs/);
assert.match(spec, /non-mutating issue-packet rehearsal via `verify-linear-issue-preview\.mjs`/);
assert.match(spec, /linear-issue-preview-2026-05-17\.\*/);
assert.match(spec, /canCreateNow: false/);
assert.match(spec, /wouldCreateLinearIssue: true/);
assert.match(spec, /mutatesExternalSystems: false/);
assert.match(spec, /blocks when `\.jules\/orchestrator\/cli\.ts` is missing/);
assert.match(spec, /verify-jules-manifest-preview\.mjs` proves blocked drafts can rehearse the exact manifest shape/);
assert.match(spec, /jules-manifest-preview-2026-05-17\.\*/);
assert.match(spec, /canStageNow: false/);
assert.match(spec, /wouldStageJulesManifest: true/);
assert.match(spec, /mutatesLocalFiles: false/);
assert.match(spec, /\| Jules launch\/session tracking \| Local dashboard\/API coverage/);
assert.match(spec, /verify-jules-launch-readiness-packet\.mjs` proves a staged handoff now exposes a read-only launch readiness packet/);
assert.match(spec, /external\/local mutation class, safety checklist, blockers, and expected post-launch proof/);
assert.match(spec, /jules-launch-readiness-2026-05-17\.\*/);
assert.match(spec, /real observed-PR handoffs render that launch-readiness card as blocked/);
assert.match(spec, /no external\/local mutation path, watch-only blockers, and no false live-launch claim/);
assert.match(spec, /\| GitHub PR monitoring \| Local verifier coverage/);
assert.match(spec, /verify-pr-next-action\.mjs` now also proves failed checks and risky files expose an operator-run `gh pr comment \.\.\. --body-file \.\.\.` feedback command/);
assert.match(spec, /verify-pr-comment-classification\.mjs` proves comments from other review agents stay external review context/);
assert.match(spec, /Scout conflict comments are separated with conflict file and priority PR metadata/);
assert.match(spec, /verify-observed-pr-watch\.mjs` proves existing GitHub PRs can be watched as `observed_pr` records/);
assert.match(spec, /verify-observed-pr-follow-up-draft\.mjs` proves historical observed PR learning creates a separate normal dashboard draft/);
assert.match(spec, /do not repair, reopen, or comment on the historical PR/);
assert.match(spec, /pr-900-scout-conflict-learning-2026-05-17\.\*/);
assert.match(spec, /closed Jules PR with 41 changed files, 0 checks, and 256 Scout conflict comments/);
assert.match(spec, /observed-pr-due-refresh-2026-05-17\.\*/);
assert.match(spec, /schedule an observed PR refresh nudge/);
assert.match(spec, /Record Observed Learning` instead of a repair action/);
assert.match(spec, /observed-pr-follow-up-draft-2026-05-17\.json/);
assert.match(spec, /PR #900 can become a separate blocked dashboard draft/);
assert.match(spec, /ara6-pr-refresh-summary-2026-05-20\.json` shows an active dashboard-started Jules handoff/);
assert.match(spec, /reconcile a missing local PR URL from Jules API session output/);
assert.match(spec, /ara6-pr-repair-decision-refresh-2026-05-20\.json` shows the same handoff now carries a read-only repair decision packet/);
assert.match(spec, /setup-task, Jules-feedback, wait, and refresh-after-repair choices/);
assert.match(spec, /Real repair feedback or setup repair execution, Scout\/Core readiness, Core validation\/merge, deployment, and local sync remain to be proven/);
assert.match(spec, /\| GitHub Actions\/check quality \| Explicit scope now allows meaningful CI improvements/);
assert.match(spec, /make checks more granular, faster to diagnose, less noisy, or easier for Symphony\/Codex\/Jules\/Scout\/Core to interpret/);
assert.match(spec, /Quality Scan \(advisory\)` job that runs `npm run scan`/);
assert.match(spec, /writes parseable `quality-scan\.json` with `npm --silent run scan -- --json`/);
assert.match(spec, /uploads it as the `quality-scan-json` artifact/);
assert.match(spec, /writes grouped counts into `GITHUB_STEP_SUMMARY`/);
assert.match(spec, /human-readable and machine-readable quality-debt signal without blocking merges on known backlog debt/);
assert.match(spec, /verify-pr-check-artifacts\.mjs` proves Symphony's PR check summary recognizes `Quality Scan \(advisory\)`/);
assert.match(spec, /stores a `githubPullRequestChecks\.artifacts` hint for `quality-scan-json`/);
assert.match(spec, /preserves the optional GitHub check `detailsUrl`/);
assert.match(spec, /renders that artifact plus the GitHub step-summary note and `Open check details` link in the PR readiness panel/);
assert.match(spec, /read-only `workflow_setup` blocker/);
assert.match(spec, /Check blocker classification/);
assert.match(spec, /Resolve CI Setup Blocker/);
assert.match(spec, /github-actions-quality-2026-05-17\.json/);
assert.match(spec, /the JSON artifact command parses/);
assert.match(spec, /npm run validate` currently fails on existing strict charset data issues and was intentionally not added as a noisy blocker/);
assert.match(spec, /pr-929-quality-scan-github-2026-05-17\.\*/);
assert.match(spec, /the new check completed successfully on GitHub and uploaded the `quality-scan-json` artifact/);
assert.match(spec, /Symphony can watch PR #929 read-only and carry the live `quality-scan-json` artifact in dashboard state/);
assert.match(spec, /Live ARA-6 proof `ara6-pr-refresh-summary-2026-05-20\.json`/);
assert.match(spec, /classifies the real PR #931 build\/lint\/test\/quality failure set as `workflow_setup`/);
assert.match(spec, /renders the read-only repair decision panel/);
assert.match(spec, /failed check set now produces a human-readable repair choice packet without mutating GitHub or local files/);
assert.match(spec, /Decide and execute the setup\/workflow repair path/);
assert.match(spec, /terminal-simulator pane may mirror a live local Codex foreman process/);
assert.match(spec, /structured task events so future agents can resume without scraping terminal\s+scrollback/);
assert.match(spec, /\| Scout\/Core readiness \| `verify-scout-core-readiness-packet\.mjs` proves each handoff now exposes a read-only Scout\/Core readiness packet/);
assert.match(spec, /PR state, checks, file risk, Scout conflict counts, external\/Jules feedback counts, dashboard-started-vs-observed ownership/);
assert.match(spec, /Core validation\/merge commands only when ready, mutation flags, blockers, safety checklist, expected proof, and `\/proof` visibility/);
assert.match(spec, /\| Local sync \| Local verifier coverage/);
assert.match(spec, /verify-local-sync-next-action\.mjs` proves each local checkout state resolves to one readable next action/);
assert.match(spec, /verify-local-sync-readiness-packet\.mjs` proves each handoff now exposes a read-only local-sync readiness packet/);
assert.match(spec, /PR merge state, dashboard-started-vs-observed ownership, local commit evidence, refresh URL, guarded sync URL, safety checklist, expected proof, and mutation flags/);
assert.match(spec, /protects `\/proof` visibility for safe, blocked, and observed PR local-sync states/);
assert.match(spec, /\| Worker designation and dispatch gate \| Local verifier and dashboard screenshot coverage/);
assert.match(spec, /verify-dispatch-control-toggle\.mjs` prove startup defaults to dispatch paused/);
assert.match(spec, /normal startup does not poll or launch workers until enabled/);
assert.match(spec, /\| Worker model\/thinking assignment \| Local verifier coverage plus Codex in-app browser proof/);
assert.match(spec, /verify-worker-mode-packet\.mjs` proves routing now emits a dynamic worker-mode packet/);
assert.match(spec, /including model\/reasoning recommendation, dispatchability, complexity signals, reasons, and explicit `codex\.model` \/ `codex\.reasoning_effort` override policy/);
assert.match(spec, /symphony-worker-mode-packet\.png` shows the current blocked dashboard rendering the packet as `operator_only`/);
assert.match(spec, /\| Dashboard foreman-console focus \| Current screen-space inventory is documented/);
assert.match(spec, /verify-dashboard-density\.mjs` proves idle Usage Tracker, Routine Approval Rules, Running Issues, and Retrying Issues render as compact summary drawers/);
assert.match(spec, /warning\/danger usage, pending approvals, running workers, and retrying issues stay prominent/);
assert.match(spec, /symphony-dashboard-density\.png` shows the idle lower monitoring sections collapsed below that boundary/);
assert.match(spec, /\| Task routing and nudging \| `verify-task-routing-nudging\.mjs` covers blocked queues, small local-agent recommendations, Jules planning recommendations/);
assert.match(spec, /verify-task-nudge-ledger\.mjs` proves the routing decision can be recorded as durable task-tracking evidence/);
assert.match(spec, /verify-task-nudge-scheduler\.mjs` proves recorded nudges are classified as due, waiting, or operator-blocked/);
assert.match(spec, /verify-task-nudge-due-refresh\.mjs` proves a foreman wake-up can run due external-read nudges/);
assert.match(spec, /Dashboard rendering exposes the recommendation, next action, pause duration, candidate routes, record button, task nudge ledger, nudge scheduler, action packet, run-due-refresh button, and due refresh receipt/);
assert.match(spec, /task-nudge-action-packet-2026-05-17\.\*/);
assert.match(spec, /method `NONE`, safety `operator_only`, `canRunNow: false`, and no external mutation/);
assert.match(spec, /task-nudge-due-refresh-2026-05-17\.\*/);
assert.match(spec, /0 due records and 1 operator-blocked Git-sync record/);
assert.match(spec, /one due `refresh \/ github_pr` nudge for observed PR #900 produced one PR refresh/);
assert.match(spec, /task-routing-nudging-2026-05-17\.\*/);
assert.match(spec, /The audit is the live Markdown status file that lists task areas, goalposts, status, achieved\/not-achieved state, blockers, remaining proof, and evidence paths/);
assert.match(spec, /verify-proof-board\.mjs` now protects a compact `\/proof` page/);
assert.match(spec, /reuses task-intake state, links back to this spec and audit, and exposes the latest Linear issue, Jules manifest, and handoff-readiness previews/);
assert.match(spec, /Symphony polls too aggressively instead of pausing for Jules or GitHub/);
assert.match(spec, /Normal dashboard startup accidentally dispatches workers before the backend\s+dispatch toggle is enabled/);
assert.match(spec, /\| Full end-to-end path \| Not complete/);
assert.match(spec, /compact `\/proof` board gives the in-app browser a small, script-free follow-along surface/);
assert.match(spec, /Git disposition review, latest draft\/handoff, Linear issue preview, Jules manifest preview, handoff readiness, middleman path, foreman action, nudge state/);
assert.match(spec, /middleman path, foreman action, nudge state/);
assert.match(spec, /proof-board-2026-05-17\.json` and `\.md`, `linear-issue-preview-proof-board-2026-05-17\.\*`, `jules-manifest-preview-proof-board-2026-05-17\.\*`, `handoff-readiness-proof-board-2026-05-17\.\*`, `git-disposition-review-proof-board-2026-05-17\.\*`, `middleman-path-2026-05-17\.\*`, `foreman-action-packet-2026-05-17\.\*`, `symphony-foreman-console\.png`, `symphony-dashboard-density\.png`, and `symphony-worker-mode-packet\.png` shows the Codex in-app browser loaded the relevant dashboard\/proof surfaces/);
assert.match(spec, /linear-issue-preview-proof-board-2026-05-17\.\*/);
assert.match(spec, /jules-manifest-preview-proof-board-2026-05-17\.\*/);
assert.match(spec, /handoff-readiness-proof-board-2026-05-17\.\*/);
assert.match(spec, /symphony-foreman-console\.png/);
assert.match(spec, /symphony-dashboard-density\.png/);
assert.match(spec, /symphony-worker-mode-packet\.png/);
assert.match(spec, /Current live proof covers preflight-blocked dashboard intake, read-only observed PR monitoring for PR #900 and PR #929, one real observed-PR due refresh against PR #900, a separate dashboard draft created from PR #900 learning/);
assert.match(spec, /non-mutating Git disposition review for the blocked queue/);
assert.match(spec, /non-mutating Git sync execution receipt for that blocked queue/);
assert.match(spec, /non-mutating Linear issue preview for that blocked draft/);
assert.match(spec, /Jules manifest preview for that blocked draft/);
assert.match(spec, /non-mutating handoff-readiness packet for that blocked draft/);
assert.match(spec, /blocked launch-readiness cards for real observed-PR handoffs/);
assert.match(spec, /one global middleman path that preserves the current Git boundary and keeps observed PRs out of launch\/local-sync claims/);
assert.match(spec, /current-boundary foreman action packet for operator-owned Git disposition/);
assert.match(spec, /local `verify-middleman-foreman-pass-path\.mjs` proof that the same packet will pick the correct future foreman action and evidence endpoint/);
assert.match(spec, /local `verify-scout-core-readiness-packet\.mjs` proof that the GitHub PR review boundary separates read-only Scout\/Core evidence from explicit Core merge/);
assert.match(spec, /local `verify-local-sync-readiness-packet\.mjs` proof that the final local-sync boundary separates read-only refresh evidence from guarded Git mutation/);
assert.match(spec, /compact proof-board follow-along state for the blocked queue/);
assert.match(spec, /npm\.cmd run verify:jules-contract/);
assert.match(spec, /real dashboard-started task has moved through Linear, existing Jules\s+orchestration, GitHub PR state, Scout\/Core readiness, and local sync proof/);
assert.match(spec, /completion audit\/status file shows each major goalpost as achieved or\s+not achieved/);
assert.match(spec, /satisfy this spec and audit/);

assert.match(openTasks, /# Symphony Open Task Order/);
assert.match(openTasks, /## Current Live Thread/);
assert.match(openTasks, /ARA-6/);
assert.match(openTasks, /https:\/\/github\.com\/Gambitnl\/Aralia\/pull\/931/);
assert.match(openTasks, /Current full goal: build and prove the Symphony delegation workflow end to end/);
assert.match(openTasks, /task-level Delegation ROI ledger that separates measured facts from estimates/);
assert.match(openTasks, /ordered\s+task documents must stay current as each proof stage advances/);
assert.match(openTasks, /## Interaction Rules While Jules Works/);
assert.match(openTasks, /Prefer read-only observation over chat/);
assert.match(openTasks, /## Jules Environment Setup Finding/);
assert.match(openTasks, /Run and snapshot/);
assert.match(openTasks, /npm ci --no-audit --no-fund/);
assert.match(openTasks, /## Ordered Work Queue/);
assert.match(openTasks, /fallback PR discovery/);
assert.match(openTasks, /check-blocker classification layer/);
assert.match(openTasks, /workflow_setup/);
assert.match(openTasks, /ara6-pr-refresh-summary-2026-05-20\.json/);
assert.match(openTasks, /ara6-pr-repair-decision-refresh-2026-05-20\.json/);
assert.match(openTasks, /Resolve CI Setup Blocker/);
assert.match(openTasks, /create_setup_repair_task/);
assert.match(openTasks, /send_jules_feedback/);
assert.match(openTasks, /terminal-simulator live mirror/);
assert.match(openTasks, /Delegation ROI ledger/);
assert.match(openTasks, /measured Codex tokens\/runtime and\s+foreman turns separately from estimated avoided Codex implementation tokens/);
assert.match(openTasks, /## Objective Completion Audit/);
assert.match(openTasks, /Observe ARA-6 without disrupting Jules/);
assert.match(openTasks, /Consolidate stale Symphony task\/docs into ordered checklist/);
assert.match(openTasks, /Prove the full Symphony implementation is complete/);
assert.match(openTasks, /Not achieved; keep the broader Symphony goal active/);
assert.match(openTasks, /## Current Full-Workflow Completion Audit/);
assert.match(openTasks, /Codex clarifies tasks and acts as foreman through Symphony/);
assert.match(openTasks, /GitHub checks and repair\/feedback sequencing/);
assert.match(openTasks, /Delegation ROI ledger \| Spec now defines measured facts/);
assert.match(openTasks, /2026-05-20 01:05 Europe\/Amsterdam/);
