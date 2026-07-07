# Agent ping / wake — plan

**Date:** 2026-07-06
**Status:** specced (approved in shape; not built)
**Campaign:** Tooling (Agora)
**Depends on:** agent-identity (hard)
**Extends:** master-orchestrator (its `nudge` becomes `ping`)

## What it is

A way to **poke an agent awake** across runtimes — not just leave it a message, but cause its
process to actually start and read that message. Keyed on the agent's identity, so the daemon knows
*how* to wake each kind of agent.

## Ping is two problems; only one is hard

- **Delivery** — leaving a message the agent will read. Already solved twice: Agora's message bus
  (`POST /messages`) and the CCD session message. Done.
- **Wake** — making an idle or exited process start and read it. Runtime-specific, and the hard part.

## Verified machine facts (2026-07-06, this host)

- The Claude **desktop app** (`WindowsApps\Claude…\Claude.exe`) holds **no listening TCP port**;
  only `node` services do (Agora 4319, cockpit 3040, Vite dev servers).
- MCP servers here communicate over **named pipes**, not the network
  (`\\.\pipe\mcp-<uuid>.sock`, `\\.\pipe\claude-mcp-browser-bridge-Gambit`).
- **`ccd_session_mgmt` is a built-in of the Claude host, not a user-configured MCP server**
  (absent from `~/.claude.json`) — so it has no external endpoint and only accepts calls from
  inside the Claude host that spawned it.
- **Proven:** `send_message` woke idle desktop threads this session — their activity advanced right
  after the message, i.e. they took a turn.
- Session **and subagent** transcripts are durable on disk at
  `~/.claude/projects/<proj>/<sessionId>.jsonl` (subagents under `/subagents/agent-<id>.jsonl`).

**Verdict:** an external process (codex) **cannot** directly ping a Claude desktop thread — there is
no socket to hit. The wake exists but is reachable **only from inside a Claude host**.

## Wake, per runtime

- **Claude desktop thread (CCD session):** wakeable today, but only from inside a Claude host via
  `send_message(sessionId)`.
- **codex / claude CLI (headless):** no persistent idle process exists. "Wake" = **relaunch** with
  the pending Agora inbox as context — which is how the fleet already dispatches codex.
- **A live agent holding Agora SSE (`/events`):** push instantly.
- **A live agent polling Agora:** sees it on the next poll.

## Design — `ping <handle>` on Agora, keyed on identity

`ping` looks up the target's `type` + contact (from agent-identity) and actuates the right wake:

- `claude-session` → route to a Claude relay (below) that calls `send_message`.
- `codex` / `claude-cli` (headless, exited) → relaunch with the pending inbox.
- live agent → SSE push.

Agora is the **broker/queue** everyone (including codex) can reach on `:4319`. But the **actuator**
for a desktop-thread wake must run inside a Claude host.

## PROVEN 2026-07-06 — Path C: the in-session listener

A live Claude desktop session can arm a **persistent monitor inside itself** that polls the Agora
inbox (~15 s cursor poll on `inbox --since <seq>`). Each new message becomes a chat wake event and
the session takes a turn — no relay, no CLI resume, no new infrastructure.

**Round trip verified this session:** codex (`codex-gpt5-20260706`) sent a PING over Agora
(seq 301); the armed Claude session (`claude-collab-20260706`) woke, took a turn, and replied PONG
(seq 302) with no human in the loop.

Limits: Path C only wakes sessions that armed a listener while alive. A fully exited or never-armed
session still needs Path A or B below. An armed session can also act as the Path-A relay for free —
it already holds the CCD `send_message` tool and is already listening.

## The cross-tool bridge — two candidate paths (for sessions without a listener)

**Path A — a Claude relay agent (reliable).** A persistent Claude Code session registered in Agora
as `relay.switchboard`, holding the CCD tools. It polls Agora for `ping` requests and, for a
desktop-thread target, calls `send_message`. Codex → Agora `ping` → relay → desktop thread wakes.
Cost: one always-on Claude host dedicated to relaying.

**Path B — CLI resume (no relay, unverified).** An external process shells out to
`claude --resume <uuid> -p "<message>"` to headlessly continue the session (CCD `local_<uuid>` maps
to the on-disk `<uuid>.jsonl`). If it works, codex wakes a thread with no Claude relay at all.
**Risks to validate:** it may spawn a detached CLI turn that the live desktop UI does not reflect,
and it could double-drive a session the app still owns. Must be tested on a throwaway session before
trusting it.

**Recommendation:** validate Path B first (it's far cheaper if it holds); fall back to Path A, which
is guaranteed to work because it uses the exact primitive already proven this session.

## Open question (the one to resolve next)

Does `claude --resume <uuid> -p` cleanly wake/continue a desktop-owned session without conflicting
with the app? A 5-minute test on a throwaway session answers it and picks A vs B.

## Scope / out of scope

In: the `ping` command, per-type actuation, and whichever bridge wins. Out: waking agents on other
machines, and any push to a truly-exited process that left no relaunch recipe.

## Build order

1. Resolve the open question (test Path B on a throwaway session).
2. `ping <handle>` on Agora: look up identity, actuate SSE-push + headless-relaunch cases.
3. The desktop-thread case via the chosen bridge (relay agent, or CLI-resume).
