# Master orchestrator — plan

**Date:** 2026-07-06
**Status:** specced (approved in shape; not built)
**Campaign:** Tooling (Agora)
**Chosen approach:** B — doctrine + read-only tools + one guarded server primitive

## What it is

A thin layer that lets one **master** session manage several **orchestrators** at once. Today an
orchestrator is just an agent that holds an active lead campaign on the Agora daemon. There is no
way to see all orchestrators at a glance, and no clean way to step in when one dies or when two
collide over the same files. The master fills that gap.

The master oversees; it never edits game files. It holds **no file locks and no file leads**.

## Why now

Multiple orchestrators already run concurrently against the one shared checkout (a 2D-UI playtest
lead, a plan-map codex swarm, desktop chat sessions). When an orchestrator goes silent, the daemon
frees its locks and reopens its tasks — but its **campaign is left "active" and orphaned**, and
nobody arbitrates when two orchestrators want the same files. A human has to notice and fix it by
hand. The master makes that a first-class, tooled job.

## Chosen approach (B) and the two rejected ones

- **A — playbook + read-only tools, no server change.** Rejected as the primary: to take over a
  dead orchestrator's campaign the master must claim a fresh lead, but the orphaned campaign is
  still marked `active`, so the claim is rejected (`store.mjs` conflict loop, lines 705–718).
  Adoption becomes a hack.
- **B — playbook + read tools + one guarded `campaign adopt` endpoint. CHOSEN.** Smallest change
  that makes "step in when an orchestrator dies" actually clean. Mirrors the existing
  `unlock --force` for stale lock holders.
- **C — an always-on master-watch daemon that auto-nudges and auto-adopts.** Deferred: that is the
  self-running supervisor, a later phase, not this build.

## Components

### 1. Doctrine — `tools/agora/MASTER-ORCHESTRATOR.md`

Sits one level above `tools/agora/ORCHESTRATOR.md`. Defines:

- **What a master is** — an agent registered as `master` that holds no locks/leads and runs one
  loop: **roster → rollup → conflicts → act → repeat**.
- **The two channels** — agent fleets are driven through the Agora board; desktop chat sessions are
  driven through session messages (the CCD `send_message` handoff). One doctrine covers both.
- **The acts** — nudge a stalled orchestrator; adopt a dead one's campaign; arbitrate a turf fight
  (demote the loser to deputy, or reschedule it to a later wave); sequence waves so N orchestrators
  don't thrash the machine.
- **Hard rules** — the master never does worker work, never claims a file lead, and adopts only a
  genuinely dead orchestrator (owner stale past the drop horizon or gone).

### 2. CLI — `tools/agora/master.mjs`

All commands compose existing endpoints; only `adopt` needs the new primitive.

- `roster` — every active orchestrator (agent + its lead campaign) with health online / stale /
  dead. Derived from `GET /agents` ∩ `GET /campaigns?state=active` (an orchestrator = an agent
  holding an active lead campaign).
- `rollup` — every campaign with task counts (open / claimed / in_progress / done / blocked),
  percent done, last activity, and `orphaned` / `hot` flags. Derived from `GET /campaigns` +
  `GET /tasks`.
- `conflicts` — orphaned campaigns (active, owner gone), stale locks blocking online agents,
  overlapping active leads, and ready tasks starving unclaimed.
- `nudge <agentId|campaignId> "<msg>"` — message a stalled orchestrator (`POST /messages`,
  `to: <handle>`). For desktop chat sessions the doctrine points at the session `send_message`.
- `watch` — one-shot snapshot that prints roster + rollup + conflicts for the driver. **Not** a
  daemon (that is phase C).
- `adopt <campaignId> [--to <agentId>]` — transfer an orphaned campaign, reopen its pending tasks,
  clear its dead locks. Uses the new endpoint below.

### 3. Server primitive — `POST /campaigns/:id/adopt`

The single daemon addition. Body `{ newAgentId? }` (defaults to the caller).

- **Guard:** allowed **only** when the current owner is stale past the drop horizon (`presenceDropMs`)
  or already reaped/gone. Refuse with `409` while the owner is online — the exact mirror of
  `unlock --force`'s stale-holder rule.
- **Effect:** reassign `campaign.agentId` to the new owner, set an `adopted` history entry, reopen
  the campaign's `claimed`/`in_progress` tasks, and emit a `campaign.adopt` event.
- Implemented in `store.mjs` next to `claimCampaign` (lines 672–753) and wired in `server.mjs`
  alongside the other `/campaigns` routes (lines 289–339).

## Data model

No new persistent entity. Orchestrators stay **derived** (agents ∩ active-lead-campaigns). The
only stored change is the `adopted` history entry on an existing campaign record.

## Failure model

- **Dead orchestrator** → `conflicts` flags its campaign as orphaned → `adopt` transfers it and
  reopens its tasks for redistribution.
- **Stale lock blocking live work** → `conflicts` surfaces it → existing `unlock --force`.
- **Two orchestrators over the same files** → the daemon already rejects the second lead at claim
  time; the master arbitrates by demoting one to deputy or rescheduling it.
- **Machine thrash** → the master caps concurrent active campaigns/waves per the doctrine.

## Testing

Follow the existing `tools/agora/*.test.mjs` pattern.

- `adopt` guard: owner online → `409` refuse; owner stale/gone → transfer + tasks reopened + event
  emitted.
- Derive logic: `roster` / `rollup` / `conflicts` against a seeded store with known
  agents/campaigns/tasks/locks.

Run with the working glob (`node --test "tools/agora/*.test.mjs"` — the bare directory form is
broken on Node 22.19).

## Out of scope (explicitly)

No autonomy loop, no auto-reassignment on a timer, no new persistent orchestrator entity, no
rollback machinery. Those are phase C (`master watch` daemon) if ever wanted.

## Build order

1. `POST /campaigns/:id/adopt` + `store.mjs` adopt logic + tests (the only daemon change).
2. `tools/agora/master.mjs` with `roster` / `rollup` / `conflicts` / `nudge` / `watch` / `adopt`.
3. `tools/agora/MASTER-ORCHESTRATOR.md` doctrine + glossary entries in `tools/agora/GLOSSARY.md`.
