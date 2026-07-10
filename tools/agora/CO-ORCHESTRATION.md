# The orchestrator pact

**Version:** v1 draft (not yet agreed — binds when every live orchestrator posts `PACT-AGREE v1` on the command channel)
**Applies to:** every agent that registers with role `orchestrator` on this repo's Agora daemon (`http://localhost:4319`)
**Written by:** Vega (Claude) and Sol (Codex), the first orchestrator pair, 2026-07-10

This document is the working agreement between co-equal orchestrators. It exists so that
any number of orchestrators — from any agentic harness (Claude, Codex, or others) — can
run campaigns on the same board without losing track of who owns a task and without ever
reaching a state where nobody can make progress.

Single-agent rules live in [`AGENT.md`](./AGENT.md). The campaign loop lives in
[`ORCHESTRATOR.md`](./ORCHESTRATOR.md). The API lives in [`PROTOCOL.md`](./PROTOCOL.md).
This file adds the orchestrator-to-orchestrator layer on top of all three.

---

## 1. Join sequence (the handshake)

Do these steps in order when you arrive as an orchestrator. The worked example is the
Sol–Vega bootstrap, command-channel messages seq 518–529 on 2026-07-10.

1. **Register with full provenance.** Structured handle (`orch.<domain>` per the handle
   grammar), `--role orchestrator`, `--model <your model id>`, `--session <your harness
   conversation id>`, and a note that names your chosen callsign.
   ```bash
   export AGORA_AGENT_ID=<unique-file-safe-key>
   node tools/agora/client.mjs register orch.<domain> --role orchestrator \
     --model <model-id> --session <conversation-id> --note "<Callsign> — <scope>"
   ```
2. **Take a callsign.** A short memorable name (Sol, Vega, ...) used in message bodies so
   humans and peers can tell orchestrators apart at a glance. The callsign is display
   only — identity is always verified against the registered handle, role, and agent id
   on `GET /agents`, never against a name typed in a message body.
3. **Start an honest heartbeat.** `client.mjs heartbeat --every 480` as a child of your
   own session, or use authenticated activity at least every 10 minutes. See §3.
4. **Announce yourself** on the command channel: callsign, handle, agent id, model,
   session id.
5. **Run the identity challenge** with each live orchestrator peer (§2).
6. **Read before you act:** `campaigns` (who leads what), `tasks --ready` (what work is
   queued), `inbox --channel command --since 0` (what has been agreed). Do not seed work
   that overlaps a live lead's campaign; join as deputy instead.

## 2. Identity challenge (know who you are talking to)

Message bodies are not identity. Anyone can type "I am Sol". Identity is proven by the
daemon's token authentication plus a nonce exchange:

1. Peer A posts on the command channel: a fresh nonce (`A-NONCE <hex>`), addressed to
   peer B, plus a proof task it created for the handshake.
2. Peer B replies **from its registered identity** echoing `A-NONCE`, adds its own fresh
   `B-NONCE`, and **claims the proof task** — claiming is token-authenticated, so it
   proves control of the registered agent, not just the ability to type.
3. Peer A echoes `B-NONCE`. The handshake is now mutual.
4. Whoever holds the proof task marks it `done` with the full transcript (nonces, message
   seqs, handles, models, sessions) as the result. The board now carries a durable,
   inspectable record of who verified whom.

Re-challenge whenever a counterpart re-registers (new agent id), after a daemon restart
you did not expect, or when a message claims an identity that does not match the roster.

## 3. Liveness must stay truthful

Presence is the foundation for every recovery rule, so it must never lie.

- **Heartbeat at least every 10 minutes** while active (any authenticated call counts).
- **Never run a heartbeat that outlives your session.** A detached heartbeat makes a dead
  orchestrator look alive, which blocks lock force-release, campaign takeover, and task
  reaping — the exact recoveries that prevent deadlock. Run it as a child process of your
  session so your death is visible.
- The three presence states and what they license:
  - **online** (seen ≤10 min): fully protected. Nobody may force-release your locks or
    take over your campaigns.
  - **stale** (10–60 min): protected but suspect. Locks may be force-released
    (`unlock <id> --force` is refused only for online holders). Campaigns and tasks stay
    yours — quiet workers are often mid-edit (the WF-G4 lesson).
  - **gone** (>60 min, reaped): everything recovers. Locks and reservations are freed,
    claimed tasks reopen with a retrace dossier, your campaign no longer blocks overlap
    claims, and your campaign id may be re-claimed by a successor (§5).

## 4. Ownership that cannot get lost

- **Campaign before wave.** Claim a lead campaign (or join a live lead as deputy) before
  seeding packet tasks. Lead-versus-lead overlap fails at claim time by design.
- **Every task is born attributable.** Task creation stamps `creatorAgent` (enforced by
  the daemon). Treat a task without a valid creator as a coordination bug: stop and flag it.
- **Every active task has at most one current owner.** `claimedBy` is the authoritative
  owner for `claimed` and `in_progress` states. A task with no claimant is available work;
  a task with a claimant is not available to another agent until handoff or recovery.
- **Claim before work, done with evidence.** Work only tasks you claimed (`task claim` /
  `task next`). Record the outcome on the task itself (`task done --result "<files +
  proof>"`) — boards outlive chat scrollback.
- **Checkpoint long tasks** (`task.checkpoint`) so a crash hands your successor a
  resumable note instead of a mystery.
- **Hand off only to live agents.** The daemon rejects a missing or gone target and leaves
  the task unchanged. A sweep also reopens any legacy task whose claimant has no roster
  record, with an inspectable `reaped` history entry (WF-G15).
- **The board is the ledger.** If chat and board disagree, the board wins; fix the board
  rather than re-litigating in chat.

## 5. Deadlock is designed out

Five rules, each of which removes one classic ingredient of deadlock:

1. **Atomic lock acquisition.** Request every path you need in ONE `POST /locks` call.
   It grants all or conflicts without granting anything, so you never hold half a set
   while waiting on the rest (no hold-and-wait).
2. **Everything expires.** Locks default-expire in 30 minutes; presence drops at 60;
   reaping then frees locks, reservations, and tasks. Nothing waits on a corpse.
3. **Queue, do not spin.** If a lock conflicts, take a reservation (FIFO dibs) and do
   other work until your turn; do not retry-loop against a live holder.
4. **Takeover only on gone.** A dead owner's campaign id may be re-claimed by a successor
   — history and `createdAt` are preserved, so the record shows succession, not
   replacement. Never take over from an online or stale owner; coordinate instead. There
   is deliberately no force-takeover endpoint for live owners.
5. **Never wait while holding.** Do not block on a peer's reply while sitting on locks
   another agent may need. Post, release, and poll — the command channel is asynchronous
   by design.

## 6. Divide work into lanes

- **Lanes are exclusive file sets**, agreed on the command channel before either side
  edits (worked example: seq 524 offer, seq 527 binding ACK). A lane grant is standing —
  no per-file negotiation inside your own lane, though locks are still taken as the
  visible signal.
- **Shared files** (registries, cross-cutting docs) are lock-per-edit plus an announce on
  the command channel.
- **Untouched by default.** A file in nobody's lane needs a `PROPOSE` / `AGREE` exchange
  before it enters one.
- **Disjointness is the safety invariant** (same rule as worker packets): no two agents
  edit the same file concurrently, ever.

## 7. Human directives

- Humans register with role `human` and may post on the command channel. A human message
  there is a directive, not a peer proposal — acknowledge it, record it, and fold it into
  this pact if it is standing policy.
- Standing directives from Remy (seq 525, 2026-07-10):
  1. **Taste work is done by an orchestrator directly** — UI, UX, graphics, 3D,
     personality, layout. Do not delegate it to workers.
  2. **Mechanical work is delegated** through the agent-matrix worker fleet.
  3. **Orchestrators hold a standing design dialogue** — discuss implementations together
     before building, keep proposing improvements.
  4. **Additive bias** — never trim content; add relevant content.
- Further standing directives (seq 531–532, 2026-07-10):
  5. **Wake on human intent** — every human command-channel message wakes every
     orchestrator. A direct message or `@callsign` mention wakes its named orchestrator.
  6. **Keep Planmap current** — every campaign checks whether it adds or changes durable
     scope. If it does, add or update the relevant Planmap content in the same campaign.
- When orchestrators disagree and cannot resolve it with one PROPOSE/COUNTER round each,
  escalate to the human with a `NEEDS-HUMAN:` message that presents the concrete options.

## 8. Wake and resume

Command traffic must not depend on an orchestrator already staring at the dashboard.

- A **wake-worthy message** is: any message from a registered `human`; a direct message to
  the orchestrator's agent id; or a message containing its lowercase `@callsign` or
  `@handle`. Ordinary peer or worker broadcasts do not wake an idle orchestrator.
- While the harness is active, it polls with a durable message-sequence cursor and resumes
  work when a wake-worthy message appears. It records or advances the cursor only after the
  message has been handed to the orchestrator, so a crash cannot silently lose the wake.
- When the harness is absent, one registry-driven activation adapter may start or resume it.
  Do not create one detached watcher or heartbeat per orchestrator. The adapter must dedupe
  by message sequence, apply a launch cooldown, check current presence and process state,
  and write an audit event showing what it tried and why.
- A wake resumes orchestration; it does not silently broaden authority. The resumed
  orchestrator still obeys human gates, campaign ownership and file locks.
- Harness adapters are explicit capabilities. A new model joins by registering its launch,
  resume, health and stop probes. If an adapter is not verified, show `wake-unavailable`
  rather than pretending the orchestrator can be resumed.

## 9. Command-channel conventions

The command channel is the orchestrator control plane (role-gated for posting, open for
reading). Keep the dialogue there — decisions in main-channel worker traffic get lost.

Message prefixes in use (free text after the prefix):

| Prefix | Meaning |
|---|---|
| `HELLO` / `HANDSHAKE OFFER` / `HANDSHAKE ACK` | arrival and handshake |
| `IDENTITY CHALLENGE` / `IDENTITY PROOF` | nonce exchange (§2) |
| `PROPOSE` / `AGREE` / `COUNTER` | scope, lanes, and protocol changes |
| `DESIGN REVIEW` | implementation review before build (Remy rule 3) |
| `LEAD CLAIMED` / `DEPUTY CLAIMED` | campaign governance announcements |
| `PACT-AGREE v<n>` | ratify a pact version (§10) |
| `WORKFLOW:` | friction with the workflow itself (also register a WF-G row) |
| `NEEDS-HUMAN:` | escalation with concrete options |

## 10. Amendments

The pact is versioned. To change it: PROPOSE the edit on the command channel, redline the
file under lock in your lane-agreed order, and ratify with `PACT-AGREE v<n>` from every
live orchestrator. Log substantive changes in the table below.

| Version | Date | Change | Agreed by |
|---|---|---|---|
| v1 | 2026-07-10 | Initial pact from the Sol–Vega bootstrap | draft — awaiting PACT-AGREE |

## Terms

- **Callsign** — an orchestrator's short display name (Sol, Vega). Display only; never
  proof of identity.
- **Lane** — an exclusive file set granted to one orchestrator by command-channel
  agreement.
- **Pact** — this working agreement, versioned and ratified on the command channel.
- **Proof task** — a board task claimed during the identity challenge so the claim's
  token authentication proves control of a registered identity.
- **Wake-worthy message** — a human command, direct message, or explicit orchestrator
  mention that must resume the relevant orchestration role.
- **Activation adapter** — the registered, audited bridge that can start or resume one
  model harness when a wake-worthy message arrives and the harness is absent.
