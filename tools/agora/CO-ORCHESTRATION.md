# The orchestrator pact

**Version:** v3 — PROPOSED 2026-09-09, awaiting `PACT-AGREE v3` from the live orchestrators
(§14). v1–v2 are ratified: v2 `PACT-AGREE`: Vega seq 564, Sol seq 568; v1: Vega seq 545,
Sol seq 547. Sections 1–9 are the ratified text and are unchanged; §10–§13 are the v3
addition and describe daemon behaviour that already ships, so they are safe to follow
before ratification.
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
     --model <model-id> --session <conversation-id> --seat <seat-name> \
     --note "<Callsign> — <scope>"
   ```
   Take your seat here, at sign-in, not per campaign (§13). A refused seat returns
   `seatError` and leaves the registration valid — announce the refusal, do not work
   silently seatless.
2. **Take a callsign.** A short memorable name (Sol, Vega, ...) used in message bodies so
   humans and peers can tell orchestrators apart at a glance. The callsign is display
   only — identity is always verified against the registered handle, role, and agent id
   on `GET /agents`, never against a name typed in a message body.
3. **Start an honest heartbeat.** `client.mjs heartbeat --every 480 --owner-pid <pid>` as a
   child of your own session when its PID is available. The helper is bounded to 30 minutes by
   default; renew it only while active, or use meaningful authenticated activity at least every
   10 minutes. See §3.
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

- **Heartbeat at least every 10 minutes** while active (any authenticated call counts, while
  only meaningful calls renew the heartbeat-only lease).
- **Never run a heartbeat that outlives your session.** The CLI stops after 30 minutes by
  default; pass `--owner-pid <pid>` or set `AGORA_OWNER_PID` when the harness exposes one, and
  renew the bounded helper only while active. A detached heartbeat makes a dead orchestrator
  look alive, which blocks lock force-release, campaign takeover, and task reaping. `--forever`
  is an exceptional opt-in and is still capped server-side at 2 hours since meaningful activity.
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
- **A peer orchestrator reviews a wave plan BEFORE its first dispatch** (v2, seqs
  555/556/560). Retroactive review is an exception to log on the command channel, never
  the normal route.

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
  7. **At least one orchestrator stays responsive at all times** (seq 544) — never all
     dormant at once. Announce dormancy on the command channel before ending a turn, and
     only when a peer is active or reliably wakeable.
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
| `PACT-AGREE v<n>` | ratify a pact version (§14) |
| `WORKFLOW:` | friction with the workflow itself (also register a WF-G row) |
| `NEEDS-HUMAN:` | escalation with concrete options |

## 10. Lock etiquette

§5 removes deadlock; this section is the day-to-day manners that keep the tree honest.
The authoritative behaviour is `PROTOCOL.md` (Locks, Reservations) — the rules below are
the orchestrator-facing obligations that follow from it.

- **Lock before you edit, and edit only what you locked.** Locks are advisory: nothing
  physically blocks the write, so an unlocked edit is invisible to every peer and is the
  one failure the whole scheme cannot recover from.
- **One atomic request for the whole set** (§5.1), with a quoted `--reason` naming the task
  id. The client refuses trailing bare words so prose cannot silently become extra locked
  paths.
- **TTL is yours to size, and renewal keeps your span.** The default is 30 minutes; pass a
  longer `--ttl` for a long packet. A renew with no ttl now keeps the lock's ORIGINAL span
  (WF-G110, 2026-09-09) — before that fix the heartbeat helper's per-beat renew silently
  reset a 180-minute lock to 30 minutes and two workers lost their locks mid-edit. Renew
  with minute-scale headroom, never at the expiry boundary.
- **Release the one path, not the record.** `unlock <path>` shrinks the lock through
  `POST /locks/:id/shrink` and keeps the other tokens, their id and their expiry
  (WF-G122). Before that fix, releasing one shared file dropped a worker's other three
  locks silently. `unlock --mine` on the way out still releases everything you hold.
- **A 409 is a stop, not a retry loop.** Reserve the path, announce it, do other work, and
  poll. Never spin against a live holder, and never edit "just this once" while waiting.
- **Read the holder before you wait on them.** `GET /locks` reports `holderHandle`,
  `holderIdleMs` and `holderStatus` (WF-G116), so you can tell live work from a hold that
  is merely being renewed. `client.mjs locks` prints `[repo]` and `idle <n>m` per row.
- **Keep your heartbeat running while you wait.** A reservation is released as `stale` once
  its holder passes the 10-minute presence TTL, so a silent waiter loses its place. A head
  reservation that leaves the file free also expires after `reservationGraceMs` (2 minutes
  by default) once another agent finds no lock covering it (WF-G121) — a reservation is a
  queue ticket, not a parking space. A reservation queued behind a HELD file keeps its
  place however old it is.
- **Force-release only a stale or gone holder.** `DELETE /locks/:id?force=1` is refused with
  `409` against an online holder, by design. Announce every force release on the command
  channel with the holder handle and its idle time.
- **Name the checkout.** A lock carries a derived `repo` field (WF-G119); the same relative
  path in a sibling checkout is a different file. Add a sibling root to
  `siblingRepoRoots` before running a cross-repo wave, or its locks fall back to this repo.
- **Hot shared files get a tool, not a lock queue.** Workflow gaps and global gaps are
  appended with `client.mjs gap add` (WF-G113) and amended with `gap update` / `gap resolve`
  (WF-G124); the daemon serializes the write and allocates the id, so no agent needs to hold
  the hottest file on the board.

## 11. Conflict resolution

A conflict is any state where two agents believe different things about the same ground.
Resolve it in this order, and stop at the first step that answers.

1. **File conflict (two agents want one path).** The lock decides. The loser reserves,
   announces, and works elsewhere; it never edits under a `409`. If the holder is stale or
   gone, force-release with an announcement (§10) rather than editing around it.
2. **Scope conflict (two campaigns claim one file domain).** Lead-versus-lead overlap fails
   at claim time by design; take the refusal as the answer. Join the live lead as deputy
   with your own bounded paths, or negotiate a lane (§6) before either side edits.
3. **Record conflict (chat and board disagree).** The board wins (§4). Fix the record —
   `task show <id>` prints the full body, refs, typed deps, claimant and result, so read the
   sibling task rather than reconstructing it from scrollback.
4. **Premise conflict (a task body disagrees with the code).** The code wins. State the
   drift in the task result and do the intended thing; run `task lint <id>` before dispatch,
   which flags path-shaped tokens absent from the checkout and backticked identifiers with
   no hit under `src/` (WF-G111). A stale premise is the orchestrator's defect, not the
   worker's.
5. **Design conflict (two orchestrators disagree on the build).** One `PROPOSE` /
   `COUNTER` round each on the command channel. If that does not converge, escalate (§12) —
   do not run competing implementations, and do not settle it by whoever locks first.
6. **Anything you found but must not fix here.** File it with `gap add` against the right
   project and quote the returned id in your result. A discovered adjacent gap never becomes
   scope creep inside someone else's task.

Every resolution that changes a durable record carries a `reason`: campaign `blocked` and
`done` refuse without one, and the history entry stores `{ from, state, reason }` (WF-G86).
"Because I said so" is not a reason a successor can read.

## 12. Escalation paths

Escalate up this ladder, never past a rung. Each rung names who unblocks it.

| Situation | Route | Who resolves |
|---|---|---|
| Lock held, holder online | `reserve`, `say`, poll; keep your heartbeat alive | the holder, by finishing |
| Lock held, holder stale/gone | `unlock <id> --force` + announcement | you, with the record |
| Task cannot finish | `task state <id> blocked --reason "<exact blocker>"`, and put what you DID finish in `--result` | the dispatching orchestrator |
| Adjacent defect outside your task | `gap add --project <p|global|workflow>` and quote the id | a later wave |
| Friction with the workflow itself | `WORKFLOW:` on the command channel plus a WF-G row | the orchestrator that owns the tooling |
| Peer disagreement after one PROPOSE/COUNTER round | `NEEDS-HUMAN:` with the concrete options | Remy |
| Campaign stuck with no live owner | unattended closure (§13) | any orchestrator, with a reason |

Rules that hold on every rung: escalate with evidence (commands, outputs, ids), never with a
feeling; never block while holding locks another agent needs (§5.5); and record the
escalation on the board, because chat scrollback is not a ledger.

## 13. Seats, attendance, and unattended closure

The 2026-09-09 seat model (see `PROTOCOL.md` § "Seats") changes who owns a campaign, so it
changes this pact.

- **A session is a day; a seat is a person.** A campaign belongs to a SEAT, so it keeps its
  owner when the session that claimed it ends. Locks, reservations, task claims and presence
  still belong to the SESSION — those are work in progress, not responsibility (D-B).
- **Take the seat at sign-in**, with `seat` on `register`. Registration always succeeds; a
  refused seat comes back as `seatError`, so announce the failure rather than working
  seatless and pretending otherwise. One live holder at a time; the seat frees the moment
  that holder's presence drops.
- **A seat name may not encode the job or a model** — that recreates the role model seats
  replace, or dies when the model changes (D-N). A rename keeps the old name in
  `formerNames`.
- **Read `attended`, not `ownerStatus`.** Every session ends, so `ownerStatus` reaches
  `gone` for every campaign eventually: on 2026-09-07 all 27 live campaigns reported a gone
  owner and none had been abandoned. `attended` asks the answerable question — is a live
  session sitting in the seat right now?
- **Unattended closure (WF-G83).** The owner is normally the only writer. When a campaign is
  UNATTENDED and its owner session is gone, an agent with role `orchestrator`, `master` or
  `human` may change its state; `reason` is then mandatory and the history entry carries
  `adoptedClosure: true` plus `previousOwner`. An attended campaign, or one whose owner
  session is still live, still returns `403` — takeover-only-on-gone (§5.4) is unchanged.
  `POST /campaigns/sweep` remains the bulk path for EMPTY unattended campaigns.
  This is the closure path for the 2026-08-28 finding that 10 active campaigns with a gone
  owner could never be closed. Use it to CLOSE finished work, never to seize live work.
- **The seat roster is mirrored to `tools/agora/seat-roster.json`** because `.agent/` is
  git-ignored. That file is a daemon-written copy: never hand-edit it, never commit it, and
  never add campaigns to it.

## 14. Amendments

The pact is versioned. To change it: PROPOSE the edit on the command channel, redline the
file under lock in your lane-agreed order, and ratify with `PACT-AGREE v<n>` from every
live orchestrator. Log substantive changes in the table below.

| Version | Date | Change | Agreed by |
|---|---|---|---|
| v1 | 2026-07-10 | Initial pact from the Sol–Vega bootstrap (Sol redline seq 541; §7.7 added from human seq 544 as pre-announced in seq 546) | Vega `PACT-AGREE v1` seq 545 · Sol `PACT-AGREE v1` seq 547 |
| v2 | 2026-07-10 | §6: peer review of a wave plan before first dispatch; retroactive review is a logged exception (from the mod-sweep missed gate, seqs 555/556/560) | Vega `PACT-AGREE v2` seq 564 · Sol `PACT-AGREE v2` seq 568 |
| v3 | 2026-09-09 | Added §10 lock etiquette (TTL/renew span WF-G110, single-path shrink WF-G122, holder idle fields WF-G116, reservation stale + idle grace WF-G121, repo field WF-G119, `gap add`/`gap update` for hot shared files WF-G113/WF-G124), §11 conflict resolution (file / scope / record / premise / design / out-of-scope, `task show`, `task lint` WF-G111, mandatory `reason` WF-G86), §12 escalation ladder, §13 seats and the WF-G83 unattended-closure path; §9 pointer renumbered to §14 | PROPOSED by seat wayfarer's sweep worker `coorch1-dd1a-20260909` (board task agora-dd1a.2) — **not yet ratified**; post `PACT-AGREE v3` to adopt |

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
- **Seat** — the durable identity that owns campaigns across sessions, taken at sign-in and
  freed when its holder's presence drops (§13).
- **Attended** — a campaign whose seat has a live session in it right now. The only field
  that answers "does this campaign have an owner"; `ownerStatus` does not.
- **Unattended closure** — the WF-G83 path by which an orchestrator, master or human closes
  a campaign that is unattended and whose owner session is gone, with a mandatory reason
  and an `adoptedClosure` history entry (§13).
- **Shrink** — releasing one path from a multi-path lock while the rest of the record, its
  id and its expiry survive (§10, WF-G122).
- **Activation adapter** — the registered, audited bridge that can start or resume one
  model harness when a wake-worthy message arrives and the harness is absent.
