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
  - 1.6 [Post-Launch Jules Update Boundary](#post-launch-jules-update-boundary)
  - 1.7 [Task-Centered Dashboard](#task-centered-dashboard)
  - 1.8 [Current Task-Page Baseline](#current-task-page-baseline)
  - 1.9 [Human Direction And Quiet Hours](#human-direction-and-quiet-hours)
  - 1.10 [Active Goal Scope](#active-goal-scope)
  - 1.11 [Approval Scope](#approval-scope)
  - 1.12 [Approval Boundaries](#approval-boundaries)
  - 1.13 [Workflow Phases](#workflow-phases)
- 2. [System Boundaries](#system-boundaries)
  - 2.1 [Git Tracking And Jules Handoff Boundary](#git-tracking-and-jules-handoff-boundary)
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

Every step is also a workflow proof point. If the operator path itself exposes
dashboard friction, stale docs, unclear ownership, repeated approval ambiguity,
or missing evidence, the foreman must either repair that issue in the same pass
or record the gap in the owning live doc before continuing the task.

### Codex And Jules Roles

Codex workers launched by Symphony are foremen. Their default job is to prepare
bounded Jules handoffs, monitor Jules and GitHub, explain blockers, and update
the dashboard/Linear trail. They should not become broad local implementers
unless the operator explicitly asks for local-only work.

Foreman work has a dual track: advance the live bounded task and keep the
workflow evidence/docs synchronized. Local documentation, verifier, API, or
dashboard hygiene remains inside the implementation loop when it does not push,
launch, merge, sync, contact an external system, or claim that a guarded
workflow boundary advanced.

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
Use an operator-run command or browser API fallback when the browser is unobservable,
and record the resulting observation as task evidence rather than as a hidden
terminal-only state.

Any active Jules task needs a visual Jules-page check, not only a dashboard or
stored-state refresh. The dashboard can say `QUEUED` or `IN_PROGRESS`, but the
operator still needs to open the Jules session page and confirm whether Jules is
queued, planning, waiting for approval, actively working, reporting failure, or
showing a PR/result that the local record has not captured yet. Record that
visual check in the owning tracker or task receipt so later agents do not repeat
an already-resolved launch step or mislabel an external wait as a goal blocker.

Once Jules has started, its working checkout must be treated as an isolated
clone of the base commit recorded at launch. Later local commits, tracker
updates, or merged GitHub PRs do not automatically reach that running Jules
session. If the task changes after launch, the foreman must use an explicit
update channel instead of assuming the GitHub-synced tracker will appear inside
Jules: visible Jules message, bounded GitHub PR comment marked as Jules
feedback, a foreman repair/rebase on the PR branch after Jules opens it, or a
replacement handoff from current `origin/master`. Before accepting or merging a
Jules PR, compare the Jules session base with current `origin/master`; if master
advanced, classify any tracker/docs conflict as a session-base drift issue and
preserve foreman-reviewed tracker wording over stale Jules-authored status.

### Post-Launch Jules Update Boundary

A Jules launch is a source-boundary decision. The launched session receives the
repo state and handoff packet available at its launch base; it does not keep
subscribing to later local tracker edits, merged tracker PRs, or GitHub `master`
changes. After launch, the foreman must treat new task instructions as unsent
until one of these update paths is recorded:

| Post-launch adjustment | Reaches running Jules automatically? | Valid update path |
|---|---:|---|
| Local tracker edit or local task note | No | Convert to a visible Jules message, PR feedback, or replacement handoff. |
| Merged task-doc PR after Jules launch | No | Compare base commits, then send the delta through Jules/GitHub feedback or relaunch from current `origin/master`. |
| PR review finding on Jules branch | Only if Jules reads the PR comment/session | Post bounded `[Jules feedback]`, confirm visible Jules acknowledgement when possible, and wait for a new PR head before accepting. |
| Out-of-scope/stale-base PR file list | No | Request Jules rebase/scope repair first; if repeated repair fails, use a foreman PR-branch repair/rebase or replacement handoff and record the decision. |

When GitHub still shows the same PR head after repair feedback, do a visible
Jules-page check before calling the work blocked. If Jules visibly says it has
received the comments or is processing the repair, the valid next action is a
recorded `wait_for_jules_repair_commit` state with the current PR head, visible
Jules state, and next recheck condition. The first wait after a new repair
request or new visible Jules signal may be a full decision entry; repeated
unchanged waits should be compact wait-state rows in the tracker, task receipt,
or open-task queue. If Jules shows failure, no activity after repeated waits, or
a completed no-PR state, record the different decision gate explicitly before
choosing another repair path.

The dashboard should make this boundary visible whenever a handoff has both a
Jules launch receipt and newer tracker/GitHub evidence. The next action should
name the valid choice, such as `Wait for Jules repair commit`,
`Send post-launch task adjustment`, `Repair PR branch from current master`, or
`Create replacement handoff`. It should not say or imply that a tracker merge
has updated the running Jules clone unless the receipt proves one of those
channels happened.

A new Jules PR head resolves a wait only after the foreman compares the new
diff with the requested repair. Passing checks or a changed commit hash is not
enough. If the new head addresses unrelated files, adds out-of-scope workflow
changes, or leaves the requested acceptance repair undone, the task remains in
`Wait for Jules repair commit` with a fresh bounded feedback receipt.

When a package has already reconciled to merged/local-current proof, its handoff
history should not keep owning the global queue action. Old completed handoffs
and unlaunched stale duplicate handoffs may remain visible as task history, but
they should not outrank a newer ready draft unless they represent a live Jules
session, active PR, unresolved plan/feedback gate, or unsafe local-sync boundary
that still requires operator action. This protects the visible next package path
from being hidden behind historical bookkeeping after the operator has already
created the next draft.

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
Europe/Amsterdam, and the default weekday quiet-hours window is derived in the task detail packet. The dashboard should let the operator adjust or disable that
local waiting policy. The wake-up should refresh the boundary state and check
for an operator reply; it should not keep running a tight background script while blocked on the human.

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

Decision reporting is not the same as logging every observation. Use the full
decision report for material forks: plan approval/rejection, external mutation,
Jules feedback, stale-session replacement, branch-hygiene repair, merge,
deployment waiver, local sync, or scope expansion. Use compact tracker,
wait-ledger, receipt, or open-task rows for repeated refreshes that preserve the
same wait state. A compact wait row still needs the observed PR/session state,
what is being waited for, and the next recheck condition, but it should not
duplicate the full assumed-approval template unless the available choices
changed.

Use this boundary when deciding where an observation belongs:

| Observation or action | Record as full decision? | Preferred record |
|---|---:|---|
| Launching Jules, approving or rejecting a plan, sending Jules feedback, replacing a handoff, repairing a PR branch, merging, syncing local master, or expanding scope | Yes | Decision report entry plus the relevant task/tracker receipt |
| First wait after a new repair request, plan gate, visible Jules status change, or PR state change where the foreman chooses to wait instead of another valid action | Usually yes | Decision report entry that names the alternatives and the chosen wait |
| Repeated queued, setting-up, working, verifying, or waiting-for-repair observations with no new choice | No | Compact wait row in the tracker, task receipt, or open-task queue |
| Read-only visual Jules/dashboard/GitHub checks that confirm the same state | No | Compact wait row or no new row if the owning row already captures the same evidence |
| A visible blocker, failed command, no-PR completion, stale branch, out-of-scope file, or damaged repair feedback | Yes | Decision report entry because the available choices changed |

The practical test is whether the foreman had to choose between materially
different next actions. If the only honest action is still "wait for Jules to
produce the next proof," keep it compact and name the next proof target.

### Workflow Phases

This table is the canonical phase list for the dashboard-created
Symphony/Jules path. Other Symphony docs should link back here instead of
maintaining competing phase lists. The global `middlemanPath` packet exposes the
same ordered ladder in `/api/v1/task-drafts`; task timelines may add finer
receipt events inside these phases.

| Phase id | Owner | Purpose | Read-only evidence | Mutation boundary | Typical worker mode | Completion receipt |
|---|---|---|---|---|---|---|
| **workflow_setup** | Symphony / local project tooling | Prove or repair the local/Jules/GitHub setup needed before judging task implementation quality | Environment setup packet, failed-check classification, setup repair draft/readiness, verifier output | Local setup repair, workflow config, dependency/action update, or setup waiver | `local_careful` for bounded setup repair; `operator_only` for external mutation or waiver | Setup snapshot, setup repair receipt, or explicit setup blocker |
| **git_sync** | Local repository / Symphony | Prove the local branch can safely feed cloud work | Git preflight, disposition review, resolution packet, sync plan | Human-owned local Git sync, commit, push, or disposition decision | `operator_only` while blocked; `observe_wait` for read-only checks | Clean preflight or Git sync execution receipt |
| **linear_issue** | Linear / Symphony | Create or connect human-readable tracking | Linear issue preview, existing issue lookup, handoff readiness packet | Create/update Linear issue or status comment | `operator_only` at mutation; `observe_wait` for preview | Linear issue receipt or linked issue id |
| **jules_manifest** | Symphony / `.jules/orchestrator` | Stage the bounded Jules handoff | Manifest preview with write scope and verification commands | Write/update `.jules/orchestrator` handoff material | `operator_only` at mutation; `local_careful` for local setup repair drafts | Manifest/staging receipt |
| **jules_launch** | Jules / Symphony | Start cloud implementation from the staged handoff | Launch readiness packet, safety checklist, Linear/Git receipt, base commit | Launch Jules session | `operator_only` at mutation | Jules launch/session receipt with immutable session base |
| **jules_session** | Jules / Symphony | Track plan, execution, messages, PR output, base drift, and reconciliation | Jules API/browser state, visible Jules-page check, `julesStateReconciliation`, prompt/dialogue packets, current `origin/master` comparison | Approve plan, send Jules message, or otherwise direct Jules | `observe_wait` for reads; `operator_only` for plan/message actions | Plan approval, message, session refresh, visible Jules-page check, base-drift note, or PR-discovery receipt |
| **github_pr** | GitHub / Symphony | Monitor PR state, checks, files, feedback, base drift, and repair choices | PR refresh, checks, failed check names, file risk, comments, mergeability/conflicts, repair decision/readiness | PR comment, branch push/apply, check rerun, workflow repair | `observe_wait` for refresh; `local_careful` for local setup repair; `operator_only` for GitHub mutations | PR refresh, feedback, repair push, conflict/base-drift repair, or check-rerun receipt |
| **scout_core** | Scout/Core / Symphony | Decide review, risk, validation, and merge readiness | Scout/Core readiness packet, conflict comments, risk/file scope | Core validation, Core approval, or merge | `observe_wait` for reads; `operator_only` for validation/merge | Scout/Core validation or merge receipt |
| **deployment** | GitHub Pages/deployment system / Symphony | Prove published-app health before local sync when relevant | `deployment_readiness`, Pages build/deployment/status inspection commands | Deployment repair, rerun, or deployment-proof waiver | `observe_wait` for inspection; `operator_only` for waiver/repair | `deploymentEvidence` receipt |
| **local_sync** | Local repository / Symphony | Bring local master/worktree up to the merged, deployed state | `local_sync_readiness`, dirty/ahead/behind/fast-forward checks | `git pull --ff-only`, merge, rebase, or other local sync | `operator_only` at mutation | Local sync execution receipt |

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

### Git Tracking And Jules Handoff Boundary

GitHub should preserve Aralia-facing task intent and proof, not Symphony's local
process exhaust. A file or note is tracked only when it helps a future Aralia
contributor, Jules task, or reviewer understand what changed, what remains, or
why a package boundary is safe.

Track or send to Jules:

- bounded task packets, prompts, acceptance criteria, and write-scope guards
  needed for the delegated task;
- package tracker updates, final product PR links, current blockers, and short
  status summaries that explain the active Aralia work;
- focused verifier contracts, source changes, and docs that define or prove the
  Symphony workflow itself;
- short excerpts from a receipt or decision only when they are the durable
  acceptance trail for Aralia work.

Do not track or send to Jules by default:

- raw Symphony runtime state, generated manifests, dashboard caches, click
  receipts, local task-store JSON, local sync logs, browser/session artifacts,
  or `.symphony`/`.jules` run output;
- lists of every Symphony dashboard, setup, routing, or receipt PR when the live
  task only needs to know the current spell/package boundary;
- local-only receipts that merely prove an operator clicked, refreshed, waited,
  or recorded a note inside Symphony.

If a raw receipt answers a future "what happened to this Aralia package?"
question, summarize the answer into the package tracker or package packet and
leave the raw receipt external or ignored. Spell trackers should list product
package PRs and material handoff identifiers, then collapse Symphony support
PRs into a pointer to the Symphony audit/open-task docs.

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
5. Every active Jules task gets a visual Jules-page check through the Codex app
   browser after launch and during monitoring. The check must record whether
   Jules is queued, planning, waiting for approval, working, failed/cancelled, or
   showing a PR/result that dashboard state has not captured.
6. Plan approval is visible and actionable whenever either stored state or
   browser inspection shows Jules is waiting for approval. Stored state is not
   enough by itself: the ARA-6 live run showed local status can report
   `COMPLETED` with no PR URL while Jules API/browser/GitHub evidence exposes
   additional task state.
7. When a Jules API key is available, Symphony should prefer the official Jules
   REST API `GetSession` and activity responses before browser scraping. Jules'
   current public API docs describe the API as alpha, use `X-Goog-Api-Key` for
   authentication, describe sessions as the continuous unit of work, activities
   as per-session agent/user events, `approvePlan` and `sendMessage` as explicit
   operator-style session actions, and session outputs as the place where an
   automatically created PR can appear. The ARA-6 session API returned
   `state: COMPLETED` plus a PR output for
   `https://github.com/Gambitnl/Aralia/pull/931`, even though local Symphony
   status still lacked `pullRequestUrl`.
8. If the API is unavailable or contradicts the visible web session, Symphony
   should visually reconcile the session through the Codex app browser before
   treating the boundary as complete. The intended browser path is the Browser
   plugin's in-app bridge; terminal Playwright is acceptable for repeatable
   local dashboard verification but is not the operator-visible Jules
   follow-along surface.
9. If stored Jules state still has no PR URL after API/browser reconciliation, Symphony
   should also perform a read-only GitHub fallback lookup by Jules session id,
   generated branch name, handoff title, or Linear issue. The ARA-6 run created
   PR #931 even though the local Jules/Symphony record still did not expose
   `pullRequestUrl`.
10. Handoff snapshots should expose a read-only `julesStateReconciliation` packet
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
5b. A Jules PR based on an older session checkout is not proof that current
   tracker or task adjustments landed in Jules. When current `origin/master`
   advanced after the Jules launch receipt, Symphony should show a base-drift
   warning, keep Jules-authored tracker edits provisional, and route the
   foreman to either explicit Jules feedback, PR-branch repair/rebase, or a
   replacement handoff.
6. PR comments and review comments are a valid course-correction channel back
   to Jules. When checks fail, conflicts appear, or changed files need repair,
   Symphony should surface an operator-run `gh pr comment ... --body-file ...`
   feedback command instead of auto-commenting or silently switching to local
   implementation.
6a. After a bounded `[Jules feedback]` request, Symphony should not treat any
   new commit as a repaired state by itself. It should show the requested repair
   summary, the observed PR head, and the changed-file risk, then require
   foreman review before moving from wait/review to merge readiness.
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
3. The default quiet-hours policy is weekday 01:00-09:00 Europe/Amsterdam.
   During that window, the packet should set `canNotifyNow: false` and
   `nextCheckAt` to the next 09:00 local check time rather than running a tight
   wait loop.
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
4. Evidence artifacts are linked from the audit only when they are durable
   proof. Raw Symphony receipts, generated runtime files, and dashboard
   byproducts stay ignored unless a short excerpt is intentionally promoted.
5. Documentation must not claim full completion while live end-to-end proof is
   missing.
6. Documentation is an ongoing part of the active goal. Each implementation or
   proof slice should update the operating spec, audit, architecture overview,
   and ordered task list before that slice is considered settled, even when the
   runtime change is small.
7. A live task is not settled just because product code moved forward. If the
   task exposed Symphony dashboard friction, stale instructions, unclear
   approval wording, or missing proof, that issue must be repaired locally when
   bounded or logged in the audit, open task queue, or proving-ground tracker
   with the next proof target.
8. Read-only refreshes should say what was observed, what did not mutate, and
   which operator-owned boundary remains next. Conversation memory is not a
   durable status ledger.
9. Spell and package trackers should not become catalogs of Symphony support
   PRs. They should keep final product PR links, material handoff ids, and short
   support summaries, then point to the Symphony audit/decision history for
   detailed workflow repair provenance.
10. Task detail pages should expose guarded operator actions as runbook evidence
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
- Active Jules task has not been visually checked in the Jules session page.
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

This matrix serves as the canonical map of required middleman scenario coverage.
Refer to [`JULES_MIDDLEMAN_AUDIT.md`](../JULES_MIDDLEMAN_AUDIT.md#requirement-audit)
for the current proof ledger and achieved/not-achieved status.

This matrix is the working queue for the spec. "Local proof" means code,
fixtures, API checks, or rendered dashboard checks cover the contract. "Partial
live proof" means the Codex in-app browser has inspected real local/external
state, but the full Linear/Jules/GitHub/Scout/Core/local-sync path is not yet
complete.

| Area | Current proof | Remaining gap |
|---|---|---|
| **Dashboard Intake** | Local verifier coverage plus Codex in-app browser proof that a bounded draft can be saved while GitHub sync blocks handoff. Missing title, body, write scope, verification commands, and exact duplicate draft/handoff submissions are rejected before storage or Git preflight. `verify-handoff-readiness-packet.mjs` proves each draft now exposes one non-mutating handoff-readiness packet that connects Git sync, Linear issue preview, Jules manifest preview, launch waiting state, and the first nudge endpoint. `verify-clean-handoff-pass-path.mjs` proves the same packet has a clean-Git pass path: before Linear it marks the Linear issue boundary runnable and the Jules manifest boundary waiting; after Linear is linked it marks the Jules manifest boundary runnable and records the expected proof for the next boundary. `verify-middleman-path.mjs` proves the queue also exposes one global middleman path across Git sync, Linear, Jules manifest, Jules launch, Jules session, GitHub PR, Scout/Core, and local sync with per-stage mutation labels, expected proof, and a foreman action packet for the current middleman boundary. The Git-blocked action is operator-only and points to Git disposition review and recording endpoints instead of exposing a false Linear/Jules/local-sync button. `verify-middleman-foreman-pass-path.mjs` proves that after clean Git the same foreman packet advances through Linear issue creation, Jules manifest staging, Jules launch, Jules session refresh, GitHub PR refresh, and local sync with the correct safety class, mutation flags, current boundary, runnable endpoint, and separate read-only evidence endpoint where one exists. Codex in-app browser/API proof `handoff-readiness-2026-05-17.*` shows the blocked packet against the current draft, `handoff-pass-path-2026-05-17.*` shows the live dashboard/API now exposes the pass-path section while Git remains blocked, `middleman-path-2026-05-17.*` shows the live dashboard/API current boundary remains Git sync while later Linear/Jules/local-sync stages are waiting and non-runnable, and `foreman-action-packet-2026-05-17.*` shows the live proof board exposes the operator-only Git disposition foreman action with review and record endpoints. | Prove the same draft can execute the pass path after the operator intentionally resolves Git/GitHub blockers. |
| **GitHub Sync Gate** | Local verifier coverage plus Codex in-app browser proof that dirty, untracked, ahead, and behind state blocks Jules with zero workers dispatched. `verify-git-preflight-blockers.mjs` covers non-repo, missing remote, wrong branch, and diverged-branch blockers without mutating the real checkout. `verify-git-disposition-workflow.mjs` and Codex in-app browser proof show a non-mutating Git disposition ledger for local-only commits, tracked edits, untracked artifacts, and remote-only commits. `verify-git-disposition-review-packet.mjs` proves the dashboard/API now exposes a read-only review packet between raw Git facts and the guarded sync plan, including required categories, blockers, evidence counts, source/generated untracked classification, allowed decisions, task links, and `/proof` board visibility. `verify-git-resolution-packet.mjs` proves the preflight also emits a read-only resolution packet with concrete local-only commits, remote-only commits, tracked files, nested untracked files, and the commands used to inspect them. `verify-git-sync-plan.mjs` proves the snapshot derives a guarded human execution plan and an execution packet from those facts and recorded dispositions without mutating Git. `verify-git-sync-execution-receipt.mjs` proves that execution packet now carries the preflight receipt, decision receipt, and safety checklist that make any human-run sync attempt auditable before Linear/Jules can start. The Codex in-app browser/API proof `git-disposition-review-2026-05-17.*` and `git-disposition-review-proof-board-2026-05-17.*` shows the real queue has four missing disposition decisions, keeps `mutatesGit: false`, and renders the review card in the in-app `/proof` board. The Codex in-app browser proof `git-sync-execution-packet-2026-05-17.*` shows the packet separates read-only commands, no exposed mutating commands while blocked, verification commands, blockers, required human confirmation, and the expected next proof. The Codex in-app browser/API proof `git-sync-execution-receipt-2026-05-17.*` shows the live dashboard packet also renders the preflight receipt, decision receipt, and safety checklist while remaining non-executable and non-mutating. | Prove the pass path after the operator intentionally resolves local Git/GitHub blockers. |
| **Linear Issue Creation** | Local verifier coverage for preflight-protected issue text, required draft fields, sync receipt, missing Linear API key/project slug blockers via `verify-linear-issue-blockers.mjs`, and non-mutating issue-packet rehearsal via `verify-linear-issue-preview.mjs`. Codex in-app browser/API proof `linear-issue-preview-2026-05-17.*` and `linear-issue-preview-proof-board-2026-05-17.*` shows the blocked queue can expose the exact future Linear issue title/body, blockers, `canCreateNow: false`, `wouldCreateLinearIssue: true`, and `mutatesExternalSystems: false` before any Linear call. | Live dashboard-created Linear issue against the intended project after Git sync passes. |
| **Jules Manifest Staging** | Local verifier coverage that staging uses the existing `.jules/orchestrator` contract, blocks when `.jules/orchestrator/cli.ts` is missing, and remains preflight-gated. `verify-jules-manifest-preview.mjs` proves blocked drafts can rehearse the exact manifest shape in memory with `canStageNow: false`, `wouldStageJulesManifest: true`, and `mutatesLocalFiles: false`. Codex in-app browser/API proof `jules-manifest-preview-2026-05-17.*` and `jules-manifest-preview-proof-board-2026-05-17.*` shows the blocked queue exposes the future `.jules/runs/.../manifest.json` packet without writing files. | Live staged manifest from a synced dashboard draft after Git and Linear gates pass. |
| **Jules Launch / Session** | Local dashboard/API coverage for session, URL, state, plan approval, messages, and refresh fields. `verify-jules-launch-readiness-packet.mjs` proves a staged handoff now exposes a read-only launch readiness packet with launch URL, launch command, status command, manifest path, records path, Linear issue receipt, GitHub base commit, external/local mutation class, safety checklist, blockers, and expected post-launch proof; launched handoffs switch that packet to the session receipt and status-refresh boundary. Codex in-app browser/API proof `jules-launch-readiness-2026-05-17.*` shows real observed-PR handoffs render that launch-readiness card as blocked, with `canLaunchNow: false`, no external/local mutation path, watch-only blockers, and no false live-launch claim while Git sync remains blocked. | Live Jules session launched through the existing orchestrator. |
| **GitHub PR Monitoring** | Local verifier coverage for PR state, checks, files, risk, mergeability, and next action. `verify-pr-next-action.mjs` now also proves failed checks and risky files expose an operator-run `gh pr comment ... --body-file ...` feedback command so PR comments can course-correct Jules work without Symphony mutating GitHub automatically. `verify-pr-comment-classification.mjs` proves comments from other review agents stay external review context unless the operator marks them with `[Jules feedback]`, and that Scout conflict comments are separated with conflict file and priority PR metadata. `verify-observed-pr-watch.mjs` proves existing GitHub PRs can be watched as `observed_pr` records without manifest staging, Jules launch, or local sync claims. `verify-observed-pr-follow-up-draft.mjs` proves historical observed PR learning creates a separate normal dashboard draft, keeps the old PR read-only, and carries "do not repair, reopen, or comment on the historical PR" wording. Live PR #900 proof (`pr-900-scout-conflict-learning-2026-05-17.*`) shows the real pattern: a closed Jules PR with 41 changed files, 0 checks, and 256 Scout conflict comments. Codex in-app browser/API proof `observed-pr-due-refresh-2026-05-17.*` shows the dashboard can watch PR #900 read-only, classify its Scout conflict lane, schedule an observed PR refresh nudge, refresh the real GitHub boundary once, and expose `Record Observed Learning` instead of a repair action. Codex in-app browser/API proof `observed-pr-follow-up-draft-2026-05-17.json` and `.md` shows PR #900 can become a separate blocked dashboard draft while the source handoff stays `observed_pr` with no manifest or launch command. Live ARA-6 proof `ara6-pr-refresh-summary-2026-05-20.json` shows an active dashboard-started Jules handoff can reconcile a missing local PR URL from Jules API session output, attach PR #931, refresh GitHub checks, and set the next action without external mutation. `verify-jules-state-reconciliation-packet.mjs` now proves handoff snapshots also expose `julesStateReconciliation`: matched Jules API/GitHub evidence becomes `reconciled_from_external_evidence`, while `COMPLETED` with no PR remains `needs_browser_reconciliation` instead of a false completion claim. Live ARA-6 proof `ara6-pr-repair-decision-refresh-2026-05-20.json` shows the same handoff now carries a read-only repair decision packet with setup-task, Jules-feedback, wait, and refresh-after-repair choices. `verify-repair-push-readiness-packet.mjs` proves the local PR #931 lockfile repair can be recorded as a push-readiness packet without pushing, including repair-base/current-PR-head freshness so stale prepared repairs are visible before any operator-approved push and `postPushFollowUp` so the next read-only checks/refresh/Scout-Core sequence is explicit after that push. `verify-operator-question-packet.mjs` now also proves that push-readiness becomes a plain-language `repair_push_approval` question with approve/reject/wait choices instead of an execute-repair-lane action. `verify-repair-push-result-receipt.mjs` proves a later human-approved push can be recorded locally as `repairPushResult`, the dashboard exposes `Record Repair Push Result` to capture that local receipt, and the receipt sends the handoff to `github_checks_rerun` with `gh pr checks 931 --repo Gambitnl/Aralia` plus the Symphony PR refresh endpoint while keeping Symphony non-mutating. `verify-deployment-readiness-packet.mjs` proves the post-merge deployment gate exists as a read-only packet before local sync. | Live repair push or feedback execution, GitHub check rerun, Scout/Core readiness, Core validation/merge, live deployment proof, and local sync remain to be proven on a dashboard-started Jules PR. |
| **GitHub Actions / CI Quality** | Explicit scope now allows meaningful CI improvements when they make checks more granular, faster to diagnose, less noisy, or easier for Symphony/Codex/Jules/Scout/Core to interpret. `.github/workflows/ci.yml` now has a separate `Quality Scan (advisory)` job that runs `npm run scan`, writes parseable `quality-scan.json` with `npm --silent run scan -- --json`, uploads it as the `quality-scan-json` artifact, and writes grouped counts into `GITHUB_STEP_SUMMARY`. This gives PRs human-readable and machine-readable quality-debt signal without blocking merges on known backlog debt. `verify-pr-check-artifacts.mjs` proves Symphony's PR check summary recognizes `Quality Scan (advisory)`, stores a `githubPullRequestChecks.artifacts` hint for `quality-scan-json`, preserves the optional GitHub check `detailsUrl`, renders that artifact plus the GitHub step-summary note and `Open check details` link in the PR readiness panel, and renders the read-only repair decision panel for setup-classified failures. The same verifier now proves ARA-6-style build/lint/test/quality failures classify as a read-only `workflow_setup` blocker and render a `Check blocker classification` panel before the operator decides whether the repair belongs to CI setup, workflow config, or Jules implementation. `verify-pr-next-action.mjs` proves setup-classified blockers change the foreman label to `Resolve CI Setup Blocker`. `github-actions-quality-2026-05-17.json` records the inspection result: `npm run scan` passes and reports 591 grouped findings, the JSON artifact command parses, while `npm run validate` currently fails on existing strict charset data issues and was intentionally not added as a noisy blocker. Live PR #929 proof (`pr-929-quality-scan-github-2026-05-17.*`) shows the new check completed successfully on GitHub and uploaded the `quality-scan-json` artifact. Codex in-app browser/API proof `observed-pr-watch-dashboard-2026-05-17.*` shows Symphony can watch PR #929 read-only and carry the live `quality-scan-json` artifact in dashboard state. Live ARA-6 proof `ara6-pr-refresh-summary-2026-05-20.json` shows Symphony classifies the real PR #931 build/lint/test/quality failure set as `workflow_setup`, preserves the quality artifact hint, and sets next action to `Resolve CI Setup Blocker`. Live ARA-6 proof `ara6-pr-repair-decision-refresh-2026-05-20.json` shows the failed check set now produces a human-readable repair choice packet without mutating GitHub or local files. | Decide and execute the setup/workflow repair path, then refresh PR #931 again before judging Jules implementation quality. |
| **Conflict-Prone Files** | Local verifier and screenshot coverage for overlap/risk panels. | Live overlap or risk case from active handoffs, or a documented real blocker if none is appropriate. |
| **Scout / Core Readiness** | `verify-scout-core-readiness-packet.mjs` proves each handoff now exposes a read-only Scout/Core readiness packet with PR state, checks, file risk, Scout conflict counts, external/Jules feedback counts, dashboard-started-vs-observed ownership, refresh URL, Scout review command, Core validation/merge commands only when ready, mutation flags, blockers, safety checklist, expected proof, and `/proof` visibility for ready, risky, waiting, post-repair-push check-rerun, merged, and observed PR states. The `waiting_for_checks_rerun` state is derived from a recorded `repairPushResult`, keeps Core validation disabled, and points the foreman at `gh pr checks ...` plus the Symphony PR refresh endpoint before Scout/Core readiness can advance. | Live Scout/Core review state connected to a real dashboard-started Jules PR. |
| **Deployment Readiness** | `verify-deployment-readiness-packet.mjs` proves each handoff now exposes a read-only deployment gate with PR merge state, dashboard-started-vs-observed ownership, GitHub repository detection, GitHub Pages/latest-build and deployment-status inspection commands, non-mutation flags, blockers, safety checklist, expected proof, dashboard rendering, direct `GET /api/v1/jules-handoffs/:id/deployment-readiness` access, task-detail `links.deploymentReadiness`, and `/proof` visibility for merged, waiting, and observed states. `verify-deployment-evidence-receipt.mjs` proves the local `deployment-evidence` endpoint records success, failure, or waiver receipts without mutating GitHub or local files, and that only success or waiver can unlock local-sync readiness. | Live GitHub Pages or deployment-status proof from a merged dashboard-started Jules PR. |
| **Local Sync** | Local verifier coverage for post-merge fast-forward gating. `verify-local-sync-next-action.mjs` proves each local checkout state resolves to one readable next action. `verify-local-sync-readiness-packet.mjs` proves each handoff now exposes a read-only local-sync readiness packet with PR merge state, dashboard-started-vs-observed ownership, local commit evidence, refresh URL, guarded sync URL, safety checklist, expected proof, and mutation flags. The deployment evidence verifier proves even safe local-checkout facts cannot expose the sync action until deployment success or operator waiver exists. The same verifier protects `/proof` visibility for safe, blocked, and observed PR local-sync states without exposing a sync URL for blocked or observed records. | Live post-merge sync readiness after deployment proof or explicit operator waiver, with the mutating sync action exposed only when safe. |
| **Worker / Dispatch Gate** | Local verifier and dashboard screenshot coverage for worker identity and roster. `verify-dashboard-only-mode.mjs` and `verify-dispatch-control-toggle.mjs` prove startup defaults to dispatch paused, `/api/v1/dispatch-control` reports backend state, normal startup does not poll or launch workers until enabled, and enabling the backend gate resumes the existing mock assignment path. | Live worker roster during a real foreman run after the operator enables dispatch. |
| **Worker Model Assignment** | Local verifier coverage plus Codex in-app browser proof that unset values display as defaults. `verify-worker-mode-packet.mjs` proves routing now emits a dynamic worker-mode packet for `operator_only`, `local_fast`, `local_careful`, `jules_task`, `jules_plan`, and `observe_wait`, including model/reasoning recommendation, dispatchability, complexity signals, reasons, and explicit `codex.model` / `codex.reasoning_effort` override policy. Codex in-app browser proof `symphony-worker-mode-packet.png` shows the current blocked dashboard rendering the packet as `operator_only`, with `none` model/reasoning and no dispatch while Git disposition is blocked. | Prove the recommended mode feeds an actual worker launch after Git sync allows dispatch. |
| **Task Routing & Nudges** | `verify-task-routing-nudging.mjs` covers blocked queues, small local-agent recommendations, Jules planning recommendations, and pause-aware nudge cadence in the task-intake API. `verify-task-nudge-ledger.mjs` proves the routing decision can be recorded as durable task-tracking evidence with pause cadence, next nudge time, and `mutatesExternalSystems: false`. `verify-task-nudge-scheduler.mjs` proves recorded nudges are classified as due, waiting, or operator-blocked and include explicit foreman action packets with method, endpoint, safety class, runnable state, and `mutatesExternalSystems: false`. `verify-task-nudge-due-refresh.mjs` proves a foreman wake-up can run due external-read nudges for Jules/GitHub/local-sync boundaries while skipping local-state actions that still need operator intent. Dashboard rendering exposes the recommendation, next action, pause duration, candidate routes, record button, task nudge ledger, nudge scheduler, action packet, run-due-refresh button, and due refresh receipt. Codex in-app browser proof `task-routing-nudging-2026-05-17.*` shows the live dashboard waits instead of assigning Jules or local Codex while the GitHub sync gate is blocked. Codex in-app browser proof `task-nudge-ledger-2026-05-17.*` shows the live dashboard records that blocked-Git wait as ledger evidence without mutating external systems. Codex in-app browser proof `task-nudge-scheduler-2026-05-17.*` shows the live scheduler classifies that record as operator-blocked instead of due. Codex in-app browser proof `task-nudge-action-packet-2026-05-17.*` shows the live scheduler action packet for the blocked Git wait: method `NONE`, safety `operator_only`, `canRunNow: false`, and no external mutation. Codex in-app browser proof `task-nudge-due-refresh-2026-05-17.*` shows the live dashboard/API exposes the due-refresh runner and correctly performs no refresh while the real queue has 0 due records and 1 operator-blocked Git-sync record. Codex in-app browser/API proof `observed-pr-due-refresh-2026-05-17.*` shows the same due-refresh runner against a real GitHub PR boundary: one due `refresh / github_pr` nudge for observed PR #900 produced one PR refresh, zero skipped actions, and `mutatesExternalSystems: false`. | Prove the due-refresh runner against a real dashboard-started Jules/GitHub boundary after Git sync allows a handoff to start. |
| **Dashboard Focus & Console** | Current screen-space inventory is documented in this spec so dashboard work can decide what becomes primary, grouped, collapsed, or moved to `/proof`. The dark/light mode toggle is restored in the header and guarded for browser storage limitations and verifier DOM shims. `verify-dashboard-foreman-console.mjs` proves the main dashboard now renders a first-class Current Foreman Boundary panel before grouped detail sections for Git Safety, Jules Lifecycle, PR Review And Local Return, and Task Intake And Records while preserving Save Draft, Watch Existing PR, GitHub Sync Gate, handoff status board, and tracked records. `verify-dashboard-density.mjs` proves idle Usage Tracker, Routine Approval Rules, Running Issues, and Retrying Issues render as compact summary drawers, while warning/danger usage, pending approvals, running workers, and retrying issues stay prominent. `verify-task-detail-api.mjs` now protects the first stable `GET /api/v1/tasks/:id` task-detail JSON endpoint, and the dashboard preview links to it as `Task detail JSON` without creating a second task store. Codex in-app browser proof `symphony-foreman-console.png` shows the live dashboard renders the current boundary first and keeps the large detail groups collapsed by default; `symphony-dashboard-density.png` shows the idle lower monitoring sections collapsed below that boundary. | Continue refining density without losing safety packets or controls. |
| **Approvals** | Local verifier coverage for worker approval panels, auto-approval explanation, and Jules plan approval routes. | Live approval or plan-approval event, or a documented external blocker. |
| **Usage / Spending** | Local verifier coverage for token, rate-limit, retained activity, and credit display shapes. | Live Codex usage/rate-limit event from an active worker. |
| **Delegation ROI Ledger** | `verify-delegation-roi-ledger.mjs` proves handoff snapshots can generate a conservative task-level ledger, measured `codex_totals` can populate the facts section without changing `ROI unknown`, task-scoped `delegationRoiForemanUsage` receipts can populate measured foreman tokens/runtime/turns when broader Codex usage is outside Symphony worker totals, the dashboard renders separate Measured facts, Estimated avoided Codex work, and Workflow value signals sections, the local `roi-foreman-usage` path records measured task-scoped usage without external/local mutation, the local `roi-estimate` path records method/confidence/caveats plus avoided turns/tokens/debugging cycles without external/local mutation, and an ARA-6-style handoff remains `ROI unknown` while documented avoided-work estimates are incomplete. The same verifier proves measured spend plus a documented estimate produces only `candidate_savings`, not a final savings claim. Live proof `ara6-delegation-roi-ledger-2026-05-20.json` confirms the same conservative state appears in `/api/v1/task-drafts` for handoff `handoff-1779226708033-v4ohk7` with `tokenSource: codex_totals` and `totalTokens: 0`. | Record a real ARA-6 task-scoped foreman-usage receipt and a real avoided-work method/confidence/caveats entry before claiming Jules saved Codex usage. |
| **Governance Docs** | README, this spec, audit, architecture overview, open-task queue, and verifiers now point to the full delegation-workflow goal. The audit is the live Markdown status file that lists task areas, goalposts, status, achieved/not-achieved state, blockers, remaining proof, and evidence paths. `verify-proof-board.mjs` now protects a compact `/proof` page that reuses task-intake state, links back to this spec and audit, and exposes the latest Linear issue, Jules manifest, and handoff-readiness previews. Documentation continuity is part of the active goal: every implementation/proof stage should update the relevant status documents before the stage is treated as settled, and read-only refreshes must say what did not mutate. The May 20 PR #931 refresh is documented that way: open, not draft, mergeable, unchanged at head `0c0d948010b3b72d05deb4f2f37ed9c462990593`, latest update `2026-05-19T23:09:48Z`, and no Jules chat, repair push, check rerun, merge, deployment inspection, or local sync. | Keep audit, architecture, open tasks, and goal-facing docs current after every live proof slice. |
| **Browser Constraints** | Codex in-app browser proof artifacts exist for dashboard-only preflight and intake. The compact `/proof` board gives the in-app browser a small, script-free follow-along surface for queue action, Git sync state, Git disposition review, latest draft/handoff, Linear issue preview, Jules manifest preview, handoff readiness, middleman path, foreman action, nudge state, worker snapshot, and evidence links. Live proof `proof-board-2026-05-17.json` and `.md`, `linear-issue-preview-proof-board-2026-05-17.*`, `jules-manifest-preview-proof-board-2026-05-17.*`, `handoff-readiness-proof-board-2026-05-17.*`, `git-disposition-review-proof-board-2026-05-17.*`, `middleman-path-2026-05-17.*`, `foreman-action-packet-2026-05-17.*`, `symphony-foreman-console.png`, `symphony-dashboard-density.png`, and `symphony-worker-mode-packet.png` shows the Codex in-app browser loaded the relevant dashboard/proof surfaces and saw the expected status fields. | Continue using only the in-app browser for follow-along live checks. |
| Browser tooling health | The direct Playwright MCP path can return `Transport closed`, but the Browser plugin in-app bridge successfully listed the current Jules tab, read visible Jules state, and captured a screenshot. Current visible ARA-6 state showed `Ready for review`, `View PR`, changed-file review entries, `Time: 51 mins`, and `Check Suite Failure` with four failed checks. The main dashboard and `/proof` now link to read-only `GET /api/v1/browser-tooling-health`, and `verify-browser-tooling-health.mjs` proves that packet exposes the primary Codex Browser plugin bridge, the known direct-Playwright `Transport closed` failure mode, allowed/disallowed uses, observed ARA-6 evidence, next expected proof, and false external/local mutation flags. | Later improvement: if the Codex app exposes a safe server-queryable browser bridge health signal, fold that live signal into the packet without turning terminal scrollback into canonical task state. |
| Full end-to-end path | Not complete. Current live proof covers preflight-blocked dashboard intake, read-only observed PR monitoring for PR #900 and PR #929, one real observed-PR due refresh against PR #900, a separate dashboard draft created from PR #900 learning without repairing that historical PR, non-mutating Git disposition review for the blocked queue (`git-disposition-review-2026-05-17.*`), non-mutating Git sync execution receipt for that blocked queue (`git-sync-execution-receipt-2026-05-17.*`), non-mutating Linear issue preview for that blocked draft, Jules manifest preview for that blocked draft, non-mutating handoff-readiness packet for that blocked draft (`handoff-readiness-2026-05-17.*`), blocked launch-readiness cards for real observed-PR handoffs (`jules-launch-readiness-2026-05-17.*`), one global middleman path that preserves the current Git boundary and keeps observed PRs out of launch/local-sync claims (`middleman-path-2026-05-17.*`), a current-boundary foreman action packet for operator-owned Git disposition (`foreman-action-packet-2026-05-17.*`), local `verify-middleman-foreman-pass-path.mjs` proof that the same packet will pick the correct future foreman action and evidence endpoint across Linear/Jules/GitHub/local-sync boundaries, local `verify-scout-core-readiness-packet.mjs` proof that the GitHub PR review boundary separates read-only Scout/Core evidence from explicit Core merge, local `verify-deployment-readiness-packet.mjs` and `verify-deployment-evidence-receipt.mjs` proof that the deployment boundary separates read-only GitHub Pages/deployment evidence from local sync and requires success or waiver before sync, local `verify-local-sync-readiness-packet.mjs` proof that the final local-sync boundary separates read-only refresh evidence from guarded Git mutation, and compact proof-board follow-along state for the blocked queue. | Real dashboard-started task must pass sync, create/link Linear, stage/launch Jules, produce/refresh PR, expose Scout/Core readiness, prove live deployment state, and prove local sync. |

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
8. The docs, audit, task queue, proving-ground tracker, and decision ledger
   reflect any workflow/documentation friction discovered during the run, with
   either local repair proof or an explicit logged gap.
