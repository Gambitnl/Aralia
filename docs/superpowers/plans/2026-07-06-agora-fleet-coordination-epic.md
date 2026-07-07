# Agora fleet coordination — epic

**Date:** 2026-07-06
**Status:** specced (the program; sub-plans approved in shape, not built)
**Campaign:** Tooling (Agora)

## North star

Turn Agora's flat pool of peer agents into a **legible, recoverable, wake-able, human-steerable
fleet** — without abandoning the peer-to-peer campaign/task model that already works. Every piece is
a small, additive change to the daemon; together they let a human (or a master session) run a
20-agent fleet across one shared checkout and always know *who is doing what, where from, and what
they're blocked on.*

## The pieces

**Specced this session (five):**
- **[agent-identity](2026-07-06-agent-identity-provenance-plan.md)** — who each agent is:
  type/role/model/spawnedBy/campaign, structured handles, `whois`/`lineage`/`tree`. *The foundation.*
- **[agent-retrace](2026-07-06-agent-retrace-plan.md)** — recover a dead worker's work: preserve-on-reap
  dossier + `retrace <id>` shows the partial git diff.
- **[agent-ping](2026-07-06-agent-ping-wake-plan.md)** — wake an agent across runtimes. **Path C (the
  in-session listener) proven 2026-07-06** (codex→PING, Claude→PONG, no human).
- **[agent-escalation](2026-07-06-agent-human-escalation-plan.md)** — route an agent's human-only
  decisions to one queue the master funnels to the human via AskUserQuestion.
- **[master-orchestrator](2026-07-06-master-orchestrator-plan.md)** — drive the fleet, adopt dead
  orchestrators' campaigns, and be the human's switchboard. *The capstone.*

**Frontier (not yet specced):**
- **ask-and-await** — agent↔agent request/reply; the substrate escalation is a special case of.
- **stall-detection** — tell a wedged-but-alive agent from a healthy or crashed one (progress vs presence).
- **clean-exit / retire** — voluntary "I'm done" that clears the roster and marks a clean departure.
- **attribution** — trace a change in the shared tree back to the agent + task that made it.

## Dependency graph

```
agent-identity  (foundation)
   ├── agent-retrace
   ├── agent-ping              (Path C proven)
   ├── clean-exit / retire     (lifecycle, part of identity)
   ├── ask-and-await ── agent-escalation
   ├── stall-detection         (needs retrace checkpoints + ping)
   ├── attribution
   └── master-orchestrator     (consumes all of the above)
```

## Build order (dependency-respecting, each wave usable on its own)

**Wave 1 — Foundation.** `agent-identity` + `clean-exit/retire` (they're one lifecycle).
*Delivers:* a legible fleet — `whois`/`lineage`/`tree`, structured handles, and a clean way to leave.

**Wave 2 — Recovery & reach.** `agent-retrace` ∥ `agent-ping` (parallel: retrace touches the
reap/task path, ping touches messaging/wake — disjoint files).
*Delivers:* dead agents' work is recoverable, and any agent is wake-able (Path C formalized as `ping`).

**Wave 3 — Coordination.** `ask-and-await` → `agent-escalation` (escalation is ask/await pinned to
the human).
*Delivers:* agents can ask each other and block for a reply; humans get one decision inbox.

**Wave 4 — Oversight (capstone).** `stall-detection`, `attribution`, `master-orchestrator`.
*Delivers:* stalls are caught, edits are attributable, and one master drives the whole fleet and
funnels its questions to the human.

## What's already proven

Path C (the in-session Agora listener) works end to end — a live Claude session polls the inbox and
takes a turn on each new message. Wave 2's ping and Wave 3's answer-routing both ride it, so the
riskiest wake question is already de-risked.

## Open decisions (resolve at each wave, not now)

1. **Retire semantics** (Wave 1) — clean-exit marker + optional final checkpoint, or minimal drop.
2. **Ping desktop bridge** (Wave 2) — validate `claude --resume` (Path B) vs a Claude relay (Path A);
   Path C already covers armed sessions.
3. **ask-and-await vs escalation ordering** (Wave 3) — build the general RPC first, escalation as its
   human-pinned case.

## Testing & rollout

Each piece is TDD'd against the existing `tools/agora/*.test.mjs` pattern, and each daemon change is
additive (no rewrite of the campaign/task/lock model). Waves ship independently — the fleet keeps
running on the old behavior between waves.
