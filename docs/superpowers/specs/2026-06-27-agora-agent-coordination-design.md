# Agora — Local Peer-Agent Coordination System

**Date:** 2026-06-27
**Status:** Design approved, pending spec review
**Owner:** Remy

## Problem

Multiple Claude Code (and other) agents run concurrently on this machine against the
**same** Aralia checkout (`F:\Repos\Aralia`). They have no way to coordinate, so they
clobber each other — most destructively via `git reset --hard`, which wipes a sibling's
uncommitted work (see project memory `concurrent-forks-shared-tree` /
`multi-agent-shared-repo-worktree`). Today's only mitigation is "manually use a git
worktree," which agents rarely remember to do.

There is prior art at `.agent/orchestration/` (the "cockpit" + `activity.jsonl`), but it
is a **hub-and-spoke** model: one orchestrator dispatching work *down* to cheaper external
agents (codex/gemini/jules/qoder). What's missing is **peer-to-peer** coordination among
co-equal agents working the same tree: a shared place to announce presence, claim/lock
files, post and claim tasks, and message each other.

## Goal

A local **daemon** that is the single source of truth for a small set of coordination
primitives, exposed over HTTP with a **real-time (SSE) feed** and a **live web dashboard**,
plus a **discovery layer** so any cold-start agent finds and uses it. Named **Agora** (the
Greek assembly/marketplace — the commons where the agents meet).

## Non-Goals

- **Not** an enforcement mechanism. With no Claude-Code hooks (explicit decision), the
  daemon cannot physically block a file write. **Locks are advisory / cooperative** — they
  work because every agent chooses to check in. The dashboard exists partly so a human can
  spot collisions the honor system misses.
- **Not** a replacement for the existing external-dispatch cockpit. This is a fresh,
  dedicated surface; the two can be cross-linked later but are not merged here.
- **Not** a git-merge automation tool. Agents share one tree; Agora coordinates *intent*
  (who's touching what), it does not arbitrate git operations directly beyond letting
  agents lock paths before a risky `reset`/`checkout`.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Isolation reality | Same shared checkout — locks arbitrate literal file edits |
| Capabilities (v1) | All four: file/resource locks, task board, messaging, presence |
| Interface | Local Node daemon + HTTP API + live dashboard |
| Real-time | **Server-Sent Events (SSE)** push (added on review) |
| Claude-Code hooks | **None** — agents call the API explicitly; locks advisory |
| Dashboard | Fresh, dedicated (not an extension of the cockpit) |
| Storage/runtime | **Single-writer Node daemon, in-memory state + append-only JSONL journal + periodic snapshot.** Zero native deps. |
| Discovery | "Collaborative Spaces" section in `PROJECT_TRACKER.md` + `PROTOCOL.md` + a Skill |

### Why single-writer + JSONL (not SQLite)

Every mutation funnels through one daemon process, so writes are **already serialized** —
we get concurrency safety for free and never need SQLite's locking/ACID machinery (which
on Windows means a native build dependency). State lives in memory; durability is a
periodic JSON **snapshot** plus an append-only **JSONL journal** of every event since the
snapshot. On restart the daemon loads the snapshot and replays the journal tail. This also
matches the existing `.agent/*.jsonl` activity-log convention.

## Architecture

Small, independently-testable units:

- **`tools/agora/store.mjs`** — the single source of truth. Holds in-memory state
  (`agents`, `locks`, `tasks`, `messages`), applies every mutation through one path, and
  for each mutation (a) appends an event to the JSONL journal, (b) fans the event out to
  live SSE subscribers via an in-process pub/sub, (c) periodically writes a snapshot.
  Pure logic given (current state, event) → next state; unit-testable without the network.
- **`tools/agora/server.mjs`** — thin HTTP layer (Node built-in `http`, no framework):
  routing, JSON parse/serialize, auth-token check, and the SSE endpoint. Delegates ALL
  state changes to the store. Serves the dashboard's static files.
- **`tools/agora/dashboard/index.html`** — self-contained vanilla-JS page. Subscribes to
  `GET /events` via the browser-native `EventSource` and live-renders four panels:
  presence, locks, task board, message feed. No build step, no framework.
- **`tools/agora/client.mjs`** — optional thin CLI so a human or agent can run
  `node tools/agora/client.mjs lock src/foo.ts` (and `register`, `tasks`, `say`, `watch`)
  without curl boilerplate. `watch` streams the SSE feed via Node.
- **`tools/agora/PROTOCOL.md`** — the full API reference + etiquette.

**Code location:** `tools/agora/` is committed and versioned (shared across agents).
**Runtime state location:** `.agent/agora/` (snapshot + journal) is **gitignored**, so a
sibling's `git reset --hard` cannot nuke the coordination state. (Note: `git clean -fdx`
still would; documented as a known caveat in PROTOCOL.md.)

## Data model

```
Agent   { id, handle, token, registeredAt, lastSeen, status, note }
Lock    { id, paths[], globs[], agentId, reason, createdAt, expiresAt }
Task    { id, title, body, state, createdBy, claimedBy?, createdAt, updatedAt, history[] }
Message { id, seq, from, to, body, createdAt }     // to = agentId | "all"
Event   { seq, type, payload, ts }                  // journal + SSE envelope
```

- `Task.state` ∈ `open | claimed | in_progress | blocked | done`.
- `Message.seq` is a monotonic integer cursor for `?since=` polling and SSE resume.
- Presence: any authenticated API call refreshes the caller's `lastSeen`. An agent is
  **online** if seen within the presence TTL, else **stale**, else (after a longer grace)
  dropped from the active list.

## HTTP API (default port 4319, configurable via `--port` / `AGORA_PORT`)

Auth: `register` returns a `token`; all mutating calls send `Authorization: Bearer <token>`.

**Presence**
- `POST /agents/register {handle, note?}` → `{agentId, token, handle}`
- `POST /agents/heartbeat` → refresh `lastSeen` (optional; any call also refreshes)
- `GET  /agents` → active agents with status

**Locks (advisory)**
- `POST   /locks {paths?[], globs?[], reason?, ttlMs?}` → `201 {lock}` or
  `409 {conflict: {path, heldBy, lock}}`
- `GET    /locks` → all active locks
- `DELETE /locks/:id` → release (holder or admin only)
- Locks auto-expire at `expiresAt` (default TTL 30 min) so a dead agent never deadlocks.

**Task board**
- `POST /tasks {title, body?}` → `{task}` (state `open`)
- `POST /tasks/:id/claim` → state `claimed`, `claimedBy = caller`
- `POST /tasks/:id/state {state}` → transition (e.g. `in_progress`, `blocked`, `done`)
- `POST /tasks/:id/handoff {toAgentId}` → reassign
- `GET  /tasks` → board, filterable by `?state=`

**Messaging**
- `POST /messages {to, body}` → `{message}` (`to` = agentId or `"all"`)
- `GET  /messages?since=<seq>&to=<me|all>` → messages after cursor

**Real-time**
- `GET /events?since=<seq>` → **SSE** stream of all events (presence/lock/task/message).
  Browser dashboard uses `EventSource`; agents may `curl -N` it; both can resume via
  `since`. Heartbeat comment line every ~20 s keeps the connection alive.

**Meta**
- `GET /health` → `{ok, version, uptime, counts}` (cheap "is the daemon up?" probe)
- `GET /` → dashboard

## Lifecycle & durability

- **Start:** `node tools/agora/server.mjs` (a `package.json` script, e.g. `npm run agora`).
  Loads latest snapshot from `.agent/agora/snapshot.json`, replays
  `.agent/agora/journal.jsonl` tail, begins serving.
- **Mutate:** store applies → appends to journal → fans out SSE → updates in-memory state.
- **Snapshot:** every N events or T seconds, write snapshot + truncate journal to events
  after the snapshot point (atomic write-then-rename).
- **Expiry sweep:** a periodic timer expires stale locks and demotes/drops stale agents,
  emitting `lock.expired` / `agent.stale` events like any other mutation.
- **Stop:** SIGINT writes a final snapshot.

## Discovery (make-or-break, since locks are advisory)

1. **Project tracker section** — a new **"🏛️ The Agora — Agent Collaborative Spaces"**
   block near the top of `docs/projects/PROJECT_TRACKER.md`: how to check the daemon is up
   (`GET /health`), how to start it, the endpoint cheat-sheet, and the **etiquette**:
   *register on arrival → lock paths before editing → post a task / say what you're doing →
   release on done → heartbeat occasionally.*
2. **`tools/agora/PROTOCOL.md`** — full API + data model + caveats, linked from the tracker.
3. **A Skill** (`agora-coordination`) — so a cold-start Claude session auto-discovers the
   protocol the Claude-native way, complementing the HTTP interface. The skill teaches the
   register→lock→work→release loop and the curl/client snippets.

## Testing

- **`store.mjs` unit tests** (the tricky logic, no network):
  - lock granted on free path; `409` conflict on overlapping path/glob; release frees it
  - lock auto-expiry at `expiresAt`
  - task transitions: open→claim→in_progress→done; double-claim rejected; handoff reassigns
  - message `?since=` cursor filtering; direct vs broadcast routing
  - presence TTL: online → stale → dropped
  - journal replay: snapshot + journal tail reconstructs identical state
- **API tests** against an in-memory store: auth-token enforcement, status codes, SSE
  envelope shape.
- **Manual proof:** start daemon, open dashboard, register two agents via `client.mjs`,
  watch a lock conflict + a message appear live in the dashboard (SSE), capture to
  `.agent/scratch/` per the temp-proof rule.

## Build slices (for the implementation plan)

1. **Store + journal/snapshot** (`store.mjs` + tests) — the heart, fully testable alone.
2. **HTTP server + API** (`server.mjs`) over the store, incl. auth + `/health`.
3. **SSE feed** (`/events` + store pub/sub) and resume-by-`since`.
4. **Dashboard** (`dashboard/index.html`) consuming SSE.
5. **Client CLI** (`client.mjs`) incl. `watch`.
6. **Discovery** — `PROTOCOL.md`, tracker section, `agora-coordination` skill, `.gitignore`
   entry for `.agent/agora/`, `npm run agora` script.

## Open caveats (documented, not blocking)

- Advisory locks ≠ enforcement; honor system + human dashboard oversight.
- `git clean -fdx` would still remove gitignored runtime state.
- Agents in single-shot Bash calls can't hold a long-lived SSE stream within one tool call;
  they poll `?since=` instead. SSE is primarily for the dashboard and `client.mjs watch`.
