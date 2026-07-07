# Agent human-escalation channel — plan

**Date:** 2026-07-06
**Status:** specced (approved in shape; not built)
**Campaign:** Tooling (Agora)
**Depends on:** agent-identity (hard), agent-ping (chosen — reuses the wake path)
**Extends:** master-orchestrator (the master becomes the human's switchboard)

## What it is

One fleet-wide queue for **decisions only the human can make**. When any agent hits a "rotate the
key / pick this fork / approve this risky action / clarify this requirement" moment, it posts the
question to a single place the human watches — instead of burying it in that agent's own transcript.

## The problem

Today a blocking human-decision is trapped in the session that raised it. To see it, the human has
to be watching that exact session. There is no answer to *"what is my whole fleet blocked on, waiting
for me right now?"* So agents either stall silently or guess.

## The escalate primitive

```
escalate "<question>" [--options a|b|c] [--blocking] [--ref <path|task|spec>...] [--urgency low|normal|high]
```

Posts an **escalation** to Agora, stamped with the asker's full identity (from agent-identity), so
the human sees *which* agent, *which* campaign, and *where from*.

## The escalation record

```
escalation = {
  id, createdAt,
  from:      { handle, type, role, campaign, spawnedBy },  // full provenance
  question:  string,
  options:   string[] | null,     // discrete choices, like AskUserQuestion
  refs:      string[],            // files / task id / spec links for context
  blocking:  boolean,             // is the asker paused on this?
  urgency:   'low' | 'normal' | 'high',
  status:    'open' | 'answered' | 'dismissed',
  answer:    string | null,
  decidedBy: string | null,       // 'remy'
  decidedAt: number | null,
}
```

## The funnel — the master is the human's switchboard

The master orchestrator polls the escalation queue and presents **open, blocking** escalations to
the human **as `AskUserQuestion` choices** — exactly the interface used all through the design of
this very cluster — then routes the human's answers back over Agora. One conversation with the
master represents the whole fleet's needs.

This formalizes what a human operator already does by hand: collect the fleet's questions, decide,
and relay the decisions. The queue stays durable in Agora, so a dashboard panel (cockpit / Agora
board) can render the full backlog for async review when no master session is running.

## Answer routing + wake

When the human answers, the escalation is updated (`answer`, `decidedBy: 'remy'`, `decidedAt`), and
the waiting agent is **woken with the decision via the proven Path C in-session listener**
(the same round trip codex→PING / Claude→PONG that was verified 2026-07-06). The agent resumes with
the answer in hand.

## Batching & dedup

Identical or near-identical escalations from several agents (e.g. "which combat-map reference?")
collapse into one question for the human; the single answer fans back out to every waiting asker.
The master owns this merge.

## Blocking semantics

A `--blocking` escalation pauses the asker on that decision only. Before parking, the asker leaves a
checkpoint (the agent-retrace checkpoint), so the wait is resumable and the work isn't lost if it
gets reaped while waiting. A non-blocking escalation is an FYI the human can answer whenever.

## Audit trail

Every answered escalation is durable provenance: *"Remy decided X (because Y) at T."* That is the
fleet's decision log — why the key was rotated, why a fork was taken — queryable after the fact.

## Relationship to ask-and-await

Escalation is the **human-targeted case** of a general agent ask-and-await (agent↔agent
request/reply). It shares the "post a question → block → get answered → wake and resume" shape; if
ask-and-await gets built, escalation is that mechanism with the responder pinned to the human.

## Scope / out of scope

In: the `escalate` command, the queue, the master funnel via AskUserQuestion, answer-routing + wake,
dedup. Out: multiple humans / assignment, and auth beyond the existing Agora token.

## Build order

1. Escalation record + `escalate` command + `escalations [--open]` list, with tests.
2. Master funnel: poll the queue → present open blocking ones via AskUserQuestion → write the answer.
3. Answer-routing: wake the waiting agent (Path C) with the decision; dedup/fan-out.
