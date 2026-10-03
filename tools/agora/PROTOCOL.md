# Agora — Peer-Agent Coordination Protocol

**Reference for any agent (or human) sharing the `F:\Repos\Aralia` checkout.**
Design spec (source of truth): [`docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md`](../../docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md)
**Orchestrating a multi-agent campaign?** Read [`ORCHESTRATOR.md`](./ORCHESTRATOR.md) — the
board + agent matrix (external CLIs) + planning surfaces (Plan Map, Roadmap; project tracker is
deprecated), end to end. This file is the per-agent API.

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

- `GET /pets` and `POST /agents/register` are **open** so an agent can choose a pet
  before it has a token. Registration returns the token only after the selected pet is valid.
- **All mutating endpoints** (`POST /locks`, `DELETE /locks/:id`, `POST /reservations`,
  `DELETE /reservations/:id`, `POST /tasks*`, `POST /messages`, `POST /agents/heartbeat`) require
  `Authorization: Bearer <token>`. Missing/invalid → **`401`**
  `{ "error": "unauthorized: missing or invalid bearer token" }`.
- **All GET read endpoints** (`/pets`, `/agents`, `/locks`, `/reservations`, `/tasks`, `/messages`, `/health`,
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
| GET | `/pets` | none | - | `200 { pets: [{ slug, displayName, ... }] }` | - |
| POST | `/agents/register` | none | `{ "handle": string, "petSlug": string, "note"?, "unique"?, "model"?, "reasoningEffort"?, "sessionId"?, "role"?, "type"? }` | `201 { agentId, token, handle, registeredAt, model, reasoningEffort, sessionId, pet }` | `400` if identity requirements are missing/invalid; `409` if a live agent already holds `handle` |
| POST | `/agents/heartbeat` | Bearer | — | `200 { ok: true, expiresAt, remainingMs }` | `401`; `404` if the agent is gone; `410` when the heartbeat-only lease expires |
| POST | `/agents/:id/retire-stale` | Bearer | — | `200 { ok: true, agentId }` | `403` unless requester is orchestrator/master/human; `409` when target is online or owns locks, reservations, or in-flight tasks; `404` |
| GET | `/agents` | none | — | `200 { agents: [...] }` | — |

`GET /agents` returns each active agent as
`{ id, handle, registeredAt, lastSeen, lastMeaningfulAt, lastHeartbeatAt, status, note, model, reasoningEffort, sessionId, threadIdRequired, threadIdRequirement, pet }`
where `status` is `"online"` or `"stale"`. `registeredAt` is the check-in moment; `lastSeen` is
the latest authenticated touch, `lastMeaningfulAt` excludes heartbeat-only traffic, and
`lastHeartbeatAt` is the latest explicit heartbeat. `model` records which model the agent is
(usually stamped by the orchestrator via `--model`), `reasoningEffort` records the runtime thinking
level (`--reasoning`), while `sessionId` records the agent's own
task/thread or harness conversation id (`--session`/`--thread`/`--conversation`).
`threadIdRequired` and `threadIdRequirement` expose the daemon's provenance classification to
the dashboard without exposing the bearer token. Agents not seen within the **drop** window are omitted.

**Pet identity gate (2026-07-18, uniqueness hardened 2026-07-19):** an agent cannot enter
presence without choosing a catalog identity from `GET /pets`. Missing or unknown `petSlug`
values return `400` before the daemon emits a registration event, allocates a token, or adds a
roster row. Each catalog pet may belong to only one live Presence row. `GET /pets` includes
`available` and token-free `claimedBy` metadata. When a requested pet is occupied, registration
returns `201` with the next free pet plus `requestedPetSlug` and `petSubstituted: true`; when all
catalog identities are occupied it returns `409 AGORA_PET_CATALOG_EXHAUSTED`. The CLI explains
substitutions and saves the actual assignment. Agents verify `whoami`; orchestrators verify that
the active `agents` roster has unique `pet.slug` values before assigning work. A task claim
snapshots the already registered assignment; it never creates a second pet identity.
When all catalog pets are occupied, `capacityRecoverable` marks only stale roster rows that own no
locks, reservations, or in-flight tasks. An orchestrator, master, or human may retire exactly one
such row through `/agents/:id/retire-stale`; online or coordination-owning targets are refused.

**Live capacity-recovery validation (2026-07-19):** after a journal-preserving daemon restart,
the shared service refused retirement of an online presence and then refused the same disposable
stale presence while it owned a lock, reservation, or in-flight task. Once those disposable records
were cleared, the roster marked it `stale-idle`, retirement freed its pet, and a new Sol 5.6 medium
Codex worker registered with that same pet and its exact task/thread UUID. Public roster inspection
confirmed that every live pet slug remained unique; the proof worker then retired normally.

**Codex task/thread identity gate (2026-07-18):** every new Codex registration and every
`orchestrator`/`master` registration must provide its exact current task/thread id in
`sessionId`. The daemon recognizes Codex identities from a `type` containing `codex`, a model
containing `codex` or beginning with `gpt-`, or a conventional `codex-*` handle; `role: human`
is explicitly exempt for the browser operator. Missing required provenance returns `400`
before token allocation, `agent.register`, or roster mutation. The CLI mirrors the gate with
`--session <id>` (aliases: `--thread`, `--conversation`, env: `AGORA_SESSION_ID`), and the seat
with `--seat <name>` (env: `AGORA_SEAT`, WF-G145; the flag wins). Agents must
self-check `whoami`; orchestrators must reject worker roster rows whose required `sessionId`
is missing or does not match the dispatched task/thread.

**Codex runtime metadata gate (2026-07-19):** before inspecting a task or the repository, a
Codex worker must query its authoritative runtime metadata and compare the exact model,
reasoning effort, and task/thread UUID with the dispatch contract. After a match, it registers
those three values and checks that `whoami` and the public roster or dashboard Presence show
the same structured values. The operator must compare all three fields before allowing a task
claim. A missing or mismatched value must be visible in Presence with the actual-runtime
warning, and that worker must remain taskless: it must not inspect, create, claim, or start a
task, or lock files.

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

The registration token is returned only to the registering caller and retained in its local identity
file. Public `GET /agents`, SSE payloads, `whoami`, dashboards, and task logs must remain token-free.

### Locks (advisory)

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/locks` | Bearer | `{ "paths"?: string[], "globs"?: string[], "reason"?: string, "ttlMs"?: number }` | `201 { lock, warnings[] }` — `warnings` (WF-G91) name held paths that look like the same file under another root prefix **within the same repo**; the lock is still granted | `409 { conflict }` on overlap; `400` if neither paths nor globs given; `401` |
| GET | `/locks` | none | — | `200 { locks: [...] }` | — |
| POST | `/locks/:id/renew` | Bearer | `{ "ttlMs"?: number }` | `200 { lock }` | `404` if not found; `403` if you are not the holder; `401` |
| POST | `/locks/:id/shrink` | Bearer | `{ "paths"?: string[], "globs"?: string[] }` | `200 { lock, released }` — WF-G122: drops the named tokens and keeps the lock's id and expiry; `released: true` when the last token went. `client.mjs unlock <path>` uses this when the record covers more than one token | `404` unknown; `403` not the holder; `400` token not on the lock |
| DELETE | `/locks/:id` | Bearer | — (query `?force=1`) | `200 { ok: true }` | `404` if not found; `403` if you are not the holder (non-force); `409` if `force=1` but the holder is still online; `401` |

- A lock is `{ id, paths[], globs[], agentId, repo, reason, createdAt, expiresAt, ttlMs }`.
- **`repo` (WF-G119)** names WHICH CHECKOUT the lock is about. It is derived, never sent:
  a lock whose first path segment matches a known sibling checkout root (`entity-forge/`,
  `Entity-Generator/`, `Aralia-operator-dashboard/`) takes that root as its repo; every
  other lock takes the daemon's own `workspaceRoot` basename (`Aralia` here). Campaigns
  carry the same field, derived the same way.
  - The WF-G91 same-file warning now compares only locks whose `repo` matches. Before
    this, an unprefixed Aralia lock on `src/systems/entities3d/three/baseMeshCatalog.ts`
    warned against an Entity-Generator lock on a DIFFERENT file (board task agora-caea),
    and a false alarm teaches agents to ignore the warning that matters. Two spellings of
    one file inside one repo still warn.
  - The list of sibling roots is `DEFAULT_SIBLING_REPO_ROOTS` in `store.mjs`, overridable
    per store with `siblingRepoRoots`. A foreign checkout not on the list falls back to
    this repo, so add a root before running a cross-repo wave against it.
- **`GET /locks` also reports the HOLDER (WF-G116):** `holderHandle`, `holderLastSeen`,
  `holderIdleMs` and `holderStatus` (`online` | `stale` | `gone`, or `gone` with a null
  idle when the presence row is already reaped). A heartbeat-renewed lock used to look
  identical to live work; a waiter can now tell a working holder from a hold that is
  merely renewing. `client.mjs locks` prints `[repo]` and `idle <n>m` on every row.
- **Default TTL is 30 min** (1,800,000 ms); pass `ttlMs` to override. Locks auto-expire so a
  dead agent never deadlocks the tree. Expired locks are swept (`lock.expired` event) every
  30 s and are excluded from `GET /locks`.
- Renew a lock before it expires with `lock --renew <lockId> --ttl <minutes>`. Only the lock
  owner can renew it. Leave minute-scale headroom rather than renewing at the expiry boundary.
  A bare `POST /agents/:id/heartbeat` does not renew locks; the `client.mjs heartbeat` helper
  DOES renew every lock you hold on each beat (WF-G91/G110). A lock nobody renews still expires.
- **A free lock is not a quiet file (WF-G129).** `client.mjs lock` checks the paths it just locked and prints one `!!` hint per path that is already modified, untracked, or deleted in the shared working tree. The hint never blocks the lock. It asks the worker to inspect existing edits or a removed path before writing, without requiring a Git command (WF-G292). The lock cannot identify who made the change.
- **A renew without `ttlMs` keeps the lock's OWN span (WF-G110).** `acquireLock` stores
  `lock.ttlMs`, and `renewLock` reuses it, so the heartbeat helper's per-beat renew extends a
  180-minute lock by 180 minutes — not by the 30-minute default, which used to lapse a long
  lock about an hour into a packet. Proven by `store.test.mjs` ("WF-G110: renewLock without
  ttlMs extends by the lock's own span, not the 30-min default").
- **T-minus warning:** the sweep emits one `lock.expiring` `{ lockId, agentId, expiresAt,
  remainingMs }` per TTL window once the lock has `lockExpiringWarnMs` (default 5 min,
  300,000 ms) or less remaining (WF-G69/G75). The `expiringWarned` flag makes it one-shot;
  a renew re-arms it. `GET /locks` never returns a lapsed lock, sweep or no sweep — the
  filter is in `activeLocks()`, so the 30 s sweep cadence only affects when the EVENT lands.
- **Conflict shape** (`409`): `{ "conflict": { "path": <offending token>, "heldBy": <agentId>, "lock": <full held lock> } }`.
- **Atomic multi-target requests:** `POST /locks` is all-or-nothing. The store normalises every
  requested path and glob, checks the whole request against active locks and FIFO reservations,
  and emits one combined lock only when every target can be granted. Any `409` grants **none**
  of the requested targets and creates no partial lock. Inspect `GET /locks` and
  `GET /reservations`, retry the unconflicted paths, and reserve each conflicted path you still
  need. A reservation preserves queue order but never grants edit rights; only a successful
  real lock permits editing.
- **Overlap rules** (see `globToRegExp`/`tokensOverlap` in `store.mjs`): repository-relative and
  equivalent absolute paths are canonicalised before comparison; exact path == path;
  a glob (`*`, `**`, `?`) matched against a path; two **equal** globs. `**` crosses `/`;
  `*`/`?` do not. An agent may freely re-lock paths it **already holds** (no self-conflict).
- **Reason parsing:** quote the complete value passed to `--reason`. The client refuses trailing
  bare words or unexplained path-like arguments before it sends a lock or reservation request,
  so prose cannot silently become extra locked paths.
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
- **Reap grace for a worker mid-task (WF-G4):** an agent holding a `claimed` or `in_progress`
  task gets **double** the drop horizon (120 min) before it is reaped. A quiet-but-alive
  worker deep in an edit is the false-positive case the doubling protects.
- **The exact liveness timeline**, in the order a crash plays out (store defaults):
  10 min quiet → presence reads `stale` (`GET /locks` says `holderStatus: "stale"`, force
  release and stale-reservation sweep unlock); 30 min → an unrenewed lock lapses; 60 min
  (120 min while holding a task) → reap: locks and reservations freed immediately, tasks
  reopened with a `reaped` history entry and a retrace dossier, agent record deleted and its
  bearer answering `401`; 2 h of heartbeat-only presence → `410` and the same cleanup. The
  daemon runs `store.sweepExpired()` every **30 s** (`SWEEP_INTERVAL_MS` in `server.mjs`), so
  each of these lands within one sweep of its horizon.
- Verified end to end on the real daemon with an injected clock by
  `tools/agora/server.liveness.test.mjs` (3/3): a crashed holder's lock frees with ~3 h of TTL
  left and a successor locks the file; heartbeats hold a lock past the drop horizon and the
  heartbeat-only lease then releases it; a lapsing lock warns once and then expires.

### Reservations (FIFO dibs)

**Lock EXPIRY hands the file to reservation #1 exactly as unlock does (WF-G116, verified
2026-09-09).** Neither path "grants" anything actively: `activeLocks()` simply stops
returning a lapsed lock, and the reservation queue keeps refusing everyone behind the head
reserver. So when a lock lapses, #1 may lock and #2 still gets a `409` with
`conflict.type === "reservation"`. Proven by
`tools/agora/server.reservations.test.mjs` ("a lock that EXPIRES hands the file to
reservation #1 while #2 keeps waiting"). The real loss reported on 2026-09-09 was NOT a
queue-order bug: a reservation is released as `stale` once its holder passes the 10-minute
presence TTL, so a waiter that stops checking in loses its place. Keep a heartbeat running
while you wait.

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/reservations` | Bearer | `{ "paths"?: string[], "globs"?: string[], "reason"?: string }` | `201 { reservation }` | `400` if neither paths nor globs given; `401` |
| GET | `/reservations` | none | — | `200 { reservations: [...] }` | — |
| DELETE | `/reservations/:id` | Bearer | query `?force=1` optional | `200 { ok: true }` | `404` if not found; `403` if you are not the reserver; `409` if force targets an online reserver; `401` |

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
- The sweep releases reservations as soon as their owner crosses the stale threshold. It does
  not wait for the longer drop horizon, and it does not release that owner's unrelated locks or
  reopen their tasks until the normal drop rules apply.
- **Idle reservation grace (WF-G121).** When a lock request from another agent finds NO active lock covering the path, the head reservation's grace clock starts (journaled `reservation.freeSince`); a later request more than `reservationGraceMs` (default 2 minutes) after that start releases the reservation (journaled `reservation.release` with `idleGraceMs`) and evaluates the next one. A reservation queued behind a HELD file keeps its place however old it is.
- **Operator recovery:** first inspect the reservation and its owner's current presence. Use
  `unreserve <id> --force` only for a stale or gone owner. The daemon returns `409` for an online
  owner; stop and coordinate instead. A successful stale force release removes only the named
  reservation and promotes the next queued worker. Confirm that unrelated locks, reservations,
  and tasks remain in place after either a force release or an automatic stale-threshold sweep.
- **Live stale-recovery validation (2026-07-19):** daemon PID 118268 at 622095 ms uptime retained
  both test reservations. Forced release of the online owner's reservation returned `409`.
  Forced release of the stale owner's reservation promoted the queued worker, which then acquired
  lock `5cf32474-5a50-46ef-b063-c1496fa9a05c`. After the approved restart, PID 120552 retained
  449 tasks and its startup sweep removed the sole disposable reservation `506bdcd2`; no
  non-disposable reservation was lost. Focused reservation recovery tests passed 23/23.
- **Live canonical-FIFO validation (2026-07-19):** a relative-path reservation at position 1
  blocked a later absolute-path lock for the same repository file. The first reserver then locked
  the absolute spelling, its reservation was fulfilled, and the second reserver moved to position
  1 before acquiring the relative spelling. An unquoted multi-word reason was rejected without
  creating a lock; the quoted form created one intended path and preserved the full reason.

### Campaign governance

Campaigns are first-class board records for orchestrators. They are advisory like locks, but
lead-vs-lead overlap is a hard pre-seed failure so two orchestrators do not unknowingly launch
waves over the same file domain. Deputies can join an existing lead campaign when they name the
lead explicitly and declare their own bounded paths/globs.

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/campaigns` | Bearer | `{ "id"|"campaignId": string, "role"?: "lead"|"deputy", "leadCampaignId"?, "scope"?, "paths"?: string[], "globs"?: string[], "wave"?, "planmapRef"? }` | `201 { campaign, warnings }` | `400` for missing id/scope tokens, an invalid deputy lead, or a `planmapRef` that names no Plan Map topic; `409` on active lead overlap; `401` |
| GET | `/campaigns` | none | query `?state=` | `200 { campaigns: [...] }`; each record includes `seatId`, `seatName`, `attended` and `adoptable`. `ownerStatus`/`ownerLive` remain for the session that claimed it, but do NOT answer whether the campaign has an owner | - |

**State the Plan Map topic with `planmapRef` (WF-G207).** Rank 1 of the membership mapping below
compares a task's `planmap:<topic>/<feature>` ref against the CAMPAIGN. It used to compare against
the campaign NAME, which a person chooses: the live board held `board-drain-20260920-gaps`, `-w1`
and `-deepdives`, none of which is a Plan Map key, so rank 1 almost never fired and more tasks ended
ambiguous than the evidence warranted. `planmapRef` is that link stated once, on the record. It is
validated against `public/planmap/topics.json` the way a charter reference is, and the campaign name
is still compared after it, so nothing needs a migration.

```
node tools/agora/client.mjs campaign claim my-effort --planmap worldforge/interiors --path src/...
```

**Read `attended`, not `ownerStatus`.** A session always ends, so `ownerStatus` reaches `gone` for every campaign eventually — on 2026-09-07 all 27 live campaigns reported a gone owner, and none had been abandoned. `attended` asks the answerable question instead: is a live session sitting in the campaign's seat right now? A campaign with no `seatId` has no durable owner and is never attended (D-AA).

### Seats — durable identity for campaign ownership

A session is a day; a seat is a person. A campaign belongs to a SEAT, so it keeps its owner when the session that claimed it ends. Locks, reservations, task claims and presence still belong to the session, correctly — those are about work in progress, not about responsibility (D-B).

| Method | Path | Auth | Body | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/seats` | none | - | `200 { seats: [...] }`; each carries `attended`, `holderHandle`, `formerNames`, `diary` and the campaigns it owns | - |
| POST | `/seats` | Bearer | `{ "name": string, "note"?: string }` | `200 { seat }` | `400` bad name; `403` unless `orchestrator`, `master` or `human` |
| POST | `/seats/release` | Bearer | `{ "seat"?: string, "why"?: string }` | `200 { seat }` | `400` no seat held, or not the holder |
| POST | `/seats/rename` | Bearer | `{ "seat": string, "name": string, "why"?: string }` | `200 { seat }` | `400` bad name; `403` role |
| POST | `/seats/diary` | Bearer | `{ "seat"?: string, "text": string }` | `200 { seat }` | `400` no seat, or empty text |

**A seat is taken at SIGN-IN**, with `seat` on `POST /agents/register`. Claiming it per campaign was rejected: a seat could not be held while its holder was reading or reviewing, which is most of the work (D-AB). Registration always succeeds; a refused seat comes back as `seatError` so the caller is never stranded with a token it cannot use.

**One holder at a time.** A second live claimant is refused. The crashed-agent worry is answered rather than traded away: the seat is free the moment the holder's presence drops, and presence is already measured every few minutes. No seat-level timer exists.

**A seat name may not encode the job or a model.** Naming it for the job recreates the role model that seats replace; naming it for a model kills the seat when the model changes. Both are refused by name (D-N).

**A rename keeps the old name.** `formerNames` and `renames[]` grow; nothing is overwritten.

**The roster is mirrored to `tools/agora/seat-roster.json`** on every seat change, because `.agent/` is git-ignored and `git clean -fdx` would erase a seat that is supposed to outlive everything. That file is a COPY: written by the daemon, never read back, never hand-edited, written atomically, gitignored (WF-G141, Remy 2026-09-09), and never committed; a wiped checkout gets it back the first time the daemon starts, because the snapshot holds every seat. It holds seats only — a campaign list there would become the local campaign tracker the dashboard-only rule forbids (D-R, D-X).

**Three more seat rules, proven by the suite and now written down (agora-8148.2, 2026-09-09).**

- **A seat survives a daemon restart, diary and all.** Seats are replayed from the snapshot on
  load (`store.mjs`), because a seat that vanished on restart would be a session wearing a longer
  name. Proven by `store.seats.test.mjs` ("a seat and its diary survive a restart").
- **A clean exit hands the seat back, and the record says it was deliberate.** `retireAgent`
  releases the seat the retiring session holds and writes a `released` history entry with
  `why: "retired"`, so a hand-back reads differently from a session that merely stopped and had
  its presence drop. Proven by `store.seats.test.mjs` ("a clean exit hands the seat back and says
  it was deliberate").
- **A misspelled seat at sign-in fails loudly and creates nothing.** `register --seat <name>` with
  an unknown name returns `seatError` naming the seat and pointing at `seat new <name>`; the
  registration itself still succeeds. Proven by `store.seats.test.mjs` ("a seat is created
  deliberately, and a typo cannot conjure one").

| POST | `/campaigns/:id/state` | Bearer | `{ "state": "active"|"blocked"|"done", "reason"?: string }` | `200 { campaign }` | `404` unknown campaign; `403` non-owner; `400` invalid state or missing reason; `401` |

- **`reason` (WF-G86).** `blocked` and `done` refuse without one. The history entry records
  `{ at, by, action: "state", from, state, reason }`; `from` is the prior state. Legacy entries
  lack `from`/`reason` and every reader treats both as optional.
- **Unattended closure (WF-G83).** The owner is normally the only writer. When the campaign is
  UNATTENDED (no live session in its seat) AND its owner session is gone, an agent whose role is
  `orchestrator`, `master` or `human` may change its state; `reason` is then mandatory and the
  history entry carries `adoptedClosure: true` plus `previousOwner`. An attended campaign, or one
  whose owner session is still live, still returns `403` to everyone else. This is the closure
  path for the 2026-08-28 finding that 10 active campaigns with a gone owner could never be closed.
  `POST /campaigns/sweep` (D-AC) remains the bulk path for EMPTY unattended campaigns.

- A campaign is `{ id, name, role, leadCampaignId, agentId, seatId, seatName, attended, adoptable,
  ownerStatus, ownerLive, ownerAlive, scope, paths[], globs[], wave, state, warnings[], createdAt,
  updatedAt, history[] }`. `ownerStatus` is `online | stale | gone`. `ownerLive` is a compatibility
  shortcut for `ownerStatus !== "gone"`. `ownerAlive` (WF-G82) is a server-computed alias of
  `ownerLive` added by `GET /campaigns` (`server.mjs`), kept for the board-tidying dashboards that
  read it; `ownerLive` is the canonical field and the store never writes `ownerAlive`. Neither
  answers "does this campaign have an owner" — read `attended` for that.
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
| POST | `/tasks` | Bearer | `{ "title": string, "body"?: string, "deps"?: (taskId \| { id, type })[], "priority"?: number, "refs"?: string[], "deliverable"?: string, "campaignId"?, "standalone"?: boolean, "standaloneReason"?: string, "wave"? }` — **WF-G171: send `campaignId`, or send `standalone: true` with `standaloneReason`.** `campaignId` omitted: defaults to the ONE active campaign the caller owns, if exactly one (WF-G85), and that default is the decision. **WF-G293: in required intake mode, also supply a non-empty body or at least one non-empty ref.** | `201 { task }` (state `open`) | `400` if `title` missing/not a string, a dep id is unknown, a dep **type** is unknown, campaignId is unknown, the campaign decision is missing (WF-G171), both body and refs are empty (WF-G293), or `deliverable` is not a non-empty single-line path (WF-G179); `401` |
| GET | `/tasks/dep-types` | — | — | `200 { depTypes: [{ type, blocking, summary }], defaultType }` | — |
| POST | `/tasks/ids/migrate` | Bearer | `{ "note"?: string }`, query `?dry=1` previews | `200 { ok, migrated, tasks[] }` — one journal event; idempotent | `403` unless `orchestrator`, `master`, or `human` |
| POST | `/tasks/deps/migrate` | Bearer | `{ "note"?: string }`, query `?dry=1` previews | `200 { ok, migrated, changes[] }` — one journal event; idempotent | `403` unless the caller is `orchestrator`, `master`, or `human` |
| POST | `/tasks/deps/canonicalize` | Bearer | `{ "note"?: string }`, query `?dry=1` previews | `200 { ok, migrated, changes[] }` — repoints each dep at its target's current id; one journal event; idempotent | `403` unless the caller is `orchestrator`, `master`, or `human` |

**Run these three in order: `/tasks/deps/migrate`, then `/tasks/ids/migrate`.**
The rename must run LAST. `ids.migrate` follows a rename into a dependency edge
by reading `d.id`, and an untyped dep is a bare string with no `id`, so a rename
that runs first cannot follow any edge and every edge keeps a stale id.
`/tasks/deps/canonicalize` exists to repair a board that already ran them in the
wrong order. See WF-G104.
| POST | `/tasks/:id/claim` | Bearer | — (query `?force=1` is the creator's hand-assignment bypass) | `200 { task }` (state `claimed`) | `404` not found; `409` if already claimed by another agent OR an open task has unresolved deps (WF-G55); `401` |
| POST | `/tasks/claim-next` | Bearer | optional `{ "campaignId"?: string, "category"?: string }` (the same filters are accepted as query parameters) | `200 { task }` — the top-priority matching READY task, atomically claimed; `200 { task: null }` when nothing is ready | `400` invalid JSON; `401` `400 unknown campaign` when the `campaignId` lane does not exist (WF-G127), never a silent `task: null` |
| POST | `/tasks/:id/checkpoint` | Bearer | `{ "did"?: string, "next"?: string, "files"?: string[] }` | `200 { checkpoint }` | `404` not found; `403` caller is not the current claimant; `409` task is open, blocked, or done; `400` invalid body; `401` |
| POST | `/tasks/:id/state` | Bearer | `{ "state": "open"|"claimed"|"in_progress"|"blocked"|"done", "result"?: string, "reason"?: string }` | `200 { task }` | `404` not found; `400` invalid state, or `blocked` without `reason` (WF-G86); `401` |
| PATCH | `/tasks/:id` | Bearer | `{ "title"?, "body"?, "appendBody"?, "priority"?, "refs"?: string[], "deliverable"?: string \| null, "design"?: string \| null, "wave"?, "reason"? }` | `200 { task, changed }` — WF-G130, WF-G149, WF-G153, WF-G304: rewrites named authored fields, records a multiline design, or appends body/notes in place; the id stays, the history entry (`action: edit` or `action: note`) carries details. `POST /tasks/:id/edit` is an alias. `client.mjs task edit` then lints the record | `404` not found; `403` not the creator, claimant, or orchestrator/master/human (WF-G149); `400` no editable field or reason, a done task, or a bad value |
| POST | `/tasks/:id/campaign` | Bearer | `{ "campaignId": string \| null, "standalone"?: boolean, "reason": string }` | `200 { task, from, to }` — WF-G169: moves ONE task to another campaign, or makes it standalone. The id does not change. The history entry (`action: campaign`) records the old campaign, the new campaign, the actor and the reason | `404` unknown task or unknown campaign; `403` the caller is not an orchestrator, master or human; `400` no reason, no destination, a `done` destination, or a move that changes nothing |
| POST | `/tasks/:id/handoff` | Bearer | `{ "toAgentId": string }` | `200 { task }` | `404` not found; `400` if the target is missing, unregistered, or beyond the drop horizon; `401` |
| GET | `/tasks` | none | — (query `?state=`, `?ready=1`, `?category=`, `?campaignId=`) | `200 { tasks: [...] }` | `400` on an unknown `campaignId` |
| GET | `/tasks/:id` | none | — | `200 { task }` — the one record, same shape as a `/tasks` entry (WF-G128) | `404` unknown id |

- A task is
  `{ id, title, body, design, campaignId, campaignDecision, membership, wave, state, createdBy, creatorAgent, claimedBy, claimedAgent, assignedPet, deps[], priority, refs[], deliverable, result, checkpoint, retraceFiles[], retrace, reapCount, createdAt, updatedAt, history[] }`.
  `refs[]` names inputs to inspect; `deliverable` names the expected output path (WF-G179).
  New tasks store an empty string when no deliverable is supplied; older tasks may omit the field.
  `PATCH /tasks/:id` can change it, or clear it with `null` or an empty string.
  `design` holds a multiline design-then-build handoff, separate from the task body and the
  claimant's one-step checkpoint. New tasks start with an empty string; older tasks may omit it.
  The creator, claimant, or an orchestrator/master/human can set it while the task is not done;
  `null` or an empty string clears it through the API.
  `campaignDecision` and `membership` are the campaign membership and how it was decided.
  See [Campaign membership — the authoritative mapping](#campaign-membership--the-authoritative-mapping-wf-g170).
  **`GET /tasks` rows additionally carry computed, read-only graph fields** —
  `ready` (the same predicate `claim-next` uses), `depStates` (upstream edges
  with live state), and `gates` (downstream dependents count). They are never
  persisted. See [`GRAPH-ENGINEERING.md`](./GRAPH-ENGINEERING.md) for how to
  read a diamond on the board.
- **Listing filters compose.** `?state=`, `?ready=1`, `?category=` and `?campaignId=` narrow the
  same listing together; omitting all of them returns the whole board. `?campaign=` is accepted as
  a synonym of `?campaignId=`, matching `claim-next`. An **unknown campaign id is a `400`, never a
  silent full-board response** — before WF-G88 the parameter was ignored, so a typo returned every
  task and looked like a successful filter.
- `state` ∈ `open | claimed | in_progress | blocked | done`.
- **`creatorAgent` is mandatory on new tasks.** It is a token-free snapshot of the registered
  creator `{ id, handle, note, model, sessionId }`, stamped when the task is created so the
  creator remains inspectable after presence drops the live agent row. `POST /tasks` rejects
  an unregistered creator; clients should treat missing or mismatched creator metadata as a
  coordination blocker.
- **Ids are short codes, and hierarchical.** A campaign's id is `agora-a3f8`. Its tasks
  are `agora-a3f8.1`, `agora-a3f8.2`. Membership is part of the task's name, so it cannot
  be left out — it was left out 119 times out of 119 when it was a separate optional
  field (WF-G85). A task with no campaign gets a standalone `agora-<hash>`.

  A campaign also carries **`name`**: the readable name a person chose, such as
  `living-interiors-live-clock`. The code is derived from that name, so claiming the same
  name twice always reaches the same campaign. Every route accepts either. Print the name
  beside the code in anything a person reads — a bare code says nothing.

  **Every id an object has ever carried keeps resolving, forever.** The migration ADDS a
  name; it never removes one. Fifteen finished board results and four `WORKFLOW_GAPS.md`
  rows quote a UUID prefix, and rewriting those quotes would be editing the past, which
  the never-falsify-the-record rule forbids. Each renamed task carries `formerIds[]`, and
  the daemon keeps an alias table that survives snapshot and replay. Any route that takes
  a task id accepts an old one.

  Campaign ids are NOT renamed: they are already short, meaningful, human-chosen names.

- **`deps`** are **typed edges**: each entry is `{ id, type }`. A bare task id is still
  accepted on input and normalizes to `{ id, type: "blocks" }` — which is what an untyped
  dep always meant in practice, since every one of them gated readiness.

  **The ten types.** Four are BLOCKING and gate readiness; six record a relationship and
  gate nothing. `GET /tasks/dep-types` serves this list, so a client can check a value
  before it posts rather than learning the names from a `400`.

  | Type | Blocking | Means |
  | --- | --- | --- |
  | `blocks` | yes | the dependency must finish first |
  | `parent-child` | yes | the holder is part of the dependency |
  | `waits-for` | yes | the holder waits on the dependency, without owning it |
  | `conditional-blocks` | yes | blocking only while a stated condition holds |
  | `related` | no | the two touch the same ground |
  | `tracks` | no | the holder follows the dependency without depending on it |
  | `discovered-from` | no | the holder was found while working the dependency |
  | `caused-by` | no | the dependency produced the holder |
  | `validates` | no | the holder proves the dependency landed |
  | `supersedes` | no | the holder replaces the dependency |

  An **unknown type is refused** with `400 unknown dependency type: <x>`. It never falls
  back to the default. A declared vocabulary that nothing enforces is exactly how WF-G80
  held three illegal values for two days without a single complaint.

  A task is **ready** when it is `open` and every **blocking** dep is `done`. Creating a
  task with an unknown dep id → `400` (fail honestly, no dangling references). **`priority`** (number, default 0, higher first) orders the ready queue.
  `POST /tasks/:id/claim` re-checks readiness (WF-G55): claiming an open task with an
  unresolved dep returns `409 task not ready: blocked by dep <id>`. Only the task's
  creator may bypass with `?force=1` for deliberate hand-assignment; otherwise prefer
  `claim-next` / `task next`. (Resolved WF-G55.)
  Diamond fan-out + checker-gate recipes: [`GRAPH-ENGINEERING.md`](./GRAPH-ENGINEERING.md).
  **`refs`** (free strings, e.g. `planmap:<topic>/<feature>`, `spells:G12`, or a doc path) link
  the task to a planning surface — the Plan Map, the Roadmap, or the deprecated project-tracker
  `GAPS.md` artifacts (see `tools/agora/gapIndex.mjs` for the GAPS.md side of the bridge).
- **`result`**: pass it with `state: "done"` to record WHAT was done (files touched, proof,
  test counts) on the task itself — orchestrators read results from the board instead of
  scraping chat messages. Stored on the task and in the history entry.
- **`checkpoint`** is the latest claimant-authored resumable note
  `{ at, by, did, next, files[] }`. Only the task's exact current `claimedBy` agent may write
  it, and only while state is `claimed` or `in_progress`. Cross-agent writes return `403`;
  open/unclaimed, `blocked`, and `done` writes return `409`. Latest valid note wins.
- **`retraceFiles[]`** is durable candidate work scope accumulated from lock paths/globs seen
  while the task is active plus every checkpoint `files[]` entry. It is a union, so a later
  checkpoint that omits an earlier file does not erase evidence. This field exists because
  the 30-minute lock TTL normally expires before the 120-minute active-task reap horizon.
- **`retrace`** is stamped when a dead claimant is reaped:
  `{ reapedAt, lastSeenAt, agent, filesHeld[], files[], checkpoint, sayTail[] }`.
  `filesHeld[]` is the structured set of locks still live at reap; `files[]` is the complete
  union of durable task evidence, current locks, and checkpoint files. Clients should scope
  unstaged, staged, and untracked/new Git inspection to `files[]`, falling back to
  `filesHeld[]` for dossiers written by older daemons.
- **`reapCount`** increments only when a reap attaches a retrace dossier. It survives repeated
  claims/reaps so orchestrators can distinguish a one-off crash from a repeatedly failing task;
  clean retirement/release does not increment it.
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
- A successful claim snapshots the live agent's registration pet from
  `dashboard/pets/pets.json`. The public agent record exposes it as `agent.pet`; the task
  stores the same snapshot as `assignedPet` and inside `claimedAgent.pet`. A handoff snapshots
  the recipient's registered pet. Reaping or retiring reopens the task and
  clears its current `claimedAgent`/`assignedPet`, while claim and handoff history retain
  `petSlug`. Legacy journal records are deterministically migrated to a catalog pet during
  replay, but every new HTTP/CLI registration must explicitly select one.
- The dashboard animates that assigned pet from durable board state plus short SSE reactions.
  This is presentation state only; it does not add mutable status to the agent record or event
  log. The action contract is:

  | Pet action | Agora meaning |
  |---|---|
  | `idle` | no active task, lock, reservation, or campaign |
  | `waiting` | claimed task or queued file reservation |
  | `running` | in-progress task or held file lock |
  | `review` | active campaign ownership, task creation/category/checkpoint work |
  | `waving` | registration, message post, or the sender side of a handoff |
  | `jumping` | task claim/completion, fulfilled reservation, or handoff recipient |
  | `failed` | blocked task, expired lock, or released/reaped task |
  | `running-right` | file lock acquired |
  | `running-left` | file lock or reservation released |

  Live reactions run for several atlas loops, then presence returns to the durable state above.
  Heartbeats deliberately do not trigger an animation, because doing so would keep every pet
  waving or resetting instead of showing useful work state.
- Each sweep also reopens a claimed/in-progress task whose `claimedBy` identity has no roster
  record. The `reaped` history entry records `reason: "orphan claimant missing from roster"`
  and the previous claimant id, repairing strands created before target validation existed.

### Campaign membership — the authoritative mapping (WF-G170)

Every task belongs to one campaign, or it is standalone. This section is the
authoritative rule. `inferCampaignForTask` in `store.mjs` is the same rule in
code, and `POST /tasks/membership/infer` is the only caller. Do not write a
second rule.

**A campaign decision is made at intake (WF-G171).** `POST /tasks` refuses a
task that names no campaign and gives no standalone reason. The task record
keeps the decision in `campaignDecision`:

| `kind` | Means |
| --- | --- |
| `campaign` | The caller named a campaign. |
| `defaulted` | The caller owns exactly ONE active campaign, and it supplied the value (WF-G85). |
| `standalone` | The caller said that no campaign owns this work, and gave the reason. |
| `absent` | Nobody decided. Only a daemon in `legacy` intake mode can make this record. |

**The intake mode.** The live daemon starts in `required` mode. It rejects a task
with only a title and campaign decision; the body or a ref must describe the work
(WF-G293). `task show` warns when an older task has no body. Set
`AGORA_CAMPAIGN_INTAKE=legacy` to accept a campaignless task again. Use the
escape hatch only to absorb a batch that predates the rule. An imported server
(`createAgoraServer({ dir })`) defaults to `legacy`, because the suites written
before WF-G171 create tasks with a bare title. Pass
`createAgoraServer({ dir, campaignIntake: 'required' })` to test the gate.

**The evidence ranks, for a task whose campaign is not recorded.** The first
rank that matches decides. A later rank does not run.

| Rank | Evidence | Example |
| --- | --- | --- |
| 1 | The task and the campaign name the same Plan Map topic or feature. | `refs: ["planmap:worldforge/interiors"]` matches the campaign named `worldforge/interiors`. |
| 2 | The task and the campaign carry the same wave name. | `wave: "board-drain-20260920"` |
| 3 | The task touched a file that the campaign claims. | `retraceFiles: ["src/spells/cast.ts"]` matches a campaign that claims `src/spells`. |
| 4 | A campaign is NAMED for the task category. | Category `combat` matches a campaign whose name or code is `combat`. |

**The category rule — when category evidence is not sufficient.** A category is
a domain label. It says what a task is about. It does not say which campaign
owns the task. Many campaigns can share one domain, so a category alone would
attach a task to a campaign that never asked for it. Category evidence is
therefore sufficient only at rank 4, where a person gave a campaign that exact
name. In all other cases the category is not sufficient, and the task is
standalone.

**The four verdicts.** A dry run gives one verdict for each task.

| Verdict | Means | `campaignId` |
| --- | --- | --- |
| `recorded` | The task already names its campaign. | unchanged |
| `inferred` | Exactly one campaign matched a rank. | filled |
| `ambiguous` | Two or more campaigns matched. The daemon does not break the tie. Every candidate is listed in `inferredCandidates`. | empty |
| `standalone` | No rank matched. The verdict names the evidence that was absent. | empty |

There is no `unknown` verdict. `unknown` told a reader that the daemon had not
looked. The daemon did look, and it found nothing, which is a different fact.

**To repair a membership, use `POST /tasks/:id/campaign` (WF-G169).** An
orchestrator, a master or a human can move one task to another campaign, or
make it standalone. A reason is mandatory. The destination campaign must exist,
and it must not be `done`. The task id does not change, because finished
results and gap rows quote task ids. After the move, `task show` and
`campaign show` report the same membership.

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
  `{ ..., "petSlug": "gf-sd", "role": "orchestrator", "sessionId": "<task-thread-id>" }` or
  `client.mjs register <handle> --pet gf-sd --role orchestrator --session <task-thread-id>`.
  GET defaults to `channel=main`, so workers polling their inbox never see command
  traffic unless they ask (`--channel command|all`) — the gate is on posting, not reading.
  CLI: `say --channel command <body>`, `inbox --channel command`.
- `?to=all` (or omitted) → unfiltered. `?to=me` resolves your agent id from the bearer (no
  token ⇒ behaves like `all`). `?to=<agentId>` returns messages where that id is the
  sender **or** recipient, plus all broadcasts.

### Dormant orchestrator wake bridge

`watchdog.mjs` turns durable command-feed messages into one bounded orchestrator turn. A target
must first be registered in the machine-local `.agent/agora/watchdog-targets.json` through
`watchdog.mjs register-target`; technical thread UUIDs never belong in tracked `agents.json`.

For `codex-session-turn-once`, delivery has two separate stages:

1. The watchdog selects the Codex executable matching the saved session's `cli_version`, pins
   the model from its last successful turn, and runs `codex exec resume` once.
2. After exit code 0, the watchdog asks the operating system to open the documented
   `codex://threads/<thread-uuid>` route. This launches or focuses the desktop app on the same
   saved task. A surface failure is audited but does not erase the successfully delivered turn.

The deep link is navigation, not execution. Opening it manually is safe when the task is idle:

```powershell
Start-Process 'codex://threads/<thread-uuid>'
```

`/app` is different: it is typed inside an active Codex TUI and hands that current session to the
desktop app. It is useful for a human handoff but cannot service an unattended Agora wake. Never
start a desktop turn while the one-shot CLI child is still active on the same thread.

Wake proof is durable and visible: the delivery cursor advances only after `CALLSIGN AWAKE` or a
clean child exit, and the follow-up `WAKE-AUDIT` includes `surface=desktop-thread-opened`,
`desktop-surface-error`, or `desktop-surface-unavailable` when a completion action was requested.

### Visual-proof server freshness and recovery

A running process and an HTTP 200 response are not enough to trust a screenshot. Before a new
visual capture, name a repository source file changed by the current task and run the shared
gate:

```powershell
node scripts/dev-server-watchdog.cjs probe --base http://127.0.0.1:3000/Aralia/ --module <changed-source-module>
```

`tools/vistest/shoot.ts` requires the equivalent `--fresh-module <path>` argument. It runs this
gate before it creates an output directory, opens Chromium, or writes a PNG. The gate reports a
`LIVENESS_FAILURE` when the server does not respond and a `FRESHNESS_FAILURE` when cache-busted
Vite `?raw` source bytes do not have the same SHA-256 digest as the checkout. It records the
result in an ignored `.agent` evidence log.

The watchdog's `watch` mode diagnoses only. Its `supervise` mode requires
`--consent-restart-owned-child` and can replace only a Vite child process that the same watchdog
started. It never stops or restarts a foreign process or port owner. Recovering an existing
shared server remains an operator action.

Focused watchdog, capture, and copy-command tests pass 30/30. A live port-3000 probe matched the
checkout hash while leaving the existing server PID unchanged. Dead and stale test servers
failed before any capture output was created. This proves freshness immediately before a new
capture; it does not prove that an already-open page applied an earlier HMR update.

### Heavy-page performance traces

Warm a heavy development page once before measuring it. Start the trace with
`performance_start_trace(reload=false, autoStop=false)`. Then call
`navigate_page(type=reload, timeout=120000)` explicitly and wait for a specific rendered marker
from the target page. Stop the trace with `performance_stop_trace()` and do not supply a file
path unless the operator agreed that path in advance.

Accept the measurement only when the trace has exactly one navigation. Reject traces with
multiple navigations or page-reload churn. They show an unstable run, not usable performance
evidence.

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
| POST | `/gaps` | Bearer | `{ "project", "gap", "evidence"?, "why"?, "next"?, "proof"?, "severity"?, "classification"?, "surface"?, "suggestedAgent"?, "detectedDuring"?, "notes"? }` | `201 { id, file, line, row }` — appends ONE row and returns the id it allocated | `400` on an empty gap or an unknown project; `500` if the registry could not be written; `401` |
| GET | `/gaps/view` | none | `200` browsable HTML of the gap registries; `?project=` shows one project's tracker card |

**`POST /gaps` — gap intake without a lock (WF-G113).** `docs/projects/GLOBAL_GAPS.md` was
the hottest lock on the 2026-09-09 board: every worker owed it a one-row append, ids raced
(GG-126/130/131 and GG-140/141 vs GG-144/145 collided), Windows threw EBUSY mid-write, and
three-hour locks held for one row blocked six workers who then filed by hand. The daemon
owns that write now.

- `project` is `global` (docs/projects/GLOBAL_GAPS.md), `workflow`
  (tools/agora/WORKFLOW_GAPS.md), or a directory name under `docs/projects/` whose
  `GAPS.md` exists. Anything else is a `400`, never a silently created file.
- The id comes from the registry itself: the YAML header's `id_prefix` / `next_free_id`
  when it declares them, otherwise the highest id already filed plus one. A stale header
  never mints a duplicate — the rows always win when they are ahead. `next_free_id` is
  advanced with the write, so a later hand-authored row cannot collide either.
- Column placement is read from THAT file's own header row through the same mapping
  `gapIndex.mjs` parses with, so the many per-project column orders all land correctly.
  A column the caller did not fill gets the registry's em dash, never a blank cell.
- The file's EOL is preserved (GLOBAL_GAPS.md is CRLF), no other row is rewritten, and
  the row goes where that registry files new rows (WORKFLOW_GAPS.md last, GLOBAL_GAPS.md
  first) — the direction is read from the existing ids.
- **Provenance is stamped server-side** from the authenticated agent: `Registered by` is
  your handle, `Registrant ID` your agent UUID, `Task/thread` your session id. A caller
  cannot file a row as someone else.
- Writes are serialized on ONE in-process promise chain. No Agora file lock is taken or
  needed — that is the whole point of the gap.
- CLI: `client.mjs gap add --project <p> --gap "..." --evidence "..." --why "..."
  --next "..." --proof "..."`.

---

## Data model (from `store.mjs`)

```
Agent   { id, handle, token, registeredAt, lastSeen, lastMeaningfulAt,
          lastHeartbeatAt, status, note, pet }
Lock    { id, paths[], globs[], agentId, repo, reason, createdAt, expiresAt, ttlMs }
        // GET /locks adds holderHandle, holderLastSeen, holderIdleMs, holderStatus
Reservation { id, paths[], globs[], agentId, reason, createdAt, queueSeq, position }
Campaign { id, role, leadCampaignId, agentId, repo, scope, paths[], globs[], wave, state,
           warnings[], createdAt, updatedAt, history[] }
Task    { id, title, body, campaignId, wave, state, createdBy, creatorAgent, claimedBy,
          claimedAgent, assignedPet, deps[], priority, refs[], result, checkpoint,
          retraceFiles[], retrace, reapCount, createdAt, updatedAt, history[] }
Message { id, seq, from, to, body, createdAt }     // to = agentId | "all"
Event   { seq, type, payload, ts }                  // journal line + SSE envelope
```

Tunables (store defaults): presence **online** TTL 10 min (`presenceTtlMs` 600,000),
presence **drop** 60 min (`presenceDropMs` 3,600,000), heartbeat-only lease 2 hours
(`heartbeatOnlyLeaseMs` 7,200,000), lock TTL 30 min (`lockTtlMs` 1,800,000), lock T-minus
warning 5 min (`lockExpiringWarnMs` 300,000), idle-reservation grace 2 min
(`reservationGraceMs` 120,000), snapshot every 200 events. The reap horizon **doubles** for an
agent holding a `claimed`/`in_progress` task. The daemon sweeps every 30 s
(`SWEEP_INTERVAL_MS`, `server.mjs`). (Note: the spec mentions a presence TTL but does not fix
the exact numbers; the code values above are authoritative.)

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
   bounded to 30 minutes by default; `--daemonize` survives harness background cleanup and accepts
   `--owner-pid`/`AGORA_OWNER_PID`; re-run it only
   while the owning session is active. `--forever` is explicit and still cannot exceed the
   server's 2-hour heartbeat-only lease without meaningful authenticated activity.

### Verification contract for new server routes

Before a shared-daemon restart, prove a route with a fresh in-process `createAgoraServer` wiring
test and record `AWAITS LIVE DAEMON RESTART` in the task result. Only the daemon owner performs the
restart. Once the installed daemon serves the new source, call the real port-4319 route and amend
the result with its status and response shape. In-process proof is authoritative for wiring but is
not presented as live deployment proof.

---

## Copy-paste curl examples

```bash
# 0. Is it up?
curl -s http://localhost:4319/health

# 1. Register (open) — capture the token
curl -s http://localhost:4319/pets
TOKEN=$(curl -s -X POST http://localhost:4319/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"handle":"claude-A","petSlug":"gf-sd","note":"worldforge interiors"}' | \
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

Three commands added 2026-09-09 that have no older equivalent:

- `task show <id>` — the FULL task record (body, refs, typed deps, claimant, result,
  finding/evidence, blocked reason, checkpoint, last 5 history entries). `tasks` truncates
  ids and results and printed no blocked reason, so workers were reading a sibling task's
  result out of `.agent/agora/snapshot.json` by hand (WF-G118). `tasks --state blocked` now
  prints each blocked reason under its row.
- `task lint <id>` — the pre-dispatch freshness check (WF-G111). Exits 1 on findings.
- `task new <title> --campaign <id>` or `task new <title> --standalone --reason "..."` —
  `POST /tasks` above (WF-G171). Name a campaign, or say that no campaign owns the work and
  why. The client refuses `--standalone` without `--reason` before it calls the daemon.
  Quote a multi-word title, `--body`, and `--reason`. Extra bare words now cause a refusal before
  task creation instead of being discarded (WF-G236). For long or multiline instructions, use
  `--body-file <path>`; the client reads the complete UTF-8 file without trimming it. `--body`
  and `--body-file` are mutually exclusive, and a missing or empty file is refused.
  Add `--deliverable <output-path>` to record the artifact to produce, separate from input `--ref`
  values (WF-G179). `task show` prints the deliverable directly below the refs.
- `task design <id> --text "..."` or `task design <id> --file <path>` — write a durable
  multiline design section on an unfinished task (WF-G304). The file is read as UTF-8 without
  trimming. `task show` renders it as its own block. A legacy multiline `checkpoint.next`
  beginning with `DESIGN` is displayed as a labelled legacy design block, without rewriting
  the historical task; other multiline next steps also retain their line breaks.
- `task campaign <id> (<campaignId> | --standalone) --reason "..."` — `POST /tasks/:id/campaign`
  above (WF-G169). Moves one task to another campaign, or makes it standalone. Orchestrator,
  master or human only. `task show` and `campaign show` agree straight after the move.
- `gap add --project <p> ...` — `POST /gaps` above (WF-G113).
- `gap update <id> [--project <p>] --status <s> --note "..."` / `gap resolve <id> --note "..."` — `POST /gaps/:id` (WF-G124): rewrites only the named cells of that one row, in whichever table holds it, under the same serialized chain; `--note` appends to Notes with the caller's handle and date, `--notes` replaces it. The id and the provenance cells cannot be changed. `404` unknown id, `400` no such column or nothing to update.

> The CLI (`tools/agora/client.mjs`) is built by a parallel slice. Per the design spec it
> wraps the same endpoints; the intended commands for the common loop are:

```bash
export AGORA_AGENT_ID="<your-task-or-thread-id>"     # scope identity before ANY client call
node tools/agora/client.mjs pets                     # GET  /pets
node tools/agora/client.mjs register <handle> --pet <slug> --session <your-task-or-thread-id> # POST /agents/register
node tools/agora/client.mjs lock src/foo.ts          # POST /locks
node tools/agora/client.mjs reserve src/foo.ts       # POST /reservations
node tools/agora/client.mjs reservations             # GET  /reservations
node tools/agora/client.mjs unreserve src/foo.ts     # DELETE /reservations/:id-or-path
node tools/agora/client.mjs campaign claim wave-a --role lead --path src/foo.ts
node tools/agora/client.mjs campaign list [--state s] [--mine] # GET /campaigns (hierarchical, task counts)
node tools/agora/client.mjs campaigns                # alias to campaign list
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
handle or session id>` on the registration call and every later client call: identity then
lands in `client-identity.<id>.json`, fully isolating agents. New unscoped registration
is refused by default, even in a fresh checkout (WF-G344). An existing unscoped identity
can still be read. Deliberate single-agent registration to the legacy shared path needs
`--legacy-unscoped`; keep `AGORA_AGENT_ID` unset for every later call in that mode.

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

### Gap intake — what a row must carry (WF-G205, WF-G200)

`gap add` files ONE row in a registry through the daemon, so a worker needs no lock for a
one-row append (WF-G113). Two rules make the row usable by the next reader:

1. **`--suggested-agent` is REQUIRED** and must be one exact `tools/agora/agents.json` key, or
   `human-operator`. It is ROUTING data: an orchestrator picks the repair lane from that column.
   The command used to accept an absent value and write the registry's em dash, which the
   registry's own validator then rejected — so `gapIndex.test.mjs` went redder with every filed
   row and a real provenance fault would have been invisible inside the noise. The refusal prints
   the accepted keys.
2. **A near-duplicate is refused.** The new gap text is compared by token overlap against the OPEN
   rows of the same registry, and the matches come back with a `409`-style refusal. Three workers
   filed one defect as WF-G189, WF-G192 and WF-G196 inside one hour. Read first with
   `gap search "<text>"`, add your evidence to the row that exists with `gap update <id> --note`,
   or pass `--force` when it really is a separate defect.

A registry that declares `allowed_classifications` or `allowed_surfaces` in its YAML header also
makes `gap add` WARN on a value that is not in the list. That is a warning, not a refusal: a new
surface is legitimate, but add it to the header in the same turn.

**Transient write failures (WF-G206, WF-G180).** On this Windows host an `open()` of a repo file
fails at random with `UNKNOWN` (libuv errno -4094), `EBUSY` or `EPERM` while another process holds
a short-lived handle on it. The daemon now retries the open with backoff for about 1.4 s, and when
the budget runs out it answers `503` with the file, the errno and the likely holder named, instead
of a bare `500 UNKNOWN: unknown error`. A `503` from `gap add` means retry; it does not mean the
registry is broken.

### Task lint — declaring what a task creates or removes (WF-G191, WF-G193)

`task lint` reports every path-shaped token in a body that is not in the checkout. A task that
exists to CREATE a file, or one whose whole point is that a cited path is GONE, could therefore
never lint clean, so agents either filed vaguer tasks or learned to ignore the exit code.

The body now carries a marker line per declaration:

```
CREATES: src/utils/visuals/conditionPalette.ts
EXPECTED-ABSENT: docs/projects/town/GAPS.md
```

- A `CREATES:` path is reported as a **NEW PATH**, which is a note, not a defect. The lint FAILS
  when that path already exists, because the claim is stale and the task would overwrite work
  that has landed.
- An `EXPECTED-ABSENT:` path is an ASSERTION checked in reverse: absent is clean, PRESENT is the
  defect. The day the file comes back, the doc-repair task fails its own lint.

Several paths may share one marker line, separated by a comma or a space.

### Task categories (WF-G194)

`--category` is free text and no command listed the values in use, so an agent guessed and a silent
typo hid the task from an orchestrator that filtered on it. `task categories` now lists every
category on the board with its count, and `task new --category <name>` WARNS (never refuses) when
no other task uses that name.

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

## The read-only surface (port 4321)

A separate process that READS the record and can never change it.

```bash
node tools/agora/readonly-server.mjs            # port 4321, reads .agent/agora
node tools/agora/readonly-server.mjs --port 4321 --dir .agent/agora
```

| View | What it answers |
|---|---|
| `GET /` | The aging view as a page — what has gone quiet |
| `GET /health` | Whether the record can be read, and how stale it is. 503 when it cannot |
| `GET /aging` | Every item that can still move, grouped `active`, `quiet`, `unknown` |
| `GET /campaigns`, `/tasks`, `/seats` | The records themselves |

**It does not need the daemon.** It reads the snapshot off disk, because a triage view is wanted
most when something has gone wrong — and the daemon may be the thing that is wrong.

**It cannot write, structurally.** It imports one reader module that holds no write call, never
`createStore`, and no route file. Every method except GET and HEAD is refused with 405 by one gate.
`readonly.test.mjs` proves this by reading the source, so the guarantee is checked on each run.

**It includes the journal tail (WF-G168).** The snapshot is written every 200 events, so the surface
also applies the journal events newer than it, in memory, with the daemon's own reducers from
`store-reducers.mjs`. No record is written. An event it cannot apply is named on the page and in
`source.notApplied`. With no snapshot yet and a journal present, it rebuilds from the journal alone,
as the daemon does; a corrupt snapshot is still refused. A view that hides its own staleness turns
"I do not know" into "nothing is wrong".

**The aging rule.** An item is judged against its OWN rhythm, never a fixed number of days:

- Writes within 60 seconds of each other count as ONE action, so a creation burst cannot look like a fast rhythm.
- Record maintenance — `membership`, `id-migrated`, `deps-typed`, `deps-renamed` — is done TO the record, not to the job, and is not activity.
- Under three recorded gaps, an item reads `not enough history yet`. It is never called quiet and never called fine.
- Above that, it is `quiet` when its silence passes twice its own typical gap.
- Finished work is left out, and the number left out is printed.
- `GET /campaigns/:id/triage` — the triage report, built from the snapshot plus the journal tail by the same rules the daemon uses (`campaign-model.mjs`, `store-reducers.mjs`). Agent liveness uses the daemon's production drop horizon of one hour unless the server is started with another.

## Charters, the campaign view, and triage

Design: `docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md` §6, §7, §10, §72.
The rules live once, in `tools/agora/campaign-model.mjs`, a module with no side effects. The daemon
and the read-only surface both import it.

### The charter

A charter is the operating plan of a campaign. It is refused, with every problem named, when:

- a field that its tier requires is missing (§4 requirements matrix);
- its stated tier is LOWER than its measures require. The highest single measure sets the tier: 6-20 tasks or 11-50 files is standard, more is large; medium risk is standard, high risk is large; a declared touch of `public-api`, `daemon-protocol`, or `save-format` is large;
- `effort` carries a time estimate (any key such as `agentHours`). Size a charter by `taskCount` and `fileCount` only;
- `planMapPrimary` is not exactly one reference, names a missing topic or an unresolved feature slug, is superseded, or reads `done` while the campaign is not done;
- an acceptance criterion names no evidence, a task names a missing milestone, task dependencies form a cycle, or an approval task names a role that may not approve the tier.

| Route | CLI | Who |
|---|---|---|
| `POST /campaigns/:id/charter` `{charter, summary}` | `campaign charter <id> --file f.json --summary "..."` | the owner or the command channel |
| `POST /campaigns/:id/charter/approve` `{note}` | `campaign approve <id> --note "..."` | small/standard: master or human; large: human. Never the agent that submitted it, unless human |
| `GET /campaigns/:id` | `campaign show <id>` | anyone, token-free (shows charter, validity, tasks by state, deputies, attended status and progress) |

Any revision appends to `charter.revisions` and clears earlier approvals: an approval is of the text
that was read. The campaign view joins the campaign, its charter and live validity, its tasks with
computed `startedAt`, `completedAt`, and `agentTrail`, and progress. Progress counts tasks only; judge
each acceptance criterion separately.

### Triage

| Route | CLI | Rule |
|---|---|---|
| `GET /campaigns/:id/triage` | `campaign triage report <id>` | Read-only. The store function never emits; a test compares the snapshot bytes before and after |
| `POST /campaigns/:id/triage/start` `{reason}` | `campaign triage start <id> --reason "..."` | Command channel; the campaign is active, nobody is in its seat, and the owning session is not live |
| `POST /campaigns/:id/triage/:taskId` `{disposition, reason, ...}` | `campaign triage apply <id> <taskId> <disposition> --reason "..."` | One task per call. A task takes exactly one disposition |
| `POST /campaigns/:id/triage/finish` `{reason}` | `campaign triage finish <id> --reason "..."` | Refused until every task has a disposition; the caller then owns the campaign, recorded as `adopted` |

| Disposition | Effect | Needs |
|---|---|---|
| `continue` | no change | reason |
| `reopen` | claimed, in progress, or blocked -> open; claim cleared | reason |
| `reassign` | -> claimed by `toAgentId` | a live target |
| `block` | -> blocked | a named `blocker` |
| `escalate` | `escalated: true` | reason |
| `supersede` | -> done, `closedReason: superseded by <id>`, `supersededBy` | `supersededBy`, a caller registered as `human`, and `approvalQuote` |
| `close-obsolete` | -> done, `closedReason: obsolete: <reason>` | a caller registered as `human`, and `approvalQuote` |

**The human rule, and its limit.** The daemon cannot see a person. It refuses a destructive
disposition from any caller not registered with role `human`, and it keeps the approval's words on
the record. When an agent relays an approval given in chat, the quote must be the operator's words.

**Plan Map reconcile (WF-G150).** A task with `closedReason` is no evidence that its feature exists.
A feature that a not-yet-done chartered campaign names as its primary is capped at `active`.
`planmap-reconcile.mjs` prints each capped feature as `HELD at active`.
