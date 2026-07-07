# Agent identity and provenance — plan

**Date:** 2026-07-06 (re-scoped the same day, after the command-channel feature shipped)
**Status:** specced. Partly built.
**Campaign:** Tooling (Agora)
**Builds on:** fable's role-gated command channel (shipped 2026-07-06)
**Needed by:** agent-retrace, agent-ping, agent-escalation, master-orchestrator

## What this is

Every agent should say who it is and where it came from.

Today an agent has only a handle and a few optional fields. That is why a running fleet is hard to
read. It bit us this session. When the agent `fable` changed `store.mjs`, finding out who did it
meant grepping the raw journal, because the live roster had already dropped `fable`. Provenance
should not live only in a log you have to search.

## What already exists — do not rebuild it

fable shipped the role-gated command channel on 2026-07-06. It already covers part of this work.

- Every agent has a `role`: `worker`, `orchestrator`, `master`, or `human`. It defaults to
  `worker`. The role sets what an agent may do. Only an orchestrator, master, or human can post on
  the command channel.
- Messages have a `channel`: `main` or `command`. The role limits who can post to `command`.
  Reading is open.
- The server, the client, and `PROTOCOL.md` all support this.

Reuse it. This plan does not change `role`, the roles list, or the command channel. Two points
follow.

- The command channel is the channel orchestrators use to run the fleet. The master and the
  escalation queue will post on it. It is a part of this epic that already shipped.
- `role` and the new `type` field are separate. `role` says what an agent may do. `type` says what
  kind of program it is. They sit side by side. A person-run master session is `role: master`,
  `type: claude-session`.

## What this plan adds

**Who the agent is.** A new `type` field: `claude-session`, `claude-subagent`, `codex`, `gemini`,
or `human`. The `handle`, `role`, and `model` fields already exist.

**Where it came from.** New `spawnedBy`, `campaign`, and `cwd` fields. `spawnedBy` holds the
parent's handle. These links form a chain back to the person at the top. The `sessionId` field
already exists.

**How to reach it.** Worked out from `type`. Reach a `claude-session` with `send_message`. Reach a
`claude-subagent` with `SendMessage`. Reach a `codex` or `gemini` agent through its process or log.

### Example — the master session describing itself

```
handle:      master.desktop
type:        claude-session   (new)
role:        master           (exists)
model:       opus-4.8         (exists)
spawnedBy:   remy (root)      (new)
campaign:    agora-fleet      (new)
sessionId:   local_1aa4a366-c689-4296-8211-055c54394b24   (exists)
cwd:         F:/Repos/Aralia  (new)
handleValid: true             (new)
```

## Handle format

A handle reads `role.domain`, with optional `/child` parts, all lowercase. For example:
`master.desktop`, `orch.planmap/glossary`, `worker.combat-view`.

The daemon rejects opaque names like `agent-16d417` and bare names like `alice`. The check is
`validateHandle(handle)`, which is already in `store.mjs`. `registerAgent` records the result as
`handleValid`. For now this is a flag, not a block. Blocking bad handles would reject the current
live fleet, so that waits for a migration.

## Who sets the identity

- The spawner sets provenance. Whoever starts an agent sets its `type`, `spawnedBy`, and `campaign`,
  plus the existing `role` and `model`. This extends the current rule that the spawner hands out the
  handle.
- A root agent sets its own. A chat a person opens has no spawner, so it describes itself.

## Changes to the daemon

`registerAgent` already stores `handle`, `note`, `model`, `sessionId`, and `role`. Add `type`,
`spawnedBy`, `campaign`, `cwd`, and `handleValid`. Pass the new fields through the server `register`
endpoint, and add client flags, the same way fable added `--role`.

Add three read-only commands.

- `whois <handle>` shows one agent's full record.
- `lineage <handle>` walks `spawnedBy` up to the root.
- `tree` shows the fleet as a spawn tree, grouped by campaign.

Extend `whoami` to show the full record.

Add `retireAgent(agentId, { note })` for a clean exit. It releases the agent's locks. It reopens the
agent's in-flight tasks with a `retired` marker, not the crash marker `reaped`, plus an optional
note. It then drops the agent.

## Tests

`store.identity.test.mjs` already holds the failing tests for `validateHandle`, the new fields, and
`retireAgent`. One fix from the re-scope: the "defaults to empty strings" test must not check
`role`, because `role` now defaults to `worker`. Do not repeat the command-channel tests fable
already wrote.

## Out of scope

`role`, the command channel, the roles list, and the posting limits. All shipped. Identity across
machines, and any anti-spoofing beyond the current token.

## Build order

1. Keep `validateHandle`. Fix the role test. Record `handleValid` in `registerAgent`.
2. Add `type`, `spawnedBy`, `campaign`, and `cwd` to the record, the server, and the client.
3. Add `whois`, `lineage`, and `tree`. Extend `whoami`.
4. Add `retireAgent` and its command.
