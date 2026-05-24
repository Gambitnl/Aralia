# Symphony — Autonomous Agent Orchestrator

TypeScript implementation of [OpenAI Symphony](https://github.com/openai/symphony), adapted for the Aralia project.

Symphony is now Aralia's Jules delegation middleman. The dashboard is the front
door: draft a bounded task, let a Codex foreman clarify the plan when needed,
pass the GitHub sync preflight, create the Linear tracking issue, stage and
launch the Jules manifest, then monitor Jules sessions, GitHub PRs, GitHub Pages
deployment health, Scout/Core review, usage, approvals, and local sync.

Start with `docs/SYMPHONY_NORTH_STAR.md` if you want the top-level objective,
what has been built so far, what still remains, and where the proving-ground and
workflow progress docs live.

The canonical operating spec is
`docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`. Use it for the full task and blocker
matrix; use `JULES_MIDDLEMAN_AUDIT.md` for current proof and remaining gaps.
Use `docs/SYMPHONY_MIDDLEMAN_ARCHITECTURE.md` for the high-level map of related
files, ownership boundaries, API surfaces, and verifier entry points.

Codex workers are foremen in this workflow. Their default job is to read the
dashboard/API, ask human-readable clarification questions through the task
surface, delegate bounded implementation to Google Jules, and babysit the GitHub
return path. They should only do broad local implementation when the operator
explicitly asks for local-only work.

When the docs or active goal say a mutation needs operator approval, read that
as an external or workflow-advancing boundary: Linear, Jules, GitHub, PR branch
updates, deployment waivers, local master sync, or user-visible task decisions.
Ordinary local Symphony implementation hygiene, including docs edits, verifier
updates, dashboard/API code edits, local verifier runs, and local checkpoint
commits, is not blocked on that approval unless it would push, launch, merge,
sync, contact external systems, or claim that a live boundary advanced.
The canonical approval-boundary table lives in
`docs/JULES_MIDDLEMAN_OPERATING_SPEC.md#approval-boundaries`; update that table
first when adding a new guarded action.
The canonical workflow-phase table lives in
`docs/JULES_MIDDLEMAN_OPERATING_SPEC.md#workflow-phases`; update that table
first when adding or renaming a phase in the dashboard-created path.
For the current ARA-6 test flow, the operator has allowed Symphony/Codex to
assume approval at each phase boundary, but every assumed approval must be
reported with the decision point, options, decision made, rationale/evidence,
mutation performed or skipped, and next proof.

## Quick Start

### Safe smoke test with the mock agent

This verifies Symphony itself without letting a real coding agent edit files:

```powershell
npm install
npm run build
npm run start -- WORKFLOW-mock.md --port 8091
```

Then open:

- Dashboard: http://127.0.0.1:8091/
- JSON state: http://127.0.0.1:8091/api/v1/state

The mock tracker leaves `MOCK-1` in `Todo`, so the orchestrator will keep running
the mock agent again after each completed worker cycle. That is expected for the
smoke test; a real workflow needs the agent or operator to move the Linear issue
out of an active state.

### Dashboard-only preflight inspection

Use this when you want to inspect the real dashboard and GitHub sync gate without
claiming Linear issues, polling mock issues, or starting Codex workers:

```powershell
npm run build
npm run start -- WORKFLOW.md --port 8091 --dashboard-only
```

Open the dashboard in the Codex app browser so the operator can follow along.
`--dashboard-only` still serves `/api/v1/task-drafts` and `/api/v1/git-preflight`,
but it keeps worker dispatch off until the GitHub sync blockers are intentionally
resolved.

For live Jules follow-along, prefer the Codex Browser plugin's in-app browser
bridge. Direct Playwright MCP calls can report `Transport closed` even when the
already-signed-in Jules tab is still readable through the Browser plugin bridge.
Terminal Playwright remains useful for repeatable local dashboard verification,
but it is not the operator-visible Jules observation surface.
The dashboard and `/proof` page both show this as `Browser Follow-along`
guidance so future foremen do not mistake a failed transport path for a missing
Jules state. The same rule is available as read-only
`/api/v1/browser-tooling-health`, which names the Browser plugin bridge as the
primary path, records direct Playwright `Transport closed` as a known unreliable
path, lists allowed/disallowed uses, and reports false mutation flags.

### Linear-backed smoke test with the mock agent

This checks the Linear polling path while still using the fake agent:

```powershell
$env:LINEAR_API_KEY = "lin_api_..."
npm run build
npm run start -- WORKFLOW.md
```

`WORKFLOW.md` currently points at Linear project `f88c771f52b2` and serves the
dashboard on http://127.0.0.1:8081/.

### Real Codex worker status

The installed Codex binary does provide `codex app-server`, and
`src/agent-runner.ts` now uses the current app-server handshake shape:

- start threads with `thread/start`, not `thread/create`
- read `result.thread.id`, not `result.thread_id`
- start turns with `threadId` and `input: [{ type: "text", text: "..." }]`, not
  `thread_id` and `prompt`
- read `result.turn.id`, not `result.turn_id`

The mock workflow verifies that Symphony sends and receives that shape. A live
Codex worker still needs a careful first run on a low-risk Linear issue because
it can edit files inside the issue workspace.

You can inspect the installed protocol with:

```powershell
codex app-server generate-json-schema --out .tmp-codex-schema
```

```bash
# 1. Install dependencies
npm install

# 2. Set your Linear API key
export LINEAR_API_KEY="lin_api_..."   # Linux/Mac
$env:LINEAR_API_KEY="lin_api_..."     # PowerShell

# 3. Edit WORKFLOW.md with your project slug and repo URL

# 4. Start Symphony
npm start
# or: npm start -- ./path/to/WORKFLOW.md
```

## Prerequisites

| Requirement | How to get it |
|-------------|--------------|
| **Linear API key** | Settings → Security & access → Personal API keys |
| **Linear project slug** | Right-click project → copy URL → slug is in the URL |
| **Codex CLI** | `npm install -g @openai/codex` (needs app-server support) |
| **Node.js 18+** | Required for native `fetch` support |

## Architecture

```
src/
├── index.ts             # CLI entry point
├── orchestrator.ts      # Poll loop, dispatch, reconciliation, retry
├── workflow-loader.ts   # WORKFLOW.md parser (YAML + Liquid)
├── config.ts            # Typed config resolution + validation
├── linear-client.ts     # Linear GraphQL adapter
├── workspace.ts         # Per-issue workspace management
├── agent-runner.ts      # Codex app-server subprocess client
├── prompt-renderer.ts   # Liquid template rendering
├── logger.ts            # Structured key=value logging
└── types.ts             # All domain types + error classes
```

## How It Works

1. **Checks GitHub sync** before Jules work starts. Local master must match the
   configured GitHub base, be on the right branch, and have no unpushed or
   accidental local changes that Jules cannot see.
2. **Captures dashboard drafts** through `/api/v1/task-drafts` so the user can
   start work without knowing Linear project internals.
3. **Creates Linear tracking issues** when the active workflow requires them,
   preserving the GitHub sync receipt and the Jules/Scout/Core acceptance
   contract.
4. **Stages and launches Jules manifests** through the existing Aralia Jules
   orchestrator instead of inventing a second cloud-task system.
5. **Tracks Jules sessions and GitHub PRs** including checks, mergeability,
   changed-file risk, conflict-prone files, plan approvals, and operator
   feedback.
6. **Reconciles ambiguous Jules state** with Jules API/GitHub fallback evidence
   and Codex app browser inspection when stored status and the visible Jules
   session disagree.
7. **Routes review through Scout/Core** before merge and checks GitHub Pages
   deployment health for published-app changes before local sync.
8. **Surfaces live observability** for approvals, spending/usage, worker
   designations, readable activity, and the local return path.
9. **Measures delegation ROI** per task so the operator can see whether Jules
   actually reduced Codex usage. Measured Codex tokens/runtime must stay
   separate from estimated avoided local Codex work.

## Dashboard Contract

The dashboard-first control surface is both human-facing and worker-facing.
Foreman workers should prefer these API fields over guessing route names or
reconstructing state from raw events:

- `/api/v1/task-drafts` is the task queue and Jules handoff API.
- Top-level `next_action` is the one safest next dashboard action for the queue.
  It carries `url`, `method`, optional `request_body_schema`, PR/session links,
  and Scout/Core or local-sync command context when relevant.
- `conflict_watch` reports active Jules PR overlaps and conflict-prone files.
  `blocked` means overlapping PR files need Scout arbitration; `attention`
  means risky files need Scout review even if there is only one PR.
- `/api/v1/git-preflight` is the hard GitHub sync preflight. It is a `POST`
  endpoint because it fetches GitHub before reporting whether Jules may start.
- `/api/v1/state` exposes `worker_roster`, `rate_limits`, model/reasoning
  assignment, approval policy, and dashboard control URLs so a foreman can
  identify its assignment and the user can see spending and approval pressure.
- `/api/v1/browser-tooling-health` is a read-only follow-along packet. It does
  not query Jules or control the browser; it records the operational rule that
  live Jules checks should use the Codex Browser plugin bridge first and that
  direct Playwright `Transport closed` is a known unreliable path.
- `/api/v1/jules-handoffs/:id/deployment-readiness` is the stable read-only
  deployment gate for a handoff after merge and before local sync. Task detail
  JSON links to it as `links.deploymentReadiness`; the endpoint reports
  GitHub Pages/latest-build and deployment-status inspection commands and
  guidance without creating deployments, rerunning Actions, mutating GitHub,
  pulling Git, or editing local files.
- Task detail surfaces should include a Delegation ROI ledger that reuses
  Codex token/runtime data, Jules and GitHub timestamps, human intervention
  counts, and explicit avoided-work estimates without presenting estimates as
  measured savings. The current baseline renders that ledger on handoff cards
  and deliberately reports `ROI unknown` until measured task-scoped Codex spend
  and a documented avoided-work estimate are both present. The local
  foreman-usage control records measured task-scoped Codex tokens/runtime/turns
  in Symphony only when that work is not captured by worker totals. Broad
  `codex_goal_context` receipts stay visible as goal-context usage, but they do
  not count as task-scoped savings proof. The local ROI estimate control records
  method, confidence, caveats, avoided turns/tokens, and avoided debugging
  cycles in Symphony only. Neither path calls Jules, GitHub, Linear, writes
  local files, or mutates local Git.
- Handoff cards now also render a read-only `handoffTimeline` as `Task timeline`.
  It keeps task creation, Linear, Jules, GitHub PR, repair-decision, ROI, and
  future local-sync evidence in chronological order without making the browser a
  second state owner.
- The dashboard now renders a read-only `Task navigator` before the detailed
  handoff board. It counts all local Symphony tasks, tasks needing input, open
  tasks, completed tasks, and archived tasks, includes display-only filter
  buttons for those same buckets, then links to the existing draft or handoff
  card that owns the detailed receipts. It also shows a compact read-only `Task
  detail` preview for the first visible task with current boundary, timeline
  count, expected-file/test counts, and Linear/Jules/GitHub links when present.
  The preview now links to a dedicated `/tasks/:id` task page plus the
  non-mutating `GET /api/v1/tasks/:id` task-detail JSON endpoint. The page is
  the first standalone task workspace: it shows current boundary, safety flags,
  links, task messages, timeline, scope, verification, the Jules handoff prompt,
  Jules dialogue/approval history, and expandable readiness packets from the
  same task store. The page and preview can record local operator-to-Codex task
  messages through `POST /api/v1/tasks/:id/messages`; those notes stay in
  Symphony task state and do not send Jules feedback, call Linear/GitHub, or
  mutate local Git. The same task detail packet now carries local
  `taskClarifications` and derived `clarificationState`, and
  `POST /api/v1/tasks/:id/clarifications` records a Codex-foreman question plus
  optional operator answer without crossing the Linear/Jules/GitHub boundary.
  The task page can also record a local task filing through
  `POST /api/v1/tasks/:id/disposition`, so stale, completed, archived, or
  abandoned work can be triaged without closing Linear, messaging Jules,
  changing GitHub, or mutating Git.
- Handoff cards also render `julesStateReconciliation`. This packet explains
  whether a stale local Jules record was reconciled from Jules API or GitHub
  evidence, or whether a completed Jules session still needs browser/API proof
  before Symphony should claim a PR boundary is complete.
- Handoff cards preserve detailed PR and local-sync next actions, including
  `wait_for_checks`, `repair_failed_checks`, `core_validate_and_merge`,
  `review_local_changes`, and `sync_local_master`.
- Failed PR checks can also carry a read-only repair decision packet. The
  first live ARA-6 packet asks whether the operator wants a separate setup
  repair task, Jules feedback, manual wait, or refresh-after-repair before
  Symphony mutates GitHub or local files.
- The intended task view groups each task's description, current boundary,
  timeline, Linear issue, Jules session, GitHub PR, deployment state,
  Jules prompt/dialogue history, and task-scoped Codex chat. Pending
  human-input tasks should be obvious from the home dashboard.
- Handoffs that need a human decision can expose an `operatorQuestion` packet.
  The dashboard renders this as `Needs your input` and shows a pending-human
  badge. The baseline packet honors weekday 01:00-09:00 Europe/Amsterdam quiet
  hours by reporting the next 09:00 local check time instead of busy-waiting.
  `Operator Preferences` can locally override or disable that quiet-hours
  window through `POST /api/v1/operator-preferences`; the preference only changes
  Symphony's waiting policy and does not call Jules, GitHub, Linear, local
  files, or Git.
  The matching `operator-answer` path records the chosen repair lane locally as
  `operatorAnswers`; it does not send Jules feedback, create Linear tasks,
  mutate GitHub, or touch local Git.
- The first repair-lane execution is `create_setup_repair_task`. It creates a
  local setup-repair draft and `repairLaneExecutions` receipt only, so the work
  can still pass through normal review, Git sync, Linear, and Jules gates later.
  Once that draft exists, the routing packet treats it as the next actionable
  subject and recommends local-careful Codex repair before sending more Jules
  feedback.
- When that local repair produces a commit, Symphony can record a
  `repairPushReadiness` packet. The dashboard shows `Repair push readiness`
  with the branch, commit, changed files, verification, target PR, and push
  command, while still keeping the push disabled because it mutates GitHub and
  needs explicit operator approval.
- After an operator-approved push happens outside Symphony, the dashboard can
  record a local `repairPushResult` receipt. That receipt shows `Repair push
  result`, the pushed commit, resulting PR head, evidence URL, GitHub checks
  command, Symphony PR refresh endpoint, and next `github_checks_rerun`
  boundary. The `Record Repair Push Result` control lives under repair-push
  readiness and records only this receipt; it does not push, rerun checks, merge,
  pull, or edit local files itself.
- Task detail pages also show `Guarded Operator Actions` when a handoff has
  commands or endpoints for the current boundary. These entries expose the
  current Symphony endpoint, marked Jules PR feedback command, prepared repair
  push command, or future local-sync command as runbook text with mutation
  flags. They are not automatic execution buttons.
- After merge, Symphony derives `deployment_readiness` before local sync. This
  read-only packet is also available at
  `/api/v1/jules-handoffs/:id/deployment-readiness`, points at GitHub
  Pages/latest-build and deployment-status inspection commands, keeps observed
  PR records read-only, and keeps local sync from becoming the next trusted step
  until deployment proof exists or the operator explicitly waives that gate. The local deployment-evidence action
  records `deploymentEvidence` on the handoff without calling GitHub or touching
  local Git; only `passed` or `waived` evidence unlocks the local-sync action.
- A terminal-simulator pane can be used as a live mirror for a local Codex
  foreman process or command stream, but structured task messages, decisions,
  blockers, and timestamps remain the durable task memory.
- The spec, audit, architecture overview, ordered open-task list, and per-task
  handoff docs should be updated as each implementation/proof stage advances.
  Documentation maintenance is an ongoing part of the Symphony goal, not a
  cleanup step after implementation. Read-only status refreshes should say what
  was observed, what did not mutate, and which operator-owned boundary remains
  next.

## Configuration

All configuration lives in `WORKFLOW.md` via YAML front matter. See the included template for all options. Key settings:

- `tracker.project_slug` — your Linear project
- `workspace.root` — where workspaces are created
- `agent.max_concurrent_agents` — parallel agent limit
- `agent.max_turns` — max turns per agent session
- `hooks.after_create` — shell script to bootstrap workspaces (e.g., git clone)

- `codex.model` - optional Codex model override for Symphony-launched foremen
- `codex.reasoning_effort` - optional thinking level override for worker turns

Changes to WORKFLOW.md are detected and hot-reloaded without restart.

## Spec Compliance

Implements all **Core Conformance** requirements from [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md) Sections 18.1.
