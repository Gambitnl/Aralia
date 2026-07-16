# Agora — Peer-Agent Coordination Protocol

**Reference for any agent (or human) sharing the `F:\Repos\Aralia` checkout.**
Design spec (source of truth): [`docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md`](../../docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md)
**Orchestrating a multi-agent campaign?** Read [`ORCHESTRATOR.md`](./ORCHESTRATOR.md) — the
board + agent matrix (external CLIs) + project tracker, end to end. This file is the per-agent API.

---

## What Agora is and why it exists

Multiple Claude Code (and other) agents run concurrently against the **same** Aralia
working tree. They have no built-in way to coordinate, so they clobber each other — most
destructively via `git reset --hard` / `git checkout`, which silently wipes a sibling's
uncommitted work.

**Agora** is a small local daemon that is the single source of truth for four coordination
primitives among co-equal peer agents:

Campaign governance is the orchestrator-level layer on top of those peer primitives: it records
which lead or deputy orchestrator owns a broad wave scope before packet tasks are seeded.

- **Presence** — who is currently working the tree.
- **Locks (advisory)** — which files/globs an agent has claimed before editing.
- **Reservations (FIFO dibs)** — visible wait lists for files an agent needs after the
  current owner; a reservation never replaces the lock requirement.
- **Task board** — work items that can be posted, claimed, transitioned, and handed off.
- **Messaging** — direct or broadcast notes between agents.

> ⚠️ **Locks are advisory / honor-system.** There are no Claude-Code hooks; the daemon
> **cannot physically block** a file write or a `git reset`. It works only because every
> agent chooses to check in. Discoverability and cooperation are make-or-break — that is
> why this protocol, the tracker beacon, and the `agora-coordination` skill exist.

---

## Is it up? (cheap probe)

```bash
curl -s http://localhost:4319/health
```

A JSON body with `"ok": true` means the daemon is running. Connection refused means it is
not — start it (below).

## Starting the daemon

```bash
npm run agora
# == node tools/agora/server.mjs
# Listens on http://localhost:4319, runtime state in .agent/agora/
```

Flags / env (optional):

| Override | CLI flag | Env var | Default |
|---|---|---|---|
| Port | `--port 4400` / `--port=4400` | `AGORA_PORT` | `4319` |
| Runtime dir | `--dir <path>` / `--dir=<path>` | `AGORA_DIR` | `<repo>/.agent/agora` |

A relative `--dir` resolves against the cwd you launched from. `SIGINT`/`SIGTERM` (Ctrl-C)
writes a final snapshot and exits cleanly.

---

## Authentication

- `POST /agents/register` is **open** (no token) and returns your `token`.
- **All mutating endpoints** (`POST /locks`, `DELETE /locks/:id`, `POST /reservations`,
  `DELETE /reservations/:id`, `POST /tasks*`, `POST /messages`, `POST /agents/heartbeat`) require
  `Authorization: Bearer <token>`. Missing/invalid → **`401`**
  `{ "error": "unauthorized: missing or invalid bearer token" }`.
- **All GET read endpoints** (`/agents`, `/locks`, `/reservations`, `/tasks`, `/messages`, `/health`,
  `/events`, `/`) are **open** so the dashboard works token-free. `/messages` accepts an
  *optional* bearer to resolve `?to=me`.
- Every authenticated request updates `lastSeen`. Meaningful authenticated activity also
  refreshes `lastMeaningfulAt`; the dedicated heartbeat endpoint updates only
  `lastHeartbeatAt`, so a detached helper cannot extend presence forever.

---

## HTTP API (transcribed from `server.mjs`)

Default base URL: `http://localhost:4319`. All bodies are JSON. A malformed JSON body on a
`POST` returns **`400`** `{ "error": "invalid JSON body" }`; a body over ~1 MB is rejected.
An unmatched route returns **`404`** `{ "error": "no route for <METHOD> <path>" }`. An
unhandled handler error returns **`500`** `{ "error": "internal error: ..." }`.

### Presence

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/agents/register` | none | `{ "handle": string, "note"?, "unique"?, "model"?, "sessionId"? }` | `201 { agentId, token, handle, registeredAt, model, sessionId }` | `400` if `handle` missing; `409` if a live agent already holds `handle` |
| POST | `/agents/heartbeat` | Bearer | — | `200 { ok: true, expiresAt, remainingMs }` | `401`; `404` if the agent is gone; `410` when the heartbeat-only lease expires |
| GET | `/agents` | none | — | `200 { agents: [...] }` | — |

`GET /agents` returns each active agent as
`{ id, handle, token, registeredAt, lastSeen, lastMeaningfulAt, lastHeartbeatAt, status, note, model, sessionId }`
where `status` is `"online"` or `"stale"`. `registeredAt` is the check-in moment; `lastSeen` is
the latest authenticated touch, `lastMeaningfulAt` excludes heartbeat-only traffic, and
`lastHeartbeatAt` is the latest explicit heartbeat. `model` and `sessionId` are optional provenance: which model
the agent is (usually stamped by the orchestrator at launch via `--model`) and the agent's own
harness conversation/thread id (`--session`/`--thread`/`--conversation`, so an agent can query
which session it is via `whoami`). Agents not seen within the **drop** window are omitted.

**Handle-claim uniqueness (2026-07-04):** register **refuses a handle a still-live agent
already holds** — `409 { error, conflict: { handle, heldBy, status } }`. This is the daemon
acting as the name registry: an agent can't silently adopt another's identity. A name is
reclaimable once its previous holder is reaped (dropped). Pass `"unique": false` to opt out
(legacy re-register). Solo agents that have no assigned name should `register --random` — the
client generates a unique candidate and claims it, retrying on the rare clash. Because the
daemon already assigns a unique `agentId`+`token` and records `claimedBy`/`history` by
`agentId` on every task and lock, identity and task-ownership are authoritative server-side;
the client-side `AGORA_AGENT_ID` only decides which local file caches your token between
invocations.

> Note: the registration `token` IS returned in the `GET /agents` payload (the store does
> not strip it). Treat the local daemon as trusted; tokens are not secrets across agents.

### Locks (advisory)

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/locks` | Bearer | `{ "paths"?: string[], "globs"?: string[], "reason"?: string, "ttlMs"?: number }` | `201 { lock }` | `409 { conflict }` on overlap; `400` if neither paths nor globs given; `401` |
| GET | `/locks` | none | — | `200 { locks: [...] }` | — |
| DELETE | `/locks/:id` | Bearer | — (query `?force=1`) | `200 { ok: true }` | `404` if not found; `403` if you are not the holder (non-force); `409` if `force=1` but the holder is still online; `401` |

- A lock is `{ id, paths[], globs[], agentId, reason, createdAt, expiresAt }`.
- **Default TTL is 30 min** (1,800,000 ms); pass `ttlMs` to override. Locks auto-expire so a
  dead agent never deadlocks the tree. Expired locks are swept (`lock.expired` event) every
  30 s and are excluded from `GET /locks`.
- **Conflict shape** (`409`): `{ "conflict": { "path": <offending token>, "heldBy": <agentId>, "lock": <full held lock> } }`.
- **Overlap rules** (see `globToRegExp`/`tokensOverlap` in `store.mjs`): exact path == path;
  a glob (`*`, `**`, `?`) matched against a path; two **equal** globs. `**` crosses `/`;
  `*`/`?` do not. An agent may freely re-lock paths it **already holds** (no self-conflict).
- **Only the holder may release** (`DELETE`) — with one escape hatch: `DELETE /locks/:id?force=1`
  lets any authenticated agent release a lock whose holder is **stale or gone** (no
  authenticated call within the presence TTL). Force against an **online** holder is refused
  with `409` — a live agent's lock is never yanked out from under it.
- **Dead-agent reaping:** when an agent passes the presence **drop** horizon (60 min without
  any authenticated call), the sweep releases all its locks and reservations immediately (no
  waiting out the lock TTL), reopens its `claimed`/`in_progress` tasks (history entry
  `action: "reaped"`), and deletes the agent record — its token stops working and a returning
  agent must re-register. Explicit heartbeats may bridge a quiet period, but heartbeat-only
  presence is capped at 2 hours from the last meaningful authenticated activity. Once that
  lease expires, the next heartbeat returns `410` and performs the same cleanup immediately.

### Reservations (FIFO dibs)

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/reservations` | Bearer | `{ "paths"?: string[], "globs"?: string[], "reason"?: string }` | `201 { reservation }` | `400` if neither paths nor globs given; `401` |
| GET | `/reservations` | none | — | `200 { reservations: [...] }` | — |
| DELETE | `/reservations/:id` | Bearer | — | `200 { ok: true }` | `404` if not found; `403` if you are not the reserver; `401` |

- A reservation is `{ id, paths[], globs[], agentId, reason, createdAt, queueSeq, position }`.
  `queueSeq` is the durable insertion order; `position` is the current # in the overlapping
  waiting list after fulfilled/released reservations are removed.
- Reservations are a visible waiting room, not edit permission. An agent may edit only after
  it successfully acquires a lock.
- Queue order is FIFO across overlapping path/glob tokens. If agent B tries to lock a file
  while agent A is first in the overlapping reservation queue, `POST /locks` returns
  `409 { conflict: { type: "reservation", path, reservation } }`.
- When the #1 reserver successfully locks an overlapping file, that reservation is fulfilled
  and removed automatically. Remaining agents move up one position.
- Reservations owned by a dropped agent are released by the same reaper that releases its
  locks and reopens its claimed tasks.

### Campaign governance

Campaigns are first-class board records for orchestrators. They are advisory like locks, but
lead-vs-lead overlap is a hard pre-seed failure so two orchestrators do not unknowingly launch
waves over the same file domain. Deputies can join an existing lead campaign when they name the
lead explicitly and declare their own bounded paths/globs.

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/campaigns` | Bearer | `{ "id"|"campaignId": string, "role"?: "lead"|"deputy", "leadCampaignId"?, "scope"?, "paths"?: string[], "globs"?: string[], "wave"? }` | `201 { campaign, warnings }` | `400` for missing id/scope tokens or invalid deputy lead; `409` on active lead overlap; `401` |
| GET | `/campaigns` | none | query `?state=` | `200 { campaigns: [...] }`; each record includes `ownerStatus` and `ownerLive` | - |
| POST | `/campaigns/:id/state` | Bearer | `{ "state": "active"|"blocked"|"done" }` | `200 { campaign }` | `404` unknown campaign; `403` non-owner; `400` invalid state; `401` |

- A campaign is `{ id, role, leadCampaignId, agentId, ownerStatus, ownerLive, scope, paths[],
  globs[], wave, state, warnings[], createdAt, updatedAt, history[] }`. `ownerStatus` is
  `online | stale | gone`. `ownerLive` is a compatibility shortcut for `ownerStatus !== "gone"`.
- `role: "lead"` is the default. A lead claim fails with `409` if any requested path/glob
  overlaps another live active lead campaign.
- `role: "deputy"` requires `leadCampaignId` naming a live active lead. Deputies may overlap
  that lead; overlaps with unrelated active leads still fail. Overlaps with sibling deputies
  return warnings so the lead can coordinate boundaries.
- An active campaign whose owner is no longer live may be re-claimed under the same campaign
  id. The successor becomes the owner, the original `createdAt` is preserved, and history gets
  an `adopted` entry naming the previous owner. A live owner's campaign cannot be taken over.
- `orchestrate seed <plan>` claims a campaign before creating tasks. If packet refs include
  `planmap:<topic>/<feature>`, the campaign id/scope are extracted from
  `public/planmap/topics.json` (`planmap:<campaign-key>:<topic-id>` plus the campaign label and
  topic title). Explicit `plan.campaign.id` or `plan.campaignId` still override for non-roadmap
  waves. Packet files become campaign paths unless `plan.campaign.paths` or
  `plan.campaign.globs` add broader scope.

### Task board

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/tasks` | Bearer | `{ "title": string, "body"?: string, "deps"?: taskId[], "priority"?: number, "refs"?: string[], "campaignId"?, "wave"? }` | `201 { task }` (state `open`) | `400` if `title` missing/not a string, a dep id is unknown, or campaignId is unknown; `401` |
| POST | `/tasks/:id/claim` | Bearer | — | `200 { task }` (state `claimed`) | `404` not found; `409` if already claimed by another agent; `401` |
| POST | `/tasks/claim-next` | Bearer | optional `{ "campaignId"?: string, "category"?: string }` (the same filters are accepted as query parameters) | `200 { task }` — the top-priority matching READY task, atomically claimed; `200 { task: null }` when nothing is ready | `400` invalid JSON; `401` |
| POST | `/tasks/:id/state` | Bearer | `{ "state": "open"|"claimed"|"in_progress"|"blocked"|"done", "result"?: string }` | `200 { task }` | `404` not found; `400` invalid state; `401` |
| POST | `/tasks/:id/handoff` | Bearer | `{ "toAgentId": string }` | `200 { task }` | `404` not found; `400` if the target is missing, unregistered, or beyond the drop horizon; `401` |
| GET | `/tasks` | none | — (query `?state=`, `?ready=1`) | `200 { tasks: [...] }` | — |

- A task is
  `{ id, title, body, campaignId, wave, state, createdBy, creatorAgent, claimedBy, deps[], priority, refs[], result, createdAt, updatedAt, history[] }`.
- `state` ∈ `open | claimed | in_progress | blocked | done`.
- **`creatorAgent` is mandatory on new tasks.** It is a token-free snapshot of the registered
  creator `{ id, handle, note, model, sessionId }`, stamped when the task is created so the
  creator remains inspectable after presence drops the live agent row. `POST /tasks` rejects
  an unregistered creator; clients should treat missing or mismatched creator metadata as a
  coordination blocker.
- **`deps`** (task ids) gate readiness: a task is **ready** when it is `open` and every dep
  is `done`. Creating a task with an unknown dep id → `400` (fail honestly, no dangling
  references). **`priority`** (number, default 0, higher first) orders the ready queue.
  **`refs`** (free strings, e.g. `spells:G12` or a doc path) link the task to project-tracker
  artifacts — see `tools/agora/gapIndex.mjs` for the GAPS.md side of the bridge.
- **`result`**: pass it with `state: "done"` to record WHAT was done (files touched, proof,
  test counts) on the task itself — orchestrators read results from the board instead of
  scraping chat messages. Stored on the task and in the history entry.
- `GET /tasks?ready=1` returns only ready tasks, **sorted by priority desc, then FIFO** —
  the dispatch queue view. `POST /tasks/claim-next` claims its head atomically. Optional
  `campaignId` and `category` filters restrict that atomic pull to one lane; omitting both
  keeps the original global queue. Workers loop `claim-next` → work → `done` with result.
- A handoff is accepted only when the target agent is still registered and inside the presence
  drop horizon. This prevents a typo or dead identity from becoming a permanent task owner.
- `history` entries look like `{ at, by, action, state, ... }` (`action` ∈
  `created | claimed | state | handoff | reaped`).
- `GET /tasks?state=in_progress` filters by state.
- Claiming a task already `claimed`/`in_progress` by **another** agent → `409`. Re-claiming
  your own is allowed.
- Each sweep also reopens a claimed/in-progress task whose `claimedBy` identity has no roster
  record. The `reaped` history entry records `reason: "orphan claimant missing from roster"`
  and the previous claimant id, repairing strands created before target validation existed.

### Messaging

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/messages` | Bearer | `{ "body": string, "to"?: agentId | "all", "channel"?: "main" | "command" }` | `201 { message }` | `400` if `body` missing/not a string; `401`; `403` if a worker posts on `command` |
| GET | `/messages` | none (Bearer for `to=me`) | — (query `?since=<seq>&to=<me|all|agentId>&channel=<main|command|all>`) | `200 { messages: [...] }` | — |

- A message is `{ id, seq, from, to, body, channel, createdAt }`. `to` defaults to `"all"`,
  `channel` to `"main"` (pre-channel messages count as main).
- `seq` is a **monotonic per-message cursor**; poll with `?since=<lastSeq>` to get only new
  messages.
- **The command channel is a role-gated control plane.** Only agents registered with
  `role` `orchestrator`, `master`, or `human` may POST with `channel: "command"`; the
  default `worker` role gets `403`. Register a role via `POST /agents/register`
  `{ ..., "role": "orchestrator" }` or `client.mjs register <handle> --role orchestrator`.
  GET defaults to `channel=main`, so workers polling their inbox never see command
  traffic unless they ask (`--channel command|all`) — the gate is on posting, not reading.
  CLI: `say --channel command <body>`, `inbox --channel command`.
- `?to=all` (or omitted) → unfiltered. `?to=me` resolves your agent id from the bearer (no
  token ⇒ behaves like `all`). `?to=<agentId>` returns messages where that id is the
  sender **or** recipient, plus all broadcasts.

### Real-time (SSE)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/events` | none | `text/event-stream`; query `?since=<seq>` or `Last-Event-ID` header accepted |

On connect the server immediately sends **one `hello` event**, then streams every
subsequent store mutation live. A comment ping (`: ping`) is sent every ~20 s to keep the
connection alive.

**`hello` event** (the resync handshake — the store cannot replay arbitrary history):

```
id: <lastSeq>
event: hello
data: {
  "lastSeq": <number>,
  "clientSince": <number|null>,   // your ?since / Last-Event-ID, echoed for diagnostics only
  "version": "0.2.0",
  "snapshot": {
    "agents":    [...],   // == GET /agents
    "locks":     [...],   // == GET /locks
    "reservations": [...], // == GET /reservations
    "tasks":     [...],   // == GET /tasks
    "campaigns": [...]    // == GET /campaigns
  }
}
```

> ⚠️ `?since` / `Last-Event-ID` are **echoed but NOT replayed** — the gap is not resent. The
> client must re-sync from the `hello` snapshot and then consume live events. (Messages are
> not in the `hello` snapshot; fetch them via `GET /messages?since=`.)

**Live events** after `hello` are emitted as:

```
id: <seq>
event: <type>            // agent.register | agent.touch | agent.drop |
                         // lock.acquire | lock.release | lock.expired |
                         // reservation.create | reservation.release | reservation.fulfill |
                         // campaign.claim | campaign.state |
                         // task.create | task.claim | task.state | task.release |
                         // task.handoff | message.post
data: { ...payload, "type": <type>, "ts": <ms>, "seq": <seq> }
```

Browser dashboards use `EventSource`. Single-shot Bash tool calls **cannot** hold a
long-lived stream, so agents should **poll** `GET /messages?since=`, `GET /locks`, etc.
instead of subscribing to SSE. (`curl -N http://localhost:4319/events` works for a human or
a `client.mjs watch` session.)

### Meta

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/health` | none | `200 { ok: true, version, uptime, port, counts: { agents, locks, reservations, tasks, campaigns, messages }, lastSeq }` |
| GET | `/` (also `/dashboard`, `/dashboard/<file>`) | none | `200` dashboard HTML (placeholder page until the dashboard slice ships) |
| GET | `/docs` | none | `200 { docs: [{ name, path, relPath }] }` — the whitelisted reference docs (PROTOCOL, ORCHESTRATOR, WORKFLOW_GAPS, COLD_START_ORCHESTRATOR_PROMPT) |
| GET | `/docs/:name` | none | `200` pretty HTML page; `?raw=1` returns the plain markdown (what agents/copy buttons consume). Unknown name → `404` |
| GET | `/gaps` | none | `200 { gaps, count }` — the tracker gap index (docs/projects GAPS.md + the workflow registry) as JSON; `?project=` filters, `?open=1` open-only. Cached ~60s |
| GET | `/gaps/view` | none | `200` browsable HTML of the gap registries; `?project=` shows one project's tracker card |

---

## Data model (from `store.mjs`)

```
Agent   { id, handle, token, registeredAt, lastSeen, lastMeaningfulAt,
          lastHeartbeatAt, status, note }
Lock    { id, paths[], globs[], agentId, reason, createdAt, expiresAt }
Reservation { id, paths[], globs[], agentId, reason, createdAt, queueSeq, position }
Campaign { id, role, leadCampaignId, agentId, scope, paths[], globs[], wave, state,
           warnings[], createdAt, updatedAt, history[] }
Task    { id, title, body, campaignId, wave, state, createdBy, creatorAgent, claimedBy, deps[], priority, refs[],
          result, createdAt, updatedAt, history[] }
Message { id, seq, from, to, body, createdAt }     // to = agentId | "all"
Event   { seq, type, payload, ts }                  // journal line + SSE envelope
```

Tunables (store defaults): presence **online** TTL 10 min (`presenceTtlMs` 600,000),
presence **drop** 60 min (`presenceDropMs` 3,600,000), heartbeat-only lease 2 hours
(`heartbeatOnlyLeaseMs` 7,200,000), lock TTL 30 min (`lockTtlMs` 1,800,000), snapshot every
200 events. (Note: the spec mentions a presence TTL but does not fix the exact numbers; the
code values above are authoritative.)

---

## Runtime state & the `git clean` caveat

Runtime state lives in **`.agent/agora/`**:

- `snapshot.json` — periodic full-state snapshot (atomic write-then-rename).
- `journal.jsonl` — append-only event log since the last snapshot. On start the daemon
  loads the snapshot then replays the journal tail.

**`.agent/agora/` is gitignored** specifically so a sibling agent's `git reset --hard`
cannot nuke the coordination state. ⚠️ **Caveat:** `git clean -fdx` removes ignored files
and **would** delete it — avoid `git clean -fdx` while Agora is in use, or restart the
daemon afterward (it rebuilds empty state).

---

## Etiquette / cooperative protocol

The whole system is honor-system. The loop every agent should follow:

1. **On arrival — register.** Get a `token`; announce your presence.
2. **Check before risky git ops.** Before any `git reset --hard` / `git checkout` /
   `git stash` that could discard work, `GET /locks` and `GET /agents`. If another agent
   holds locks or is online, **stop and coordinate** (message them) instead of clobbering.
3. **Lock paths BEFORE editing shared files.** `POST /locks` with the paths/globs you're
   about to touch. A `409` means someone else owns it or is first in the reservation queue.
   If you still need the file later, create a reservation and wait until your real lock
   succeeds; never edit from the reservation alone.
4. **Announce intent.** Post a task (`POST /tasks`) for non-trivial work, or `say` what
   you're doing (`POST /messages` to `"all"`).
5. **Release and retire on done.** `DELETE /locks/:id` when you finish a file; transition your
   task to `done`, report workflow feedback, then use `client.mjs retire --note "completed"`.
   Retirement releases any remaining locks, reservations, and active task claims before
   invalidating the token.
6. **Heartbeat occasionally** on long quiet stretches so you stay `online`. The CLI helper is
   bounded to 30 minutes by default and accepts `--owner-pid`/`AGORA_OWNER_PID`; re-run it only
   while the owning session is active. `--forever` is explicit and still cannot exceed the
   server's 2-hour heartbeat-only lease without meaningful authenticated activity.

---

## Copy-paste curl examples

```bash
# 0. Is it up?
curl -s http://localhost:4319/health

# 1. Register (open) — capture the token
TOKEN=$(curl -s -X POST http://localhost:4319/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"handle":"claude-A","note":"worldforge interiors"}' | \
  node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# 2. Lock files before editing (201 lock, or 409 conflict)
curl -s -X POST http://localhost:4319/locks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"paths":["src/foo.ts"],"globs":["src/components/Bar/**"],"reason":"refactor"}'

# 3. See who/what is active (open) — check before a risky reset
curl -s http://localhost:4319/agents
curl -s http://localhost:4319/locks
curl -s http://localhost:4319/reservations
curl -s http://localhost:4319/campaigns

# 3b. Reserve a contested file instead of jumping the lock queue
curl -s -X POST http://localhost:4319/reservations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"paths":["src/foo.ts"],"reason":"next edit after current holder"}'

# 3c. Orchestrators claim a campaign before seeding overlapping wave work
curl -s -X POST http://localhost:4319/campaigns \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"id":"world3d-wave","role":"lead","scope":"World3D repair wave","paths":["src/components/World3D/World3DScene.tsx"],"globs":["src/components/World3D/**"],"wave":"world3d-wave"}'

# 4. Post a task, then claim it
curl -s -X POST http://localhost:4319/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Wire interior stairs","body":"L4 multi-storey"}'
curl -s -X POST http://localhost:4319/tasks/<taskId>/claim -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:4319/tasks/<taskId>/state \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"state":"in_progress"}'

# 5. Broadcast a note / poll for new messages
curl -s -X POST http://localhost:4319/messages \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"to":"all","body":"editing src/foo.ts — please hold off"}'
curl -s "http://localhost:4319/messages?since=0&to=all"

# 6. Release the lock when done
curl -s -X DELETE http://localhost:4319/locks/<lockId> -H "Authorization: Bearer $TOKEN"
```

## `client.mjs` command equivalents (the common loop)

> The CLI (`tools/agora/client.mjs`) is built by a parallel slice. Per the design spec it
> wraps the same endpoints; the intended commands for the common loop are:

```bash
node tools/agora/client.mjs register <handle>        # POST /agents/register
node tools/agora/client.mjs lock src/foo.ts          # POST /locks
node tools/agora/client.mjs reserve src/foo.ts       # POST /reservations
node tools/agora/client.mjs reservations             # GET  /reservations
node tools/agora/client.mjs unreserve src/foo.ts     # DELETE /reservations/:id-or-path
node tools/agora/client.mjs campaign claim wave-a --role lead --path src/foo.ts
node tools/agora/client.mjs campaigns                # GET /campaigns
node tools/agora/client.mjs tasks                    # GET  /tasks (board)
node tools/agora/client.mjs say "editing src/foo.ts" # POST /messages (to=all)
node tools/agora/client.mjs watch                    # GET  /events  (SSE stream)
```

If a command name differs once `client.mjs` lands, the raw curl calls above are the ground
truth — every command maps onto the HTTP API in this document.

**Per-agent identity (`AGORA_AGENT_ID`)**: the client persists its registration
(agentId + token) in `.agent/agora/client-identity.json`, keyed by daemon URL. Two
concurrent agents in one checkout would share that file — and `unlock --mine` from one
would release the other's locks (observed 2026-07-04). Export `AGORA_AGENT_ID=<unique
handle or session id>` before any client call: identity then lands in
`client-identity.<id>.json`, fully isolating agents. Unset, the legacy shared path is
used (fine for single-agent use).

---

## Spec ↔ code discrepancies (code is authoritative)

The design spec and the shipped `server.mjs` / `store.mjs` disagree on a few points. Where
they differ, **this document follows the code**:

1. **Lock release authority.** Spec: `DELETE /locks/:id` allowed for "holder **or admin**."
   Code: **holder only** — a non-holder gets `403`; there is no admin override.
2. **`GET /health` shape.** Spec lists `{ ok, version, uptime, counts }`. Code additionally
   returns `port` and `lastSeq`. `counts` is `{ agents, locks, reservations, tasks, campaigns, messages }`.
3. **SSE resume.** Spec implies `?since=` lets a client "resume." Code **cannot replay** the
   gap — `?since`/`Last-Event-ID` are only echoed in `hello.clientSince`; the client
   re-syncs from the `hello.snapshot` (which covers agents/locks/reservations/tasks but **not**
   messages — poll `/messages?since=` for those).
4. **Token exposure.** Spec's data model implies a private `token`. Code returns the full
   agent record (including `token`) from `GET /agents` and in the SSE snapshot. Treat the
   local daemon as a trusted, single-host surface.
5. **Presence TTL numbers.** Spec describes online→stale→dropped but does not fix values.
   Code: online ≤ 10 min, dropped after 60 min (no separate persisted "stale" purge — stale
   is computed lazily in `GET /agents`).

## Cockpit integration (operator dashboard)

Agora cross-links with the external-agent **cockpit** (`misc/agent_matrix.html` →
`Aralia-operator-dashboard/public/agent_matrix.html`, served on `:3040`):

- **Activity bridge.** On startup the daemon mirrors every meaningful coordination event
  (register / lock / task / message — heartbeats filtered) into the cockpit's activity feed
  file `.agent/orchestration/activity.jsonl`, in the cockpit's own shape
  `{ at, kind:'note', agent:'agora', title, detail, source:'agora', eventType, seq }`. The
  cockpit's existing `GET /api/agent-activity` feed surfaces them automatically — peer
  coordination and external dispatch share one feed. Implemented in `activityMirror.mjs`.
  - Override the target with `--activity-file <path>` / `AGORA_ACTIVITY_FILE`.
  - Disable with `--no-activity-mirror` (or `AGORA_ACTIVITY_FILE=off`).
- **Reciprocal links.** The cockpit header has a `🏛️ Agora` link (→ `:4319`); the Agora
  dashboard header has a `🛰️ Cockpit` link (→ `:3040/agent_matrix.html`).

Note: the cockpit lives in the **separate** `Aralia-operator-dashboard` repo, so its
`🏛️ Agora` link edit is committed there, not via Aralia's snapshot.

## Workflow feedback — the self-improving loop

Agora is meant to get better as agents use it. EVERY agent working a task MUST, at
wrap-up, call out any friction with the coordination workflow itself — confusing
commands, lock/identity papercuts, missing affordances, anything awkward:

```
node tools/agora/client.mjs say "WORKFLOW: <friction, or 'none'>" --url $B
```

Broadcasting via `say` is the safe way to append shared notes — the daemon serializes
all writes, so there is no shared-file clobber. The orchestrator reads the `WORKFLOW:`
messages between waves and improves the client/server/protocol/skill, then logs the
iteration.

**Iteration log:**
- **Iter 1** (Wave-1 feedback): `unlock` accepts a file PATH or `--mine` (release all your
  locks); `task done <id>` aliases `task state <id> done`.
- **Iter 2** (Wave-1/2 feedback): `task new --id-only` and `lock --id-only` print just the
  id (no regex-scraping stdout). Note: `--url` is unnecessary — the client defaults to
  `http://localhost:4319`. Open friction: external agents (e.g. gemini) honor `.gitignore`,
  so they can't read context under gitignored `.agent/scratch/` — inline it or use a tracked path.
