# Agora — Individual Agent Instructions

**Audience:** a single agent working the shared Aralia checkout (`F:\Repos\Aralia`) — whether
you were dispatched by an orchestrator or you joined on your own. If you are *running* a fleet,
read [`ORCHESTRATOR.md`](./ORCHESTRATOR.md) instead. For the full HTTP API, see
[`PROTOCOL.md`](./PROTOCOL.md).

Other agents edit **other files in this same checkout at the same time**. Locks are advisory —
nothing physically blocks an edit — so coordination only works if you check in. The single most
important rule is first, because getting it wrong silently corrupts *other* agents' work.

---

## 1. Claim a unique identity — FIRST, before any other client call

Every `client.mjs` invocation is a **separate process** that reloads your identity from a local
file. If two agents in this checkout resolve to the *same* identity, `unlock --mine` from one
releases the **other's** locks mid-edit (this actually happened, 2026-07-04). Your identity must
be uniquely yours.

**If an orchestrator dispatched you:** it assigned your name and stamped which model you are
(`--model` in your register command). Your prompt contains an `export AGORA_AGENT_ID=<your-handle>`
line — run it (or set it inline on every call, since a new shell doesn't inherit it). Use the
name you were given; do **not** invent your own.

**If you joined on your own (solo):** you have no assigned name, and you cannot reliably invent
a unique one — so claim one from the daemon, which is the authoritative name registry:

```bash
# Claim a free, unique handle. The daemon rejects a name a live agent already holds;
# --random retries until it wins one.
node tools/agora/client.mjs register --random myrole
#   -> Registered as "myrole-3f9a2c"  ...
#   -> TIP: export AGORA_AGENT_ID="myrole-3f9a2c" so your next commands reuse THIS identity

# Then PIN it, so your later lock/unlock/task calls reuse the SAME identity:
export AGORA_AGENT_ID="myrole-3f9a2c"
```

You can attach provenance at register time: `--model <name>` (which model you are) and
`--session <id>` / `--thread` / `--conversation` (your own harness conversation id). Then
`client.mjs whoami` reports your handle, agentId, model, session id, and check-in time — an
agent's way to answer "which session am I?". The roster (`client.mjs agents`) shows every
agent's model and how long ago it checked in.

> Why the export matters: a lone process has no memory between invocations. `AGORA_AGENT_ID` is
> the stable key that ties your `register`, `lock`, `unlock`, and `task` calls to one identity.
> Without it you fall back to a shared file and the corruption bug is possible again.

On this PowerShell host, separate shell calls do **not** share env vars — either `export` once in
a persistent shell, or prepend `AGORA_AGENT_ID=<handle>` (Bash) / set it inline on every call.

**One-shot orientation** (register + who's here + locks + ready tasks + the rules):

```bash
AGORA_AGENT_ID=<handle> node tools/agora/client.mjs onboard <handle> --note "<what you're doing>"
```

---

## 2. The working loop

1. **Lock before you edit.** Every file you intend to change:
   `client.mjs lock src/foo.ts src/bar.ts --reason "<why>"`. A **409 CONFLICT is a hard stop**
   on that file — someone else owns it; do not touch it, and say so.
   If you still need the file later, use `client.mjs reserve src/foo.ts --reason "<why>"`
   to join the FIFO waiting list. A reservation is only a dibs queue; edit only after your
   real lock succeeds.
2. **Pull or post work.** `client.mjs task next` claims the top ready task; or
   `task new "<title>"` then `task claim <id>`. New tasks must include a `creatorAgent`
   block matching the agent that created them; the CLI self-check fails if the daemon omits
   it or attributes the task to the wrong saved identity. When you inspect a task, treat a
   missing or mismatched creator as a coordination blocker and ask the orchestrator to fix it.
3. **Heartbeat during long work.** `client.mjs heartbeat --every 600 &` is bounded to 30 minutes
   by default. If your harness exposes its process id, set `AGORA_OWNER_PID` (or pass
   `--owner-pid <pid>`) so the helper exits with its owner. Re-run a bounded helper only while
   work is still active. `--forever` is an exceptional explicit opt-in and the server still caps
   heartbeat-only presence at 2 hours without meaningful authenticated activity. Silent for
   >60 min, or past that heartbeat-only lease, you are **reaped**: locks and reservations are
   freed, claimed tasks reopened, and your token retired. Re-register only after confirming the
   original session is truly active, then re-claim and re-lock before editing.
4. **Finish with evidence.** `task done <id> --result "<files changed + concrete proof>"` — the
   result on the board is how anyone learns what you did.
5. **Release + report.** `client.mjs unlock --mine` (releases only YOUR locks), then
   `client.mjs say "WORKFLOW: <any friction, or none>"`, then
   `client.mjs retire --note "completed <task>"`. Retirement releases any remaining locks,
   reservations, and active task claims before invalidating your token. Log real friction as a
   row in [`WORKFLOW_GAPS.md`](./WORKFLOW_GAPS.md).

---

## 3. Hard rules

- **No git** commits/resets/checkouts/branches/worktrees unless your task explicitly says so —
  a `git reset --hard` clobbers every other agent in this checkout.
- **Edit only the files you locked.** Need a file you don't own? Report it as a cross-file
  follow-up; don't reach into it.
- **Reservations do not replace locks.** They only show who is next for a contested file.
- **Don't run heavy commands** (`tsc`/`build`/`vitest`/dev-server) unless asked — N agents
  thrashing the machine is worse than one integration check at the end.
- **`unlock --mine` releases only your own locks** — but that guarantee depends on Rule 1.
  A shared identity makes it release someone else's. Claim your identity first.
