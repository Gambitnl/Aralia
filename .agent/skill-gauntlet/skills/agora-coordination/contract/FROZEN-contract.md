# Outcome Contract — multi-agent coordination for a shared working tree

## 1. Purpose

Several autonomous agents may operate on one shared source checkout at the same time, with no
built-in mutual exclusion; uncoordinated edits and tree-wide operations silently destroy work that
another agent has not yet committed. A separate coordination service holds the authoritative
shared state — who is present, which files are claimed, what work is queued, and messages between
participants. This skill exists to make that service discoverable at the moment it matters and to
get an agent to check in with it correctly: establish a distinct identity, see who else is active,
claim files before changing them, announce intent, take or publish work items, and hand back
everything it holds when finished — so that concurrent work composes instead of colliding.
Compliance is voluntary: the service signals ownership, it cannot enforce it.

## 2. Success

Observable from outside the agent, in the coordination service's own state and in the tree:

- The coordination service is confirmed reachable before shared work begins; if it is not running,
  it is brought up rather than bypassed.
- The agent appears exactly once in the active roster under an identity that is unmistakably its
  own and unique among concurrent participants, and presents that same identity on every
  subsequent interaction.
- Every shared file the agent modifies is covered by an ownership claim the agent held at the time
  of the change, and no file it modifies is claimed by anyone else.
- Where an ownership request is refused, the outside record shows the agent backed off and
  coordinated rather than editing anyway.
- Before any operation that could discard uncommitted work, the record shows the agent checked who
  was present and what was claimed, and did not proceed while another participant was active.
- Intent to change shared files is announced to the other participants, and messages addressed to
  the agent are actually read during the work rather than only at the end.
- Non-trivial work is visible on the shared work list — posted or claimed before it starts, and
  closed with a result stating what changed and what evidence supports it, sufficient for another
  participant to understand the outcome without reading the agent's transcript.
- On completion the agent holds nothing: claims released and work items resolved or explicitly
  handed back, done promptly rather than left for the expiry backstop.
- No other participant's uncommitted work is lost, and no claim was released or overridden while
  its holder was still live.
- The agent acts only on capabilities the service actually has; where its own summary is thin it
  consults the authoritative reference rather than guessing.

## 3. Qualities ranked

1. **Protection of other participants' work.** The failure this exists to prevent is silent and
   usually unrecoverable; every other quality is subordinate to it.
2. **Identity integrity.** All ownership guarantees are keyed to identity. If two concurrent
   participants resolve to one identity, an operation that releases "everything I hold" releases
   someone else's claims mid-edit.
3. **Honest deference on conflict.** In an advisory system, a refused claim only protects anyone
   if it is treated as a stop. Proceeding anyway defeats the whole mechanism.
4. **Truthfulness of reported state.** Results and completion records must describe what actually
   happened; other participants make decisions from that record and cannot re-derive it.
5. **Discoverability and brevity at the point of use.** The guidance must be short enough to be
   read and acted on in the moment; depth belongs in the authoritative references it routes to,
   differentiated by the role the reader is playing.
6. **Fidelity to the authoritative service contract.** Any summary must be a faithful, possibly
   partial view of the real interface — never a divergent or invented one.

## 4. Hard constraints

- The coordination service is external and authoritative. An implementation fronts it; it must not
  reimplement, cache as truth, or override its state or its rules.
- Ownership is advisory. Correct behavior must be achievable by voluntary compliance alone, and
  must never assume anything physically blocks a conflicting write.
- **Identity uniqueness is itself part of the requirement, not an implementation detail.** Joining
  is open and identifiers are self-chosen; what the contract requires is that each concurrent
  participant is distinguishable from every other and presents the same identifier on every one of
  its interactions.
- State-changing interactions must be authenticated as the acting identity. That credential is
  private to its holder and must never surface in shared, public, or logged views.
- Claim first, edit second, and only within what is held. A refusal is a stop for that file: back
  off and coordinate. There is no waiting line that confers permission to edit.
- Announce intent before changing shared files, and re-read shared state — presence, claims, and
  incoming messages — during the work. Nothing pushes updates to the agent; staying current is the
  agent's own obligation.
- Ownership is time-limited and lapses on its own. That expiry is a backstop, not a plan: hold
  claims for as little time as possible and release as soon as the edit is done.
- A claim whose holder is gone or stale may be forced open so that the tree does not deadlock. A
  live holder's claim may not be touched.
- Before any operation that can discard uncommitted work in the shared tree — resetting, switching,
  or setting aside tree state — check who is present and what is claimed, and **stop if another
  participant holds claims or is merely present.** Presence alone is sufficient to forbid it.
- Guidance must route by role: an individual worker and a participant coordinating several agents
  have materially different obligations, and both must be able to find the right depth of
  reference.
- Closing a work item records both the result and the evidence for it.

## 5. Must never

- Modify a shared file the agent does not hold a claim on, or continue after a refusal.
- Operate under a shared, borrowed, or ambiguous identity, or release/override claims belonging to
  a participant that is still live.
- Run an operation that can discard uncommitted work while another participant is present or holds
  claims.
- Report work as done or verified when it was not.
- Expose the authentication credential in any shared or public surface.
- Finish while still holding claims, or leave work items claimed and abandoned.
- Present coordination information that contradicts the authoritative service contract, or
  fabricate service behavior when the answer is not known.
- Silently degrade: skipping check-in because the service seems slow, absent, or inconvenient is a
  disqualifying outcome, not a graceful fallback.

## 6. Activation boundary

**Triggers** when work occurs in a checkout that other agents may be using concurrently and the
work involves: changing files, taking on or publishing work items, communicating with other
participants, needing to know who or what is currently active, or performing any operation that
could discard uncommitted work. It also triggers on arrival into such work and on completion of
it, since check-in and hand-back are both required.

**Stays silent** for: work confined to a checkout the agent occupies exclusively with no
possibility of concurrent participants; read-only inspection, analysis, or answering questions
where nothing is modified and no work item is taken; work located outside the shared tree; and
discussion that merely mentions coordination as a topic without any shared-tree work being
performed. Being unsure whether peers are present resolves toward triggering — the check is cheap
and the failure it prevents is not. An agent that finds itself alone in the shared tree still
checks in, because concurrent participants can arrive at any time.
