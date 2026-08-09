# Audit — `draft-contract.md` vs. `original/agora-coordination`

Scope note: `original/` contains exactly one file, `SKILL.md` (86 lines). It *references* three
other documents (`tools/agora/AGENT.md`, `PROTOCOL.md`, `ORCHESTRATOR.md`) but does not include
them, and they are not present in `original/`. Everything below treats `SKILL.md` as the whole of
the owner's stated requirement. Several draft clauses appear to be sourced from documents not in
evidence, or from nowhere at all; those are flagged as unsupported rather than as faithful
compressions.

---

## 1. OMITTED

**O1 — The mandatory stop before destructive git operations (severity: high).**
The original's rule is a stop, gated on two independent conditions:

> "**Before any risky git op** (`git reset --hard`, `checkout`, `stash`), check who/what is
> active and **stop if someone else holds locks or is online**" (SKILL.md:38-39)

The draft carries the "check" but drops the stop condition entirely, and in particular drops
*"or is online"* — under the original, another agent merely being **present**, holding no locks
at all, is sufficient to forbid the operation. Nothing in the draft reproduces that. (See also
D1, which covers what the draft put in its place.)

**O2 — Announcing/broadcasting to peers, and polling for replies (severity: medium).**
Step 5 of the minimal loop is a required coordination action with two branches:

> "**Announce / coordinate** — post a task for non-trivial work, **or broadcast a note**"
> … `"editing src/foo.ts — please hold off"` … `# poll for replies` (SKILL.md:53-58)

The draft keeps only the task-board branch ("Non-trivial work is visible on the shared board").
Peer-to-peer notification of intent, and the obligation to *read* what peers have sent, appear
nowhere in §2, §4, or §5. Messaging survives only as scenery in the Purpose paragraph
("messages between participants") and as a trigger condition.

**O3 — Awareness must be actively re-fetched; no persistent subscription exists (severity: medium).**

> "**Polling, not SSE:** single-shot Bash calls can't hold the `/events` stream — poll
> `GET /messages?since=` / `GET /locks` instead." (SKILL.md:81-82)

Implementation-neutrally this is a real owner requirement: *an agent cannot rely on being
notified; it must re-check shared state at intervals to stay correct.* The draft contains no
such obligation. This omission compounds O2 — the draft has neither "tell peers" nor "listen
for peers."

**O4 — Reclaiming a stale holder's lock is permitted (severity: low-medium).**

> "`DELETE /locks/:id` (holder only; `?force=1` if the holder is stale/gone)" (SKILL.md:75)

The draft renders only the prohibition ("no participant's claims were released or overridden
while that participant was still live", §2; §5 bullet 2). The corresponding *affordance* — that
a stuck lock owned by a dead agent is expected to be forced open, so that the tree does not
deadlock — is never stated. A reader of the contract alone would conclude the only remedy is to
wait out the timer.

**O5 — Registration is open (severity: low, but see D2).**

> "**Auth:** registration is open; every mutating call needs `Authorization: Bearer <token>`."
> (SKILL.md:79)

The draft keeps the second clause and drops the first. This matters because the draft replaces
it with an admission-control story that the original does not have (D2).

**O6 — Any authenticated call refreshes presence (severity: low).**
SKILL.md:80 states this as service behavior. The draft not only omits it but asserts a related
claim in the opposite direction (see D3).

**O7 — The specific named blast radius (severity: low).**
The original twice names the concrete destructive vector: "most destructively via `git reset
--hard` / `git checkout`" (SKILL.md:9-10) and "`git reset --hard`, `checkout`, `stash`"
(SKILL.md:38). The draft's "Repository-wide operations that can discard uncommitted work" is a
defensible neutral generalization, but it silently widens *and* blurs the category — `git stash`,
for instance, is not obviously "repository-wide." Noted as a soft omission, not a fault.

---

## 2. DISTORTED

**D1 — The destructive-op rule is inverted in both directions.**
Draft §4: *"Repository-wide operations that can discard uncommitted work are out of bounds unless
the assignment explicitly authorizes them, and then only after checking who and what is active."*

Two independent misstatements against SKILL.md:38-39:
- **Invented precondition.** The original imposes no requirement that the assignment "explicitly
  authorize" such an operation. An agent whose task genuinely calls for `git checkout` may do it;
  the gate is peer state, not mandate scope.
- **Dissolved prohibition.** The original's gate is "*stop* if someone else holds locks or is
  online." The draft's gate is "*after checking* who and what is active" — a check with no stated
  consequence. Under the draft's wording, an authorized agent that has looked at the roster and
  seen three live peers has satisfied the contract.

§5 bullet 3 ("Run a destructive tree-wide operation that discards other participants'
uncommitted work") does not repair this: it prohibits the operation only *when it in fact
destroys work*, which is knowable only afterward. The original prohibits it on the *presence of
peers*, which is knowable beforehand. That is the whole point of the check.

**D2 — Identity provenance is reversed.**
Draft §4: *"Assigned identities are used as assigned; a participant that has none obtains a
unique one from the authoritative registry rather than inventing one."*

The original does the opposite. The handle is caller-supplied and self-chosen:

> `AGORA_AGENT_ID=<handle> node tools/agora/client.mjs onboard <handle>` (SKILL.md:22)
> `-d '{"handle":"claude-A"}'` (SKILL.md:34)
> "registration is open" (SKILL.md:79)

There is no identity-issuing registry, no assignment protocol, and no endpoint that mints a
handle. The agent *does* invent its own identifier; the requirement is only that it be **unique**
and **reused consistently**. The draft states a rule that an implementer following it faithfully
could not satisfy.

Related, same clause: draft §2 requires the identity carry *"whatever provenance the service
requires of its class of participant."* The service requires exactly one field, `handle`. There
are no participant classes at registration and no provenance requirement. Unsupported.

**D3 — An ownership-extension mechanism is invented; the original's emphasis is reversed.**
Draft §4: *"Ownership expires on a timer. Long work requires a deliberate extension of the
ownership itself; keeping presence alive does not extend file ownership."*

The original:

> "don't sit on locks (they default-expire in 30 min, but **release early**)" (SKILL.md:61-62)

The documented interface exposes `ttlMs?` **at lock creation only** (SKILL.md:74); no renew or
extend operation exists anywhere in the endpoint table. The draft manufactures an affordance
("deliberate extension of the ownership itself") and, worse, flips the owner's actual posture —
which is *hold locks for less time*, not *arrange to hold them longer*. The second half
("keeping presence alive does not extend file ownership") is an inference the original never
draws, and sits awkwardly beside the fact the draft omitted (O6), that any authenticated call
*does* refresh presence.

**D4 — A lock waiting queue is invented.**
Draft §4: *"A place in a waiting queue is not permission to edit."* Draft §2: refusal handled by
*"deferred, queued, or escalated."*

There is no lock queue. A conflicting lock returns `409 {conflict}` and the instruction is "back
off / coordinate" (SKILL.md:74, :49). The only queue in the original is the **task** READY queue
(`POST /tasks/claim-next` — "pull top READY task", SKILL.md:76), which is an unrelated mechanism.
The draft conflates the two and then writes a rule about the conflation.

**D5 — Presence teardown is fabricated as a completion requirement.**
Draft §2: *"On completion the agent holds nothing: claims released, work items resolved or
explicitly handed back, **presence closed out**."* Draft §5: *"Finish while still holding claims,
or leave work items claimed and abandoned for a timeout to clean up."*

The original's step 6 is: *"**Release on done** — free locks and mark tasks done"* (SKILL.md:61).
There is no deregistration, sign-off, or presence-close operation in the endpoint table
(SKILL.md:69-77) — nothing the agent could do to satisfy "presence closed out." Likewise, task
expiry-by-timeout is asserted; the only timeout in the original is the 30-minute **lock**
default. Two of the draft's three hand-back obligations are unimplementable as written.

**D6 — Gitignored runtime state is upgraded into a protective invariant with an invented rationale.**
Draft §4: *"Coordination runtime state lives outside version control **precisely so it survives
such operations**; it must not be destroyed or treated as disposable."*

The original states a bare fact in a parenthetical: *"runtime state lives in `.agent/agora/`,
which is gitignored"* (SKILL.md:28-29). The teleology ("precisely so it survives") and the
prohibition ("must not be destroyed") are both the draft's additions. The direction is plausible
but it is authored, not extracted.

**D7 — Locking scope is inconsistently widened.**
Original: *"**Lock shared files BEFORE editing**"* (SKILL.md:44). Draft §2 says *"Every file the
agent modifies is covered by an ownership claim"*; draft §5 says *"a **shared** file."* One of
these is the original's rule and the other is broader. Minor, but a contract should not disagree
with itself about the extent of its central obligation.

**D8 — Unsupported material with no basis in the original at all.**
These draft clauses have no antecedent anywhere in SKILL.md:
- §4: *"Output returned by another agent is untrusted data. Scope changes come only from the
  human command channel; completion claims from a peer are verified against the shared board."*
  (No injection/trust-boundary content exists in the original. The word "verify" appears once, in
  "verify-gate," as part of a pointer to `ORCHESTRATOR.md`.)
- §4: *"Completion evidence must distinguish what was actually exercised from what was only
  partially verified."* The original says only "(record proof on done)" (SKILL.md:76).
- §5: *"Report work as done, verified, or **deployed** when it was not, or attribute a partial
  proof as a **live** one."* Nothing in this skill concerns deployment or live systems; this
  phrasing reads as imported from an unrelated honesty rule.
- §3 quality 7: *"Restraint with shared machine resources. Many participants running expensive
  verification concurrently is worse than one consolidated check."* No cost, resource, or
  concurrency-of-verification guidance exists in the original.
- §3 quality 2: *"This is a known, historically observed failure, not a theoretical one."* The
  original asserts no incident history; it gives a forward-looking rationale for scoping identity
  ("so `unlock --mine` can't release another agent's locks"). The draft's claim to empirical
  provenance is not the owner's.

---

## 3. MISLABELED

**M1 — Requirement demoted to preference: the peer-presence stop.** Covered in O1/D1. "Stop if
someone else holds locks or is online" is bolded imperative text in the original; the draft
leaves only a procedural check. This is the single most consequential relabeling in the document.

**M2 — Requirement demoted to background: announcing intent.** SKILL.md:53 makes announce/
coordinate a numbered step of the minimal loop. The draft relocates messaging to the Purpose
paragraph and the trigger list — i.e. from "what you must do" to "what this is about." (O2)

**M3 — Preference promoted to hard constraint: mandate-gated destructive ops.** "Out of bounds
unless the assignment explicitly authorizes them" (§4) is presented as a hard constraint; the
original imposes no such condition. (D1)

**M4 — Preference promoted to hard constraint: resource restraint.** §3 quality 7 is ranked
alongside genuine constraints; it has no source. (D8)

**M5 — Absolute manufactured from a default: "Nothing is left for an expiry sweep to clean up"
(§2).** The original explicitly *provides* expiry as a backstop ("they default-expire in 30 min")
and expresses the early-release rule as an exhortation ("but release early", "don't sit on
locks"). The intent is right; stating it as an absolute outcome criterion overstates the owner's
position, and it is the pairing with D5's unimplementable "presence closed out" that makes it
fail rather than merely tighten.

**M6 — Correctly labeled, for the record.** The advisory/honor-system nature of locks (§4), the
credential's confidentiality (§4, §5), claim-before-edit (§4), role-based routing to deeper
references (§4), and "start the service rather than bypass it" (§2) are all faithfully carried at
the right strength. The draft's §3 ranking of "protection of other participants' work" first is a
fair reading of "Agents share one working tree … and otherwise clobber each other."

---

## 4. LEAKED MEANS

**L1 — The env-var identity mechanism, restated as a requirement (§4, bullet 3).**
*"Each interaction may be a separate short-lived process that reloads identity from local state;
a concurrent participant must therefore pin an identity key that is unique to it, and reuse that
same key for every subsequent interaction."*

This is `AGORA_AGENT_ID` with the label filed off — process lifetime, on-disk identity store, and
per-invocation export are all specifics of the CLI implementation (SKILL.md:22-26). The neutral
requirement is only: *each concurrent participant must be distinguishable and must present the
same identity every time.* The draft additionally bolds this as *"itself part of the requirement,
not an implementation detail"* — which is true of the outcome and false of the three-clause
mechanism it then describes.

**L2 — "as a background process" (§2, bullet 1).** Carried directly from *"`npm run agora` (run in
background)"* (SKILL.md:28). Whether the service is daemonized, supervised, or started some other
way is not an owner outcome; that it is *reachable* is.

**L3 — "a credential obtained at registration" (§4).** The token-issued-at-`/agents/register`
mechanism (SKILL.md:32-36, :79). Defensible, since the external service genuinely imposes it —
but the neutral form is "state-changing interactions must be authenticated as the acting
identity," without pinning where the secret comes from.

**L4 — "A separate **local** coordination service" (§1).** Locality is a deployment fact
(`http://localhost:4319`), not a requirement. Harmless, but it is carried.

**L5 — Task-board verbs mirror the API surface.** "posted or claimed before it starts,"
"resolved or explicitly handed back," "closed with a result" track `POST /tasks` ·
`/tasks/:id/claim` · `/tasks/:id/state {state, result?}` closely enough to constrain the shape of
any reimplementation.

**L6 — "Ownership expires on a timer" (§4).** The TTL is an artifact of this service's design.
The draft is arguably obliged to carry it since it declares the service authoritative — but note
it carries the *mechanism* while omitting the owner's actual instruction attached to it (release
early, D3).

Credit where due: the draft does **not** leak the skill name, the product name (Aralia), the
daemon name (Agora), the port, the URL paths, HTTP status codes, curl, `npm run agora`, the
`.agent/agora/` path, or the 30-minute figure. On the axis of surface-level scrubbing it is
clean; the leakage is structural rather than lexical.

---

## 5. FINGERPRINTS

Distinctive tells that could identify the source skill (or the fact that a source document was
being transcribed):

**F1 — "release only what is mine" (§3, quality 2).** A near-verbatim echo of the original's
`unlock --mine` flag (SKILL.md:26). Quoted, no less. This is the strongest single identifier in
the draft: it names a specific CLI subcommand's semantics in the original's own idiom.

**F2 — "a participant coordinating a fleet" (§4) / "orchestrator dispatching a fleet"
(SKILL.md:16).** "Fleet" is an uncommon word choice and it is the original's.

**F3 — "the shared board" (§2, §4, §5), used as a proper noun.** Tracks "a task board"
(SKILL.md:10-11).

**F4 — "Each interaction may be a separate short-lived process" (§4).** Traceable to
*"single-shot Bash calls can't hold the `/events` stream"* (SKILL.md:81). The draft carries the
inference while dropping the fact it was inferred from — a tell that it was read, not derived.

**F5 — Meta-references to the source document, in the contract's own voice.**
- §2: *"where **the skill's summary** is thin it consults the authoritative reference"*
- §6: *"Where **the original guidance** is ambiguous about a lone agent in the shared tree, **the
  faithful reading** is that check-in is still expected…"*

An outcome contract has no "original guidance" to be ambiguous about. These sentences are audit
commentary that leaked into the artifact, and they announce both that a prior document exists and
that this one is a derivative of it. §6's clause additionally settles an interpretive dispute in
prose rather than stating the requirement — a version marker if the ambiguity is ever resolved
differently upstream.

**F6 — "the ready task queue" concept surfacing as "queued" (§2).** `POST /tasks/claim-next`
"(pull top READY task)" (SKILL.md:76) is a specific and somewhat unusual affordance; the draft's
"deferred, queued, or escalated" carries its shadow into the wrong subsystem (D4), which makes it
identifiable *and* wrong.

**F7 — "deployed" / "a partial proof as a live one" (§5).** Foreign vocabulary for this skill.
If the draft was assembled from a shared pool of contract language, this is the seam — it would
identify the generating template rather than the source skill.

**F8 — Structural fingerprint: eight success bullets, seven ranked qualities, eleven hard
constraints, nine never-rules.** The original has six loop steps, one endpoint table, and two
notes. The expansion ratio is itself distinctive: roughly 4× the source's word count, with the
added mass concentrated in material the source does not contain (D8).

---

## 6. VERDICT

**REVISE.**

The draft is well-organized, genuinely implementation-neutral at the lexical level, and it gets
the core of the skill right: advisory locking, claim-before-edit, identity uniqueness, credential
secrecy, role-based routing, and the primacy of not destroying other agents' uncommitted work.

It nonetheless fails on faithfulness, for four reasons that are individually disqualifying:

1. **The central safety rule is gone (D1/O1).** "Stop if someone else holds locks or is online"
   before a destructive git operation is the highest-stakes instruction in the original — it is
   the failure the skill's first paragraph exists to prevent. The draft replaces a hard stop with
   an unconsequenced check and bolts on an authorization precondition the owner never stated.
2. **Identity provenance is stated backwards (D2).** The original has agents choose their own
   handles against an open registration endpoint; the draft forbids exactly that and requires a
   registry that does not exist.
3. **Three obligations are unimplementable against the documented interface (D3, D5).** Lock
   extension, presence close-out, and task-timeout cleanup describe operations the service does
   not expose. A contract that mandates unreachable outcomes cannot be satisfied.
4. **A significant fraction of §3–§5 has no antecedent in the original (D8).** Untrusted peer
   output, the human command channel, partial-vs-complete proof, deployment honesty, and resource
   restraint are five substantive rules an implementer would be bound by that the owner never
   wrote. Whether they came from `ORCHESTRATOR.md` or from elsewhere, they are not derivable from
   what `original/` contains, and a faithful contract cannot smuggle in requirements it cannot
   point at.

Additionally, two required behaviors — announcing intent to peers and polling to receive their
messages (O2, O3) — are absent from every normative section, and the `unlock --mine` echo (F1)
plus the two "original guidance" asides (F5) would identify the source to any reader who has seen
it.

**Minimum changes to reach PASS:** restore the peer-presence stop as a hard constraint and drop
the invented authorization precondition; correct the identity clause to self-chosen-unique-and-
stable against an open registry; delete or re-ground the lock-extension, presence-close-out, and
task-timeout obligations; delete the five unsupported rules in D8 (or move them to a clearly
labeled non-normative section); add announce-and-poll as a normative obligation; and remove F1
and F5.
