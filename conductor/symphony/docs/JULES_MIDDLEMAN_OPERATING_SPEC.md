# Symphony/Jules Middleman Operating Spec

This is the canonical operating spec for evolving Symphony into Aralia's
dashboard-first middleman between Codex workers, Google Jules, GitHub, Linear,
the local repository, tests, documentation, and completion evidence.

Use this file as the stable scope reference. The active thread goal should point
here instead of carrying every scenario inline. The audit file records evidence
and live task status; this spec defines what the system must handle.

## Table Of Contents

- 1. [Core Intent](#core-intent)
  - 1.1 [What Symphony Is](#what-symphony-is)
  - 1.2 [End-To-End Operator Path](#end-to-end-operator-path)
  - 1.3 [Codex And Jules Roles](#codex-and-jules-roles)
  - 1.4 [Waits, Nudges, And Routing](#waits-nudges-and-routing)
  - 1.5 [Live Browser Inspection](#live-browser-inspection)
  - 1.6 [Task-Centered Dashboard](#task-centered-dashboard)
  - 1.7 [Current Task-Page Baseline](#current-task-page-baseline)
  - 1.8 [Human Direction And Quiet Hours](#human-direction-and-quiet-hours)
  - 1.9 [Active Goal Scope](#active-goal-scope)
  - 1.10 [Approval Scope](#approval-scope)
  - 1.11 [Approval Boundaries](#approval-boundaries)
  - 1.12 [Workflow Phases](#workflow-phases)
- 2. [System Boundaries](#system-boundaries)
- 3. [Task Scenarios To Cover](#task-scenarios-to-cover)
  - 3.1 [Dashboard Intake](#dashboard-intake)
  - 3.2 [Linear Issue Creation](#linear-issue-creation)
  - 3.3 [Jules Handoff Staging](#jules-handoff-staging)
  - 3.4 [Jules Launch And Session Tracking](#jules-launch-and-session-tracking)
  - 3.5 [GitHub PR Monitoring](#github-pr-monitoring)
  - 3.6 [GitHub Pages Deployment Verification](#github-pages-deployment-verification)
  - 3.7 [GitHub Actions And Check Quality](#github-actions-and-check-quality)
  - 3.8 [Scout/Core Review And Merge Readiness](#scoutcore-review-and-merge-readiness)
  - 3.9 [Local Sync](#local-sync)
  - 3.10 [Worker Assignment](#worker-assignment)
  - 3.11 [Task Routing And Nudging](#task-routing-and-nudging)
  - 3.12 [Dashboard Foreman Console](#dashboard-foreman-console)
  - 3.13 [Human Blockers And Quiet Hours](#human-blockers-and-quiet-hours)
  - 3.14 [Handoff Timeline](#handoff-timeline)
  - 3.15 [Approvals](#approvals)
  - 3.16 [Usage And Spending](#usage-and-spending)
  - 3.17 [Delegation ROI Ledger](#delegation-roi-ledger)
  - 3.18 [Documentation Creation](#documentation-creation)
- 4. [Blockage Scenarios To Cover](#blockage-scenarios-to-cover)
  - 4.1 [Git And GitHub Blockers](#git-and-github-blockers)
  - 4.2 [Draft And Issue Blockers](#draft-and-issue-blockers)
  - 4.3 [Jules Blockers](#jules-blockers)
  - 4.4 [GitHub PR Blockers](#github-pr-blockers)
  - 4.5 [Scout/Core Blockers](#scoutcore-blockers)
  - 4.6 [Local Sync Blockers](#local-sync-blockers)
  - 4.7 [Worker And Runtime Blockers](#worker-and-runtime-blockers)
  - 4.8 [Test And Documentation Blockers](#test-and-documentation-blockers)
- 5. [Required Evidence](#required-evidence)
  - 5.1 [Scenario Coverage Matrix](#scenario-coverage-matrix)
- 6. [Verification Commands](#verification-commands)
- 7. [Completion Criteria](#completion-criteria)

## Core Intent

### What Symphony Is

Symphony is not a second cloud coding system. Symphony is the local dashboard,
gatekeeper, and foreman coordinator around the existing Aralia Jules workflow.

### End-To-End Operator Path

The intended path is:

1. Draft bounded work in Symphony.
2. Prove GitHub is ready for cloud work.
3. Let a Codex foreman clarify the task into a plain-language plan.
4. Create or connect the Linear tracking issue.
5. Stage a Jules manifest through the existing `.jules/orchestrator`.
6. Launch or refresh Jules.
7. Watch the GitHub PR.
8. Route Scout/Core review.
9. Verify GitHub Pages deployment after merge when the application publishes
   there.
10. Sync local master only after merge and deployment proof.

See [Workflow Phases](#workflow-phases) for the owner, evidence, mutation
boundary, worker mode, and completion receipt for each phase.

GitHub Actions checks are part of that foreman surface. Symphony may improve CI
when the change gives operators and agents faster, clearer, more actionable
failure signals instead of merely rearranging check names.

### Codex And Jules Roles

Codex workers launched by Symphony are foremen. Their default job is to prepare
bounded Jules handoffs, monitor Jules and GitHub, explain blockers, and update
the dashboard/Linear trail. They should not become broad local implementers
unless the operator explicitly asks for local-only work.

### Waits, Nudges, And Routing

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

### Live Browser Inspection

Live dashboard inspection must use the built-in Codex app browser so the user
can follow along. External Chrome/Chromium windows are not the live inspection
surface for this workflow. The current reliable route is the Codex Browser
plugin's in-app browser bridge. A direct Playwright MCP call can fail with
`Transport closed` in this app session, but that does not prove Jules is
unobservable: the Browser plugin bridge can still list the already-open Jules
tab, read visible page text, and capture screenshots inside the in-app browser.

### Task-Centered Dashboard

The intended operator experience is task-centered. The dashboard should let the
operator see all tasks, open tasks, tasks waiting for human input, completed
tasks, archived tasks, and abandoned tasks. Each task should have its own detail
view with a status timeline, timestamps, current boundary, Jules prompt,
Jules/Codex dialogue records when available, Linear and GitHub links, and a chat
surface for the Codex foreman assigned to that task. Any question for the
operator should be written in human language and posted through the task view,
not hidden in a terminal transcript.

If the visible task message or operator-answer forms cannot receive text input
because the virtual clipboard in the Codex/Playwright in-app browser is not
installed or accessible, the operator or agent may interact directly with the
backend endpoints, such as `POST /api/v1/tasks/:id/messages` or
`/clarifications`, via command-line HTTP calls. Recording the receipt locally
through the backend API preserves the dashboard-first evidence path.

### Current Task-Page Baseline

The current baseline for that task-centered view is a read-only `Task navigator`
on the dashboard. It is derived from the same draft and handoff snapshot as the
existing cards, counts all/open/completed/archived records plus tasks needing
human input, filters the list by those buckets as a display preference, and
links to the existing detailed card instead of creating a separate task truth.
It now also renders a compact read-only `Task detail` preview for the first
visible task, showing current boundary, update time, timeline count,
expected-file count, verification-command count, and Linear/Jules/GitHub links
when present. `verify-task-dashboard-navigator.mjs` protects this as a dashboard
contract. The preview links to `/tasks/:id`, the first standalone task page,
and to `GET /api/v1/tasks/:id`, a non-mutating single-task JSON endpoint
protected by `verify-task-detail-api.mjs`. The JSON endpoint returns one draft
or handoff detail packet with the current boundary, timeline, attached
Linear/Jules/GitHub links, operator-question state, ROI ledger, readiness
packets, stored local task messages, local task disposition when present,
local `clarificationState`, `taskMessages`, `taskClarifications`, and
`taskDisposition` links, and explicit
non-mutation flags. The page is protected by `verify-task-detail-page.mjs` and
renders the same facts as a task workspace with current boundary, safety flags,
task links, local messages, timeline, scope, verification, a read-only Jules
handoff prompt packet, a read-only Jules dialogue/approval history packet, and
expandable readiness packets. The preview and task page also have local-only `Task message`
forms backed by `POST /api/v1/tasks/:id/messages` and protected by
`verify-task-message-api.mjs`; they record operator-to-Codex notes in the
Symphony task store and do not send Jules feedback, create Linear/GitHub
records, or mutate local Git. Structured foreman clarification questions are
backed by `POST /api/v1/tasks/:id/clarifications` and protected by
`verify-task-clarification-api.mjs`; they record the question and optional
operator answer as local task state so the dashboard can mark work as waiting
for clarification before it crosses into Linear or Jules. `verify-task-detail-page.mjs`
also protects the first task-page `Task Clarifications` form for that same local
path. Local task filing is
backed by
`POST /api/v1/tasks/:id/disposition` and protected by
`verify-task-disposition-api.mjs`; it can mark work active, completed,
archived, or abandoned as dashboard state only. The standalone task page now
also exposes the local-only operator-answer and repair-push-result actions for
handoffs through the existing guarded endpoints. `verify-task-detail-api.mjs`
protects the `operatorAnswer` task link, and `verify-task-detail-page.mjs`
protects the rendered `Record Operator Answer` and `Record Repair Push Result`
forms. These forms record local receipts only; they do not execute repair lanes,
send Jules feedback, push to GitHub, rerun checks, merge, pull, or edit local
files. The task detail packet and page now also render a read-only `Approval
Checkpoint` that summarizes the current operator question, latest local answer
when present, the still-external guarded command, and the next proof receipt
without approving or running anything. The task detail packet now also exposes
the existing GitHub PR check summary and PR check/view commands as read-only
task fields, and the task page renders those fields as `PR Checks And Repair`.
That card keeps the current check conclusion, failed/pending counts, prepared
repair freshness, individual failed check names plus their details links when
available, local verification, operator-owned push command, and after-push
check/refresh instructions visible without pushing, rerunning checks, commenting
on GitHub, merging, or editing local files. The task page now also renders a
readable `ROI Evidence` summary from the same `delegationRoiLedger` packet so
the operator can see missing task-scoped usage receipts, missing avoided-work
estimates, and broad goal-context usage without opening raw JSON. That card must
keep goal-context usage as context only; it does not count as measured task
spend or unlock a savings claim. The task page now also renders a readable
`Deployment And Local Sync` summary from the existing `deploymentReadiness` and
`localSyncReadiness` packets so the operator can see whether deployment proof
can be checked, whether local repo sync is still blocked, which blockers remain,
and whether the later sync command would mutate Git without opening raw JSON.
This is only a visibility layer over existing gates; it does not create
deployments, waive deployment proof, merge, pull, or edit local files. The task
page now also renders a view-only
`Task Activity Mirror` from the same durable task timeline, local messages, and
clarifications. Richer external task actions beyond these local receipts remain
open implementation work.

### Human Direction And Quiet Hours

When a task needs human direction, the Codex foreman should stop at the
dashboard question rather than busy-looping. The foreman may schedule a later
wake-up or leave the task waiting, especially during operator-configured quiet
hours. The default quiet window remains weekday nights from 01:00 to 09:00
Europe/Amsterdam, but the dashboard should let the operator adjust or disable
that local waiting policy. The wake-up should refresh the boundary state and
check for an operator reply; it should not keep running a tight background
script while blocked on the human.

### Active Goal Scope

The current active goal is the full **Symphony delegation workflow** outcome:
Symphony should be the local dashboard where Codex acts as a foreman, clarifies
tasks, creates or updates Linear tracking, stages and launches Jules work,
follows Jules through planning, execution, PR creation, GitHub checks,
deployment state, repair or feedback sequencing, merge readiness, and local repo
sync after merge. The workflow must also include a task-level Delegation ROI
ledger that measures whether delegating to Jules reduces Codex usage while
clearly separating measured facts from estimates. The implementation, workflow
intent, audit, architecture overview, and ordered task documents must stay
current as each proof stage advances. Dashboard foreman-console focus,
default-off dispatch, task routing, and worker-mode recommendation are
supporting slices of that larger end-to-end proof, not the whole goal.

### Approval Scope

Approval wording in that goal is intentionally scoped to operator-owned
workflow boundaries. An operator-approved mutation is an external or
workflow-advancing action that affects Linear, Jules, GitHub, PR branches,
deployment waivers, local master sync, or user-visible task decisions. It does
not include ordinary local implementation hygiene inside the active Symphony
workstream: documentation edits, verifier updates, local API/dashboard code
changes, local verifier runs, or local checkpoint commits that do not push,
launch, merge, sync, contact external systems, or claim a live workflow boundary
has advanced. Those local hygiene changes still need normal review discipline,
but they are not a blocker waiting for operator approval.

### Approval Boundaries

This table is the canonical approval-boundary list for Symphony/Jules work.
Other Symphony docs should link back here instead of maintaining competing
approval lists.

| Boundary | Approval required before | Why it is guarded | Local-only receipt after action |
|---|---|---|---|
| Linear issue creation or update | Creating a Linear issue, changing Linear status, or posting Linear status comments | Mutates the external tracking system and changes user-visible work state | Linear issue receipt or status-comment receipt |
| Jules manifest staging | Writing or updating `.jules/orchestrator` handoff material for cloud work | Prepares external cloud execution input and can change what Jules will run | Handoff manifest/staging receipt |
| Jules launch or session action | Launching Jules, approving a Jules plan, sending Jules chat, or using Jules API actions such as `approvePlan` or `sendMessage` | Starts or redirects cloud implementation work | Jules launch, plan approval, or operator-message receipt |
| GitHub PR feedback | Posting `gh pr comment ...`, especially marked `[Jules feedback]` comments | Mutates PR discussion and can redirect Jules or reviewers | PR feedback command/receipt |
| GitHub PR branch update | Pushing, applying, force-updating, or otherwise changing a PR branch, including the PR #931 setup repair | Mutates GitHub source state and reruns or invalidates CI evidence | `repairPushResult` or equivalent PR-update receipt |
| GitHub CI mutation | Manually rerunning Actions, cancelling runs, changing workflow state, or editing CI files as the chosen live repair | Mutates GitHub check state or workflow behavior | Check-rerun or CI-repair receipt |
| Scout/Core validation or merge | Running Core validation as a merge gate, approving Core merge, or merging a PR | Advances merge readiness or mutates the protected branch | Scout/Core readiness, validation, or merge receipt |
| Deployment waiver or repair | Waiving deployment proof, rerunning deployment, or changing deployment configuration | Changes the evidence required before local sync or mutates deployment state | `deploymentEvidence` receipt |
| Local repository sync | Pulling, fast-forwarding, merging, rebasing, or otherwise syncing local master after merge | Mutates local Git and possibly local files | Local sync readiness/execution receipt |
| User-visible task decision | Choosing a repair lane, approving/rejecting a repair push, archiving/completing/abandoning a task, or changing quiet-hour policy | Changes the operator-visible workflow path even when stored locally | `operatorAnswers`, task disposition, or preference receipt |

These actions do **not** need operator approval by themselves: local docs edits,
verifier updates, local dashboard/API code changes, local verifier runs,
read-only GitHub/Jules/Linear inspection, read-only Symphony refreshes, rendered
local dashboard verification, and local checkpoint commits that are not pushed
and do not claim a live boundary has advanced.

For the current ARA-6 end-to-end test flow, the operator has explicitly allowed
Symphony/Codex to assume approval at each phase boundary so the workflow can be
proven without stopping at every gate. That permission is scoped to this test
flow and does not remove the approval-boundary model. Each assumed approval must
produce a decision report entry that states the phase, decision point, available
options, decision made by the agent, evidence/rationale, resulting mutation or
non-mutation, and next expected proof. The purpose is to make the agent's
decision behavior inspectable after the run.

### Workflow Phases

This table is the canonical phase list for the dashboard-created
Symphony/Jules path. Other Symphony docs should link back here instead of
maintaining competing phase lists. The global `middlemanPath` packet exposes the
same ordered ladder in `/api/v1/task-drafts`; task timelines may add finer
receipt events inside these phases.

| Phase id | Owner | Purpose | Read-only evidence | Mutation boundary | Typical worker mode | Completion receipt |
|---|---|---|---|---|---|---|
| `git_sync` | Local repository / Symphony | Prove the local branch can safely feed cloud work | Git preflight, disposition review, resolution packet, sync plan | Human-owned local Git sync, commit, push, or disposition decision | `operator_only` while blocked; `observe_wait` for read-only checks | Clean preflight or Git sync execution receipt |
| `linear_issue` | Linear / Symphony | Create or connect human-readable tracking | Linear issue preview, existing issue lookup, handoff readiness packet | Create/update Linear issue or status comment | `operator_only` at mutation; `observe_wait` for preview | Linear issue receipt or linked issue id |
| `jules_manifest` | Symphony / `.jules/orchestrator` | Stage the bounded Jules handoff | Manifest preview with write scope and verification commands | Write/update `.jules/orchestrator` handoff material | `operator_only` at mutation; `local_careful` for local setup repair drafts | Manifest/staging receipt |
| `jules_launch` | Jules / Symphony | Start cloud implementation from the staged handoff | Launch readiness packet, safety checklist, Linear/Git receipt | Launch Jules session | `operator_only` at mutation | Jules launch/session receipt |
| `jules_session` | Jules / Symphony | Track plan, execution, messages, PR output, and reconciliation | Jules API/browser state, `julesStateReconciliation`, prompt/dialogue packets | Approve plan, send Jules message, or otherwise direct Jules | `observe_wait` for reads; `operator_only` for plan/message actions | Plan approval, message, session refresh, or PR-discovery receipt |
| `github_pr` | GitHub / Symphony | Monitor PR state, checks, files, feedback, and repair choices | PR refresh, checks, failed check names, file risk, comments, repair decision/readiness | PR comment, branch push/apply, check rerun, workflow repair | `observe_wait` for refresh; `local_careful` for local setup repair; `operator_only` for GitHub mutations | PR refresh, feedback, repair push, or check-rerun receipt |
| `scout_core` | Scout/Core / Symphony | Decide review, risk, validation, and merge readiness | Scout/Core readiness packet, conflict comments, risk/file scope | Core validation, Core approval, or merge | `observe_wait` for reads; `operator_only` for validation/merge | Scout/Core validation or merge receipt |
| `deployment` | GitHub Pages/deployment system / Symphony | Prove published-app health before local sync when relevant | `deployment_readiness`, Pages build/deployment/status inspection commands | Deployment repair, rerun, or deployment-proof waiver | `observe_wait` for inspection; `operator_only` for waiver/repair | `deploymentEvidence` receipt |
| `local_sync` | Local repository / Symphony | Bring local master/worktree up to the merged, deployed state | `local_sync_readiness`, dirty/ahead/behind/fast-forward checks | `git pull --ff-only`, merge, rebase, or other local sync | `operator_only` at mutation | Local sync execution receipt |

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
8. A Codex foreman may turn a rough draft into a clearer plan before Linear
   issue creation. Clarifying questions, answers, task boundaries, and the final
   operator-approved handoff plan should stay attached to the task record.

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
5. Plan approval is visible and actionable whenever either stored state or
   browser inspection shows Jules is waiting for approval. Stored state is not
   enough by itself: the ARA-6 live run showed local status can report
   `COMPLETED` with no PR URL while Jules API/browser/GitHub evidence exposes
   additional task state.
6. When a Jules API key is available, Symphony should prefer the official Jules
   REST API `GetSession` and activity responses before browser scraping. Jules'
   current public API docs describe the API as alpha, use `X-Goog-Api-Key` for
   authentication, describe sessions as the continuous unit of work, activities
   as per-session agent/user events, `approvePlan` and `sendMessage` as explicit
   operator-style session actions, and session outputs as the place where an
   automatically created PR can appear. The ARA-6 session API returned
   `state: COMPLETED` plus a PR output for
   `https://github.com/Gambitnl/Aralia/pull/931`, even though local Symphony
   status still lacked `pullRequestUrl`.
7. If the API is unavailable or contradicts the visible web session, Symphony
   should visually reconcile the session through the Codex app browser before
   treating the boundary as complete. The intended browser path is the Browser
   plugin's in-app bridge; terminal Playwright is acceptable for repeatable
   local dashboard verification but is not the operator-visible Jules
   follow-along surface.
8. If stored Jules state still has no PR URL after API/browser reconciliation, Symphony
   should also perform a read-only GitHub fallback lookup by Jules session id,
   generated branch name, handoff title, or Linear issue. The ARA-6 run created
   PR #931 even though the local Jules/Symphony record still did not expose
   `pullRequestUrl`.
9. Handoff snapshots should expose a read-only `julesStateReconciliation` packet
   that explains which source settled the state mismatch. When Jules API or a
   GitHub fallback finds a PR after the local Jules record was incomplete, the
   packet should say `reconciled_from_external_evidence`; when stored Jules state
   says `COMPLETED` and no PR is captured, it should say
   `needs_browser_reconciliation` and point the foreman at Codex app browser or
   Jules API proof before claiming the boundary is complete.

### GitHub PR Monitoring

1. Dashboard tracks PR URL, PR number, state, draft flag, mergeability, checks,
   changed files, labels, and timestamps.
2. PR refresh is read-only.
3. Failed checks produce an action to repair or wait, not a merge action.
4. Draft PRs are not presented as merge-ready.
5. Missing PRs produce a clear "wait for Jules PR" state.
5a. A missing stored PR URL is not the same as a missing GitHub PR. Symphony
   should check GitHub for matching Jules branches or session ids before telling
   the operator that Jules has not created a PR.
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

### GitHub Pages Deployment Verification

1. For Aralia changes that affect the published application, merge is not the
   final cloud boundary.
2. After the PR is merged, Symphony should observe the GitHub Pages deployment
   state before local sync is treated as complete.
3. The deployment check is read-only unless the operator explicitly authorizes a
   repair path.
4. A failed or missing deployment should become a task blocker with a clear next
   action, not be buried under a successful PR merge.
5. Each handoff should expose a `deployment_readiness` packet before local sync.
   The packet may point at read-only GitHub Pages build/deployment and general
   deployment-status queries, but it must not create deployments, rerun Actions,
   mutate GitHub, pull Git, or edit local files.
6. The packet should be available both inside task/handoff snapshots and through
   `GET /api/v1/jules-handoffs/:id/deployment-readiness`, with `/tasks/:id`
   exposing the same URL as `links.deploymentReadiness`. This gives foremen a
   stable read endpoint without turning deployment inspection into an automatic
   GitHub mutation.
7. Local sync should remain blocked until deployment evidence exists or the
   operator explicitly waives this gate for a task where published-app health is
   irrelevant.
8. Deployment success, failure, or waiver should be recorded as local
   `deploymentEvidence`. This receipt must include a status, source, summary,
   optional evidence URL, checked time, recorder, and non-mutation flags.
9. `deploymentEvidence.status: passed` and `deploymentEvidence.status: waived`
   are the only states that can unlock the local sync readiness action. A failed
   or missing receipt keeps local sync blocked.

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
6. Environment/setup failures should be separated from Jules implementation
   failures. In the ARA-6 PR #931 run, build, lint, tests, and the advisory
   quality scan all failed before task-specific validation because `npm ci`
   detected a `package.json` / `package-lock.json` mismatch. The review check
   also failed because the Gemini workflow referenced unavailable
   `gemini-1.5-flash`. Symphony should report those as workflow/setup blockers,
   not as proof that Jules wrote the regression incorrectly.
7. Jules environment snapshots are useful only when the setup script is honest
   about the slice being delegated. Prefer `npm ci --no-audit --no-fund` and
   task-scoped validation over hiding repository health problems. For Spell
   Phase 1 Package 2, the broad `npm run typecheck` setup failed in a clean
   Jules clone because repo-wide tracked-clone typecheck debt still exists, but
   the accepted scoped snapshot passed `npm ci --no-audit --no-fund`,
   `npm run validate:spells`, and
   `npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose`.
   Any future `npm install` setup script remains diagnostic and should be
   recorded before use because it may update lockfile state inside Jules'
   working copy.
8. When the operator chooses `create_setup_repair_task`, the resulting
   setup-repair draft becomes the next actionable task-routing subject and
   should be handled as local-careful Codex work before Symphony sends further
   Jules feedback.
9. Jules setup scripts and snapshots should be informed by official Jules
   environment docs: Jules tasks run in short-lived Ubuntu VMs, common tools
   such as Node.js/npm/rg are preinstalled, the documented VM baseline currently
   includes Node 22.16.0 and npm 11.4.2, and `Run and Snapshot` saves a
   successful setup for later tasks. Symphony should record those assumptions as
   current external documentation, but running a snapshot remains an
   operator-approved external action.
10. Symphony exposes that decision as a read-only local packet at
    `GET /api/v1/jules-environment-setup` and on `/proof` as `Jules Environment
    Setup`. The packet must show `package2_scoped_snapshot_passed`, the accepted
    Package 2 scoped setup recommendation, the broader diagnostic typecheck
    script, the failed and passed evidence screenshots, and the next expected
    proof: submit `docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json`
    to `POST /api/v1/task-drafts` and dispatch Jules with the exact Package 2
    prompt. This packet does not query Jules or run the setup script; after the
    Package 2 snapshot pass, it keeps the next workflow boundary visible without
    claiming repo-wide typecheck health.

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
2. For published application changes, local sync waits until GitHub Pages
   deployment health is known or explicitly waived.
3. Local sync checks current branch, dirty worktree, ahead/behind, and
   fast-forward possibility.
4. Mutating sync action is exposed only when `git pull --ff-only` is safe.
5. Dirty local work never gets overwritten silently.
6. If sync is blocked, dashboard names the exact local blocker.

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
6. The task list should support at least all, open, waiting for operator,
   completed, archived, and abandoned views.
7. A task detail view should show the task description, current boundary,
   chronological stage timeline, Linear issue, Jules session, GitHub PR,
   deployment state when relevant, local sync state, expandable Jules prompt,
   expandable Codex/Jules dialogue, and a task-scoped Codex chat surface.
   The current baseline derives a read-only `handoffTimeline` from stored
   handoff facts and renders it as `Task timeline` on handoff cards, exposes
   `GET /api/v1/tasks/:id` as the single-task read API, serves `/tasks/:id` as
   the first standalone task page, records local-only task messages through
   `POST /api/v1/tasks/:id/messages`, records structured local-only
   clarification questions and answers through
   `POST /api/v1/tasks/:id/clarifications`, and renders read-only Jules
   prompt/dialogue packets. It also records local task filing through
   `POST /api/v1/tasks/:id/disposition` so abandoned or archived work can leave
   the active queue without mutating outside systems. Richer external task
   actions remain open.
8. The home page should make pending human-input tasks obvious, including a
   count badge or equivalent compact indicator.
9. A terminal-simulator pane may mirror a live local Codex foreman process or
   command stream when that helps the operator follow along, but it is a view
   onto task activity, not the canonical memory. Task questions, operator
   answers, decisions, blockers, and timestamps must still be stored as
   structured task events so future agents can resume without scraping terminal
   scrollback. The current baseline is a read-only `Task Activity Mirror` on
   `/tasks/:id` that renders timeline events, task messages, and clarifications
   in terminal-style order without reading terminal scrollback or mutating
   external systems.

### Human Blockers And Quiet Hours

1. When a handoff needs a human decision, Symphony should expose one
   plain-language `operatorQuestion` packet instead of burying the blocker in
   raw PR or workflow terminology.
2. The packet is read-only evidence. It must report `mutatesExternalSystems:
   false` and `mutatesLocalFiles: false`.
3. The default quiet-hours policy is weekday 01:00-09:00 Europe/Amsterdam. During that window, the packet should set `canNotifyNow: false` and `nextCheckAt` to the next 09:00 local check time rather than running a tight wait loop. To prevent timezone conversion bugs, the orchestrator translates Europe/Amsterdam boundaries (CET/CEST) to UTC:
    - During standard winter time (CET, UTC+1): Weekday quiet window is 00:00 UTC to 08:00 UTC.
    - During daylight summer time (CEST, UTC+2): Weekday quiet window is 23:00 UTC (previous day) to 07:00 UTC.
    The orchestrator must dynamically resolve the offset based on the active UTC timestamp.
4. Operator quiet-hour preferences live in `operatorPreferences.quietHours`.
   They can override the time zone, start hour, end hour, weekday-only behavior,
   or disable quiet hours. Recording those preferences is local dashboard state:
   it must not call Jules, GitHub, Linear, write project files, or mutate Git.
5. The dashboard should render the packet as `Needs your input` and expose a
   pending-human-input count so the operator can find blocked tasks quickly.
6. The operator's answer should be recorded as local `operatorAnswers` before
   Symphony runs any chosen repair lane. This receipt records the selected lane
   and plain-language answer, but it does not send Jules feedback, create Linear
   tasks, mutate GitHub, or touch local Git.
7. The first guarded repair-lane execution is `create_setup_repair_task`. It
   creates a local Symphony setup-repair draft and a `repairLaneExecutions`
   receipt only. That draft must still pass the normal Git, Linear, and Jules
   gates before any external work happens.
8. When a local repair commit is prepared, Symphony may record a
   `repairPushReadiness` packet. That packet stores the local worktree, branch,
   commit, repair-base commit, current PR head commit, changed files,
   verification commands, target PR, and exact push command. It must keep
   `canPushNow: false`, `mutatesExternalSystemsIfRun:
   true`, and `mutatesLocalFiles: false` so the dashboard can explain the next
   boundary without quietly pushing to GitHub.
9. Repair push readiness should report whether the prepared repair is still
   based on the current PR head. A stale repair base is not a push failure; it is
   a local warning that the repair needs rebasing or regeneration before the
   operator approves any GitHub mutation.
10. Repair push readiness should also include a `postPushFollowUp` packet that
   names the read-only sequence after operator push: wait for GitHub checks,
   refresh the Symphony PR packet, then update Scout/Core readiness. This packet
   must not push, rerun checks, merge, or pull local Git by itself.
11. A `repairPushReadiness` packet without a recorded `repairPushResult` should
   also produce an `operatorQuestion` with `sourceStage: repair_push_approval`.
   That question asks whether the operator approves pushing the prepared repair,
   offers approve/reject/wait choices, and hides repair-lane execution because
   the next decision is push approval rather than setup-task creation. The
   question remains local evidence only: it records the human decision but does
   not push to GitHub, rerun checks, merge, or edit local files.
   This current-boundary question takes precedence over the older repair-lane
   decision packet when both remain on the handoff for audit history.
12. After the operator records `approve_repair_push`, routing must advance to a
   local `Record repair push result` boundary instead of asking the same
   approval question again or pretending GitHub checks can rerun already. That
   routing state is still `operator_only`: it may show the exact push command
   and post-push result endpoint, but the push remains a human-owned GitHub
   mutation outside Symphony.
13. After an operator-approved push has happened outside Symphony, Symphony may
   record a local `repairPushResult` receipt. That receipt stores pushed/failed
   status, pushed commit, resulting PR head, push time, evidence URL, check
   command, refresh endpoint, next boundary, expected proof, and non-mutation
   flags. It is a receipt for an external action, not a push/rerun/merge/pull
   executor. The dashboard exposes this as `Record Repair Push Result` inside
   the repair-push readiness panel so the operator can attach the post-push
   evidence without asking Symphony to perform the push.
14. `verify-operator-question-packet.mjs` protects the ARA-6 repair-decision
   shape, repair-push approval question, current-boundary precedence, and
   default quiet-hours behavior. `verify-operator-preferences.mjs` protects the
   local preference override/disable behavior and the dashboard preference
   drawer. Durable operator-answer capture, including
   `approve_repair_push` as a local non-mutating receipt and the follow-on
   `Record repair push result` routing boundary, is protected by
   `verify-operator-answer-recording.mjs`.
   Local setup-repair draft execution is protected by
   `verify-repair-lane-local-draft.mjs`, and setup repair routing is protected
   by `verify-setup-repair-draft-routing.mjs`. Repair push readiness is
   protected by `verify-repair-push-readiness-packet.mjs`, and local post-push
   result receipts are protected by
   `verify-repair-push-result-receipt.mjs`. Full task-scoped chat and external
   repair lanes remain separate work.

### Handoff Timeline

1. Each dashboard-started or observed Jules handoff may expose a derived
   `handoffTimeline` packet.
2. The packet is read-only evidence. It must report `mutatesExternalSystems:
   false` and `mutatesLocalFiles: false`.
3. Timeline events are derived from existing handoff facts: task creation,
   Linear issue link, manifest staging, Jules launch, plan approvals, operator
   notes, Jules status refresh, GitHub PR refresh, repair decision, operator
   answer, repair-lane execution, repair push readiness, repair push result,
   Delegation ROI ledger generation, deployment evidence, and local sync checks
   when present.
4. The dashboard can use this packet to answer "what happened, in what order?"
   without making the timeline a second source of truth.
5. `verify-handoff-timeline.mjs` protects the ARA-6-style chronological path and
   the dashboard's `Task timeline` rendering.

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

### Delegation ROI Ledger

1. Symphony must measure whether Jules delegation is saving Codex usage, because
   reduced Codex consumption is a primary reason to route implementation work to
   Jules instead of local Codex.
2. Each dashboard task should expose a Delegation ROI ledger with three clearly
   separated metric tiers:
   - Measured facts: Codex input/output/total tokens, Codex active runtime,
     Codex foreman turn/event count, Jules elapsed time, GitHub PR/check
     elapsed time, human approval/blocker count, and whether local Codex edited
     production files.
   - Estimated avoided Codex work: estimated local Codex implementation turns,
     estimated local Codex tokens, estimated debugging/check-fix cycles, and
     confidence/range notes. These are counterfactual estimates, not facts.
   - Workflow value signals: whether Jules produced a PR, whether the PR stayed
     within declared scope, whether Codex avoided local implementation, how many
     human interventions were needed, and whether the task stalled because of
     setup, CI, auth, unclear handoff, or Jules implementation quality.
3. The dashboard must label measured facts and estimated savings differently.
   It must never present avoided-token estimates as actual token savings.
4. The first implementation should reuse existing Codex usage sources:
   `codex_totals`, worker roster token totals, retained usage/rate-limit
   activity, task nudge records, Jules session timestamps, GitHub PR/check
   timestamps, and task/handoff records. When the broader Codex conversation
   cost is not part of Symphony worker totals, the task can store a local
   task-scoped foreman-usage receipt instead of pretending the measured spend is
   zero. New fields should extend the task ledger rather than creating a
   parallel cost database.
4a. Broad active-goal or thread-level usage is useful context, but it is not the
   same as measured task-scoped spend. `codex_goal_context` receipts must be
   displayed in a separate goal-context bucket and must not unlock
   `candidate_savings` without a task-scoped spend source.
5. A task can only claim "Jules saved Codex usage" when the ledger shows both:
   measured task-scoped Codex foreman spend and a documented avoided-work
   estimate with method, confidence, and caveats. If either side is missing, the
   dashboard should show "ROI unknown" rather than "saved".
6. The ARA-6 first-run baseline should be recorded as a learning case: Codex
   spent orchestration/documentation effort, Jules produced PR #931, and the
   current blocker is CI/setup health. That outcome may still be valuable, but
   it is not enough by itself to prove token savings until the avoided Codex
   implementation estimate is recorded.
7. The current baseline implementation attaches `delegationRoiLedger` to each
   handoff snapshot, passes Symphony runtime `codex_totals` into `/api/v1/task-
   drafts` when available, aggregates local `delegationRoiForemanUsage`
   receipts when present, and renders the ledger on the dashboard. It is
   deliberately conservative: if measured task-scoped Codex tokens or
   documented avoided-work estimates are missing, the ledger says `ROI unknown`
   and keeps those missing fields visible instead of substituting zeroes or
   claiming savings.
8. Measured task-scoped Codex foreman usage is recorded through the local
   `roi-foreman-usage` path on a Jules handoff. That path mutates only the
   Symphony task store and must keep all external/local mutation flags false
   while recording input tokens, output tokens, total tokens, active runtime,
   foreman turns, source, notes, and receipt count as measured facts.
9. Avoided-work estimates are recorded through the local `roi-estimate` path on
   a Jules handoff. That path mutates only the Symphony task store and must
   record method, confidence, caveats, and the estimated turns/tokens/debugging
   cycles separately from measured Codex spend.

### Documentation Creation

1. README describes dashboard-first operation and the key API surfaces.
2. This operating spec holds scope, scenarios, blockers, and done criteria.
3. The audit file is the live Markdown status ledger for task areas, goalposts,
   achieved/not-achieved state, blockers, remaining proof, and evidence paths.
4. Evidence artifacts are linked from the audit.
5. Documentation must not claim full completion while live end-to-end proof is
   missing.
6. Documentation is an ongoing part of the active goal. Each implementation or
   proof slice should update the operating spec, audit, architecture overview,
   and ordered task list before that slice is considered settled, even when the
   runtime change is small.
7. Read-only refreshes should say what was observed, what did not mutate, and
   which operator-owned boundary remains next. Conversation memory is not a
   durable status ledger.

8. Task detail pages should expose guarded operator actions as runbook evidence
   when a boundary has a command or endpoint. These entries may include the
   current Symphony endpoint, a marked Jules PR feedback comment command, a
   prepared repair push command, or a future local-sync command. They must carry
   mutation flags and must not become automatic buttons. Repair-push readiness
   packets should carry both the canonical Git push ref and the safer
   worktree-qualified `git -C <repair worktree> push ...` command so every
   operator-facing surface points to the prepared repair checkout.
   Rendered proof `task-page-guarded-actions-2026-05-20.png` confirms the live
   ARA-6 task page renders the guarded PR refresh and Jules PR feedback actions
   without mutation; the live JSON receipt confirms the repair-push guarded
   action is absent until `repairPushReadiness` is recorded on that handoff.
   Follow-up proof `task-page-guarded-actions-after-readiness-2026-05-20.png`
   confirms the live page renders the repair-push guarded action and local-only
   repair-push result receipt after Symphony records readiness. The paired JSON
   proof also guards the corrected quiet-hours behavior: 08:52 Europe/Amsterdam
   maps to next check `2026-05-20T07:00:00.000Z`.

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
- Jules browser-visible state and API state disagree with local stored status.
- Jules local status reports `COMPLETED` with `pullRequestUrl: null`.
- Jules prompt or plan rendering mangles file paths such as `__tests__` through
  Markdown formatting.
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
- GitHub Pages deployment is missing, pending too long, or failed after merge.

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
- A proof stage advances in code, verifier output, browser evidence, or
  external-state observation without updating the owning status documents in the
  same pass.

## Required Evidence

Each requirement needs the strongest evidence appropriate to its scope:

- Code paths for parser, runner, server, dashboard, and task store behavior.
- Verifier scripts that protect API contracts and dashboard rendering.
- Verifier scripts are durable contract tests and must stay trackable source,
  not generated runtime artifacts. `.gitignore` may ignore Symphony state,
  live-proof captures, visual proof images, and Jules run output, but it must
  explicitly unignore any `conductor/symphony/scripts/verify-*.mjs` file that is
  part of `verify:jules-contract`. `verify-gitignore-contract-boundary.mjs`
  protects that split directly.
- Rendered screenshots for visual surfaces.
- JSON API captures for live state.
- Codex in-app browser proof for live dashboard inspection.
- External-state proof for Linear, Jules, GitHub PR, Scout/Core, and local sync.
- Audit rows that connect every requirement to its evidence.

### Scenario Coverage Matrix

This matrix serves as the canonical map of required middleman scenario coverage. "Local proof" means contract verifiers, mock suites, or visual shims exist; "Live proof" requires a completed Linear/Jules/GitHub/local-sync execution sequence. 

Refer to [`JULES_MIDDLEMAN_AUDIT.md`](../JULES_MIDDLEMAN_AUDIT.md#requirement-audit) for the active evidence ledger, proof histories, and live verification counts.

| Area | Contract / Verification Target | Remaining Gap |
|---|---|---|
| **Dashboard Intake** | `verify-handoff-readiness-packet.mjs`, `verify-clean-handoff-pass-path.mjs`, `verify-middleman-path.mjs` | Proven for mock/synthetic states; needs live proving-ground run. |
| **GitHub Sync Gate** | `verify-git-preflight-blockers.mjs`, `verify-git-disposition-review-packet.mjs`, `verify-git-sync-plan.mjs` | Full pass path to be proven on next active spell package. |
| **Linear Issue Creation** | `verify-linear-issue-blockers.mjs`, `verify-linear-issue-preview.mjs` | Live creation from dashboard draft during a clean run. |
| **Jules Manifest Staging** | `verify-jules-manifest-preview.mjs`, `.jules/orchestrator` contracts | Live manifest staging from active synced draft. |
| **Jules Launch / Session** | `verify-jules-launch-readiness-packet.mjs`, Jules REST API mapping | Live session launch through orchestrator. |
| **GitHub PR Monitoring** | `verify-pr-next-action.mjs`, `verify-pr-comment-classification.mjs`, `verify-observed-pr-watch.mjs` | Course-correction feedback lanes and check observation. |
| **GitHub Actions / CI Quality** | `verify-pr-check-artifacts.mjs`, `.github/workflows/ci.yml` advisory scan | Setup failure classification and workflow repair lanes. |
| **Conflict-Prone Files** | Overlap risk panels, Scout conflict comments | Live conflict handling from overlapping branches. |
| **Scout / Core Readiness** | `verify-scout-core-readiness-packet.mjs` | Direct review integration and Core approval gates. |
| **Deployment Readiness** | `verify-deployment-readiness-packet.mjs`, `verify-deployment-evidence-receipt.mjs` | Live GitHub Pages build/status checking after merge. |
| **Local Sync** | `verify-local-sync-readiness-packet.mjs`, `verify-local-sync-next-action.mjs` | Guarded pulling and fast-forward safety gates. |
| **Worker / Dispatch Gate** | `verify-dashboard-only-mode.mjs`, `verify-dispatch-control-toggle.mjs` | Dispatch toggle behavior during active foreman runs. |
| **Worker Model Assignment** | `verify-worker-mode-packet.mjs` recommendations | Dynamic reasoning/model selection based on complexity. |
| **Task Routing & Nudges** | `verify-task-routing-nudging.mjs`, scheduler packets | Safe pause-and-nudge execution at long boundaries. |
| **Dashboard Focus & Console** | `verify-dashboard-foreman-console.mjs`, `verify-dashboard-density.mjs` | Dynamic density control and first-screen boundary focus. |
| **Approvals** | `verify-operator-preferences.mjs`, `verify-operator-answer-recording.mjs` | Local answer receipts and repair-push approval. |
| **Usage / Spending** | Token count and runtime tracking panel verifiers | Live Codex usage event capture. |
| **Delegation ROI Ledger** | `verify-delegation-roi-ledger.mjs`, task-scoped ledger | Integrated foreman usage and avoided-work estimates. |
| **Governance Docs** | spec/audit contract verifiers, `/proof` board visibility | Documentation parity after each active proof stage. |
| **Browser Constraints** | `verify-browser-tooling-health.mjs`, `/api/v1/browser-tooling-health` | Codex in-app browser follow-along proof. |


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
