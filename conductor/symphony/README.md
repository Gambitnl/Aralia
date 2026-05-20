# Symphony — Autonomous Agent Orchestrator

TypeScript implementation of [OpenAI Symphony](https://github.com/openai/symphony), adapted for the Aralia project.

Symphony is now Aralia's Jules delegation middleman. The dashboard is the front
door: draft a bounded task, let a Codex foreman clarify the plan when needed,
pass the GitHub sync preflight, create the Linear tracking issue, stage and
launch the Jules manifest, then monitor Jules sessions, GitHub PRs, GitHub Pages
deployment health, Scout/Core review, usage, approvals, and local sync.

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
6. **Reconciles ambiguous Jules state** with Codex app browser inspection when
   stored status and the visible Jules session disagree.
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
- Task detail surfaces should include a Delegation ROI ledger that reuses
  Codex token/runtime data, Jules and GitHub timestamps, human intervention
  counts, and explicit avoided-work estimates without presenting estimates as
  measured savings.
- Handoff cards preserve detailed PR and local-sync next actions, including
  `wait_for_checks`, `repair_failed_checks`, `core_validate_and_merge`,
  `review_local_changes`, and `sync_local_master`.
- Failed PR checks can also carry a read-only repair decision packet. The
  first live ARA-6 packet asks whether the operator wants a separate setup
  repair task, Jules feedback, manual wait, or refresh-after-repair before
  Symphony mutates GitHub or local files.
- The intended task view groups each task's description, current boundary,
  timeline, Linear issue, Jules session, GitHub PR, deployment state,
  expandable Jules prompt/dialogue, and task-scoped Codex chat. Pending
  human-input tasks should be obvious from the home dashboard.
- A terminal-simulator pane can be used as a live mirror for a local Codex
  foreman process or command stream, but structured task messages, decisions,
  blockers, and timestamps remain the durable task memory.
- The spec, audit, architecture overview, ordered open-task list, and per-task
  handoff docs should be updated as each implementation/proof stage advances.

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
