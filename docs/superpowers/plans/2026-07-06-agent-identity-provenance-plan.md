# Agent identity & provenance — plan

**Date:** 2026-07-06
**Status:** specced (approved in shape; not built)
**Campaign:** Tooling (Agora)
**Foundation for:** agent-retrace, master-orchestrator

## What it is

A rich, standardized identity for every agent on the Agora daemon, so you can always tell **which
agent is which and where it came from**. Today an agent's whole identity is a self-chosen handle
plus an optional model tag. That is why a running fleet of two dozen agents is illegible — cryptic
names like `agent-16d417` with no indication of what they are or who started them.

## Why now

This is the root gap under two other pieces. A retrace dossier is worthless if the dead agent was
just `agent-16d417`; the master orchestrator's roster and conflict views are only readable once
agents carry real identities. Fix identity first, and both of those become legible for free.

## The model — three parts

**1. Who I am**
- `handle` — unique, structured name (see grammar below).
- `type` — the runtime kind: `claude-session` (a desktop chat), `claude-subagent` (spawned via the
  Agent tool), `codex`, `gemini`, `human`.
- `role` — what it does: `worker`, `orchestrator`, `master`, `playtester`.
- `model` — `opus-4.8`, `fable-5`, `gpt-5.5`, etc.

**2. Where I came from (provenance)**
- `spawnedBy` — the parent agent's handle. These links form a chain: any agent walks back up to the
  human at the root, and any orchestrator can list its children. This is what makes "which agent
  from where" answerable by construction instead of by guessing at names.
- `sessionId` — the CCD session id or conversation id.
- `campaign` — the campaign it serves.
- `cwd` — which checkout/worktree it runs in (matters in a shared tree).
- `startedAt` — registration time.

**3. How to reach me** (derived from `type`)
- `claude-session` → `send_message(sessionId)`.
- `claude-subagent` → `SendMessage(agentId)`.
- `codex`/`gemini` → its background process / log path.

Retrace and the master use this to **contact the source** rather than hitting a dead end.

### Worked example — the master session, self-described

```
handle:     master.desktop
type:       claude-session
role:       master
model:      opus-4.8
spawnedBy:  remy (root)
sessionId:  local_1aa4a366-c689-4296-8211-055c54394b24
cwd:        F:/Repos/Aralia
```

## Handle grammar (structured, validated)

Names encode provenance: `<role>.<domain>[/<child>]`.

- `master.desktop`, `orch.planmap`, `orch.planmap/glossary`, `worker.combat-view`.
- Validated at registration; opaque auto-names (`agent-16d417`) are **rejected**.
- The name alone tells you role + domain + parent, before you even query the record.

## Who stamps it — hybrid

- **Spawner stamps provenance.** Whoever launches an agent sets its `type`, `role`, `model`,
  `spawnedBy`, and `campaign`. This extends the existing orchestrator rule ("you own identity
  allocation for the fleet; a worker never invents its own name, you hand it one") from just the
  handle to the full descriptor. `orchestrate dispatch` and the Agent-tool prompt already bake
  `AGORA_AGENT_ID` + `--model`; they gain `--type` / `--role` / `--spawned-by` / `--campaign`.
- **Root agents self-declare.** A chat a human opens directly has no spawner, so it self-declares
  its identity on first Agora touch. (Honest limit: identity is honor-system like locks — the token
  authenticates, the descriptor is trusted, not cryptographically proven.)

## Daemon change (additive)

The agent record already carries `handle`, `model`, `sessionId`, `note`, `registeredAt`,
`lastSeen`, `status`. Add: `type`, `role`, `spawnedBy`, `campaign`, `cwd`. Plus handle validation
and three read-only views:

- `whois <handle>` — the full identity record.
- `lineage <handle>` — walk `spawnedBy` up to the root.
- `tree` — the whole fleet as a spawn tree, grouped by campaign.

`whoami` is extended to echo the full descriptor. No new persistent entity — this is fields on the
existing agent record (`store.mjs` agent shape, and `register` in `client.mjs`).

## Testing

Follow the existing `tools/agora/*.test.mjs` pattern:
- Handle validation: reject opaque names, require `role.domain[/child]`.
- Lineage: a 3-deep spawn chain walks to the root.
- Tree: agents group under their campaign and parent.

## Out of scope

Cross-machine identity, cryptographic anti-spoofing (identity stays honor-system, guarded only by
the existing bearer token), and any UI beyond the CLI views.

## Build order

1. Add the identity fields + handle validation to the agent record and `register`.
2. `whois` / `lineage` / `tree` views + extend `whoami`.
3. Spawner stamping in `orchestrate dispatch` and the Agent-tool prompt; root self-declare path.
