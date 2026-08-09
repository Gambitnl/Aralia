# Audit — `draft-contract.md` vs. `original/SKILL.md` (`codex-wtWaitFor-polling` v1.0.0)

Overall the draft is a competent, largely well-abstracted rendering: it correctly
identifies delta-scoped detection as the core requirement, preserves the
same-response arming rule, the explicit timeout, the session-identifier
separation, and the independent-verification step, and it correctly strips the
literal constants (`END_TURN`, `5000`, `300000`, `2000`, `500`). The findings
below are the places where it diverges.

---

## 1. OMITTED

**1.1 — A timeout result must still carry recent output for diagnosis.**
The original does not merely signal expiry; it returns diagnostic context with
it:

> `return 'TIMEOUT: ' + wtGetText().slice(-500);`

Note also that the timeout tail is taken from the *whole* buffer
(`wtGetText().slice(-500)`), not the delta — the owner deliberately widens the
window when nothing new arrived. The draft requires only that a timeout be
"explicitly and unmistakably a timeout, distinguishable from a completion"
(§2) and separately requires useful output only on the *success* path ("Returning
the tail of new output beats returning a boolean", §3.5). The requirement that
the failure path also return readable context is absent.

**1.2 — The owner's stated precondition is the presence of a wait helper on the
page, not merely readable text + async evaluation.**
Original, front matter and trigger conditions:

> "Requires the terminal page to expose `window.wtWaitFor(pattern, timeoutMs)`."
> "- The terminal page exposes `window.wtWaitFor(pattern, timeoutMs)`"

The draft's applicability constraint (§4, last bullet) substitutes a different
precondition — "a way to read the terminal's accumulated text and to run
asynchronous code against it" — and never states the owner's declared one. The
draft's §6 "Ambiguity noted" acknowledges the tension, which mitigates but does
not cover this: an auditor reading only §4 would conclude the skill applies in
environments the owner explicitly gated out. Partial omission.

**1.3 — Companion-skill dependency.**
Original: "## Related Skills — `preview-multi-server-tabs` — keep Codex terminal
on one serverId, UI on another." The draft carries the *constraint* (§4, session
identifier) but drops the fact that the owner treats the multi-surface setup as a
distinct, related capability. Minor; contracts often drop cross-references.

---

## 2. DISTORTED

**2.1 — The token-cost concern is relocated from the agent to the in-page loop.**
The original's cost complaint is about *agent-initiated* polling:

> "Manual polling (checking every 30s) is either forgotten after the response
> ends, or done too frequently (every 3s) which is token-heavy."

In the original's own solution, the sampling interval sits *inside* a single
`preview_eval` and therefore has **zero** token cost regardless of cadence. The
draft (§3.4) instead frames cadence itself as the cost lever: "sampling cadence
should be coarse enough to be cheap and fine enough not to add meaningful
latency after completion." Cheapness is not a function of in-page cadence in the
original's design; the draft's §5 bullet ("Poll at a cadence that makes the cost
of waiting scale with the duration of the wait") states the correct property but
attaches it to the wrong knob. A reader could satisfy the draft by tuning an
in-page interval while still doing exactly the agent-level re-checking the skill
exists to eliminate.

**2.2 — An exemption the original does not grant, and which cuts against one of
its triggers.**
Draft §6: "**Must stay silent when:** … or the user explicitly wants to observe
or drive the process themselves."

Nothing in the original creates a user-observation exemption. The original moves
in the opposite direction — user involvement is listed as a *trigger to use the
skill*, not a reason to stand down:

> "- You're tempted to set a reminder or rely on the user to ping you"

The draft even retains this as a must-never ("delegating the watching to the
user", §5), so §6 introduces a loophole that contradicts §5.

**2.3 — "Must respect the ceiling" overstates a note about re-invocation.**
Draft §4: "the caller must respect the ceiling imposed by the surrounding tool's
own timeout." The original states the tool timeout as a fact and prescribes a
*remedy*, not compliance:

> "`preview_eval` has a tool-level timeout; for very long Codex runs (>5 min) you
> may need to re-invoke with a fresh baseline"

The owner's requirement is that a wait exceeding the tool ceiling be *continued*,
not that the requested duration be clamped under it. The draft does capture
continuation separately (§3.6 Recoverability), but §4's phrasing states a
constraint the original never imposes.

**2.4 — Minor: "the work in question returns its output synchronously through
ordinary command execution" (§6) is inferred negative space, not in the original.**
Defensible, but it is draft-authored content presented at the same confidence as
sourced constraints.

---

## 3. MISLABELED

**3.1 — Independent verification promoted from a procedural aside to a hard
prohibition.**
The original's entire treatment is one clause in a section about what the *call*
returns:

> "## Verification — The `preview_eval` call will block … and return the tail of
> Codex's response including `END_TURN`. You then verify commits with
> `git log --oneline`."

The draft elevates this to a Success criterion (§2, final bullet: "Whatever the
terminal process claims, the real effect of the delegated work is confirmed
independently … before it is reported as done") **and** a Must-never (§5, final
bullet). That is a two-level promotion of an unemphasized step into a governing
constraint. It is a plausible reading of owner intent, but it is the draft's
judgment, not the original's emphasis — and it enlarges the skill's scope beyond
"waiting", which §6 elsewhere claims the skill does not govern.

**3.2 — Cost efficiency arguably demoted.**
The original's Problem section names exactly two failure modes, and token cost is
one of them; the front-matter trigger list gives it its own entry ("you keep
forgetting to poll or polling too frequently/infrequently"). The draft ranks it
4th of 6 (§3.4), below "bounded, honest termination" — a property the original
mentions only as a `deadline` constant. Rankings are inherently interpretive, so
this is a soft finding, but the draft's ordering does not reflect the original's
own framing of what the skill is *for*.

**3.3 — Correctly labeled, for the record.** "Same response" arming (§3.2,
including the parenthetical defending it as a genuine requirement) is right — the
original bolds "**Immediately after submitting**" and comments "// Immediately
set up the blocking wait in the SAME response". Likewise the `serverId`
constraint is correctly hard, tracking the original's "Always use the terminal's
`serverId` … not the roadmap server".

---

## 4. LEAKED MEANS

**4.1 — "sampling cadence" (§3.4)** presupposes a poll loop. A push/event-driven
completion signal, or a helper that resolved on a delta-scoped match, would
satisfy every owner outcome while having no cadence at all. The original's 5s
interval is one implementation of "don't pay per unit of waiting"; the draft
bakes the loop into the ranked qualities.

**4.2 — "a way to read the terminal's accumulated text and to run asynchronous
code against it" (§4)** is `wtGetText()` + async `preview_eval` restated in
prose, then elevated into the applicability test. The owner-level requirement is
"the environment can tell you when the delegated turn ended, scoped to new
output"; text-scraping is how *this* implementation gets there.

**4.3 — "a browser-hosted preview the agent drives through an evaluation call"
(§1)** carries the preview-page/`preview_eval` mechanism into the Purpose
section, where it does no contract work. Compare "embedded terminal surface",
which the draft uses elsewhere and which is adequate.

**4.4 — "a reference point taken at (or just after) dispatch" (§4)** is the
byte-offset baseline (`start = wtGetText().length`) generalized only one step.
"Output produced after dispatch" — the draft's own §2 phrasing — is the
outcome; a *reference point* into an accumulated text buffer is the mechanism.

**4.5 — "session/host identifier" (§4)** is `serverId` lightly paraphrased. The
constraint is genuine; the noun is borrowed.

**4.6 — "(This is a genuine owner requirement, not merely a technique.)"
(§3.2)** is meta-commentary about the *extraction process*, not a statement of
what must be true of an implementation. It does not belong in a contract at all,
and it advertises that the contract was derived from a procedural source.

---

## 5. FINGERPRINTS

**5.1 — §6 "Ambiguity noted", first clause — strongest.**
> "the artifact's name points at a ready-made wait helper, while its substance
> argues against relying on it because that helper inspects the whole buffer"

This discloses (a) that a source artifact exists, (b) that its *name* references
a wait helper, and (c) the exact internal contradiction of the original's "Why
not use `wtWaitFor` directly?" section. Anyone with the skill list can map this
back to `codex-wtWaitFor-polling`. A contract should state the requirement
(delta-scoped detection) without narrating the source document's naming.

**5.2 — "for example on first startup" (§6).** Traces directly to the original's
note `wtWaitFor('model:', 30000)` — "fine for waiting for the Codex prompt on
startup". Distinctive enough to be recognizable as a carried example.

**5.3 — "delegated turn" / "finished its turn" (§1, §2, §5).** "Turn" is the
original's vocabulary, downstream of the `END_TURN` sentinel; it recurs six times
in the draft. "Completion signal" or "completion marker" (which the draft also
uses) is neutral.

**5.4 — "kept separate from other preview surfaces in use" (§4).** Echoes the
specific `dev` vs. `dev:roadmap` split and the `preview-multi-server-tabs`
pairing.

**5.5 — "a single bounded, blocking wait" (§1) / "single blocking call is armed"
(§2).** Mirrors the front matter's "a single `preview_eval` call that returns
only when the terminal outputs a specific string" closely enough to be a phrasal
tell.

**5.6 — Clean, for the record.** No literal `END_TURN`, `wtSend`, `wtGetText`,
`wtWaitFor`, `preview_eval`, `serverId`, `git log --oneline`, Codex, xterm.js, or
any of the numeric constants (1500 / 5000 / 300000 / 2000 / 500) appears. The
numeric discipline in particular is good — §2 says "the stated limit" rather than
five minutes.

---

## 6. VERDICT

**REVISE.**

The draft is close, and most of it is well-abstracted work. Three findings are
above the triviality bar and should be fixed before it is treated as faithful:

1. **§6's user-observation exemption (2.2)** is invented and directly contradicts
   both the original's trigger list and the draft's own §5 must-never. This is a
   substantive change to when the skill applies.
2. **§6's "Ambiguity noted" paragraph (5.1)** identifies the source artifact by
   describing its name and its internal argument. It also carries the startup
   example (5.2). This defeats the implementation-neutrality goal on its own
   terms.
3. **The cost requirement is attached to the wrong mechanism (2.1)**, leaving the
   contract satisfiable by tuning an in-page interval while retaining the
   agent-level re-checking the skill exists to eliminate. Fixing this and
   removing "sampling cadence" (4.1) are the same edit.

Secondary, worth folding in: restore the diagnostic-output-on-timeout
requirement (1.1); reconcile the stated precondition with the owner's (1.2);
reconsider whether independent verification of the delegated work belongs as a
must-never given §6's claim that the skill "governs *waiting*, not the content of
the delegated task" (3.1); and delete the §3.2 parenthetical (4.6).
