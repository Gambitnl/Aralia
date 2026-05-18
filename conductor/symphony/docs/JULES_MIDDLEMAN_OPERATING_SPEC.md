# Symphony/Jules Middleman Operating Spec

This is the canonical operating spec for evolving Symphony into Aralia's
dashboard-first middleman between Codex workers, Google Jules, GitHub, Linear,
the local repository, tests, documentation, and completion evidence.

Use this file as the stable scope reference. The active thread goal should point
here instead of carrying every scenario inline. The audit file records evidence
and live task status; this spec defines what the system must handle.

## Core Intent

Symphony is not a second cloud coding system. Symphony is the local dashboard,
gatekeeper, and foreman coordinator around the existing Aralia Jules workflow.

The operator should be able to draft bounded work in Symphony, prove GitHub is
ready for cloud work, create or connect the tracking issue, stage a Jules
manifest through the existing `.jules/orchestrator`, launch or refresh Jules,
watch the GitHub PR, route Scout/Core review, and only then sync local master.
GitHub Actions checks are part of that foreman surface: Symphony may improve
CI when the change gives operators and agents faster, clearer, more actionable
failure signals instead of merely rearranging check names.

Codex workers launched by Symphony are foremen. Their default job is to prepare
bounded Jules handoffs, monitor Jules and GitHub, explain blockers, and update
the dashboard/Linear trail. They should not become broad local implementers
unless the operator explicitly asks for local-only work.

Symphony also acts as task tracker and task nudger. It should pause long enough
for external systems to make progress, then refresh or nudge the next boundary
instead of spinning in a tight loop. Jules planning, Jules execution, GitHub
checks, PR review, Scout/Core review, and local sync can each require different
wait cadences.

Not every change should go to Jules. Symphony should consider task size, risk,
write scope, expected wait time, and whether cloud context is useful before it
routes work. Small local edits, dashboard wiring, verifier updates, and
operator-facing documentation can be assigned to a local Codex agent when that
is lower overhead; bounded implementation work that benefits from isolated cloud
execution can go to Jules.

Live dashboard inspection must use the built-in Codex app browser so the user
can follow along. External Chrome/Chromium windows are not the live inspection
surface for this workflow.

The current active goal is still the larger **dashboard-first middleman**
outcome: Symphony should coordinate local Codex, Jules, GitHub, Linear,
Scout/Core, and local repository sync from one trustworthy operator surface.
The old ever-growing thread goal has been retired; this spec and the audit are
now the source of truth for the full mission. The current stage inside that
larger mission is **dashboard foreman-console focus plus safe dispatch gating**:
reduce the main dashboard's screen-space competition, make the current boundary
obvious, keep Symphony startup safe for inspection, and turn task routing into a
visible worker-mode recommendation that names the right local/Jules path and
Codex model/reasoning effort for the task's complexity and risk.

## System Boundaries

- Symphony owns local dashboard state, default-off dispatch control, worker
  assignment, readable status, approval visibility, and safe local gates.
- Linear owns human-readable issue tracking and status-comment history.
- Jules owns cloud implementation work and cloud session state.
- GitHub owns the source branch Jules can see, PR state, checks, mergeability,
  changed files, and merged/unmerged truth.
- Scout/Core own review, risk arbitration, and merge readiness decisions.
- The local repository owns dirty worktree state, local master sync, test
  commands, documentation artifacts, and evidence files.

## Task Scenarios To Cover

### Dashboard Intake

1. Operator creates a local draft with title, details, expected files, and
   verification commands.
2. Draft is saved even when GitHub sync is blocked.
3. Draft shows `blocked_by_git_sync` when Jules cannot safely start.
4. Draft clearly disables Linear issue creation, manifest staging, and launch
   when preflight fails.
5. Draft can later become a Linear issue or Jules handoff after the gate passes.
6. Draft text includes enough scope for Jules, Scout, and Core to understand
   intended files and verification.
7. Draft exposes one handoff-readiness packet that combines Git sync, Linear
   issue creation, Jules manifest staging, Jules launch waiting state, and the
   first task nudge without mutating Git, Linear, `.jules`, Jules, or GitHub.

### Linear Issue Creation

1. Creating a tracking issue is blocked until the GitHub sync gate passes.
2. Created issue includes a GitHub sync receipt: branch, remote, commit, and
   operator-facing scope.
3. Created issue tells the foreman worker to delegate to Jules first.
4. Created issue limits routine Linear writes to status comments on the assigned
   issue unless the operator explicitly authorizes more.
5. While the GitHub sync gate is blocked, the dashboard/API can preview the exact
   Linear issue packet that would be created later, including title, body,
   write scope, verification commands, blockers, and a `mutatesExternalSystems:
   false` safety marker.

### Jules Handoff Staging

1. Manifest staging uses the existing `.jules/orchestrator` path.
2. Manifest staging is blocked when GitHub sync fails.
3. Manifest records expected files, verification commands, base branch, base
   commit, and Linear issue context.
4. Staged handoff can be inspected before launch.
5. Staging never invents a second cloud-task storage path.
6. While GitHub sync or Linear tracking is still blocked, the dashboard/API can
   preview the `.jules/orchestrator` manifest packet in memory, including run
   id, source, starting branch/commit, write scopes, forbidden files,
   verification, and a `mutatesLocalFiles: false` safety marker.

### Jules Launch And Session Tracking

1. Launch is blocked until sync gate passes and a staged handoff exists.
2. Launch records session id, session URL, state, plan approval status, and
   launch timestamp.
3. Dashboard can refresh individual sessions and all sessions.
4. Operator can send feedback/messages to Jules through the existing orchestrator
   route.
5. Plan approval is visible and only actionable when the stored state says Jules
   is waiting for approval.

### GitHub PR Monitoring

1. Dashboard tracks PR URL, PR number, state, draft flag, mergeability, checks,
   changed files, labels, and timestamps.
2. PR refresh is read-only.
3. Failed checks produce an action to repair or wait, not a merge action.
4. Draft PRs are not presented as merge-ready.
5. Missing PRs produce a clear "wait for Jules PR" state.
6. PR comments and review comments are a valid course-correction channel back
   to Jules. When checks fail, conflicts appear, or changed files need repair,
   Symphony should surface an operator-run `gh pr comment ... --body-file ...`
   feedback command instead of auto-commenting or silently switching to local
   implementation.
7. Other review agents can also leave PR comments. Symphony must classify only
   explicitly marked `[Jules feedback]` comments as Jules course correction;
   other PR comments and review comments remain external review context.
8. Scout conflict comments are a separate foreman signal, not generic external
   review chatter. Comments matching "Potential Conflict Detected by Scout"
   should be grouped as Scout conflict comments and preserve the conflict file
   plus priority PR number when Scout includes them.
9. Existing GitHub or Jules PRs can be added as `observed_pr` watch records for
   learning, proof capture, and task nudging. Observed PRs reuse PR refresh,
   check, file-risk, and comment-routing panels, but they must stay read-only:
   no Jules manifest staging, no Jules launch claim, and no local sync action
   from a PR this dashboard did not launch.

### GitHub Actions And Check Quality

1. GitHub Actions improvements are in scope when they make failures easier to
   diagnose, isolate, or fix.
2. Broad checks may be split into granular checks when that gives Symphony,
   Codex, Jules, Scout, or Core faster control over where a failure lives.
3. Slow checks may gain faster preflight or fail-fast stages when those stages
   catch real blockers earlier.
4. Unhelpful or noisy checks may be adjusted or removed only when the change is
   justified against the dashboard-first workflow.
5. CI work must improve actionable feedback, not merely rename jobs or chase
   green checks as a proxy metric.

### Scout/Core Review And Merge Readiness

1. Scout/Core readiness is visible before merge.
2. Changed files outside declared scope are called out.
3. High-risk files require Scout/Core attention even if only one handoff exists.
4. Merge-ready means GitHub, checks, scope risk, and Scout/Core gates are all
   satisfied.
5. Dashboard distinguishes waiting, blocked, ready for Scout/Core, ready to
   merge, merged, failed, and unknown.

### Local Sync

1. Local sync appears only after a PR is merged.
2. Local sync checks current branch, dirty worktree, ahead/behind, and
   fast-forward possibility.
3. Mutating sync action is exposed only when `git pull --ff-only` is safe.
4. Dirty local work never gets overwritten silently.
5. If sync is blocked, dashboard names the exact local blocker.

### Worker Assignment

1. Symphony assigns a stable worker designation for each Codex worker.
2. Worker roster shows issue, workspace, thread id, approval state, and recent
   activity.
3. `codex.model` and `codex.reasoning_effort` are optional configuration values.
4. When set, Symphony passes model/effort to Codex app-server and records them
   in worker identity, prompt context, API state, and dashboard cards.
5. When unset, dashboard explicitly shows app-server defaults rather than
   pretending an assignment was made.
6. The worker-mode packet recommends a mode from task evidence rather than only
   echoing global config. The first explicit mode list is:
   `operator_only` for blocked human decisions, `local_fast` for tiny local
   edits/verifiers/docs, `local_careful` for moderate local work needing more
   reasoning, `jules_task` for bounded cloud implementation, `jules_plan` for
   broad or risky work that should plan first, and `observe_wait` for external
   Jules/GitHub/Scout/Core/local-sync waits.
7. Each worker-mode recommendation should explain the complexity signals that
   produced it: expected files, verification commands, risky keywords, external
   boundary, current blockers, and whether the task is dashboard-started or
   observed-only.
8. The recommended model/reasoning effort must be visible before dispatch. It
   should never silently override an operator-specified `codex.model` or
   `codex.reasoning_effort`; explicit config wins and the dashboard should say
   when it is overriding the automatic recommendation.
9. Symphony process startup defaults dispatch to paused, even without
   `--dashboard-only`. The dashboard and safe read APIs may load, but tracker
   polling, issue claiming, workspace cleanup, and Codex app-server startup are
   blocked until the backend dispatch-control endpoint is explicitly enabled.
10. The dashboard dispatch toggle mirrors backend state only. It must not use
    browser-local persistence to decide startup behavior, because each new
    Symphony process should begin as safe inspection unless the operator turns
    assignment on.

### Task Routing And Nudging

1. Symphony classifies each draft or handoff as Jules-suitable,
   local-agent-suitable, or needs operator routing.
2. Routing considers task size, write scope, external wait time, whether Jules
   should first make a plan, and whether a local Codex agent is faster and safer.
3. Long-running boundaries expose a next nudge time instead of busy-looping:
   Jules planning, Jules execution, GitHub checks, PR review, Scout/Core review,
   and local sync each have their own pause cadence.
4. The dashboard shows whether the next action is `wait`, `refresh`, `nudge`,
   `ask_operator`, `send_to_jules`, or `assign_local_agent`.
5. Nudges are recorded as task-tracking evidence, not hidden retry loops.
6. Routing is the source of the dynamic worker-mode packet. The
   packet must connect plain-language task complexity to the chosen worker path,
   the wait cadence, and the recommended Codex model/reasoning effort.

### Dashboard Foreman Console

1. The main dashboard must not force every proof packet and every control to
   compete equally for first-screen attention.
2. The current boundary should be the dominant surface: Git sync, Linear issue,
   Jules manifest, Jules launch/session, GitHub PR, Scout/Core, local sync, or
   operator-only wait.
3. Secondary surfaces should be grouped by job: intake, Git safety, Jules
   lifecycle, PR review, local return, worker/runtime, and evidence.
4. The current screen-space inventory is: header controls, dispatch toggle, run
   totals, worker roster, new task form, existing-PR watch form, local drafts,
   tracked handoffs, task routing, nudge ledger, nudge scheduler, queue next
   action, Git preflight, remediation, Sync Decision Board, Git disposition review, Git resolution
   packet, Git sync plan/execution packet, middleman path, kickoff sequence,
   handoff readiness/pass-path, Linear preview, manifest preview, launch
   readiness, Jules session/approval/message controls, PR readiness, check
   artifacts, feedback classification, Scout/Core readiness, conflict watch,
   handoff status board, local sync readiness, usage tracker, approval policy,
   running/retrying worker lists, and activity feed.
5. `/proof` remains the compact follow-along evidence board. It should stay
   script-free and should not become a second full dashboard.

### Approvals

1. Auto-approved actions are visible in activity, not hidden.
2. Routine configured actions explain why they are auto-approved.
3. Riskier worker approvals are surfaced with enough detail to decide.
4. View-only approval types say they are view-only.
5. Jules plan approvals are separate from worker tool approvals.

### Usage And Spending

1. Dashboard shows token totals, runtime, rate-limit pressure, and credit data
   when Codex reports it.
2. Retained activity preserves recent usage events so the surface does not go
   blank after refresh.
3. Missing usage data is shown as unknown/waiting, not as zero cost.
4. Usage pressure should be understandable without raw JSON.

### Documentation Creation

1. README describes dashboard-first operation and the key API surfaces.
2. This operating spec holds scope, scenarios, blockers, and done criteria.
3. The audit file is the live Markdown status ledger for task areas, goalposts,
   achieved/not-achieved state, blockers, remaining proof, and evidence paths.
4. Evidence artifacts are linked from the audit.
5. Documentation must not claim full completion while live end-to-end proof is
   missing.

## Blockage Scenarios To Cover

### Git And GitHub Blockers

- Local branch is not the intended base branch.
- Local base has uncommitted tracked changes.
- Local base has untracked files.
- Local base has unpushed commits.
- Local base is behind GitHub.
- Local and remote have diverged.
- GitHub fetch fails.
- Remote branch is missing.
- Local repository is missing or not a Git checkout.
- Worktree contains ignored or generated artifacts that should be explained but
  not necessarily treated as launch blockers unless they affect Jules.

### Draft And Issue Blockers

- Draft has no title.
- Draft has no body/details.
- Draft has no expected files.
- Draft has no verification commands.
- Linear API key is missing.
- Linear project slug is missing or invalid.
- Linear issue creation succeeds but later handoff staging fails.
- Duplicate draft or handoff exists for the same task.

### Jules Blockers

- Jules orchestrator CLI/path is missing.
- Manifest staging fails.
- Jules launch fails.
- Jules session URL is missing after launch.
- Jules waits for plan approval.
- Jules needs operator feedback.
- Jules reports failure or cancellation.
- Jules creates no PR.

### GitHub PR Blockers

- PR is missing.
- PR is draft.
- PR checks are pending.
- PR checks failed.
- GitHub Actions are too broad to identify the failing subsystem quickly.
- GitHub Actions are too slow to provide useful foreman feedback.
- GitHub Actions are noisy, duplicated, or not useful for this workflow.
- PR is not mergeable.
- PR changes files outside declared scope.
- PR overlaps with another active handoff.
- PR touches risk files needing Scout/Core.
- PR was closed without merge.

### Scout/Core Blockers

- Scout review is missing.
- Core validation is missing.
- Scout/Core disagree.
- Risky file ownership is unclear.
- Merge is not appropriate for the current local state.

### Local Sync Blockers

- PR is not merged.
- Local branch is not master/base.
- Worktree is dirty.
- Local master has unpushed commits.
- Local master is behind but cannot fast-forward.
- Pull fails.
- Sync would overwrite local work.

### Worker And Runtime Blockers

- Codex app-server is unavailable.
- Worker thread cannot start.
- Worker turn times out or stalls.
- Worker asks for unsupported approval.
- Worker uses wrong model or reasoning effort.
- Dashboard-only mode accidentally dispatches workers.
- Normal dashboard startup accidentally dispatches workers before the backend
  dispatch toggle is enabled.
- Dashboard event stream disconnects and polling fallback must take over.
- Symphony polls too aggressively instead of pausing for Jules or GitHub.
- Symphony waits too long after an external boundary is ready.
- A task is routed to Jules even though a local Codex agent would be faster and
  lower risk, or routed locally even though Jules/cloud isolation is warranted.

### Test And Documentation Blockers

- Contract suite fails.
- Visual verifier fails or screenshot is missing.
- Audit references evidence that does not exist.
- README and spec disagree.
- Completion audit omits a requirement.
- Live proof was captured outside the Codex in-app browser.

## Required Evidence

Each requirement needs the strongest evidence appropriate to its scope:

- Code paths for parser, runner, server, dashboard, and task store behavior.
- Verifier scripts that protect API contracts and dashboard rendering.
- Rendered screenshots for visual surfaces.
- JSON API captures for live state.
- Codex in-app browser proof for live dashboard inspection.
- External-state proof for Linear, Jules, GitHub PR, Scout/Core, and local sync.
- Audit rows that connect every requirement to its evidence.

## Scenario Coverage Matrix

This matrix is the working queue for the spec. "Local proof" means code,
fixtures, API checks, or rendered dashboard checks cover the contract. "Partial
live proof" means the Codex in-app browser has inspected real local/external
state, but the full Linear/Jules/GitHub/Scout/Core/local-sync path is not yet
complete.

| Area | Current proof | Remaining gap |
|---|---|---|
| Dashboard intake | Local verifier coverage plus Codex in-app browser proof that a bounded draft can be saved while GitHub sync blocks handoff. Missing title, body, write scope, verification commands, and exact duplicate draft/handoff submissions are rejected before storage or Git preflight. `verify-handoff-readiness-packet.mjs` proves each draft now exposes one non-mutating handoff-readiness packet that connects Git sync, Linear issue preview, Jules manifest preview, launch waiting state, and the first nudge endpoint. `verify-clean-handoff-pass-path.mjs` proves the same packet has a clean-Git pass path: before Linear it marks the Linear issue boundary runnable and the Jules manifest boundary waiting; after Linear is linked it marks the Jules manifest boundary runnable and records the expected proof for the next boundary. `verify-middleman-path.mjs` proves the queue also exposes one global middleman path across Git sync, Linear, Jules manifest, Jules launch, Jules session, GitHub PR, Scout/Core, and local sync with per-stage mutation labels, expected proof, and a foreman action packet for the current middleman boundary. The Git-blocked action is operator-only and points to Git disposition review and recording endpoints instead of exposing a false Linear/Jules/local-sync button. `verify-middleman-foreman-pass-path.mjs` proves that after clean Git the same foreman packet advances through Linear issue creation, Jules manifest staging, Jules launch, Jules session refresh, GitHub PR refresh, and local sync with the correct safety class, mutation flags, current boundary, runnable endpoint, and separate read-only evidence endpoint where one exists. Codex in-app browser/API proof `handoff-readiness-2026-05-17.*` shows the blocked packet against the current draft, `handoff-pass-path-2026-05-17.*` shows the live dashboard/API now exposes the pass-path section while Git remains blocked, `middleman-path-2026-05-17.*` shows the live dashboard/API current boundary remains Git sync while later Linear/Jules/local-sync stages are waiting and non-runnable, and `foreman-action-packet-2026-05-17.*` shows the live proof board exposes the operator-only Git disposition foreman action with review and record endpoints. | Prove the same draft can execute the pass path after the operator intentionally resolves Git/GitHub blockers. |
| GitHub sync gate | Local verifier coverage plus Codex in-app browser proof that dirty, untracked, ahead, and behind state blocks Jules with zero workers dispatched. `verify-git-preflight-blockers.mjs` covers non-repo, missing remote, wrong branch, and diverged-branch blockers without mutating the real checkout. `verify-git-disposition-workflow.mjs` and Codex in-app browser proof show a non-mutating Git disposition ledger for local-only commits, tracked edits, untracked artifacts, and remote-only commits. `verify-git-disposition-review-packet.mjs` proves the dashboard/API now exposes a read-only review packet between raw Git facts and the guarded sync plan, including required categories, blockers, evidence counts, source/generated untracked classification, allowed decisions, task links, and `/proof` board visibility. `verify-git-resolution-packet.mjs` proves the preflight also emits a read-only resolution packet with concrete local-only commits, remote-only commits, tracked files, nested untracked files, and the commands used to inspect them. `verify-git-sync-plan.mjs` proves the snapshot derives a guarded human execution plan and an execution packet from those facts and recorded dispositions without mutating Git. `verify-git-sync-execution-receipt.mjs` proves that execution packet now carries the preflight receipt, decision receipt, and safety checklist that make any human-run sync attempt auditable before Linear/Jules can start. The Codex in-app browser/API proof `git-disposition-review-2026-05-17.*` and `git-disposition-review-proof-board-2026-05-17.*` shows the real queue has four missing disposition decisions, keeps `mutatesGit: false`, and renders the review card in the in-app `/proof` board. The Codex in-app browser proof `git-sync-execution-packet-2026-05-17.*` shows the packet separates read-only commands, no exposed mutating commands while blocked, verification commands, blockers, required human confirmation, and the expected next proof. The Codex in-app browser/API proof `git-sync-execution-receipt-2026-05-17.*` shows the live dashboard packet also renders the preflight receipt, decision receipt, and safety checklist while remaining non-executable and non-mutating. | Prove the pass path after the operator intentionally resolves local Git/GitHub blockers. |
| Linear issue creation | Local verifier coverage for preflight-protected issue text, required draft fields, sync receipt, missing Linear API key/project slug blockers via `verify-linear-issue-blockers.mjs`, and non-mutating issue-packet rehearsal via `verify-linear-issue-preview.mjs`. Codex in-app browser/API proof `linear-issue-preview-2026-05-17.*` and `linear-issue-preview-proof-board-2026-05-17.*` shows the blocked queue can expose the exact future Linear issue title/body, blockers, `canCreateNow: false`, `wouldCreateLinearIssue: true`, and `mutatesExternalSystems: false` before any Linear call. | Live dashboard-created Linear issue against the intended project after Git sync passes. |
| Jules manifest staging | Local verifier coverage that staging uses the existing `.jules/orchestrator` contract, blocks when `.jules/orchestrator/cli.ts` is missing, and remains preflight-gated. `verify-jules-manifest-preview.mjs` proves blocked drafts can rehearse the exact manifest shape in memory with `canStageNow: false`, `wouldStageJulesManifest: true`, and `mutatesLocalFiles: false`. Codex in-app browser/API proof `jules-manifest-preview-2026-05-17.*` and `jules-manifest-preview-proof-board-2026-05-17.*` shows the blocked queue exposes the future `.jules/runs/.../manifest.json` packet without writing files. | Live staged manifest from a synced dashboard draft after Git and Linear gates pass. |
| Jules launch/session tracking | Local dashboard/API coverage for session, URL, state, plan approval, messages, and refresh fields. `verify-jules-launch-readiness-packet.mjs` proves a staged handoff now exposes a read-only launch readiness packet with launch URL, launch command, status command, manifest path, records path, Linear issue receipt, GitHub base commit, external/local mutation class, safety checklist, blockers, and expected post-launch proof; launched handoffs switch that packet to the session receipt and status-refresh boundary. Codex in-app browser/API proof `jules-launch-readiness-2026-05-17.*` shows real observed-PR handoffs render that launch-readiness card as blocked, with `canLaunchNow: false`, no external/local mutation path, watch-only blockers, and no false live-launch claim while Git sync remains blocked. | Live Jules session launched through the existing orchestrator. |
| GitHub PR monitoring | Local verifier coverage for PR state, checks, files, risk, mergeability, and next action. `verify-pr-next-action.mjs` now also proves failed checks and risky files expose an operator-run `gh pr comment ... --body-file ...` feedback command so PR comments can course-correct Jules work without Symphony mutating GitHub automatically. `verify-pr-comment-classification.mjs` proves comments from other review agents stay external review context unless the operator marks them with `[Jules feedback]`, and that Scout conflict comments are separated with conflict file and priority PR metadata. `verify-observed-pr-watch.mjs` proves existing GitHub PRs can be watched as `observed_pr` records without manifest staging, Jules launch, or local sync claims. `verify-observed-pr-follow-up-draft.mjs` proves historical observed PR learning creates a separate normal dashboard draft, keeps the old PR read-only, and carries "do not repair, reopen, or comment on the historical PR" wording. Live PR #900 proof (`pr-900-scout-conflict-learning-2026-05-17.*`) shows the real pattern: a closed Jules PR with 41 changed files, 0 checks, and 256 Scout conflict comments. Codex in-app browser/API proof `observed-pr-due-refresh-2026-05-17.*` shows the dashboard can watch PR #900 read-only, classify its Scout conflict lane, schedule an observed PR refresh nudge, refresh the real GitHub boundary once, and expose `Record Observed Learning` instead of a repair action. Codex in-app browser/API proof `observed-pr-follow-up-draft-2026-05-17.json` and `.md` shows PR #900 can become a separate blocked dashboard draft while the source handoff stays `observed_pr` with no manifest or launch command. | Live dashboard refresh of an active dashboard-started Jules PR is still needed, including proof that a real PR comment can be used as Jules feedback when repair is needed and other agent/Scout comments route to the correct lanes. |
| GitHub Actions/check quality | Explicit scope now allows meaningful CI improvements when they make checks more granular, faster to diagnose, less noisy, or easier for Symphony/Codex/Jules/Scout/Core to interpret. `.github/workflows/ci.yml` now has a separate `Quality Scan (advisory)` job that runs `npm run scan`, writes parseable `quality-scan.json` with `npm --silent run scan -- --json`, uploads it as the `quality-scan-json` artifact, and writes grouped counts into `GITHUB_STEP_SUMMARY`. This gives PRs human-readable and machine-readable quality-debt signal without blocking merges on known backlog debt. `verify-pr-check-artifacts.mjs` proves Symphony's PR check summary recognizes `Quality Scan (advisory)`, stores a `githubPullRequestChecks.artifacts` hint for `quality-scan-json`, preserves the optional GitHub check `detailsUrl`, and renders that artifact plus the GitHub step-summary note and `Open check details` link in the PR readiness panel. `github-actions-quality-2026-05-17.json` records the inspection result: `npm run scan` passes and reports 591 grouped findings, the JSON artifact command parses, while `npm run validate` currently fails on existing strict charset data issues and was intentionally not added as a noisy blocker. Live PR #929 proof (`pr-929-quality-scan-github-2026-05-17.*`) shows the new check completed successfully on GitHub and uploaded the `quality-scan-json` artifact. Codex in-app browser/API proof `observed-pr-watch-dashboard-2026-05-17.*` shows Symphony can watch PR #929 read-only and carry the live `quality-scan-json` artifact in dashboard state. | Refresh an active dashboard-started PR through Symphony so the dashboard renders the real GitHub artifact hint and check details link inside the full Jules handoff path. |
| Conflict-prone files | Local verifier and screenshot coverage for overlap/risk panels. | Live overlap or risk case from active handoffs, or a documented real blocker if none is appropriate. |
| Scout/Core readiness | `verify-scout-core-readiness-packet.mjs` proves each handoff now exposes a read-only Scout/Core readiness packet with PR state, checks, file risk, Scout conflict counts, external/Jules feedback counts, dashboard-started-vs-observed ownership, refresh URL, Scout review command, Core validation/merge commands only when ready, mutation flags, blockers, safety checklist, expected proof, and `/proof` visibility for ready, risky, waiting, merged, and observed PR states. | Live Scout/Core review state connected to a real dashboard-started Jules PR. |
| Local sync | Local verifier coverage for post-merge fast-forward gating. `verify-local-sync-next-action.mjs` proves each local checkout state resolves to one readable next action. `verify-local-sync-readiness-packet.mjs` proves each handoff now exposes a read-only local-sync readiness packet with PR merge state, dashboard-started-vs-observed ownership, local commit evidence, refresh URL, guarded sync URL, safety checklist, expected proof, and mutation flags. The same verifier protects `/proof` visibility for safe, blocked, and observed PR local-sync states without exposing a sync URL for blocked or observed records. | Live post-merge sync readiness, with the mutating sync action exposed only when safe. |
| Worker designation and dispatch gate | Local verifier and dashboard screenshot coverage for worker identity and roster. `verify-dashboard-only-mode.mjs` and `verify-dispatch-control-toggle.mjs` prove startup defaults to dispatch paused, `/api/v1/dispatch-control` reports backend state, normal startup does not poll or launch workers until enabled, and enabling the backend gate resumes the existing mock assignment path. | Live worker roster during a real foreman run after the operator enables dispatch. |
| Worker model/thinking assignment | Local verifier coverage plus Codex in-app browser proof that unset values display as defaults. `verify-worker-mode-packet.mjs` proves routing now emits a dynamic worker-mode packet for `operator_only`, `local_fast`, `local_careful`, `jules_task`, `jules_plan`, and `observe_wait`, including model/reasoning recommendation, dispatchability, complexity signals, reasons, and explicit `codex.model` / `codex.reasoning_effort` override policy. Codex in-app browser proof `symphony-worker-mode-packet.png` shows the current blocked dashboard rendering the packet as `operator_only`, with `none` model/reasoning and no dispatch while Git disposition is blocked. | Prove the recommended mode feeds an actual worker launch after Git sync allows dispatch. |
| Task routing and nudging | `verify-task-routing-nudging.mjs` covers blocked queues, small local-agent recommendations, Jules planning recommendations, and pause-aware nudge cadence in the task-intake API. `verify-task-nudge-ledger.mjs` proves the routing decision can be recorded as durable task-tracking evidence with pause cadence, next nudge time, and `mutatesExternalSystems: false`. `verify-task-nudge-scheduler.mjs` proves recorded nudges are classified as due, waiting, or operator-blocked and include explicit foreman action packets with method, endpoint, safety class, runnable state, and `mutatesExternalSystems: false`. `verify-task-nudge-due-refresh.mjs` proves a foreman wake-up can run due external-read nudges for Jules/GitHub/local-sync boundaries while skipping local-state actions that still need operator intent. Dashboard rendering exposes the recommendation, next action, pause duration, candidate routes, record button, task nudge ledger, nudge scheduler, action packet, run-due-refresh button, and due refresh receipt. Codex in-app browser proof `task-routing-nudging-2026-05-17.*` shows the live dashboard waits instead of assigning Jules or local Codex while the GitHub sync gate is blocked. Codex in-app browser proof `task-nudge-ledger-2026-05-17.*` shows the live dashboard records that blocked-Git wait as ledger evidence without mutating external systems. Codex in-app browser proof `task-nudge-scheduler-2026-05-17.*` shows the live scheduler classifies that record as operator-blocked instead of due. Codex in-app browser proof `task-nudge-action-packet-2026-05-17.*` shows the live scheduler action packet for the blocked Git wait: method `NONE`, safety `operator_only`, `canRunNow: false`, and no external mutation. Codex in-app browser proof `task-nudge-due-refresh-2026-05-17.*` shows the live dashboard/API exposes the due-refresh runner and correctly performs no refresh while the real queue has 0 due records and 1 operator-blocked Git-sync record. Codex in-app browser/API proof `observed-pr-due-refresh-2026-05-17.*` shows the same due-refresh runner against a real GitHub PR boundary: one due `refresh / github_pr` nudge for observed PR #900 produced one PR refresh, zero skipped actions, and `mutatesExternalSystems: false`. | Prove the due-refresh runner against a real dashboard-started Jules/GitHub boundary after Git sync allows a handoff to start. |
| Dashboard foreman-console focus | Current screen-space inventory is documented in this spec so dashboard work can decide what becomes primary, grouped, collapsed, or moved to `/proof`. The dark/light mode toggle is restored in the header and guarded for browser storage limitations and verifier DOM shims. `verify-dashboard-foreman-console.mjs` proves the main dashboard now renders a first-class Current Foreman Boundary panel before grouped detail sections for Git Safety, Jules Lifecycle, PR Review And Local Return, and Task Intake And Records while preserving Save Draft, Watch Existing PR, GitHub Sync Gate, handoff status board, and tracked records. `verify-dashboard-density.mjs` proves idle Usage Tracker, Routine Approval Rules, Running Issues, and Retrying Issues render as compact summary drawers, while warning/danger usage, pending approvals, running workers, and retrying issues stay prominent. Codex in-app browser proof `symphony-foreman-console.png` shows the live dashboard renders the current boundary first and keeps the large detail groups collapsed by default; `symphony-dashboard-density.png` shows the idle lower monitoring sections collapsed below that boundary. | Continue refining density without losing safety packets or controls. |
| Approvals | Local verifier coverage for worker approval panels, auto-approval explanation, and Jules plan approval routes. | Live approval or plan-approval event, or a documented external blocker. |
| Usage/spending | Local verifier coverage for token, rate-limit, retained activity, and credit display shapes. | Live Codex usage/rate-limit event from an active worker. |
| Documentation/spec/audit | README, this spec, audit, and verifiers now point to the spec-centered goal. The audit is the live Markdown status file that lists task areas, goalposts, status, achieved/not-achieved state, blockers, remaining proof, and evidence paths. `verify-proof-board.mjs` now protects a compact `/proof` page that reuses task-intake state, links back to this spec and audit, and exposes the latest Linear issue, Jules manifest, and handoff-readiness previews. | Keep audit current after every live proof slice. |
| Browser constraint | Codex in-app browser proof artifacts exist for dashboard-only preflight and intake. The compact `/proof` board gives the in-app browser a small, script-free follow-along surface for queue action, Git sync state, Git disposition review, latest draft/handoff, Linear issue preview, Jules manifest preview, handoff readiness, middleman path, foreman action, nudge state, worker snapshot, and evidence links. Live proof `proof-board-2026-05-17.json` and `.md`, `linear-issue-preview-proof-board-2026-05-17.*`, `jules-manifest-preview-proof-board-2026-05-17.*`, `handoff-readiness-proof-board-2026-05-17.*`, `git-disposition-review-proof-board-2026-05-17.*`, `middleman-path-2026-05-17.*`, `foreman-action-packet-2026-05-17.*`, `symphony-foreman-console.png`, `symphony-dashboard-density.png`, and `symphony-worker-mode-packet.png` shows the Codex in-app browser loaded the relevant dashboard/proof surfaces and saw the expected status fields. | Continue using only the in-app browser for follow-along live checks. |
| Full end-to-end path | Not complete. Current live proof covers preflight-blocked dashboard intake, read-only observed PR monitoring for PR #900 and PR #929, one real observed-PR due refresh against PR #900, a separate dashboard draft created from PR #900 learning without repairing that historical PR, non-mutating Git disposition review for the blocked queue (`git-disposition-review-2026-05-17.*`), non-mutating Git sync execution receipt for that blocked queue (`git-sync-execution-receipt-2026-05-17.*`), non-mutating Linear issue preview for that blocked draft, Jules manifest preview for that blocked draft, non-mutating handoff-readiness packet for that blocked draft (`handoff-readiness-2026-05-17.*`), blocked launch-readiness cards for real observed-PR handoffs (`jules-launch-readiness-2026-05-17.*`), one global middleman path that preserves the current Git boundary and keeps observed PRs out of launch/local-sync claims (`middleman-path-2026-05-17.*`), a current-boundary foreman action packet for operator-owned Git disposition (`foreman-action-packet-2026-05-17.*`), local `verify-middleman-foreman-pass-path.mjs` proof that the same packet will pick the correct future foreman action and evidence endpoint across Linear/Jules/GitHub/local-sync boundaries, local `verify-scout-core-readiness-packet.mjs` proof that the GitHub PR review boundary separates read-only Scout/Core evidence from explicit Core merge, local `verify-local-sync-readiness-packet.mjs` proof that the final local-sync boundary separates read-only refresh evidence from guarded Git mutation, and compact proof-board follow-along state for the blocked queue. | Real dashboard-started task must pass sync, create/link Linear, stage/launch Jules, produce/refresh PR, expose Scout/Core readiness, and prove local sync. |

## Verification Commands

The baseline contract command is:

```powershell
npm.cmd run verify:jules-contract
```

When TypeScript signatures, shared config, state, hooks, or utility files are
changed, also attempt the repository dependency visualizer sync required by
`AGENTS.md`. If that tool reports the Symphony path is outside its dependency
map, record that result rather than treating it as success.

After major verification, attempt `/session-ritual`. If the command is not
installed in this shell, record that it was unavailable.

## Completion Criteria

The work is not complete until all of the following are true:

1. All scenarios above either work or have an explicit documented blocker.
2. `npm.cmd run verify:jules-contract` passes.
3. The dashboard has been inspected in the Codex in-app browser.
4. A real dashboard-started task has moved through Linear, existing Jules
   orchestration, GitHub PR state, Scout/Core readiness, and local sync proof,
   or the precise external blocker is captured with evidence.
5. The completion audit maps every active requirement to current evidence.
6. The completion audit/status file shows each major goalpost as achieved or
   not achieved, with the blocker and remaining proof for anything incomplete.
7. The active goal can be summarized as "satisfy this spec and audit," not a
   static ever-growing prompt.
