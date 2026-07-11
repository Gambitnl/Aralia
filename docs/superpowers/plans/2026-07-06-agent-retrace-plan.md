# Agent retrace — plan

**Date:** 2026-07-06
**Status:** store core landed and green in `store.mjs` (preserve-on-reap dossier, reapCount, checkpointTask — feed seq 376, 125/125); the client/server wiring (retrace cmd, checkpoint endpoint/cmd, successor flag) is still missing — announced seq 377 but never landed (verified 2026-07-10: zero hits in client.mjs/server.mjs)
**Campaign:** Tooling (Agora)
**Depends on:** agent-identity (hard)

## What it is

A way to recover a dead worker's **work**, not just reopen its task. When an agent goes silent and
gets reaped, its half-done edits are still sitting in the shared working tree — but nobody records
what they were, who made them, or how far the agent got. The successor who claims the reopened task
starts blind. Retrace preserves that trail and replays it.

## The gap, precisely

Confirmed in `sweepExpired` (`tools/agora/store.mjs:945–979`). When an agent is reaped:

**Survives:**
- The task, with a bare `{ action: "reaped", state: "open" }` history stamp (a timestamp + the dead
  agent's id).
- The message log — its `say` breadcrumbs persist.

**Thrown away at that moment:**
- **Which files it held** — its locks are released (deleted), so the one signal for *where it was
  working* is gone.
- **Its identity** — the agent record (handle, note, model) is deleted, so even the id on the
  breadcrumbs no longer resolves to a name.

So the fix has to **capture the trail at the moment of death**, before those two things vanish.

## The retrace record (stamped on the task at reap)

```
task.retrace = {
  reapedAt, lastSeenAt,
  agent:      { handle, type, role, model, spawnedBy, sessionId },  // the full identity (from agent-identity)
  filesHeld:  [ { paths, globs, reason, lockedAt } ],               // rescued before the locks free
  sayTail:    [ { at, body } ],   // this agent's messages since it claimed the task
  checkpoint: { at, did, next, files } | null                       // its last self-reported state
}
task.reapCount += 1
```

Two choices baked in:
- **Lives on the task, not a new entity.** It survives in the store journal and travels with the
  reopened task — the successor inherits the dossier automatically.
- **`reapCount` is a signal.** A task that has killed 3 workers is probably too big or cursed, so
  `reapCount ≥ N` feeds the master orchestrator's `conflicts` view and gets escalated instead of
  silently re-fed to the next victim.

## The checkpoint (live resumable note)

A structured command, latest-wins:

```
task checkpoint <id> --did "..." --next "..." [--files a,b]   →   overwrites task.checkpoint
```

Doctrine cadence: checkpoint at sub-step boundaries or before a risky op — **not** on a timer. It is
optional; retrace degrades gracefully to files + say-tail + diff when there is no checkpoint.

## The retrace command

```
retrace <taskId>
```

Read-only, no server change. Prints the dossier (identity, files, checkpoint, say-tail) **and** runs
`git diff -- <filesHeld>` so you *see* the partial work in the tree, not just a description. Scoping
the diff to the dead agent's files isolates its blast radius from everyone else's edits — the payoff
of disjoint-file locking. (Fidelity choice: a live diff, not a frozen snapshot; the successor
usually claims fast enough that another agent editing those same files first is rare.)

## The successor protocol (doctrine)

When a worker claims a task that carries a `retrace`, the client flags it:
*"⚠ reaped from `<handle>` — run `retrace <id>` first."* The rule:

> read the dossier + the partial diff → decide keep / extend / revert → post
> `say "resuming <task> from <handle>: keeping X, redoing Y"` → continue.

Never blind-restart. The partial edits are already in the tree; the job is to understand them.

## Preserve-on-reap (the one server change)

In `sweepExpired`, **before** freeing the locks and dropping the agent, build the `retrace` record
from the still-present lock and agent data and attach it to each reopened task. This mirrors the
`{ action: "reaped" }` history entry the reaper already writes — just richer.

## Scope

Core is the **reap** path (automatic). Cheap extension: a voluntary `task handoff` or a task going
`blocked` captures the same trail, so a clean handoff also carries a checkpoint.

## Testing

Follow the existing `tools/agora/*.test.mjs` pattern:
- Reap → the reopened task carries a `retrace` with identity, `filesHeld`, and `sayTail`.
- `reapCount` increments across repeated reaps.
- `task checkpoint` overwrites latest-wins.
- `retrace <id>` output includes the identity block and the held-file diff.

## Build order

1. Preserve-on-reap in `sweepExpired` + the `retrace` record shape + `reapCount` + tests.
2. `task checkpoint` command + field.
3. `retrace <taskId>` command (dossier + git diff) + the successor-flag on claim.
